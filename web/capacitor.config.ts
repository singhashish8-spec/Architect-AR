import type { CapacitorConfig } from '@capacitor/cli'

// Wraps this same web app (React/Vite/three.js, unchanged) as an
// installable Android app -- Phase 4's "native shell", see
// docs/roadmap/phases.md#phase-4--native-shell-for-on-site-ar. Every
// screen except the new native AR walkthrough is just this web app
// running inside a WebView; only the AR capability itself needs real
// native code (see android/app/src/main/java/.../arplugin), since
// that's the one thing a WebView genuinely cannot do (ARCore requires
// direct camera + motion-sensor access no browser API exposes at the
// fidelity a real walkthrough needs).
const config: CapacitorConfig = {
  appId: 'com.singhashish.architectar',
  appName: 'Architect AR',
  webDir: 'dist',
  // Same applicationId the original (now-superseded) Android Studio
  // placeholder module used -- see docs/history/findings.md for why
  // that module was replaced rather than hand-patched.
  android: {
    path: 'android',
  },
}

export default config
