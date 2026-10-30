const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ScratchpadDocument } = require('../panel/storage.js');
const item = text => ({ id: 'one', text, done: false });
function setup(initial = '') {
  let doc = { version: 1, content: { kind: 'text', text: initial }, readOnly: false };
  let listener, flush, failure;
  const view = { rows: [], messages: [], disabled: true, render(rows) { this.rows = rows; }, readOnly(v) { this.disabled = v; }, status(...args) { this.messages.push(args); } };
  const edits = [];
  const orca = {
    document: {
      onDidChange(fn) { listener = fn; fn(doc); },
      async applyEdit(edit) {
        if (failure) throw failure;
        assert.equal(edit.baseVersion, doc.version);
        edits.push(edit); doc = { ...doc, content: edit.content }; listener(doc);
      }
    },
    on(event, fn) { assert.equal(event, 'editor.flush'); flush = fn; }
  };
  const store = new ScratchpadDocument(orca, view); store.load();
  return { store, view, edits, doc: () => doc, flush: () => flush(), fail(error) { failure = error; }, receive(next) { doc = next; listener(next); } };
}
test('flush updates the file buffer, reopening preserves notes, loading makes no edits', async () => {
  const env = setup(); assert.equal(env.edits.length, 0);
  env.store.save([item('Keep me')]); await env.flush(); clearTimeout(env.store.timer);
  assert.deepEqual(JSON.parse(env.doc().content.text).items, [item('Keep me')]);
  const reopened = setup(env.doc().content.text);
  assert.deepEqual(reopened.view.rows, [item('Keep me')]); assert.equal(reopened.edits.length, 0);
});
test('failed document edits remain available for retry', async () => {
  const env = setup(); env.fail(new Error('unavailable'));
  env.store.save([item('Keep me')]); await assert.rejects(env.flush()); clearTimeout(env.store.timer);
  assert.match(env.view.messages.at(-1)[0], /not applied/);
  env.fail(null); await env.store.retry();
  assert.deepEqual(JSON.parse(env.doc().content.text).items, [item('Keep me')]);
});
test('external changes while editing preserve pending text and block overwrite', async () => {
  const env = setup(); env.store.save([item('local')]); clearTimeout(env.store.timer);
  env.receive({ version: 2, content: { kind: 'text', text: JSON.stringify({ version: 1, items: [item('external')] }) } });
  await assert.rejects(env.flush()); assert.equal(env.edits.length, 0);
  assert.match(env.store.pending, /local/);
});
test('invalid files and read-only documents disable editing without modifying content', () => {
  const env = setup('bad json'); assert.equal(env.view.disabled, true); assert.equal(env.edits.length, 0);
  env.receive({ version: 2, readOnly: true, content: { kind: 'text', text: '' } });
  env.store.save([item('blocked')]); assert.equal(env.store.pending, null);
  assert.equal(env.view.disabled, true);
});
test('flush drains edits made while a previous edit is in flight', async () => {
  const env = setup();
  env.store.save([item('first')]); const p = env.flush();
  env.store.save([item('second')]); await p; clearTimeout(env.store.timer);
  assert.deepEqual(JSON.parse(env.doc().content.text).items, [item('second')]);
});
