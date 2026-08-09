import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchPanel } from './SearchPanel'
import type { Level } from '../ifc/ifcSpatialTree'
import type { ElementCategory } from '../ifc/ifcCategories'

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
      <SearchPanel levels={[]} categories={[]} onIsolate={vi.fn()} onJumpTo={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('filters results as the user types, and selecting one isolates + jumps to it', async () => {
    const onIsolate = vi.fn()
    const onJumpTo = vi.fn()
    const user = userEvent.setup()
    render(<SearchPanel levels={levels} categories={categories} onIsolate={onIsolate} onJumpTo={onJumpTo} />)

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
