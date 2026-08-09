import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdminDashboard } from './AdminDashboard'
import * as analyticsService from '../services/analyticsService'

describe('AdminDashboard', () => {
  it('shows the passcode gate first, and rejects a wrong passcode', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(false)
    const user = userEvent.setup()
    render(<AdminDashboard />)

    expect(screen.getByText('Admin dashboard')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Passcode'), 'wrong')
    await user.click(screen.getByRole('button', { name: /view dashboard/i }))

    expect(await screen.findByText(/incorrect passcode/i)).toBeInTheDocument()
  })

  it('shows project stats once the correct passcode is entered', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(analyticsService, 'getAdminStats').mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Test Project',
        createdAt: '2026-08-09T10:00:00Z',
        viewCount: 12,
        lastViewedAt: '2026-08-09T12:00:00Z',
        avgDurationSeconds: 95,
      },
    ])
    const user = userEvent.setup()
    render(<AdminDashboard />)

    await user.type(screen.getByLabelText('Passcode'), 'correct')
    await user.click(screen.getByRole('button', { name: /view dashboard/i }))

    expect(await screen.findByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('1m 35s')).toBeInTheDocument()
  })

  it('shows a friendly message when there are no projects yet', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(analyticsService, 'getAdminStats').mockResolvedValue([])
    const user = userEvent.setup()
    render(<AdminDashboard />)

    await user.type(screen.getByLabelText('Passcode'), 'correct')
    await user.click(screen.getByRole('button', { name: /view dashboard/i }))

    expect(await screen.findByText('No projects yet.')).toBeInTheDocument()
  })
})
