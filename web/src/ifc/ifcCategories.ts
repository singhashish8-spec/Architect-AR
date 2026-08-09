import type { IfcAPI } from 'web-ifc'
import { getLineTypeName, unwrap } from './ifcPropertyLookup'

export type Discipline = 'Architecture' | 'Structure' | 'MEP'

// Maps a concrete IFC entity type name (e.g. "IfcWallStandardCase", as
// returned by web-ifc -- see the type-name casing note in
// ifcSpatialTree.ts, same source) to a human-readable category label.
// Deliberately a flat lookup table of concrete leaf types rather than
// walking IFC's class inheritance tree -- web-ifc's untyped API (the one
// this whole ifc/ module uses) doesn't expose "is this type a subtype of
// X" at runtime, only the concrete type name per element, so this
// matches the same string-matching approach the rest of the module
// already uses (see ifcSpatialTree.ts, ifcPropertyLookup.ts). Covers the
// common real-world building element types; not exhaustive against IFC's
// full ~800-entity schema.
const ARCHITECTURE_CATEGORIES: Record<string, string> = {
  IfcWall: 'Walls',
  IfcWallStandardCase: 'Walls',
  IfcCurtainWall: 'Curtain walls',
  IfcDoor: 'Doors',
  IfcWindow: 'Windows',
  IfcSlab: 'Floors & slabs',
  IfcRoof: 'Roofs',
  IfcStair: 'Stairs',
  IfcStairFlight: 'Stairs',
  IfcRamp: 'Ramps',
  IfcRampFlight: 'Ramps',
  IfcRailing: 'Railings',
  IfcCovering: 'Coverings & finishes',
  IfcPlate: 'Plates & mullions',
  IfcMember: 'Plates & mullions',
  IfcFurnishingElement: 'Furniture',
  IfcFurniture: 'Furniture',
  IfcSpace: 'Rooms',
  IfcBuildingElementProxy: 'Other (generic)',
}

const STRUCTURE_CATEGORIES: Record<string, string> = {
  IfcColumn: 'Columns',
  IfcBeam: 'Beams',
  IfcFooting: 'Footings',
  IfcPile: 'Piles',
}

// Broad "this is MEP" detection by type -- which of Plumbing / Fire /
// HVAC / Electrical it actually belongs to isn't reliable from type
// alone (an IfcPipeSegment could be any of plumbing, fire protection, or
// heating, depending on what system it's part of), so this only gives a
// readable per-type label; getElementDisciplines() below tries to
// resolve the real sub-discipline separately via each element's IfcSystem
// assignment. See docs/features/category-and-discipline-visibility.md's
// Open questions -- unverified against a real MEP export.
const MEP_CATEGORIES: Record<string, string> = {
  IfcPipeSegment: 'Pipes',
  IfcPipeFitting: 'Pipe fittings',
  IfcDuctSegment: 'Ducts',
  IfcDuctFitting: 'Duct fittings',
  IfcDuctSilencer: 'Ducts',
  IfcCableSegment: 'Cabling',
  IfcCableCarrierSegment: 'Cable trays & conduit',
  IfcCableCarrierFitting: 'Cable trays & conduit',
  IfcCableFitting: 'Cabling',
  IfcFlowSegment: 'Flow segments',
  IfcFlowFitting: 'Flow fittings',
  IfcFlowTerminal: 'Terminals & outlets',
  IfcFlowController: 'Controls',
  IfcFlowMovingDevice: 'Pumps & fans',
  IfcFlowStorageDevice: 'Tanks & storage',
  IfcFlowTreatmentDevice: 'Treatment devices',
  IfcDistributionControlElement: 'Controls',
  IfcDistributionChamberElement: 'Chambers',
  IfcSanitaryTerminal: 'Sanitary fixtures',
  IfcSpaceHeater: 'Heating equipment',
  IfcValve: 'Valves',
  IfcPump: 'Pumps & fans',
  IfcFan: 'Pumps & fans',
  IfcBoiler: 'Heating equipment',
  IfcChiller: 'Cooling equipment',
  IfcCoil: 'Cooling equipment',
  IfcCondenser: 'Cooling equipment',
  IfcCooledBeam: 'Cooling equipment',
  IfcCoolingTower: 'Cooling equipment',
  IfcDamper: 'Ducts',
  IfcElectricAppliance: 'Electrical equipment',
  IfcElectricDistributionBoard: 'Electrical equipment',
  IfcElectricFlowStorageDevice: 'Electrical equipment',
  IfcElectricGenerator: 'Electrical equipment',
  IfcElectricMotor: 'Electrical equipment',
  IfcElectricTimeControl: 'Electrical equipment',
  IfcFilter: 'Treatment devices',
  IfcFireSuppressionTerminal: 'Fire protection',
  IfcHeatExchanger: 'Heating equipment',
  IfcHumidifier: 'HVAC equipment',
  IfcJunctionBox: 'Electrical equipment',
  IfcLamp: 'Lighting',
  IfcLightFixture: 'Lighting',
  IfcMotorConnection: 'Electrical equipment',
  IfcOutlet: 'Terminals & outlets',
  IfcProtectiveDevice: 'Electrical equipment',
  IfcSensor: 'Controls',
  IfcSwitchingDevice: 'Electrical equipment',
  IfcTank: 'Tanks & storage',
  IfcTransformer: 'Electrical equipment',
  IfcTubeBundle: 'HVAC equipment',
  IfcUnitaryEquipment: 'HVAC equipment',
  IfcAirTerminal: 'Terminals & outlets',
  IfcAirTerminalBox: 'HVAC equipment',
  IfcAirToAirHeatRecovery: 'HVAC equipment',
  IfcVibrationIsolator: 'HVAC equipment',
  IfcWasteTerminal: 'Sanitary fixtures',
  IfcCompressor: 'HVAC equipment',
  IfcAlarm: 'Fire protection',
  IfcController: 'Controls',
  IfcActuator: 'Controls',
  IfcFlowInstrument: 'Controls',
}

export interface ElementCategory {
  expressId: number
  globalId: string
  type: string
  discipline: Discipline
  category: string
}

// Returns null for any type not in the three category tables above --
// deliberately NOT a generic "Other" catch-all. buildGlobalIdIndex (see
// ifcPropertyLookup.ts) indexes every line in the file that has a
// GlobalId, which in IFC is nearly everything (IfcRoot, the base class
// almost the whole schema inherits from, carries one) -- property sets,
// relationships, type/style definitions, and spatial containers
// (IfcProject, IfcBuildingStorey, ...) all have real GlobalIds despite
// having no geometry of their own. That index works fine for its
// original purpose (matching a clicked glTF *mesh* name back to an
// element, since meshes only ever exist for physical elements in the
// first place) but is much broader than "things with visible geometry" --
// confirmed by actually running this against the real Duplex sample
// before an "Other" fallback shipped: it surfaced entries like
// "PropertySet", "RelAggregates", and "BuildingStorey" as if they were
// hideable categories, none of which correspond to anything rendered.
function classify(type: string): { discipline: Discipline; category: string } | null {
  if (type in ARCHITECTURE_CATEGORIES) {
    return { discipline: 'Architecture', category: ARCHITECTURE_CATEGORIES[type] }
  }
  if (type in STRUCTURE_CATEGORIES) {
    return { discipline: 'Structure', category: STRUCTURE_CATEGORIES[type] }
  }
  if (type in MEP_CATEGORIES) {
    return { discipline: 'MEP', category: MEP_CATEGORIES[type] }
  }
  return null
}

// IfcDistributionSystem's PredefinedType enum values, mapped to a
// friendly label -- these are what actually distinguishes "Plumbing"
// from "Fire" from "HVAC" for an MEP element, since the element's own
// type (e.g. IfcPipeSegment) doesn't say which system it's part of.
// Verified against the IFC4 schema's enum values directly, not guessed
// -- but NOT yet verified against a real MEP export actually populating
// this relationship; see this module's doc comment and
// docs/features/category-and-discipline-visibility.md.
const SYSTEM_TYPE_LABELS: Record<string, string> = {
  DOMESTICCOLDWATER: 'Plumbing',
  DOMESTICHOTWATER: 'Plumbing',
  DRAINAGE: 'Plumbing',
  SEWAGE: 'Plumbing',
  WASTEWATER: 'Plumbing',
  WATERSUPPLY: 'Plumbing',
  RAINWATER: 'Plumbing',
  STORMWATER: 'Plumbing',
  VENT: 'Plumbing',
  FIREPROTECTION: 'Fire protection',
  AIRCONDITIONING: 'HVAC',
  HEATING: 'HVAC',
  VENTILATION: 'HVAC',
  EXHAUST: 'HVAC',
  REFRIGERATION: 'HVAC',
  ELECTRICAL: 'Electrical',
  LIGHTING: 'Electrical',
  POWERGENERATION: 'Electrical',
  COMMUNICATION: 'Electrical',
  DATA: 'Electrical',
  SECURITY: 'Electrical',
  CONTROL: 'Controls',
  GAS: 'Gas',
  FUEL: 'Gas',
}

// Every IfcRelAssignsToGroup line, split into a lookup from a related
// element's expressId -> the discipline label of the IfcSystem/
// IfcDistributionSystem group it belongs to (if any, and if that
// system's PredefinedType maps to a known discipline above). One pass
// over all lines, same O(n) approach as ifcPropertyLookup.ts's
// buildGlobalIdIndex -- there's no per-element query for "what system is
// this in" in web-ifc's helper API, so this has to be built by hand.
function buildSystemDisciplineIndex(api: IfcAPI, modelId: number): Map<number, string> {
  const index = new Map<number, string>()
  const allLines = api.GetAllLines(modelId)
  const count = allLines.size()

  for (let i = 0; i < count; i++) {
    const expressId = allLines.get(i)
    if (getLineTypeName(api, modelId, expressId) !== 'IfcRelAssignsToGroup') continue

    let line: unknown
    try {
      line = api.GetLine(modelId, expressId)
    } catch {
      continue
    }
    const rel = line as {
      RelatingGroup?: { value: number }
      RelatedObjects?: { value: number }[]
    }
    if (rel.RelatingGroup === undefined || rel.RelatedObjects === undefined) continue

    if (!getLineTypeName(api, modelId, rel.RelatingGroup.value).includes('System')) continue

    let group: { PredefinedType?: unknown }
    try {
      group = api.GetLine(modelId, rel.RelatingGroup.value) as typeof group
    } catch {
      continue
    }

    const predefinedType = group.PredefinedType !== undefined ? unwrap(group.PredefinedType) : ''
    const disciplineLabel = SYSTEM_TYPE_LABELS[predefinedType]
    if (!disciplineLabel) continue

    for (const related of rel.RelatedObjects) {
      index.set(related.value, disciplineLabel)
    }
  }

  return index
}

// Every element in the model, classified by discipline and category, for
// the show/hide-by-category panel. See
// docs/features/category-and-discipline-visibility.md.
export function getElementCategories(
  api: IfcAPI,
  modelId: number,
  expressIdToGlobalId: Map<number, string>,
): ElementCategory[] {
  const systemDisciplines = buildSystemDisciplineIndex(api, modelId)
  const results: ElementCategory[] = []

  for (const [expressId, globalId] of expressIdToGlobalId) {
    let type: string
    try {
      type = getLineTypeName(api, modelId, expressId)
    } catch {
      continue
    }
    const classified = classify(type)
    if (!classified) continue
    const { discipline, category } = classified

    // A real system assignment (e.g. "this pipe is in the Fire
    // Protection system") is more specific than the generic "MEP"
    // fallback -- use it as the category label directly when present.
    const systemLabel = systemDisciplines.get(expressId)
    results.push({
      expressId,
      globalId,
      type,
      discipline,
      category: discipline === 'MEP' && systemLabel ? systemLabel : category,
    })
  }

  return results
}
