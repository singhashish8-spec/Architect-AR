import { SCALE_PRESETS, type ScalePreset } from '../types/ScalePreset'

interface ScalePresetSelectProps {
  value: ScalePreset | ''
  onChange: (value: ScalePreset) => void
  id?: string
}

// Preset dropdown, not a free-form value -- the architect picks one of
// the standard architectural drawing scales at import. See
// docs/features/model-scale-presets.md.
export function ScalePresetSelect({ value, onChange, id }: ScalePresetSelectProps) {
  return (
    <select
      id={id}
      value={value}
      required
      onChange={(event) => onChange(event.target.value as ScalePreset)}
    >
      <option value="" disabled>
        Select a scale…
      </option>
      {SCALE_PRESETS.map((preset) => (
        <option key={preset} value={preset}>
          {preset}
        </option>
      ))}
    </select>
  )
}
