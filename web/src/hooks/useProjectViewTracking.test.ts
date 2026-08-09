import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectViewTracking } from './useProjectViewTracking'
import * as analyticsService from '../services/analyticsService'

describe('useProjectViewTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does nothing when there is no project id yet', () => {
    const recordSpy = vi.spyOn(analyticsService, 'recordProjectView')
    renderHook(() => useProjectViewTracking(null))
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('records one view when a project id is given, then sends periodic duration updates', async () => {
    const recordSpy = vi.spyOn(analyticsService, 'recordProjectView').mockResolvedValue('view-1')
    const updateSpy = vi.spyOn(analyticsService, 'updateProjectViewDuration').mockResolvedValue(undefined)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')

    renderHook(() => useProjectViewTracking('project-1'))
    expect(recordSpy).toHaveBeenCalledWith('project-1')

    // Let the recordProjectView() promise resolve before the first
    // heartbeat interval fires.
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(20_000)
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(updateSpy).toHaveBeenCalledWith('view-1', expect.any(Number))

    await vi.advanceTimersByTimeAsync(20_000)
    expect(updateSpy).toHaveBeenCalledTimes(2)
  })

  it('skips the heartbeat while the tab is not visible', async () => {
    vi.spyOn(analyticsService, 'recordProjectView').mockResolvedValue('view-1')
    const updateSpy = vi.spyOn(analyticsService, 'updateProjectViewDuration').mockResolvedValue(undefined)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    renderHook(() => useProjectViewTracking('project-1'))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(20_000)

    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('stops the heartbeat on unmount', async () => {
    vi.spyOn(analyticsService, 'recordProjectView').mockResolvedValue('view-1')
    const updateSpy = vi.spyOn(analyticsService, 'updateProjectViewDuration').mockResolvedValue(undefined)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')

    const { unmount } = renderHook(() => useProjectViewTracking('project-1'))
    await vi.advanceTimersByTimeAsync(0)
    unmount()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
