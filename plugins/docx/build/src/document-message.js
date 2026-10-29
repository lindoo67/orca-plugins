export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024

/** Only accept versioned binary documents delivered by the supported frame API. */
export function parseDocument(doc) {
  if (!doc || !Number.isSafeInteger(doc.version)) return null
  if (doc.content?.kind !== 'bytes' || !(doc.content.bytes instanceof ArrayBuffer)) return null
  return { version: doc.version, bytes: new Uint8Array(doc.content.bytes) }
}
