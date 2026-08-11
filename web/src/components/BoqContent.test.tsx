import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BoqContent } from './BoqContent'
import type { BoqElementDetail } from '../ifc/ifcBoqDetails'

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
    quantities: { length: 4, width: null, height: 3, area: 10, volume: 2 },
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
    quantities: { length: null, width: 0.9, height: 2.1, area: 2, volume: null },
  },
  {
    expressId: 3,
    globalId: 'beam-1',
    name: 'Beam-01',
    type: 'IfcBeam',
    discipline: 'Structure',
    category: 'Beams',
    level: 'Level 1',
    materials: ['Steel'],
    quantities: { length: 6, width: 0.3, height: 0.5, area: null, volume: 0.9 },
  },
]

describe('BoqContent', () => {
  it('shows a progress line while loading', () => {
    render(<BoqContent details={null} progress={{ done: 12, total: 40 }} error={null} csvFileName="boq.csv" />)
    expect(screen.getByText(/12 of 40 elements/)).toBeInTheDocument()
  })

  it('shows the error message instead of the tree when loading failed', () => {
    render(<BoqContent details={null} progress={null} error="Could not load quantities." csvFileName="boq.csv" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load quantities.')
  })

  it('shows only the columns relevant to each category (Walls: area/length/height, not volume)', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)

    await user.click(screen.getByText('Architecture'))
    await user.click(screen.getByText('Walls'))

    expect(screen.getByRole('columnheader', { name: 'Area' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Length' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Height' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Volume' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Width' })).not.toBeInTheDocument()
  })

  it('shows no quantity columns at all for a count-only category (Doors)', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)

    await user.click(screen.getByText('Architecture'))
    await user.click(screen.getByText('Doors'))

    expect(screen.getByText('Door-01')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Height' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Width' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Area' })).not.toBeInTheDocument()
  })

  it('shows all four dimensions for a structural category (Beams: length/width/height/volume)', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)

    await user.click(screen.getByText('Structure'))
    await user.click(screen.getByText('Beams'))

    for (const column of ['Length', 'Width', 'Height', 'Volume']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(screen.queryByRole('columnheader', { name: 'Area' })).not.toBeInTheDocument()
  })

  it('never totals width/height in a category badge, only the summable metrics in its profile', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)

    await user.click(screen.getByText('Structure'))
    // Beams' profile is length/width/height/volume -- only length (6 m)
    // and volume (0.9 m³) are summable, so those two totals should show
    // as badges alongside the count; width/height never do.
    expect(screen.getByText(/6 m/)).toBeInTheDocument()
    expect(screen.getByText(/0.9 m³/)).toBeInTheDocument()
  })

  it('hides Locate buttons entirely when onIsolate/onJumpTo are not provided (standalone page mode)', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)
    await user.click(screen.getByText('Architecture'))
    expect(screen.queryByText('Locate')).not.toBeInTheDocument()
  })

  it('isolates and jumps to a whole category via its "Locate" button when callbacks are provided', async () => {
    const onIsolate = vi.fn()
    const onJumpTo = vi.fn()
    const user = userEvent.setup()
    render(
      <BoqContent
        details={details}
        progress={null}
        error={null}
        csvFileName="boq.csv"
        onIsolate={onIsolate}
        onJumpTo={onJumpTo}
      />,
    )

    await user.click(screen.getByText('Architecture'))
    await user.click(screen.getByText('Walls'))
    await user.click(screen.getByTitle(/Isolate every Walls/))

    expect(onJumpTo).toHaveBeenCalledWith(['wall-1'])
    const hidden = onIsolate.mock.calls[0][0] as Set<string>
    expect(hidden.has('door-1')).toBe(true)
    expect(hidden.has('beam-1')).toBe(true)
    expect(hidden.has('wall-1')).toBe(false)
  })
})
