/* Revealed creatures are deliberately drawn on their own high-resolution layer.
   The street renderer must never send these images through its pixel buffer. */
const MonsterArt = (() => {
  const layer=document.querySelector('#monster-layer'),c=layer.getContext('2d');
  const atlas=new Image();
  let loaded=false;
  const ready=new Promise((resolve,reject)=>{
    atlas.onload=()=>{loaded=true;resolve();};
    atlas.onerror=()=>reject(new Error('Monster atlas could not load'));
  });
  atlas.src='assets/monsters-atlas.webp';
  const frames=new Map(),textures=new Map(),frameCount=16;
  const profiles=[
    {hip:.53,stride:1.1,arms:.8,bob:1}, {hip:.59,stride:.9,arms:1.25,bob:.7},
    {hip:.52,stride:1,arms:1,bob:1}, {hip:.46,stride:1.35,arms:1.35,bob:.6},
    {hip:.56,stride:1.15,arms:.85,bob:.85}, {hip:.52,stride:1.05,arms:1.1,bob:1.1},
    {hip:.55,stride:1.2,arms:1.15,bob:1}, {hip:.55,stride:.95,arms:1,bob:.8}
  ];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function pose(u,v,phase,moving,profile){
    if(!moving)return {x:u,y:v};
    const side=u<.5?-1:1,p=phase+(side<0?0:Math.PI),stride=Math.sin(p);
    let x=u,y=v;
    // Opposing shoulder/arm swings pivot around the shoulder, not horizontal
    // image slices. Smooth weights keep every neighboring triangle connected.
    const outer=clamp((Math.abs(u-.5)-.12)/.18,0,1);
    const armWeight=outer*clamp((v-.25)/.15,0,1)*clamp((.86-v)/.2,0,1);
    const ax=u-(.5+side*.18),ay=v-.35,angle=-stride*.22*profile.arms;
    x+=(ax*Math.cos(angle)-ay*Math.sin(angle)-ax)*armWeight;
    y+=(ax*Math.sin(angle)+ay*Math.cos(angle)-ay)*armWeight;
    const leg=clamp((v-profile.hip)/(1-profile.hip),0,1);
    // A planted foot pushes back while the opposite knee rises and recovers.
    // Knees flex most mid-limb; lifted feet shorten the recovering leg.
    const lift=Math.max(0,stride),bend=Math.sin(leg*Math.PI);
    x+=side*(lift*.065*bend+stride*.04*leg)*profile.stride;
    y-=lift*(.085*leg+.035*bend)*profile.stride;
    y+=Math.max(0,-stride)*.018*leg;
    x+=Math.sin(phase)*.014*(1-v);
    const flight=Math.max(0,Math.sin(phase*2-.5));
    const landing=Math.max(0,-Math.sin(phase*2-.5));
    y-=flight*(1-flight*.3)*.045*profile.bob;
    y+=landing*.014*(1-v); // torso compresses into landing, then drives upward
    return {x,y};
  }
  function triangle(context,texture,src,dst){
    context.save();context.beginPath();context.moveTo(dst[0].x,dst[0].y);context.lineTo(dst[1].x,dst[1].y);context.lineTo(dst[2].x,dst[2].y);context.closePath();context.clip();
    const [p,q,r]=src,[a,b,d]=dst;
    const det=(q.x-p.x)*(r.y-p.y)-(r.x-p.x)*(q.y-p.y);
    const m11=((b.x-a.x)*(r.y-p.y)-(d.x-a.x)*(q.y-p.y))/det;
    const m12=((b.y-a.y)*(r.y-p.y)-(d.y-a.y)*(q.y-p.y))/det;
    const m21=((d.x-a.x)*(q.x-p.x)-(b.x-a.x)*(r.x-p.x))/det;
    const m22=((d.y-a.y)*(q.x-p.x)-(b.y-a.y)*(r.x-p.x))/det;
    context.transform(m11,m12,m21,m22,a.x-m11*p.x-m21*p.y,a.y-m12*p.x-m22*p.y);
    context.drawImage(texture,0,0);context.restore();
  }
  function frame(cell,index){
    const key=cell+':'+index;if(frames.has(key))return frames.get(key);
    const tw=192,th=256,pad=24;
    let texture=textures.get(cell);
    if(!texture){
      texture=document.createElement('canvas');texture.width=tw;texture.height=th;
      const tc=texture.getContext('2d'),cw=atlas.naturalWidth/4,ch=atlas.naturalHeight/2;
      tc.imageSmoothingEnabled=true;tc.drawImage(atlas,cell%4*cw,Math.floor(cell/4)*ch,cw,ch,0,0,tw,th);textures.set(cell,texture);
    }
    const out=document.createElement('canvas');out.width=tw+pad*2;out.height=th+pad*2;
    const oc=out.getContext('2d');oc.imageSmoothingEnabled=true;
    if(index<0)oc.drawImage(texture,pad,pad);
    else{
      const cols=10,rows=16,source=[],target=[],phase=index/frameCount*Math.PI*2;
      for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
        const u=col/cols,v=row/rows,p=pose(u,v,phase,true,profiles[cell]);
        source.push({x:u*tw,y:v*th});target.push({x:pad+p.x*tw,y:pad+p.y*th});
      }
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const a=row*(cols+1)+col,b=a+1,d=a+cols+1,e=d+1;
        for(const ids of [[a,b,e],[a,e,d]])triangle(oc,texture,ids.map(i=>source[i]),ids.map(i=>target[i]));
      }
    }
    frames.set(key,out);return out;
  }
  function creature(x,y,id,age,alpha=1,moving=false,phase=0){
    if(alpha<=0)return;
    const cell=id%8,height=(id===1?172:150)+(Math.floor(id/8)%5)*6,width=height*.75;
    const index=moving?((Math.floor(phase/(Math.PI*2)*frameCount)%frameCount)+frameCount)%frameCount:-1;
    const art=frame(cell,index),scale=height/256,pad=24*scale;
    c.save();c.globalAlpha=alpha;
    // Ground shadow stays planted while the body rises through each stride.
    c.fillStyle='rgba(16,13,25,.32)';c.beginPath();c.ellipse(x+5,y+25,21,7,0,0,Math.PI*2);c.fill();
    c.drawImage(art,x-width/2-pad,y+24-height-pad,width+pad*2,height+pad*2);
    c.restore();
  }
  function draw(g,W,H){
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,layer.width,layer.height);
    if(!loaded)return;
    c.setTransform(layer.width/W,0,0,layer.height/H,0,0);
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    const shake=g.shake&&g.running?Math.round(Math.sin(g.time*51)*g.shake*4)*2:0;
    c.save();c.translate(shake-g.cameraX,0);
    const actors=[];
    for(const m of g.monsters)if(m.life>0&&m.revealed){const emergence=Emergence.pose(m.id,m.revealProgress);actors.push({x:m.x,y:m.y,id:m.id,age:m.age,alpha:emergence.alpha,moving:m.moving,phase:m.phase,emergence});}
    if(g.mainWoman>0)actors.push({x:g.woman.x,y:g.woman.y,id:1,age:g.time,alpha:g.mainWoman,moving:g.woman.moving,phase:g.woman.phase});
    actors.sort((a,b)=>a.y-b.y).forEach(m=>{
      c.save();
      if(m.emergence){const p=m.emergence;c.translate(m.x+p.x,m.y+p.y);c.rotate(p.angle);c.scale(p.sx,p.sy);creature(0,0,m.id,m.age,m.alpha,m.moving,m.phase);}
      else creature(m.x,m.y,m.id,m.age,m.alpha,m.moving,m.phase);
      c.restore();
    });
    c.restore();
  }
  return {draw,ready,pose,get cachedFrames(){return frames.size;},get loaded(){return loaded;}};
})();
