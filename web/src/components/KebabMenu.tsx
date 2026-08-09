import { useEffect, useRef, useState } from 'react'
import styles from './KebabMenu.module.css'

export interface KebabMenuItem {
  label: string
  danger?: boolean
  // Exactly one of these -- a plain link (e.g. "Preview", opened in a
  // new tab) or an action (e.g. "Delete").
  onSelect?: () => void
  href?: string
}

interface KebabMenuProps {
  items: KebabMenuItem[]
  ariaLabel: string
}

// A small "⋮" dropdown for secondary/destructive row actions --
// keeps a list row down to just what it's about (name, status) instead
// of a whole button row per item. Closes on an outside click or Escape,
// same interaction pattern as any native menu.
export function KebabMenu({ items, ariaLabel }: KebabMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        &#8942;
      </button>
      {open && (
        <div className={styles.menu} role="menu" onClick={(event) => event.stopPropagation()}>
          {items.map((item) =>
            item.href ? (
              <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={styles.item} role="menuitem">
                {item.label}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={item.danger ? styles.itemDanger : styles.item}
                onClick={() => {
                  setOpen(false)
                  item.onSelect?.()
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
