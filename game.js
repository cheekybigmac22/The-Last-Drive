const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const $ = selector => document.querySelector(selector);
const startScreen = $('#start-screen'), death = $('#death'), start = $('#start'), restart = $('#restart');
const distanceEl = $('#distance'), biomeEl = $('#biome'), boostEl = $('#boost'), eventEl = $('#event');
const memory = $('#memory'), memoryPhase = $('#memory-phase'), memoryNumber = $('#memory-number');
const doors = $('#doors'), leftDoor = $('#door-left'), rightDoor = $('#door-right');
const W = canvas.width, H = canvas.height, PLAYER_Y = H - 115;
const keys = {};
let game = null, last = 0, raf = 0, eventTimeout = null;

const biomes = [
  ['HIGHWAY', 0, 400], ['DESERT', 400, 800], ['JUNGLE', 800, 1200],
  ['DEAD CITY', 1200, 1600], ['RED FOREST', 1600, 2000],
  ['THE HOLLOW', 2000, 2400], ['MONSTER WORLD', 2400, Infinity]
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
  [80, 'SHE IS STILL BEHIND YOU'], [400, 'DESERT — THE CAMERA NOW FOLLOWS YOU'],
  [800, 'THE TREES ARE WATCHING'], [1200, 'YOU HAVE DRIVEN HERE BEFORE'],
  [1600, 'THE SKY HAS TURNED TO RUST'], [2000, 'DO NOT STOP'],
  [2400, 'MONSTER WORLD — THERE IS NO LAST ROAD']
];
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const rand = (a,b) => a + Math.random()*(b-a);
const pick = a => a[Math.floor(Math.random()*a.length)];
const lerp = (a,b,t) => a+(b-a)*t;
function smooth(a,b,x) { const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t); }
function showEvent(text,seconds=1.8) {
  eventEl.textContent=text;clearTimeout(eventTimeout);
  eventTimeout=setTimeout(()=>{eventEl.textContent='';},seconds*1000);
}
function reset() {
  clearTimeout(eventTimeout);
  for(const key of Object.keys(keys))delete keys[key];
  game={
    running:false,time:0,d:0,scroll:0,x:W/2+76,cameraX:0,lean:0,
    boost:1,burst:0,setback:0,mainWoman:0,mainRush:0,forcedTimer:0,
    rushTimer:35,rushWarned:false,monsterTimer:10,pickupTimer:1.8,trafficTimer:1,pedestrianTimer:.5,
    memoryTimer:0,nextMemory:24,memory:null,monsters:[],pickups:[],traffic:[],
    particles:[],pedestrians:[],shake:0,red:0,biome:0,loopCount:0,storyIndex:0
  };
  memory.classList.add('hidden');memoryPhase.classList.remove('hidden');doors.classList.add('hidden');
  death.classList.add('hidden');eventEl.textContent='';
  // Start in a populated street instead of waiting for the first traffic to arrive.
  for(let i=0;i<5;i++){
    spawnTraffic(-80+i*146);
  }
  for(let i=0;i<28;i++)spawnPedestrian(rand(-50,H+50));
  updateHUD();draw();
}
function isHighway(){return game.d<biomes[0][2];}
function currentBiome(){const n=biomes.findIndex(b=>game.d>=b[1]&&game.d<b[2]);return n<0?6:n;}
function updateBiome(){
  const next=currentBiome();
  if(next!==game.biome){
    game.biome=next;showEvent(biomes[next][0],2);
  }
}
function updateHUD(){
  distanceEl.textContent=Math.floor(game.d)+'m';biomeEl.textContent=biomes[game.biome][0];
  boostEl.textContent=game.burst>0?'ACTIVE':game.boost?'READY':'EMPTY';
  const remaining=biomes[game.biome][2]-game.d;
  $('#next-biome').textContent=Number.isFinite(remaining)?Math.max(0,Math.ceil(remaining))+'m TO '+biomes[game.biome+1][0]:'ENDLESS ROAD';
}
function spawnBoost(){
  game.pickups.push({x:isHighway()?rand(120,520):game.x+rand(-150,150),y:-35,pulse:rand(0,6)});
}
function spawnTraffic(screenY=-160){
  if(game.traffic.length>=12)return;
  const near=RoadNetwork.closest(game.cameraX+rand(40,W-40),screenY-game.scroll);
  const direction=pick([-1,1]);
  game.traffic.push({segment:near.segment,t:near.t,direction,x:near.x,y:near.y+game.scroll,
    angle:Math.atan2(near.dx*direction,-near.dy*direction),
    tone:pick(['#d84466','#f2ba44','#8db6b6','#755c80','#d8854e']),
    model:pick([0,0,0,1,2]),speed:rand(35,65)});
}
function updateTraffic(dt){
  for(const v of game.traffic){
    let s=v.segment,length=Math.hypot(s.x2-s.x1,s.y2-s.y1);
    v.t+=v.direction*v.speed*dt/length;
    if(v.t<0||v.t>1){
      const x=v.t<0?s.x1:s.x2,y=v.t<0?s.y1:s.y2;
      const links=RoadNetwork.segments(x-2,y-2,x+2,y+2).filter(n=>n.id!==s.id&&(Math.hypot(n.x1-x,n.y1-y)<2||Math.hypot(n.x2-x,n.y2-y)<2));
      if(links.length){s=pick(links);v.segment=s;v.direction=Math.hypot(s.x1-x,s.y1-y)<2?1:-1;v.t=v.direction===1?0:1;}
      else{v.t=clamp(v.t,0,1);v.direction*=-1;}
    }
    length=Math.hypot(s.x2-s.x1,s.y2-s.y1);
    const dx=(s.x2-s.x1)/length,dy=(s.y2-s.y1)/length;
    v.x=lerp(s.x1,s.x2,v.t)-dy*v.direction*17;
    v.y=lerp(s.y1,s.y2,v.t)+dx*v.direction*17+game.scroll;
    v.angle=Math.atan2(dx*v.direction,-dy*v.direction);
  }
  game.traffic=game.traffic.filter(v=>v.y<H+180&&v.y>-360&&Math.abs(v.x-game.cameraX-W/2)<W);
}
function spawnPedestrian(screenY=-90){
  if(game.pedestrians.length>=40)return;
  const near=RoadNetwork.closest(game.cameraX+rand(-60,W+60),screenY-game.scroll);
  const side=pick([-1,1]),offset=near.segment.width/2+rand(15,42),pace=rand(8,23)*pick([-1,1]);
  game.pedestrians.push({x:near.x-near.dy*side*offset,y:near.y+near.dx*side*offset+game.scroll,
    vx:near.dx*pace,vy:near.dy*pace,id:Math.floor(rand(0,40)),phase:rand(0,6)});
}
function useBoost(){
  if(!game.running||game.memoryTimer!==0||!game.boost||game.burst>0)return;
  game.boost=0;game.burst=2.8;game.mainRush=0;game.forcedTimer=0;game.setback=0;
  game.rushTimer=Math.max(game.rushTimer,25);
  // Boost must be activated before contact. Its initial escape pulse clears nearby threats.
  for(const m of game.monsters)if(m.kind==='loop'||Math.abs(m.y-PLAYER_Y)<180)m.life=0;
  game.shake=.15;showEvent('BOOST — KEEP MOVING',1.1);
  for(let i=0;i<16;i++)game.particles.push({x:game.x+rand(-14,14),y:PLAYER_Y+28,life:.5,vx:rand(-45,45),vy:rand(70,190),kind:'boost'});
  updateHUD();
}
function spawnMonster(forceKind=null){
  if(game.monsters.length>=3)return;
  const available=Math.min(monsterTypes.length,8+Math.floor(game.d/60));
  let id=Math.floor(Math.random()*available);
  const pool=forceKind==='chase'?chase:forceKind==='loop'?loopers:null;
  if(pool){const list=[...pool].filter(n=>n<available);if(list.length)id=pick(list);}
  const kind=chase.has(id)?'chase':loopers.has(id)?'loop':'always';
  const hidden=forceKind==='disguise'||kind==='loop'||Math.random()<.92;
  game.monsters.push({
    id,name:monsterTypes[id],x:isHighway()?rand(112,528):game.x+rand(-210,210),
    y:-80,age:0,kind,disguised:hidden,revealed:!hidden,revealProgress:hidden?0:1,repeats:kind==='loop'?2:0,
    walkVX:rand(-14,14),walkVY:rand(-22,22),
    speed:rand(26,56)+smooth(0,2400,game.d)*18,scale:1,phase:rand(0,6),life:1
  });
}
function encounter(){
  // Many ordinary pedestrians, with an occasional disguised creature among them.
  spawnMonster();
}
function startMemoryGame(){
  if(!game.running||game.memoryTimer!==0||game.forcedTimer>0)return;
  const digits=Math.min(7,2+Math.floor(game.d/450));
  const answer=String(Math.floor(rand(10**(digits-1),10**digits)));
  const fake=answer.split(''),at=Math.floor(Math.random()*digits);
  fake[at]=String((Number(fake[at])+1)%10);
  game.memory={answer,fake:fake.join('')};game.memoryTimer=2.7;
  memoryNumber.textContent=answer;memoryPhase.classList.remove('hidden');
  doors.classList.add('hidden');memory.classList.remove('hidden');showEvent('REMEMBER',1.4);
}
function showMemoryDoors(){
  if(!game.memory)return;
  game.memoryTimer=-1;memoryPhase.classList.add('hidden');memoryNumber.textContent='';
  doors.classList.remove('hidden');
  const values=Math.random()<.5?[game.memory.answer,game.memory.fake]:[game.memory.fake,game.memory.answer];
  leftDoor.textContent=values[0];rightDoor.textContent=values[1];
}
function chooseDoor(value){
  if(!game.memory||game.memoryTimer!==-1)return;
  const correct=value===game.memory.answer;
  game.memory=null;game.memoryTimer=0;game.nextMemory=rand(28,40);memory.classList.add('hidden');
  if(correct){game.boost=1;showEvent('YOU REMEMBERED — BOOST READY',1.4);}
  else{game.red=.6;game.shake=.35;game.setback=1.5;showEvent('WRONG DOOR — KEEP DRIVING',1.6);}
  updateHUD();
}
function endRun(reason){
  if(!game.running)return;
  game.running=false;game.red=.85;game.mainRush=0;
  clearTimeout(eventTimeout);eventEl.textContent='';
  for(const key of Object.keys(keys))delete keys[key];
  memory.classList.add('hidden');
  $('#death-title').textContent=reason;
  $('#death-score').textContent=Math.floor(game.d)+'m · '+biomes[game.biome][0]+' · '+Math.floor(game.time)+' seconds';
  death.classList.remove('hidden');
  updateHUD();
}
function mainWomanRush(){
  if(!game.running||game.forcedTimer>0||game.burst>0||game.memoryTimer!==0)return;
  game.mainRush=.04;game.forcedTimer=5.5;game.rushWarned=false;
  if(!game.boost)game.pickups.push({x:game.x,y:H-300,pulse:0});
  showEvent('SHE IS COMING — GET READY TO BOOST',2);
}
function updateMainWoman(dt,danger){
  game.mainWoman=smooth(600,1900,game.d);
  if(game.forcedTimer>0){
    game.forcedTimer=Math.max(0,game.forcedTimer-dt);
    game.mainRush=1-game.forcedTimer/5.5;
    if(game.forcedTimer<3&&!game.rushWarned){
      game.rushWarned=true;showEvent(game.boost?'BOOST NOW — SPACE / SHIFT':'GRAB THE BOOST',3);
    }
    if(game.forcedTimer===0)endRun('SHE CAUGHT YOU');
  }else{
    game.rushTimer-=dt;
    if(game.rushTimer<=0){game.rushTimer=rand(35,55)-danger*5;mainWomanRush();}
  }
}
function update(dt){
  if(!game.running)return;
  if(game.memoryTimer>0){game.memoryTimer-=dt;if(game.memoryTimer<=0)showMemoryDoors();return;}
  if(game.memoryTimer===-1)return;
  game.time+=dt;
  const danger=smooth(0,2400,game.d);
  const move=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0);
  game.x+=move*(isHighway()?290:320)*dt;
  if(isHighway())game.x=clamp(game.x,102,538);
  game.lean=lerp(game.lean,move,1-Math.exp(-10*dt));
  const recovery=game.setback>0?.65:1;
  const speed=(172+danger*28+(game.burst>0?155:0))*recovery;
  // 400 m stages: about 20 seconds each, with boosts shortening the trip further.
  game.d+=(20+danger*4+(game.burst>0?18:0))*recovery*dt;
  game.scroll+=speed*dt;game.setback=Math.max(0,game.setback-dt);
  game.burst=Math.max(0,game.burst-dt);game.red=Math.max(0,game.red-dt);
  game.shake=Math.max(0,game.shake-dt);
  updateBiome();
  // Camera affects rendering only; player, pickups, enemies and scenery use world coordinates.
  game.cameraX=isHighway()?0:lerp(game.cameraX,game.x-W/2,1-Math.exp(-7*dt));
  updateMainWoman(dt,danger);if(!game.running)return;
  if(game.storyIndex<storyBeats.length&&game.d>=storyBeats[game.storyIndex][0]){
    if(!game.forcedTimer)showEvent(storyBeats[game.storyIndex][1],2);
    game.storyIndex++;
  }
  for(const p of game.pickups){p.y+=speed*dt;p.pulse+=dt;}
  game.pickups=game.pickups.filter(p=>{
    if(Math.abs(p.x-game.x)<28&&Math.abs(p.y-PLAYER_Y)<34){
      game.boost=1;if(!game.forcedTimer)showEvent('BOOST READY',.8);return false;
    }
    return p.y<H+40;
  });
  game.pickupTimer-=dt;
  if(game.pickupTimer<=0){spawnBoost();game.pickupTimer=rand(1.8,2.7);}
  game.trafficTimer-=dt;
  if(game.trafficTimer<=0){
    spawnTraffic();game.trafficTimer=game.biome===0?rand(1.4,2.4):rand(2.5,4.5);
  }
  updateTraffic(dt);
  for(const p of game.pedestrians){p.x+=p.vx*dt;p.y+=(speed+p.vy)*dt;p.phase+=dt*5;}
  game.pedestrians=game.pedestrians.filter(p=>p.y<H+100&&p.y>-300&&Math.abs(p.x-game.cameraX-W/2)<W*.9);
  game.pedestrianTimer-=dt;
  if(game.pedestrianTimer<=0){spawnPedestrian();spawnPedestrian();game.pedestrianTimer=rand(.45,.8);}
  game.monsterTimer-=dt;
  if(game.monsterTimer<=0){encounter();game.monsterTimer=rand(12,18)-danger*3;}
  game.nextMemory-=dt;
  if(game.nextMemory<=0)startMemoryGame();
  if(game.memoryTimer!==0){updateHUD();return;}
  for(const m of game.monsters){
    if(m.life<=0)continue;
    m.age+=dt;
    if(!m.revealed){m.x+=m.walkVX*dt;m.y+=(speed+m.walkVY)*dt;}
    else m.y+=(speed*.58+m.speed-(game.burst>0?220:0))*dt;
    if(m.revealed&&(m.kind==='chase'||m.disguised)){
      m.x+=clamp(game.x-m.x,-1,1)*(24+danger*18)*dt;
    }
    if(!m.revealed&&m.y>H*.55){
      m.revealed=true;game.red=Math.max(game.red,.24);
      if(m.kind==='loop'){game.loopCount++;showEvent('THAT PERSON AGAIN',1);}
      else if(!game.forcedTimer)showEvent(m.name.toUpperCase(),1);
    }
    if(m.revealed)m.revealProgress=Math.min(1,m.revealProgress+dt*2.5);
    if(m.kind==='loop'&&m.y>H+100&&m.repeats>0){
      m.repeats--;m.y=-80;m.revealed=false;m.revealProgress=0;game.scroll=Math.max(0,game.scroll-180);
      if(!game.forcedTimer)showEvent('THE ROAD REPEATS — BOOST TO BREAK IT',1.5);
    }
    // Tight torso hitboxes match the pixel sprites. Holding a boost is not protection.
    const rx=m.id%5===3?34:26;
    if(m.revealed&&Math.abs(m.x-game.x)<rx&&Math.abs(m.y-PLAYER_Y)<38){
      endRun('CAUGHT BY '+m.name.toUpperCase());return;
    }
  }
  game.monsters=game.monsters.filter(m=>m.life>0&&m.y<H+170);
  if(Math.random()<dt*8)game.particles.push({x:game.x+rand(-9,9),y:PLAYER_Y+28,life:.35,vx:rand(-16,16),vy:rand(25,60),kind:'dust'});
  for(const p of game.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}
  game.particles=game.particles.filter(p=>p.life>0);
  updateHUD();
}
function draw(){if(game){PixelArt.draw(ctx,game,W,H);MonsterArt.draw(game,W,H);}}
function loop(t){
  const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);draw();raf=requestAnimationFrame(loop);
}
function begin(){
  if(!MonsterArt.loaded)return;
  reset();game.running=true;startScreen.classList.add('hidden');death.classList.add('hidden');
  last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}
start.addEventListener('click',begin);restart.addEventListener('click',begin);
leftDoor.addEventListener('click',()=>chooseDoor(leftDoor.textContent));
rightDoor.addEventListener('click',()=>chooseDoor(rightDoor.textContent));
addEventListener('keydown',e=>{
  keys[e.key.length===1?e.key.toLowerCase():e.key]=true;
  if(['ArrowLeft','ArrowRight',' ','Shift'].includes(e.key))e.preventDefault();
  if((e.key===' '||e.key==='Shift')&&!e.repeat)useBoost();
});
addEventListener('keyup',e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=false;});
addEventListener('blur',()=>{for(const key of Object.keys(keys))delete keys[key];});
start.disabled=true;start.textContent='LOADING CREATURES…';
MonsterArt.ready.then(()=>{start.disabled=false;start.textContent='START DRIVE';draw();}).catch(()=>{start.textContent='RELOAD TO RETRY';eventEl.textContent='Creature artwork could not load. Refresh to retry.';});
reset();
