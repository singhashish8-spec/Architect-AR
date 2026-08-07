import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface ProjectQRCodeProps {
  url: string
  projectName: string
}

// Printable QR code for a project's shareable link -- scan it straight
// off a printed drawing sheet to open this project. See
// docs/features/client-presentation-viewer.md. SVG, not canvas/PNG, so it
// stays crisp printed at any sheet size.
export function ProjectQRCode({ url, projectName }: ProjectQRCodeProps) {
  const svgRef = useRef<SVGSVGElement>(null)

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

  return (
    <div>
      <QRCodeSVG ref={svgRef} value={url} size={200} level="M" />
      <div>
        <button type="button" onClick={handleDownload}>
          Download QR (SVG, for printing)
        </button>
      </div>
    </div>
  )
}
