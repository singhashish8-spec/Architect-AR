import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectQRCode } from './ProjectQRCode'

describe('ProjectQRCode', () => {
  it('renders a QR code and a download button', () => {
    render(<ProjectQRCode url="https://architect-ar.example/p/abc123" projectName="Test Project" />)
    expect(document.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download qr/i })).toBeInTheDocument()
  })
})
