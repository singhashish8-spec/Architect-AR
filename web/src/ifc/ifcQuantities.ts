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
// quantities) was silently returning nothing for that same element.
// Originally assumed this meant the 4th argument was throwing and the
// try/catch was swallowing it -- confirmed WRONG by a live per-row debug
// sample (2026-08-11) against a real wall known (via tap-to-inspect) to
// carry real property data: the debug output showed zero property sets
// found and, critically, NO primary/fallback error at all. Both the
// 4-arg call and (since the old code only ever tried it inside a catch
// block) the 3-arg call never even ran. The 4-arg call was simply
// resolving successfully with an empty array for that build of web-ifc --
// not every environment's web-ifc build honors includeTypeProperties/
// includeTypeMaterials, and an unsupported flag apparently degrades to
// "no results" rather than a thrown error or an ignored flag. Falls back
// to the proven-working 3-arg call whenever the 4-arg call comes back
// empty, not only when it throws.
interface FallbackResult {
  data: unknown[]
  // Both null when the primary (4-arg) call returned data and never
  // threw -- otherwise the raw error message(s), kept for
  // BoqDebugSample below. Deliberately plain strings, not Error
  // objects: this ends up serialized into on-screen debug output (see
  // ifc/ifcBoqDetails.ts/components/BoqContent.tsx), not just logged.
  // Note an empty `data` with both errors null is a real, valid outcome
  // now: it means both the 4-arg and 3-arg calls succeeded without
  // throwing but genuinely found nothing for this element.
  primaryError: string | null
  fallbackError: string | null
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function getPropertySetsWithFallback(api: IfcAPI, modelId: number, expressId: number): Promise<FallbackResult> {
  let primaryData: unknown[] = []
  let primaryError: string | null = null
  try {
    primaryData = (await api.properties.getPropertySets(modelId, expressId, true, true)) as unknown[]
  } catch (err) {
    primaryError = errorMessage(err)
  }
  if (primaryData.length > 0) return { data: primaryData, primaryError: null, fallbackError: null }

  try {
    const fallbackData = (await api.properties.getPropertySets(modelId, expressId, true)) as unknown[]
    return { data: fallbackData, primaryError, fallbackError: null }
  } catch (fallbackErr) {
    return { data: [], primaryError, fallbackError: errorMessage(fallbackErr) }
  }
}

async function getMaterialsPropertiesWithFallback(api: IfcAPI, modelId: number, expressId: number): Promise<FallbackResult> {
  let primaryData: unknown[] = []
  let primaryError: string | null = null
  try {
    primaryData = (await api.properties.getMaterialsProperties(modelId, expressId, true, true)) as unknown[]
  } catch (err) {
    primaryError = errorMessage(err)
  }
  if (primaryData.length > 0) return { data: primaryData, primaryError: null, fallbackError: null }

  try {
    const fallbackData = (await api.properties.getMaterialsProperties(modelId, expressId, true)) as unknown[]
    return { data: fallbackData, primaryError, fallbackError: null }
  } catch (fallbackErr) {
    return { data: [], primaryError, fallbackError: errorMessage(fallbackErr) }
  }
}

// A snapshot of exactly what one element's own raw IFC data looked like
// -- captured for the very first element only (see
// ifc/ifcBoqDetails.ts's buildBoqDetails()) and surfaced directly in the
// BOQ page's own UI (a small collapsed "Debug info" note) rather than
// only ever going to a browser console. Added 2026-08-11 after a real
// project showed every quantity/material blank even after the 4-arg/
// 3-arg fallback fix above, with no way to see *why* short of asking
// the owner to relay DevTools output from their phone by hand -- this
// makes the app self-diagnosing for exactly that situation instead.
export interface BoqDebugSample {
  elementName: string
  propertySetCount: number
  propertyNamesSeen: string[]
  quantityNamesSeen: string[]
  materialDefCount: number
  propertySetsPrimaryError: string | null
  propertySetsFallbackError: string | null
  materialsPrimaryError: string | null
  materialsFallbackError: string | null
}

export async function getElementBoqData(
  api: IfcAPI,
  modelId: number,
  expressId: number,
  lengthScale: number,
  elementName?: string,
): Promise<{ quantities: ElementQuantities; materials: string[]; debugSample?: BoqDebugSample }> {
  let quantities: ElementQuantities = { length: null, width: null, height: null, area: null, volume: null }
  const propertySetsResult = await getPropertySetsWithFallback(api, modelId, expressId)
  try {
    quantities = extractQuantities(propertySetsResult.data, lengthScale)
  } catch {
    // A genuinely malformed pset shape -- leave quantities null rather
    // than fail this element (or the whole bulk build) over it.
  }

  let materials: string[] = []
  const materialsResult = await getMaterialsPropertiesWithFallback(api, modelId, expressId)
  try {
    const names = new Set<string>()
    for (const def of materialsResult.data) collectMaterialNames(def, names)
    materials = Array.from(names)
  } catch {
    // A genuinely malformed material shape -- leave materials empty.
  }

  let debugSample: BoqDebugSample | undefined
  if (elementName !== undefined) {
    const propertyNamesSeen: string[] = []
    const quantityNamesSeen: string[] = []
    for (const raw of propertySetsResult.data) {
      const pset = raw as { Quantities?: unknown[]; HasProperties?: unknown[] }
      for (const rawProp of pset.HasProperties ?? []) {
        const p = rawProp as { Name?: unknown }
        if (p.Name !== undefined) propertyNamesSeen.push(unwrap(p.Name))
      }
      for (const rawQuantity of pset.Quantities ?? []) {
        const q = rawQuantity as { Name?: unknown }
        if (q.Name !== undefined) quantityNamesSeen.push(unwrap(q.Name))
      }
    }
    debugSample = {
      elementName,
      propertySetCount: propertySetsResult.data.length,
      propertyNamesSeen: propertyNamesSeen.slice(0, 20),
      quantityNamesSeen: quantityNamesSeen.slice(0, 20),
      materialDefCount: materialsResult.data.length,
      propertySetsPrimaryError: propertySetsResult.primaryError,
      propertySetsFallbackError: propertySetsResult.fallbackError,
      materialsPrimaryError: materialsResult.primaryError,
      materialsFallbackError: materialsResult.fallbackError,
    }
  }

  return { quantities, materials, debugSample }
}
