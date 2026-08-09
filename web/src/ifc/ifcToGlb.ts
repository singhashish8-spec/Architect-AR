import type { IfcAPI, PlacedGeometry } from 'web-ifc'
import * as THREE from 'three'
import { GLTFExporter } from 'three-stdlib'
import { openIfcModel } from './loadIfcModel'
import { unwrap } from './ifcPropertyLookup'
import { expandIfcGuid, hyphenateUuid } from './ifcGuid'

export interface ConversionProgress {
  phase: 'parsing' | 'geometry' | 'exporting'
  current: number
  total: number
}

// Builds a real, hostable GLB straight from an IFC file's own geometry --
// no separate glTF export from the BIM tool needed. Lets the upload flow
// (and /local) accept just an IFC file: this fills in the GLB "View in
// AR" and the on-screen viewer still need, since Scene Viewer/Quick Look
// can only hand off a real glTF/USDZ file, not IFC directly (see
// ARHandoff.tsx and docs/features/element-data-inspection.md's AR
// limitation note). See docs/features/ifc-only-upload.md for the full
// story, including why this can only ever produce flat-colored materials
// (an IFC/Revit limitation, not something this conversion step can work
// around -- see docs/roadmap/decisions.md).
export async function convertIfcToGlb(
  ifcFile: File,
  onProgress?: (progress: ConversionProgress) => void,
): Promise<Blob> {
  onProgress?.({ phase: 'parsing', current: 0, total: 1 })
  const buffer = new Uint8Array(await ifcFile.arrayBuffer())
  const { api, modelId } = await openIfcModel(buffer)
  onProgress?.({ phase: 'parsing', current: 1, total: 1 })

  try {
    const flatMeshes = api.LoadAllGeometry(modelId)
    const total = flatMeshes.size()
    const root = new THREE.Group()

    for (let i = 0; i < total; i++) {
      const flatMesh = flatMeshes.get(i)
      const group = new THREE.Group()
      // Named with the *hyphenated-UUID* form (e.g.
      // "9808fd7f-1a92-...") of the element's GlobalId, not the raw
      // compressed IFC form (e.g. "2O2Fr$t4X7Zf8NOew3FK4F") -- a real bug
      // caught by testing against real data: the levels/rooms and
      // category features hand focusOnGlobalIds()/hiddenGlobalIds
      // identifiers already converted to the hyphenated form
      // (ifcPropertyLookup.ts's invertToHyphenatedGlobalIds(), chosen to
      // match IfcOpenShell's own glTF node-naming convention -- see
      // ifcGuid.ts), so a node named with the compressed form instead
      // never matched and both features silently did nothing. Named on
      // every mesh too, not just this wrapping group -- a raycast click
      // hits the mesh directly (see buildMesh() below and
      // ModelViewer.tsx's handleClick), never its parent group, so
      // tap-to-inspect needs the name there as well.
      const nodeName = getNodeName(api, modelId, flatMesh.expressID)
      if (nodeName) group.name = nodeName

      const placedGeometries = flatMesh.geometries
      for (let j = 0; j < placedGeometries.size(); j++) {
        const mesh = buildMesh(api, modelId, placedGeometries.get(j))
        if (nodeName) mesh.name = nodeName
        group.add(mesh)
      }
      root.add(group)
      // No flatMesh.delete() here -- despite web-ifc's own .d.ts declaring
      // one, a real FlatMesh returned by LoadAllGeometry() has no delete
      // method at runtime (confirmed directly against the real Duplex
      // file: Object.keys(flatMesh) is just ['geometries', 'expressID'],
      // typeof flatMesh.delete is 'undefined'). Calling it throws
      // "delete is not a function" and aborts the whole conversion.
      // IfcGeometry instances (from GetGeometry(), in buildMesh() below)
      // are a different type and do have a real delete() -- that one is
      // still called.

      onProgress?.({ phase: 'geometry', current: i + 1, total })
    }

    onProgress?.({ phase: 'exporting', current: 0, total: 1 })
    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(root, { binary: true })
    onProgress?.({ phase: 'exporting', current: 1, total: 1 })

    return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
  } finally {
    api.CloseModel(modelId)
  }
}

function getNodeName(api: IfcAPI, modelId: number, expressId: number): string | undefined {
  try {
    const line = api.GetLine(modelId, expressId) as unknown as { GlobalId?: unknown }
    // unwrap() is the same helper resolveNodeNameToExpressId's own index
    // relies on for reading a GlobalId off a web-ifc line -- reused here
    // rather than re-implementing the same { value, type } unwrapping.
    if (line.GlobalId === undefined) return undefined
    const compressed = unwrap(line.GlobalId)
    try {
      return hyphenateUuid(expandIfcGuid(compressed))
    } catch {
      // A malformed or non-standard GlobalId (rare) -- fall back to the
      // compressed form. Tap-to-inspect and category hide/show still
      // resolve it fine (buildGlobalIdIndex indexes the compressed form
      // too), but jump-to-room/level won't, since that feature only ever
      // hands out the hyphenated form -- same limitation
      // buildGlobalIdIndex's own identical fallback already has for
      // externally-exported models with a GlobalId in this shape.
      return compressed
    }
  } catch {
    // Not every flatMesh's underlying line necessarily has a GlobalId --
    // the mesh still renders, it just won't resolve to any BIM data.
    return undefined
  }
}

// web-ifc's vertex buffer interleaves position (3 floats) and normal (3
// floats) per vertex -- verified directly against the real Duplex sample
// (a standalone Node script confirmed the first 12 values are exactly two
// [x,y,z,nx,ny,nz] vertices with a repeated (0,0,1) normal), not assumed
// from web-ifc-three's own convention alone. See
// docs/features/ifc-only-upload.md.
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

  // IFC/Revit's own material export never carries real texture images --
  // see docs/roadmap/decisions.md -- so a flat color per placed geometry
  // (what web-ifc actually gives us) is the ceiling here, not a
  // shortcut we're taking.
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
