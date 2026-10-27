import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMergeIndex, expandRangeToMerges } from '../src/merge-index.js'
import { cellSelection, clampSelection, rangeCellCount, reduceSelection, selectionRange } from '../src/selection.js'

// A 10 × 6 grid; filled cells are listed, B2:C3 is merged.
function grid({ filled = [], merges = [], hiddenRows = [], hiddenColumns = [] } = {}) {
  const set = new Set(filled)
  return {
    rowCount: 10,
    columnCount: 6,
    pageRows: 4,
    isEmpty: (r, c) => !set.has(`${r},${c}`),
    merges: createMergeIndex(merges),
    isRowHidden: (r) => hiddenRows.includes(r),
    isColumnHidden: (c) => hiddenColumns.includes(c)
  }
}
const at = (selection) => [selection.active.r, selection.active.c]
const corner = (selection) => [selection.corner.r, selection.corner.c]
const run = (start, actions, context = grid()) => actions.reduce((s, action) => reduceSelection(s, action, context), start)

test('arrows move and stop at the edges', () => {
  const g = grid()
  assert.deepEqual(at(run(cellSelection(0, 0), [{ type: 'move', dr: -1 }, { type: 'move', dc: -1 }], g)), [0, 0])
  assert.deepEqual(at(run(cellSelection(0, 0), [{ type: 'move', dr: 1 }, { type: 'move', dc: 1 }], g)), [1, 1])
  assert.deepEqual(at(run(cellSelection(9, 5), [{ type: 'move', dr: 1 }, { type: 'move', dc: 1 }], g)), [9, 5])
})

test('shift extends from the corner and keeps the active cell', () => {
  const s = run(cellSelection(2, 2), [{ type: 'move', dr: 1, extend: true }, { type: 'move', dc: 2, extend: true }])
  assert.deepEqual(at(s), [2, 2])
  assert.deepEqual(corner(s), [3, 4])
  assert.deepEqual(selectionRange(s), { r0: 2, c0: 2, r1: 3, c1: 4 })
  assert.equal(rangeCellCount(selectionRange(s)), 6)
  assert.deepEqual(at(reduceSelection(s, { type: 'move', dr: 1 }, grid())), [3, 2], 'a plain arrow collapses')
})

test('page, home, end and sheet jumps', () => {
  const g = grid({ filled: ['3,0', '3,3'] })
  assert.deepEqual(at(run(cellSelection(0, 2), [{ type: 'page', dr: 1 }], g)), [4, 2])
  assert.deepEqual(at(run(cellSelection(8, 2), [{ type: 'page', dr: 1 }], g)), [9, 2])
  assert.deepEqual(at(run(cellSelection(3, 2), [{ type: 'rowStart' }], g)), [3, 0])
  assert.deepEqual(at(run(cellSelection(3, 1), [{ type: 'rowEnd' }], g)), [3, 3])
  assert.deepEqual(at(run(cellSelection(5, 1), [{ type: 'rowEnd' }], g)), [5, 5])
  assert.deepEqual(at(run(cellSelection(5, 1), [{ type: 'sheetEnd' }], g)), [9, 5])
  assert.deepEqual(at(run(cellSelection(5, 1), [{ type: 'sheetStart' }], g)), [0, 0])
})

test('Ctrl+arrow jumps to the data edge like Excel', () => {
  const g = grid({ filled: ['0,0', '1,0', '2,0', '6,0', '7,0'] })
  const down = { type: 'move', dr: 1, toEdge: true }
  assert.deepEqual(at(run(cellSelection(0, 0), [down], g)), [2, 0], 'end of the run')
  assert.deepEqual(at(run(cellSelection(2, 0), [down], g)), [6, 0], 'next filled cell')
  assert.deepEqual(at(run(cellSelection(7, 0), [down], g)), [9, 0], 'sheet edge')
  assert.deepEqual(at(run(cellSelection(9, 0), [{ type: 'move', dr: -1, toEdge: true }], g)), [7, 0])
  assert.deepEqual(at(run(cellSelection(0, 1), [{ type: 'move', dc: 1, toEdge: true }], g)), [0, 5])
})

test('merges: entering lands on the anchor, leaving uses the far edge, ranges cover them', () => {
  const merges = [{ s: { r: 1, c: 1 }, e: { r: 2, c: 2 } }]
  const g = grid({ merges })
  assert.deepEqual(at(run(cellSelection(2, 0), [{ type: 'move', dc: 1 }], g)), [1, 1])
  assert.deepEqual(at(run(cellSelection(1, 1), [{ type: 'move', dc: 1 }], g)), [1, 3])
  assert.deepEqual(at(run(cellSelection(1, 1), [{ type: 'move', dr: 1 }], g)), [3, 1])
  assert.deepEqual(at(run(cellSelection(0, 0), [{ type: 'cell', r: 2, c: 2 }], g)), [1, 1])
  const s = run(cellSelection(0, 0), [{ type: 'move', dr: 2, extend: true }], g)
  assert.deepEqual(selectionRange(s), { r0: 0, c0: 0, r1: 2, c1: 0 })
  assert.deepEqual(selectionRange(s, g.merges), { r0: 0, c0: 0, r1: 2, c1: 0 })
  const t = run(cellSelection(0, 0), [{ type: 'cell', r: 1, c: 1, extend: true }], g)
  assert.deepEqual(selectionRange(t, g.merges), { r0: 0, c0: 0, r1: 2, c1: 2 })
})

test('hidden rows and columns are skipped', () => {
  const g = grid({ hiddenRows: [1, 2], hiddenColumns: [1] })
  assert.deepEqual(at(run(cellSelection(0, 0), [{ type: 'move', dr: 1 }], g)), [3, 0])
  assert.deepEqual(at(run(cellSelection(0, 0), [{ type: 'move', dc: 1 }], g)), [0, 2])
  assert.deepEqual(at(run(cellSelection(3, 2), [{ type: 'move', dc: -1 }], g)), [3, 0])
})

test('rows, columns and all', () => {
  const g = grid()
  const row = run(cellSelection(0, 0), [{ type: 'row', r: 4 }], g)
  assert.deepEqual(selectionRange(row), { r0: 4, c0: 0, r1: 4, c1: 5 })
  const rows = reduceSelection(row, { type: 'row', r: 6, extend: true }, g)
  assert.deepEqual(selectionRange(rows), { r0: 4, c0: 0, r1: 6, c1: 5 })
  const column = run(cellSelection(0, 0), [{ type: 'column', c: 2 }], g)
  assert.deepEqual(selectionRange(column), { r0: 0, c0: 2, r1: 9, c1: 2 })
  assert.deepEqual(selectionRange(run(cellSelection(3, 3), [{ type: 'all' }], g)), { r0: 0, c0: 0, r1: 9, c1: 5 })
})

test('Tab and Enter move, or walk a multi-cell selection', () => {
  const g = grid()
  assert.deepEqual(at(run(cellSelection(1, 1), [{ type: 'cycle', across: true }], g)), [1, 2])
  assert.deepEqual(at(run(cellSelection(1, 1), [{ type: 'cycle', across: false, back: true }], g)), [0, 1])
  let s = { active: { r: 0, c: 0 }, anchor: { r: 0, c: 0 }, corner: { r: 1, c: 1 } }
  const order = []
  for (let i = 0; i < 5; i++) {
    order.push(at(s))
    s = reduceSelection(s, { type: 'cycle', across: true }, g)
  }
  assert.deepEqual(order, [[0, 0], [0, 1], [1, 0], [1, 1], [0, 0]])
  assert.deepEqual(corner(s), [1, 1], 'the range stays selected')
  s = reduceSelection({ active: { r: 0, c: 0 }, anchor: { r: 0, c: 0 }, corner: { r: 1, c: 1 } }, { type: 'cycle', across: false, back: true }, g)
  assert.deepEqual(at(s), [1, 1])
})

test('clamps a remembered selection to a smaller sheet', () => {
  const s = { active: { r: 50, c: 2 }, anchor: { r: 50, c: 2 }, corner: { r: 60, c: 9 } }
  assert.deepEqual(clampSelection(s, 20, 5), { active: { r: 19, c: 2 }, anchor: { r: 19, c: 2 }, corner: { r: 19, c: 4 } })
  assert.equal(clampSelection(s, 0, 0), null)
})

test('merge index finds merges by cell and window', () => {
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 60, c: 1 }, e: { r: 200, c: 1 } }
  ]
  const index = createMergeIndex(merges)
  assert.equal(index.at(0, 2), merges[0])
  assert.equal(index.at(150, 1), merges[1])
  assert.equal(index.at(150, 2), null)
  assert.deepEqual(index.inWindow(100, 120, 0, 5), [merges[1]])
  assert.deepEqual(index.inWindow(0, 300, 0, 5).length, 2)
  assert.deepEqual(index.inWindow(1, 59, 0, 5), [])
  assert.deepEqual(expandRangeToMerges({ r0: 0, c0: 1, r1: 61, c1: 1 }, index), { r0: 0, c0: 0, r1: 200, c1: 3 })
})
