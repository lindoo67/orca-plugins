import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseDocument } from '../src/document-message.js'

test('accepts transferred byte documents and ignores malformed or text documents', () => {
  const bytes = new ArrayBuffer(8)
  assert.deepEqual(parseDocument({ version: 2, content: { kind: 'bytes', bytes } }), { version: 2, bytes: new Uint8Array(bytes) })
  for (const doc of [null, {}, { version: NaN }, { version: 1.5 }, { version: 1, content: { kind: 'text', text: 'hello' } }, { version: 1, content: { kind: 'bytes', bytes: [] } }]) assert.equal(parseDocument(doc), null)
})
