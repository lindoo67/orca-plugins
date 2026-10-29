import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');

function harness(width = 720, random = () => 0.5) {
  let nextId = 0;
  let time = 0;
  let score = 0;
  let best = 0;
  const frames = new Map();
  const states = [];
  // Drawing is a no-op; gradients only need addColorStop.
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get: () => () => gradient, set: () => true });
  const canvas = { style: {}, parentElement: { getBoundingClientRect: () => ({width}) }, getContext: () => context };
  const window = {
    devicePixelRatio: 2,
    getComputedStyle: () => ({getPropertyValue: () => ''}),
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id,callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  vm.runInNewContext(source, {window,Math:Object.assign(Object.create(Math), {random})});
  const game = window.createOrcaRunner({ canvas, onStateChange: state => states.push(state), onScore(s,b) { score = s; best = b; } });
  function step(ms = 16) {
    time += ms;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(time));
  }
  function advance(ms) { for (let i = 0; i < ms; i += 16) step(); }
  return {game,canvas,states,step,advance,get hazards() {return game.inspect().hazards;},get score() {return score;},get best() {return best;},get y() {return game.inspect().y;},get crouched() {return game.inspect().crouched;},get pending() {return frames.size;}};
}

test('starts idle, pauses without scheduling work, and resumes without losing score', () => {
  const h = harness();
  assert.equal(h.game.getState(),'ready');
  assert.equal(h.pending,0);
  h.game.start(); h.advance(1500);
  assert.ok(h.score > 30);
  h.game.pause();
  const pausedScore = h.score;
  assert.equal(h.pending,0);
  h.advance(5000);
  assert.equal(h.score,pausedScore);
  h.game.start(); h.advance(200);
  assert.ok(h.score > pausedScore);
  assert.deepEqual(h.states,['ready','running','paused','running']);
});

test('collides with ice, stops frame loop, and restart preserves session best', () => {
  const h = harness();
  h.game.start();
  for (let i = 0; i < 800 && h.game.getState() !== 'gameover'; i++) h.step();
  assert.equal(h.game.getState(),'gameover');
  assert.equal(h.pending,0);
  assert.ok(h.best > 80);
  const record = h.best;
  h.game.start();
  assert.equal(h.score,0);
  assert.equal(h.best,record);
  assert.equal(h.game.getState(),'running');
});

test('jump cannot be retriggered in the air and releasing jump shortens its height', () => {
  const held = harness();
  const repeated = harness();
  const short = harness();
  for (const h of [held,repeated,short]) {h.game.jump(); h.advance(112);}
  short.game.releaseJump();
  repeated.game.jump();
  for (const h of [held,repeated,short]) h.advance(112);
  assert.equal(held.y,repeated.y);
  assert.ok(short.y > held.y, 'released jump stays lower');
  held.advance(1200);
  assert.equal(held.y,210,'lands back on waterline');
});

test('a delayed frame is bounded, narrow panels retain game geometry, and destroy cancels work', () => {
  const h = harness(280);
  assert.equal(h.canvas.width,560);
  assert.equal(h.canvas.height,327);
  h.game.start(); h.step(); h.step(30000);
  assert.ok(h.score < 2,'background time does not advance the world by 30 seconds');
  h.game.destroy();
  assert.equal(h.pending,0);
  h.game.start(); h.game.jump();
  assert.equal(h.pending,0);
});

test('ducking lowers the grounded hitbox and pausing clears duck', () => {
  const h = harness();
  h.game.start(); h.game.setDucking(true);
  assert.equal(h.crouched,true);
  h.game.pause();
  assert.equal(h.crouched,false);
  h.game.togglePause();
  assert.equal(h.game.getState(),'running');
  h.game.jump(); h.advance(112);
  assert.ok(h.y < 210);
});


test('a timed jump clears the first iceberg that otherwise ends a run', () => {
  const h = harness();
  h.game.start(); h.advance(3900);
  h.game.jump(); h.advance(900);
  assert.equal(h.game.getState(),'running');
  assert.equal(h.y,210);
  assert.ok(h.score > 120);
});


test('airborne duck turns an ascending jump into a fast fall', () => {
  const falling = harness();
  const held = harness();
  for (const h of [falling,held]) { h.game.jump(); h.advance(112); }
  falling.game.setDucking(true);
  for (const h of [falling,held]) h.advance(112);
  assert.equal(falling.y,210,'fast fall has already landed');
  assert.ok(held.y < 150,'ordinary held jump is still high in the air');
});

function reachFirstBird(duck) {
  const h = harness(720, () => 0);
  let encounteredBird = false;
  h.game.start();
  for (let step = 0; step < 1000 && h.game.getState() === 'running'; step++) {
    const approachingIce = h.hazards.some(o => o.kind === 'ice' && o.x < 185 && o.x > 110);
    if (approachingIce && h.y === 210) h.game.jump();
    const approachingBird = h.hazards.some(o => o.kind === 'bird' && o.x < 185 && o.x > 40);
    if (approachingBird) {
      encounteredBird = true;
      if (duck) h.game.setDucking(true);
    }
    h.step();
    if (encounteredBird && h.hazards.some(o => o.kind === 'bird' && o.x < 35)) break;
  }
  return {h,encounteredBird};
}

test('a low bird hits a standing orca after the early icebergs', () => {
  const {h,encounteredBird} = reachFirstBird(false);
  assert.ok(encounteredBird,'test reached bird difficulty');
  assert.ok(h.score > 180);
  assert.equal(h.game.getState(),'gameover');
});

test('ducking safely clears the same low bird', () => {
  const {h,encounteredBird} = reachFirstBird(true);
  assert.ok(encounteredBird,'test reached bird difficulty');
  assert.ok(h.hazards.some(o => o.kind === 'bird' && o.x < 35),'bird passed player');
  assert.equal(h.game.getState(),'running');
});
