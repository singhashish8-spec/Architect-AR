import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectShareCard } from './ProjectShareCard'

describe('ProjectShareCard', () => {
  it('renders a QR code, the project name/description/link, and the core actions', () => {
    render(
      <ProjectShareCard
        url="https://architect-ar.example/p/abc123"
        projectName="Test Project"
        description="Kitchen walkthrough for client review"
      />,
    )
    expect(document.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('Kitchen walkthrough for client review')).toBeInTheDocument()
    expect(screen.getByText('https://architect-ar.example/p/abc123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy for email/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /share via whatsapp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download qr/i })).toBeInTheDocument()
  })

  it('omits the description paragraph entirely when none was given', () => {
    render(<ProjectShareCard url="https://architect-ar.example/p/abc123" projectName="Test Project" description={null} />)
    expect(screen.getByText('Test Project')).toBeInTheDocument()
    expect(screen.queryByText(/walkthrough/i)).not.toBeInTheDocument()
  })

  it('links to WhatsApp with the project details pre-filled', () => {
    render(
      <ProjectShareCard
        url="https://architect-ar.example/p/abc123"
        projectName="Test Project"
        description="Kitchen walkthrough"
      />,
    )
    const whatsappLink = screen.getByRole('link', { name: /share via whatsapp/i })
    const href = whatsappLink.getAttribute('href') ?? ''
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(href)).toContain('Test Project')
    expect(decodeURIComponent(href)).toContain('Kitchen walkthrough')
    expect(decodeURIComponent(href)).toContain('https://architect-ar.example/p/abc123')
  })
})
