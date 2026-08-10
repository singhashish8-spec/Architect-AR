import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchPanel } from './SearchPanel'
import type { Level } from '../ifc/ifcSpatialTree'
import type { ElementCategory } from '../ifc/ifcCategories'

// SearchPanel's open/closed state is controlled by its parent page (so
// only one corner panel can be open at a time -- see types/CornerPanel.ts)
// rather than kept locally, so tests need their own small stateful
// wrapper to exercise open/close interactions.
function ControlledSearchPanel(props: Omit<Parameters<typeof SearchPanel>[0], 'open' | 'onOpenChange'>) {
  const [open, setOpen] = useState(false)
  return <SearchPanel {...props} open={open} onOpenChange={setOpen} />
}

const levels: Level[] = [
  {
    expressId: 1,
    name: 'Level 1',
    elementGlobalIds: ['wall-1', 'door-1', 'room-a-globalid'],
    rooms: [{ expressId: 2, name: 'Kitchen', elementGlobalIds: ['door-1'] }],
  },
]

const categories: ElementCategory[] = [
  { expressId: 10, globalId: 'wall-1', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 11, globalId: 'wall-2', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 12, globalId: 'door-1', type: 'IfcDoor', discipline: 'Architecture', category: 'Doors' },
]

describe('SearchPanel', () => {
  it('renders nothing when there is no searchable data at all', () => {
    const { container } = render(
      <ControlledSearchPanel levels={[]} categories={[]} onIsolate={vi.fn()} onJumpTo={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('filters results as the user types, and selecting one isolates + jumps to it', async () => {
    const onIsolate = vi.fn()
    const onJumpTo = vi.fn()
    const user = userEvent.setup()
    render(<ControlledSearchPanel levels={levels} categories={categories} onIsolate={onIsolate} onJumpTo={onJumpTo} />)

    await user.click(screen.getByRole('button', { name: /search elements/i }))
    await user.type(screen.getByPlaceholderText(/door/i), 'door')

    expect(screen.getByText('Doors')).toBeInTheDocument()
    expect(screen.queryByText('Walls')).not.toBeInTheDocument()

    await user.click(screen.getByText('Doors'))

    expect(onJumpTo).toHaveBeenCalledWith(['door-1'])
    // Isolating "Doors" hides every other classified element (the walls),
    // keeping only the door(s) visible.
    const hidden = onIsolate.mock.calls[0][0] as Set<string>
    expect(hidden.has('wall-1')).toBe(true)
    expect(hidden.has('wall-2')).toBe(true)
    expect(hidden.has('door-1')).toBe(false)
  })
})
