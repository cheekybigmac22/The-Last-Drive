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
const source = ['roads.js','world.js','pixel-art.js','monster-art.js','minigames.js','game.js'].map(file=>fs.readFileSync(path.join(repo,file),'utf8')).join('\n');
let random = () => 0.999999;
let sequence = 1;
const timers = new Map();
const animationFrames = new Map();
const listeners = new Map();
let drawCalls = 0;
let atlasDrawCalls = 0;
let atlasCoordinates = [];
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
    if (operation === 'drawImage' && args[0] instanceof FakeImage) {atlasDrawCalls++;atlasCoordinates.push(args.slice(1));if(atlasCoordinates.length>300)atlasCoordinates.shift();}
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
    id, tagName: tag.toLowerCase(), textContent: '', style:{},
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
  begin, reset, draw, update, useBoost, updateMainWoman, rewindWorld, pursue, spawnBoost, spawnMonster, spawnPedestrian, spawnTraffic, updateTraffic, encounter, startMemoryGame, chooseDoor,
  RoadNetwork, World, MonsterArt, MiniGames, startChallenge, updateBoost,
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


test('ten spatial biomes and forty animated monster identities render finite coordinates',()=>{
  fresh();quiet();assert.equal(api.biomes.length,10);
  const found=new Map();
  for(let x=-120000;x<=120000;x+=3000)for(let y=-120000;y<=3000;y+=3000){const b=api.World.biome(x,y);if(!found.has(b))found.set(b,{x,y});}
  assert.equal(found.size,10);
  for(const [b,p] of found){Object.assign(api.game,p,{biome:b,cameraX:p.x-320,cameraY:p.y-410});api.draw();assert.equal(stack.length,0);}
  for(let id=0;id<40;id++){api.game.monsters=[];api.spawnMonster();Object.assign(api.game.monsters[0],{id,revealed:true,revealProgress:1,moving:true,phase:id*.3});api.draw();}
  assert(atlasDrawCalls>=8,'all eight silhouettes should load their own texture');assert(api.MonsterArt.cachedFrames>8&&api.MonsterArt.cachedFrames<=136);
});
test('bike stays centered, moves in all four directions, and stops on release',()=>{
  fresh();quiet();const g=api.game;api.update(.04);assert.equal(g.x,320);assert.equal(g.y,0);assert.equal(g.d,0);
  for(const [key,axis,sign] of [['w','y',-1],['s','y',1],['a','x',-1],['d','x',1]]){
    const before=g[axis];api.keys[key]=true;api.update(.04);delete api.keys[key];assert((g[axis]-before)*sign>0);
    assert.equal(g.x-g.cameraX,320);assert.equal(g.y-g.cameraY,410);
  }
  const x=g.x,y=g.y,d=g.d;api.update(.04);assert.equal(g.x,x);assert.equal(g.y,y);assert.equal(g.d,d);assert.equal(g.moving,false);
});
test('running animation changes limb geometry and pursuit cuts inside a rider circle',()=>{
  fresh();quiet();api.spawnMonster();const g=api.game,m=g.monsters[0];
  Object.assign(m,{revealed:true,revealProgress:1,moving:true,phase:0});api.draw();m.phase=1;api.draw();
  const profile={hip:.52,stride:1,arms:1,bob:1};
  const left=api.MonsterArt.pose(.3,.95,Math.PI/2,true,profile),right=api.MonsterArt.pose(.7,.95,Math.PI/2,true,profile);
  assert(left.y<right.y-.05,'one foot must lift while the opposite foot plants');
  const next=api.MonsterArt.pose(.3,.95,Math.PI*1.5,true,profile);assert(next.y>left.y+.05);
  assert.equal(JSON.stringify(api.MonsterArt.pose(.3,.95,2,false,profile)),JSON.stringify({x:.3,y:.95}));
  g.monsters=[];g.woman={x:320,y:-70,path:[],repath:0,phase:0};let smallestRadius=Infinity;
  for(let i=0;i<600;i++){const t=i/60;g.x=320+100*Math.cos(t*2);g.y=-300+100*Math.sin(t*2);api.pursue(g.woman,1/60,150);smallestRadius=Math.min(smallestRadius,Math.hypot(g.woman.x-320,g.woman.y+300));}
  assert(smallestRadius<85,'woman should cut inside the circle instead of tracing the rider trail');
});
test('opening is one straight highway followed by a natural biome, not a monster biome',()=>{
  fresh();quiet();const roads=api.RoadNetwork.segments(120,-700,520,700);assert(roads.length===1&&roads[0].id==='highway');assert.equal(roads[0].x1,roads[0].x2);
  api.game.y=-3219;api.game.woman.y=-2950;api.keys.w=true;api.update(.04);
  assert.equal(api.game.free,true);assert([1,2,3,7,8,9].includes(api.game.biome));
  for(const box of [[2000,-6000,4000,-4000],[-5000,3000,-1000,6000],[-1000,-9000,1000,-3500]])assert.equal(api.RoadNetwork.segments(...box).length,0);
  api.game.x=5000;api.game.y=-6000;api.game.traffic=[];api.spawnTraffic();assert.equal(api.game.traffic.length,0);
  api.game.pedestrians=[];api.spawnPedestrian(true);assert(Math.hypot(api.game.pedestrians[0].x-5000,api.game.pedestrians[0].y+6000)<800,'walkers should not be pulled back onto the distant highway');
});
test('biomes have stable irregular boundaries in both axes and vary in size',()=>{
  const samples=[],types=new Set();
  for(const axis of ['x','y']){
    let previous=-1,start=0;const widths=[];
    for(let n=-60000;n<=60000;n+=100){const x=axis==='x'?n:3000,y=axis==='y'?n:-6000,b=api.World.biome(x,y);types.add(b);assert.equal(api.World.biome(x,y),b);
      if(previous!==b){if(previous>=0)widths.push(n-start);start=n;previous=b;}}
    assert(widths.length>8);assert(new Set(widths).size>4);assert(widths.reduce((a,b)=>a+b,0)/widths.length>3000,'regions should be substantially larger than before');samples.push(widths);
  }
  assert(types.size>=6);
});
test('landmarks are deterministic, solid, varied, and swept movement cannot tunnel',()=>{
  const props=[];for(let x=-30000;x<=30000;x+=6000)for(let y=-30000;y<=0;y+=6000)props.push(...api.World.props(x,y,x+900,y+900));assert(props.length>100);
  const kinds=new Set(props.map(p=>p.kind));assert(kinds.has('pyramid')&&kinds.has('dune')&&kinds.has('temple')&&kinds.has('lighthouse'));
  for(const p of props.slice(0,80)){
    assert(api.World.blocked(p.x,p.y,13));const copy=api.World.props(p.x,p.y,p.x,p.y).find(q=>q.id===p.id);assert.equal(JSON.stringify(copy),JSON.stringify(p));
  }
  const p=props.find(p=>api.World.clear(p.x-p.rx-100,p.y,p.x-p.rx-14,p.y,13));
  const actor={x:p.x-p.rx-100,y:p.y};api.World.move(actor,400,0,13);assert(actor.x<=p.x-p.rx-13+1e-6);assert(!api.World.blocked(actor.x,actor.y,13));
});
test('woman starts far away on screen, directly intercepts, and catches an idle rider',()=>{
  fresh();quiet();let g=api.game;assert.equal(g.woman.y-g.cameraY,710);assert.equal(g.mainWoman,0);
  const ox=g.woman.x,oy=g.woman.y;api.update(.04);assert(g.woman.y<oy);assert.equal(g.woman.x,ox);
  advance(5);assert.equal(g.running,false);assert.equal(elements.get('#death-title').textContent,'SHE CAUGHT YOU');
  fresh();quiet();g=api.game;g.woman.x=450;g.woman.y=240;api.updateMainWoman(.04);assert(g.woman.x<450&&g.woman.y<240,'pursuit must cut toward current position');
});
test('pursuer navigates around a solid landmark rather than passing through it',()=>{
  fresh();quiet();
  const props=api.World.props(-4000,-7000,4000,-4000);
  let chosen;
  for(const p of props){const a={x:p.x-p.rx-45,y:p.y},b={x:p.x+p.rx+45,y:p.y};if(api.World.blocked(a.x,a.y,10)||api.World.blocked(b.x,b.y,13))continue;
    const path=api.World.route(a,b,10);if(path.length>1){chosen={a,b,path};break;}}
  assert(chosen,'should find a route around an obstacle');
  Object.assign(api.game,chosen.b);const actor={...chosen.a,path:chosen.path,repath:1,phase:0};
  for(let i=0;i<600&&Math.hypot(actor.x-api.game.x,actor.y-api.game.y)>10;i++){api.pursue(actor,1/60,140);assert(!api.World.blocked(actor.x,actor.y,10));}
  assert(Math.hypot(actor.x-api.game.x,actor.y-api.game.y)<12,'pursuer stalled instead of routing around obstacle');
});
test('woman transformation takes ten active minutes and pauses for memory doors',()=>{
  fresh();quiet();const g=api.game;
  for(const [time,expected] of [[0,0],[150,.25],[300,.5],[599,599/600],[600,1],[1200,1]]){g.time=time;api.updateMainWoman(0);assert.equal(g.mainWoman,expected);}
  g.time=300;api.startMemoryGame();const time=g.time,y=g.woman.y;advance(3);assert.equal(g.memoryTimer,-1);assert.equal(g.time,time);assert.equal(g.woman.y,y);assert.equal(elements.get('#memory-number').textContent,'');
  api.chooseDoor(g.memory.answer);assert.equal(g.memoryTimer,0);assert.equal(g.boost,1);
});
test('rare people transform into animated lethal monsters; ordinary walkers are harmless',()=>{
  fresh(123);quiet();let hidden=0;
  for(let i=0;i<100;i++){api.game.monsters=[];api.spawnMonster();hidden+=!api.game.monsters[0].revealed;}assert(hidden>=85);
  for(let id=0;id<40;id++){fresh();quiet();api.spawnMonster('chase');const m=api.game.monsters[0];Object.assign(m,{id,x:api.game.x,y:api.game.y,revealed:true,revealProgress:1,revealGrace:0});api.update(.01);assert.equal(api.game.running,false);}
  fresh();quiet();api.game.pedestrians.push({x:320,y:0,vx:0,vy:0,id:0,phase:0});api.update(.01);assert.equal(api.game.running,true);
});
test('held boost drains proportionally, stops on release and displays remaining fuel',()=>{
  fresh();quiet();const g=api.game;g.pickups=[];g.pickupTimer=1e6;
  api.keys[' ']=true;api.update(.04);assert.equal(g.boost,1,'standing still must not burn fuel');
  api.keys.w=true;const before=g.y;api.update(.04);assert(before-g.y>14);assert(Math.abs(g.boost-(1-.04*.18))<1e-8);
  delete api.keys[' '];const fuel=g.boost;api.update(.04);assert.equal(g.boost,fuel);assert.equal(g.burst,0);
  assert.equal(elements.get('#boost-meter').value,fuel);
  api.keys.Shift=true;g.boost=.001;api.update(.04);assert.equal(g.boost,0);api.update(.04);assert.equal(g.burst,0);
  g.pickups.push({x:g.x,y:g.y-8,pulse:0});delete api.keys.Shift;api.update(.04);assert(Math.abs(g.boost-.35)<1e-8);
  listeners.get('window:blur')();assert.equal(g.burst,0);
});
test('human transformations are animated but harmless for the full warning and grace period',()=>{
  fresh();quiet();const g=api.game;g.woman.x=320;g.woman.y=900;
  api.spawnMonster('disguise');const m=g.monsters[0];Object.assign(m,{x:g.x,y:g.y,kind:'chase'});
  for(let i=0;i<160;i++){g.woman.y=900;api.update(.02);assert(g.running,'warning contact must not kill');}
  assert(m.revealProgress===1&&m.revealGrace>0);assert.equal(m.moving,false);
  for(let i=0;i<40&&g.running;i++){g.woman.y=900;api.update(.02);}
  assert.equal(g.running,false,'fully armed monsters must remain lethal');
});
test('new challenges pause pursuit and fuel, scale difficulty, and safely reward or fail',()=>{
  fresh();quiet();let g=api.game;g.challengeIndex=1;g.time=0;g.boost=.2;api.startChallenge();
  assert(api.MiniGames.active);const early=api.MiniGames.state,earlyLength=early.sequence.length,earlyBeat=early.beat,time=g.time,wy=g.woman.y;
  api.update(4);assert.equal(g.time,time);assert.equal(g.woman.y,wy);assert.equal(g.boost,.2);
  for(const arrow of [...early.sequence])api.MiniGames.input(arrow);
  assert(!api.MiniGames.active);assert.equal(g.boost,.7);assert(g.resumeGrace>0);
  g.challengeIndex=1;g.time=800;api.startChallenge();const hard=api.MiniGames.state;assert(hard.sequence.length>earlyLength&&hard.beat<earlyBeat);
  api.update(10);api.MiniGames.input((hard.sequence[0]+1)%4);assert(!api.MiniGames.active);assert(g.running&&g.resumeGrace>0);
  g.challengeIndex=2;g.time=0;api.startChallenge();const easy=api.MiniGames.state,wide=easy.width;easy.position=easy.left+easy.width/2;api.MiniGames.input('stop');assert(!api.MiniGames.active);
  g.challengeIndex=2;g.time=800;api.startChallenge();const difficult=api.MiniGames.state;assert(difficult.width<wide&&difficult.required>1);
  difficult.position=0;api.MiniGames.input('stop');assert(!api.MiniGames.active);assert(g.running);
});
test('time loops restore the exact decorated location without reversing the ten-minute clock',()=>{
  fresh();quiet();const g=api.game;api.keys.w=true;advance(8);const target=g.history[Math.max(0,g.history.length-28)];
  const before=JSON.stringify(api.World.props(target.x-400,target.y-400,target.x+400,target.y+400)),time=g.time,d=g.d;
  assert(api.rewindWorld());assert.equal(g.x,target.x);assert.equal(g.y,target.y);assert.equal(g.time,time);assert.equal(g.d,d);
  assert.equal(JSON.stringify(api.World.props(g.x-400,g.y-400,g.x+400,g.y+400)),before);assert.equal(g.loopCount,1);assert(g.loopCooldown>0);
});
test('extended simulation bounds actors, scenery cache, and rewind history',()=>{
  fresh(9);let deaths=0,memories=0;
  // A deterministic road pilot with retries exercises turns, collisions and chases.
  for(let frame=0;frame<18000;frame++){
    if(!api.game.running){deaths++;fresh(frame);}
    const g=api.game;for(const k of Object.keys(api.keys))delete api.keys[k];
    if(g.memoryTimer===-1){api.chooseDoor(g.memory.answer);memories++;}
    api.keys.w=true;
    if(g.free&&frame%600<300)api.keys.a=true;
    if(g.free&&frame%600>=300)api.keys.d=true;
    if(g.boost&&Math.hypot(g.woman.x-g.x,g.woman.y-g.y)<180)api.keys[' ']=true;
    if(api.MiniGames.active){const s=api.MiniGames.state;if(s.kind==='sequence'&&s.stage==='input')api.MiniGames.input(s.sequence[s.index]);else if(s.kind==='timing'&&s.position>s.left&&s.position<s.left+s.width)api.MiniGames.input('stop');}
    api.update(.04);
    assert(g.monsters.length<=3&&g.pickups.length<=8&&g.pedestrians.length<=36&&g.traffic.length<=8&&g.history.length<=48);
    assert(!api.World.blocked(g.x,g.y,13));assert(api.World.cacheSize<=3000);
    if(frame%1000===0)api.draw();
  }
  console.log(JSON.stringify({simulatedMinutes:12,retries:deaths,memories,cache:api.World.cacheSize}));
});
console.log(passed+'/'+total+' regression groups passed. Logic uses a simulated DOM; real artwork is checked separately with native canvas.');
