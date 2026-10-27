export const SPREADSHEET_FILE_TYPES = new Set(['xlsx', 'xlsm', 'xlsb', 'xls', 'ods'])

/**
 * The bytes and version of an `orca-editor-document` message carrying a binary document, or null
 * for anything else (including text documents).
 */
export function parseDocumentMessage(data) {
  if (data === null || typeof data !== 'object' || data.type !== 'orca-editor-document') return null
  if (!Number.isSafeInteger(data.version)) return null
  const { content } = data
  if (content === null || typeof content !== 'object' || content.kind !== 'bytes') return null
  if (!(content.bytes instanceof ArrayBuffer)) return null
  const fileType = SPREADSHEET_FILE_TYPES.has(data.fileType) ? data.fileType : null
  return { version: data.version, bytes: new Uint8Array(content.bytes), fileType }
}
