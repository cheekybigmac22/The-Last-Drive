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
const source = ['roads.js','pixel-art.js','monster-art.js','game.js'].map(file=>fs.readFileSync(path.join(repo,file),'utf8')).join('\n');
let random = () => 0.999999;
let sequence = 1;
const timers = new Map();
const animationFrames = new Map();
const listeners = new Map();
let drawCalls = 0;
let atlasDrawCalls = 0;
const stack = [];
const context2d = { globalAlpha: 1 };
class FakeImage {
  constructor(){this.width=1536;this.height=1024;this.naturalWidth=1536;this.naturalHeight=1024;this.complete=true;}
  set src(value){assert(fs.existsSync(path.join(repo,value)),`Missing artwork: ${value}`);this._src=value;if(this.onload)this.onload();}
  get src(){return this._src;}
}

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
    if (operation === 'drawImage' && args[0] instanceof FakeImage) atlasDrawCalls++;
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
  console, Math: gameMath, Image: FakeImage,
  document: { createElement() { return { width: 320, height: 410, getContext: () => context2d }; }, querySelector(selector) { assert(elements.has(selector), `missing DOM element ${selector}`); return elements.get(selector); } },
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
  begin, reset, draw, update, useBoost, mainWomanRush, spawnMonster, spawnPedestrian, spawnTraffic, updateTraffic, encounter, startMemoryGame, chooseDoor,
  RoadNetwork, MonsterArt,
  W, H
};`, sandbox, { filename: 'game.js' });
const api = sandbox.testGame;
const dt = 1 / 60;
let passed = 0;
let total = 0;

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
    assert(Number.isFinite(api.game.d) && Number.isFinite(api.game.x));
  }
}

function test(name, run) {
  total++;
  try {
    run();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.stack}`);
    process.exitCode = 1;
  }
}


function quiet() {
  api.game.monsterTimer=1e6;api.game.rushTimer=1e6;api.game.nextMemory=1e6;
}

test('all seven pixel biomes and forty high-resolution monster forms draw without invalid coordinates',()=>{
  assert.equal(api.biomes.length,7);
  assert.equal(api.MonsterArt.loaded,true,'monster atlas did not load');
  for(let biome=0;biome<7;biome++){
    fresh();quiet();api.game.d=api.biomes[biome][1]+10;advance(.1);api.draw();
    assert.equal(api.game.biome,biome);assert.equal(stack.length,0);
  }
  for(let id=0;id<40;id++){
    fresh();quiet();api.spawnMonster();
    Object.assign(api.game.monsters[0],{id,revealed:true,revealProgress:1,x:300,y:200});
    const before=atlasDrawCalls;
    api.MonsterArt.draw(api.game,api.W,api.H);
    assert(atlasDrawCalls>before,'monster '+id+' did not use the high-resolution atlas');
    assert.equal(stack.length,0);
  }
  assert(drawCalls>1000);
});
test('diagonal street network is connected, deterministic, and returns the closest world point',()=>{
  const network=api.RoadNetwork;
  const area=[-1500,-1500,1500,1500];
  const streets=network.segments(...area);
  assert.equal(JSON.stringify(streets),JSON.stringify(network.segments(...area)));
  assert(streets.length>15);
  assert.equal(new Set(streets.map(s=>s.id)).size,streets.length,'duplicate streets in query');
  for(const s of streets){
    assert(Math.abs(s.x2-s.x1)>20&&Math.abs(s.y2-s.y1)>20,'straight central artery reappeared');
    assert(s.width>=80&&s.width<=120);
    const links=network.segments(s.x2-1,s.y2-1,s.x2+1,s.y2+1).filter(n=>n.id!==s.id&&
      (Math.hypot(n.x1-s.x2,n.y1-s.y2)<.01||Math.hypot(n.x2-s.x2,n.y2-s.y2)<.01));
    assert(links.length>=2,'street junction was disconnected');
  }
  for(const [x,y] of [[396,705],[-820,-3200],[6000,-12000],[0,0],[1200,900]]){
    const near=network.closest(x,y),s=near.segment;
    assert(near.t>=0&&near.t<=1);assert(Math.abs(Math.hypot(near.dx,near.dy)-1)<1e-10);
    assert(Math.abs(near.x-(s.x1+(s.x2-s.x1)*near.t))<1e-9);
    assert(Math.abs(near.y-(s.y1+(s.y2-s.y1)*near.t))<1e-9);
    assert(Math.abs(near.distance-Math.hypot(x-near.x,y-near.y))<1e-9);
    let exhaustive=Infinity;
    for(const candidate of network.segments(x-900,y-900,x+900,y+900)){
      const dx=candidate.x2-candidate.x1,dy=candidate.y2-candidate.y1;
      const t=Math.max(0,Math.min(1,((x-candidate.x1)*dx+(y-candidate.y1)*dy)/(dx*dx+dy*dy)));
      exhaustive=Math.min(exhaustive,Math.hypot(x-candidate.x1-dx*t,y-candidate.y1-dy*t));
    }
    assert(Math.abs(near.distance-exhaustive)<1e-8);
  }
});
test('ordinary pedestrians populate streets, walk, remain harmless, and stay bounded',()=>{
  fresh(31);quiet();
  assert(api.game.pedestrians.length>=20,'neighborhood begins empty');
  const p=api.game.pedestrians[0];
  Object.assign(p,{x:api.game.x,y:api.H-115,vx:12,vy:8});
  const x=p.x,phase=p.phase;
  advance(.2);assertSafe();
  assert(p.x>x&&p.phase>phase,'pedestrian walking animation did not advance');
  for(let i=0;i<80;i++)api.spawnPedestrian(200);
  assert.equal(api.game.pedestrians.length,40);
  advance(30,()=>assert(api.game.pedestrians.length<=40));
  assert(api.game.pedestrians.length>0);assertSafe();
});
test('traffic follows connected angled streets and retires outside the viewport',()=>{
  fresh(71);quiet();
  assert(api.game.traffic.length>0);
  const v=api.game.traffic[0],oldId=v.segment.id;
  v.t=.999;v.direction=1;v.speed=65;
  api.updateTraffic(.1);
  assert.notEqual(v.segment.id,oldId,'traffic did not enter the connecting street');
  for(const car of api.game.traffic){
    const s=car.segment,dx=s.x2-s.x1,dy=s.y2-s.y1,length=Math.hypot(dx,dy);
    const cx=s.x1+dx*car.t,cy=s.y1+dy*car.t;
    assert(Math.abs(car.x-(cx-dy/length*car.direction*17))<1e-8);
    assert(Math.abs(car.y-(cy+dx/length*car.direction*17+api.game.scroll))<1e-8);
    assert(Number.isFinite(car.angle));
  }
  for(let i=0;i<40;i++)api.spawnTraffic(200);
  assert.equal(api.game.traffic.length,12);
  api.game.cameraX+=10000;api.updateTraffic(dt);
  assert.equal(api.game.traffic.length,0,'far-off traffic was retained');
});
test('memory answer disappears at the doors and either choice resumes play',()=>{
  for(const correct of [true,false]){
    fresh();quiet();api.startMemoryGame();
    const answer=api.game.memory.answer;
    assert.equal(answer.length,2);
    assert.equal(ownDisplay(elements.get('#doors')),'none');
    const d=api.game.d;advance(3);
    assert.equal(api.game.d,d);assert.equal(api.game.memoryTimer,-1);
    assert.equal(elements.get('#memory-number').textContent,'');
    assert.equal(ownDisplay(elements.get('#memory-phase')),'none');
    assert.notEqual(ownDisplay(elements.get('#doors')),'none');
    const choices=['#door-left','#door-right'].map(id=>elements.get(id).textContent);
    assert.equal(choices.filter(v=>v===answer).length,1);
    api.chooseDoor(choices.find(v=>correct?v===answer:v!==answer));
    assert.equal(api.game.memoryTimer,0);assert.equal(ownDisplay(elements.get('#memory')),'none');
    advance(.1);assert(api.game.d>d);assertSafe();
  }
  fresh();api.game.d=2400;api.startMemoryGame();assert.equal(api.game.memory.answer.length,7);
});
test('contact with every revealed monster is fatal, including with a stored or active boost',()=>{
  for(let id=0;id<40;id++)for(const state of ['empty','ready','active']){
    fresh();quiet();api.game.monsters=[];api.spawnMonster();
    const m=api.game.monsters[0];Object.assign(m,{id,revealed:true,revealProgress:1,x:api.game.x,y:api.H-115});
    api.game.boost=state==='ready'?1:0;api.game.burst=state==='active'?1:0;
    api.update(dt);
    assert.equal(api.game.running,false,'nonlethal contact: '+id+' '+state);
    assert.notEqual(ownDisplay(elements.get('#death')),'none');
    const d=api.game.d;api.update(1);assert.equal(api.game.d,d,'dead run kept progressing');
  }
  fresh();assertSafe();assert.equal(api.game.d,0);assert.equal(api.game.monsters.length,0);
});
test('tight contact boxes allow near misses and manual boost clears a nearby threat',()=>{
  fresh();quiet();api.spawnMonster();let m=api.game.monsters[0];
  Object.assign(m,{id:5,kind:'always',revealed:true,x:api.game.x+44,y:api.H-115});
  api.update(dt);assertSafe();
  m.x=api.game.x;m.y=api.H-170;
  api.useBoost();assert.equal(m.life,0);api.update(dt);assertSafe();
  assert.equal(api.game.boost,0);assert(api.game.burst>0);
});
test('chase offers a reachable pickup and enough warning to manually escape',()=>{
  fresh();quiet();api.game.boost=0;api.mainWomanRush();advance(2);
  assert.equal(api.game.boost,1,'emergency pickup missed the rider');
  assert(api.game.mainRush>0&&api.game.forcedTimer>0);
  advance(1);assert(elements.get('#event').textContent.includes('BOOST NOW'));
  api.useBoost();assert.equal(api.game.mainRush,0);assert.equal(api.game.forcedTimer,0);
  advance(3);assertSafe();
  fresh();quiet();api.mainWomanRush();advance(6);
  assert.equal(api.game.running,false,'ignoring a chase should be fatal');
  assert.equal(elements.get('#death-title').textContent,'SHE CAUGHT YOU');
});
test('highway ends at 400m and every finite biome is roughly twenty seconds',()=>{
  fresh();quiet();let prev=0,seconds=0;const crossings=[];
  while(api.game.d<2400&&seconds<140){
    api.update(dt);seconds+=dt;
    if(api.game.biome!==prev){crossings.push(seconds);prev=api.game.biome;}
  }
  assert.equal(api.biomes[0][2],400);assert.equal(crossings.length,6);
  assert(crossings[0]>18&&crossings[0]<21);
  for(let i=1;i<crossings.length;i++)assert(crossings[i]-crossings[i-1]<23);
  assert(seconds<120);assertSafe();console.log('Monster World reached in '+seconds.toFixed(1)+' seconds without boosts.');
});
test('camera stays fixed on highway and follows both directions outside it in world space',()=>{
  fresh();quiet();api.keys.ArrowRight=true;advance(1);api.keys.ArrowRight=false;
  assert.equal(api.game.cameraX,0);
  api.game.d=450;api.update(dt);
  api.game.pickups=[{x:api.game.x,y:-800,pulse:0}];
  const pickup=api.game.pickups[0],worldX=pickup.x;
  api.keys.ArrowRight=true;advance(2);api.keys.ArrowRight=false;
  const right=api.game.cameraX;
  assert(api.game.x>api.W,'world still clamped to screen');
  assert(right>400);assert(Math.abs(api.game.x-api.game.cameraX-api.W/2)<55);
  assert.equal(pickup.x,worldX,'camera moved pickup in world coordinates');
  api.keys.ArrowLeft=true;advance(2);api.keys.ArrowLeft=false;
  assert(api.game.cameraX<right-400);
  assert(Math.abs(api.game.x-api.game.cameraX-api.W/2)<55);
  api.draw();assert.equal(stack.length,0);
});
test('monster slots are rare, at most three coexist, and most begin as pixel people',()=>{
  fresh();quiet();
  for(let i=0;i<10;i++){api.game.monsters=[];api.encounter();assert.equal(api.game.monsters.length,1);}
  fresh(22);assert.equal(api.game.monsterTimer,10);
  api.game.rushTimer=1e6;api.game.nextMemory=1e6;
  const seen=new Set();
  advance(20,()=>{
    for(const m of api.game.monsters){seen.add(m);if(m.y>api.H-250)m.life=0;}
    assert(api.game.monsters.length<=3);
  });
  assert.equal(seen.size,1,'early encounters should be occasional among many people');
  for(let i=0;i<80;i++){
    api.game.d=0;api.game.monsterTimer=0;api.game.monsters=[];api.update(dt);
    assert(api.game.monsterTimer>=11.99&&api.game.monsterTimer<=18,'early slot is outside 12–18 seconds');
  }
  api.game.monsters=[];
  for(let i=0;i<20;i++)api.spawnMonster();
  assert.equal(api.game.monsters.length,3);
  fresh(1001);quiet();let hidden=0;
  for(let i=0;i<1000;i++){
    api.game.monsters=[];api.spawnMonster();
    if(!api.game.monsters[0].revealed&&api.game.monsters[0].disguised)hidden++;
  }
  assert(hidden>=850,'fewer than 85% of encounters begin disguised');
  assertSafe();console.log('Early encounters in twenty seconds: '+seen.size);
});
test('time loops reveal, replay twice, retire, and can be broken with boost',()=>{
  fresh();quiet();api.spawnMonster('loop');
  const m=api.game.monsters[0];m.x=110;
  assert.equal(m.kind,'loop');assert.equal(m.revealed,false);
  advance(35,()=>{m.x=api.game.x-240;});assert(api.game.loopCount>=3);assert.equal(m.repeats,0);
  assert(!api.game.monsters.includes(m));assertSafe();
  api.spawnMonster('loop');const other=api.game.monsters.at(-1);api.useBoost();assert.equal(other.life,0);
});
test('twenty-five simulated minutes keep collections bounded and permit continued survival',()=>{
  fresh(314159);let deaths=0,memories=0,boosts=0;
  const maxima={monsters:0,traffic:0,pickups:0,particles:0,pedestrians:0};
  for(let frame=0;frame<25*60*60;frame++){
    const g=api.game;
    if(!g.running){deaths++;api.begin();continue;}
    if(g.memoryTimer===-1){api.chooseDoor(g.memory.answer);memories++;}
    const target=g.pickups.filter(p=>p.y<api.H-105).sort((a,b)=>b.y-a.y)[0];
    const threats=g.monsters.filter(m=>m.revealed&&m.y>api.H-290&&m.y<api.H-75);
    const urgent=threats.some(m=>Math.abs(m.x-g.x)<60&&m.y>api.H-240);
    if(g.boost&&g.burst<=0&&(urgent||g.forcedTimer>0&&g.forcedTimer<3)){api.useBoost();boosts++;}
    let tx=target?target.x:g.x;
    if(urgent&&!g.boost&&!g.burst)tx=g.x+(threats[0].x<g.x?90:-90);
    api.keys.ArrowLeft=tx<g.x-4;api.keys.ArrowRight=tx>g.x+4;
    api.update(dt);
    for(const name of Object.keys(maxima)){maxima[name]=Math.max(maxima[name],g[name].length);assert(g[name].length<150,name+' grew unbounded');}
    assert(g.monsters.length<=3);assert(g.pedestrians.length<=40);assert(g.traffic.length<=12);
    if(frame%180===0){api.draw();assert.equal(stack.length,0);}
  }
  assert(boosts>0&&memories>0);
  console.log(JSON.stringify({simulatedMinutes:25,deaths,memories,boosts,maxima}));
});
console.log(passed+'/'+total+' regression groups passed. Canvas/DOM calls are simulated; artwork is checked separately with native canvas renders.');
