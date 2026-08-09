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
  highlights (the share card's button hover border), never as a
  wholesale recolor of the app.
- **The share card only, never the 3D viewer itself.** Project creation
  moved from a standalone, brand-accented public upload form into
  `components/ProjectCreateForm.tsx`, embedded in the internal-only
  `/admin` dashboard (see [`full-admin-dashboard.md`](full-admin-dashboard.md))
  — its submit button uses the dashboard's own plain styling rather than
  the brand accent now, since nothing inside `/admin` is client-facing
  and the dashboard itself doesn't carry a `BrandMark` anywhere else
  either. `styles/form.module.css` (shared by `PasscodeGate.tsx`,
  `LocalPreview.tsx`, and the admin dashboard) was never brand-accented
  to begin with, for the same reason.

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
