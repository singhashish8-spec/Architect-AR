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
    levelIndex: 0,
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
    levelIndex: 0,
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
    levelIndex: 0,
    materials: ['Steel'],
    quantities: { length: 6, width: 0.3, height: 0.5, area: null, volume: 0.9 },
  },
]

async function expandToTable(user: ReturnType<typeof userEvent.setup>, discipline: string, category: string) {
  await user.click(screen.getByText(discipline))
  await user.click(screen.getByText(category))
  await user.click(screen.getByText('Level 1'))
}

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

    await expandToTable(user, 'Architecture', 'Walls')

    expect(screen.getByRole('columnheader', { name: 'Area' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Length' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Height' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Volume' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Width' })).not.toBeInTheDocument()
  })

  it('shows no quantity columns at all for a count-only category (Doors)', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)

    await expandToTable(user, 'Architecture', 'Doors')

    expect(screen.getByText('Door-01')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Height' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Width' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Area' })).not.toBeInTheDocument()
  })

  it('shows all four dimensions for a structural category (Beams: length/width/height/volume)', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)

    await expandToTable(user, 'Structure', 'Beams')

    for (const column of ['Length', 'Width', 'Height', 'Volume']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(screen.queryByRole('columnheader', { name: 'Area' })).not.toBeInTheDocument()
  })

  it('never totals width/height in a category badge, only the summable metrics in its profile', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)

    await user.click(screen.getByText('Structure'))
    await user.click(screen.getByText('Beams'))
    // Beams' profile is length/width/height/volume -- only length (6 m)
    // and volume (0.9 m³) are summable, so those two totals should show
    // as badges alongside the count; width/height never do. Shown at
    // both the category header and its (only) level's own header, since
    // there's just one beam and it's on Level 1.
    expect(screen.getAllByText(/6 m/)).toHaveLength(2)
    expect(screen.getAllByText(/0.9 m³/)).toHaveLength(2)
  })

  it('groups a category\'s elements by level, with its own collapsible header', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)

    await user.click(screen.getByText('Architecture'))
    await user.click(screen.getByText('Walls'))

    // The level header shows before the element table is expanded.
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    expect(screen.queryByText('Wall-01')).not.toBeInTheDocument()

    await user.click(screen.getByText('Level 1'))
    expect(screen.getByText('Wall-01')).toBeInTheDocument()
  })

  it('hides Locate buttons entirely when onIsolate/onJumpTo are not provided (standalone page mode)', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)
    await user.click(screen.getByText('Architecture'))
    await user.click(screen.getByText('Walls'))
    expect(screen.queryByText('Locate')).not.toBeInTheDocument()
  })

  it('isolates and jumps to a whole category via its own "Locate" button when callbacks are provided', async () => {
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
    await user.click(screen.getByTitle('Isolate every Walls and frame the camera around them'))

    expect(onJumpTo).toHaveBeenCalledWith(['wall-1'])
    const hidden = onIsolate.mock.calls[0][0] as Set<string>
    expect(hidden.has('door-1')).toBe(true)
    expect(hidden.has('beam-1')).toBe(true)
    expect(hidden.has('wall-1')).toBe(false)
  })

  it('shows a collapsed debug disclosure with the raw sample data when provided', async () => {
    const user = userEvent.setup()
    render(
      <BoqContent
        details={details}
        progress={null}
        error={null}
        csvFileName="boq.csv"
        debugSample={{
          elementName: 'Wall-01',
          propertySetCount: 3,
          propertyNamesSeen: ['LoadBearing', 'Length', 'Area'],
          quantityNamesSeen: [],
          materialDefCount: 0,
          propertySetsPrimaryError: 'includeTypeProperties not supported',
          propertySetsFallbackError: null,
          materialsPrimaryError: null,
          materialsFallbackError: null,
        }}
      />,
    )

    expect(screen.getByText('Debug info')).toBeInTheDocument()

    // Native <details>/<summary> -- content is collapsed visually in a
    // real browser without any extra state to manage here; jsdom doesn't
    // model that visual collapse, so this just confirms the content is
    // there once expanded, not that it was actually hidden before.
    await user.click(screen.getByText('Debug info'))
    expect(screen.getByText('LoadBearing, Length, Area')).toBeInTheDocument()
    expect(screen.getByText(/includeTypeProperties not supported/)).toBeInTheDocument()
  })

  it('fetches and shows a debug sample for one specific row on demand', async () => {
    const debugBoqElement = vi.fn().mockResolvedValue({
      elementName: 'Wall-01',
      propertySetCount: 0,
      propertyNamesSeen: [],
      quantityNamesSeen: [],
      materialDefCount: 0,
      propertySetsPrimaryError: null,
      propertySetsFallbackError: null,
      materialsPrimaryError: null,
      materialsFallbackError: null,
    })
    const user = userEvent.setup()
    render(
      <BoqContent
        details={details}
        progress={null}
        error={null}
        csvFileName="boq.csv"
        debugBoqElement={debugBoqElement}
      />,
    )

    await expandToTable(user, 'Architecture', 'Walls')
    await user.click(screen.getByLabelText('Debug Wall-01'))

    expect(debugBoqElement).toHaveBeenCalledWith(1, 'Wall-01')
    expect(await screen.findByText('Property sets found')).toBeInTheDocument()

    // Clicking again collapses it rather than re-fetching.
    await user.click(screen.getByLabelText('Debug Wall-01'))
    expect(screen.queryByText('Property sets found')).not.toBeInTheDocument()
    expect(debugBoqElement).toHaveBeenCalledTimes(1)
  })

  it('does not show per-row debug buttons when debugBoqElement is not provided', async () => {
    const user = userEvent.setup()
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" />)
    await expandToTable(user, 'Architecture', 'Walls')
    expect(screen.queryByLabelText('Debug Wall-01')).not.toBeInTheDocument()
  })

  it('omits the debug disclosure entirely when no sample was captured', () => {
    render(<BoqContent details={details} progress={null} error={null} csvFileName="boq.csv" debugSample={null} />)
    expect(screen.queryByText('Debug info')).not.toBeInTheDocument()
  })

  it('isolates and jumps to just one level of a category via that level\'s own "Locate" button', async () => {
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
    await user.click(screen.getByTitle('Isolate every Walls on Level 1 and frame the camera around them'))

    expect(onJumpTo).toHaveBeenCalledWith(['wall-1'])
  })
})
