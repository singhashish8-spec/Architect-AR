import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdminDashboard } from './AdminDashboard'
import * as analyticsService from '../services/analyticsService'
import * as adminService from '../services/adminService'
import type { AdminProject } from '../services/adminService'

function project(overrides: Partial<AdminProject> = {}): AdminProject {
  return {
    id: 'p1',
    name: 'Test Project',
    description: null,
    status: 'active',
    createdAt: '2026-08-09T10:00:00Z',
    hasPasscode: false,
    models: [
      {
        id: 'm1',
        name: 'Main model',
        modelUrl: 'https://x.test/project-files/m1/model.glb',
        ifcUrl: null,
        scalePreset: '1:1',
        note: null,
      },
    ],
    viewCount: 12,
    lastViewedAt: '2026-08-09T12:00:00Z',
    avgDurationSeconds: 95,
    ...overrides,
  }
}

async function unlock(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Passcode'), 'correct')
  await user.click(screen.getByRole('button', { name: /view dashboard/i }))
}

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
    vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([project()])
    const user = userEvent.setup()
    render(<AdminDashboard />)

    await unlock(user)

    expect(await screen.findByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('12 views')).toBeInTheDocument()
    expect(screen.getByText('Avg. time: 1m 35s')).toBeInTheDocument()
  })

  it('shows a friendly message when there are no projects yet', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([])
    const user = userEvent.setup()
    render(<AdminDashboard />)

    await unlock(user)

    expect(await screen.findByText('No projects yet — create one above.')).toBeInTheDocument()
  })

  it('filters the list by the search box', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([
      project({ id: 'p1', name: 'Kitchen renovation' }),
      project({ id: 'p2', name: 'Office fitout' }),
    ])
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await unlock(user)

    expect(await screen.findByText('Kitchen renovation')).toBeInTheDocument()
    expect(screen.getByText('Office fitout')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search projects…'), 'kitchen')

    expect(screen.getByText('Kitchen renovation')).toBeInTheDocument()
    expect(screen.queryByText('Office fitout')).not.toBeInTheDocument()
  })

  it('opens the management panel and shows the project details form', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([project()])
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await unlock(user)

    await screen.findByText('Test Project')
    await user.click(screen.getByRole('button', { name: /manage/i }))

    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument()
  })

  it('deletes a project after confirming, and reloads the list', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    const listSpy = vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([project()])
    const deleteSpy = vi.spyOn(adminService, 'deleteAdminProject').mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await unlock(user)

    await screen.findByText('Test Project')
    const callsBeforeDelete = listSpy.mock.calls.length
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(deleteSpy).toHaveBeenCalledWith('correct', expect.objectContaining({ id: 'p1' }))
    // Re-fetches the list after a successful delete, rather than trying
    // to patch the deleted project out of local state itself.
    await waitFor(() => expect(listSpy.mock.calls.length).toBeGreaterThan(callsBeforeDelete))
  })
})
