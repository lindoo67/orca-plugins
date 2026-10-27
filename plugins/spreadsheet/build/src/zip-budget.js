// Refuses zip bombs before SheetJS inflates anything: walks the zip central directory and sums the
// declared uncompressed sizes. Adapted from the Office zip guard in stablyai/orca#29678 by @nebourocket.

export const OFFICE_ZIP_MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024
export const OFFICE_ZIP_MAX_ENTRIES = 4000

const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50
const END_RECORD_BYTES = 22
const MAX_COMMENT_BYTES = 0xffff
const CENTRAL_ENTRY_BYTES = 46

/** @returns {'ok' | 'too-large' | 'corrupt'} */
export function checkOfficeZipBudget(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = findEndOfCentralDirectory(view)
  if (end < 0) return 'corrupt'
  const entryCount = view.getUint16(end + 10, true)
  if (entryCount > OFFICE_ZIP_MAX_ENTRIES) return 'too-large'
  let offset = view.getUint32(end + 16, true)
  let total = 0
  for (let index = 0; index < entryCount; index++) {
    if (offset + CENTRAL_ENTRY_BYTES > view.byteLength) return 'corrupt'
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY) return 'corrupt'
    total += view.getUint32(offset + 24, true)
    if (total > OFFICE_ZIP_MAX_UNCOMPRESSED_BYTES) return 'too-large'
    offset +=
      CENTRAL_ENTRY_BYTES +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true)
  }
  return 'ok'
}

function findEndOfCentralDirectory(view) {
  const last = view.byteLength - END_RECORD_BYTES
  const first = Math.max(0, last - MAX_COMMENT_BYTES)
  for (let offset = last; offset >= first; offset--) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) return offset
  }
  return -1
}
