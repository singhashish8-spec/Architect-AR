import * as THREE from 'three'
import { FBXLoader, GLTFExporter } from 'three-stdlib'
import { uploadModelFile } from '../services/projectService'
import { isFbxFile } from './isFbxFile'

export interface FbxConversionProgress {
  phase: 'parsing' | 'loading textures' | 'exporting'
}

// Builds a real, hostable GLB straight from an uploaded FBX file --
// the same "give the app just the source file, it builds the
// viewable/AR-ready model" pattern ifc/ifcToGlb.ts already established
// for IFC. FBX exists as an upload option specifically because it CAN
// carry real materials/textures, unlike IFC (which only ever gives flat
// colors -- see docs/roadmap/decisions.md's "how does the owner get
// real Revit textures" row: Revit's own native FBX export already
// carries real materials, no third-party plugin needed).
//
// Deliberately runs on the MAIN THREAD, unlike IFC's own conversion
// (ifc/ifcToGlb.worker.ts, moved off the main thread after a real freeze
// bug -- see docs/history/sessions/2026-08-10-session-06.md). Confirmed
// directly in three's own installed source: ImageLoader (which
// TextureLoader depends on, which FBXLoader depends on for materials)
// creates a real DOM `<img>` element to decode image data
// (`createElementNS('img')`), and that simply doesn't exist inside a
// Worker. Splitting FBXLoader's parse() into a worker-safe geometry
// phase and a main-thread texture phase isn't practical without forking
// the loader itself (texture loading is triggered synchronously inside
// parse(), not as a separate step), and skipping textures to make a
// worker path viable would defeat the entire reason to prefer FBX over
// IFC in the first place. See docs/features/fbx-upload.md for the full
// writeup, including the explicit "not yet verified against a real
// textured FBX" caveat -- this was built without a real browser
// available to test in.
export async function convertFbxToGlb(
  fbxFile: File,
  options: { includeTextures: boolean },
  onProgress?: (progress: FbxConversionProgress) => void,
): Promise<Blob> {
  onProgress?.({ phase: 'parsing' })
  const buffer = await fbxFile.arrayBuffer()

  // Set up *before* parse() -- FBXLoader queues any texture loads
  // synchronously as part of parsing (calling the manager's own
  // itemStart() before parse() ever returns), so the manager's
  // callbacks have to already be attached to see them. Only actually
  // awaited when includeTextures is true; when it's false the textures
  // this manager is tracking get discarded a few lines down regardless
  // of whether they've finished loading yet, so there's nothing worth
  // waiting for.
  const manager = new THREE.LoadingManager()
  const texturesSettled = options.includeTextures ? watchTextureLoading(manager) : null

  const loader = new FBXLoader(manager)
  const root = loader.parse(buffer, '')

  if (options.includeTextures) {
    onProgress?.({ phase: 'loading textures' })
    await texturesSettled
  } else {
    stripTextures(root)
  }

  onProgress?.({ phase: 'exporting' })
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(root, { binary: true })
  return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
}

function stripTextures(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      const withMap = material as THREE.Material & { map?: THREE.Texture | null }
      if ('map' in withMap && withMap.map) {
        withMap.map = null
        withMap.needsUpdate = true
      }
    }
  })
}

// A texture-less FBX never calls the manager's itemStart() at all, so
// it never fires onLoad either (only itemEnd(), which onLoad depends
// on, is ever called in response to a matching itemStart()) -- resolve
// immediately in that case rather than waiting forever for a callback
// that will never come. A broken/hanging texture URL gets a hard
// timeout instead of leaving the whole upload flow stuck.
const TEXTURE_LOAD_TIMEOUT_MS = 30000

function watchTextureLoading(manager: THREE.LoadingManager): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    let startedAny = false

    function settle(fn: () => void) {
      if (settled) return
      settled = true
      fn()
    }

    manager.onStart = () => {
      startedAny = true
    }
    manager.onLoad = () => settle(resolve)
    manager.onError = (url) =>
      settle(() => reject(new Error(`Could not load a texture referenced by this FBX file (${url}).`)))

    setTimeout(() => {
      if (settled) return
      if (!startedAny) {
        settle(resolve)
        return
      }
      setTimeout(() => {
        settle(() => reject(new Error("Timed out waiting for this FBX file's textures to load.")))
      }, TEXTURE_LOAD_TIMEOUT_MS)
    }, 0)
  })
}

// Shared by every "upload a model file" form (ProjectCreateForm.tsx,
// AdminProjectModels.tsx's AddModelForm) so the "is this an FBX? convert
// it first" branch only has to be written once. Plain GLB/glTF uploads
// (the common case) pass straight through to uploadModelFile()
// unchanged.
export async function uploadModelFileWithConversion(
  file: File,
  options: { includeTextures: boolean },
  onProgress?: (progress: FbxConversionProgress) => void,
  onUploadProgress?: (loaded: number, total: number) => void,
): Promise<string> {
  if (!isFbxFile(file)) return uploadModelFile(file, onUploadProgress)

  const glb = await convertFbxToGlb(file, options, onProgress)
  const glbFile = new File([glb], `${file.name.replace(/\.fbx$/i, '')}.glb`, { type: 'model/gltf-binary' })
  return uploadModelFile(glbFile, onUploadProgress)
}
