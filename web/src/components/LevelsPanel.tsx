import { useState } from 'react'
import type { Level } from '../ifc/ifcSpatialTree'
import styles from './LevelsPanel.module.css'
import labelStyles from '../styles/responsiveLabel.module.css'

interface LevelsPanelProps {
  levels: Level[]
  onJumpTo: (globalIds: string[]) => void
  // Controlled rather than local state -- the page owns a single "which
  // corner panel is open" value shared across all of them, so opening
  // this one closes whichever other was open instead of stacking. See
  // types/CornerPanel.ts.
  open: boolean
  onOpenChange: (open: boolean) => void
}

// A button that opens a small anchored panel (capped height, its own
// scroll), not a native <select> -- an earlier version used a <select>
// specifically to avoid an always-expanded page-length list, but on
// Android that opens as a jarring full-screen OS picker instead, which
// wasn't the compact "dropdown" feel that was actually wanted. This
// keeps the same compact closed state while keeping the open state
// small and anchored, matching CategoryPanel's own pattern right next to
// it. See docs/features/levels-and-rooms-navigation.md.
export function LevelsPanel({ levels, onJumpTo, open, onOpenChange }: LevelsPanelProps) {
  // Each level's room list starts collapsed -- a real building's levels
  // can each hold a dozen-plus rooms, and showing all of them for every
  // level at once defeats the point of this being a compact panel.
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set())

  if (levels.length === 0) return null

  function jumpTo(globalIds: string[]) {
    onJumpTo(globalIds)
    onOpenChange(false)
  }

  function toggleExpanded(expressId: number) {
    setExpandedLevels((current) => {
      const next = new Set(current)
      if (next.has(expressId)) next.delete(expressId)
      else next.add(expressId)
      return next
    })
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => onOpenChange(!open)}
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
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span className={labelStyles.label}>{open ? 'Hide levels & rooms' : 'Levels & rooms'}</span>
      </button>
      {open && (
        <div className={styles.panel}>
          {levels.map((level) => {
            const expanded = expandedLevels.has(level.expressId)
            return (
              <div key={level.expressId}>
                <div className={styles.levelRow}>
                  {level.rooms.length > 0 ? (
                    <button
                      type="button"
                      className={styles.disclosure}
                      onClick={() => toggleExpanded(level.expressId)}
                      aria-label={expanded ? `Collapse ${level.name}` : `Expand ${level.name}`}
                    >
                      <svg
                        className={expanded ? styles.chevronOpen : styles.chevron}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  ) : (
                    <span className={styles.disclosureSpacer} />
                  )}
                  <button type="button" className={styles.levelButton} onClick={() => jumpTo(level.elementGlobalIds)}>
                    {level.name}
                  </button>
                </div>
                {expanded && level.rooms.length > 0 && (
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
            )
          })}
        </div>
      )}
    </div>
  )
}
