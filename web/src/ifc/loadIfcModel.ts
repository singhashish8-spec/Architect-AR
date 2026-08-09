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

// Opens an already-in-memory IFC buffer -- shared by loadIfcModel (fetches
// the buffer from a URL first) and ifcToGlb.ts (converts a buffer the user
// just picked in a file input, before it's been uploaded anywhere).
export async function openIfcModel(buffer: Uint8Array): Promise<IfcModel> {
  const api = new WebIFC.IfcAPI()
  // The `true` here is load-bearing: SetWasmPath's second argument means
  // "this path is absolute (site-root relative)", not "relative to the
  // executing script's own directory". Without it, web-ifc prepends the
  // JS bundle's own directory to WASM_PATH, breaking the URL. Verified
  // against the installed package's source (SetWasmPath's JSDoc and the
  // locateFileHandler in web-ifc-api.js), not just assumed.
  api.SetWasmPath(WASM_PATH, true)
  // forceSingleThread matches the single-threaded .wasm binary actually
  // checked into public/wasm/ -- see the comment on WASM_PATH above.
  // Without COOP/COEP headers Init() would fall back to single-threaded
  // anyway, but this makes the choice explicit rather than incidental.
  await api.Init(undefined, true)

  const modelId = api.OpenModel(buffer)
  return { api, modelId }
}

export async function loadIfcModel(ifcUrl: string): Promise<IfcModel> {
  const response = await fetch(ifcUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch IFC file: ${response.status} ${response.statusText}`)
  }
  const buffer = new Uint8Array(await response.arrayBuffer())
  return openIfcModel(buffer)
}
