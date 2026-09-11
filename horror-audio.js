/* Locally synthesized sound, started only by the player's Start click.
   No recordings, downloads, autoplay, or unbounded audio-node accumulation. */
const HorrorAudio=(()=>{
  let context,master,drone,wind,muted=false,beat=0,step=0,voices=0;
  function init(){
    try{
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
      if(!context){context=new Audio();master=context.createGain();master.gain.value=.12;master.connect(context.destination);
        drone=context.createOscillator();const low=context.createBiquadFilter(),volume=context.createGain();
        drone.type='sawtooth';drone.frequency.value=38;low.type='lowpass';low.frequency.value=100;volume.gain.value=0;
        drone.connect(low);low.connect(volume);volume.connect(master);drone.volume=volume;drone.start();
        const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.5;
        wind=context.createBufferSource();wind.buffer=buffer;wind.loop=true;const filter=context.createBiquadFilter(),wv=context.createGain();
        filter.type='lowpass';filter.frequency.value=750;wv.gain.value=0;wind.connect(filter);filter.connect(wv);wv.connect(master);wind.volume=wv;wind.start();}
      const promise=context.resume();if(promise?.catch)promise.catch(()=>{});
    }catch{context=null;}
  }
  function cue(kind){
    if(!context||muted||context.state!=='running'||voices>=6)return;
    const settings={warning:[92,36,.8,.45],reveal:[170,43,.65,.36],death:[65,22,1.2,.4],beat:[48,30,.16,.55],step:[95,42,.09,.18]};
    const [from,to,duration,level]=settings[kind]||settings.reveal,t=context.currentTime;
    const osc=context.createOscillator(),gain=context.createGain();voices++;
    osc.type=kind==='beat'?'sine':'triangle';osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);
    gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(level,t+.025);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
    osc.connect(gain);gain.connect(master);osc.onended=()=>{osc.disconnect();gain.disconnect();voices--;};osc.start(t);osc.stop(t+duration+.02);
  }
  function update(g,dt){
    if(!context)return;const paused=!g.running||g.memoryTimer!==0||MiniGames.active;
    const threat=paused?0:Math.max(g.fear||0,g.sprintWarning>0?.8:0);
    master.gain.setTargetAtTime(muted?0:.12,context.currentTime,.08);
    drone.volume.gain.setTargetAtTime(paused?0:.025+threat*.13,context.currentTime,.25);
    drone.frequency.setTargetAtTime(34+threat*17,context.currentTime,.3);
    wind.volume.gain.setTargetAtTime(paused?0:.015+threat*.045,context.currentTime,.25);
    beat-=dt;if(!paused&&threat>.12&&beat<=0){cue('beat');beat=1.1-threat*.72;}
    step-=dt;if(!paused&&threat>.35&&step<=0){cue('step');step=.42-threat*.18;}
  }
  function toggle(){muted=!muted;if(master)master.gain.value=muted?0:.12;return muted;}
  return {init,cue,update,toggle};
})();
