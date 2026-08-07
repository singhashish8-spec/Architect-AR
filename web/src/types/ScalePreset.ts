// Standard architectural drawing scales (ISO 5455 / RIBA convention).
// See docs/features/model-scale-presets.md -- chosen once by the architect
// at import, not a free-form value.
export const SCALE_PRESETS = [
  '1:1',
  '1:5',
  '1:10',
  '1:20',
  '1:50',
  '1:100',
  '1:200',
  '1:500',
  '1:1000',
] as const

export type ScalePreset = (typeof SCALE_PRESETS)[number]

export function isScalePreset(value: string): value is ScalePreset {
  return (SCALE_PRESETS as readonly string[]).includes(value)
}

// The ratio each preset represents, e.g. '1:100' -> 100.
export function scaleRatio(preset: ScalePreset): number {
  return Number(preset.split(':')[1])
}

// Assumes the exported glTF/GLB is always authored at true real-world 1:1
// units (1 model-meter = 1 real meter) -- see
// docs/features/model-scale-presets.md. This is the uniform visual scale
// factor to apply on top of that, so a 1:1000 master plan renders shrunk
// down to tabletop size (1/1000 scale) while a 1:1 room renders true
// life-size. Applied identically in both the R3F viewer (viewer/ModelViewer.tsx)
// and the <model-viewer> AR handoff (viewer/ARHandoff.tsx) so the two
// surfaces agree on how big the model looks.
export function visualScale(preset: ScalePreset): number {
  return 1 / scaleRatio(preset)
}
