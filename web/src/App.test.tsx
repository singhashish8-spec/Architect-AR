import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('redirects the root route to the admin dashboard', () => {
    // Project creation moved entirely behind the admin passcode (Phase 3)
    // -- "/" has nothing of its own to render any more, it just sends
    // visitors on to /admin's passcode gate.
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Admin dashboard' })).toBeInTheDocument()
  })
})
