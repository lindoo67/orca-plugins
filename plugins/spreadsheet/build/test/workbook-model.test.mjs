import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { createAxis } from '../src/axis.js'
import {
  buildSheetModel,
  buildWorkbookModel,
  computeColumnWidths,
  computeRowHeights,
  declaredColumnWidth,
  declaredRowHeight,
  DEFAULT_ROW_HEIGHT,
  MAX_AUTO_COLUMN_WIDTH,
  MIN_AUTO_COLUMN_WIDTH,
  sampleRowIndexes
} from '../src/workbook-model.js'

const charMeasure = (text) => text.length * 7
const denseSheet = (aoa, extra = {}) => Object.assign(XLSX.utils.aoa_to_sheet(aoa, { dense: true }), extra)

test('leaves hidden sheets out and counts them', () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, denseSheet([[1]]), 'Shown')
  XLSX.utils.book_append_sheet(wb, denseSheet([[2]]), 'Hidden')
  XLSX.utils.book_append_sheet(wb, denseSheet([[3]]), 'VeryHidden')
  wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }, { Hidden: 2 }] }
  const model = buildWorkbookModel(wb)
  assert.deepEqual(model.sheets.map((sheet) => sheet.name), ['Shown'])
  assert.equal(model.hiddenCount, 2)
})

test('measures the used extent, not the declared range', () => {
  const sheet = buildSheetModel('S', denseSheet([[1, null, 3], [], [null, 'x']], { '!ref': 'A1:Z1000' }))
  assert.equal(sheet.rowCount, 3)
  assert.equal(sheet.columnCount, 3)
  assert.equal(buildSheetModel('E', {}).rowCount, 0)
  const merged = buildSheetModel('M', denseSheet([['a']], { '!merges': [{ s: { r: 0, c: 0 }, e: { r: 4, c: 3 } }] }))
  assert.deepEqual([merged.rowCount, merged.columnCount], [5, 4])
})

test('reads sparse sheets too', () => {
  const sheet = buildSheetModel('S', { '!ref': 'A1:B3', A1: { t: 's', v: 'a' }, B3: { t: 'n', v: 2 } })
  assert.equal(sheet.data[2][1].v, 2)
  assert.deepEqual([sheet.rowCount, sheet.columnCount], [3, 2])
})

test('drops malformed and single-cell merges', () => {
  const sheet = buildSheetModel('S', denseSheet([['a']], { '!merges': [{ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }, { s: { r: 2, c: 0 } }, null] }))
  assert.deepEqual(sheet.merges, [])
})

test('flags chart sheets', () => {
  assert.equal(buildSheetModel('C', { '!type': 'chart' }).kind, 'chart')
})

test('declared widths and heights win', () => {
  assert.equal(declaredColumnWidth({ wpx: 101.4 }), 101)
  assert.equal(declaredColumnWidth({ wch: 10 }), 75)
  assert.equal(declaredColumnWidth({ width: 10 }), 70)
  assert.equal(declaredColumnWidth({ hidden: true, wpx: 50 }), 0)
  assert.equal(declaredColumnWidth({}), null)
  assert.equal(declaredRowHeight({ hpx: 30 }), 30)
  assert.equal(declaredRowHeight({ hpt: 15 }), 20)
  assert.equal(declaredRowHeight({ hidden: true }), 0)
  assert.equal(declaredRowHeight(undefined), null)
})

test('fits undeclared columns to content, within limits', () => {
  const sheet = buildSheetModel('S', denseSheet([['id', 'a long label here', 'x'.repeat(400), null], [1, 2, 3, 'y']], { '!cols': [{ wpx: 30 }] }))
  const widths = computeColumnWidths(sheet, charMeasure)
  assert.equal(widths[0], 30)
  assert.equal(widths[1], 17 * 7 + 16)
  assert.equal(widths[2], MAX_AUTO_COLUMN_WIDTH)
  assert.equal(widths[3], MIN_AUTO_COLUMN_WIDTH)
})

test('merged text does not widen its first column', () => {
  const sheet = buildSheetModel('S', denseSheet([['A very long merged title'], [1]], { '!merges': [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }] }))
  assert.equal(computeColumnWidths(sheet, charMeasure)[0], MIN_AUTO_COLUMN_WIDTH)
})

test('samples the head and a spread of large sheets', () => {
  assert.deepEqual(sampleRowIndexes(3), [0, 1, 2])
  const rows = sampleRowIndexes(50_000)
  assert.equal(rows.length, 300)
  assert.ok(rows.at(-1) > 49_000)
  assert.deepEqual(rows, [...rows].sort((a, b) => a - b))
})

test('row heights default and follow !rows', () => {
  const sheet = buildSheetModel('S', denseSheet([[1], [2], [3]], { '!rows': [{ hpx: 40 }, { hidden: true }] }))
  assert.deepEqual([...computeRowHeights(sheet)], [40, 0, DEFAULT_ROW_HEIGHT])
})

test('axis finds positions, skipping hidden entries', () => {
  const axis = createAxis([10, 0, 20, 30])
  assert.equal(axis.total, 60)
  assert.deepEqual([0, 9, 10, 29, 30, 59, 100, -5].map(axis.indexAt), [0, 0, 2, 2, 3, 3, 3, 0])
  assert.equal(axis.start(3), 30)
  assert.equal(axis.end(3), 60)
  assert.equal(axis.isHidden(1), true)
  assert.equal(createAxis([]).indexAt(5), -1)
})
