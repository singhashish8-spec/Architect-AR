import { useState } from 'react'
import type { Level } from '../ifc/ifcSpatialTree'
import styles from './LevelsPanel.module.css'
import labelStyles from '../styles/responsiveLabel.module.css'

interface LevelsPanelProps {
  levels: Level[]
  onJumpTo: (globalIds: string[]) => void
}

// A button that opens a small anchored panel (capped height, its own
// scroll), not a native <select> -- an earlier version used a <select>
// specifically to avoid an always-expanded page-length list, but on
// Android that opens as a jarring full-screen OS picker instead, which
// wasn't the compact "dropdown" feel that was actually wanted. This
// keeps the same compact closed state while keeping the open state
// small and anchored, matching CategoryPanel's own pattern right next to
// it. See docs/features/levels-and-rooms-navigation.md.
export function LevelsPanel({ levels, onJumpTo }: LevelsPanelProps) {
  const [open, setOpen] = useState(false)

  if (levels.length === 0) return null

  function jumpTo(globalIds: string[]) {
    onJumpTo(globalIds)
    setOpen(false)
  }

  return (
    <div>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Hide levels & rooms' : 'Levels & rooms'}
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
          <rect x="4" y="2" width="16" height="20" rx="1" />
          <line x1="4" y1="8" x2="20" y2="8" />
          <line x1="4" y1="14" x2="20" y2="14" />
          <line x1="9" y1="22" x2="9" y2="14" />
        </svg>
        <span className={labelStyles.label}>{open ? 'Hide levels & rooms' : 'Levels & rooms'}</span>
      </button>
      {open && (
        <div className={styles.panel}>
          {levels.map((level) => (
            <div key={level.expressId}>
              <button type="button" className={styles.levelButton} onClick={() => jumpTo(level.elementGlobalIds)}>
                {level.name}
              </button>
              {level.rooms.length > 0 && (
                <div className={styles.roomList}>
                  {level.rooms.map((room) => (
                    <button
                      key={room.expressId}
                      type="button"
                      className={styles.roomButton}
                      onClick={() => jumpTo(room.elementGlobalIds)}
                    >
                      {room.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
