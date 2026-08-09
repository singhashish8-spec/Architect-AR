// Client-side-only viewing preference (not stored anywhere, not part of
// a project's saved data) -- lets whoever's looking at the model pick
// the lighting mood for this viewing session. See
// docs/features/lighting-presets.md.
export const LIGHTING_PRESETS = ['daylight', 'evening', 'studio'] as const

export type LightingPreset = (typeof LIGHTING_PRESETS)[number]

export function isLightingPreset(value: string): value is LightingPreset {
  return (LIGHTING_PRESETS as readonly string[]).includes(value)
}

export const LIGHTING_PRESET_LABELS: Record<LightingPreset, string> = {
  daylight: 'Daylight',
  evening: 'Evening',
  studio: 'Studio',
}

export interface LightformerSpec {
  intensity: number
  color: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

// One config per preset, consumed by viewer/ModelViewer.tsx's
// <Environment> -- see docs/features/model-lighting.md for why this is
// built from Lightformer panels (plain geometry, generated entirely
// on-device) rather than a CDN-fetched HDR preset image: an external
// fetch hanging or failing was found to blank the *entire* model, not
// just the lighting, since Environment and the model share one Suspense
// boundary.
// The flat ambient + directional lights ModelViewer.tsx already had
// before lighting presets existed (see docs/features/model-lighting.md)
// -- kept, but now varying per preset too, since a bright flat ambient
// light stays constant otherwise and would wash out "evening"'s
// intentionally dim, warm mood regardless of what the Lightformer
// environment is doing.
export interface BaseLightSpec {
  ambientIntensity: number
  directionalIntensity: number
  directionalColor: string
}

export const BASE_LIGHT_CONFIGS: Record<LightingPreset, BaseLightSpec> = {
  daylight: { ambientIntensity: 0.6, directionalIntensity: 1, directionalColor: '#ffffff' },
  evening: { ambientIntensity: 0.25, directionalIntensity: 0.4, directionalColor: '#ffb877' },
  studio: { ambientIntensity: 0.7, directionalIntensity: 0.6, directionalColor: '#ffffff' },
}

export const LIGHTFORMER_CONFIGS: Record<LightingPreset, LightformerSpec[]> = {
  // Bright, cool, mostly-overhead light -- mimics open sky.
  daylight: [
    { intensity: 2.2, color: '#ffffff', position: [0, 5, 0], rotation: [0, 0, 0], scale: [10, 10, 1] },
    { intensity: 1, color: '#ffffff', position: [-5, 1, 0], rotation: [0, Math.PI / 2, 0], scale: [10, 5, 1] },
    { intensity: 1, color: '#ffffff', position: [5, 1, 0], rotation: [0, -Math.PI / 2, 0], scale: [10, 5, 1] },
    { intensity: 0.5, color: '#ffffff', position: [0, 1, -5], rotation: [0, 0, 0], scale: [10, 5, 1] },
  ],
  // Warm, dim, low-angle light -- mimics late-day sun/interior lamps.
  evening: [
    { intensity: 1.1, color: '#ffb877', position: [-5, 2, 2], rotation: [0, Math.PI / 2, 0], scale: [8, 6, 1] },
    { intensity: 0.5, color: '#ff9d5c', position: [0, 4, 0], rotation: [0, 0, 0], scale: [8, 8, 1] },
    { intensity: 0.3, color: '#6b7bab', position: [5, 1, -3], rotation: [0, -Math.PI / 2, 0], scale: [8, 5, 1] },
  ],
  // Even, neutral, high-key light from every side -- mimics a photo
  // studio softbox setup, minimal shadow contrast.
  studio: [
    { intensity: 1.6, color: '#ffffff', position: [0, 6, 0], rotation: [0, 0, 0], scale: [12, 12, 1] },
    { intensity: 1.6, color: '#ffffff', position: [0, -6, 0], rotation: [Math.PI, 0, 0], scale: [12, 12, 1] },
    { intensity: 1.2, color: '#ffffff', position: [-6, 1, 0], rotation: [0, Math.PI / 2, 0], scale: [10, 8, 1] },
    { intensity: 1.2, color: '#ffffff', position: [6, 1, 0], rotation: [0, -Math.PI / 2, 0], scale: [10, 8, 1] },
    { intensity: 1.2, color: '#ffffff', position: [0, 1, -6], rotation: [0, 0, 0], scale: [10, 8, 1] },
    { intensity: 1.2, color: '#ffffff', position: [0, 1, 6], rotation: [0, Math.PI, 0], scale: [10, 8, 1] },
  ],
}
