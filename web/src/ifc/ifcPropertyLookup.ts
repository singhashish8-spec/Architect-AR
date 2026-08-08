import type { IfcAPI } from 'web-ifc'
import type { IfcElementData, IfcProperty } from '../types/IfcElementData'
import { expandIfcGuid, hyphenateUuid } from './ifcGuid'

// Matches a standard UUID, hyphens optional (glTF node names sometimes
// drop them). Used to pull a candidate identifier out of an arbitrary
// node name like "product-9808fd7f-1a92-...-body". See ifcGuid.ts.
const UUID_PATTERN = /[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/

// IFC "value" objects come back from web-ifc wrapped as { value, type },
// e.g. an IfcLabel -- unwrap to a plain string for display. Exported for
// direct testing (see ifcPropertyLookup.test.ts) -- this shape was
// verified against web-ifc's actual ifc-schema.d.ts, not just assumed,
// so it's worth locking in with a test.
export function unwrap(value: unknown): string {
  if (value !== null && typeof value === 'object' && 'value' in value) {
    return String(value.value)
  }
  return String(value)
}

// Walks every line in the model once, building an index from GlobalId ->
// expressId. Each element is indexed under THREE keys -- the compressed
// IFC form web-ifc reads directly, plus both the bare and hyphenated
// expanded-UUID forms -- because not every glTF exporter names nodes
// after the compressed form. Verified against a real exporter
// (IfcOpenShell's glTF serializer, which uses the expanded form,
// "product-<uuid>-body") using a real Revit-exported IFC file -- see
// docs/history/sessions/ and ifcGuid.ts for the full story. Without the
// expanded forms here, this index would silently fail to match anything
// for that exporter (and likely others following the same convention).
//
// O(n) over every line in the file; if this proves too slow on large
// models, see docs/features/element-data-inspection.md's server-side
// pre-process fallback.
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
      if (props.GlobalId === undefined) continue

      const compressed = unwrap(props.GlobalId)
      index.set(compressed, expressId)
      try {
        const expanded = expandIfcGuid(compressed)
        index.set(expanded, expressId)
        index.set(hyphenateUuid(expanded), expressId)
      } catch {
        // A malformed or non-standard GlobalId (rare) -- the compressed
        // form above still works for exporters that use it directly.
      }
    } catch {
      // Not every line is an element with a GlobalId (geometry
      // representation lines, etc.) -- skip those rather than fail the
      // whole index.
    }
  }

  return index
}

// Resolves a glTF node's name to an expressId, trying the node name
// as-is first (an exporter that names nodes directly after the
// compressed GlobalId), then falling back to extracting a UUID-shaped
// substring (an exporter like IfcOpenShell's that wraps the expanded
// form, e.g. "product-9808fd7f-1a92-...-body"). See buildGlobalIdIndex's
// comment for why both are needed.
export function resolveNodeNameToExpressId(
  nodeName: string,
  index: Map<string, number>,
): number | undefined {
  const direct = index.get(nodeName)
  if (direct !== undefined) return direct

  const match = UUID_PATTERN.exec(nodeName)
  if (!match) return undefined
  return index.get(match[0].toLowerCase())
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
