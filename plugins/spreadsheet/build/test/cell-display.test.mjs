import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cellAddress, columnName, rangeAddress } from '../src/address.js'
import { cellFormula, cellKind, cellRawValue, cellText, isEmptyCell, numericValue } from '../src/cell-display.js'

test('names columns and cells like Excel', () => {
  assert.deepEqual([0, 25, 26, 51, 52, 701, 702, 16383].map(columnName), ['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA', 'XFD'])
  assert.equal(cellAddress(11, 1), 'B12')
  assert.equal(rangeAddress({ r0: 0, c0: 0, r1: 0, c1: 0 }), 'A1')
  assert.equal(rangeAddress({ r0: 1, c0: 1, r1: 8, c1: 3 }), 'B2:D9')
})

test('shows formatted text, booleans and errors', () => {
  assert.equal(cellText({ t: 'n', v: 0.125, w: '12.5%' }), '12.5%')
  assert.equal(cellText({ t: 'n', v: 3 }), '3')
  assert.equal(cellText({ t: 'b', v: true }), 'TRUE')
  assert.equal(cellText({ t: 'b', v: false, w: 'FALSE' }), 'FALSE')
  assert.equal(cellText({ t: 'e', v: 7 }), '#DIV/0!')
  assert.equal(cellText({ t: 'e', v: 42, w: '#N/A' }), '#N/A')
  assert.equal(cellText({ t: 's', v: 'hi', w: 'hi' }), 'hi')
  assert.equal(cellText(undefined), '')
  assert.equal(cellText({ t: 'z' }), '')
})

test('kinds decide alignment', () => {
  assert.equal(cellKind({ t: 'n', v: 1 }), 'number')
  assert.equal(cellKind({ t: 'd', v: new Date(0) }), 'number')
  assert.equal(cellKind({ t: 's', v: 'x' }), 'text')
  assert.equal(cellKind({ t: 'b', v: true }), 'boolean')
  assert.equal(cellKind({ t: 'e', v: 7 }), 'error')
  assert.equal(cellKind(null), 'empty')
  assert.equal(isEmptyCell({ t: 's' }), true)
  assert.equal(isEmptyCell({ t: 's', v: '', f: 'A1&""' }), false)
})

test('formulas carry their equals sign; array formulas their braces; ODF references are tidied', () => {
  assert.equal(cellFormula({ t: 'n', v: 1, f: 'SUM(A1:A9)' }), '=SUM(A1:A9)')
  assert.equal(cellFormula({ t: 'n', v: 1, f: 'A1*B1', F: 'C1:C3' }), '{=A1*B1}')
  assert.equal(cellFormula({ t: 'n', v: 1, f: 'B3/SUM([.$B3:.$B$6])+[.C2]' }), '=B3/SUM($B3:$B$6)+C2')
  assert.equal(cellFormula({ t: 'n', v: 1 }), null)
  assert.equal(cellFormula({ t: 'n', v: 1, f: '' }), null)
})

test('raw values only when they read differently', () => {
  assert.equal(cellRawValue({ t: 'n', v: 0.125, w: '12.5%' }), '0.125')
  assert.equal(cellRawValue({ t: 'n', v: 45292, w: '2024-01-01' }), '45292')
  assert.equal(cellRawValue({ t: 'n', v: 42, w: '42' }), null)
  assert.equal(cellRawValue({ t: 's', v: 'x', w: 'x' }), null)
  assert.equal(numericValue({ t: 'n', v: 2 }), 2)
  assert.equal(numericValue({ t: 's', v: '2' }), null)
  assert.equal(numericValue({ t: 'n', v: Infinity }), null)
})
