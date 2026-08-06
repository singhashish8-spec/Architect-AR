# Feature: model scale presets

> Part of [`features/`](README.md). Phase 1. Status: **scoped, not built.**

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

- **`<model-viewer>` AR handoff (Phase 1)**: set `ar-scale="fixed"` so the
  model appears — and stays — at the chosen preset's real-world size in
  Scene Viewer/Quick Look; no pinch-to-scale override that would contradict
  the architect's chosen scale. Works today with no custom AR code.
- **R3F desktop/browser viewer (Phase 1)**: the preset sets the initial
  camera framing/zoom, consistent with the same real-world scale.
- **Custom native AR walk-through (Phase 4, not Phase 1)**: physically
  walking around an anchored model — e.g. pacing around a 1:1000 master
  plan placed on the living-room floor like a giant tabletop model, using
  the phone's motion sensors fused with the camera for real 6DOF tracking —
  needs a custom AR camera view instead of the OS handoff. See
  [`ar-walkthrough.md`](ar-walkthrough.md). Until Phase 4, "View in AR"
  still works via the OS's own AR view and gestures, just not a custom
  walk-through.

## Open questions

None outstanding — this feature's scope was confirmed directly with the
product owner (preset dropdown, standard architectural scales, walk-through
deferred to Phase 4). See
[`../history/sessions/2026-08-06-session-01.md`](../history/sessions/2026-08-06-session-01.md).
