# Feature: AR walkthrough (motion-sensor)

> Part of [`features/`](README.md). Phase 4. Status: **free walkthrough
> implemented and build-verified** (native ARCore/SceneView Activity,
> Capacitor plugin bridge, wired into `ProjectView`). **Print-anchored AR
> is still not started** — deliberately deferred, see Open questions.
> Real-device AR tracking/placement behavior has not been verified by
> Claude — this sandbox has no camera or display; see
> [`../history/sessions/`](../history/README.md) for the session that
> built this and exactly what was and wasn't verified.

## Summary

Two related capabilities, both requiring the native app (Phase 4), both
built on the same underlying technical foundation (a custom AR camera view
we control, not the OS's black-box "View in AR" handoff):

1. **Free walkthrough**: physically walk through an anchored model using
   the phone's own motion — pacing around a 1:1000 master plan placed on
   the living-room floor like a giant tabletop model, or walking through a
   1:1 room-scale interior as if it were actually built.
2. **Print-anchored AR**: point the phone at a *physical printed drawing
   sheet* with a project QR code on it, and the model appears precisely
   aligned on top of the printed floor plan — walls rising up exactly
   where their 2D lines are printed on the page, at the sheet's own
   printed scale — with a one-tap transition from that print-scale view to
   full 1:1 immersive scale.

Both are meaningfully different from Phase 1's "View in AR" button: that's
a static placed object you walk *around* with the phone held still or
panning — not real 6DOF tracking of your body's movement through the
model, and not anchored to a specific real-world image at all.

## User stories

- As a client or architect standing on an actual site (or in any open
  space), I want to physically walk around a design placed in AR at its
  real scale, so that I get a sense of proportion and layout that a static
  render or a phone-held-still AR view can't give.
- As an architect handing a client a printed floor plan, I want them to
  scan the QR code in the corner and see the 3D model rise directly out of
  the printed drawing, correctly scaled to how the sheet was printed, so
  the connection between "this 2D drawing" and "this 3D space" is
  immediate and visceral — then let them tap one button to step from that
  tabletop-scale view into a full life-size walkthrough.

## Requirements

- **Free walkthrough**: uses the phone's motion sensors (accelerometer,
  gyroscope) fused with the camera for real-world 6DOF position tracking —
  not just camera panning while standing still. Respects the scale preset
  the model was imported with (see
  [`model-scale-presets.md`](model-scale-presets.md)) — walking a real 3
  meters moves you proportionally through the model at whatever ratio that
  preset represents.
- **Print-anchored AR**:
  - The QR code (see [`client-presentation-viewer.md`](client-presentation-viewer.md)'s
    printable QR export, already shipped in Phase 1) both opens the
    project *and* serves as the trigger to start image tracking against
    the printed sheet.
  - The app needs to know the physical printed size of the reference
    image to scale correctly — this is computable automatically from data
    already captured at import (the project's scale preset, e.g. 1:100)
    combined with a known or selected paper size (A0–A4), rather than
    needing a separate manual calibration step per print.
  - A single corner button transitions from the anchored print-scale view
    to full 1:1 scale — a scale-and-camera transition around a shared
    anchor point, not a teleport; this is the "walk through it" capability
    above, triggered from a print-anchored starting point instead of an
    empty-floor one.
- Both live in the **native app** (Phase 4's Capacitor-wrapped shell), not
  the web viewer — see Technical approach for why.

## Technical approach

**Decided: Phase 4, not Phase 1.** True physical walk-through, and true
image-anchored tracking of a specific printed page, both need a
custom-built AR camera view (our own ARCore/ARKit integration), not the
phone's built-in "View in AR" handoff (Scene Viewer / Quick Look) that
Phase 1 uses — that handoff only places an object on a detected flat
surface, it has no concept of recognizing and locking onto a *specific
image* (Augmented Images on ARCore / Image Anchors on ARKit), and no
concept of user-driven 6DOF walking versus a fixed placed viewpoint.
Building that custom AR view is real, dedicated work, which is why both
capabilities are scoped to Phase 4 alongside the native shell rather than
pulled into Phase 1's MVP scope. See
[`../roadmap/phases.md`](../roadmap/phases.md#phase-4--native-shell-for-on-site-ar)
and [`../roadmap/architecture.md`](../roadmap/architecture.md#model-scale-presets).

**Why native, specifically, and not a web-based image-tracking approach**:
WebXR's Image Tracking module exists in spec but has thin, inconsistent
browser support — not something to build a core feature on. ARCore's
Augmented Images and ARKit's Image Anchors are mature and production-ready,
but both are native-only APIs, unreachable from a website. This is the
same reasoning that already put the free walkthrough in Phase 4; the
print-anchored version doesn't change the calculus, it's the same
constraint applying to a second capability.

Until print-anchored AR ships, Phase 1's `<model-viewer>` AR handoff still
covers image-less AR from the shareable link (including one reached by
scanning the Phase-1 QR code) — it's just the OS's own gestures (place,
look around from a fixed position, pinch disabled by `ar-scale="fixed"`),
not image-anchored. `ArHandoffButton.tsx` now picks between that and the
native walkthrough below automatically; see Implementation.

## Implementation (free walkthrough)

**Shell**: `web/` is wrapped by Capacitor (`web/capacitor.config.ts`,
generated project at `web/android/`) rather than rewritten natively — the
whole existing React/R3F app ships unchanged inside a `WebView`, and only
the AR walkthrough itself is real native code. `npx cap sync android`
copies a fresh `web/dist` build into the shell; that has to be re-run
(and the APK rebuilt) after any web-side change for the shell to pick it
up — it is not automatic.

**Native AR** (`web/android/app/src/main/java/.../ar/`):
- `ArWalkthroughActivity.kt` — a separate full-screen `ComponentActivity`
  (Compose), not embedded in the WebView. Sequenced explicitly: camera
  permission → `ArCoreApk.checkAvailability()`/`requestInstall()` → model
  download to cache (dedup'd by URL hash) → `ARScene` (SceneView) owns the
  session from there. Tap-to-place hit-tests against detected planes,
  creates an `AnchorNode`, and parents a `ModelNode` scaled by
  `ArScalePreset.visualScale()` — a Kotlin port of
  `types/ScalePreset.ts`'s `visualScale()`, kept as a small standalone
  object rather than shared cross-language, so it has to be watched if the
  web-side presets ever change (see Open questions).
- `ArWalkthroughState.kt` — every user-facing state the screen can be in
  (`CheckingAvailability`, `CameraPermissionDenied`, `InstallingArCore`,
  `SearchingForSurfaces`, `TrackingLimited(reason)`, `Error`, …), so raw
  ARCore/Android signals (`TrackingFailureReason`, install results,
  permission results, session exceptions) are translated to plain
  language in exactly one place rather than leaking into the UI.
- `ArWalkthroughPlugin.kt` — the thin Capacitor bridge
  (`ArWalkthrough.isSupported()` / `.startWalkthrough({modelUrl,
  scalePreset, projectName})`), registered in `MainActivity.java`.

**Web side** (`web/src/native/arWalkthrough.ts`,
`web/src/viewer/ArHandoffButton.tsx`): `isNativeShell()` gates everything
on `Capacitor.isNativePlatform()`, so the plugin is never even queried in
a regular browser tab. `ArHandoffButton` checks `isSupported()` once and
renders either the native AR button or the existing `ARHandoff`
(`<model-viewer>`) — never both, and never a flash of one before the
other.

**Dependency note**: `io.github.sceneview:arsceneview` is pinned to
`2.2.1`, not the current `4.x` line — `4.x` rewrote `ARScene` around a
fully declarative Compose scene-graph (no `childNodes` list, `AnchorNode`
moved packages, no `rememberNodes()`) that doesn't match this screen's
imperative structure. `2.2.1` is the last release with the
`childNodes`/`onSessionUpdated` API this code targets; confirmed against
its real source on GitHub (tag `v2.2.1`), not assumed from memory.

**What's build-verified vs. not**: the Android project compiles
(`:app:assembleDebug`), a Kotlin JVM unit test suite passes
(`ArScalePresetTest`, mirroring `ScalePreset.test.ts`), and the web-side
bridge has its own Vitest suite (`arWalkthrough.test.ts`) with `@capacitor/core`
mocked. None of that exercises a real ARCore session, a real camera feed,
or real device motion — this sandbox has no camera or display, so plane
detection, tracking quality, and placement accuracy have not been
verified hands-on. See `releases/README.md` at the repo root for the
debug APK built for that hands-on test.

## Open questions

- Exact UX for the print-anchored → 1:1 transition (instant cut vs.
  animated scale-up, whether the camera also repositions or just the
  model scales around a fixed point) — not decided, revisit when
  print-anchored AR starts.
- Whether paper size needs to be an explicit field at import time, or can
  be inferred/left to the architect to select at print time — not decided.
- `ArScalePreset.kt`'s scale math is a manual Kotlin port of
  `ScalePreset.ts`, not shared code — if the web-side presets
  (`SCALE_PRESETS` in `types/ScalePreset.ts`) ever change, this file needs
  a matching edit or the native and web views will silently disagree on
  how big a model renders.
- Print-anchored AR itself is otherwise not detailed further — revisit
  and flesh out requirements when it actually starts, rather than
  over-specifying now.
