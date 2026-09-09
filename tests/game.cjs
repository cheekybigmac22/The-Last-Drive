#!/usr/bin/env node
'use strict';

// A deterministic logic/render-call regression harness, not a browser screenshot test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(repo, 'style.css'), 'utf8');
const source = fs.readFileSync(path.join(repo, 'game.js'), 'utf8');
let random = () => 0.999999;
let sequence = 1;
const timers = new Map();
const animationFrames = new Map();
const listeners = new Map();
let drawCalls = 0;
const stack = [];
const context2d = { globalAlpha: 1 };

function finiteNumbers(args, operation) {
  for (const value of args) {
    if (typeof value === 'number') assert(Number.isFinite(value), `${operation}: non-finite number`);
  }
}

for (const operation of ['fillRect', 'strokeRect', 'clearRect', 'moveTo', 'lineTo', 'rect',
  'roundRect', 'arc', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'translate', 'scale',
  'rotate', 'setTransform', 'transform', 'fillText', 'strokeText', 'drawImage']) {
  context2d[operation] = (...args) => {
    finiteNumbers(args, operation);
    if (operation === 'ellipse') assert(args[2] >= 0 && args[3] >= 0, 'negative ellipse radius');
    if (operation === 'arc') assert(args[2] >= 0, 'negative arc radius');
    drawCalls++;
  };
}
for (const operation of ['beginPath', 'closePath', 'fill', 'stroke', 'clip', 'resetTransform']) {
  context2d[operation] = () => { drawCalls++; };
}
context2d.save = () => {
  stack.push(Object.fromEntries(Object.entries(context2d).filter(([, value]) => typeof value !== 'function')));
};
context2d.restore = () => {
  assert(stack.length > 0, 'canvas restore without matching save');
  Object.assign(context2d, stack.pop());
};
context2d.measureText = text => ({ width: String(text).length * 8 });
for (const operation of ['createLinearGradient', 'createRadialGradient']) {
  context2d[operation] = (...args) => {
    finiteNumbers(args, operation);
    return { addColorStop(offset) { assert(offset >= 0 && offset <= 1); } };
  };
}

const elements = new Map();
for (const match of html.matchAll(/<([a-z][a-z\d]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
  const [, tag, attrs, id] = match;
  const classes = new Set((attrs.match(/\bclass="([^"]*)"/)?.[1] || '').split(/\s+/).filter(Boolean));
  const element = {
    id, tagName: tag.toLowerCase(), textContent: '',
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const add = force === undefined ? !classes.has(name) : force;
        if (add) classes.add(name); else classes.delete(name);
        return add;
      }
    },
    addEventListener(type, callback) { listeners.set(`${id}:${type}`, callback); },
    focus() {}
  };
  if (tag === 'canvas') {
    element.width = Number(attrs.match(/\bwidth="(\d+)"/)?.[1]);
    element.height = Number(attrs.match(/\bheight="(\d+)"/)?.[1]);
    element.getContext = type => { assert.equal(type, '2d'); return context2d; };
  }
  elements.set(`#${id}`, element);
}

// Resolve only simple display selectors. This intentionally checks the real CSS
// instead of assuming every element with a "hidden" class is actually hidden.
function ownDisplay(element) {
  let display = 'block';
  let specificity = -1;
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const declaration = body.match(/(?:^|;)\s*display\s*:\s*([^;!}]+)/);
    if (!declaration) continue;
    for (let selector of selectors.split(',')) {
      selector = selector.trim();
      if (!/^(?:[a-z][a-z\d]*)?(?:[.#][\w-]+)*$/i.test(selector)) continue;
      const tag = selector.match(/^[a-z][a-z\d]*/i)?.[0];
      const ids = [...selector.matchAll(/#([\w-]+)/g)].map(match => match[1]);
      const classes = [...selector.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
      if (tag && tag !== element.tagName) continue;
      if (ids.some(id => id !== element.id)) continue;
      if (classes.some(name => !element.classList.contains(name))) continue;
      const weight = ids.length * 100 + classes.length * 10 + (tag ? 1 : 0);
      if (weight >= specificity) { display = declaration[1].trim(); specificity = weight; }
    }
  }
  return display;
}

const gameMath = Object.create(Math);
gameMath.random = () => random();
const sandbox = {
  console, Math: gameMath,
  document: { querySelector(selector) { assert(elements.has(selector), `missing DOM element ${selector}`); return elements.get(selector); } },
  performance: { now: () => 0 },
  setTimeout(callback) { const id = sequence++; timers.set(id, callback); return id; },
  clearTimeout(id) { timers.delete(id); },
  requestAnimationFrame(callback) { const id = sequence++; animationFrames.set(id, callback); return id; },
  cancelAnimationFrame(id) { animationFrames.delete(id); },
  addEventListener(type, callback) { listeners.set(`window:${type}`, callback); }
};
vm.createContext(sandbox);
vm.runInContext(source + `\n;globalThis.testGame = {
  get game() { return game; }, get keys() { return keys; }, get biomes() { return biomes; },
  begin, reset, draw, update, useBoost, mainWomanRush, spawnMonster, startMemoryGame, chooseDoor,
  W, H
};`, sandbox, { filename: 'game.js' });
const api = sandbox.testGame;
const dt = 1 / 60;
let passed = 0;

function fresh(seed) {
  if (seed === undefined) random = () => 0.999999;
  else {
    let state = seed >>> 0;
    random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  }
  for (const key of Object.keys(api.keys)) delete api.keys[key];
  api.begin();
  assert.equal(api.game.running, true);
  assert.equal(ownDisplay(elements.get('#start-screen')), 'none');
  assert.equal(stack.length, 0);
}

function assertSafe() {
  assert.equal(api.game.running, true, 'encounter ended the run');
  assert.equal(ownDisplay(elements.get('#death')), 'none', 'death panel became visible');
  assert(Number.isFinite(api.game.d) && Number.isFinite(api.game.x), 'invalid player state');
}

function advance(seconds, beforeFrame = () => {}) {
  for (let frame = 0; frame < Math.ceil(seconds / dt); frame++) {
    beforeFrame(frame);
    api.update(dt);
    assertSafe();
  }
}

function test(name, run) {
  try {
    run();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.stack}`);
    process.exitCode = 1;
  }
}

test('startup and all seven biomes update and draw with finite canvas geometry', () => {
  assert.equal(api.biomes.length, 7);
  for (let biome = 0; biome < api.biomes.length; biome++) {
    fresh();
    api.game.d = api.biomes[biome][1] + 20;
    advance(0.2);
    api.draw();
    assert.equal(api.game.biome, biome);
    assert.equal(stack.length, 0, 'unbalanced canvas state');
  }
  assert(drawCalls > 100, 'render path did not draw the world');
});

test('memory phases hide the answer; both door choices resume without death', () => {
  for (const correct of [true, false]) {
    fresh();
    api.startMemoryGame();
    const answer = api.game.memory.answer;
    assert.equal(answer.length, 2);
    assert.notEqual(ownDisplay(elements.get('#memory-phase')), 'none');
    assert.equal(ownDisplay(elements.get('#doors')), 'none');
    const initialDistance = api.game.d;
    advance(3);
    assert.equal(api.game.memoryTimer, -1);
    assert.equal(api.game.d, initialDistance, 'road must pause during memory test');
    assert.equal(ownDisplay(elements.get('#memory-phase')), 'none', 'answer remains visible at the doors');
    assert.notEqual(ownDisplay(elements.get('#doors')), 'none');
    const choices = ['#door-left', '#door-right'].map(id => elements.get(id).textContent);
    assert.equal(choices.filter(value => value === answer).length, 1);
    api.chooseDoor(choices.find(value => correct ? value === answer : value !== answer));
    assert.equal(api.game.memoryTimer, 0);
    assert.equal(ownDisplay(elements.get('#memory')), 'none');
    advance(0.2);
    assert(api.game.d > initialDistance);
  }
  fresh();
  api.game.d = 16000;
  api.startMemoryGame();
  assert.equal(api.game.memory.answer.length, 7, 'late memory numbers should be harder');
});

test('woman rush lasts long enough to respond and manual boost clears the chase', () => {
  fresh();
  api.game.boost = 1;
  api.mainWomanRush();
  advance(2.2);
  assert(api.game.mainRush > 0 && api.game.forcedTimer > 0, 'rush expired before player could respond');
  advance(1);
  assert(elements.get('#event').textContent.startsWith('BOOST NOW'), 'forced-boost warning never appeared');
  api.useBoost();
  assert.equal(api.game.mainRush, 0);
  assert.equal(api.game.forcedTimer, 0, 'boost leaves the rush deadline active');
  assert(api.game.burst > 0);
  assertSafe();
});

test('missed forced boost resolves safely with a temporary setback', () => {
  fresh();
  api.mainWomanRush();
  advance(2);
  assert.equal(api.game.boost, 1, 'emergency pickup did not reach the rider before the deadline');
  let setbackSeen = false;
  advance(7, () => { setbackSeen ||= api.game.setback > 0; });
  assert.equal(api.game.mainRush, 0);
  assert.equal(api.game.forcedTimer, 0);
  assert(setbackSeen, 'ignoring a forced chase has no consequence');
  assertSafe();
});

test('monster contact stays safe and cooldown expires instead of becoming permanent', () => {
  fresh();
  api.spawnMonster('chase');
  const monster = api.game.monsters.at(-1);
  monster.x = api.game.x;
  monster.y = api.H - 115;
  api.update(dt);
  assertSafe();
  assert(monster.cooldown > 0, 'contact did not trigger an encounter');
  assert(monster.y > api.H - 115, 'scare should put the monster behind the rider');
  advance(2);
  // The creature may be retired once behind the rider. If kept, its cooldown must expire.
  if (api.game.monsters.includes(monster)) assert.equal(monster.cooldown, 0);
  else assert(!api.game.monsters.includes(monster));

  fresh();
  api.spawnMonster('chase');
  const cooling = api.game.monsters.at(-1);
  cooling.x = 0;
  cooling.y = -500;
  cooling.cooldown = 0.1;
  advance(0.3);
  assert.equal(cooling.cooldown, 0, 'cooldown went negative or never cleared');

  fresh();
  api.game.boost = 1;
  api.useBoost();
  api.spawnMonster('chase');
  const immune = api.game.monsters.at(-1);
  immune.x = api.game.x;
  immune.y = api.H - 115;
  const priorSetback = api.game.setback;
  api.update(dt);
  assertSafe();
  assert(api.game.setback <= priorSetback, 'boost did not prevent the contact setback');
  assert(api.game.burst > 0, 'contact prematurely consumed active boost');
});

test('loop encounter reveals, repeats a bounded number of times, then retires', () => {
  fresh();
  // With seven types available, a random value near one chooses looper ID 6.
  api.spawnMonster();
  const monster = api.game.monsters.at(-1);
  assert.equal(monster.kind, 'loop');
  assert.equal(monster.revealed, false);
  let reveals = 0;
  let resets = 0;
  let previousRevealed = false;
  let previousY = monster.y;
  advance(40, () => {
    if (!api.game.monsters.includes(monster)) return;
    if (monster.revealed && !previousRevealed) reveals++;
    if (monster.y < previousY - 100) resets++;
    previousRevealed = monster.revealed;
    previousY = monster.y;
  });
  assert(reveals >= 1, 'loop never revealed');
  assert(resets >= 1 && resets <= 3, `unexpected loop replay count ${resets}`);
  assert(api.game.loopCount >= 1, 'no loop event recorded');
  assert(!api.game.monsters.includes(monster), 'loop creature never retires');
});

test('25 simulated minutes progress beyond monster-world entry with bounded collections', () => {
  fresh(314159);
  const maxima = { monsters: 0, traffic: 0, pickups: 0, particles: 0 };
  let memoryEvents = 0;
  let usedBoosts = 0;
  let entrySeconds = null;
  advance(25 * 60, frame => {
    const game = api.game;
    if (game.memoryTimer === -1) {
      memoryEvents++;
      api.chooseDoor(game.memory.answer);
    }
    const target = game.pickups.filter(pickup => pickup.y < api.H - 105)
      .sort((left, right) => right.y - left.y)[0];
    api.keys.ArrowLeft = Boolean(target && target.x < game.x - 5);
    api.keys.ArrowRight = Boolean(target && target.x > game.x + 5);
    if (game.boost && game.memoryTimer === 0 && game.burst <= 0) { api.useBoost(); usedBoosts++; }
    if (entrySeconds === null && game.d >= 18000) entrySeconds = frame * dt;
    for (const collection of Object.keys(maxima)) {
      maxima[collection] = Math.max(maxima[collection], game[collection].length);
      assert(game[collection].length < 200, `${collection} grew without bound`);
    }
    if (frame % 120 === 0) { api.draw(); assert.equal(stack.length, 0); }
  });
  assert(api.game.d >= 18000, `never reached monster world: ${Math.floor(api.game.d)}m`);
  assert.equal(api.game.biome, 6);
  assert(memoryEvents > 0 && usedBoosts > 0, 'simulation did not exercise memory events and boosts');
  console.log(JSON.stringify({ simulatedMinutes: 25, distance: Math.floor(api.game.d),
    monsterWorldEntryMinutes: entrySeconds / 60, usedBoosts, memoryEvents, maxima }));
});

console.log(`${passed}/7 regression groups passed. Canvas/DOM are stubs; visual layout is not browser-verified.`);
