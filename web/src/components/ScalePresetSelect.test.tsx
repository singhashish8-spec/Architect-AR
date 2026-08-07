import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScalePresetSelect } from './ScalePresetSelect'
import { SCALE_PRESETS } from '../types/ScalePreset'

describe('ScalePresetSelect', () => {
  it('offers exactly the standard architectural scales, nothing else', () => {
    render(<ScalePresetSelect value="" onChange={() => {}} />)
    const options = screen.getAllByRole('option').map((option) => option.textContent)
    // The first option is the "Select a scale…" placeholder, not a preset.
    expect(options.slice(1)).toEqual([...SCALE_PRESETS])
  })

  it('calls onChange with the selected preset', async () => {
    const onChange = vi.fn()
    render(<ScalePresetSelect value="" onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), '1:100')
    expect(onChange).toHaveBeenCalledWith('1:100')
  })
})
