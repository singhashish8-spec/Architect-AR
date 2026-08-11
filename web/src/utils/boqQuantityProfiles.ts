// What actually matters to show for each category, and in what order --
// a real BOQ/schedule doesn't show every possible column for every kind
// of element (a door's "volume" is never what anyone's asking for; a
// wall's "count" alone tells you nothing useful without its area). This
// is the difference between a spreadsheet dump of every Qto value this
// app happened to find and an actual, readable takeoff organized the
// way an architect already expects it (owner's own ask, 2026-08-11: "in
// a simple way all the elements to show data in same way").
//
// 'count' is always shown as a badge on every category regardless of
// whether it's listed here (see components/BoqContent.tsx) -- this list
// controls which *quantity* columns/totals appear in addition to that,
// not whether the count itself shows.
export type QuantityMetric = 'length' | 'width' | 'height' | 'area' | 'volume'

// Only length/area/volume are ever summed into a category total --
// width/height are always per-element only (see ifc/ifcQuantities.ts's
// own comment on why summing "the total height of 20 doors" isn't a
// real quantity anyone wants, matching how Revit's own schedules never
// total those two either).
export const SUMMABLE_METRICS: QuantityMetric[] = ['length', 'area', 'volume']

// Keyed by the same category strings ifc/ifcCategories.ts already
// produces (including the MEP system-label overrides -- Plumbing/Fire
// protection/HVAC/Electrical/Controls/Gas -- which replace the generic
// per-type label whenever a real system assignment was found). An empty
// array means "count only" -- no quantity columns at all, just the
// count badge (doors/windows, per the owner's explicit ask: shown as
// instance counts, not dimensions).
const CATEGORY_METRICS: Record<string, QuantityMetric[]> = {
  // Architecture -- planar elements get area; door/window openings are
  // counted, not measured.
  Walls: ['area', 'length', 'height'],
  'Curtain walls': ['area', 'length', 'height'],
  Doors: [],
  Windows: [],
  'Floors & slabs': ['area', 'volume'],
  Roofs: ['area'],
  Stairs: ['height'],
  Ramps: ['length'],
  Railings: ['length', 'height'],
  'Coverings & finishes': ['area'],
  'Plates & mullions': ['length'],
  Furniture: [],
  Rooms: ['area'],
  'Other (generic)': [],

  // Structure -- linear/volumetric members get their full dimension set.
  Columns: ['length', 'width', 'height', 'volume'],
  Beams: ['length', 'width', 'height', 'volume'],
  Footings: ['volume'],
  Piles: ['length', 'volume'],

  // MEP -- runs (pipes/ducts/cabling/trays) get length; discrete
  // fittings, terminals, and equipment are counted, not measured.
  Pipes: ['length'],
  'Pipe fittings': [],
  Ducts: ['length'],
  'Duct fittings': [],
  Cabling: ['length'],
  'Cable trays & conduit': ['length'],
  'Flow segments': ['length'],
  'Flow fittings': [],
  'Terminals & outlets': [],
  Controls: [],
  'Pumps & fans': [],
  'Tanks & storage': ['volume'],
  'Treatment devices': [],
  Chambers: [],
  'Sanitary fixtures': [],
  'Heating equipment': [],
  Valves: [],
  'Cooling equipment': [],
  'Electrical equipment': [],
  'Fire protection': [],
  'HVAC equipment': [],
  Lighting: [],
  // The system-label overrides getElementCategories() substitutes in
  // for MEP elements when a real IfcSystem assignment is found (see
  // ifc/ifcCategories.ts) -- distinct strings from the per-type labels
  // above, so they need their own entries.
  Plumbing: ['length'],
  HVAC: ['length'],
  Electrical: [],
  Gas: ['length'],
}

// A category this app doesn't have an explicit opinion on yet -- rather
// than showing nothing (which would silently hide real quantity data
// the file actually has), show every summable metric and let genuinely
// missing values fall back to "—" on their own.
const DEFAULT_METRICS: QuantityMetric[] = ['length', 'area', 'volume']

export function getCategoryMetrics(category: string): QuantityMetric[] {
  return CATEGORY_METRICS[category] ?? DEFAULT_METRICS
}

// Shared display metadata for the five metrics -- one source of truth
// for both the on-screen table (components/BoqContent.tsx) and the
// Excel export (utils/boqExcel.ts), so the two never drift apart on
// column order, label wording, or unit suffix.
export const METRIC_ORDER: QuantityMetric[] = ['length', 'width', 'height', 'area', 'volume']
export const METRIC_LABEL: Record<QuantityMetric, string> = {
  length: 'Length',
  width: 'Width',
  height: 'Height',
  area: 'Area',
  volume: 'Volume',
}
export const METRIC_UNIT: Record<QuantityMetric, string> = {
  length: 'm',
  width: 'm',
  height: 'm',
  area: 'm²',
  volume: 'm³',
}
