import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import * as analyticsService from '../../services/analyticsService'
import * as adminService from '../../services/adminService'
import type { AdminProject } from '../../services/adminService'

// Covers the multi-page admin redesign (Phase 3, 2026-08-09) end to end:
// passcode gate -> minimal project list -> click a row into its own page
// -> tabs. Previously one file (pages/AdminDashboard.test.tsx) covered
// the old single-page dashboard; that page is gone, replaced by the
// pages/admin/ route tree tested here. See
// docs/features/full-admin-dashboard.md.

function project(overrides: Partial<AdminProject> = {}): AdminProject {
  return {
    id: 'p1',
    name: 'Test Project',
    description: 'A description',
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
        createdAt: '2026-08-09T10:00:00Z',
        viewCount: 3,
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

describe('admin dashboard (multi-page)', () => {
  it('shows the passcode gate first, and rejects a wrong passcode', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(false)
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('Admin dashboard')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Passcode'), 'wrong')
    await user.click(screen.getByRole('button', { name: /view dashboard/i }))

    expect(await screen.findByText(/incorrect passcode/i)).toBeInTheDocument()
  })

  it('shows a minimal project list once unlocked -- name, status, views, no button row', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([project()])
    const user = userEvent.setup()
    render(<App />)

    await unlock(user)

    expect(await screen.findByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('12 views')).toBeInTheDocument()
    // Secondary actions live behind the kebab menu, not as their own
    // visible buttons on the row.
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it('shows a friendly message when there are no projects yet', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([])
    const user = userEvent.setup()
    render(<App />)

    await unlock(user)

    expect(await screen.findByText('No projects yet — create one above.')).toBeInTheDocument()
  })

  it('clicking a project row opens its own page with tabs', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([project()])
    const user = userEvent.setup()
    render(<App />)
    await unlock(user)

    await user.click(await screen.findByText('Test Project'))

    expect(await screen.findByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Models' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Share' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    // Overview is the default tab -- shows the description and stats.
    expect(screen.getByText('A description')).toBeInTheDocument()
  })

  it('the kebab menu offers Preview/Duplicate/Delete for a row', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([project()])
    const user = userEvent.setup()
    render(<App />)
    await unlock(user)

    await screen.findByText('Test Project')
    await user.click(screen.getByRole('button', { name: /actions for test project/i }))

    expect(screen.getByRole('menuitem', { name: 'Preview' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  it('deletes a project from its own page after confirming, and returns to the list', async () => {
    vi.spyOn(analyticsService, 'verifyAdminPasscode').mockResolvedValue(true)
    vi.spyOn(adminService, 'listAdminProjects').mockResolvedValue([project()])
    const deleteSpy = vi.spyOn(adminService, 'deleteAdminProject').mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await unlock(user)

    await user.click(await screen.findByText('Test Project'))
    await screen.findByRole('heading', { name: 'Test Project' })
    await user.click(screen.getByRole('button', { name: /actions for test project/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(deleteSpy).toHaveBeenCalledWith('correct', expect.objectContaining({ id: 'p1' }))
    await waitFor(() => expect(screen.getByText('Admin dashboard')).toBeInTheDocument())
  })
})
