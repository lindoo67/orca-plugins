import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { checkOfficeZipBudget, OFFICE_ZIP_MAX_ENTRIES, OFFICE_ZIP_MAX_UNCOMPRESSED_BYTES } from '../src/zip-budget.js'

/** A zip holding only a central directory, with the given declared sizes. */
function zipWithEntries(sizes, { comment = 0 } = {}) {
  const entries = sizes.map((size, index) => {
    const name = Buffer.from(`f${index}`)
    const entry = Buffer.alloc(46 + name.length)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt32LE(size, 24)
    entry.writeUInt16LE(name.length, 28)
    name.copy(entry, 46)
    return entry
  })
  const directory = Buffer.concat(entries)
  const end = Buffer.alloc(22 + comment)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(sizes.length, 10)
  end.writeUInt32LE(4, 16)
  end.writeUInt16LE(comment, 20)
  return new Uint8Array(Buffer.concat([Buffer.from('PK\x03\x04'), directory, end]))
}

test('accepts a real workbook', () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[1, 2]]), 'Sheet1')
  assert.equal(checkOfficeZipBudget(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true })), 'ok')
})

test('sums declared sizes against the budget', () => {
  assert.equal(checkOfficeZipBudget(zipWithEntries([1000, 2000])), 'ok')
  assert.equal(checkOfficeZipBudget(zipWithEntries([OFFICE_ZIP_MAX_UNCOMPRESSED_BYTES])), 'ok')
  assert.equal(checkOfficeZipBudget(zipWithEntries([OFFICE_ZIP_MAX_UNCOMPRESSED_BYTES, 1])), 'too-large')
  assert.equal(checkOfficeZipBudget(zipWithEntries([0xffffffff])), 'too-large')
})

test('refuses too many entries', () => {
  assert.equal(checkOfficeZipBudget(zipWithEntries(new Array(OFFICE_ZIP_MAX_ENTRIES).fill(1))), 'ok')
  assert.equal(checkOfficeZipBudget(zipWithEntries(new Array(OFFICE_ZIP_MAX_ENTRIES + 1).fill(1))), 'too-large')
})

test('finds the end record behind a comment', () => {
  assert.equal(checkOfficeZipBudget(zipWithEntries([10], { comment: 300 })), 'ok')
})

test('calls truncated or malformed directories corrupt', () => {
  assert.equal(checkOfficeZipBudget(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])), 'corrupt')
  const zip = zipWithEntries([10, 10])
  zip[4] = 0
  assert.equal(checkOfficeZipBudget(zip), 'corrupt')
  const short = zipWithEntries([10])
  new DataView(short.buffer).setUint32(short.byteLength - 6, 1_000_000, true)
  assert.equal(checkOfficeZipBudget(short), 'corrupt')
})
