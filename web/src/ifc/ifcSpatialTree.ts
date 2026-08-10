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
    const levelElementIds: number[] = []
    collectDescendantIds(storey, levelElementIds)
    const levelGlobalIds = toGlobalIds(levelElementIds, expressIdToGlobalId)

    const rooms: SpatialItem[] = []
    for (const child of storey.children) {
      if (child.type !== 'IfcSpace') continue
      const roomElementIds: number[] = []
      collectDescendantIds(child, roomElementIds)
      const roomGlobalIds = toGlobalIds(roomElementIds, expressIdToGlobalId)
      rooms.push({
        expressId: child.expressID,
        name: await nameOf(api, modelId, child.expressID),
        // A room's own IfcSpace subtree is frequently empty -- most IFC
        // exporters (including Revit's) attach a room's walls/doors/
        // furniture to the *storey* via IfcRelContainedInSpatialStructure,
        // not to the IfcSpace itself; only rooms with something explicitly
        // modeled as "contained in" the space (rare) end up with any
        // descendants here at all. Confirmed against the real Duplex
        // sample: roughly half its rooms (A101, B101, B104, B105, ...)
        // have zero descendants while others (A102, A103, ...) have
        // several -- not a parsing bug, just how the file's containment
        // relationships are structured. Framing on an empty box would
        // silently do nothing when a room like that is clicked (this is
        // what an owner report called "not jumping to rooms"), so fall
        // back to framing the room's whole level instead of leaving the
        // click with no visible effect.
        elementGlobalIds: roomGlobalIds.length > 0 ? roomGlobalIds : levelGlobalIds,
      })
    }

    levels.push({
      expressId: storey.expressID,
      name: await nameOf(api, modelId, storey.expressID),
      elementGlobalIds: levelGlobalIds,
      rooms,
    })
  }

  return levels
}
