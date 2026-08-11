import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BoqPanel } from './BoqPanel'
import type { ElementCategory } from '../ifc/ifcCategories'
import type { BoqElementDetail } from '../ifc/ifcBoqDetails'

const categories: ElementCategory[] = [
  { expressId: 1, globalId: 'wall-1', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 2, globalId: 'door-1', type: 'IfcDoor', discipline: 'Architecture', category: 'Doors' },
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
    quantities: { length: 4, area: 10, volume: 2 },
  },
  {
    expressId: 2,
    globalId: 'door-1',
    name: 'Door-01',
    type: 'IfcDoor',
    discipline: 'Architecture',
    category: 'Doors',
    level: 'Level 1',
    materials: ['Oak'],
    quantities: { length: null, area: 2, volume: null },
  },
]

// BoqPanel's open/closed state is controlled by its parent page (see
// types/CornerPanel.ts) rather than kept locally -- same reason
// SchedulePanel's own tests needed this wrapper.
function ControlledBoqPanel(props: Omit<Parameters<typeof BoqPanel>[0], 'open' | 'onOpenChange'>) {
  const [open, setOpen] = useState(false)
  return <BoqPanel {...props} open={open} onOpenChange={setOpen} />
}

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

  it('loads details lazily on open, then shows discipline/category headers with totals', async () => {
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
    await waitFor(() => expect(screen.getByText('Architecture')).toBeInTheDocument())
    expect(screen.getByText(/2 elements/)).toBeInTheDocument()
  })

  it('expands a category to reveal its elements and isolates+jumps on "Locate"', async () => {
    const onIsolate = vi.fn()
    const onJumpTo = vi.fn()
    const user = userEvent.setup()
    render(
      <ControlledBoqPanel
        categories={categories}
        getBoqDetails={vi.fn().mockResolvedValue(details)}
        onIsolate={onIsolate}
        onJumpTo={onJumpTo}
        portalContainer={document.body}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^boq$/i }))
    await waitFor(() => expect(screen.getByText('Architecture')).toBeInTheDocument())

    await user.click(screen.getByText('Architecture'))
    await user.click(screen.getByText('Walls'))

    expect(screen.getByText('Wall-01')).toBeInTheDocument()
    expect(screen.getByText('Brick')).toBeInTheDocument()

    const locateButtons = screen.getAllByTitle(/Isolate every Walls/)
    await user.click(locateButtons[0])

    expect(onJumpTo).toHaveBeenCalledWith(['wall-1'])
    const hidden = onIsolate.mock.calls[0][0] as Set<string>
    expect(hidden.has('door-1')).toBe(true)
    expect(hidden.has('wall-1')).toBe(false)
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
