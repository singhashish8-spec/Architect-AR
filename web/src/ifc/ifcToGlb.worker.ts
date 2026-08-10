import type { IfcAPI, PlacedGeometry } from 'web-ifc'
import * as THREE from 'three'
import { GLTFExporter } from 'three-stdlib'
import { openIfcModel } from './loadIfcModel'
import { unwrap } from './ifcPropertyLookup'
import { expandIfcGuid, hyphenateUuid } from './ifcGuid'
import type { ConversionProgress } from './ifcToGlb'

// Runs the actual IFC-to-GLB conversion (WASM parsing + per-element
// geometry building + glTF export) on a separate thread entirely, rather
// than yielding periodically on the main thread (the previous approach).
// The main-thread geometry loop *did* stay technically responsive between
// yields, but the single web-ifc WASM call this worker's openIfcModel()
// depends on (LoadAllGeometry) runs as one opaque, unyieldable native
// call -- for a small file like the Duplex sample that's instant, but for
// a real building's worth of geometry it can dominate the whole
// conversion time, during which no amount of JS-side yielding helps,
// since the main thread is blocked *inside a single WASM call*, not
// between JS statements. A worker sidesteps this entirely: whatever this
// thread is doing, however long, the main thread (and the page's own
// responsiveness) is completely unaffected. See
// docs/features/ifc-only-upload.md's "the page looked frozen" addendum.
//
// three-stdlib's GLTFExporter is worker-safe by design (falls back to
// OffscreenCanvas when `document` is undefined -- confirmed in the
// installed package's own source), and none of THREE's geometry/math
// classes used here touch the DOM at all, so this file can safely run
// the *entire* conversion, not just the parsing.

interface ConvertMessage {
  type: 'convert'
  buffer: ArrayBuffer
}

type WorkerOutMessage =
  | { type: 'progress'; progress: ConversionProgress }
  | { type: 'done'; glb: ArrayBuffer }
  | { type: 'error'; message: string }

function post(message: WorkerOutMessage, transfer: Transferable[] = []) {
  ;(self as unknown as Worker).postMessage(message, transfer)
}

function getNodeName(api: IfcAPI, modelId: number, expressId: number): string | undefined {
  try {
    const line = api.GetLine(modelId, expressId) as unknown as { GlobalId?: unknown }
    if (line.GlobalId === undefined) return undefined
    const compressed = unwrap(line.GlobalId)
    try {
      return hyphenateUuid(expandIfcGuid(compressed))
    } catch {
      return compressed
    }
  } catch {
    return undefined
  }
}

// Same vertex-buffer layout assumption as the previous main-thread
// version -- see ifcToGlb.ts's own history/docs/features/ifc-only-upload.md
// for how this was verified against the real Duplex sample.
function buildMesh(api: IfcAPI, modelId: number, placedGeometry: PlacedGeometry): THREE.Mesh {
  const geometry = api.GetGeometry(modelId, placedGeometry.geometryExpressID)
  const vertexData = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize())
  const indexData = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize())
  geometry.delete()

  const vertexCount = vertexData.length / 6
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  for (let v = 0; v < vertexCount; v++) {
    positions[v * 3] = vertexData[v * 6]
    positions[v * 3 + 1] = vertexData[v * 6 + 1]
    positions[v * 3 + 2] = vertexData[v * 6 + 2]
    normals[v * 3] = vertexData[v * 6 + 3]
    normals[v * 3 + 1] = vertexData[v * 6 + 4]
    normals[v * 3 + 2] = vertexData[v * 6 + 5]
  }

  const bufferGeometry = new THREE.BufferGeometry()
  bufferGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  bufferGeometry.setIndex(new THREE.BufferAttribute(indexData, 1))

  const { color } = placedGeometry
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color.x, color.y, color.z),
    opacity: color.w,
    transparent: color.w < 1,
    roughness: 0.7,
    metalness: 0.05,
  })

  const mesh = new THREE.Mesh(bufferGeometry, material)
  mesh.applyMatrix4(new THREE.Matrix4().fromArray(placedGeometry.flatTransformation))
  return mesh
}

async function convert(buffer: ArrayBuffer) {
  post({ type: 'progress', progress: { phase: 'parsing', current: 0, total: 1 } })
  const { api, modelId } = await openIfcModel(new Uint8Array(buffer))
  post({ type: 'progress', progress: { phase: 'parsing', current: 1, total: 1 } })

  try {
    const flatMeshes = api.LoadAllGeometry(modelId)
    const total = flatMeshes.size()
    const root = new THREE.Group()

    for (let i = 0; i < total; i++) {
      const flatMesh = flatMeshes.get(i)
      const group = new THREE.Group()
      const nodeName = getNodeName(api, modelId, flatMesh.expressID)
      if (nodeName) group.name = nodeName

      const placedGeometries = flatMesh.geometries
      for (let j = 0; j < placedGeometries.size(); j++) {
        const mesh = buildMesh(api, modelId, placedGeometries.get(j))
        if (nodeName) mesh.name = nodeName
        group.add(mesh)
      }
      root.add(group)

      post({ type: 'progress', progress: { phase: 'geometry', current: i + 1, total } })
    }

    post({ type: 'progress', progress: { phase: 'exporting', current: 0, total: 1 } })
    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(root, { binary: true })
    post({ type: 'progress', progress: { phase: 'exporting', current: 1, total: 1 } })

    const glb = result as ArrayBuffer
    post({ type: 'done', glb }, [glb])
  } finally {
    api.CloseModel(modelId)
  }
}

self.addEventListener('message', (event: MessageEvent<ConvertMessage>) => {
  if (event.data.type !== 'convert') return
  convert(event.data.buffer).catch((err: unknown) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  })
})
