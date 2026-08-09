import { useState } from 'react'
import type { Level } from '../ifc/ifcSpatialTree'
import styles from './LevelsPanel.module.css'

interface LevelsPanelProps {
  levels: Level[]
  onJumpTo: (globalIds: string[]) => void
}

// Lets a client jump straight to a level or room instead of orbiting
// around to find it. See ifc/ifcSpatialTree.ts and
// docs/features/levels-and-rooms-navigation.md.
export function LevelsPanel({ levels, onJumpTo }: LevelsPanelProps) {
  const [open, setOpen] = useState(false)

  if (levels.length === 0) return null

  return (
    <div>
      <button type="button" className={styles.toggle} onClick={() => setOpen((current) => !current)}>
        {open ? 'Hide levels & rooms' : 'Levels & rooms'}
      </button>
      {open && (
        <div className={styles.panel}>
          <ul className={styles.list}>
            {levels.map((level) => (
              <li key={level.expressId}>
                <button
                  type="button"
                  className={styles.levelButton}
                  onClick={() => onJumpTo(level.elementGlobalIds)}
                >
                  {level.name}
                </button>
                {level.rooms.length > 0 && (
                  <ul className={styles.roomList}>
                    {level.rooms.map((room) => (
                      <li key={room.expressId}>
                        <button
                          type="button"
                          className={styles.roomButton}
                          onClick={() => onJumpTo(room.elementGlobalIds)}
                        >
                          {room.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
