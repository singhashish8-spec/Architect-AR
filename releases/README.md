# Debug builds

`architect-ar-debug.apk` is a debug-signed (Android debug keystore, not a
Play Store release key) build of the Capacitor Android shell with the
native AR walkthrough (Phase 4, see `docs/features/ar-walkthrough.md`).

Install directly on an Android device (minSdk 24 / Android 7.0+) with
"install from unknown sources" enabled, or via `adb install`. It requires
a device with ARCore support for the native AR walkthrough button to
appear -- everywhere else, the app falls back to the existing web-based
Scene Viewer/Quick Look AR handoff.

This directory exists purely for handing over a testable build; it isn't
part of the app's own build or deploy process.
