import type { IfcAPI } from 'web-ifc'
import type { IfcElementData, IfcProperty } from '../types/IfcElementData'

// IFC "value" objects come back from web-ifc wrapped as { value, type },
// e.g. an IfcLabel -- unwrap to a plain string for display.
function unwrap(value: unknown): string {
  if (value !== null && typeof value === 'object' && 'value' in value) {
    return String(value.value)
  }
  return String(value)
}

// Walks every line in the model once, building a GlobalId -> expressId
// index. NOT validated against a real IFC export yet -- see
// docs/history/sessions/ for the note on what still needs live testing.
// Straightforward but O(n) over every line in the file; if this proves too
// slow on large models, see docs/features/element-data-inspection.md's
// server-side pre-process fallback.
export async function buildGlobalIdIndex(
  api: IfcAPI,
  modelId: number,
): Promise<Map<string, number>> {
  const index = new Map<string, number>()
  const allLines = api.GetAllLines(modelId)
  const count = allLines.size()

  for (let i = 0; i < count; i++) {
    const expressId = allLines.get(i)
    try {
      const props = (await api.properties.getItemProperties(modelId, expressId)) as {
        GlobalId?: unknown
      }
      if (props.GlobalId !== undefined) {
        index.set(unwrap(props.GlobalId), expressId)
      }
    } catch {
      // Not every line is an element with a GlobalId (geometry
      // representation lines, etc.) -- skip those rather than fail the
      // whole index.
    }
  }

  return index
}

export async function getElementData(
  api: IfcAPI,
  modelId: number,
  expressId: number,
): Promise<IfcElementData> {
  const itemProps = (await api.properties.getItemProperties(modelId, expressId)) as {
    Name?: unknown
  }
  const propertySets = (await api.properties.getPropertySets(modelId, expressId, true)) as {
    HasProperties?: unknown[]
  }[]

  const properties: IfcProperty[] = []
  for (const pset of propertySets) {
    for (const prop of pset.HasProperties ?? []) {
      const p = prop as { Name?: unknown; NominalValue?: unknown }
      if (p.Name === undefined) continue
      properties.push({
        name: unwrap(p.Name),
        value: p.NominalValue !== undefined ? unwrap(p.NominalValue) : '',
      })
    }
  }

  const line = api.GetLine(modelId, expressId) as { constructor: { name: string } }

  return {
    expressId,
    type: line.constructor.name,
    name: itemProps.Name !== undefined ? unwrap(itemProps.Name) : null,
    properties,
  }
}
