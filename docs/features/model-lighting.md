# Feature: model lighting (environment/IBL foundation)

> Part of [`features/`](README.md). Phase 2. Status: **built and
> verified against real data in an actual production build**
> (`viewer/ModelViewer.tsx`) — this is the foundation the fuller
> "lighting presets" feature (daylight/evening/studio picker) will build
> on, not that feature itself.

## Summary

The 3D viewer now lights the model with a small ring of soft light panels
around it (an "environment"), instead of only a single ambient +
directional light. PBR materials (glass, metal, anything glossy) need
something to reflect to look like their real substance — with only flat
ambient/directional light they render correctly-colored but visually flat,
which is what the owner reported ("it is all showing plane").

## User story

As someone presenting a model to a client, I want glass, metal, and
glossy furniture finishes to actually look like glass, metal, and glossy
finishes, so the model reads as a realistic space rather than a flat
color mockup.

## Technical approach

`@react-three/drei`'s `<Environment>` component builds an image-based
lighting (IBL) map that PBR materials reflect. Two ways to build one were
tried:

**First attempt (reverted): a built-in HDR preset**
(`<Environment preset="apartment" />`). Drei's presets are not bundled —
they're fetched at runtime from an external CDN
(`raw.githack.com`/`raw.githubusercontent.com`). Verified against a real
production build (`npm run build` + `npm run preview`) before shipping,
per this codebase's standing practice — and that check caught a serious
problem: in a restricted-network test environment, the HDR fetch hung
indefinitely and never resolved. Because `<Environment>` and the model
share one `<Suspense>` boundary, the *entire model* stayed blank the
whole time the fetch was hanging — not just duller lighting, the whole
viewer went empty. Trading "flat materials" for "sometimes the model
never appears at all" is a worse bug than the one it fixes, so this
approach was dropped before shipping.

**Shipped instead: a procedural environment built from `<Lightformer>`
panels.** `<Lightformer>` (also from drei) is plain Three.js geometry —
a few soft rectangular light panels arranged around the model — generated
entirely on-device with nothing fetched over the network. Re-verified the
same way (production build, real Duplex sample): confirmed zero requests
to any external host, and confirmed the model renders immediately with no
dependency on network conditions.

**Visual verification**: compared the same camera framing before and
after, using the real Duplex sample —

- *Before* (ambient + directional light only): walls render as flat,
  uniformly-shaded gray; the roof is a single flat green; the glass
  parapet element shows no reflection or highlight at all.
- *After* (Lightformer environment): walls show a visible shading
  gradient between facades (giving the building actual volume instead of
  looking like a paper cutout), the roof reads with more depth, and the
  glass parapet picks up a soft highlight along its top edge consistent
  with reflecting light rather than just being a flat translucent color.

## Open questions / next steps

- This ships one fixed lighting setup. The fuller feature this sets the
  foundation for — a picker for daylight / evening / studio lighting
  moods — is still open; see the Phase 2 roadmap.
- Not tested against the owner's own real Revit/SketchUp/Rhino export yet
  (same standing deferral as the rest of Phase 2) — real exported
  materials may reveal cases this hasn't been checked against (e.g.
  genuinely transparent glass using alpha/transmission rather than a flat
  translucent color, which benefits from IBL even more than what Duplex
  has).
