import { useMemo, useState } from 'react'
import type { Level } from '../ifc/ifcSpatialTree'
import type { ElementCategory } from '../ifc/ifcCategories'
import { buildResults, type SearchResult } from '../utils/searchResults'
import styles from './SearchPanel.module.css'
import labelStyles from '../styles/responsiveLabel.module.css'

interface SearchPanelProps {
  levels: Level[]
  categories: ElementCategory[]
  onIsolate: (hiddenGlobalIds: Set<string>) => void
  onJumpTo: (globalIds: string[]) => void
  // Controlled rather than local state -- see LevelsPanel.tsx's matching
  // comment. types/CornerPanel.ts.
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchPanel({ levels, categories, onIsolate, onJumpTo, open, onOpenChange }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [isolated, setIsolated] = useState<string | null>(null)

  const allResults = useMemo(() => buildResults(levels, categories), [levels, categories])
  const allGlobalIds = useMemo(() => {
    const ids = new Set<string>()
    for (const element of categories) ids.add(element.globalId)
    return ids
  }, [categories])

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []
    return allResults.filter((result) => result.label.toLowerCase().includes(trimmed)).slice(0, 20)
  }, [allResults, query])

  if (allResults.length === 0) return null

  function selectResult(result: SearchResult) {
    const keep = new Set(result.globalIds)
    const hidden = new Set<string>()
    for (const id of allGlobalIds) {
      if (!keep.has(id)) hidden.add(id)
    }
    onIsolate(hidden)
    onJumpTo(result.globalIds)
    setIsolated(result.label)
    onOpenChange(false)
  }

  function clearIsolation() {
    onIsolate(new Set())
    setIsolated(null)
    setQuery('')
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => onOpenChange(!open)}
        aria-label={open ? 'Hide search' : 'Search elements'}
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
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className={labelStyles.label}>{open ? 'Hide search' : 'Search elements'}</span>
      </button>
      {open && (
        <div className={styles.panel}>
          <input
            type="text"
            className={styles.input}
            placeholder="e.g. “door”, “kitchen”, “level 1”…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          {isolated && (
            <p className={styles.isolatedNote}>
              Showing only: {isolated}.{' '}
              <button type="button" className={styles.clearLink} onClick={clearIsolation}>
                Show everything
              </button>
            </p>
          )}
          {query.trim() && (
            <ul className={styles.results}>
              {matches.length === 0 && <li className={styles.empty}>No matches</li>}
              {matches.map((result, index) => (
                <li key={`${result.kind}-${result.label}-${index}`}>
                  <button type="button" className={styles.resultButton} onClick={() => selectResult(result)}>
                    <span className={styles.resultLabel}>{result.label}</span>
                    <span className={styles.resultSublabel}>{result.sublabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
