// Display rules for SheetJS cells: `.w` is the text Excel shows (after the number format), `.v`
// the stored value and `.f` the formula, whose result in the grid is the value saved in the file.

const ERROR_TEXT = { 0: '#NULL!', 7: '#DIV/0!', 15: '#VALUE!', 23: '#REF!', 29: '#NAME?', 36: '#NUM!', 42: '#N/A', 43: '#GETTING_DATA' }

export function isEmptyCell(cell) {
  return !cell || cell.t === 'z' || (cell.v == null && cell.w == null && !cell.f)
}

/** @returns {'number' | 'text' | 'boolean' | 'error' | 'empty'} */
export function cellKind(cell) {
  if (isEmptyCell(cell)) return 'empty'
  switch (cell.t) {
    case 'n':
    case 'd':
      return 'number'
    case 'b':
      return 'boolean'
    case 'e':
      return 'error'
    default:
      return 'text'
  }
}

export function cellText(cell) {
  if (isEmptyCell(cell)) return ''
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE'
  if (cell.t === 'e') return cell.w ?? ERROR_TEXT[cell.v] ?? '#ERROR!'
  if (cell.w != null) return String(cell.w)
  if (cell.v == null) return ''
  return cell.v instanceof Date ? cell.v.toISOString() : String(cell.v)
}

export function cellFormula(cell) {
  if (!cell || typeof cell.f !== 'string' || cell.f === '') return null
  // Why: SheetJS leaves some OpenDocument references, like [.$B3:.$B$6], in their ODF form.
  const f = cell.f.replace(/\[\.(\$?[A-Z]+\$?\d+)(?::\.(\$?[A-Z]+\$?\d+))?\]/g, (_, a, b) => (b ? `${a}:${b}` : a))
  // Array formulas are shown in braces, as Excel's formula bar does.
  return cell.F ? `{=${f}}` : `=${f}`
}

/** The stored value when it reads differently from the formatted text, e.g. 0.125 behind 12.5%. */
export function cellRawValue(cell) {
  if (!cell || cell.t !== 'n' || typeof cell.v !== 'number') return null
  const raw = String(cell.v)
  return raw === cellText(cell) ? null : raw
}

export function numericValue(cell) {
  return cell && cell.t === 'n' && typeof cell.v === 'number' && Number.isFinite(cell.v) ? cell.v : null
}
