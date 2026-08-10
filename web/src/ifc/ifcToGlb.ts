export interface ConversionProgress {
  phase: 'parsing' | 'geometry' | 'exporting'
  current: number
  total: number
}

interface ProgressMessage {
  type: 'progress'
  progress: ConversionProgress
}
interface DoneMessage {
  type: 'done'
  glb: ArrayBuffer
}
interface ErrorMessage {
  type: 'error'
  message: string
}
type WorkerOutMessage = ProgressMessage | DoneMessage | ErrorMessage

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
//
// The actual work (WASM parsing + per-element geometry building + glTF
// export) all happens in ifcToGlb.worker.ts, on a separate thread -- this
// function is just a thin message-passing wrapper around it, keeping the
// same signature/behavior callers already depend on (ProjectCreateForm.tsx,
// AdminProjectModels.tsx, LocalPreview.tsx all need zero changes). See
// the worker file's own comment for why this moved off the main thread:
// a real building's worth of geometry can make the single web-ifc WASM
// call this depends on run long enough that even a periodically-yielding
// main-thread loop can't keep the page feeling responsive, since the
// block happens *inside* that one opaque WASM call, not between JS
// statements a yield could interrupt.
export function convertIfcToGlb(ifcFile: File, onProgress?: (progress: ConversionProgress) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ifcToGlb.worker.ts', import.meta.url), { type: 'module' })

    function cleanup() {
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        onProgress?.(message.progress)
      } else if (message.type === 'done') {
        cleanup()
        resolve(new Blob([message.glb], { type: 'model/gltf-binary' }))
      } else {
        cleanup()
        reject(new Error(message.message))
      }
    }
    worker.onerror = (event: ErrorEvent) => {
      cleanup()
      reject(event.error instanceof Error ? event.error : new Error(event.message || 'IFC conversion failed'))
    }

    void ifcFile.arrayBuffer().then((buffer) => {
      worker.postMessage({ type: 'convert', buffer }, [buffer])
    })
  })
}
