import { useMemo, useState } from 'react'
import type { ElementCategory } from '../ifc/ifcCategories'
import { buildSchedule } from '../utils/scheduleData'
import styles from './SchedulePanel.module.css'
import labelStyles from '../styles/responsiveLabel.module.css'

interface SchedulePanelProps {
  categories: ElementCategory[]
  onIsolate: (hiddenGlobalIds: Set<string>) => void
  onJumpTo: (globalIds: string[]) => void
}

// A simple quantity takeoff -- "how many of each thing" as a list, not
// just tap-to-inspect one element at a time. A side panel (matching
// ElementDataPanel's own slide-in style, on the opposite edge so the two
// don't collide) rather than one of the small anchored corner panels,
// since a real schedule needs more room than those give. See
// docs/features/search-and-schedule.md.
export function SchedulePanel({ categories, onIsolate, onJumpTo }: SchedulePanelProps) {
  const [open, setOpen] = useState(false)
  const schedule = useMemo(() => buildSchedule(categories), [categories])
  const allGlobalIds = useMemo(() => {
    const ids = new Set<string>()
    for (const element of categories) ids.add(element.globalId)
    return ids
  }, [categories])

  if (schedule.length === 0) return null

  const grandTotal = schedule.reduce((sum, group) => sum + group.total, 0)

  function selectRow(globalIds: string[]) {
    const keep = new Set(globalIds)
    const hidden = new Set<string>()
    for (const id of allGlobalIds) {
      if (!keep.has(id)) hidden.add(id)
    }
    onIsolate(hidden)
    onJumpTo(globalIds)
  }

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Hide schedule' : 'Schedule'}
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
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span className={labelStyles.label}>{open ? 'Hide schedule' : 'Schedule'}</span>
      </button>
      {open && (
        <aside className={styles.panel}>
          <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
          <h2 className={styles.title}>Schedule</h2>
          <p className={styles.subtitle}>{grandTotal} elements total. Click a row to isolate it.</p>
          {schedule.map((group) => (
            <div key={group.discipline} className={styles.group}>
              <p className={styles.disciplineHeading}>
                {group.discipline} <span className={styles.disciplineTotal}>{group.total}</span>
              </p>
              <table className={styles.table}>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.category}>
                      <td>
                        <button type="button" className={styles.rowButton} onClick={() => selectRow(row.globalIds)}>
                          {row.category}
                        </button>
                      </td>
                      <td className={styles.countCell}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </aside>
      )}
    </>
  )
}
