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
  MiniGames.reset();clearTimeout(eventTimeout);for(const key of Object.keys(keys))delete keys[key];
  game={running:false,time:0,d:0,x:320,y:0,cameraX:0,cameraY:-H/2,scroll:H/2,heading:0,lean:0,moving:false,free:false,
    boost:1,burst:0,boostHeldTime:0,resumeGrace:0,challengeIndex:0,setback:0,mainWoman:0,womanStage:0,fear:0,sprintWarning:0,mainRush:0,forcedTimer:0,rushTimer:50,
    woman:{x:320,y:650,path:[],repath:0,phase:0,moving:false},
    monsterTimer:32,pickupTimer:30,trafficTimer:2,pedestrianTimer:1,
    memoryTimer:0,nextMemory:35,memory:null,monsters:[],pickups:[],traffic:[],pedestrians:[],particles:[],
    shake:0,red:0,biome:0,loopCount:0,loopCooldown:0,history:[],historyTimer:0};
  memory.classList.add('hidden');memoryPhase.classList.remove('hidden');doors.classList.add('hidden');death.classList.add('hidden');eventEl.textContent='';
  for(let i=0;i<4;i++)spawnPedestrian(true);
  for(let i=0;i<4;i++)spawnTraffic();
  spawnBoost();updateHUD();draw();
}
function isHighway(){return !game.free;}
function currentBiome(){return World.biome(game.x,game.y);}
function updateBiome(){const next=currentBiome();if(game.biome!==next){game.biome=next;showEvent(biomes[next][0],1.5);}}
function updateHUD(){
  distanceEl.textContent=Math.floor(game.d)+'m';biomeEl.textContent=biomes[game.biome][0];boostEl.textContent=(game.burst>0?'ON ':'')+Math.round(game.boost*100)+'%';$('#boost-meter').value=game.boost;
  $('#next-biome').textContent=game.free?'EXPLORE ANY DIRECTION · '+Math.floor(game.time/60)+':'+String(Math.floor(game.time%60)).padStart(2,'0'):Math.max(0,Math.ceil((game.y-World.highwayEnd)/8))+'m TO HIGHWAY EXIT';
}
function forwardPoint(distance,spread=0){return World.openPoint(game.x+Math.sin(game.heading)*distance+rand(-spread,spread),game.y-Math.cos(game.heading)*distance+rand(-spread,spread));}
function spawnBoost(){
  if(game.pickups.length>=2)return;
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
  if(game.pedestrians.length>=6)return;
  const p=initial?{x:game.x+rand(-400,400),y:game.y+rand(-450,450)}:forwardPoint(rand(300,550),350);
  if(!World.highway(p.x,p.y)){
    const position=World.openPoint(p.x,p.y,8),angle=rand(0,Math.PI*2);
    game.pedestrians.push({...position,vx:Math.cos(angle)*15,vy:Math.sin(angle)*15,id:Math.floor(rand(0,40)),phase:rand(0,6)});return;
  }
  const road=RoadNetwork.closest(p.x,p.y),side=pick([-1,1]),offset=road.segment.width/2+25,position=World.openPoint(road.x-road.dy*side*offset,road.y+road.dx*side*offset,8);
  game.pedestrians.push({...position,vx:road.dx*side*15,vy:road.dy*side*15,id:Math.floor(rand(0,40)),phase:rand(0,6)});
}
function useBoost(){
  return game.running&&!MiniGames.active&&game.memoryTimer===0&&game.boost>0;
}
function updateBoost(dt,moving){
  const active=useBoost()&&moving&&(keys[' ']||keys.Shift);
  game.burst=active?Math.min(1,game.boost/(dt*.18||1)):0;
  if(game.burst>0){game.boost=Math.max(0,game.boost-dt*.18);game.boostHeldTime+=dt;
    if(game.boostHeldTime>.35)for(const m of game.monsters)if(m.kind==='loop')m.life=0;
  }else game.boostHeldTime=0;
}
function finishChallenge(ok){
  for(const key of Object.keys(keys))delete keys[key];
  game.burst=0;game.resumeGrace=2.5;game.nextMemory=rand(32,44);
  if(ok){game.boost=Math.min(1,game.boost+.5);showEvent('CHALLENGE COMPLETE — +50% FUEL',2);}
  else{game.red=.3;game.setback=.8;showEvent('MISSED — KEEP MOVING. YOU HAVE A HEAD START.',2);}
  updateHUD();
}
function startChallenge(){
  if(!game.running||game.memoryTimer!==0||MiniGames.active||game.forcedTimer>0)return;
  const type=game.challengeIndex++%3;
  if(type===0){startMemoryGame();return;}
  for(const key of Object.keys(keys))delete keys[key];game.burst=0;
  MiniGames.start(type===1?'sequence':'timing',Math.min(8,Math.floor(game.time/100)),finishChallenge);
}
function transformationDuration(){return 2.8/(1.5+.5*clamp(game.time/600,0,1));}
function spawnMonster(forceKind=null){
  if(game.monsters.length>=1||game.forcedTimer>0||game.sprintWarning>0)return;
  const id=Math.floor(rand(0,40)),position=forwardPoint(rand(230,430),180),kind=forceKind||(id%9===0?'loop':'chase');
  const hidden=forceKind==='disguise'||Math.random()<.94;
  game.monsters.push({...position,id,name:monsterTypes[id],kind,disguised:hidden,revealed:!hidden,revealProgress:hidden?0:1,revealGrace:hidden?.7:0,transformDuration:transformationDuration(),age:0,phase:0,life:1,chaseAge:0,speed:rand(275,295),path:[],repath:0,moving:false});
}
function monsterVisible(m){
  // Include the full tall sprite, not only its feet. Darkness does not count
  // as losing sight; escaping means getting the creature outside the camera.
  return m.x+90>game.x-W/2&&m.x-90<game.x+W/2&&m.y+30>game.y-H/2&&m.y-190<game.y+H/2;
}
function spawnRusher(side=pick(['top','right','bottom','left']),fast=Math.random()<.3){
  if(game.monsters.length||game.forcedTimer>0||game.sprintWarning>0)return;
  const direction={top:[0,-1],right:[1,0],bottom:[0,1],left:[-1,0]}[side];
  let position;
  for(let i=0;i<5;i++){
    const distance=(direction[0]?510:680)+i*176;
    position=World.openPoint(game.x+direction[0]*distance,game.y+direction[1]*distance,10);
    if(!monsterVisible(position))break;
  }
  const id=Math.floor(rand(0,40));
  game.monsters.push({...position,id,name:fast?'The Breathless':monsterTypes[id],kind:'rusher',disguised:false,revealed:true,revealProgress:1,revealGrace:0,
    age:0,phase:0,life:1,chaseAge:0,speed:fast?490:285,path:[],repath:0,moving:true,seen:false,outOfSight:0,entrySide:side,entryWarning:1.2,
    sprinter:fast,sprintLeft:1.6,exhausted:false,restAge:0});
  HorrorAudio.cue('warning');showEvent((fast?'A SPRINTER':'RUNNING FOOTSTEPS')+' FROM THE '+side.toUpperCase()+' — MOVE AWAY',2.2);
}
function encounter(){if(Math.random()<.25)spawnRusher();else spawnMonster();}
function startMemoryGame(){
  if(!game.running||game.memoryTimer!==0||game.forcedTimer>0||MiniGames.active)return;
  const digits=Math.min(7,2+Math.floor(game.time/90));
  const answer=String(Math.floor(rand(10**(digits-1),10**digits)));
  const fake=answer.split(''),at=Math.floor(Math.random()*digits);
  fake[at]=String((Number(fake[at])+1)%10);
  for(const key of Object.keys(keys))delete keys[key];game.burst=0;
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
  for(const key of Object.keys(keys))delete keys[key];game.resumeGrace=2.5;game.burst=0;
  updateHUD();
}
function endRun(reason){
  if(!game.running)return;
  HorrorAudio.cue('death');game.running=false;game.red=.85;game.mainRush=0;game.burst=0;MiniGames.reset();
  clearTimeout(eventTimeout);eventEl.textContent='';
  for(const key of Object.keys(keys))delete keys[key];
  memory.classList.add('hidden');
  $('#death-title').textContent=reason;
  $('#death-score').textContent=Math.floor(game.d)+'m · '+biomes[game.biome][0]+' · '+Math.floor(game.time)+' seconds';
  death.classList.remove('hidden');
  updateHUD();
}

function pursue(actor,dt,speed){
  if(actor.stumble>0){actor.stumble=Math.max(0,actor.stumble-dt);actor.moving=false;return;}
  actor.repath-=dt;
  const dxGoal=game.x-actor.x,dyGoal=game.y-actor.y,distance=Math.hypot(dxGoal,dyGoal);
  // Long off-screen pursuits use a bounded look-ahead instead of repeatedly
  // searching beyond the local pathfinder's map when the bike boosts away.
  const goal=distance>540?World.openPoint(actor.x+dxGoal/distance*400,actor.y+dyGoal/distance*400,10):game;
  if(actor.repath<=0){actor.path=World.route(actor,goal,10);actor.repath=.5;}
  if(World.clear(actor.x,actor.y,goal.x,goal.y,10))actor.path=[{x:goal.x,y:goal.y}];
  // Two push-offs per stride: a small acceleration after foot contact, then
  // coasting through the airborne phase. Animation phase follows real travel.
  const propulsion=1+.18*Math.cos((actor.phase||0)*2-.8);
  let budget=speed*dt*propulsion,walked=0;
  while(budget>0&&actor.path.length){
    const target=actor.path[0],dx=target.x-actor.x,dy=target.y-actor.y,len=Math.hypot(dx,dy);
    if(len<3){actor.path.shift();continue;}
    const desired=Math.atan2(dy,dx);
    if(actor.heading===undefined)actor.heading=desired;
    const turn=Math.atan2(Math.sin(desired-actor.heading),Math.cos(desired-actor.heading));
    actor.heading+=clamp(turn,-2.8*dt,2.8*dt);
    // A pursuer must plant and turn; a sharp bike dodge buys real distance.
    const step=Math.min(budget,len)*Math.max(.25,Math.cos(turn)),ox=actor.x,oy=actor.y;
    World.move(actor,Math.cos(actor.heading)*step,Math.sin(actor.heading)*step,10);
    const moved=Math.hypot(actor.x-ox,actor.y-oy);walked+=moved;budget-=step;
    if(moved<step*.4){actor.repath=0;actor.stumble=.45;actor.heading=desired;break;}
    if(Math.hypot(target.x-actor.x,target.y-actor.y)<3)actor.path.shift();
    break;
  }
  actor.moving=walked>.05;actor.phase=(actor.phase||0)+walked*.1;
}
function placeWomanAtEdge(){
  // Re-enter behind the rider, never in contact range or inside scenery.
  const behind=game.heading+Math.PI/2;
  for(const extra of [0,30,60,100])for(const offset of [0,.3,-.3,.6,-.6,1,-1,1.5,-1.5]){
    const dx=Math.cos(behind+offset),dy=Math.sin(behind+offset);
    const radius=Math.min((285+extra)/Math.max(.001,Math.abs(dx)),(dy<0?270+extra:375+extra)/Math.max(.001,Math.abs(dy)));
    const x=game.x+dx*radius,y=game.y+dy*radius;
    if(!World.blocked(x,y,10)){
      Object.assign(game.woman,{x,y,path:[],repath:0,stumble:0,heading:Math.atan2(-dy,-dx)});return true;
    }
  }
  return false;
}
function updateMainWoman(dt){
  const stage=Math.min(5,Math.floor(game.time/120));
  if(stage!==game.womanStage){game.womanStage=stage;game.red=.2;HorrorAudio.cue('reveal');showEvent(['','HER EYES HAVE CHANGED','SOMETHING IS GROWING FROM HER HEAD','THAT IS NOT A HUMAN SHADOW','SHE IS BREAKING APART','SHE IS NO LONGER HUMAN'][stage],2);}
  game.mainWoman=stage<4?0:stage===4?.45:1;
  const woman=game.woman,gap=Math.hypot(woman.x-game.x,woman.y-game.y);
  if(game.resumeGrace>0){woman.moving=false;return;}
  if(game.sprintWarning>0){
    game.sprintWarning=Math.max(0,game.sprintWarning-dt);
    if(game.sprintWarning===0){placeWomanAtEdge();game.forcedTimer=7;showEvent('SHE IS SPRINTING — USE YOUR SAVED BOOST',2);}
  }else if(game.forcedTimer>0)game.forcedTimer=Math.max(0,game.forcedTimer-dt);
  else{
    game.rushTimer-=dt;
    if(game.rushTimer<=0&&game.monsters.every(m=>!m.revealed||m.life<=0)){
      game.rushTimer=rand(55,75);game.sprintWarning=2.5;HorrorAudio.cue('warning');showEvent('FOOTSTEPS BEHIND YOU — SAVE YOUR BOOST FOR HER SPRINT',2.5);
    }
  }
  // Lurk beyond the camera while the rider makes progress. Stops, circles and
  // collisions let her take the direct route and close the gap naturally.
  const speed=game.forcedTimer>0?315:game.moving?clamp(220+(gap-620)*.5,125,290):235;
  pursue(woman,dt,speed);
  if(Math.hypot(woman.x-game.x,woman.y-game.y)<27)endRun('SHE CAUGHT YOU');
}
function rewindWorld(){
  if(game.history.length<8)return false;
  const snapshot=game.history[Math.max(0,game.history.length-28)];
  game.x=snapshot.x;game.y=snapshot.y;game.heading=snapshot.heading;game.free=snapshot.free;
  const p=World.openPoint(game.x-Math.sin(game.heading)*620,game.y+Math.cos(game.heading)*285);
  Object.assign(game.woman,p,{path:[],repath:0});game.monsters=[];game.pickups=[];game.pedestrians=[];game.traffic=[];
  game.history=[];game.loopCount++;game.loopCooldown=35;game.red=.8;game.shake=.35;
  spawnBoost();for(let i=0;i<4;i++)spawnPedestrian(true);
  showEvent('TIME LOOP — THE SAME LANDMARKS. AGAIN.',3);return true;
}
function update(dt){
  if(!game.running)return;
  if(MiniGames.active){game.burst=0;MiniGames.update(dt);return;}
  if(game.memoryTimer>0){game.memoryTimer-=dt;if(game.memoryTimer<=0)showMemoryDoors();return;}
  if(game.memoryTimer===-1)return;
  game.time+=dt;game.resumeGrace=Math.max(0,game.resumeGrace-dt);
  const mx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),my=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0),length=Math.hypot(mx,my);
  updateBoost(dt,length>0);
  const oldX=game.x,oldY=game.y;
  if(length){game.heading=Math.atan2(mx,-my);const speed=(220+160*game.burst)*(game.setback>0?.65:1);World.move(game,mx/length*speed*dt,my/length*speed*dt,13);}
  if(isHighway()){game.x=clamp(game.x,134,506);game.y=Math.min(150,game.y);if(game.y<World.highwayEnd-20){game.free=true;showEvent('THE HIGHWAY ENDS — EXPLORE ANY DIRECTION',3);}}
  const travelled=Math.hypot(game.x-oldX,game.y-oldY);game.moving=travelled>.01;game.d+=travelled/8;
  game.setback=Math.max(0,game.setback-dt);game.red=Math.max(0,game.red-dt);game.shake=Math.max(0,game.shake-dt);
  game.cameraX=game.x-W/2;game.cameraY=game.y-H/2;game.scroll=-game.cameraY;
  updateBiome();updateMainWoman(dt);if(!game.running)return;
  for(const p of game.pickups)p.pulse+=dt;
  game.pickups=game.pickups.filter(p=>{if(Math.hypot(p.x-game.x,p.y-game.y)<30){game.boost=Math.min(1,game.boost+.35);showEvent('+35% BOOST FUEL',.8);return false;}return Math.hypot(p.x-game.x,p.y-game.y)<950;});
  if(game.moving)game.pickupTimer-=dt;if(game.pickupTimer<=0){spawnBoost();game.pickupTimer=rand(30,38);}
  game.trafficTimer-=dt;if(game.trafficTimer<=0){spawnTraffic();game.trafficTimer=3;}
  updateTraffic(dt);
  for(const p of game.pedestrians){const ox=p.x,oy=p.y;World.move(p,p.vx*dt,p.vy*dt,7);if(Math.hypot(p.x-ox,p.y-oy)<dt*3){p.vx*=-1;p.vy*=-1;}p.phase+=dt*4;}
  game.pedestrians=game.pedestrians.filter(p=>Math.hypot(p.x-game.x,p.y-game.y)<850);
  game.pedestrianTimer-=dt;if(game.pedestrianTimer<=0){spawnPedestrian();game.pedestrianTimer=2.4;}
  game.monsterTimer-=dt;if(game.monsterTimer<=0){encounter();game.monsterTimer=rand(38,60);}
  game.loopCooldown=Math.max(0,game.loopCooldown-dt);
  for(const m of game.monsters){
    if(m.life<=0)continue;m.age+=dt;
    const gap=Math.hypot(m.x-game.x,m.y-game.y);
    const visible=monsterVisible(m);
    if(visible){m.seen=true;m.outOfSight=0;}
    else if(m.seen){m.outOfSight=(m.outOfSight||0)+dt;if(m.outOfSight>.35){m.life=0;showEvent('OUT OF SIGHT — CHASE ENDED',1.2);continue;}}
    if(m.entrySide&&!m.seen&&m.age>8){m.life=0;continue;}
    if(m.exhausted){m.moving=false;m.restAge+=dt;if(m.restAge>6)m.life=0;continue;}
    if(!m.revealed){
      World.move(m,Math.sin(m.id)*12*dt,Math.cos(m.id)*12*dt,8);m.phase+=dt*4;
      if(gap<220&&game.forcedTimer===0&&game.sprintWarning===0){m.revealed=true;m.revealProgress=0;m.revealGrace=.7;m.transformDuration=transformationDuration();HorrorAudio.cue('reveal');game.red=.12;showEvent('SOMETHING IS WRONG — MOVE AWAY FROM THE AMBER RING',m.transformDuration+.7);}
    }
    if(m.revealed){
      if(m.revealProgress<1){m.moving=false;m.revealProgress=Math.min(1,m.revealProgress+dt/(m.transformDuration||2.8));continue;}
      if(m.revealGrace>0){m.moving=false;m.revealGrace=Math.max(0,m.revealGrace-dt);continue;}
      if(game.resumeGrace>0){m.moving=false;continue;}
      if(m.entryWarning>0){m.entryWarning=Math.max(0,m.entryWarning-dt);pursue(m,dt,180);continue;}
      if(m.kind==='loop'&&game.loopCooldown===0&&rewindWorld())break;
      if(m.sprinter){
        m.sprintLeft=Math.max(0,m.sprintLeft-dt);
        if(m.sprintLeft===0){m.exhausted=true;m.moving=false;m.path=[];m.restAge=0;showEvent('IT IS EXHAUSTED — GET AWAY',1.8);continue;}
      }
      m.chaseAge=(m.chaseAge||0)+dt;
      if(!m.entrySide&&m.chaseAge>8&&gap>80){m.life=0;showEvent('IT LOST YOUR SCENT',1.4);continue;}
      pursue(m,dt,m.speed);
      if(Math.hypot(m.x-game.x,m.y-game.y)<25){endRun('CAUGHT BY '+m.name.toUpperCase());return;}
    }
  }
  game.monsters=game.monsters.filter(m=>m.life>0&&Math.hypot(m.x-game.x,m.y-game.y)<1000&&m.age<55);
  const active=game.monsters.filter(m=>m.life>0&&!m.exhausted&&m.revealed&&m.revealProgress>=1&&m.revealGrace<=0);
  const closest=Math.min(Math.hypot(game.woman.x-game.x,game.woman.y-game.y),...active.map(m=>Math.hypot(m.x-game.x,m.y-game.y)));
  game.fear=Math.max(game.sprintWarning>0?.8:0,clamp(1-closest/460,0,1));
  game.historyTimer-=dt;if(game.historyTimer<=0){game.history.push({x:game.x,y:game.y,heading:game.heading,free:game.free});if(game.history.length>48)game.history.shift();game.historyTimer=.25;}
  game.nextMemory-=dt;if(game.nextMemory<=0)startChallenge();
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
function loop(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);HorrorAudio.update(game,dt);draw();raf=requestAnimationFrame(loop);}
function begin(){if(!MonsterArt.loaded)return;HorrorAudio.init();reset();game.running=true;startScreen.classList.add('hidden');death.classList.add('hidden');last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
$('#sound-toggle').addEventListener('click',()=>{$('#sound-toggle').textContent=HorrorAudio.toggle()?'SOUND OFF':'SOUND ON';});
start.addEventListener('click',begin);restart.addEventListener('click',begin);
leftDoor.addEventListener('click',()=>chooseDoor(leftDoor.textContent));rightDoor.addEventListener('click',()=>chooseDoor(rightDoor.textContent));
addEventListener('keydown',e=>{
  const key=e.key.length===1?e.key.toLowerCase():e.key;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Shift'].includes(key))e.preventDefault();
  if(MiniGames.active){if(key==='Enter')e.preventDefault();if(!e.repeat)MiniGames.key(key);return;}
  if(game.memoryTimer!==0)return;keys[key]=true;
});
addEventListener('keyup',e=>{const key=e.key.length===1?e.key.toLowerCase():e.key;keys[key]=false;if(!keys[' ']&&!keys.Shift){game.burst=0;game.boostHeldTime=0;updateHUD();}});
addEventListener('blur',()=>{for(const key of Object.keys(keys))delete keys[key];game.burst=0;game.boostHeldTime=0;updateHUD();});
start.disabled=true;start.textContent='LOADING CREATURES…';
MonsterArt.ready.then(()=>{start.disabled=false;start.textContent='START DRIVE';draw();}).catch(()=>{start.textContent='RELOAD TO RETRY';eventEl.textContent='Creature artwork could not load. Refresh to retry.';});
reset();
