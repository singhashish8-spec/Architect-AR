import { useState } from 'react'
import { LIGHTING_PRESETS, LIGHTING_PRESET_LABELS, type LightingPreset } from '../types/LightingPreset'
import styles from './LightingPresetPanel.module.css'
import labelStyles from '../styles/responsiveLabel.module.css'

interface LightingPresetPanelProps {
  value: LightingPreset
  onChange: (preset: LightingPreset) => void
}

// A small anchored panel matching LevelsPanel/CategoryPanel's own style,
// letting whoever's looking at the model pick a lighting mood for this
// viewing session -- see docs/features/lighting-presets.md. Client-side
// only, not saved anywhere; always starts back at 'daylight' on reload.
export function LightingPresetPanel({ value, onChange }: LightingPresetPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Hide lighting options' : 'Lighting'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
        </svg>
        <span className={labelStyles.label}>{open ? 'Hide lighting options' : 'Lighting'}</span>
      </button>
      {open && (
        <div className={styles.panel}>
          {LIGHTING_PRESETS.map((preset) => (
            <label key={preset} className={styles.optionRow}>
              <input
                type="radio"
                name="lighting-preset"
                checked={value === preset}
                onChange={() => {
                  onChange(preset)
                  setOpen(false)
                }}
              />
              {LIGHTING_PRESET_LABELS[preset]}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
