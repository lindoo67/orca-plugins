// Inflates a workbook zip ourselves, counting the bytes that really come out, and hands SheetJS a
// stored (uncompressed) copy. Declared sizes can lie or be 0 (data descriptors), and SheetJS sizes
// its output from them, so only the inflated byte count is a real zip-bomb cap.
import { OFFICE_ZIP_MAX_ENTRIES, OFFICE_ZIP_MAX_UNCOMPRESSED_BYTES } from './zip-budget.js'

const LOCAL_HEADER = 0x04034b50
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50
const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const END_RECORD_BYTES = 22
const CENTRAL_ENTRY_BYTES = 46
const LOCAL_HEADER_BYTES = 30
const ZIP64_MARKER = 0xffffffff
const STORED = 0
const DEFLATED = 8

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index++) crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function findEnd(view) {
  const last = view.byteLength - END_RECORD_BYTES
  for (let offset = last; offset >= Math.max(0, last - 0xffff); offset--) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) return offset
  }
  return -1
}

class Budget extends Error {}

/** Inflates raw deflate data, failing as soon as the running total passes `remaining`. */
async function inflateCapped(compressed, remaining) {
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > remaining) {
      await reader.cancel()
      throw new Budget()
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function storedZip(entries) {
  const encoder = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBytes = encoder.encode(name)
    const crc = crc32(data)
    const local = new DataView(new ArrayBuffer(LOCAL_HEADER_BYTES))
    local.setUint32(0, LOCAL_HEADER, true)
    local.setUint16(4, 20, true)
    local.setUint16(8, STORED, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.byteLength, true)
    local.setUint32(22, data.byteLength, true)
    local.setUint16(26, nameBytes.byteLength, true)
    const entry = new DataView(new ArrayBuffer(CENTRAL_ENTRY_BYTES))
    entry.setUint32(0, CENTRAL_DIRECTORY_ENTRY, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint16(10, STORED, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, data.byteLength, true)
    entry.setUint32(24, data.byteLength, true)
    entry.setUint16(28, nameBytes.byteLength, true)
    entry.setUint32(42, offset, true)
    parts.push(new Uint8Array(local.buffer), nameBytes, data)
    central.push(new Uint8Array(entry.buffer), nameBytes)
    offset += LOCAL_HEADER_BYTES + nameBytes.byteLength + data.byteLength
  }
  const centralSize = central.reduce((total, part) => total + part.byteLength, 0)
  const end = new DataView(new ArrayBuffer(END_RECORD_BYTES))
  end.setUint32(0, END_OF_CENTRAL_DIRECTORY, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((total, part) => total + part.byteLength, 0))
  let at = 0
  for (const part of all) {
    out.set(part, at)
    at += part.byteLength
  }
  return out
}

/**
 * @returns {Promise<{ status: 'ok', bytes: Uint8Array } | { status: 'too-large' | 'corrupt' }>}
 */
export async function inflateWorkbookZip(bytes, maxBytes = OFFICE_ZIP_MAX_UNCOMPRESSED_BYTES) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = findEnd(view)
  if (end < 0) return { status: 'corrupt' }
  const count = view.getUint16(end + 10, true)
  if (count > OFFICE_ZIP_MAX_ENTRIES) return { status: 'too-large' }
  let offset = view.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  const entries = []
  let total = 0
  try {
    for (let index = 0; index < count; index++) {
      if (offset + CENTRAL_ENTRY_BYTES > view.byteLength) return { status: 'corrupt' }
      if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY) return { status: 'corrupt' }
      const method = view.getUint16(offset + 10, true)
      const compressedSize = view.getUint32(offset + 20, true)
      const declaredSize = view.getUint32(offset + 24, true)
      const nameLength = view.getUint16(offset + 28, true)
      const extraLength = view.getUint16(offset + 30, true)
      const commentLength = view.getUint16(offset + 32, true)
      const localOffset = view.getUint32(offset + 42, true)
      // Workbooks this size never need ZIP64; its sizes live where this walk does not check them.
      if (compressedSize === ZIP64_MARKER || declaredSize === ZIP64_MARKER || localOffset === ZIP64_MARKER) {
        return { status: 'too-large' }
      }
      const nameStart = offset + CENTRAL_ENTRY_BYTES
      if (nameStart + nameLength > view.byteLength) return { status: 'corrupt' }
      const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength))
      offset = nameStart + nameLength + extraLength + commentLength
      if (localOffset + LOCAL_HEADER_BYTES > view.byteLength) return { status: 'corrupt' }
      if (view.getUint32(localOffset, true) !== LOCAL_HEADER) return { status: 'corrupt' }
      const dataStart =
        localOffset + LOCAL_HEADER_BYTES + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
      if (dataStart + compressedSize > view.byteLength) return { status: 'corrupt' }
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize)
      let data
      if (method === STORED) {
        data = compressed
        if (total + data.byteLength > maxBytes) return { status: 'too-large' }
      } else if (method === DEFLATED) {
        data = await inflateCapped(compressed, maxBytes - total)
      } else {
        return { status: 'corrupt' }
      }
      total += data.byteLength
      if (!name.endsWith('/')) entries.push({ name, data })
    }
  } catch (error) {
    return { status: error instanceof Budget ? 'too-large' : 'corrupt' }
  }
  return { status: 'ok', bytes: storedZip(entries) }
}
