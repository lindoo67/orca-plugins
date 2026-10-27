import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { classifyReadError, openWorkbook, sniffContainer } from '../src/open-workbook.js'

const bytes = (...values) => new Uint8Array(values)
const text = (value) => new Uint8Array(Buffer.from(value))

test('sniffs containers from magic bytes', () => {
  assert.equal(sniffContainer(bytes(0x50, 0x4b, 3, 4, 0)), 'zip')
  assert.equal(sniffContainer(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1)), 'cfb')
  assert.equal(sniffContainer(bytes(0x09, 0x08, 0x10, 0)), 'biff')
  assert.equal(sniffContainer(text('﻿  <?xml version="1.0"?><Workbook>')), 'markup')
  assert.equal(sniffContainer(text('<table><tr><td>1</td></tr></table>')), 'markup')
  assert.equal(sniffContainer(text('a,b,c\n1,2,3')), 'unknown')
  assert.equal(sniffContainer(bytes()), 'unknown')
})

test('classifies password and encryption errors', () => {
  assert.equal(classifyReadError(new Error('File is password-protected')), 'encrypted')
  assert.equal(classifyReadError(new Error('Unsupported ODS Encryption')), 'encrypted')
  assert.equal(classifyReadError('ECMA-376 Encrypted file missing /EncryptionInfo'), 'encrypted')
  assert.equal(classifyReadError(new Error('Bad range (0): A1:')), 'corrupt')
  assert.equal(classifyReadError(undefined), 'corrupt')
})

test('opens every supported format', () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a', 1]]), 'One')
  for (const bookType of ['xlsx', 'xlsm', 'xlsb', 'biff8', 'ods']) {
    const result = openWorkbook(XLSX, new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType })))
    assert.equal(result.status, 'ok', bookType)
    assert.deepEqual(result.workbook.SheetNames, ['One'], bookType)
  }
})

test('refuses text that SheetJS would read as CSV', () => {
  assert.deepEqual(openWorkbook(XLSX, text('hello, world')), { status: 'corrupt' })
})

test('reports a truncated zip as corrupt and an encrypted package as encrypted', () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a']]), 'One')
  const zip = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  assert.deepEqual(openWorkbook(XLSX, new Uint8Array(zip.subarray(0, 200))), { status: 'corrupt' })

  const cfb = XLSX.CFB.utils.cfb_new()
  XLSX.CFB.utils.cfb_add(cfb, '/EncryptionInfo', Buffer.from([4, 0, 4, 0, 0x40, 0, 0, 0, ...Buffer.from('<encryption/>')]))
  XLSX.CFB.utils.cfb_add(cfb, '/EncryptedPackage', Buffer.alloc(64))
  assert.deepEqual(openWorkbook(XLSX, new Uint8Array(XLSX.CFB.write(cfb, { type: 'buffer' }))), { status: 'encrypted' })
})

test('does not freeze or share options between reads', () => {
  const calls = []
  const fake = { read: (_, options) => (calls.push(options), { SheetNames: [], Sheets: {} }) }
  openWorkbook(fake, text('<table></table>'))
  openWorkbook(fake, text('<table></table>'))
  assert.notEqual(calls[0], calls[1])
  assert.equal(calls[0].dense, true)
  assert.equal(calls[0].cellFormula, true)
})
