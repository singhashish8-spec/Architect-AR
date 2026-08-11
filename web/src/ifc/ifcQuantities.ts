import type { IfcAPI } from 'web-ifc'
import { unwrap } from './ifcPropertyLookup'

// Values already converted to metres/m2/m3 by the caller (see
// ifcUnits.ts) -- never the model's own raw, possibly-unknown unit.
// Length/Width/Height are three genuinely separate dimensions an element
// can carry at once (a beam's own Length/Width/Height, matching how
// Revit's own schedules break these out) -- NOT three alternate names
// for the same value, unlike Area/Volume, which are each a single
// number picked from whichever Qto quantity of that kind the source
// file happened to use.
export interface ElementQuantities {
  length: number | null
  width: number | null
  height: number | null
  area: number | null
  volume: number | null
}

const LENGTH_NAME_PRIORITY = ['Length', 'NominalLength', 'Perimeter']
// 'b'/'h' -- common shorthand for a structural section's width/depth in
// engineering drawings and some Revit structural families' own type
// parameters -- included cautiously (single-letter names are otherwise
// risky to match blind) since these only ever get treated as a
// candidate when they show up as a genuinely numeric property value
// (see the HasProperties fallback below), never just by name alone.
const WIDTH_NAMES = ['Width', 'NominalWidth', 'b']
// "Unconnected Height" -- Revit's own name for a wall's working height
// when its top isn't constrained to bind to another level -- confirmed
// directly against a real project's wall export (2026-08-11 live
// retest): Revit's IFC exporter carries this through as a regular
// Pset property under that exact name, not "Height".
const HEIGHT_NAMES = ['Height', 'NominalHeight', 'Unconnected Height', 'h']
const AREA_NAME_PRIORITY = [
  'NetSideArea',
  'GrossSideArea',
  'NetArea',
  'GrossArea',
  'NetFootprintArea',
  'GrossFootprintArea',
  'Area',
]
const VOLUME_NAME_PRIORITY = ['NetVolume', 'GrossVolume', 'Volume']

function pickByPriority(candidates: { name: string; value: number }[], priority: string[]): number | null {
  for (const wanted of priority) {
    const match = candidates.find((c) => c.name === wanted)
    if (match) return match.value
  }
  return candidates.length > 0 ? candidates[0].value : null
}

function pickNamed(candidates: { name: string; value: number }[], names: string[]): number | null {
  const match = candidates.find((c) => names.includes(c.name))
  return match ? match.value : null
}

function scaled(value: number | null, lengthScale: number, power: number): number | null {
  return value === null || Number.isNaN(value) ? null : value * lengthScale ** power
}

// A name this app already treats as a meaningful length/area/volume
// candidate -- used to decide whether a *regular* Pset property (not a
// proper Qto quantity) is worth treating as one, see the HasProperties
// fallback below.
const KNOWN_LENGTH_NAMES = [...LENGTH_NAME_PRIORITY, ...WIDTH_NAMES, ...HEIGHT_NAMES]

// Pulls length/width/height/area/volume straight out of the same
// property-set array getElementData() (ifcPropertyLookup.ts) already
// fetches per element. Two sources, in priority order:
//
// 1. **Qto_* quantity sets** -- an IfcElementQuantity's own `Quantities`
//    array holds IfcQuantityLength/Area/Volume objects, told apart here
//    by which value field is actually present (LengthValue/AreaValue/
//    VolumeValue) rather than a type-code lookup, since these come back
//    as plain nested objects with no expressID of their own to look up.
// 2. **Regular Pset properties (`HasProperties`)**, as a fallback for
//    exactly the names this module already looks for. Not every
//    exporter puts dimensional data in a proper Qto set -- some carry a
//    beam/column's own cross-section Width/Height as plain numeric
//    *parameters* instead (e.g. a family's own "Width"/"Height" or
//    "b"/"h" type parameters), which getElementData() already reads for
//    tap-to-inspect but this module never had. Added 2026-08-11 after a
//    real project's structural elements (beams, footings) showed no
//    quantities or materials at all in the BOQ despite the model
//    genuinely having that data -- unverified whether this specific
//    fallback is the fix (no access to that real file in this sandbox
//    to confirm against), but it's a real, addressable gap either way.
//    Only a property whose *name* is already one of
//    Length/Width/Height/Area/Volume's known names is ever treated as a
//    quantity candidate here -- this never guesses that some arbitrary
//    numeric property is secretly a dimension just because it parses as
//    a number.
//
// Width and Height are pulled out of the length-typed candidates by
// name specifically (IFC stores them as IfcQuantityLength too, just
// named "Width"/"Height" instead of "Length") and excluded from the
// pool the generic length lookup picks from below -- otherwise a beam's
// own Width/Height entries could accidentally surface as "the" length
// whenever no quantity literally named "Length" exists. A model can
// also carry more than one quantity of the same kind for one element
// (e.g. a wall's Length vs. its Perimeter, or NetArea vs. GrossArea) --
// picks a well-known Qto name first (the one an architect doing a real
// takeoff would expect) and falls back to whichever was found first if
// none of the preferred names match.
function extractQuantities(propertySets: unknown[], lengthScale: number): ElementQuantities {
  const lengths: { name: string; value: number }[] = []
  const areas: { name: string; value: number }[] = []
  const volumes: { name: string; value: number }[] = []

  for (const raw of propertySets) {
    const pset = raw as { Quantities?: unknown[]; HasProperties?: unknown[] }

    for (const rawQuantity of pset.Quantities ?? []) {
      const q = rawQuantity as Record<string, unknown>
      const name = q.Name !== undefined ? unwrap(q.Name) : ''
      if ('LengthValue' in q) lengths.push({ name, value: Number(unwrap(q.LengthValue)) })
      else if ('AreaValue' in q) areas.push({ name, value: Number(unwrap(q.AreaValue)) })
      else if ('VolumeValue' in q) volumes.push({ name, value: Number(unwrap(q.VolumeValue)) })
    }

    for (const rawProp of pset.HasProperties ?? []) {
      const p = rawProp as { Name?: unknown; NominalValue?: unknown }
      if (p.Name === undefined || p.NominalValue === undefined) continue
      const name = unwrap(p.Name)
      const value = Number(unwrap(p.NominalValue))
      if (Number.isNaN(value)) continue
      if (KNOWN_LENGTH_NAMES.includes(name)) lengths.push({ name, value })
      else if (AREA_NAME_PRIORITY.includes(name)) areas.push({ name, value })
      else if (VOLUME_NAME_PRIORITY.includes(name)) volumes.push({ name, value })
    }
  }

  const width = pickNamed(lengths, WIDTH_NAMES)
  const height = pickNamed(lengths, HEIGHT_NAMES)
  const genericLengths = lengths.filter((l) => !WIDTH_NAMES.includes(l.name) && !HEIGHT_NAMES.includes(l.name))
  const length = pickByPriority(genericLengths, LENGTH_NAME_PRIORITY)
  const area = pickByPriority(areas, AREA_NAME_PRIORITY)
  const volume = pickByPriority(volumes, VOLUME_NAME_PRIORITY)

  return {
    length: scaled(length, lengthScale, 1),
    width: scaled(width, lengthScale, 1),
    height: scaled(height, lengthScale, 1),
    area: scaled(area, lengthScale, 2),
    volume: scaled(volume, lengthScale, 3),
  }
}

// Materials come from a genuinely different IFC relationship
// (IfcRelAssociatesMaterial), not a property set -- web-ifc exposes it
// via its own getMaterialsProperties() helper. The returned objects
// aren't all one shape: a plain IfcMaterial has its own `Name` directly;
// anything layered (IfcMaterialLayerSet/-Usage) or composite
// (IfcMaterialConstituentSet, IfcMaterialList) nests the real material(s)
// one or two levels down instead. Walks the handful of nesting keys real
// exporters actually use rather than every theoretical one in the IFC
// schema, and never throws -- a material shape this doesn't recognize
// just contributes no name, not a broken BOQ row. Unverified against a
// real export's actual material structure (no live IFC sample in this
// sandbox) -- same "spec-first, flag as unverified" situation as
// ifcUnits.ts.
function collectMaterialNames(node: unknown, names: Set<string>): void {
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>

  if (obj.Name !== undefined) {
    const name = unwrap(obj.Name).trim()
    if (name && name.toLowerCase() !== 'null') names.add(name)
  }

  for (const key of ['ForLayerSet', 'Material', 'MaterialLayers', 'MaterialConstituents', 'Materials', 'MaterialProfiles']) {
    const value = obj[key]
    if (Array.isArray(value)) {
      for (const item of value) collectMaterialNames(item, names)
    } else if (value !== undefined) {
      collectMaterialNames(value, names)
    }
  }
}

// One element's worth of BOQ data -- its quantities (see above) and
// every material name associated with it, deduped. Never throws: a
// lookup failure for one element (missing pset, no material relation at
// all, an unrecognized shape) falls back to empty/null fields rather
// than dropping that element from the BOQ or failing the whole bulk
// build in useIfcElementData.ts's getBoqDetails().
// getElementData() (ifcPropertyLookup.ts, tap-to-inspect) has always
// called getPropertySets(modelId, expressId, true) -- 3 args, no
// includeTypeProperties -- and, confirmed directly against a real
// project's own wall (2026-08-11 live retest), that 3-arg call already
// returns instance-level Length/Width/Area/Volume properties just fine.
// The BOQ's own 4-arg version (added to also reach type-level
// quantities) was silently returning nothing for that same element --
// most likely the 4th argument isn't safe against every build of
// web-ifc this app might run against, and the try/catch this function
// already had was swallowing whatever it threw without a trace. Tries
// the fuller 4-arg call first (still worth having when it works, for
// exporters that only ever put quantities on the type); if that throws,
// falls back to the exact 3-arg call already proven to work, rather
// than giving up and returning nothing.
async function getPropertySetsWithFallback(api: IfcAPI, modelId: number, expressId: number): Promise<unknown[]> {
  try {
    return (await api.properties.getPropertySets(modelId, expressId, true, true)) as unknown[]
  } catch {
    try {
      return (await api.properties.getPropertySets(modelId, expressId, true)) as unknown[]
    } catch {
      return []
    }
  }
}

async function getMaterialsPropertiesWithFallback(api: IfcAPI, modelId: number, expressId: number): Promise<unknown[]> {
  try {
    return (await api.properties.getMaterialsProperties(modelId, expressId, true, true)) as unknown[]
  } catch {
    try {
      return (await api.properties.getMaterialsProperties(modelId, expressId, true)) as unknown[]
    } catch {
      return []
    }
  }
}

export async function getElementBoqData(
  api: IfcAPI,
  modelId: number,
  expressId: number,
  lengthScale: number,
): Promise<{ quantities: ElementQuantities; materials: string[] }> {
  let quantities: ElementQuantities = { length: null, width: null, height: null, area: null, volume: null }
  try {
    const propertySets = await getPropertySetsWithFallback(api, modelId, expressId)
    quantities = extractQuantities(propertySets, lengthScale)
  } catch {
    // No property/quantity sets for this element -- leave quantities null.
  }

  let materials: string[] = []
  try {
    const materialDefs = await getMaterialsPropertiesWithFallback(api, modelId, expressId)
    const names = new Set<string>()
    for (const def of materialDefs) collectMaterialNames(def, names)
    materials = Array.from(names)
  } catch {
    // No material association for this element -- not an error, just
    // nothing to show.
  }

  return { quantities, materials }
}
