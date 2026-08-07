# Feature: client presentation viewer

> Part of [`features/`](README.md). Phase 1. Status: **built
> (`web/src/pages/`, `web/src/viewer/`), unverified end-to-end** — no live
> Supabase project or real-device test yet, see
> [`../history/sessions/2026-08-06-session-02.md`](../history/sessions/2026-08-06-session-02.md).

## Summary

The core deliverable of Phase 1: an architect uploads an exported model and
gets a link; a client opens that link on their own phone or PC — no install
— and can look around a photoreal 3D representation of the design, with a
one-tap path into real AR on supported phones.

## User story

As an architect, I want to send my client a single link that shows our
design in 3D (and in AR on their phone), so that they understand the space
without needing CAD software or a site visit.

## Requirements

- A client opens the link on any modern phone or desktop browser — no app
  install, no account required (Phase 1: unlisted link, no login — see
  [`../roadmap/architecture.md`](../roadmap/architecture.md#sharing-model)).
- The model loads and renders within a reasonable time on a typical mobile
  connection (glTF/GLB, not the much larger IFC, is what's rendered here —
  see [`element-data-inspection.md`](element-data-inspection.md) for why
  IFC is a separate, optional load).
- Orbit / zoom / pan controls work with touch and mouse.
- A visible "View in AR" affordance appears only on devices that actually
  support it (Scene Viewer on Android, Quick Look on iOS); it's simply
  absent, not a broken button, on desktop or unsupported phones.
- The model appears at the scale chosen at import — see
  [`model-scale-presets.md`](model-scale-presets.md).
- One model per link in Phase 1 — no project/multi-model switcher yet
  (Phase 2, per [`../roadmap/phases.md`](../roadmap/phases.md#phase-2--presentation-polish)).
- **Printable QR code** (`components/ProjectQRCode.tsx`): from the project
  page, generate and download an SVG QR code of that project's shareable
  link, for printing on a physical drawing sheet — scanning it opens the
  same link a client would otherwise be sent. This is also the foundation
  for Phase 4's print-anchored AR (see
  [`ar-walkthrough.md`](ar-walkthrough.md)): the same QR code both opens
  the project *and*, once the native app exists, becomes the trigger to
  start image-tracking against the printed sheet itself.

## Technical approach

See [`../roadmap/architecture.md`](../roadmap/architecture.md#frontend-and-viewer-architecture)
for the two-surface viewer design (React Three Fiber for the in-page
viewer, `<model-viewer>` for the AR handoff) and
[`../roadmap/architecture.md#model-export-pipeline`](../roadmap/architecture.md#model-export-pipeline)
for the glTF/GLB + USDZ export requirements. QR generation is
`qrcode.react`'s `QRCodeSVG`, encoding `window.location.href` (the
project page's own URL) — see
[`../engineering/tech-stack.md`](../engineering/tech-stack.md).

## Open questions

- Unlisted link vs passcode: tracked in
  [`../roadmap/decisions.md`](../roadmap/decisions.md) — recommendation is
  unlisted for Phase 1, passcode-per-project in Phase 2.
