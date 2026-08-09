# Feature: search/filter elements

> Part of [`features/`](README.md). Phase 2. Status: **built, verified
> against real data in a real production build** — searching "door"
> against the real Duplex sample correctly isolated every door across the
> whole building (all other elements hidden) and framed the camera around
> all of them together.

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

## Open questions

- **Shares one `hiddenGlobalIds` slot with the Categories panel.**
  Using search-isolate and then toggling a category checkbox afterward
  makes the category panel's own hide/show state win (it recomputes the
  whole hidden set from its own checkboxes on every change), silently
  discarding the search isolation. Each feature works correctly and
  predictably on its own; using both together in the same session, the
  most-recently-changed one wins — a reasonable, unsurprising default,
  but a real limitation if the two ever need to genuinely compose (e.g.
  "hide MEP AND isolate to just this room").
- No fuzzy matching or typo tolerance — plain substring match only.
