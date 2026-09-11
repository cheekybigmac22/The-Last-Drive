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
const source = ['roads.js','world.js','pixel-art.js','emergence.js','monster-art.js','minigames.js','horror-audio.js','game.js'].map(file=>fs.readFileSync(path.join(repo,file),'utf8')).join('\n');
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
  begin, reset, draw, update, useBoost, updateMainWoman, rewindWorld, pursue, spawnBoost, spawnMonster, spawnRusher, monsterVisible, spawnPedestrian, spawnTraffic, updateTraffic, encounter, startMemoryGame, chooseDoor,
  RoadNetwork, World, MonsterArt, MiniGames, Emergence, transformationDuration, startChallenge, updateBoost,
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
  assert.equal(api.MonsterArt.textureCount,8);assert.equal(atlasDrawCalls,0,'legacy generated atlas must not render');assert(api.MonsterArt.cachedFrames>8&&api.MonsterArt.cachedFrames<=136);
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
test('woman starts off screen, directly intercepts, and catches an idle rider',()=>{
  fresh();quiet();let g=api.game;assert.equal(g.woman.y-g.cameraY,1060);assert.equal(g.mainWoman,0);
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
  for(const [time,expected] of [[0,0],[150,0],[300,0],[599,.45],[600,1],[1200,1]]){g.time=time;api.updateMainWoman(0);assert.equal(g.mainWoman,expected);}
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
  for(let i=0;i<Math.floor((api.transformationDuration()+.4)/.02);i++){g.woman.y=900;api.update(.02);assert(g.running,'warning contact must not kill');}
  assert(m.revealProgress===1&&m.revealGrace>0);assert.equal(m.moving,false);
  for(let i=0;i<40&&g.running;i++){g.woman.y=900;api.update(.02);}
  assert.equal(g.running,false,'fully armed monsters must remain lethal');
});
test('forty emergence identities have distinct poses, settle cleanly, and speed up with time',()=>{
  fresh();quiet();const signatures=new Set();
  for(let id=0;id<40;id++){
    const poses=[.2,.5,.8].map(t=>api.Emergence.pose(id,t));
    signatures.add(JSON.stringify(poses.map(({name,...p})=>p)));
    const p=api.Emergence.pose(id,1);assert.equal(p.x,0);assert.equal(p.y,0);assert.equal(p.sx,1);assert.equal(p.sy,1);assert.equal(p.angle,0);
    api.game.monsters=[];api.spawnMonster('disguise');Object.assign(api.game.monsters[0],{id,revealed:true,revealProgress:.5});api.draw();
  }
  assert.equal(signatures.size,40);
  api.game.time=0;assert(Math.abs(api.transformationDuration()-2.8/1.5)<1e-8);
  api.game.time=300;const middle=api.transformationDuration();assert(middle<2.8/1.5&&middle>1.4);
  api.game.time=900;assert.equal(api.transformationDuration(),1.4);
});
test('population is sparse and surviving buildings have persistent landmark labels',()=>{
  fresh();assert.equal(api.game.pedestrians.length,4);
  for(let i=0;i<30;i++)api.spawnPedestrian(true);assert.equal(api.game.pedestrians.length,6);
  const props=api.World.props(-12000,-12000,12000,-5000),buildings=props.filter(p=>p.landmark);
  assert(buildings.length>0&&buildings.length<props.length*.3);
  for(const p of buildings.slice(0,30))assert.equal(api.World.props(p.x,p.y,p.x,p.y).find(q=>q.id===p.id).seed,p.seed);
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
test('monster speed stays above riding and below boost across the whole stride',()=>{
  fresh();quiet();for(let i=0;i<40;i++){api.game.monsters=[];api.spawnMonster('chase');const m=api.game.monsters[0];assert(m.speed*.82>220);assert(m.speed*1.18<380);}
  assert(315*.82>220&&315*1.18<380);
});
test('sprint starts at the screen edge even when the woman was far away',()=>{
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    fresh();quiet();const g=api.game;g.heading=heading;g.woman.x=90000;g.woman.y=90000;g.sprintWarning=.01;
    api.updateMainWoman(.01);const gap=Math.hypot(g.woman.x-g.x,g.woman.y-g.y);
    assert(gap>240&&gap<510);assert(!api.World.blocked(g.woman.x,g.woman.y,10));assert.equal(g.forcedTimer,7);
  }
});
test('sharp weaving forces a pursuer to brake and turn instead of snapping direction',()=>{
  fresh();quiet();const g=api.game;g.x=320;g.y=-300;
  const actor={x:320,y:0,path:[],repath:0,phase:0,heading:Math.PI/2};
  api.pursue(actor,.04,280);assert(Math.abs(actor.heading-Math.PI/2)<=2.8*.04+.001);
  assert(Math.hypot(actor.x-320,actor.y)<5,'a reverse turn should cost pursuit speed');
  actor.stumble=.45;const x=actor.x,y=actor.y;api.pursue(actor,.04,280);assert.equal(actor.x,x);assert.equal(actor.y,y);
});
test('sprint attacks are warned, give no free fuel, and saved boost permits escape',()=>{
  function run(boost){
    fresh();quiet();const g=api.game;g.pickups=[];g.pickupTimer=1e6;g.woman.y=520;g.sprintWarning=2.5;g.monsters=[];api.keys.w=true;
    let warned=false;
    for(let i=0;i<600&&g.running;i++){if(g.sprintWarning>0){assert.equal(g.forcedTimer,0);warned=true;}
      if(boost&&g.forcedTimer>0&&Math.hypot(g.x-g.woman.x,g.y-g.woman.y)<170)api.keys[' ']=true;else delete api.keys[' '];
      api.update(.02);if(warned&&g.sprintWarning===0&&g.forcedTimer===0)break;
    }
    assert(warned);assert.equal(g.pickups.length,0);return g.running;
  }
  assert.equal(run(false),false,'normal riding alone should lose the sprint');
  assert.equal(run(true),true,'a saved tank must provide a viable escape on a clear route');
});
test('no homes generate and corrupted areas have ominous landmarks',()=>{
  const kinds=new Set();
  for(let x=-120000;x<=120000;x+=20000)for(let y=-120000;y<=0;y+=20000)for(const p of api.World.props(x,y,x+1000,y+1000)){
    assert(!['house','barn','cabin'].includes(p.kind));kinds.add(p.kind);
  }
  assert(kinds.has('watcher')&&kinds.has('gate')&&kinds.has('obelisk'));
});
test('synthesized horror sound waits for activation, caps voices, and respects mute',()=>{
  let oscillators=0;const pending=[];
  const parameter=()=>({value:0,setValueAtTime(v){assert(Number.isFinite(v));},exponentialRampToValueAtTime(v){assert(v>0);},setTargetAtTime(v){assert(Number.isFinite(v));}});
  const node=()=>({gain:parameter(),frequency:parameter(),connect(){},disconnect(){},start(){},stop(){pending.push(()=>this.onended?.());}});
  class AudioMock{constructor(){this.state='running';this.sampleRate=8000;this.currentTime=0;this.destination={};}resume(){return Promise.resolve();}createGain(){return node();}createOscillator(){oscillators++;return node();}createBiquadFilter(){return node();}createBuffer(ch,len){return {getChannelData:()=>new Float32Array(len)};}createBufferSource(){return node();}}
  const env={AudioContext:AudioMock,Math,MiniGames:{active:false}};vm.createContext(env);vm.runInContext(fs.readFileSync(path.join(repo,'horror-audio.js'),'utf8')+';globalThis.audio=HorrorAudio;',env);
  env.audio.cue('warning');assert.equal(oscillators,0);env.audio.init();assert.equal(oscillators,1);
  for(let i=0;i<20;i++)env.audio.cue('reveal');assert.equal(oscillators,7,'only six temporary voices may overlap');
  env.audio.toggle();pending.forEach(f=>f());env.audio.cue('death');assert.equal(oscillators,7);
  env.audio.update({running:false,memoryTimer:0,fear:1},.1);
});
test('rushers enter from all four edges and are not discarded before first sight',()=>{
  for(const side of ['top','right','bottom','left']){
    fresh();quiet();api.spawnRusher(side,false);const g=api.game,m=g.monsters[0];
    assert(m&&m.entrySide===side&&m.revealed&&!m.disguised);assert.equal(api.monsterVisible(m),false);
    const distance=Math.hypot(m.x-g.x,m.y-g.y);api.update(.02);
    assert(g.monsters.includes(m),'offscreen entrant must be allowed to approach');assert(Math.hypot(m.x-g.x,m.y-g.y)<distance);
  }
});
test('a seen monster ends its chase after leaving the camera, without reviving',()=>{
  fresh();quiet();api.spawnMonster('chase');const g=api.game,m=g.monsters[0];
  Object.assign(m,{x:320,y:-100,revealed:true,revealProgress:1,revealGrace:0});api.update(.02);assert(m.seen);
  m.x=g.x+750;m.y=g.y;
  for(let i=0;i<22;i++)api.update(.02);
  assert(!g.monsters.includes(m));assert.equal(g.running,true);
});
test('faster-than-boost sprinters exhaust their limited stamina and stop',()=>{
  fresh();quiet();const g=api.game;g.free=true;g.woman.y=2000;api.spawnRusher('top',true);const m=g.monsters[0];
  Object.assign(m,{x:320,y:-330,entryWarning:0,seen:true});assert(m.speed*.82>380);
  api.keys.s=true;api.keys[' ']=true;advance(1.8);assert(g.running);assert(m.exhausted);assert.equal(m.moving,false);
  const x=m.x,y=m.y;advance(.3);assert.equal(m.x,x);assert.equal(m.y,y);
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
    assert(g.monsters.length<=1&&g.pickups.length<=2&&g.pedestrians.length<=6&&g.traffic.length<=8&&g.history.length<=48);
    assert(!api.World.blocked(g.x,g.y,13));assert(api.World.cacheSize<=3000);
    if(frame%1000===0)api.draw();
  }
  console.log(JSON.stringify({simulatedMinutes:12,retries:deaths,memories,cache:api.World.cacheSize}));
});
console.log(passed+'/'+total+' regression groups passed. Logic uses a simulated DOM; real artwork is checked separately with native canvas.');
