import type { ChangeEvent } from 'react'
import type { Level } from '../ifc/ifcSpatialTree'
import styles from './LevelsPanel.module.css'

interface LevelsPanelProps {
  levels: Level[]
  onJumpTo: (globalIds: string[]) => void
}

// A single native <select> (grouped by level via <optgroup>) rather than
// an always-expanded list -- a real building's levels + rooms is easily
// 20+ entries, which turned into an unusably long on-screen scroll before
// this. The browser's own dropdown handles that scrolling instead. See
// ifc/ifcSpatialTree.ts and docs/features/levels-and-rooms-navigation.md.
export function LevelsPanel({ levels, onJumpTo }: LevelsPanelProps) {
  if (levels.length === 0) return null

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const [kind, levelIndexRaw, roomIndexRaw] = event.target.value.split(':')
    const level = levels[Number(levelIndexRaw)]
    if (!level) return

    if (kind === 'level') {
      onJumpTo(level.elementGlobalIds)
    } else if (kind === 'room') {
      const room = level.rooms[Number(roomIndexRaw)]
      if (room) onJumpTo(room.elementGlobalIds)
    }

    // Reset back to the placeholder so picking the same entry again still
    // fires this handler (a <select> doesn't re-fire onChange for
    // re-selecting its already-current value).
    event.target.value = ''
  }

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.icon}
        width="16"
        height="16"
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
      {/* Kept short deliberately -- unlike the icon-button labels
          elsewhere (see styles/responsiveLabel.module.css), a <select>'s
          own text can't respond to a CSS media query, so there's no
          "full label on wide screens" version of this one. */}
      <select
        className={styles.select}
        defaultValue=""
        onChange={handleChange}
        aria-label="Jump to a level or room"
      >
        <option value="" disabled>
          Levels
        </option>
        {levels.map((level, levelIndex) => (
          <optgroup key={level.expressId} label={level.name}>
            <option value={`level:${levelIndex}`}>{level.name} (whole level)</option>
            {level.rooms.map((room, roomIndex) => (
              <option key={room.expressId} value={`room:${levelIndex}:${roomIndex}`}>
                {room.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
