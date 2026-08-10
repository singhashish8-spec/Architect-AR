// The five small anchored panels along the viewer's top-right corner
// (ProjectView.tsx, LocalPreview.tsx) -- shared so the page can own a
// single "which one is open" state instead of each panel keeping its own,
// which is what let more than one be open at once. See each panel
// component's own comment on its `open`/`onOpenChange` props.
export type CornerPanelKey = 'levels' | 'categories' | 'lighting' | 'search' | 'schedule'
