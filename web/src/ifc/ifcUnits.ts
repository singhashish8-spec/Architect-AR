import type { IfcAPI } from 'web-ifc'
import { getLineTypeName, unwrap } from './ifcPropertyLookup'

// IfcSIUnit's Prefix enum values -> multiplier against the unprefixed
// unit. See docs/features/boq.md.
const SI_PREFIX_SCALE: Record<string, number> = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
  MICRO: 1e-6,
  NANO: 1e-9,
  PICO: 1e-12,
  FEMTO: 1e-15,
  ATTO: 1e-18,
}

function siUnitScale(prefix: string | null): number {
  if (!prefix) return 1
  return SI_PREFIX_SCALE[prefix] ?? 1
}

interface UnitRef {
  value: number
}

interface UnitLine {
  UnitType?: unknown
  Prefix?: unknown
  ConversionFactor?: UnitRef
}

interface MeasureWithUnitLine {
  ValueComponent?: unknown
  UnitComponent?: UnitRef
}

// A single length -> meters scale factor, resolved once from
// IfcProject.UnitsInContext and reused for every quantity this model's
// BOQ shows. Real IFC exports vary: Revit's metric templates commonly
// use millimetres OR metres as the base length unit, and a US Imperial
// template exports in feet -- Qto_* quantities (area/volume/length) are
// always stored in whatever that base unit is, so showing them
// unconverted would be wrong (or at least badly misleading) for any file
// that isn't already in metres. Handles the two realistic cases: a plain
// SI unit (optionally prefixed, e.g. MILLI+METRE) and a conversion-based
// unit defined in terms of one (e.g. FOOT = 0.3048 x METRE). Falls back
// to 1 (assume metres already) if IfcProject/IfcUnitAssignment can't be
// found or parsed, rather than throwing -- an unrecognized unit shape
// shouldn't take down the whole BOQ panel, just leave its numbers
// unconverted. Not verified against a real IFC file's own unit
// declaration in this sandbox (no live IFC sample available here) --
// built directly from the IFC4 schema's own definitions for
// IfcUnitAssignment/IfcSIUnit/IfcConversionBasedUnit/IfcMeasureWithUnit,
// same "spec-first, flag as unverified" approach already used elsewhere
// in this module for real exports this app hasn't been tested against
// (see ifcCategories.ts's MEP system-discipline comment).
export function getLengthUnitScaleToMeters(api: IfcAPI, modelId: number): number {
  try {
    const allLines = api.GetAllLines(modelId)
    const count = allLines.size()

    let projectId: number | null = null
    for (let i = 0; i < count; i++) {
      const expressId = allLines.get(i)
      if (getLineTypeName(api, modelId, expressId) === 'IfcProject') {
        projectId = expressId
        break
      }
    }
    if (projectId === null) return 1

    const project = api.GetLine(modelId, projectId) as { UnitsInContext?: UnitRef }
    if (!project.UnitsInContext) return 1

    const assignment = api.GetLine(modelId, project.UnitsInContext.value) as { Units?: UnitRef[] }
    if (!assignment.Units) return 1

    for (const unitRef of assignment.Units) {
      const typeName = getLineTypeName(api, modelId, unitRef.value)
      const unit = api.GetLine(modelId, unitRef.value) as UnitLine
      const unitType = unit.UnitType !== undefined ? unwrap(unit.UnitType) : ''
      if (unitType !== 'LENGTHUNIT') continue

      if (typeName === 'IfcSIUnit') {
        const prefix = unit.Prefix !== undefined ? unwrap(unit.Prefix) : null
        return siUnitScale(prefix)
      }

      if (typeName === 'IfcConversionBasedUnit' && unit.ConversionFactor) {
        const measure = api.GetLine(modelId, unit.ConversionFactor.value) as MeasureWithUnitLine
        const factorValue = measure.ValueComponent !== undefined ? Number(unwrap(measure.ValueComponent)) : NaN
        if (Number.isNaN(factorValue) || !measure.UnitComponent) continue

        const baseTypeName = getLineTypeName(api, modelId, measure.UnitComponent.value)
        const base = api.GetLine(modelId, measure.UnitComponent.value) as UnitLine
        const baseScale =
          baseTypeName === 'IfcSIUnit' ? siUnitScale(base.Prefix !== undefined ? unwrap(base.Prefix) : null) : 1
        return factorValue * baseScale
      }
    }

    return 1
  } catch {
    return 1
  }
}
