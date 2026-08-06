import * as WebIFC from 'web-ifc'

// web-ifc's WASM binary is checked into public/wasm/ (copied from
// node_modules/web-ifc/web-ifc.wasm) so Vite serves it as a static asset
// at the site root in both dev and production, with no bundler plugin
// needed. Using the single-threaded build deliberately, not
// web-ifc-mt.wasm -- the multi-threaded variant needs COOP/COEP response
// headers configured on the hosting side, which Phase 1 hasn't set up.
// IMPORTANT: if the `web-ifc` npm version is ever bumped, re-copy this
// file (`cp node_modules/web-ifc/web-ifc.wasm public/wasm/`) -- there is
// no automation keeping them in sync.
const WASM_PATH = '/wasm/'

export interface IfcModel {
  api: WebIFC.IfcAPI
  modelId: number
}

export async function loadIfcModel(ifcUrl: string): Promise<IfcModel> {
  const response = await fetch(ifcUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch IFC file: ${response.status} ${response.statusText}`)
  }
  const buffer = new Uint8Array(await response.arrayBuffer())

  const api = new WebIFC.IfcAPI()
  api.SetWasmPath(WASM_PATH)
  await api.Init()

  const modelId = api.OpenModel(buffer)
  return { api, modelId }
}
