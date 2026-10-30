const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ScratchpadStore } = require('../panel/storage.js');
const item = text => ({ id: 'one', text, done: false });
function setup() {
  let value = null, fail = false;
  const host = {
    has: () => true,
    async call(name, params) {
      if (fail) throw new Error('disk full');
      if (name === 'storage.get') return { value: structuredClone(value) };
      if (JSON.stringify(params.expected) !== JSON.stringify(value)) return { swapped: false };
      value = structuredClone(params.value);
      return { swapped: true };
    }
  };
  const create = () => {
    const view = { rows: [], messages: [], render(rows) { this.rows = rows; }, status(...args) { this.messages.push(args); } };
    return { store: new ScratchpadStore(host, view), view };
  };
  return { create, setFail: next => { fail = next; }, value: () => value };
}
test('saved items survive closing and reopening a panel', async () => {
  const env = setup(); const { store } = env.create(); await store.load();
  store.save([item('Keep me')]); await store.flush(); clearTimeout(store.timer);
  const reopened = env.create(); await reopened.store.load();
  assert.deepEqual(reopened.view.rows, [item('Keep me')]);
});
test('save failure preserves edits for retry', async () => {
  const env = setup(); const { store, view } = env.create(); await store.load();
  env.setFail(true); store.save([item('Keep me')]); await store.flush(); clearTimeout(store.timer);
  assert.match(view.messages.at(-1)[0], /Not saved/);
  assert.equal(env.value(), null);
  env.setFail(false); await store.flush();
  assert.deepEqual(env.value().items, [item('Keep me')]);
});
test('concurrent panels preserve the winning write and report a stale write', async () => {
  const env = setup(); const a = env.create(), b = env.create();
  await Promise.all([a.store.load(), b.store.load()]);
  a.store.save([item('first')]); b.store.save([item('second')]);
  await Promise.all([a.store.flush(), b.store.flush()]);
  clearTimeout(a.store.timer); clearTimeout(b.store.timer);
  assert.deepEqual(env.value().items, [item('first')]);
  assert.deepEqual(b.store.pending.items, [item('second')]);
  assert.match(b.view.messages.at(-1)[0], /another panel/);
});
test('unsupported hosts and invalid data keep editing disabled', async () => {
  let rendered = false;
  const view = { render() { rendered = true; }, status() {} };
  const store = new ScratchpadStore({ has: () => false }, view); await store.load();
  assert.equal(rendered, false);
  assert.throws(() => store.validate({ version: 99, items: [] }));
});
