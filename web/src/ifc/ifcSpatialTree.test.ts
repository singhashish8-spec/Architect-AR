import { describe, expect, it } from 'vitest'
import type { IfcAPI } from 'web-ifc'
import { getLevelsAndRooms } from './ifcSpatialTree'

// A minimal fake of the two web-ifc calls this module actually uses --
// getSpatialStructure() and properties.getItemProperties() -- shaped
// exactly like the real Node/property return types (verified against the
// installed package, see ifcSpatialTree.ts's comment), not guessed.
function fakeApi(names: Record<number, string>): IfcAPI {
  const tree = {
    expressID: 1,
    type: 'IfcProject',
    children: [
      {
        expressID: 2,
        type: 'IfcSite',
        children: [
          {
            expressID: 3,
            type: 'IfcBuilding',
            children: [
              {
                expressID: 10,
                type: 'IfcBuildingStorey',
                children: [
                  {
                    expressID: 20,
                    type: 'IfcSpace',
                    children: [
                      { expressID: 30, type: 'IfcWall', children: [] },
                      { expressID: 31, type: 'IfcDoor', children: [] },
                    ],
                  },
                  { expressID: 32, type: 'IfcWall', children: [] }, // not inside any room
                ],
              },
              {
                expressID: 11,
                type: 'IfcBuildingStorey',
                children: [{ expressID: 40, type: 'IfcWall', children: [] }],
              },
            ],
          },
        ],
      },
    ],
  }

  return {
    properties: {
      getSpatialStructure: () => Promise.resolve(tree),
      getItemProperties: (_modelId: number, expressId: number) =>
        Promise.resolve({ Name: { value: names[expressId] ?? '' } }),
    },
  } as unknown as IfcAPI
}

describe('getLevelsAndRooms', () => {
  it('builds levels with their rooms, using each element\'s GlobalId from the given index', async () => {
    const api = fakeApi({ 10: 'Level 1', 11: 'Level 2', 20: 'Living Room' })
    const expressIdToGlobalId = new Map([
      [30, 'wall-guid-1'],
      [31, 'door-guid-1'],
      [32, 'wall-guid-2'],
      [40, 'wall-guid-3'],
    ])

    const levels = await getLevelsAndRooms(api, 0, expressIdToGlobalId)

    expect(levels).toHaveLength(2)
    expect(levels[0].name).toBe('Level 1')
    // Every element under the storey, room-contained or not.
    expect(levels[0].elementGlobalIds.sort()).toEqual(['door-guid-1', 'wall-guid-1', 'wall-guid-2'].sort())
    expect(levels[0].rooms).toHaveLength(1)
    expect(levels[0].rooms[0].name).toBe('Living Room')
    expect(levels[0].rooms[0].elementGlobalIds.sort()).toEqual(['door-guid-1', 'wall-guid-1'].sort())

    expect(levels[1].name).toBe('Level 2')
    expect(levels[1].elementGlobalIds).toEqual(['wall-guid-3'])
    expect(levels[1].rooms).toHaveLength(0)
  })

  it('falls back to a placeholder name for an unnamed level', async () => {
    const api = fakeApi({})
    const levels = await getLevelsAndRooms(api, 0, new Map())
    expect(levels[0].name).toBe('Unnamed (#10)')
  })

  it('skips an element with no matching GlobalId in the index rather than throwing', async () => {
    const api = fakeApi({ 10: 'Level 1' })
    const levels = await getLevelsAndRooms(api, 0, new Map())
    expect(levels[0].elementGlobalIds).toEqual([])
  })

  it('falls back to the level\'s elements when a room has none of its own', async () => {
    // A room's IfcSpace subtree is frequently empty in real exports --
    // most exporters attach a room's walls/doors to the *storey*, not the
    // space, so only rooms with something explicitly modeled as
    // "contained in" the space end up with descendants here at all.
    // Confirmed against the real Duplex sample, where roughly half the
    // rooms have zero descendants. Framing on an empty box would silently
    // do nothing when a room like that is clicked, so an empty room
    // should fall back to its level's own elements instead.
    const tree = {
      expressID: 1,
      type: 'IfcProject',
      children: [
        {
          expressID: 10,
          type: 'IfcBuildingStorey',
          children: [
            { expressID: 20, type: 'IfcSpace', children: [] }, // empty room
            { expressID: 30, type: 'IfcWall', children: [] },
          ],
        },
      ],
    }
    const api = {
      properties: {
        getSpatialStructure: () => Promise.resolve(tree),
        getItemProperties: (_modelId: number, expressId: number) =>
          Promise.resolve({ Name: { value: expressId === 20 ? 'Closet' : '' } }),
      },
    } as unknown as IfcAPI
    const expressIdToGlobalId = new Map([[30, 'wall-guid-1']])

    const levels = await getLevelsAndRooms(api, 0, expressIdToGlobalId)

    expect(levels[0].elementGlobalIds).toEqual(['wall-guid-1'])
    expect(levels[0].rooms[0].name).toBe('Closet')
    expect(levels[0].rooms[0].elementGlobalIds).toEqual(['wall-guid-1'])
  })
})
