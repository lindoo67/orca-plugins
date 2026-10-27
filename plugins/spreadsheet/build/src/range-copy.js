import { cellText, numericValue } from './cell-display.js'

/**
 * The selected cells as Excel puts them on the clipboard: tab-separated formatted text, one line per
 * row, with cells covered by a merge left empty.
 * @param {{ r0: number, c0: number, r1: number, c1: number }} range
 * @param {(r: number, c: number) => object | undefined} getCell
 * @param {{ at: (r: number, c: number) => object | null }} merges
 */
export function rangeToTsv(range, getCell, merges) {
  const lines = []
  for (let r = range.r0; r <= range.r1; r++) {
    const fields = []
    for (let c = range.c0; c <= range.c1; c++) fields.push(tsvField(visibleText(r, c, getCell, merges)))
    lines.push(fields.join('\t'))
  }
  return lines.join('\n')
}

/** The same cells as an HTML table, so rich-text targets keep rows, columns and merges. */
export function rangeToHtml(range, getCell, merges) {
  const rows = []
  for (let r = range.r0; r <= range.r1; r++) {
    let row = '<tr>'
    for (let c = range.c0; c <= range.c1; c++) {
      const merge = merges.at(r, c)
      let span = ''
      if (merge) {
        // A merge clipped by the range is drawn once, from its first visible cell.
        const top = Math.max(merge.s.r, range.r0)
        const left = Math.max(merge.s.c, range.c0)
        if (r !== top || c !== left) continue
        const rowSpan = Math.min(merge.e.r, range.r1) - top + 1
        const columnSpan = Math.min(merge.e.c, range.c1) - left + 1
        if (rowSpan > 1) span += ` rowspan="${rowSpan}"`
        if (columnSpan > 1) span += ` colspan="${columnSpan}"`
      }
      const text = cellText(getCell(merge ? merge.s.r : r, merge ? merge.s.c : c))
      row += `<td${span}>${escapeHtml(text)}</td>`
    }
    rows.push(`${row}</tr>`)
  }
  return `<table>${rows.join('')}</table>`
}

function visibleText(r, c, getCell, merges) {
  const merge = merges.at(r, c)
  if (merge && (merge.s.r !== r || merge.s.c !== c)) return ''
  return cellText(getCell(r, c))
}

function tsvField(text) {
  return /[\t\n\r"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
}

/** Excel's status bar numbers for a selection: filled cells, and the sum and average of numbers. */
export function selectionStats(range, rows) {
  let count = 0
  let numericCount = 0
  let sum = 0
  const lastRow = Math.min(range.r1, rows.length - 1)
  for (let r = range.r0; r <= lastRow; r++) {
    const row = rows[r]
    if (!row) continue
    const lastColumn = Math.min(range.c1, row.length - 1)
    for (let c = range.c0; c <= lastColumn; c++) {
      const cell = row[c]
      if (!cell || cellText(cell) === '') continue
      count++
      const value = numericValue(cell)
      if (value !== null) {
        numericCount++
        sum += value
      }
    }
  }
  return { count, numericCount, sum, average: numericCount > 0 ? sum / numericCount : null }
}
