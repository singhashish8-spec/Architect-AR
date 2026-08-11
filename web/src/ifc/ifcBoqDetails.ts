import type { IfcAPI } from 'web-ifc'
import { unwrap } from './ifcPropertyLookup'
import type { Discipline, ElementCategory } from './ifcCategories'
import type { Level } from './ifcSpatialTree'
import { getLengthUnitScaleToMeters } from './ifcUnits'
import { getElementBoqData, type ElementQuantities } from './ifcQuantities'

export interface BoqElementDetail {
  expressId: number
  globalId: string
  name: string
  type: string
  discipline: Discipline
  category: string
  level: string | null
  materials: string[]
  quantities: ElementQuantities
}

// globalId -> level name, built once from the same level/room data the
// Levels panel already has (ifc/ifcSpatialTree.ts) -- a level's own
// elementGlobalIds already includes every element on every room on that
// level (see getLevelsAndRooms()'s own comment on the room-fallback), so
// a plain "which level's set contains this globalId" scan is enough; no
// separate IFC query needed.
function buildLevelLookup(levels: Level[]): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const level of levels) {
    for (const globalId of level.elementGlobalIds) {
      if (!lookup.has(globalId)) lookup.set(globalId, level.name)
    }
  }
  return lookup
}

export interface BuildBoqDetailsOptions {
  onProgress?: (done: number, total: number) => void
}

// Bulk-builds the full BOQ detail list -- one row per classified element,
// each with its level, material(s), and quantities -- the data the old
// count-only Schedule panel never needed. Deliberately NOT run
// automatically on model load (unlike levels/categories, which
// useIfcElementData.ts computes for every model): each element here
// costs two extra WASM calls (getPropertySets + getMaterialsProperties)
// on top of what's already fetched, fine for a few hundred elements but
// real, visible time for a genuinely large building. See
// useIfcElementData.ts's getBoqDetails(), which only calls this the
// first time the BOQ panel is actually opened, and caches the result for
// the rest of that session. Yields back to the main thread periodically
// (same "every 25 elements" pacing ifc/ifcToGlb.ts's own per-element
// loop uses) so the tab stays responsive while this runs, rather than
// freezing for however long the whole pass takes -- lighter than that
// loop's own yielding needed to be, since these are small per-element
// property calls, not one opaque LoadAllGeometry() call that can't be
// interrupted no matter how it's paced (see docs/features/ifc-only-upload.md
// for why that distinction matters).
export async function buildBoqDetails(
  api: IfcAPI,
  modelId: number,
  categories: ElementCategory[],
  levels: Level[],
  options: BuildBoqDetailsOptions = {},
): Promise<BoqElementDetail[]> {
  const levelLookup = buildLevelLookup(levels)
  const lengthScale = getLengthUnitScaleToMeters(api, modelId)
  const details: BoqElementDetail[] = []

  for (let i = 0; i < categories.length; i++) {
    const element = categories[i]

    let name = `Unnamed (#${element.expressId})`
    try {
      const itemProps = (await api.properties.getItemProperties(modelId, element.expressId)) as { Name?: unknown }
      if (itemProps.Name !== undefined) {
        const raw = unwrap(itemProps.Name).trim()
        if (raw) name = raw
      }
    } catch {
      // Keep the fallback name -- one element's lookup failing shouldn't
      // drop it from the BOQ entirely.
    }

    const { quantities, materials } = await getElementBoqData(api, modelId, element.expressId, lengthScale)

    details.push({
      expressId: element.expressId,
      globalId: element.globalId,
      name,
      type: element.type,
      discipline: element.discipline,
      category: element.category,
      level: levelLookup.get(element.globalId) ?? null,
      materials,
      quantities,
    })

    options.onProgress?.(i + 1, categories.length)
    if (i % 25 === 24) await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return details
}
