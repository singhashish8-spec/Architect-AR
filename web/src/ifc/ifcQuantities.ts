import type { IfcAPI } from 'web-ifc'
import { unwrap } from './ifcPropertyLookup'

// Values already converted to metres/m2/m3 by the caller (see
// ifcUnits.ts) -- never the model's own raw, possibly-unknown unit.
export interface ElementQuantities {
  length: number | null
  area: number | null
  volume: number | null
}

const LENGTH_NAME_PRIORITY = ['Length', 'NominalLength', 'Perimeter']
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

// Pulls area/volume/length straight out of the same property-set array
// getElementData() (ifcPropertyLookup.ts) already fetches per element --
// that function only reads each pset's `HasProperties` (regular Pset_*
// values); Qto_* quantity sets come back in the very same array but
// carry their values under `Quantities` instead, which nothing in this
// app read until now. An IfcElementQuantity's own `Quantities` array
// holds IfcQuantityLength/Area/Volume objects, told apart here by which
// value field is actually present (LengthValue/AreaValue/VolumeValue)
// rather than a type-code lookup, since these come back as plain nested
// objects with no expressID of their own to look up. A model can carry
// more than one quantity of the same kind for one element (e.g. a
// wall's Length vs. its Perimeter) -- picks a well-known Qto name first
// (the one an architect doing a real takeoff would expect, e.g.
// NetSideArea over GrossSideArea for a wall) and falls back to
// whichever was found first if none of the preferred names match.
function extractQuantities(propertySets: unknown[], lengthScale: number): ElementQuantities {
  const lengths: { name: string; value: number }[] = []
  const areas: { name: string; value: number }[] = []
  const volumes: { name: string; value: number }[] = []

  for (const raw of propertySets) {
    const pset = raw as { Quantities?: unknown[] }
    if (!pset.Quantities) continue
    for (const rawQuantity of pset.Quantities) {
      const q = rawQuantity as Record<string, unknown>
      const name = q.Name !== undefined ? unwrap(q.Name) : ''
      if ('LengthValue' in q) lengths.push({ name, value: Number(unwrap(q.LengthValue)) })
      else if ('AreaValue' in q) areas.push({ name, value: Number(unwrap(q.AreaValue)) })
      else if ('VolumeValue' in q) volumes.push({ name, value: Number(unwrap(q.VolumeValue)) })
    }
  }

  const length = pickByPriority(lengths, LENGTH_NAME_PRIORITY)
  const area = pickByPriority(areas, AREA_NAME_PRIORITY)
  const volume = pickByPriority(volumes, VOLUME_NAME_PRIORITY)

  return {
    length: length === null || Number.isNaN(length) ? null : length * lengthScale,
    area: area === null || Number.isNaN(area) ? null : area * lengthScale * lengthScale,
    volume: volume === null || Number.isNaN(volume) ? null : volume * lengthScale * lengthScale * lengthScale,
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
export async function getElementBoqData(
  api: IfcAPI,
  modelId: number,
  expressId: number,
  lengthScale: number,
): Promise<{ quantities: ElementQuantities; materials: string[] }> {
  let quantities: ElementQuantities = { length: null, area: null, volume: null }
  try {
    const propertySets = (await api.properties.getPropertySets(modelId, expressId, true)) as unknown[]
    quantities = extractQuantities(propertySets, lengthScale)
  } catch {
    // No property/quantity sets for this element -- leave quantities null.
  }

  let materials: string[] = []
  try {
    const materialDefs = (await api.properties.getMaterialsProperties(modelId, expressId, true, true)) as unknown[]
    const names = new Set<string>()
    for (const def of materialDefs) collectMaterialNames(def, names)
    materials = Array.from(names)
  } catch {
    // No material association for this element -- not an error, just
    // nothing to show.
  }

  return { quantities, materials }
}
