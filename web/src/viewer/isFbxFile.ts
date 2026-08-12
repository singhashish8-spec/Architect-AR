// Split out from fbxToGlb.ts on purpose -- this file has zero
// dependencies (not even `three`), so every form that needs to show/hide
// the "Include textures" checkbox can import it directly without pulling
// in three-stdlib's FBXLoader/GLTFExporter (a real, measurable chunk of
// the main bundle -- confirmed via a production build, 2026-08-12: +23
// KB gzipped when fbxToGlb.ts was imported statically everywhere it's
// used). fbxToGlb.ts's own heavier exports are dynamically imported
// instead, right at the point a conversion is actually needed, so that
// weight only ever loads for someone who actually uploads an FBX file.
export function isFbxFile(file: File): boolean {
  return /\.fbx$/i.test(file.name)
}
