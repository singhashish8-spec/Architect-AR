// Builds the text/HTML that gets copied to the clipboard or handed to
// the Web Share API when sharing a project link -- pulled out of
// components/ProjectShareCard.tsx so the formatting itself is testable
// without rendering anything. See docs/features/project-share-card.md.

export function buildShareText(projectName: string, description: string | null, url: string): string {
  const lines = [projectName]
  if (description) lines.push(description)
  lines.push(url)
  return lines.join('\n\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// A minimal HTML fragment, not a full document -- pasting this into an
// email/doc editor (Gmail, Outlook, Word, etc.) keeps the link a real
// clickable <a>, which is the whole point of offering a rich-text copy
// alongside the plain-text one (buildShareText above).
export function buildShareHtml(projectName: string, description: string | null, url: string): string {
  const descriptionHtml = description ? `<p>${escapeHtml(description)}</p>` : ''
  return `<div><p><strong>${escapeHtml(projectName)}</strong></p>${descriptionHtml}<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p></div>`
}
