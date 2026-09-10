const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s);
const startScreen=$('#start-screen'),death=$('#death'),start=$('#start'),restart=$('#restart');
const distanceEl=$('#distance'),biomeEl=$('#biome'),boostEl=$('#boost'),eventEl=$('#event');
const memory=$('#memory'),memoryPhase=$('#memory-phase'),memoryNumber=$('#memory-number');
const doors=$('#doors'),leftDoor=$('#door-left'),rightDoor=$('#door-right');
const W=canvas.width,H=canvas.height,PLAYER_Y=H/2,keys={};
let game=null,last=0,raf=0,eventTimeout=null;
const biomes=[['HIGHWAY'],['DESERT'],['JUNGLE'],['TOWN'],['RED FOREST'],['THE HOLLOW'],['MONSTER WORLD'],['MEADOWS'],['SNOWFIELDS'],['COAST']];
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


const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const lerp=(a,b,t)=>a+(b-a)*t;
function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
function showEvent(text,seconds=1.8){eventEl.textContent=text;clearTimeout(eventTimeout);eventTimeout=setTimeout(()=>{eventEl.textContent='';},seconds*1000);}
function reset(){
  clearTimeout(eventTimeout);for(const key of Object.keys(keys))delete keys[key];
  game={running:false,time:0,d:0,x:320,y:0,cameraX:0,cameraY:-H/2,scroll:H/2,heading:0,lean:0,moving:false,free:false,
    boost:1,burst:0,setback:0,mainWoman:0,mainRush:0,forcedTimer:0,rushTimer:45,
    woman:{x:320,y:300,path:[],repath:0,phase:0,moving:false},
    monsterTimer:14,pickupTimer:2,trafficTimer:2,pedestrianTimer:1,
    memoryTimer:0,nextMemory:35,memory:null,monsters:[],pickups:[],traffic:[],pedestrians:[],particles:[],
    shake:0,red:0,biome:0,loopCount:0,loopCooldown:0,history:[],historyTimer:0};
  memory.classList.add('hidden');memoryPhase.classList.remove('hidden');doors.classList.add('hidden');death.classList.add('hidden');eventEl.textContent='';
  for(let i=0;i<24;i++)spawnPedestrian(true);
  for(let i=0;i<4;i++)spawnTraffic();
  spawnBoost();updateHUD();draw();
}
function isHighway(){return !game.free;}
function currentBiome(){return World.biome(game.x,game.y);}
function updateBiome(){const next=currentBiome();if(game.biome!==next){game.biome=next;showEvent(biomes[next][0],1.5);}}
function updateHUD(){
  distanceEl.textContent=Math.floor(game.d)+'m';biomeEl.textContent=biomes[game.biome][0];boostEl.textContent=game.burst>0?'ACTIVE':game.boost?'READY':'EMPTY';
  $('#next-biome').textContent=game.free?'EXPLORE ANY DIRECTION · '+Math.floor(game.time/60)+':'+String(Math.floor(game.time%60)).padStart(2,'0'):Math.max(0,Math.ceil((game.y-World.highwayEnd)/8))+'m TO HIGHWAY EXIT';
}
function forwardPoint(distance,spread=0){return World.openPoint(game.x+Math.sin(game.heading)*distance+rand(-spread,spread),game.y-Math.cos(game.heading)*distance+rand(-spread,spread));}
function spawnBoost(){
  if(game.pickups.length>=8)return;
  const p=forwardPoint(rand(120,240),65);if(isHighway())p.x=clamp(p.x,150,490);
  game.pickups.push({...p,pulse:rand(0,6)});
}
function spawnTraffic(){
  if(game.traffic.length>=8||!World.highway(game.x,game.y))return;const p=forwardPoint(rand(240,650),350),near=RoadNetwork.closest(p.x,p.y),direction=pick([-1,1]);
  game.traffic.push({segment:near.segment,t:near.t,direction,x:near.x,y:near.y,angle:Math.atan2(near.dx*direction,-near.dy*direction),tone:pick(['#d84466','#f2ba44','#8db6b6']),model:pick([0,0,1,2]),speed:rand(35,65)});
}
function updateTraffic(dt){
  for(const v of game.traffic){
    let s=v.segment,len=Math.hypot(s.x2-s.x1,s.y2-s.y1);v.t+=v.direction*v.speed*dt/len;
    if(v.t<0||v.t>1){v.t=clamp(v.t,0,1);v.direction*=-1;}
    const dx=(s.x2-s.x1)/len,dy=(s.y2-s.y1)/len;
    v.x=lerp(s.x1,s.x2,v.t)-dy*v.direction*(s.id==='highway'?75:17);v.y=lerp(s.y1,s.y2,v.t)+dx*v.direction*(s.id==='highway'?75:17);v.angle=Math.atan2(dx*v.direction,-dy*v.direction);
  }
  game.traffic=game.traffic.filter(v=>Math.hypot(v.x-game.x,v.y-game.y)<1100);
}
function spawnPedestrian(initial=false){
  if(game.pedestrians.length>=36)return;
  const p=initial?{x:game.x+rand(-400,400),y:game.y+rand(-450,450)}:forwardPoint(rand(300,550),350);
  if(!World.highway(p.x,p.y)){
    const position=World.openPoint(p.x,p.y,8),angle=rand(0,Math.PI*2);
    game.pedestrians.push({...position,vx:Math.cos(angle)*15,vy:Math.sin(angle)*15,id:Math.floor(rand(0,40)),phase:rand(0,6)});return;
  }
  const road=RoadNetwork.closest(p.x,p.y),side=pick([-1,1]),offset=road.segment.width/2+25,position=World.openPoint(road.x-road.dy*side*offset,road.y+road.dx*side*offset,8);
  game.pedestrians.push({...position,vx:road.dx*side*15,vy:road.dy*side*15,id:Math.floor(rand(0,40)),phase:rand(0,6)});
}
function useBoost(){
  if(!game.running||game.memoryTimer!==0||!game.boost||game.burst>0)return;
  game.boost=0;game.burst=2.8;game.forcedTimer=0;game.setback=0;game.rushTimer=Math.max(game.rushTimer,25);
  for(const m of game.monsters)if(m.kind==='loop'||Math.hypot(m.x-game.x,m.y-game.y)<145)m.life=0;
  showEvent('BOOST — HOLD A DIRECTION TO ESCAPE',1.2);updateHUD();
}
function spawnMonster(forceKind=null){
  if(game.monsters.length>=3)return;
  const id=Math.floor(rand(0,40)),position=forwardPoint(rand(230,430),180),kind=forceKind||(id%9===0?'loop':'chase');
  const hidden=forceKind==='disguise'||Math.random()<.94;
  game.monsters.push({...position,id,name:monsterTypes[id],kind,disguised:hidden,revealed:!hidden,revealProgress:hidden?0:1,age:0,phase:0,life:1,speed:rand(85,130),path:[],repath:0,moving:false});
}
function encounter(){spawnMonster();}
function startMemoryGame(){
  if(!game.running||game.memoryTimer!==0||game.forcedTimer>0)return;
  const digits=Math.min(7,2+Math.floor(game.time/90));
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

function pursue(actor,dt,speed){
  actor.repath-=dt;
  if(actor.repath<=0){actor.path=World.route(actor,game,10);actor.repath=.5;}
  if(World.clear(actor.x,actor.y,game.x,game.y,10))actor.path=[{x:game.x,y:game.y}];
  let budget=speed*dt,walked=0;
  while(budget>0&&actor.path.length){
    const target=actor.path[0],dx=target.x-actor.x,dy=target.y-actor.y,len=Math.hypot(dx,dy);
    if(len<3){actor.path.shift();continue;}
    const step=Math.min(budget,len),ox=actor.x,oy=actor.y;World.move(actor,dx/len*step,dy/len*step,10);
    const moved=Math.hypot(actor.x-ox,actor.y-oy);walked+=moved;budget-=step;
    if(moved<step*.4){actor.repath=0;break;}if(step===len)actor.path.shift();
  }
  actor.moving=walked>.05;actor.phase=(actor.phase||0)+walked*.1;
}
function updateMainWoman(dt){
  game.mainWoman=clamp(game.time/600,0,1);
  const woman=game.woman,gap=Math.hypot(woman.x-game.x,woman.y-game.y);
  game.rushTimer-=dt;
  if(game.rushTimer<=0){game.rushTimer=rand(40,60);game.forcedTimer=4;spawnBoost();showEvent('SHE IS RUNNING — BOOST TO ESCAPE',2);}
  game.forcedTimer=Math.max(0,game.forcedTimer-dt);
  // Catch-up only at long range keeps her visible without teleporting her or
  // following the player's recorded trail. A circling rider is intercepted.
  const speed=115+game.mainWoman*28+Math.max(0,gap-200)*6+(game.forcedTimer>0?75:0);
  pursue(woman,dt,speed);
  if(Math.hypot(woman.x-game.x,woman.y-game.y)<27)endRun('SHE CAUGHT YOU');
}
function rewindWorld(){
  if(game.history.length<8)return false;
  const snapshot=game.history[Math.max(0,game.history.length-28)];
  game.x=snapshot.x;game.y=snapshot.y;game.heading=snapshot.heading;game.free=snapshot.free;
  const p=World.openPoint(game.x-Math.sin(game.heading)*285,game.y+Math.cos(game.heading)*285);
  Object.assign(game.woman,p,{path:[],repath:0});game.monsters=[];game.pickups=[];game.pedestrians=[];game.traffic=[];
  game.history=[];game.loopCount++;game.loopCooldown=35;game.red=.8;game.shake=.35;
  spawnBoost();for(let i=0;i<20;i++)spawnPedestrian(true);
  showEvent('TIME LOOP — THE SAME LANDMARKS. AGAIN.',3);return true;
}
function update(dt){
  if(!game.running)return;
  if(game.memoryTimer>0){game.memoryTimer-=dt;if(game.memoryTimer<=0)showMemoryDoors();return;}
  if(game.memoryTimer===-1)return;
  game.time+=dt;
  const mx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),my=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0),length=Math.hypot(mx,my);
  const oldX=game.x,oldY=game.y;
  if(length){game.heading=Math.atan2(mx,-my);const speed=(game.burst>0?380:220)*(game.setback>0?.65:1);World.move(game,mx/length*speed*dt,my/length*speed*dt,13);}
  if(isHighway()){game.x=clamp(game.x,134,506);game.y=Math.min(150,game.y);if(game.y<World.highwayEnd-20){game.free=true;showEvent('THE HIGHWAY ENDS — EXPLORE ANY DIRECTION',3);}}
  const travelled=Math.hypot(game.x-oldX,game.y-oldY);game.moving=travelled>.01;game.d+=travelled/8;
  game.setback=Math.max(0,game.setback-dt);game.burst=Math.max(0,game.burst-dt);game.red=Math.max(0,game.red-dt);game.shake=Math.max(0,game.shake-dt);
  game.cameraX=game.x-W/2;game.cameraY=game.y-H/2;game.scroll=-game.cameraY;
  updateBiome();updateMainWoman(dt);if(!game.running)return;
  for(const p of game.pickups)p.pulse+=dt;
  game.pickups=game.pickups.filter(p=>{if(Math.hypot(p.x-game.x,p.y-game.y)<30){game.boost=1;showEvent('BOOST READY',.8);return false;}return Math.hypot(p.x-game.x,p.y-game.y)<950;});
  game.pickupTimer-=dt;if(game.pickupTimer<=0){spawnBoost();game.pickupTimer=3;}
  game.trafficTimer-=dt;if(game.trafficTimer<=0){spawnTraffic();game.trafficTimer=3;}
  updateTraffic(dt);
  for(const p of game.pedestrians){const ox=p.x,oy=p.y;World.move(p,p.vx*dt,p.vy*dt,7);if(Math.hypot(p.x-ox,p.y-oy)<dt*3){p.vx*=-1;p.vy*=-1;}p.phase+=dt*4;}
  game.pedestrians=game.pedestrians.filter(p=>Math.hypot(p.x-game.x,p.y-game.y)<850);
  game.pedestrianTimer-=dt;if(game.pedestrianTimer<=0){spawnPedestrian();spawnPedestrian();game.pedestrianTimer=.7;}
  game.monsterTimer-=dt;if(game.monsterTimer<=0){encounter();game.monsterTimer=rand(16,24);}
  game.loopCooldown=Math.max(0,game.loopCooldown-dt);
  for(const m of game.monsters){
    if(m.life<=0)continue;m.age+=dt;
    const gap=Math.hypot(m.x-game.x,m.y-game.y);
    if(!m.revealed){World.move(m,Math.sin(m.id)*12*dt,Math.cos(m.id)*12*dt,8);m.phase+=dt*4;if(gap<170){m.revealed=true;game.red=.2;if(m.kind==='loop'&&game.loopCooldown===0&&rewindWorld())break;showEvent(m.name.toUpperCase(),1);}}
    if(m.revealed){m.revealProgress=Math.min(1,m.revealProgress+dt*2.5);pursue(m,dt,m.speed);if(Math.hypot(m.x-game.x,m.y-game.y)<25){endRun('CAUGHT BY '+m.name.toUpperCase());return;}}
  }
  game.monsters=game.monsters.filter(m=>m.life>0&&Math.hypot(m.x-game.x,m.y-game.y)<1000&&m.age<55);
  game.historyTimer-=dt;if(game.historyTimer<=0){game.history.push({x:game.x,y:game.y,heading:game.heading,free:game.free});if(game.history.length>48)game.history.shift();game.historyTimer=.25;}
  game.nextMemory-=dt;if(game.nextMemory<=0)startMemoryGame();
  game.cameraX=game.x-W/2;game.cameraY=game.y-H/2;game.scroll=-game.cameraY;updateBiome();updateHUD();
}
function draw(){
  if(!game)return;
  const view={...game,scroll:-game.cameraY,
    woman:{...game.woman,y:game.woman.y-game.cameraY},
    traffic:game.traffic.map(p=>({...p,y:p.y-game.cameraY})),pickups:game.pickups.map(p=>({...p,y:p.y-game.cameraY})),
    pedestrians:game.pedestrians.map(p=>({...p,y:p.y-game.cameraY})),monsters:game.monsters.map(p=>({...p,y:p.y-game.cameraY}))};
  PixelArt.draw(ctx,view,W,H);MonsterArt.draw(view,W,H);
}
function loop(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);draw();raf=requestAnimationFrame(loop);}
function begin(){if(!MonsterArt.loaded)return;reset();game.running=true;startScreen.classList.add('hidden');death.classList.add('hidden');last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
start.addEventListener('click',begin);restart.addEventListener('click',begin);
leftDoor.addEventListener('click',()=>chooseDoor(leftDoor.textContent));rightDoor.addEventListener('click',()=>chooseDoor(rightDoor.textContent));
addEventListener('keydown',e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=true;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Shift'].includes(e.key))e.preventDefault();if((e.key===' '||e.key==='Shift')&&!e.repeat)useBoost();});
addEventListener('keyup',e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=false;});
addEventListener('blur',()=>{for(const key of Object.keys(keys))delete keys[key];});
start.disabled=true;start.textContent='LOADING CREATURES…';
MonsterArt.ready.then(()=>{start.disabled=false;start.textContent='START DRIVE';draw();}).catch(()=>{start.textContent='RELOAD TO RETRY';eventEl.textContent='Creature artwork could not load. Refresh to retry.';});
reset();
