# Feature: AR walkthrough (motion-sensor)

> Part of [`features/`](README.md). Phase 4. Status: **scoped, not
> started.** Deliberately deferred past Phase 1 — see Technical approach.

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

Until Phase 4 ships, Phase 1's `<model-viewer>` AR handoff still lets a
client place and view the model in AR at its correct fixed scale from the
shareable link (including one reached by scanning the Phase-1 QR code) —
it's just the OS's own gestures (place, look around from a fixed position,
pinch disabled by `ar-scale="fixed"`), not image-anchored or free-walking.

## Open questions

- Exact UX for the print-anchored → 1:1 transition (instant cut vs.
  animated scale-up, whether the camera also repositions or just the
  model scales around a fixed point) — not decided, revisit when Phase 4
  starts.
- Whether paper size needs to be an explicit field at import time, or can
  be inferred/left to the architect to select at print time — not decided.
- Otherwise not detailed further — revisit and flesh out requirements when
  Phase 4 actually starts, rather than over-specifying now.
