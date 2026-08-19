import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PasscodeGate } from './PasscodeGate'

function typeAndSubmit(passcode: string) {
  fireEvent.change(screen.getByLabelText('Passcode'), { target: { value: passcode } })
  fireEvent.click(screen.getByRole('button'))
}

describe('PasscodeGate', () => {
  it('shows "incorrect passcode" when onSubmit resolves false', async () => {
    render(<PasscodeGate onSubmit={() => Promise.resolve(false)} />)
    typeAndSubmit('wrong')
    expect(await screen.findByText('Incorrect passcode. Try again.')).toBeInTheDocument()
  })

  it('shows a connection-error message, not silence, when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Failed to fetch'))
    render(<PasscodeGate onSubmit={onSubmit} />)
    typeAndSubmit('1234')
    expect(
      await screen.findByText("Couldn't reach the server to check the passcode. Check your connection and try again."),
    ).toBeInTheDocument()
    expect(screen.queryByText('Incorrect passcode. Try again.')).not.toBeInTheDocument()
  })

  it('clears a previous error on the next submit attempt', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(false)
    render(<PasscodeGate onSubmit={onSubmit} />)
    typeAndSubmit('1234')
    await screen.findByText("Couldn't reach the server to check the passcode. Check your connection and try again.")

    typeAndSubmit('1234')
    await waitFor(() => {
      expect(
        screen.queryByText("Couldn't reach the server to check the passcode. Check your connection and try again."),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Incorrect passcode. Try again.')).toBeInTheDocument()
  })
})
