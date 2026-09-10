/* Both challenges pause the world; a mistake never kills the rider. */
const MiniGames=(()=>{
  const $=s=>document.querySelector(s),panel=$('#challenge'),title=$('#challenge-title'),instruction=$('#challenge-instruction'),display=$('#challenge-display'),arrows=$('#challenge-arrows'),lock=$('#challenge-lock'),track=$('#timing-track'),target=$('#timing-target'),needle=$('#timing-needle');
  const symbols=['↑','→','↓','←'];let state=null;
  function finish(ok){const done=state.done;state=null;panel.classList.add('hidden');done(ok);}
  function start(kind,level,done){
    panel.classList.remove('hidden');arrows.classList.add('hidden');lock.classList.add('hidden');track.classList.add('hidden');
    if(kind==='sequence'){
      const sequence=Array.from({length:Math.min(8,3+level)},()=>Math.floor(Math.random()*4));
      state={kind,sequence,index:0,elapsed:0,beat:Math.max(.48,.9-level*.055),stage:'show',done};
      title.textContent='ECHO SIGNAL';instruction.textContent='Watch the arrows, then repeat them. The chase is paused.';display.textContent=symbols[sequence[0]];
    }else{
      const width=Math.max(.18,.34-level*.025),left=.2+Math.random()*(.6-width);
      state={kind:'timing',width,left,speed:Math.min(1.25,.7+level*.1),elapsed:0,position:0,hits:0,required:Math.min(3,1+Math.floor(level/2)),done};
      title.textContent='ENGINE TUNE';instruction.textContent='Stop inside the green zone. Press Space or STOP.';display.textContent='0 / '+state.required;
      target.style.left=left*100+'%';target.style.width=width*100+'%';needle.style.left='0%';track.classList.remove('hidden');lock.classList.remove('hidden');
    }
  }
  function update(dt){
    if(!state)return;const s=state;s.elapsed+=dt;
    if(s.kind==='sequence'&&s.stage==='show'){
      const i=Math.floor(s.elapsed/s.beat);
      if(i>=s.sequence.length){s.stage='input';display.textContent='YOUR TURN';instruction.textContent='Repeat with arrow keys, WASD, or the buttons.';arrows.classList.remove('hidden');}
      else display.textContent=s.elapsed%s.beat<s.beat*.75?symbols[s.sequence[i]]:'·';
    }else if(s.kind==='timing'){s.position=(Math.sin(s.elapsed*s.speed*Math.PI-Math.PI/2)+1)/2;needle.style.left=s.position*100+'%';}
  }
  function input(value){
    if(!state)return;const s=state;
    if(s.kind==='sequence'){
      if(s.stage!=='input')return;if(value!==s.sequence[s.index]){finish(false);return;}
      s.index++;display.textContent=s.index+' / '+s.sequence.length;if(s.index===s.sequence.length)finish(true);
    }else if(value==='stop'){
      if(s.position<s.left||s.position>s.left+s.width){finish(false);return;}
      s.hits++;if(s.hits===s.required){finish(true);return;}
      s.left=.12+Math.random()*(.76-s.width);target.style.left=s.left*100+'%';s.elapsed=0;s.position=0;display.textContent=s.hits+' / '+s.required;
    }
  }
  for(let i=0;i<4;i++)$('#signal-'+i).addEventListener('click',()=>input(i));
  lock.addEventListener('click',()=>input('stop'));
  function key(key){const directions={ArrowUp:0,w:0,ArrowRight:1,d:1,ArrowDown:2,s:2,ArrowLeft:3,a:3};if(state?.kind==='sequence'&&directions[key]!==undefined)input(directions[key]);else if(key===' '||key==='Enter')input('stop');}
  function reset(){state=null;panel.classList.add('hidden');}
  return {start,update,input,key,reset,get active(){return !!state;},get state(){return state;}};
})();
