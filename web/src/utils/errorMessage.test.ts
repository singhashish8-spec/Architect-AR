import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errorMessage'

describe('getErrorMessage', () => {
  it('reads .message off a real Error instance', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('reads .message off a plain object shaped like an error (e.g. a mistyped Supabase result)', () => {
    expect(getErrorMessage({ message: 'relation "project_models" does not exist' }, 'fallback')).toBe(
      'relation "project_models" does not exist',
    )
  })

  it('falls back for a value with no usable message', () => {
    expect(getErrorMessage('a raw string', 'fallback')).toBe('fallback')
    expect(getErrorMessage(null, 'fallback')).toBe('fallback')
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(getErrorMessage({ code: 'PGRST301' }, 'fallback')).toBe('fallback')
  })
})
