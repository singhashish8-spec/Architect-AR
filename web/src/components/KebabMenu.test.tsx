import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { KebabMenu } from './KebabMenu'

describe('KebabMenu', () => {
  it('opens on click, runs the selected item, and closes', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<KebabMenu ariaLabel="Actions" items={[{ label: 'Duplicate', onSelect }]} />)

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('closes on an outside click without running anything', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <div>
        <KebabMenu ariaLabel="Actions" items={[{ label: 'Delete', danger: true, onSelect }]} />
        <button type="button">Outside</button>
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renders an href item as a real link, not a button', async () => {
    const user = userEvent.setup()
    render(<KebabMenu ariaLabel="Actions" items={[{ label: 'Preview', href: '/p/abc' }]} />)

    await user.click(screen.getByRole('button', { name: 'Actions' }))
    const link = screen.getByRole('menuitem', { name: 'Preview' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/p/abc')
  })
})
