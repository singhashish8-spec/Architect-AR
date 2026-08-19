import { useEffect, useState } from 'react'
import type { ScalePreset } from '../types/ScalePreset'
import { isNativeShell, isArWalkthroughSupported, startArWalkthrough } from '../native/arWalkthrough'
import { ARHandoff } from './ARHandoff'
import styles from './ARHandoff.module.css'

interface ArHandoffButtonProps {
  modelUrl: string
  scalePreset: ScalePreset
  projectName: string
  alt: string
}

// Picks between the two "put this model in AR" paths this app has: the
// native ARCore walkthrough (ar/ArWalkthroughActivity.kt) when running
// inside the installed Android shell on a device that actually supports
// it, falling back to the existing web-based Scene Viewer/Quick Look
// handoff (ARHandoff.tsx) everywhere else -- including inside the shell
// itself, on the device ARCore can't run on. Only one AR button is ever
// shown; which one is decided once, after the async support check
// resolves, not switched later.
export function ArHandoffButton({ modelUrl, scalePreset, projectName, alt }: ArHandoffButtonProps) {
  // null = still checking (nothing shown yet, avoids a flash of the web
  // button that then gets replaced by the native one a moment later).
  const [nativeSupported, setNativeSupported] = useState<boolean | null>(
    isNativeShell() ? null : false,
  )

  useEffect(() => {
    if (!isNativeShell()) return
    let cancelled = false
    void isArWalkthroughSupported().then((supported) => {
      if (!cancelled) setNativeSupported(supported)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (nativeSupported === null) return null

  if (nativeSupported) {
    return (
      <button
        type="button"
        className={styles.button}
        onClick={() => void startArWalkthrough({ modelUrl, scalePreset, projectName })}
      >
        <svg
          className={styles.icon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
          <path d="M3 7l9 5 9-5" />
          <path d="M12 12v10" />
        </svg>
        View in AR
      </button>
    )
  }

  return <ARHandoff modelUrl={modelUrl} scalePreset={scalePreset} alt={alt} />
}
