import type { IfcAPI } from 'web-ifc'
import { unwrap } from './ifcPropertyLookup'

// The shape web-ifc's getSpatialStructure() actually returns -- verified
// against the installed package's helpers/properties.d.ts (Node
// interface). `type` comes from GetNameFromTypeCode() -- confirmed by
// actually running it against the real Duplex sample rather than
// assumed: it returns IFC entity names in their normal mixed case (e.g.
// `IfcBuildingStorey`, `IfcSpace`), NOT the all-uppercase form the
// ifc-schema.d.ts numeric constants are named with (`IFCBUILDINGSTOREY`)
// -- those are just how the constants are spelled, not what the runtime
// string value looks like. The root node is the one exception, always
// hardcoded to `"IFCPROJECT"` (uppercase) by web-ifc itself -- irrelevant
// here since nothing below checks the root's own type.
interface SpatialNode {
  expressID: number
  type: string
  children: SpatialNode[]
}

export interface SpatialItem {
  expressId: number
  name: string
  // Hyphenated GlobalIds of every element in this item's subtree (not
  // just direct children) -- spatial containers themselves (a storey, a
  // room) usually have no mesh of their own in an exported glTF, so
  // "jump to this level/room" means framing the camera around what it
  // *contains*, not a node named after the level/room itself. See
  // viewer/ModelViewer.tsx's focusOnGlobalIds().
  elementGlobalIds: string[]
}

export interface Level extends SpatialItem {
  rooms: SpatialItem[]
}

function collectDescendantIds(node: SpatialNode, into: number[]): void {
  for (const child of node.children) {
    into.push(child.expressID)
    collectDescendantIds(child, into)
  }
}

function toGlobalIds(expressIds: number[], expressIdToGlobalId: Map<number, string>): string[] {
  const globalIds: string[] = []
  for (const expressId of expressIds) {
    const globalId = expressIdToGlobalId.get(expressId)
    if (globalId !== undefined) globalIds.push(globalId)
  }
  return globalIds
}

async function nameOf(api: IfcAPI, modelId: number, expressId: number): Promise<string> {
  const props = (await api.properties.getItemProperties(modelId, expressId)) as { Name?: unknown }
  const name = props.Name !== undefined ? unwrap(props.Name) : ''
  return name.trim() || `Unnamed (#${expressId})`
}

// Building storeys (levels) and, within each, the spaces (rooms) they
// directly contain -- IFC's spatial containment is strictly hierarchical
// (Project -> Site -> Building -> Storey -> Space -> Element), so a
// storey's own IfcSpace children are its rooms; storeys don't nest inside
// each other. See docs/features/levels-and-rooms-navigation.md.
export async function getLevelsAndRooms(
  api: IfcAPI,
  modelId: number,
  expressIdToGlobalId: Map<number, string>,
): Promise<Level[]> {
  const root: SpatialNode = await api.properties.getSpatialStructure(modelId)

  const storeys: SpatialNode[] = []
  function findStoreys(node: SpatialNode) {
    if (node.type === 'IfcBuildingStorey') {
      storeys.push(node)
      return
    }
    for (const child of node.children) findStoreys(child)
  }
  findStoreys(root)

  const levels: Level[] = []
  for (const storey of storeys) {
    const rooms: SpatialItem[] = []
    for (const child of storey.children) {
      if (child.type !== 'IfcSpace') continue
      const roomElementIds: number[] = []
      collectDescendantIds(child, roomElementIds)
      rooms.push({
        expressId: child.expressID,
        name: await nameOf(api, modelId, child.expressID),
        elementGlobalIds: toGlobalIds(roomElementIds, expressIdToGlobalId),
      })
    }

    const levelElementIds: number[] = []
    collectDescendantIds(storey, levelElementIds)
    levels.push({
      expressId: storey.expressID,
      name: await nameOf(api, modelId, storey.expressID),
      elementGlobalIds: toGlobalIds(levelElementIds, expressIdToGlobalId),
      rooms,
    })
  }

  return levels
}
