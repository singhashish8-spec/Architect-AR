import type { BoqCategoryGroup, BoqDisciplineGroup } from './boqData'
import { boqCategoryKey } from './boqData'
import type { BoqElementDetail } from '../ifc/ifcBoqDetails'
import { getCategoryMetrics, METRIC_LABEL, METRIC_ORDER, METRIC_UNIT, SUMMABLE_METRICS, type QuantityMetric } from './boqQuantityProfiles'

// exceljs is only ever needed at the moment someone actually clicks
// "Export Excel" -- a plain top-level `import` would put its ~75 npm
// dependencies' worth of code in this app's main bundle for every
// visitor, even the ones who never export anything. `import('exceljs')`
// inside buildAndDownloadBoqExcel() below keeps it in its own
// Vite-generated chunk, fetched only on demand. These two type-only
// aliases give this whole module real types for that library without
// forcing a static (eager) import anywhere -- `import type` and
// `typeof import(...)` are erased entirely at compile time.
type ExcelJSModule = typeof import('exceljs')
type Workbook = InstanceType<ExcelJSModule['Workbook']>
type Worksheet = ReturnType<Workbook['addWorksheet']>

// One accent per discipline -- used for each category sheet's header
// row fill, its Excel tab color, and the Summary sheet's own
// discipline-grouped rows, so a client flipping between tabs gets a
// consistent color cue for "this is a Structure sheet" the same way
// architectural drawing sets color-code discipline sheets.
const DISCIPLINE_COLORS: Record<string, { header: string; band: string; tab: string }> = {
  Architecture: { header: 'FF1F4E79', band: 'FFDCE6F1', tab: 'FF1F4E79' },
  Structure: { header: 'FF7B4B1A', band: 'FFF0E1D0', tab: 'FF7B4B1A' },
  MEP: { header: 'FF1E6B52', band: 'FFDCEEE6', tab: 'FF1E6B52' },
}
const DEFAULT_COLORS = { header: 'FF3A3A3A', band: 'FFE6E6E6', tab: 'FF3A3A3A' }

function disciplineColors(discipline: string) {
  return DISCIPLINE_COLORS[discipline] ?? DEFAULT_COLORS
}

function metricDecimals(metric: QuantityMetric): string {
  return metric === 'volume' ? '0.000' : '0.00'
}

// Excel worksheet names: max 31 characters, and none of : \ / ? * [ ]
// -- a real category name ("Cable trays & conduit") can exceed that, so
// this both strips the disallowed characters and truncates, then
// disambiguates against any name already used in this workbook (in
// practice two categories only collide after truncation on a very long,
// very similar pair of names -- rare, but silently overwriting one
// sheet with another would be worse than an ugly suffix).
function sheetName(base: string, used: Set<string>): string {
  const cleaned = base.replace(/[:\\/?*[\]]/g, '-').trim().slice(0, 31) || 'Sheet'
  let candidate = cleaned
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`
    candidate = cleaned.slice(0, 31 - suffix.length) + suffix
    n += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function formatNumberCell(value: number | null): number | string {
  return value === null ? '—' : value
}

// The same title block (company, project, model, generated-on date) at
// the top of every sheet, Summary included -- a client opening any tab
// in isolation (e.g. printed separately) still sees whose takeoff it is.
function writeTitleBlock(sheet: Worksheet, columnCount: number, heading: string, meta: BoqExcelMeta) {
  const lastCol = Math.max(2, columnCount)
  sheet.mergeCells(1, 1, 1, lastCol)
  const companyCell = sheet.getCell(1, 1)
  companyCell.value = meta.companyName || 'Architect AR'
  companyCell.font = { bold: true, size: 13, color: { argb: 'FF1F1F1F' } }

  sheet.mergeCells(2, 1, 2, lastCol)
  const projectCell = sheet.getCell(2, 1)
  projectCell.value = meta.projectName
  projectCell.font = { bold: true, size: 18, color: { argb: 'FF1F1F1F' } }

  sheet.mergeCells(3, 1, 3, lastCol)
  const subCell = sheet.getCell(3, 1)
  subCell.value = `${heading} — ${meta.modelName} — generated ${meta.generatedOn}`
  subCell.font = { italic: true, size: 10, color: { argb: 'FF6B6B6B' } }

  sheet.getRow(1).height = 22
  sheet.getRow(2).height = 26
  sheet.getRow(4).height = 6
}

export interface BoqExcelMeta {
  projectName: string
  companyName: string
  modelName: string
  generatedOn: string
}

// Writes one category's dedicated worksheet -- mirrors exactly what's
// on screen for that category at export time: the same metric columns
// (utils/boqQuantityProfiles.ts) and the same flat-vs-grouped-by-level
// layout the owner's own per-category toggle in BoqContent.tsx is
// currently set to (owner's own ask, 2026-08-11: "whatever the final
// changes is seen after all those toggle for each element... the
// export will look same").
function writeCategorySheet(
  workbook: Workbook,
  discipline: string,
  category: BoqCategoryGroup,
  grouped: boolean,
  meta: BoqExcelMeta,
  usedNames: Set<string>,
) {
  const colors = disciplineColors(discipline)
  const metrics = METRIC_ORDER.filter((metric) => getCategoryMetrics(category.category).includes(metric))
  const sheet = workbook.addWorksheet(sheetName(category.category, usedNames), {
    properties: { tabColor: { argb: colors.tab } },
  })

  const columns = [
    { header: 'No.', width: 6 },
    { header: 'Name', width: 34 },
    ...(grouped ? [] : [{ header: 'Level', width: 16 }]),
    { header: 'Material', width: 32 },
    ...metrics.map((metric) => ({ header: `${METRIC_LABEL[metric]} (${METRIC_UNIT[metric]})`, width: 13 })),
  ]
  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width
  })

  writeTitleBlock(sheet, columns.length, `${category.category} Schedule`, meta)

  const headerRowIndex = 5
  const headerRow = sheet.getRow(headerRowIndex)
  headerRow.values = columns.map((c) => c.header)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.header } }
    cell.alignment = { vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } } }
  })
  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }]

  let rowCursor = headerRowIndex + 1
  let dataRowCount = 0

  function writeElementRow(element: BoqElementDetail, index: number) {
    const row = sheet.getRow(rowCursor)
    const values: (string | number)[] = [
      index,
      element.name,
      ...(grouped ? [] : [element.level ?? '—']),
      element.materials.length > 0 ? element.materials.join(', ') : '—',
    ]
    for (const metric of metrics) values.push(formatNumberCell(element.quantities[metric]))
    row.values = values

    const metricStartCol = grouped ? 3 : 4
    metrics.forEach((metric, i) => {
      const cell = row.getCell(metricStartCol + i)
      if (typeof cell.value === 'number') cell.numFmt = metricDecimals(metric)
      cell.alignment = { horizontal: 'right' }
    })
    if (dataRowCount % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
      })
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } }
    })
    rowCursor += 1
    dataRowCount += 1
  }

  if (grouped) {
    for (const levelGroup of category.levels) {
      const bandRow = sheet.getRow(rowCursor)
      sheet.mergeCells(rowCursor, 1, rowCursor, columns.length)
      const bandCell = bandRow.getCell(1)
      bandCell.value = `${levelGroup.level}  (${levelGroup.count})`
      bandCell.font = { bold: true, color: { argb: 'FF1F1F1F' } }
      bandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.band } }
      rowCursor += 1
      dataRowCount = 0
      levelGroup.elements.forEach((element, i) => writeElementRow(element, i + 1))
    }
  } else {
    category.levels.flatMap((l) => l.elements).forEach((element, i) => writeElementRow(element, i + 1))
  }

  const totalsRow = sheet.getRow(rowCursor)
  totalsRow.getCell(2).value = `Total (${category.count})`
  totalsRow.getCell(2).font = { bold: true }
  const metricStartCol = grouped ? 3 : 4
  const totalsByMetric: Partial<Record<QuantityMetric, number | null>> = {
    length: category.totalLength,
    area: category.totalArea,
    volume: category.totalVolume,
  }
  metrics.forEach((metric, i) => {
    const cell = totalsRow.getCell(metricStartCol + i)
    if (SUMMABLE_METRICS.includes(metric)) {
      cell.value = formatNumberCell(totalsByMetric[metric] ?? null)
      if (typeof cell.value === 'number') cell.numFmt = metricDecimals(metric)
      cell.font = { bold: true }
      cell.alignment = { horizontal: 'right' }
    }
  })
  totalsRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { top: { style: 'medium', color: { argb: colors.header } } }
  })
}

function writeSummarySheet(workbook: Workbook, tree: BoqDisciplineGroup[], meta: BoqExcelMeta, usedNames: Set<string>) {
  const sheet = workbook.addWorksheet(sheetName('Summary', usedNames), {
    properties: { tabColor: { argb: 'FF1F1F1F' } },
  })
  const columns = [
    { header: 'Discipline', width: 16 },
    { header: 'Category', width: 30 },
    { header: 'Count', width: 10 },
    { header: 'Length (m)', width: 14 },
    { header: 'Area (m²)', width: 14 },
    { header: 'Volume (m³)', width: 14 },
  ]
  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width
  })
  writeTitleBlock(sheet, columns.length, 'Quantity Takeoff — Summary', meta)

  const headerRowIndex = 5
  const headerRow = sheet.getRow(headerRowIndex)
  headerRow.values = columns.map((c) => c.header)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1F1F' } }
  })
  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }]

  let rowCursor = headerRowIndex + 1
  let grandCount = 0
  let grandLength = 0
  let grandArea = 0
  let grandVolume = 0
  let sawLength = false
  let sawArea = false
  let sawVolume = false

  for (const discipline of tree) {
    const colors = disciplineColors(discipline.discipline)
    for (const category of discipline.categories) {
      const row = sheet.getRow(rowCursor)
      row.values = [
        discipline.discipline,
        category.category,
        category.count,
        formatNumberCell(category.totalLength),
        formatNumberCell(category.totalArea),
        formatNumberCell(category.totalVolume),
      ]
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.band } }
      ;[4, 5, 6].forEach((col) => {
        const cell = row.getCell(col)
        cell.alignment = { horizontal: 'right' }
        if (typeof cell.value === 'number') cell.numFmt = col === 6 ? '0.000' : '0.00'
      })
      grandCount += category.count
      if (category.totalLength !== null) {
        grandLength += category.totalLength
        sawLength = true
      }
      if (category.totalArea !== null) {
        grandArea += category.totalArea
        sawArea = true
      }
      if (category.totalVolume !== null) {
        grandVolume += category.totalVolume
        sawVolume = true
      }
      rowCursor += 1
    }
  }

  const totalsRow = sheet.getRow(rowCursor)
  totalsRow.values = [
    'Grand total',
    '',
    grandCount,
    sawLength ? grandLength : '—',
    sawArea ? grandArea : '—',
    sawVolume ? grandVolume : '—',
  ]
  totalsRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.border = { top: { style: 'medium', color: { argb: 'FF1F1F1F' } } }
  })
  ;[4, 5, 6].forEach((col) => {
    const cell = totalsRow.getCell(col)
    cell.alignment = { horizontal: 'right' }
    if (typeof cell.value === 'number') cell.numFmt = col === 6 ? '0.000' : '0.00'
  })
}

function triggerDownload(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

// Builds a client-ready workbook: a Summary sheet (title block + every
// category's totals, color-banded by discipline) followed by one
// dedicated worksheet per category -- the owner's own ask, 2026-08-11:
// "make the excel very much formatted with project name company name on
// the top every element will be in different worksheet.. very well
// formated color coded redy to present as client will be reviewing
// that". `groupedByCategory` mirrors the on-screen per-category "Group
// by level" toggle so the export always matches whatever's currently
// showing, not just one fixed layout. Split out from
// buildAndDownloadBoqExcel() below so tests can inspect the resulting
// ExcelJS.Workbook directly instead of having to intercept a Blob
// download.
export async function buildBoqWorkbook(
  tree: BoqDisciplineGroup[],
  groupedByCategory: (categoryKey: string) => boolean,
  meta: BoqExcelMeta,
): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = meta.companyName || 'Architect AR'
  workbook.created = new Date()

  const usedNames = new Set<string>()
  writeSummarySheet(workbook, tree, meta, usedNames)

  for (const discipline of tree) {
    for (const category of discipline.categories) {
      const grouped = groupedByCategory(boqCategoryKey(discipline.discipline, category.category))
      writeCategorySheet(workbook, discipline.discipline, category, grouped, meta, usedNames)
    }
  }

  return workbook
}

export async function buildAndDownloadBoqExcel(
  tree: BoqDisciplineGroup[],
  groupedByCategory: (categoryKey: string) => boolean,
  meta: BoqExcelMeta,
  fileName: string,
): Promise<void> {
  const workbook = await buildBoqWorkbook(tree, groupedByCategory, meta)
  const buffer = await workbook.xlsx.writeBuffer()
  triggerDownload(buffer, fileName)
}
