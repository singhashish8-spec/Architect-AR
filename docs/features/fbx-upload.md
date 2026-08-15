# Feature: FBX upload with real textures/materials

> Part of [`features/`](README.md). Phase 2/3. Status: **built** (2026-08-12),
> **not yet verified against a real browser or a real textured FBX file**
> — this environment cannot run headless browser automation at all (see
> [`docs/history/findings.md`](../history/findings.md)'s matching entry),
> so this was built and reasoned through against the installed
> `three-stdlib`/`three` source directly, not confirmed end-to-end. See
> Open questions.

## Summary

Model uploads now accept `.fbx` files alongside `.glb`/`.gltf`, converted
client-side to a real, hostable GLB — the same "give the app just the
source file, it builds the viewable/AR-ready model" pattern
[`ifc-only-upload.md`](ifc-only-upload.md) already established for IFC.
Unlike IFC (which only ever produces flat-colored materials — an
IFC/Revit limitation, not something either conversion path can work
around), FBX can carry real materials and textures, matching
[`../roadmap/decisions.md`](../roadmap/decisions.md)'s existing note on
how to get real Revit textures into this app for free (Autodesk's
Twinmotion-for-Revit add-in exports FBX with real materials included, no
paid plugin required).

## Why this exists

The owner's own report, after trying to upload a large file: it turned
out to be an `.fbx` (from that same Twinmotion export path), selected
into the "IFC file" slot by mistake, which crashed the WASM IFC parser
("memory access out of bounds" — feeding it a completely different
binary format). Once that mismatch was found, the owner asked directly:
*"then make it read fbx too"*, followed by *"add a texture option while
uploading fbx... and if turned on... then in preview mode it should have
a toggle to on/off texture."*

## What's built

**Upload**: every "Model file" input (`ProjectCreateForm.tsx`,
`AdminProjectModels.tsx`'s `AddModelForm`, `pages/LocalPreview.tsx`) now
accepts `.fbx` alongside `.glb`/`.gltf`. Selecting an FBX file reveals an
**"Include textures and materials from this FBX file"** checkbox
(default **on** — the entire reason to prefer FBX over IFC is real
materials, so textures being on by default matters more than being
cautious about upload size). Submitting converts the FBX to a GLB
client-side (`viewer/fbxToGlb.ts`'s `convertFbxToGlb()`/
`uploadModelFileWithConversion()`) before uploading it exactly like any
other model file (through R2 — see
[`large-file-storage.md`](large-file-storage.md) — so a large textured
FBX export isn't newly blocked by Supabase's own 50 MB cap either).

**Conversion runs on the main thread, deliberately, unlike IFC's own
Web Worker-based conversion** (`ifc/ifcToGlb.worker.ts`, moved off the
main thread after a real freeze bug — see
[`docs/history/sessions/2026-08-10-session-06.md`](../history/sessions/2026-08-10-session-06.md)).
Confirmed directly in the installed `three` package's own source:
`TextureLoader` (which `three-stdlib`'s `FBXLoader` depends on for
materials) creates a real DOM `<img>` element to decode image data
(`createElementNS('img')`), which simply doesn't exist inside a Worker.
Splitting `FBXLoader.parse()` into a worker-safe geometry phase and a
main-thread texture phase isn't practical without forking the loader
(texture loading is triggered synchronously *inside* `parse()`, not as
a separable step), and skipping textures to make a worker path viable
would defeat the entire reason to prefer FBX over IFC in the first
place. **Known tradeoff, accepted rather than solved**: a very large or
texture-heavy FBX could make the page feel less responsive during
conversion, the same class of issue IFC had before it moved to a
worker — mitigated with a progress indicator
(`components/FbxConversionStatus.tsx`, an indeterminate bar since
`FBXLoader` doesn't expose real per-item counts the way IFC's own
per-mesh loop does), but not eliminated.

**When "Include textures" is off**, conversion skips waiting for
textures entirely (any that `FBXLoader` already started loading in the
background get discarded, not awaited) and strips every material's
`map` before export — smaller GLB, faster conversion, matching IFC's
own flat-color look.

**When "Include textures" is on**, conversion waits for every texture
`FBXLoader` queued to actually finish loading (via a `THREE.LoadingManager`
set up *before* `parse()` is called, since texture loads are queued
synchronously during parsing) before handing the scene to
`GLTFExporter` — otherwise the exported GLB could end up with broken or
missing texture references for whichever images hadn't finished
decoding yet. A 30-second timeout guards against a broken/hanging
texture URL leaving the whole upload stuck.

**Preview-mode toggle**: `viewer/ModelViewer.tsx` gained a
`texturesVisible` prop and an `onTexturesDetected` callback. The first
time a model's scene loads, every mesh material's original texture map
(if any) is recorded in a `Map` keyed by material (not mesh — glTF
exports commonly share one material across many meshes, so this only
records each texture once); `onTexturesDetected` reports upward whether
there was anything to record at all. A new
`components/TextureToggleButton.tsx` — a plain on/off switch, not a
panel like its corner-row neighbors (Levels/Categories/Lighting) — only
renders when that callback reported `true`, matching the same "don't
show a control that would be a no-op" discipline
[`boq.md`](boq.md)'s per-category "Group by level" toggle already
established. Toggling it doesn't reload anything — it just swaps each
material's `map` between `null` and its recorded original and marks the
material `needsUpdate`, live in the already-rendered scene.

**Lazy-loaded**, matching the precedent set for `exceljs` in
[`boq.md`](boq.md): `viewer/fbxToGlb.ts` statically imports
`three-stdlib`'s `FBXLoader`/`GLTFExporter`, which added a measurable
+23 KB gzipped to the main bundle when imported eagerly (confirmed via a
production build, 2026-08-12). The lightweight `isFbxFile()` check
(needed synchronously, just to decide whether to show the checkbox) was
split into its own dependency-free `viewer/isFbxFile.ts`; every actual
call to `convertFbxToGlb()`/`uploadModelFileWithConversion()` uses a
dynamic `import('../viewer/fbxToGlb')` right at the point of use, so the
conversion code (and `three-stdlib`) only ever loads for someone who
actually submits an FBX file — confirmed in the production build output:
`fbxToGlb-*.js` is its own separate chunk, not folded into the main
bundle, which returned to its pre-FBX size once this split was made.

## Open questions

- **Not verified against a real browser at all.** This whole feature —
  the conversion logic, the texture-loading wait/timeout behavior, the
  viewer toggle's material swapping — was built and unit-tested with
  mocked `FBXLoader`/`GLTFExporter`/`LoadingManager` (`fbxToGlb.test.ts`),
  reasoning carefully through the installed `three`/`three-stdlib`
  source rather than confirmed by actually running it, since this
  session's sandbox cannot run headless browser automation at all (see
  [`docs/history/findings.md`](../history/findings.md)). The orchestration
  logic (when textures are waited for vs. skipped, the timeout path, the
  "strip vs. keep" branch) is tested; **whether it actually renders a
  real textured FBX correctly in a real browser is not.**
- **`FBXLoader.parse(buffer, '')`'s empty resource path** means external
  texture files referenced by relative path (a separate `.jpg` sitting
  next to the `.fbx` on the original export) won't resolve — only
  embedded textures (common for a single-file FBX export, which is what
  this upload flow accepts) are expected to work. Not confirmed against
  a real multi-file FBX export.
- **The main-thread responsiveness tradeoff is accepted, not solved** —
  see "What's built" above. Worth watching for a real report of a page
  feeling frozen during FBX conversion, the same way IFC's own freeze
  bug was originally found.
- **No size/complexity guardrail on FBX uploads specifically** — a
  genuinely huge textured FBX (many high-resolution textures) could
  produce a very large GLB, slow to convert and slow to view. Not yet a
  reported problem, nothing built for it pre-emptively.
- ~~`ModelEditForm`'s "Replace model file" doesn't accept FBX~~ —
  **closed 2026-08-15**, as a side effect of merging the two file
  inputs into one `components/ModelFileDropzone.tsx` control (see
  [`large-file-storage.md`](large-file-storage.md) and
  [`../roadmap/decisions.md`](../roadmap/decisions.md)): every upload
  form, including the replace-file flow, now shares the same
  dropzone/textures-checkbox/conversion path.
