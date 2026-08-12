import styles from './TextureToggleButton.module.css'
import labelStyles from '../styles/responsiveLabel.module.css'

interface TextureToggleButtonProps {
  visible: boolean
  onChange: (visible: boolean) => void
}

// A plain on/off switch, not a panel like its corner-row neighbors
// (LevelsPanel, CategoryPanel, LightingPresetPanel) -- there's nothing
// to pick, just "show the real textures on this model, or don't."
// Callers only render this when the current model actually has
// textures to toggle at all (ModelViewer's own onTexturesDetected) --
// see docs/features/fbx-upload.md.
export function TextureToggleButton({ visible, onChange }: TextureToggleButtonProps) {
  return (
    <button
      type="button"
      className={visible ? styles.toggleActive : styles.toggle}
      onClick={() => onChange(!visible)}
      aria-pressed={visible}
      aria-label={visible ? 'Hide real textures' : 'Show real textures'}
      title={visible ? 'Switch to flat colors' : 'Switch to real textures/materials'}
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
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span className={labelStyles.label}>{visible ? 'Textures on' : 'Textures off'}</span>
    </button>
  )
}
