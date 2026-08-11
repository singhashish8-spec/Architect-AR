import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BoqPanel } from './BoqPanel'
import type { ElementCategory } from '../ifc/ifcCategories'
import type { BoqElementDetail } from '../ifc/ifcBoqDetails'

const categories: ElementCategory[] = [
  { expressId: 1, globalId: 'wall-1', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
]

const details: BoqElementDetail[] = [
  {
    expressId: 1,
    globalId: 'wall-1',
    name: 'Wall-01',
    type: 'IfcWallStandardCase',
    discipline: 'Architecture',
    category: 'Walls',
    level: 'Level 1',
    materials: ['Brick'],
    quantities: { length: 4, width: null, height: null, area: 10, volume: 2 },
  },
]

// BoqPanel's open/closed state is controlled by its parent page (see
// types/CornerPanel.ts) rather than kept locally -- same reason
// SchedulePanel's own tests needed this wrapper.
function ControlledBoqPanel(props: Omit<Parameters<typeof BoqPanel>[0], 'open' | 'onOpenChange'>) {
  const [open, setOpen] = useState(false)
  return <BoqPanel {...props} open={open} onOpenChange={setOpen} />
}

// The actual tree/table/search/CSV rendering is covered by
// BoqContent.test.tsx (what this panel renders once loaded) -- these
// tests are about the panel wrapper's own job: the toggle button, lazy
// load-on-open, and the portal.
describe('BoqPanel', () => {
  it('renders nothing when there is no classified data at all', () => {
    const { container } = render(
      <ControlledBoqPanel
        categories={[]}
        getBoqDetails={vi.fn().mockResolvedValue([])}
        onIsolate={vi.fn()}
        onJumpTo={vi.fn()}
        portalContainer={document.body}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('does not fetch BOQ details until the panel is opened', async () => {
    const getBoqDetails = vi.fn().mockResolvedValue(details)
    const user = userEvent.setup()
    render(
      <ControlledBoqPanel
        categories={categories}
        getBoqDetails={getBoqDetails}
        onIsolate={vi.fn()}
        onJumpTo={vi.fn()}
        portalContainer={document.body}
      />,
    )

    expect(getBoqDetails).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^boq$/i }))

    expect(getBoqDetails).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText('Bill of Quantities')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('Architecture')).toBeInTheDocument())
  })

  it('does not render the panel content at all without a portal container', async () => {
    const user = userEvent.setup()
    render(
      <ControlledBoqPanel
        categories={categories}
        getBoqDetails={vi.fn().mockResolvedValue(details)}
        onIsolate={vi.fn()}
        onJumpTo={vi.fn()}
        portalContainer={null}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^boq$/i }))

    expect(screen.queryByText('Bill of Quantities')).not.toBeInTheDocument()
  })
})
