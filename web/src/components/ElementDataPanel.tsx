import styles from './ElementDataPanel.module.css'
import type { IfcElementData } from '../types/IfcElementData'

interface ElementDataPanelProps {
  data: IfcElementData | null
  loading: boolean
  onClose: () => void
}

export function ElementDataPanel({ data, loading, onClose }: ElementDataPanelProps) {
  if (!loading && !data) return null

  return (
    <aside className={styles.panel}>
      <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
        ×
      </button>
      {loading && <p>Loading element data…</p>}
      {data && (
        <>
          <h2>{data.name ?? data.type}</h2>
          <p className={styles.type}>{data.type}</p>
          {data.properties.length === 0 ? (
            <p>No data available for this element.</p>
          ) : (
            <dl>
              {data.properties.map((property) => (
                <div key={property.name} className={styles.row}>
                  <dt>{property.name}</dt>
                  <dd>{property.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </aside>
  )
}
