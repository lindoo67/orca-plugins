/** Zero-based column index to its letters: 0 → A, 26 → AA. */
export function columnName(column) {
  let name = ''
  for (let n = column + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  }
  return name
}

export function cellAddress(row, column) {
  return `${columnName(column)}${row + 1}`
}

export function rangeAddress({ r0, c0, r1, c1 }) {
  const start = cellAddress(r0, c0)
  return r0 === r1 && c0 === c1 ? start : `${start}:${cellAddress(r1, c1)}`
}
