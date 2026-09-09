const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const startScreen = document.querySelector('#start-screen');
const death = document.querySelector('#death');
const start = document.querySelector('#start');
const restart = document.querySelector('#restart');
const distanceEl = document.querySelector('#distance');
const biomeEl = document.querySelector('#biome');
const boostEl = document.querySelector('#boost');
const eventEl = document.querySelector('#event');
const memory = document.querySelector('#memory');
const memoryPhase = document.querySelector('#memory-phase');
const memoryNumber = document.querySelector('#memory-number');
const doors = document.querySelector('#doors');
const leftDoor = document.querySelector('#door-left');
const rightDoor = document.querySelector('#door-right');

const W = canvas.width;
const H = canvas.height;
const keys = {};
let game = null;
let last = 0;
let raf = 0;
let eventTimeout = null;

const biomes = [
  ['HIGHWAY', 0, 2800],
  ['DESERT', 2800, 5500],
  ['JUNGLE', 5500, 8500],
  ['DEAD CITY', 8500, 11500],
  ['RED FOREST', 11500, 14500],
  ['THE HOLLOW', 14500, 18000],
  ['MONSTER WORLD', 18000, Infinity]
];

const monsterTypes = [
  'The Stranger','The Long Walker','The Hollow Woman','The Bent Man','The Needle',
  'The Watcher','The Passenger','The Twin','The Runner','The Smiler','The Tall Child',
  'The Road Bride','The Antler','The Crawling One','The Window Face','The Backward Walker',
  'The Pale Driver','The Bellman','The Split Figure','The Thin One','The Mirror Twin',
  'The Sleeper','The Red Giant','The Distant Woman','The Bent Child','The Long Arms',
  'The Empty Suit','The Black Deer','The False Friend','The Stilt Man','The Face in the Fog',
  'The Double','The Crooked One','The Runner Two','The Tower','The Pale Group','The Mouth',
  'The Guest','The Red Walker','The Last Stranger'
];

const disguise = new Set([0,2,9,10,11,18,24,26,28,32,37]);
const chase = new Set([1,4,8,13,16,22,25,29,33,38]);
const loopers = new Set([6,7,15,20,23,31,35]);
const storyBeats = [
  [650, 'A WOMAN IS WALKING BEHIND YOU'], [2600, 'THE CITY ENDS. SHE DOES NOT.'],
  [5600, 'THE TREES ARE WATCHING THE ROAD'], [9100, 'YOU HAVE DRIVEN HERE BEFORE'],
  [12400, 'THE SKY HAS TURNED TO RUST'], [15200, 'DON’T LOOK AT THE WINDOWS'],
  [18000, 'WELCOME BACK TO THE HOLLOW']
];

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

function showEvent(text, seconds = 1.8) {
  eventEl.textContent = text;
  clearTimeout(eventTimeout);
  eventTimeout = setTimeout(() => { eventEl.textContent = ''; }, seconds * 1000);
}

function reset() {
  clearTimeout(eventTimeout);
  for (const key of Object.keys(keys)) delete keys[key];
  game = {
    running: false,
    d: 0,
    scroll: 0,
    setback: 0,
    x: W / 2,
    boost: 0,
    burst: 0,
    mainWoman: 0,
    mainRush: 0,
    monsterTimer: 3.5,
    memoryTimer: 0,
    memory: null,
    monsters: [],
    traffic: [],
    pickups: [],
    particles: [],
    marks: Array.from({ length: 30 }, (_, i) => i * 45),
    shake: 0,
    red: 0,
    biome: 0,
    loopCount: 0,
    forcedTimer: 0,
    storyIndex: 0,
    worldSeed: Math.random() * 10000
  };
  memory.classList.add('hidden');
  memoryPhase.classList.remove('hidden');
  doors.classList.add('hidden');
  death.classList.add('hidden');
  distanceEl.textContent = '0m';
  biomeEl.textContent = 'HIGHWAY';
  boostEl.textContent = '—';
  eventEl.textContent = '';
  draw();
}

function isHighway() { return game.d < 2800; }

function currentBiome() {
  const found = biomes.findIndex(b => game.d >= b[1] && game.d < b[2]);
  return found < 0 ? 6 : found;
}

function updateBiome() {
  const next = currentBiome();
  if (next !== game.biome) {
    game.biome = next;
    showEvent(biomes[next][0], 2.2);
  }
  biomeEl.textContent = biomes[next][0];
}

function spawnBoost() {
  game.pickups.push({
    x: isHighway() ? rand(W * .35, W * .65) : rand(35, W - 35),
    y: -35,
    pulse: rand(0, Math.PI * 2)
  });
}

function spawnTraffic() {
  if (!isHighway() && game.biome < 3) return;
  const g = roadGeometry();
  const lane = pick([-.34, .34]);
  game.traffic.push({ x: g.centerFar + g.farHalf * lane, y: rand(-190, -45), lane,
    tone: pick(['#cb6250', '#d7d2bc', '#4b7890', '#30333b']), speed: rand(.64, .88), phase: Math.random() * 8 });
}

function useBoost() {
  if (!game.running || game.memoryTimer !== 0 || game.boost < 1) return;
  game.boost = 0;
  game.burst = 2.8;
  game.mainRush = 0;
  game.forcedTimer = 0;
  game.setback = 0;
  for (const m of game.monsters) {
    if (m.kind === 'loop' || Math.abs(m.y - (H - 115)) < 160) {
      m.life = 0;
    }
  }
  game.shake = .25;
  showEvent('BOOST', 1.1);
  for (let i = 0; i < 18; i++) {
    game.particles.push({ x: game.x + rand(-16,16), y: H - 92, life: .55, vx: rand(-55,55), vy: rand(60,190), kind: 'boost' });
  }
}

function spawnMonster(forceKind = null) {
  const available = Math.min(monsterTypes.length, 7 + Math.floor(game.d / 500));
  let id = Math.floor(Math.random() * available);
  if (forceKind === 'disguise') {
    const list = [...disguise].filter(n => n < available);
    if (list.length) id = pick(list);
  } else if (forceKind === 'chase') {
    const list = [...chase].filter(n => n < available);
    if (list.length) id = pick(list);
  }
  const kind = chase.has(id) ? 'chase' : loopers.has(id) ? 'loop' : 'always';
  game.monsters.push({
    id,
    name: monsterTypes[id],
    x: isHighway() ? rand(W * .32, W * .68) : rand(35, W - 35),
    y: -110,
    age: 0,
    kind,
    revealed: !disguise.has(id) && kind !== 'loop',
    repeats: kind === 'loop' ? 2 : 0,
    revealDistance: rand(0, 1),
    speed: rand(30, 78) + Math.min(game.d, 26000) * .0012,
    scale: rand(.78, 1.18),
    phase: rand(0, Math.PI * 2),
    alpha: 0,
    life: 8,
    encounter: true
  });
}

function encounter() {
  const danger = smooth(0, 18000, game.d);
  const chance = .34 + danger * .52;
  if (Math.random() < chance) spawnMonster(Math.random() < .58 ? 'disguise' : null);
  if (game.d > 1000 && Math.random() < .10 + danger * .18) spawnMonster('chase');
}

function startMemoryGame() {
  if (!game.running || game.memoryTimer !== 0 || game.forcedTimer > 0) return;
  const d = game.d;
  const digits = d < 1500 ? 2 : d < 4500 ? 3 : d < 8000 ? 4 : d < 11500 ? 5 : d < 14500 ? 6 : 7;
  let answer = String(Math.floor(rand(10 ** (digits - 1), 10 ** digits)));
  if (digits === 2 && Math.random() < .35) answer = '22';
  const fake = answer.split('');
  const at = Math.floor(Math.random() * digits);
  fake[at] = String((Number(fake[at]) + (Math.random() < .5 ? 1 : 9)) % 10);
  game.memory = { answer, fake: fake.join('') };
  game.memoryTimer = Math.max(1.55, 2.5 - d / 18000);
  memoryNumber.textContent = answer;
  memoryPhase.classList.remove('hidden');
  doors.classList.add('hidden');
  memory.classList.remove('hidden');
  showEvent('REMEMBER', 1.4);
}

function showMemoryDoors() {
  if (!game.memory) return;
  game.memoryTimer = -1;
  memoryPhase.classList.add('hidden');
  memoryNumber.textContent = '';
  doors.classList.remove('hidden');
  const a = game.memory.answer;
  const b = game.memory.fake;
  if (Math.random() < .5) {
    leftDoor.textContent = a;
    rightDoor.textContent = b;
  } else {
    leftDoor.textContent = b;
    rightDoor.textContent = a;
  }
}

function chooseDoor(value) {
  if (!game.memory || game.memoryTimer !== -1) return;
  const correct = value === game.memory.answer;
  game.memory = null;
  game.memoryTimer = 0;
  memory.classList.add('hidden');
  if (correct) {
    game.boost = 1;
    showEvent('YOU REMEMBERED', 1.2);
  } else {
    // The player can never die from the memory test. It is a scare, not a game over.
    game.red = .9;
    game.shake = .7;
    game.setback = 2;
    showEvent('WRONG — KEEP DRIVING', 1.8);
  }
}

function mainWomanRush() {
  if (game.forcedTimer > 0 || game.burst > 0 || game.memoryTimer !== 0) return;
  game.mainRush = .25;
  game.forcedTimer = 6;
  game.rushWarned = false;
  if (!game.boost) {
    // This pickup reaches the rider in under two seconds, before the chase deadline.
    game.pickups.push({ x: game.x, y: H - 280, pulse: 0 });
  }
  game.red = Math.max(game.red, .75);
  game.shake = Math.max(game.shake, .55);
  showEvent('SHE IS CLOSER', 1.6);
}

function updateMainWoman(dt, danger) {
  // Her visual transformation takes most of the first half of the journey.
  game.mainWoman = smooth(2200, 10500, game.d);
  if (game.forcedTimer > 0) {
    game.forcedTimer = Math.max(0, game.forcedTimer - dt);
    game.mainRush = clamp(1 - game.forcedTimer / 8, .25, 1);
    if (game.forcedTimer <= 3 && !game.rushWarned) {
      game.rushWarned = true;
      showEvent(game.boost ? 'BOOST NOW — SPACE / SHIFT' : 'COLLECT THE BOOST', 3);
    }
    if (game.forcedTimer === 0) {
      game.mainRush = 0;
      game.setback = 2.5;
      game.red = .8;
      game.shake = .7;
      showEvent('SHE CAUGHT UP — KEEP DRIVING', 2);
    }
  } else if (Math.random() < dt * (.012 + danger * .022)) {
    mainWomanRush();
  }
}

function update(dt) {
  if (!game.running) return;

  if (game.memoryTimer > 0) {
    game.memoryTimer -= dt;
    if (game.memoryTimer <= 0) showMemoryDoors();
    return;
  }
  if (game.memoryTimer === -1) return;

  const danger = smooth(2500, 18000, game.d);
  const move = ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
  const horizontalSpeed = isHighway() ? 300 : 500 + danger * 90;
  game.x += move * horizontalSpeed * dt;

  if (isHighway()) {
    // A wide, gently curving road. The camera is pitched downward so more road is visible ahead.
    const center = W / 2 + Math.sin(game.d * .0025) * 34;
    const half = 150 + Math.sin(game.d * .0017) * 8;
    game.x = clamp(game.x, center - half, center + half);
  } else {
    game.x = clamp(game.x, 18, W - 18);
  }

  // The first visit to Monster World takes roughly 20 driving minutes without boosts.
  // Visual scroll is deliberately faster so the tilted road still feels kinetic.
  const recovery = game.setback > 0 ? .5 : 1;
  const distanceRate = (13 + danger * 6 + (game.burst > 0 ? 17 : 0)) * recovery;
  const speed = (118 + danger * 48 + (game.burst > 0 ? 190 : 0)) * recovery;
  game.d += distanceRate * dt;
  game.scroll += speed * dt;
  game.setback = Math.max(0, game.setback - dt);
  game.burst = Math.max(0, game.burst - dt);
  game.shake = Math.max(0, game.shake - dt * 1.7);
  game.red = Math.max(0, game.red - dt * 1.15);
  updateBiome();
  updateMainWoman(dt, danger);
  if (game.storyIndex < storyBeats.length && game.d >= storyBeats[game.storyIndex][0]) {
    showEvent(storyBeats[game.storyIndex][1], 2.5); game.storyIndex++;
  }

  for (let i = 0; i < game.marks.length; i++) {
    game.marks[i] += speed * dt;
    if (game.marks[i] > H + 50) game.marks[i] = -40;
  }

  for (const p of game.pickups) {
    p.y += speed * dt;
    p.pulse += dt * 5;
  }
  game.pickups = game.pickups.filter(p => {
    if (Math.hypot(p.x - game.x, p.y - (H - 115)) < 34) {
      game.boost = 1;
      showEvent('BOOST READY', 1.2);
      return false;
    }
    return p.y < H + 50;
  });

  if (Math.random() < dt * (.055 + danger * .12)) spawnBoost();

  if (Math.random() < dt * (game.biome === 0 ? .38 : .13)) spawnTraffic();
  for (const car of game.traffic) {
    car.y += speed * car.speed * dt;
    const depth = clamp((car.y - 70) / (H - 70), 0, 1), g = roadGeometry();
    car.x = lerp(g.centerFar, g.centerNear, depth) + lerp(g.farHalf, g.bottomHalf, depth) * car.lane;
  }
  game.traffic = game.traffic.filter(car => car.y < H + 120);

  game.monsterTimer -= dt;
  if (game.monsterTimer <= 0) {
    encounter();
    game.monsterTimer = Math.max(.9, rand(3.4, 6.2) - danger * 2.2);
  }

  if (game.d > 900 && Math.random() < dt * (.007 + danger * .012)) startMemoryGame();

  for (const m of game.monsters) {
    if (m.life <= 0) continue;
    m.age += dt;
    m.y += (speed * .58 + m.speed) * dt;
    if (m.kind === 'chase' || (m.revealed && disguise.has(m.id))) {
      m.x += Math.sign(game.x - m.x) * (42 + danger * 105) * dt;
    }
    if (disguise.has(m.id) && !m.revealed && m.y > H * .34) {
      m.revealed = true;
      m.alpha = 1;
      game.red = Math.max(game.red, .48);
      game.shake = Math.max(game.shake, .35);
      showEvent(m.name.toUpperCase(), 1.5);
    }
    if (m.kind === 'loop' && !m.revealed && m.y > H * .38) {
      m.revealed = true;
      game.loopCount++;
      showEvent(game.loopCount > 1 ? 'THE SAME ONE AGAIN' : 'THAT PERSON AGAIN', 1.8);
    }
    if (m.kind === 'loop' && m.y > H + 120 && m.repeats > 0) {
      m.repeats--;
      m.y = -110;
      m.revealed = false;
      // Replay the same stretch and stranger, without undoing biome progress.
      game.scroll = Math.max(0, game.scroll - 240);
      game.red = Math.max(game.red, .4);
      showEvent('THE ROAD REPEATS — BOOST TO BREAK THE LOOP', 2.5);
    }
  }

  // Monster contact is always a scare/recovery, never a death.
  for (const m of game.monsters) {
    m.cooldown = Math.max(0, (m.cooldown || 0) - dt);
    const close = Math.abs(m.y - (H - 115)) < 125 && Math.abs(m.x - game.x) < 55;
    if (m.life > 0 && close && m.revealed && !m.cooldown && game.burst <= 0) {
      m.cooldown = 1.5;
      game.red = Math.max(game.red, .8);
      game.shake = Math.max(game.shake, .7);
      if (game.boost) {
        useBoost();
        showEvent('YOU GOT AWAY', 1.4);
      } else {
        // A collision costs momentum and sends the creature behind the rider.
        m.y = H + 125;
        game.setback = 1.5;
        showEvent('IT MISSED YOU', 1.4);
      }
    }
  }

  game.monsters = game.monsters.filter(m => m.y < H + 170 && m.life > 0);

  if (game.mainRush > .65 && Math.random() < dt * .22) {
    game.red = Math.max(game.red, .5);
    game.shake = Math.max(game.shake, .35);
  }

  if (Math.random() < dt * 9) {
    game.particles.push({ x: game.x + rand(-9,9), y: H - 90, life: .28, vx: rand(-25,25), vy: rand(25,70), kind: 'dust' });
  }
  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  game.particles = game.particles.filter(p => p.life > 0);

  // Long-run safety: after the mid-game, keep offering boosts so a careful player can continue indefinitely.
  if (game.d > 3500 && game.boost === 0 && game.pickups.length === 0 && Math.random() < dt * .08) spawnBoost();

  distanceEl.textContent = Math.floor(game.d) + 'm';
  boostEl.textContent = game.boost ? 'READY' : '—';
}

function roadGeometry() {
  // Camera is pitched about 30 degrees downward: narrow far road, broad near road.
  const horizon = 95;
  const bottomHalf = 270;
  const farHalf = 62;
  const centerFar = W / 2 + Math.sin(game.d * .0025) * 20;
  const centerNear = W / 2 + Math.sin(game.d * .0025 + .7) * 35;
  return { horizon, bottomHalf, farHalf, centerFar, centerNear };
}

function drawRoad() {
  const g = roadGeometry();
  ctx.fillStyle = '#273a50';
  ctx.beginPath();
  ctx.moveTo(g.centerFar - g.farHalf, g.horizon);
  ctx.lineTo(g.centerFar + g.farHalf, g.horizon);
  ctx.lineTo(g.centerNear + g.bottomHalf, H);
  ctx.lineTo(g.centerNear - g.bottomHalf, H);
  ctx.closePath();
  ctx.fill();

  // Pixel-art shoulders and lane markers.
  ctx.fillStyle = '#c5c7c3';
  ctx.fillRect(0, g.horizon, 7, H - g.horizon);
  ctx.fillRect(W - 7, g.horizon, 7, H - g.horizon);

  const stripes = 18;
  for (let i = 0; i < stripes; i++) {
    const t = ((i / stripes) + (game.scroll % 420) / 420) % 1;
    const perspective = t * t;
    const y = g.horizon + perspective * (H - g.horizon);
    const half = lerp(g.farHalf, g.bottomHalf, perspective);
    const center = lerp(g.centerFar, g.centerNear, perspective);
    const h = lerp(5, 32, perspective);
    const w = lerp(3, 8, perspective);
    ctx.fillStyle = '#d9d9c9';
    ctx.fillRect(center - w / 2 - half * .34, y, w, h);
    ctx.fillRect(center - w / 2 + half * .34, y, w, h);
  }
  // Road furniture grows toward the rider, strengthening the pitched camera perspective.
  for (let i = 0; i < 25; i++) {
    const t = ((i * .173 + game.scroll / 620) % 1 + 1) % 1;
    const p = t * t, y = g.horizon + p * (H - g.horizon);
    const c = lerp(g.centerFar, g.centerNear, p), half = lerp(g.farHalf, g.bottomHalf, p);
    const side = i % 2 ? -1 : 1;
    ctx.fillStyle = i % 5 ? '#7b7a68' : '#e1ba5c';
    ctx.fillRect(c + side * (half + 5), y, 2 + p * 5, 3 + p * 10);
    if (i % 3 === 0) { ctx.fillStyle = '#1d252b'; ctx.fillRect(c + side * (half + 14 + p * 20), y - 4 - p * 20, 3 + p * 5, 4 + p * 20); }
  }
}

function drawPixelCity() {
  ctx.fillStyle = '#33485b';
  ctx.fillRect(0, 0, W, H);
  const g = roadGeometry();
  // Far buildings are small; nearer buildings grow, giving the scene a 30-degree pitched look.
  for (let i = 0; i < 28; i++) {
    const side = i % 2 ? 1 : -1;
    const depth = (i * .19 + (game.scroll * .0008)) % 1;
    const y = 90 + depth * 500;
    const h = 25 + depth * 142;
    const w = 25 + depth * 62;
    const center = lerp(g.centerFar, g.centerNear, depth);
    const x = center + side * (g.farHalf + 35 + depth * 180);
    ctx.fillStyle = i % 3 === 0 ? '#536577' : i % 3 === 1 ? '#657584' : '#3f5364';
    ctx.fillRect(x - w/2, y - h, w, h);
    ctx.fillStyle = '#e7d7a1';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      if ((r + c + i) % 2 === 0) ctx.fillRect(x - w/2 + 7 + c * 17, y - h + 9 + r * 22, 6, 9);
    }
    ctx.fillStyle = '#283744';
    ctx.fillRect(x - w/2 + 4, y-h-5, Math.max(6,w*.3), 5);
    if (i % 4 === 0) { ctx.fillStyle = '#c45b45'; ctx.fillRect(x + w*.18, y-h*.62, 4+depth*5, 11+depth*9); }
  }
  drawRoad();
}

function drawDesert() {
  ctx.fillStyle = '#a98558';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#c6a36a';
  for (let i = 0; i < 22; i++) {
    const x = (i * 71 + game.scroll * .035) % (W + 70) - 35;
    const y = 95 + ((i * 113 + game.scroll * .018) % (H - 80));
    ctx.fillRect(x, y, 3 + (i % 3) * 2, 3);
  }
  drawRoad();
}

function drawJungle() {
  ctx.fillStyle = '#244633';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 20; i++) {
    const depth = (i * .13 + game.scroll * .0009) % 1;
    const y = 70 + depth * 620;
    const side = i % 2 ? 1 : -1;
    const x = W/2 + side * (145 + depth * 210);
    ctx.fillStyle = i % 2 ? '#315b39' : '#1b3a2a';
    ctx.fillRect(x - 5, y - 100 * depth, 10 + depth * 10, 100 * depth + 30);
    ctx.fillRect(x - 28, y - 80 * depth, 55 + depth * 25, 9 + depth * 7);
  }
  drawRoad();
}

function drawDeadCity() {
  ctx.fillStyle = '#3c3b42';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) {
    const depth = (i * .18 + game.scroll * .0007) % 1;
    const side = i % 2 ? 1 : -1;
    const y = 100 + depth * 540;
    const x = W/2 + side * (155 + depth * 210);
    const w = 45 + depth * 55;
    const h = 65 + depth * 170;
    ctx.fillStyle = '#55535b';
    ctx.fillRect(x - w/2, y-h, w, h);
    ctx.fillStyle = '#9c8c56';
    ctx.fillRect(x - w/2 + 8, y-h+18, 7, 12);
    ctx.fillRect(x + 10, y-h+48, 7, 12);
  }
  drawRoad();
}

function drawRedForest() {
  ctx.fillStyle = '#3a2024';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 25; i++) {
    const depth = (i * .12 + game.scroll * .001) % 1;
    const side = i % 2 ? 1 : -1;
    const x = W/2 + side * (140 + depth * 250);
    const y = 100 + depth * 650;
    ctx.fillStyle = i % 3 ? '#5a2d2e' : '#733438';
    ctx.fillRect(x, y - 150 * depth, 7 + depth * 9, 150 * depth + 25);
    ctx.fillRect(x - 30 - depth*20, y - 120*depth, 60 + depth*40, 7 + depth*5);
  }
  drawRoad();
}

function drawHollow() {
  ctx.fillStyle = '#17121a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) {
    const depth = (i * .16 + game.scroll * .0012) % 1;
    const x = (i * 79 + game.scroll * .06) % (W + 100) - 50;
    const y = 80 + depth * 650;
    ctx.fillStyle = '#2c202c';
    ctx.fillRect(x, y - 80 * depth, 5 + depth*9, 100 + depth*80);
  }
  drawRoad();
}

function drawMonsterWorld() {
  const red = smooth(18000, 26000, game.d);
  ctx.fillStyle = `rgb(${30 + Math.floor(red*65)},${9 - Math.floor(red*5)},${18 - Math.floor(red*7)})`;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 28; i++) {
    const depth = (i * .11 + game.scroll * .0015) % 1;
    const x = W/2 + (i%2 ? 1 : -1) * (120 + depth*300);
    const y = 80 + depth*650;
    ctx.fillStyle = i%2 ? '#551c27' : '#3a1620';
    ctx.fillRect(x, y-130*depth, 8+depth*12, 160+depth*90);
  }
  drawRoad();
}

function drawWorld() {
  const b = game.biome;
  if (b === 0) drawPixelCity();
  else if (b === 1) drawDesert();
  else if (b === 2) drawJungle();
  else if (b === 3) drawDeadCity();
  else if (b === 4) drawRedForest();
  else if (b === 5) drawHollow();
  else drawMonsterWorld();

  // The sky slowly turns red as the journey gets deeper.
  const red = smooth(0, 18000, game.d);
  if (red > 0) {
    ctx.globalAlpha = red * .24;
    ctx.fillStyle = '#b00018';
    ctx.fillRect(0, 0, W, H * .58);
    ctx.globalAlpha = 1;
  }
}

function drawBoost(p) {
  const pulse = 1 + Math.sin(p.pulse) * .12;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#f1e6bb';
  ctx.fillRect(-10, -10, 20, 20);
  ctx.fillStyle = '#18202a';
  ctx.fillRect(-4, -4, 8, 8);
  ctx.fillRect(-1, -14, 2, 28);
  ctx.restore();
}

function drawBike() {
  // Larger pixel rider placed low in frame; the pitched world leaves lots of forward visibility.
  const x = game.x;
  const y = H - 112;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = '#111';
  ctx.fillRect(-8, -2, 16, 48);
  ctx.fillRect(-28, 27, 56, 8);
  ctx.fillStyle = '#a9b1b5';
  ctx.fillRect(-11, -12, 22, 19);
  ctx.fillStyle = '#20252b';
  ctx.fillRect(-9, -29, 18, 15);
  ctx.fillStyle = '#d7d7cf';
  ctx.fillRect(-5, -33, 10, 5);
  ctx.fillStyle = '#515a62';
  ctx.fillRect(-19, 39, 12, 10);
  ctx.fillRect(7, 39, 12, 10);
  ctx.fillStyle = '#e1d46b';
  ctx.fillRect(-5, 8, 10, 5);
  ctx.restore();
}

function drawTraffic() {
  for (const car of game.traffic) {
    const depth = clamp((car.y - 70) / (H - 70), 0, 1), s = .34 + depth * .9;
    ctx.save(); ctx.translate(Math.round(car.x), Math.round(car.y)); ctx.scale(s, s);
    ctx.fillStyle = '#11151a'; ctx.fillRect(-17, -27, 34, 54);
    ctx.fillStyle = car.tone; ctx.fillRect(-14, -23, 28, 43);
    ctx.fillStyle = '#9ec1d0'; ctx.fillRect(-10, -17, 20, 14);
    ctx.fillStyle = '#d95b47'; ctx.fillRect(-10, 15, 6, 5); ctx.fillRect(4, 15, 6, 5);
    ctx.fillStyle = '#0b0d0f'; ctx.fillRect(-19, -13, 4, 17); ctx.fillRect(15, -13, 4, 17);
    ctx.restore();
  }
}

function drawHumanSilhouette(m, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(m.x, m.y);
  const s = m.scale;
  ctx.fillStyle = '#b6b1a8';
  ctx.fillRect(-8*s, -38*s, 16*s, 25*s);
  ctx.fillRect(-14*s, -13*s, 28*s, 35*s);
  ctx.fillRect(-21*s, -7*s, 7*s, 36*s);
  ctx.fillRect(14*s, -7*s, 7*s, 36*s);
  ctx.fillStyle = '#19171a';
  ctx.fillRect(-5*s, -28*s, 3*s, 3*s);
  ctx.fillRect(3*s, -28*s, 3*s, 3*s);
  ctx.restore();
}

function drawRealisticMonster(m) {
  // Smooth, non-pixel creature drawing: soft silhouettes, organic limbs, irregular eyes and a deep mouth.
  const s = m.scale;
  const t = m.age;
  const horror = 1 + Math.sin(t * 2.2 + m.phase) * .035;
  const stretch = 1 + (m.id % 5) * .11;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(horror, horror);
  ctx.globalAlpha = clamp(.74 + smooth(0, 2, m.age) * .26, 0, 1);

  // Ground shadow.
  ctx.globalAlpha *= .42;
  ctx.fillStyle = '#050307';
  ctx.beginPath();
  ctx.ellipse(0, 78*s, 48*s, 10*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Long, uneven torso.
  const bodyW = (17 + (m.id % 4) * 4) * s;
  const bodyH = (62 + (m.id % 5) * 10) * s * stretch;
  const bodyGrad = ctx.createLinearGradient(-bodyW, -bodyH, bodyW, bodyH);
  bodyGrad.addColorStop(0, '#2a2228');
  bodyGrad.addColorStop(.5, '#111014');
  bodyGrad.addColorStop(1, '#070609');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-bodyW*.65, -bodyH*.42);
  ctx.bezierCurveTo(-bodyW*1.05, -bodyH*.05, -bodyW*.72, bodyH*.42, -bodyW*.42, bodyH*.55);
  ctx.bezierCurveTo(-bodyW*.1, bodyH*.72, bodyW*.2, bodyH*.65, bodyW*.48, bodyH*.45);
  ctx.bezierCurveTo(bodyW*.78, bodyH*.05, bodyW*.92, -bodyH*.32, bodyW*.58, -bodyH*.5);
  ctx.closePath();
  ctx.fill();

  // Head and neck.
  const headW = (18 + (m.id % 3) * 5) * s;
  const headH = (24 + (m.id % 4) * 5) * s;
  ctx.fillStyle = '#211b20';
  ctx.beginPath();
  ctx.ellipse(0, -bodyH*.56, headW, headH, (m.id % 2 ? -.08 : .08), 0, Math.PI*2);
  ctx.fill();
  ctx.fillRect(-5*s, -bodyH*.43, 10*s, 24*s);

  // Hair-like silhouette for some forms.
  if (m.id % 3 !== 1) {
    ctx.strokeStyle = '#09070b';
    ctx.lineWidth = 5*s;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i*5*s, -bodyH*.78);
      ctx.quadraticCurveTo((i*10 + Math.sin(t+i)*5)*s, -bodyH*.98, (i*14)*s, -bodyH*1.05);
      ctx.stroke();
    }
  }

  // Eyes: bright, irregular, slightly asymmetrical.
  const eyeY = -bodyH*.62;
  const eyeGap = 7*s;
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#d9d2ca';
    ctx.beginPath();
    ctx.ellipse(side*eyeGap, eyeY + (side<0 ? 1 : -1)*s, 4.2*s, 6.2*s, side*.18, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#09070b';
    ctx.beginPath();
    ctx.ellipse(side*eyeGap + side*.7*s, eyeY + 1*s, 1.4*s, 3.4*s, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // Mouth shape varies between a narrow split and an unnaturally wide smile.
  const wide = m.id % 3 === 0;
  ctx.fillStyle = '#030204';
  ctx.beginPath();
  if (wide) {
    ctx.ellipse(0, -bodyH*.42, 13*s, 7*s, 0, 0, Math.PI*2);
  } else {
    ctx.moveTo(-8*s, -bodyH*.43);
    ctx.quadraticCurveTo(0, -bodyH*.32, 8*s, -bodyH*.43);
    ctx.quadraticCurveTo(0, -bodyH*.25, -8*s, -bodyH*.43);
  }
  ctx.fill();

  // Pale teeth-like highlights, kept stylized and non-graphic.
  if (wide) {
    ctx.fillStyle = '#bdb6ad';
    for (let i = -3; i <= 3; i++) ctx.fillRect(i*3*s - 1*s, -bodyH*.45, 2*s, 2*s);
  }

  // Very long arms with bent joints.
  ctx.strokeStyle = '#171219';
  ctx.lineCap = 'round';
  ctx.lineWidth = (5 + (m.id%3))*s;
  const armReach = (42 + (m.id%5)*13)*s;
  const elbowY = bodyH*.05;
  ctx.beginPath();
  ctx.moveTo(-bodyW*.55, -bodyH*.18);
  ctx.quadraticCurveTo(-armReach*.55, elbowY, -armReach, bodyH*.38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bodyW*.55, -bodyH*.18);
  ctx.quadraticCurveTo(armReach*.55, elbowY, armReach, bodyH*.42);
  ctx.stroke();

  // Thin legs.
  ctx.lineWidth = (6 + (m.id%2))*s;
  const leg = (34 + (m.id%4)*9)*s;
  ctx.beginPath();
  ctx.moveTo(-bodyW*.35, bodyH*.45);
  ctx.quadraticCurveTo(-bodyW*.65, bodyH*.75, -leg*.7, leg*1.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bodyW*.35, bodyH*.45);
  ctx.quadraticCurveTo(bodyW*.65, bodyH*.8, leg*.7, leg*1.5);
  ctx.stroke();

  // Finger-like tips.
  ctx.lineWidth = Math.max(1.5, 2*s);
  for (const side of [-1,1]) {
    const fx = side * armReach;
    const fy = bodyH*.42;
    for (let i=0;i<4;i++) {
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + side*(4+i*1.5)*s, fy + (8+i*2)*s);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMainWoman() {
  // She begins as an ordinary person, then smoothly becomes the detailed creature style.
  const reveal = game.mainWoman;
  const y = H - 18 - game.mainRush * 130;
  const x = game.x + 65 + Math.sin(game.d*.002 + .8) * (14 + reveal*18);
  const fake = {
    x, y, age: game.d*.01, scale: .6 + reveal*.3 + game.mainRush*.25,
    id: 2, phase: 1.2, revealed: reveal > .18
  };
  if (reveal < .18) {
    drawHumanSilhouette(fake, .55);
  } else {
    ctx.save();
    ctx.globalAlpha = .45 + reveal*.55;
    drawRealisticMonster(fake);
    ctx.restore();
  }
}

function drawMonsters() {
  for (const m of game.monsters) {
    if (!m.revealed) {
      drawHumanSilhouette(m, .72);
    } else {
      drawRealisticMonster(m);
    }
  }
}

function draw() {
  if (!game) return;
  ctx.save();
  if (game.shake) ctx.translate(rand(-1,1)*game.shake*12, rand(-1,1)*game.shake*12);
  drawWorld();
  drawMainWoman();
  for (const p of game.pickups) drawBoost(p);
  drawTraffic();
  drawMonsters();
  drawBike();
  for (const p of game.particles) {
    ctx.globalAlpha = clamp(p.life/.55,0,1);
    ctx.fillStyle = p.kind === 'boost' ? '#d6d0b5' : '#777';
    ctx.fillRect(p.x,p.y,3,3);
  }
  ctx.globalAlpha = 1;
  if (game.red) {
    ctx.fillStyle = '#d00020';
    ctx.globalAlpha = game.red * .16;
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = game.red * .35;
    ctx.strokeStyle = '#e00020';
    ctx.lineWidth = 5;
    ctx.strokeRect(3,3,W-6,H-6);
  }
  ctx.restore();
}

function loop(t) {
  const dt = Math.min(.035, (t - last) / 1000 || 0);
  last = t;
  update(dt);
  draw();
  raf = requestAnimationFrame(loop);
}

function begin() {
  reset();
  game.running = true;
  startScreen.classList.add('hidden');
  death.classList.add('hidden');
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

start.addEventListener('click', begin);
restart.addEventListener('click', begin);
leftDoor.addEventListener('click', () => chooseDoor(leftDoor.textContent));
rightDoor.addEventListener('click', () => chooseDoor(rightDoor.textContent));

addEventListener('keydown', e => {
  keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
  if (['ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  if (e.key === ' ' || e.key === 'Shift') {
    e.preventDefault();
    useBoost();
  }
});
addEventListener('keyup', e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
addEventListener('blur', () => { for (const key of Object.keys(keys)) delete keys[key]; });

reset();
