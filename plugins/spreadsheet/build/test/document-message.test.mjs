import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDocument } from '../src/document-message.js'

const document = (fields) => ({ version: 3, readOnly: true, fileType: 'xlsx', ...fields })
const bytes = () => new Uint8Array([1, 2, 3]).buffer

test('accepts byte documents and wraps the ArrayBuffer', () => {
  const parsed = parseDocument(document({ content: { kind: 'bytes', bytes: bytes() } }))
  assert.equal(parsed.version, 3)
  assert.equal(parsed.fileType, 'xlsx')
  assert.ok(parsed.bytes instanceof Uint8Array)
  assert.deepEqual([...parsed.bytes], [1, 2, 3])
  assert.equal(parseDocument(document({ fileType: 'csv', content: { kind: 'bytes', bytes: bytes() } })).fileType, null)
})

test('ignores everything else', () => {
  for (const data of [
    null,
    undefined,
    'document',
    { type: 'ready' },
    document({ content: { kind: 'text', text: 'a,b' } }),
    document({ content: { kind: 'bytes', bytes: new Uint8Array(3) } }),
    document({ content: { kind: 'bytes', bytes: [1, 2, 3] } }),
    document({ content: null }),
    document({ version: undefined, content: { kind: 'bytes', bytes: bytes() } }),
    document({ version: 1.5, content: { kind: 'bytes', bytes: bytes() } }),
    { version: 1, text: 'a,b' }
  ]) {
    assert.equal(parseDocument(data), null, String(data?.content?.kind ?? data))
  }
})
