import { Capacitor, registerPlugin } from '@capacitor/core'

// The JS side of the native AR walkthrough bridge (Phase 4, see
// docs/features/ar-walkthrough.md). The native implementation
// (web/android/.../ar/ArWalkthroughPlugin.kt) only exists inside the
// Capacitor-wrapped Android shell -- on the plain web app this plugin
// object still resolves (registerPlugin never throws), but every call
// rejects, which is why every exported function here treats a rejection
// the same as "not available" rather than letting it surface as an error.
export interface ArWalkthroughStartOptions {
  modelUrl: string
  scalePreset?: string
  projectName?: string
}

interface ArWalkthroughPlugin {
  isSupported(): Promise<{ supported: boolean }>
  startWalkthrough(options: ArWalkthroughStartOptions): Promise<void>
}

const ArWalkthrough = registerPlugin<ArWalkthroughPlugin>('ArWalkthrough')

// True only inside the installed Android/iOS shell, never in a regular
// mobile browser tab -- this is what gates showing the native AR button
// at all instead of the existing <model-viewer> Scene Viewer/Quick Look
// handoff (viewer/ARHandoff.tsx), which remains the only AR path on the
// web.
export function isNativeShell(): boolean {
  return Capacitor.isNativePlatform()
}

// Cheap up-front check so the UI can decide whether to show a native AR
// button at all -- resolves false (never throws) both when this isn't
// the native shell and when the device's own hardware genuinely can't
// run ARCore.
export async function isArWalkthroughSupported(): Promise<boolean> {
  if (!isNativeShell()) return false
  try {
    const { supported } = await ArWalkthrough.isSupported()
    return supported
  } catch {
    return false
  }
}

export function startArWalkthrough(options: ArWalkthroughStartOptions): Promise<void> {
  return ArWalkthrough.startWalkthrough(options)
}
