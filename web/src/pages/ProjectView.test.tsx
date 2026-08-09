import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProjectView } from './ProjectView'
import * as projectService from '../services/projectService'
import type { Project } from '../types/Project'

// ModelViewer/ARHandoff are WebGL-heavy (real GPU work) -- not something
// jsdom can render, so they're swapped for lightweight stand-ins that
// just surface the props relevant to this test (which model is active).
vi.mock('../viewer/ModelViewer', () => ({
  ModelViewer: ({ modelUrl }: { modelUrl: string }) => <div data-testid="model-viewer">{modelUrl}</div>,
}))
vi.mock('../viewer/ARHandoff', () => ({
  ARHandoff: () => <div data-testid="ar-handoff" />,
}))
// Stable (module-level, not recreated per call) -- the real hook keeps
// levels/categories in useState, so their references stay stable across
// re-renders once parsing finishes. A mock that instead returns a fresh
// `[]` on every call breaks that: CategoryPanel's own effect deliberately
// re-fires whenever its inputs change reference (see its own comment),
// and a same-render-loop-triggering fresh array every time is exactly
// the unstable reference it warns about -- causes an infinite render
// loop that's a pure test-mock artifact, not a real app bug.
const stableLevels: never[] = []
const stableCategories: never[] = []
vi.mock('../ifc/useIfcElementData', () => ({
  useIfcElementData: () => ({
    loading: false,
    error: null,
    levels: stableLevels,
    categories: stableCategories,
    getElementDataByGlobalId: vi.fn(),
  }),
}))
vi.mock('../hooks/useProjectViewTracking', () => ({
  useProjectViewTracking: vi.fn(),
}))

function project(): Project {
  return {
    id: 'p1',
    name: 'Kitchen Renovation',
    description: null,
    createdAt: '2026-08-09T10:00:00Z',
    models: [
      { id: 'm1', name: 'Option A', modelUrl: 'https://x.test/a.glb', ifcUrl: null, scalePreset: '1:1' },
      { id: 'm2', name: 'Option B', modelUrl: 'https://x.test/b.glb', ifcUrl: null, scalePreset: '1:1' },
    ],
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:projectId" element={<ProjectView />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProjectView -- deep-linking a specific model', () => {
  it('shows the first model by default, with no ?model= param', async () => {
    vi.spyOn(projectService, 'projectRequiresPasscode').mockResolvedValue(false)
    vi.spyOn(projectService, 'getProject').mockResolvedValue(project())

    renderAt('/p/p1')

    expect(await screen.findByTestId('model-viewer')).toHaveTextContent('https://x.test/a.glb')
  })

  it('shows the requested model when ?model=<id> matches one of the project’s models', async () => {
    vi.spyOn(projectService, 'projectRequiresPasscode').mockResolvedValue(false)
    vi.spyOn(projectService, 'getProject').mockResolvedValue(project())

    renderAt('/p/p1?model=m2')

    expect(await screen.findByTestId('model-viewer')).toHaveTextContent('https://x.test/b.glb')
  })

  it('falls back to the first model when ?model= does not match any model', async () => {
    vi.spyOn(projectService, 'projectRequiresPasscode').mockResolvedValue(false)
    vi.spyOn(projectService, 'getProject').mockResolvedValue(project())

    renderAt('/p/p1?model=does-not-exist')

    expect(await screen.findByTestId('model-viewer')).toHaveTextContent('https://x.test/a.glb')
  })

  it('switching models via the tab switcher updates which model shows', async () => {
    vi.spyOn(projectService, 'projectRequiresPasscode').mockResolvedValue(false)
    vi.spyOn(projectService, 'getProject').mockResolvedValue(project())
    const user = userEvent.setup()

    renderAt('/p/p1')

    expect(await screen.findByTestId('model-viewer')).toHaveTextContent('https://x.test/a.glb')
    await user.click(screen.getByRole('button', { name: 'Option B' }))
    expect(await screen.findByTestId('model-viewer')).toHaveTextContent('https://x.test/b.glb')
  })
})
