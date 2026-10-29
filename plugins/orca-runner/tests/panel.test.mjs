import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/panel.js', import.meta.url), 'utf8');

function harness() {
  const events = new Map();
  const calls = [];
  const game = Object.fromEntries(['jump', 'releaseJump', 'setDucking', 'togglePause', 'pause']
    .map(name => [name, (...args) => calls.push([name, ...args])]));
  const element = { addEventListener() {}, getBoundingClientRect: () => ({width: 720}) };
  const document = {
    documentElement: {},
    getElementById: () => element,
    addEventListener: (type, listener) => events.set(type, listener)
  };
  const window = { createOrcaRunner: () => game, addEventListener() {} };
  class Observer { observe() {} disconnect() {} }
  vm.runInNewContext(source, {window, document, ResizeObserver: Observer, MutationObserver: Observer});
  function key(type, properties) {
    const event = {target: {closest: () => false}, preventDefault() { this.prevented = true; }, ...properties};
    events.get(type)(event);
    return event;
  }
  return {key, calls, events, document};
}

for (const code of ['ArrowDown', '']) {
  test(`down arrow dives while held and releases with code ${JSON.stringify(code)}`, () => {
    const h = harness();
    const event = h.key('keydown', {key: 'ArrowDown', code});
    assert.equal(event.prevented, true, 'down does not scroll the panel');
    h.key('keyup', {key: 'ArrowDown', code});
    assert.deepEqual(h.calls, [['setDucking', true], ['setDucking', false]]);
  });
}

test('key-only jump and pause inputs work alongside diving', () => {
  const h = harness();
  h.key('keydown', {key: ' ', code: ''});
  h.key('keyup', {key: ' ', code: ''});
  h.key('keydown', {key: 'P', code: ''});
  assert.deepEqual(h.calls, [['jump'], ['releaseJump'], ['togglePause']]);
});

test('holding down does not auto-restart a run after a collision', () => {
  const h = harness();
  const event = h.key('keydown', {key: 'ArrowDown', repeat: true});
  assert.equal(event.prevented, true);
  assert.deepEqual(h.calls, []);
});

test('modified shortcuts and editable fields do not trigger diving', () => {
  const h = harness();
  for (const modifier of ['metaKey', 'ctrlKey', 'altKey']) {
    h.key('keydown', {key: 'ArrowDown', code: 'ArrowDown', [modifier]: true});
  }
  h.key('keydown', {key: 'ArrowDown', target: {closest: () => true}});
  assert.deepEqual(h.calls, []);
});

test('hiding the panel releases dive and jump inputs before pausing', () => {
  const h = harness();
  h.key('keydown', {key: 'ArrowDown'});
  h.events.get('visibilitychange')();
  assert.deepEqual(h.calls, [['setDucking', true]]);
  h.document.hidden = true;
  h.events.get('visibilitychange')();
  assert.deepEqual(h.calls, [['setDucking', true], ['setDucking', false], ['releaseJump'], ['pause']]);
});
