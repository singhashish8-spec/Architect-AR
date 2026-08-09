# Feature: lighting presets (daylight / evening / studio)

> Part of [`features/`](README.md). Phase 2. Status: **built, verified
> against real data in a real production build** — visually confirmed
> all three presets look meaningfully different from each other and that
> switching between them (including back to the default) works cleanly,
> with no console errors.

## Summary

A "Lighting" panel (matching Levels/Categories panel style) lets whoever
is looking at a model pick a mood for this viewing session: **Daylight**
(bright, cool, mostly-overhead — the default), **Evening** (dim, warm,
low-angle), or **Studio** (even, neutral, high-key from every side). This
is the fuller feature [`model-lighting.md`](model-lighting.md)'s
environment-lighting fix set the foundation for.

## User story

As someone presenting a model, I want to switch the lighting mood to
match the moment — bright and clear for a daytime walkthrough, warm and
moody for an evening feel, flat and even for close inspection of
materials — without needing a different export for each.

## Requirements

- Three presets: Daylight (default), Evening, Studio.
- A click/tap swaps the whole scene's lighting immediately — no reload.
- Client-side-only preference, not saved anywhere — always starts back
  at Daylight on a fresh page load. (Persisting a choice per-project
  wasn't asked for; easy to add later if wanted.)
- Available on both the real project viewer (`ProjectView.tsx`) and the
  local device preview (`LocalPreview.tsx`).

## Technical approach

Each preset is a set of `<Lightformer>` panels (see
[`model-lighting.md`](model-lighting.md) for why Lightformers rather than
a CDN-fetched HDR image) plus a matching flat ambient/directional light —
both defined in `types/LightingPreset.ts` as data, so
`viewer/ModelViewer.tsx` doesn't need to know anything about what makes
each mood look the way it does, just render whichever config is
selected. Evening's ambient/directional intensities are deliberately
much lower than Daylight's (not just its Lightformer panels) — otherwise
the flat base lighting kept from before this feature would wash out
Evening's intentionally dim, warm mood regardless of what the environment
map was doing.

`<Environment key={lightingPreset} ...>` is keyed on the preset so React
fully remounts it on a switch, rather than trying to reconcile a changed
`children` list against drei's internal render-target setup — the safer
option given `Environment` builds an IBL render target once from its
children.

## Open questions

- Not persisted per-project. If a client presentation benefits from a
  fixed lighting choice every time that link is opened, that would need
  a DB column and a bit more plumbing — not built, since it wasn't asked
  for.
