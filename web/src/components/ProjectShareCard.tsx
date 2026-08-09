import { useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { buildShareHtml, buildShareText } from '../utils/projectShareText'
import { BrandMark } from './BrandMark'
import styles from './ProjectShareCard.module.css'

interface ProjectShareCardProps {
  url: string
  projectName: string
  description: string | null
  // 'popup' (default): the small floating corner card on ProjectView's
  // own page -- always dark, left-aligned, over a live 3D viewport
  // regardless of the visitor's system theme. 'embedded': sitting inside
  // a normal page instead (the admin Share tab) -- follows the
  // surrounding light/dark theme and centers its contents, since the
  // "always dark, floating over 3D" reasoning doesn't apply there. See
  // docs/features/full-admin-dashboard.md.
  variant?: 'popup' | 'embedded'
}

type CopyState = 'idle' | 'copied' | 'error'

// A printable QR code plus everything needed to actually hand a project
// off to a client -- the plain link, a "copy for email" button that
// copies a real clickable link (not just plain text) so pasting into
// Gmail/Outlook keeps it tappable, and a share button for handing off to
// WhatsApp or whatever else is installed. See
// docs/features/project-share-card.md.
export function ProjectShareCard({ url, projectName, description, variant = 'popup' }: ProjectShareCardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [linkCopyState, setLinkCopyState] = useState<CopyState>('idle')
  const [emailCopyState, setEmailCopyState] = useState<CopyState>('idle')

  function handleDownload() {
    const svg = svgRef.current
    if (!svg) return

    const serialized = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([serialized], { type: 'image/svg+xml' })
    const blobUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `${projectName || 'project'}-qr.svg`
    link.click()

    URL.revokeObjectURL(blobUrl)
  }

  // Flashes "Copied!" for a moment, then reverts -- the only feedback a
  // clipboard write gets, since there's no browser-level confirmation of
  // its own.
  function flashCopyState(setState: (state: CopyState) => void, state: CopyState) {
    setState(state)
    setTimeout(() => setState('idle'), 2000)
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url)
      flashCopyState(setLinkCopyState, 'copied')
    } catch {
      flashCopyState(setLinkCopyState, 'error')
    }
  }

  // Writes both a plain-text and an HTML version to the clipboard, where
  // supported -- pasting the HTML version into an email keeps the link a
  // real clickable <a>, not just a bare URL the email client has to
  // guess is a link. Falls back to plain text on a browser that doesn't
  // support navigator.clipboard.write()/ClipboardItem (older Firefox in
  // particular).
  async function handleCopyForEmail() {
    const text = buildShareText(projectName, description, url)
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        const html = buildShareHtml(projectName, description, url)
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(text)
      }
      flashCopyState(setEmailCopyState, 'copied')
    } catch {
      flashCopyState(setEmailCopyState, 'error')
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ title: projectName, text: description ?? undefined, url })
    } catch {
      // Includes the user simply closing the share sheet (AbortError) --
      // not a real failure worth surfacing.
    }
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(buildShareText(projectName, description, url))}`

  return (
    <div className={variant === 'embedded' ? `${styles.card} ${styles.embedded}` : styles.card}>
      <BrandMark />
      <QRCodeSVG ref={svgRef} value={url} size={160} level="M" />

      <div className={styles.details}>
        <p className={styles.projectName}>{projectName}</p>
        {description && <p className={styles.description}>{description}</p>}
        <p className={styles.url}>{url}</p>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.actionButton} onClick={() => void handleCopyLink()}>
          {linkCopyState === 'copied' ? 'Copied!' : linkCopyState === 'error' ? "Couldn't copy" : 'Copy link'}
        </button>
        <button type="button" className={styles.actionButton} onClick={() => void handleCopyForEmail()}>
          {emailCopyState === 'copied' ? 'Copied!' : emailCopyState === 'error' ? "Couldn't copy" : 'Copy for email'}
        </button>
        {canShare && (
          <button type="button" className={styles.actionButton} onClick={() => void handleShare()}>
            Share…
          </button>
        )}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.actionButton}
        >
          Share via WhatsApp
        </a>
        <button type="button" className={styles.actionButton} onClick={handleDownload}>
          Download QR (SVG, for printing)
        </button>
      </div>
    </div>
  )
}
