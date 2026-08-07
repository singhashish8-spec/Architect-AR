# Feature: model scale presets

> Part of [`features/`](README.md). Phase 1. Status: **built
> (`web/src/types/ScalePreset.ts`, applied in both viewer surfaces),
> unverified end-to-end** — the `visualScale()` transform assumes exported
> glTF/GLB files are always authored at true 1:1 real-world units, not yet
> confirmed against a real export.

## Summary

Every model gets a scale assigned once, at import time, by the architect
uploading it — chosen from a dropdown of standard architectural drawing
scales, not a free continuous dial for the client. This keeps what a client
sees consistent with real architectural drawing convention: a floor plan
reads at floor-plan scale, a master plan reads at master-plan scale, a room
walkthrough reads at true life size.

## User story

As an architect, I want to set the correct real-world scale for each model
when I upload it, so that my client sees it sized the way a drawing set
would present it — not an arbitrary size a client could accidentally distort.

## Requirements

- At upload, the architect picks one preset from a dropdown — not a free
  numeric input, not a slider (owner's explicit direction: **"everything
  has to be as per architectural standards"**).
- Preset list follows ISO 5455 / RIBA drawing scale convention:

  | Preset | Typical use |
  |---|---|
  | 1:1 | Full-size / life-size walkthrough (a single room or interior fit-out) |
  | 1:5, 1:10, 1:20 | Detail views (joinery, staircases, facade details) |
  | 1:50, 1:100 | Floor plans — the common "whole building, one level" scale |
  | 1:200, 1:500 | Site plans |
  | 1:1000 | Master plan / location plan (a whole site or block) |

- The chosen scale is stored with the model (Supabase `projects` row —
  see [`../engineering/build-sequence.md`](../engineering/build-sequence.md)
  step 12) and applied consistently everywhere the model is viewed.
- In Phase 1, the client cannot override the architect's chosen scale — see
  Technical approach for why.

## Technical approach

Exported glTF/GLB files are assumed to always be authored at true
real-world 1:1 units (1 model-meter = 1 real meter). `types/ScalePreset.ts`'s
`visualScale(preset)` (`1 / ratio`) is the uniform scale factor applied on
top of that raw geometry, identically in both viewer surfaces — an earlier
draft only adjusted camera distance and left the model itself unscaled,
which would have rendered a 1:1000 master plan at literal full building
size; caught during Session 2's build, not left in.

- **`<model-viewer>` AR handoff (Phase 1)**: `viewer/ARHandoff.tsx` sets
  both `scale="{visualScale} {visualScale} {visualScale}"` (the actual
  size) and `ar-scale="fixed"` (no pinch-to-scale override, so the client
  can't contradict the architect's chosen scale). Works today with no
  custom AR code.
- **R3F desktop/browser viewer (Phase 1)**: `viewer/ModelViewer.tsx`
  applies the same `visualScale()` as the `<primitive>`'s `scale` prop,
  with a fixed camera distance — since the model itself is now correctly
  sized, one default framing works across every preset.
- **Custom native AR walk-through (Phase 4, not Phase 1)**: physically
  walking around an anchored model — e.g. pacing around a 1:1000 master
  plan placed on the living-room floor like a giant tabletop model, using
  the phone's motion sensors fused with the camera for real 6DOF tracking —
  needs a custom AR camera view instead of the OS handoff. See
  [`ar-walkthrough.md`](ar-walkthrough.md). Until Phase 4, "View in AR"
  still works via the OS's own AR view and gestures, just not a custom
  walk-through.

## Open questions

- **The 1:1-authoring assumption above is unverified.** If an architect's
  actual glTF export isn't at true real-world scale, every model will
  render at the wrong size regardless of the chosen preset. Test against a
  real Revit export before trusting this — see
  [`../roadmap/decisions.md`](../roadmap/decisions.md).

This feature's *scope* (preset dropdown, standard architectural scales,
walk-through deferred to Phase 4) was confirmed directly with the product
owner in Session 1 — see
[`../history/sessions/2026-08-06-session-01.md`](../history/sessions/2026-08-06-session-01.md).
The implementation detail above is Session 2's, and is what still needs
validating.
