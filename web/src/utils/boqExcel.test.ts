import { describe, expect, it } from 'vitest'
import { buildBoqWorkbook } from './boqExcel'
import { buildBoqTree } from './boqData'
import type { BoqElementDetail } from '../ifc/ifcBoqDetails'

const details: BoqElementDetail[] = [
  {
    expressId: 1,
    globalId: 'wall-1',
    name: 'Wall-01',
    type: 'IfcWallStandardCase',
    discipline: 'Architecture',
    category: 'Walls',
    level: 'Level 1',
    levelIndex: 0,
    materials: ['Brick'],
    quantities: { length: 4, width: null, height: 3, area: 10, volume: 2 },
  },
  {
    expressId: 2,
    globalId: 'wall-2',
    name: 'Wall-02',
    type: 'IfcWallStandardCase',
    discipline: 'Architecture',
    category: 'Walls',
    level: 'Level 2',
    levelIndex: 1,
    materials: ['Concrete'],
    quantities: { length: 5, width: null, height: 3, area: 15, volume: 3 },
  },
  {
    expressId: 3,
    globalId: 'beam-1',
    name: 'Beam-01',
    type: 'IfcBeam',
    discipline: 'Structure',
    category: 'Beams',
    level: 'Level 1',
    levelIndex: 0,
    materials: ['Steel'],
    quantities: { length: 6, width: 0.3, height: 0.5, area: null, volume: 0.9 },
  },
]

const meta = { projectName: 'Test Tower', companyName: 'Acme Architects', modelName: 'Model 1', generatedOn: '2026-08-11' }

describe('buildBoqWorkbook', () => {
  it('writes a Summary sheet plus one dedicated sheet per category', async () => {
    const tree = buildBoqTree(details)
    const workbook = await buildBoqWorkbook(tree, () => false, meta)

    const names = workbook.worksheets.map((sheet) => sheet.name)
    expect(names).toEqual(['Summary', 'Walls', 'Beams'])
  })

  it('puts the company and project name in every sheet\'s title block', async () => {
    const tree = buildBoqTree(details)
    const workbook = await buildBoqWorkbook(tree, () => false, meta)

    for (const sheet of workbook.worksheets) {
      expect(sheet.getCell(1, 1).value).toBe('Acme Architects')
      expect(sheet.getCell(2, 1).value).toBe('Test Tower')
    }
  })

  it('flat (ungrouped) mode adds a Level column and one row per element', async () => {
    const tree = buildBoqTree(details)
    const workbook = await buildBoqWorkbook(tree, () => false, meta)
    const wallsSheet = workbook.getWorksheet('Walls')!

    // Row 5 is the header (rows 1-4 are the title block); columns are
    // No., Name, Level, Material, Area, Length, Height for Walls.
    const header = (wallsSheet.getRow(5).values as unknown[]).filter((v): v is string => typeof v === 'string')
    expect(header).toContain('Level')
    expect(wallsSheet.getCell(6, 2).value).toBe('Wall-01')
    expect(wallsSheet.getCell(6, 3).value).toBe('Level 1')
    expect(wallsSheet.getCell(7, 2).value).toBe('Wall-02')
    expect(wallsSheet.getCell(7, 3).value).toBe('Level 2')
  })

  it('grouped mode drops the Level column and inserts a banner row per level', async () => {
    const tree = buildBoqTree(details)
    const workbook = await buildBoqWorkbook(tree, (key) => key === 'Architecture Walls', meta)
    const wallsSheet = workbook.getWorksheet('Walls')!

    const header = (wallsSheet.getRow(5).values as unknown[]).filter((v): v is string => typeof v === 'string')
    expect(header).not.toContain('Level')

    // Row 6 is the "Level 1" banner (merged across the row), row 7 is
    // Wall-01 itself, row 8 is the "Level 2" banner, row 9 is Wall-02.
    expect(wallsSheet.getCell(6, 1).value).toBe('Level 1  (1)')
    expect(wallsSheet.getCell(7, 2).value).toBe('Wall-01')
    expect(wallsSheet.getCell(8, 1).value).toBe('Level 2  (1)')
    expect(wallsSheet.getCell(9, 2).value).toBe('Wall-02')
  })

  it('only includes the metric columns that category\'s profile defines', async () => {
    const tree = buildBoqTree(details)
    const workbook = await buildBoqWorkbook(tree, () => false, meta)
    const beamsSheet = workbook.getWorksheet('Beams')!

    const header = (beamsSheet.getRow(5).values as unknown[]).filter((v): v is string => typeof v === 'string')
    expect(header.some((h) => h.startsWith('Length'))).toBe(true)
    expect(header.some((h) => h.startsWith('Width'))).toBe(true)
    expect(header.some((h) => h.startsWith('Height'))).toBe(true)
    expect(header.some((h) => h.startsWith('Volume'))).toBe(true)
    expect(header.some((h) => h.startsWith('Area'))).toBe(false)
  })

  it('sanitizes and truncates worksheet names to Excel\'s own limits', async () => {
    const longCategoryDetails: BoqElementDetail[] = [
      {
        expressId: 1,
        globalId: 'x-1',
        name: 'X-01',
        type: 'IfcFlowFitting',
        discipline: 'MEP',
        category: 'Cable trays & conduit / control:panels?',
        level: 'Level 1',
        levelIndex: 0,
        materials: [],
        quantities: { length: null, width: null, height: null, area: null, volume: null },
      },
    ]
    const tree = buildBoqTree(longCategoryDetails)
    const workbook = await buildBoqWorkbook(tree, () => false, meta)
    const sheetNames = workbook.worksheets.map((s) => s.name)
    for (const name of sheetNames) {
      expect(name.length).toBeLessThanOrEqual(31)
      expect(name).not.toMatch(/[:\\/?*[\]]/)
    }
  })
})
