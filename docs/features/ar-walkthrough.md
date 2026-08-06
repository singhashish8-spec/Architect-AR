# Feature: AR walkthrough (motion-sensor)

> Part of [`features/`](README.md). Phase 4. Status: **scoped, not
> started.** Deliberately deferred past Phase 1 — see Technical approach.

## Summary

Physically walk through an anchored model using the phone's own motion —
pacing around a 1:1000 master plan placed on the living-room floor like a
giant tabletop model, or walking through a 1:1 room-scale interior as if it
were actually built. This is meaningfully different from Phase 1's "View in
AR" button: it's not a static placed object you walk *around* with the
phone's camera panning, it's real 6DOF tracking of your body's movement
translated into movement through the model.

## User story

As a client or architect standing on an actual site (or in any open space),
I want to physically walk around a design placed in AR at its real scale,
so that I get a sense of proportion and layout that a static render or a
phone-held-still AR view can't give.

## Requirements

- Uses the phone's motion sensors (accelerometer, gyroscope) fused with the
  camera for real-world 6DOF position tracking — not just camera panning
  while standing still.
- Respects the scale preset the model was imported with — see
  [`model-scale-presets.md`](model-scale-presets.md). Walking a real 3
  meters moves you 3 meters through a 1:1 model, or 3×1000=3000mm... i.e.
  proportionally further through a 1:1000 model, matching what that scale
  would mean on an actual drawing.
- Lives in the **native app** (Phase 4's Capacitor-wrapped shell), not the
  web viewer — see Technical approach for why.

## Technical approach

**Decided: Phase 4, not Phase 1.** True physical walk-through needs a
custom-built AR camera view (our own ARCore/ARKit integration), not the
phone's built-in "View in AR" handoff (Scene Viewer / Quick Look) that
Phase 1 uses — that handoff is a black box that doesn't expose the level of
control (arbitrary chosen scale + free walking, not just placing and
looking) this feature needs. Building that custom AR view is real,
dedicated work, which is why it's scoped to Phase 4 alongside the native
shell rather than pulled into Phase 1's MVP scope. See
[`../roadmap/phases.md`](../roadmap/phases.md#phase-4--native-shell-for-on-site-ar)
and [`../roadmap/architecture.md`](../roadmap/architecture.md#model-scale-presets).

Until Phase 4 ships, Phase 1's `<model-viewer>` AR handoff still lets a
client place and view the model in AR at its correct fixed scale — it's
just the OS's own gestures (place, look around from a fixed position, pinch
disabled by `ar-scale="fixed"`), not free physical walking.

## Open questions

- None yet — this feature hasn't been detailed beyond the Phase 4 scope
  note above. Revisit and flesh out requirements when Phase 4 actually
  starts, rather than over-specifying now.
