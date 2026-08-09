import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SchedulePanel } from './SchedulePanel'
import type { ElementCategory } from '../ifc/ifcCategories'

const categories: ElementCategory[] = [
  { expressId: 1, globalId: 'wall-1', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 2, globalId: 'wall-2', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 3, globalId: 'door-1', type: 'IfcDoor', discipline: 'Architecture', category: 'Doors' },
]

describe('SchedulePanel', () => {
  it('renders nothing when there is no classified data at all', () => {
    const { container } = render(
      <SchedulePanel categories={[]} onIsolate={vi.fn()} onJumpTo={vi.fn()} portalContainer={document.body} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows counts per category and isolates + jumps on a row click', async () => {
    const onIsolate = vi.fn()
    const onJumpTo = vi.fn()
    const user = userEvent.setup()
    render(
      <SchedulePanel
        categories={categories}
        onIsolate={onIsolate}
        onJumpTo={onJumpTo}
        portalContainer={document.body}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^schedule$/i }))

    expect(screen.getByText('Walls')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Doors')).toBeInTheDocument()

    await user.click(screen.getByText('Walls'))

    expect(onJumpTo).toHaveBeenCalledWith(['wall-1', 'wall-2'])
    const hidden = onIsolate.mock.calls[0][0] as Set<string>
    expect(hidden.has('door-1')).toBe(true)
    expect(hidden.has('wall-1')).toBe(false)
    expect(hidden.has('wall-2')).toBe(false)
  })

  it('does not render the panel content at all without a portal container', async () => {
    // Locks in the fix: this must never silently fall back to rendering
    // in place, since that's exactly the containing-block bug (the panel
    // collapsing to almost no height) this was built to avoid.
    const user = userEvent.setup()
    render(<SchedulePanel categories={categories} onIsolate={vi.fn()} onJumpTo={vi.fn()} portalContainer={null} />)

    await user.click(screen.getByRole('button', { name: /^schedule$/i }))

    expect(screen.queryByText('Walls')).not.toBeInTheDocument()
    expect(screen.queryByText('Schedule')).not.toBeInTheDocument()
  })
})
