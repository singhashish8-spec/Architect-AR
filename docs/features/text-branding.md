# Feature: text-only branding

> Part of [`features/`](README.md). Phase 2. Status: **built, verified
> visually in both light and dark mode against a real production build**
> (`components/BrandMark.tsx`).

## Summary

"Hiten Sethi & Associates" / "HSA" rendered as styled text (navy/indigo
accent), shown on the upload form and the project share card — a
stand-in for a real logo file, which isn't available yet (a blurry chat
screenshot isn't a usable PNG/SVG). Swap `BrandMark.tsx`'s markup for a
real `<img>` the moment a real logo file exists; every caller already
just renders `<BrandMark />`, so nothing else needs to change.

## Scope, per the owner's own decision earlier this project

- **Accent only** — the brand color (`--color-brand`/`--color-brand-hover`
  in `index.css`) is used for the wordmark text and a couple of small
  highlights (the upload form's submit button, the share card's button
  hover border), never as a wholesale recolor of the app.
- **Upload form and share card only, never the 3D viewer itself.** The
  brand-accent override for the submit button lives in a page-scoped
  `UploadProject.module.css`, not in the shared `styles/form.module.css`
  — that file is also used by `PasscodeGate.tsx` (part of the
  client-facing viewer flow) and `LocalPreview.tsx` (a device-only
  preview tool), neither of which should pick up branding.

## A theming detail worth knowing

`ProjectShareCard`'s panel is always dark-styled regardless of the
visitor's system theme (matching `LevelsPanel`/`CategoryPanel`'s own
fixed-dark anchored-panel style). `--color-brand` itself is
theme-dependent (a light indigo for dark mode, a darker indigo for light
mode, so it reads well against each theme's typical background) — left
as the root value, `BrandMark`'s text would come out dark-on-dark for a
visitor whose OS is in light mode, since the *root* theme doesn't know
this one card is always dark. Fixed by overriding `--color-brand`/
`--color-brand-hover` locally within `.card` to their dark-mode values,
so `BrandMark` (a child of `.card`) always inherits the legible pair
regardless of the visitor's system theme.

## Open questions

- Waiting on a real logo file (PNG/SVG) to replace this — see
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
