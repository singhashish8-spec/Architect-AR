# Feature: search/filter elements, and the schedule/quantity-takeoff view

> Part of [`features/`](README.md). Phase 2. Status: **built, verified
> against real data in a real production build** — searching "door"
> against the real Duplex sample correctly isolated every door across the
> whole building (all other elements hidden) and framed the camera around
> all of them together; the schedule panel correctly listed and isolated
> "Windows: 24" the same way.

Two closely related features in one doc, since they share the same
underlying data and the same isolate/jump mechanism — search finds by
typing, the schedule shows the full list with counts up front.

## Summary

A search box (matching the Levels/Categories panel style) that finds
levels, rooms, or categories by name as you type, and — on picking a
result — hides everything else in the model and frames the camera around
just the matches. Answers the "show me every door" use case from the
original Phase 2 scope directly: type "door", click the one result, and
every door in the building (not just the current room) is isolated and
framed together.

## User story

As someone presenting a model, I want to find and isolate every instance
of something ("every door", "the kitchen", "level 2") by typing a few
letters, instead of manually toggling categories or hunting through the
model by eye.

## Requirements

- Matches against level names, room names, and category names — not
  buried inside a collapsed panel, one flat search across all three.
- Live filtering as you type; empty query shows nothing (not the whole
  list) to keep the panel calm before you've typed anything meaningful.
- Picking a result hides everything except its elements and reframes the
  camera around them, then shows a small "Showing only: X — Show
  everything" note to undo it.
- Only rendered when there's something to search at all (no IFC data
  loaded → no panel, same pattern as Levels/Categories).

## Technical approach

Deliberately scoped down from a true full-text search across every
element's every property: that data isn't bulk-loaded anywhere today
(`ifcPropertyLookup.ts`'s `getElementData()` only runs per-element, on
tap, since loading every property for every element up front would be
far more expensive against a real building). Instead, `utils/searchResults.ts`'s
`buildResults()` builds its searchable list purely from data the Levels
and Categories panels already have in memory: level names, room names
(from `ifc/ifcSpatialTree.ts`), and category/discipline names (from
`ifc/ifcCategories.ts`, grouped into one result per category rather than
one per element). No extra IFC parsing, and it's the same "every door in
the building" data `CategoryPanel` would show if you unchecked every
*other* category by hand — this just gets there in one search instead.

**Isolating**, not just hiding: computes the full set of every classified
element (`categories` prop, since `ifcCategories.ts` already only
includes real physical elements — see
[`category-and-discipline-visibility.md`](category-and-discipline-visibility.md)),
then hides everything *except* the selected result's elements. Reuses
the exact same `hiddenGlobalIds` prop `ModelViewer.tsx` already had for
category hide/show — no viewer changes needed for this feature at all.

## Feature: schedule/quantity-takeoff view

A left-edge slide-in panel (`SchedulePanel.tsx`, matching
`ElementDataPanel.tsx`'s own slide-in style, opposite edge so the two
don't collide) listing every category's element count, grouped by
discipline, with a grand total — the "list form of the same IFC data,
not just tap-to-inspect" from the original Phase 2 scope. Rows sorted by
count (highest first) within each discipline, since those are generally
what someone doing a takeoff cares about first. Clicking a row isolates
and frames that category, exactly like a search result does — reuses the
same isolate mechanism (`utils/scheduleData.ts`'s `buildSchedule()` is
the schedule-shaped equivalent of `searchResults.ts`'s per-category
grouping).

### A real bug, found by the owner testing on an actual phone

The schedule panel shipped effectively invisible on mobile — the owner
reported "it says hide schedule but I don't see any schedule". Two
separate bugs stacked, only the first of which was obvious from a
screenshot:

1. **Visual overlap.** `SchedulePanel`'s toggle button lives in the same
   top-right button row as Levels/Categories/Lighting/Search, but its
   actual panel is a full-height side panel starting at the very top
   edge (`top: 0`) — on a phone-width screen the button row visually sat
   directly on top of the panel's own title.
2. **The real cause, only found by actually measuring the rendered
   panel's height, not just eyeballing a screenshot**: fixing the overlap
   with a `top` offset revealed the panel's content was still barely
   showing anything below its own title. The `<aside>` was rendered
   *inside* `.topRightCorner`/`.viewerTopRightCorner` (a `position:
   absolute` box sized to its own content — the button row — not to the
   viewer), so its `height: 100%` resolved against that tiny box's own
   height, not the full-size viewer it visually needed to fill. This
   wasn't about the panel being hidden behind something; it was
   genuinely collapsed to almost no height, on every screen size, not
   only mobile — mobile just made the resulting overlap-with-nothing-
   underneath obvious enough to notice.

Fixed by portaling the actual `<aside>` (not its toggle button, which
stays in the corner row for the consistent grouping) directly into the
same full-size container `ElementDataPanel` already renders into
(`ProjectView.tsx`'s `.root` / `LocalPreview.tsx`'s `.viewer`, tracked
via a `useState` ref rather than a plain `useRef` so the portal target
is available by the time anything needs it) — `React.createPortal`, so
the component still owns its own open/closed state and the toggle button
stays visually grouped with the others, but the panel itself renders
with the correct containing block. `ElementDataPanel` itself never had
this specific bug (it was already a direct child of the right container
from the start), but got the same `top` offset fix for the overlap,
since it shares the same corner with the same button row.

**Standing lesson**: for any `position: absolute` panel meant to fill a
large container, verify it's actually *nested inside* that container in
the DOM, not just visually near it — a screenshot showing "the title is
overlapped" can hide a second, more fundamental "the box it's in is
tiny" bug directly underneath the first, more visible one.

## Open questions

- **Search and schedule share one `hiddenGlobalIds` slot with the
  Categories panel** (and with each other). Using one isolate/hide
  action and then another (search → schedule, or either → toggling a
  category checkbox) makes the most-recently-changed one win — each
  works correctly and predictably on its own, but they don't compose.
  Reasonable as a first version; would need real merging logic if these
  ever need to combine (e.g. "hide MEP AND isolate to just this room").
- No fuzzy matching or typo tolerance in search — plain substring match
  only.
- The schedule counts classified elements only (same real-physical-only
  scope as the Categories panel) — an unmapped element type is invisible
  to both the schedule and search, same known limitation documented in
  [`category-and-discipline-visibility.md`](category-and-discipline-visibility.md).
