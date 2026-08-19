import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const isNativePlatformMock = vi.fn()
const isSupportedMock = vi.fn()
const startWalkthroughMock = vi.fn()

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: (...args: unknown[]) => isNativePlatformMock(...args) as boolean },
  registerPlugin: () => ({
    isSupported: (...args: unknown[]) => isSupportedMock(...args) as Promise<{ supported: boolean }>,
    startWalkthrough: (...args: unknown[]) => startWalkthroughMock(...args) as Promise<void>,
  }),
}))

describe('arWalkthrough native bridge', () => {
  beforeEach(() => {
    isNativePlatformMock.mockReset()
    isSupportedMock.mockReset()
    startWalkthroughMock.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('isNativeShell reflects Capacitor.isNativePlatform()', async () => {
    isNativePlatformMock.mockReturnValue(true)
    const { isNativeShell } = await import('./arWalkthrough')
    expect(isNativeShell()).toBe(true)
  })

  it('isArWalkthroughSupported resolves false without checking the plugin outside the native shell', async () => {
    isNativePlatformMock.mockReturnValue(false)
    const { isArWalkthroughSupported } = await import('./arWalkthrough')
    await expect(isArWalkthroughSupported()).resolves.toBe(false)
    expect(isSupportedMock).not.toHaveBeenCalled()
  })

  it('isArWalkthroughSupported reflects the plugin result inside the native shell', async () => {
    isNativePlatformMock.mockReturnValue(true)
    isSupportedMock.mockResolvedValue({ supported: true })
    const { isArWalkthroughSupported } = await import('./arWalkthrough')
    await expect(isArWalkthroughSupported()).resolves.toBe(true)
  })

  it('isArWalkthroughSupported resolves false (not throws) if the native call rejects', async () => {
    isNativePlatformMock.mockReturnValue(true)
    isSupportedMock.mockRejectedValue(new Error('plugin not implemented'))
    const { isArWalkthroughSupported } = await import('./arWalkthrough')
    await expect(isArWalkthroughSupported()).resolves.toBe(false)
  })

  it('startArWalkthrough forwards options to the native plugin', async () => {
    isNativePlatformMock.mockReturnValue(true)
    startWalkthroughMock.mockResolvedValue(undefined)
    const { startArWalkthrough } = await import('./arWalkthrough')
    const options = { modelUrl: 'https://pub.example/model.glb', scalePreset: '1:100', projectName: 'NSE' }
    await startArWalkthrough(options)
    expect(startWalkthroughMock).toHaveBeenCalledWith(options)
  })
})
