import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMergeIndex } from '../src/merge-index.js'
import { rangeToHtml, rangeToTsv, selectionStats } from '../src/range-copy.js'

const rows = [
  [{ t: 's', v: 'Name', w: 'Name' }, { t: 's', v: 'Amount', w: 'Amount' }, { t: 's', v: 'Note', w: 'Note' }],
  [{ t: 's', v: 'A', w: 'A' }, { t: 'n', v: 1234.5, w: '$1,234.50' }, { t: 's', v: 'tab\there', w: 'tab\there' }],
  [{ t: 's', v: 'B', w: 'B' }, { t: 'n', v: 0.25, w: '25%' }, { t: 's', v: 'say "hi"\nok', w: 'say "hi"\nok' }],
  [{ t: 'b', v: true }, { t: 'e', v: 7 }, undefined]
]
const getCell = (r, c) => rows[r]?.[c]
const none = createMergeIndex([])

test('TSV uses formatted text and quotes awkward fields', () => {
  assert.equal(
    rangeToTsv({ r0: 0, c0: 0, r1: 3, c1: 2 }, getCell, none),
    'Name\tAmount\tNote\nA\t$1,234.50\t"tab\there"\nB\t25%\t"say ""hi""\nok"\nTRUE\t#DIV/0!\t'
  )
  assert.equal(rangeToTsv({ r0: 1, c0: 1, r1: 1, c1: 1 }, getCell, none), '$1,234.50')
})

test('merged cells copy once', () => {
  const merges = createMergeIndex([{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }])
  assert.equal(rangeToTsv({ r0: 0, c0: 0, r1: 0, c1: 2 }, getCell, merges), 'Name\t\tNote')
  assert.equal(rangeToHtml({ r0: 0, c0: 0, r1: 0, c1: 2 }, getCell, merges), '<table><tr><td colspan="2">Name</td><td>Note</td></tr></table>')
  // Clipped by the range: drawn from its first visible cell, spanning what is visible.
  assert.equal(rangeToHtml({ r0: 0, c0: 1, r1: 0, c1: 2 }, getCell, merges), '<table><tr><td>Name</td><td>Note</td></tr></table>')
})

test('HTML escapes text', () => {
  const cell = { t: 's', v: '<b>&', w: '<b>&' }
  assert.equal(rangeToHtml({ r0: 0, c0: 0, r1: 0, c1: 0 }, () => cell, none), '<table><tr><td>&#60;b&#62;&#38;</td></tr></table>')
})

test('stats count filled cells and sum numbers', () => {
  assert.deepEqual(selectionStats({ r0: 0, c0: 0, r1: 3, c1: 2 }, rows), { count: 11, numericCount: 2, sum: 1234.75, average: 617.375 })
  assert.deepEqual(selectionStats({ r0: 0, c0: 0, r1: 0, c1: 0 }, rows), { count: 1, numericCount: 0, sum: 0, average: null })
  assert.deepEqual(selectionStats({ r0: 10, c0: 0, r1: 1_000_000, c1: 16_383 }, rows), { count: 0, numericCount: 0, sum: 0, average: null })
})
