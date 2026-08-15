# Feature: text-only branding

> Part of [`features/`](README.md). Phase 2. Status: **built, verified
> visually in both light and dark mode against a real production build**
> (`components/BrandMark.tsx`); extended 2026-08-15 to every page's
> permanent header, including the 3D viewer — see below.

## Summary

"Hiten Sethi & Associates" / "HSA" rendered as styled text (navy/indigo
accent), shown on the project share card and, as of 2026-08-15, every
page's permanent header (`components/BrandingHeader.tsx`) — a stand-in
for a real logo file, which isn't available yet (a blurry chat
screenshot isn't a usable PNG/SVG). Swap `BrandMark.tsx`'s markup for a
real `<img>` the moment a real logo file exists; every caller already
just renders `<BrandMark />` (optionally `<BrandMark compact />` inside
a thin bar/pill, to drop the margin meant for a card-top context), so
nothing else needs to change.

## Scope, per the owner's own decisions

- **Accent only** — the brand color (`--color-brand`/`--color-brand-hover`
  in `index.css`) is used for the wordmark text and a couple of small
  highlights (the share card's button hover border), never as a
  wholesale recolor of the app.
- ~~The share card only, never the 3D viewer itself.~~ **Reversed
  2026-08-15**: the owner asked directly for a permanent header on
  *every* page, then — after first seeing that header render the
  account-wide `company_name` as plain text (falling back to "Architect
  AR" when unset) — specifically asked for it to look like `BrandMark`
  instead: "I want header to look like the one in share card... Not
  that Architect Ar." `components/BrandingHeader.tsx` now renders
  `BrandMark` on every page, including `pages/ProjectView.tsx`'s 3D
  viewer (a small corner-pill overlay there, since it has no header slot
  to push content down from). Project creation's own submit button
  (`components/ProjectCreateForm.tsx`, inside the internal-only
  `/admin` dashboard) still uses the dashboard's own plain styling, not
  the brand accent — nothing inside `/admin` is client-facing, and nor
  does the dashboard carry a `BrandMark` anywhere else.

## A theming detail worth knowing

`--color-brand` is theme-dependent (a light indigo for dark mode, a
darker indigo for light mode, so it reads well against each theme's
typical background) — anywhere `BrandMark` sits on a surface that's
always dark regardless of the *visitor's* system theme, the root
media-query-driven value has to be overridden locally, or a light-mode
visitor would see dark-on-dark, illegible text. Three places currently
do this, all the same pattern (pin `--color-brand`/`--color-brand-hover`
to their dark-mode values on the always-dark container, so every
`BrandMark` inside it inherits the legible pair):

- `ProjectShareCard.module.css`'s `.card` (matches
  `LevelsPanel`/`CategoryPanel`'s own fixed-dark anchored-panel style).
- `BrandingHeader.module.css`'s `.overlay` (the 3D viewer's corner pill).
- `pages/BoqView.module.css`'s `.brand` (that page's own shell is always
  dark — see its own comment).

## Open questions

- Waiting on a real logo file (PNG/SVG) to replace this — see
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
