/* Revealed creatures are deliberately drawn on their own high-resolution layer.
   The street renderer must never send these images through its pixel buffer. */
const MonsterArt = (() => {
  const layer=document.querySelector('#monster-layer'),c=layer.getContext('2d');
  const loaded=true,ready=Promise.resolve();
  const frames=new Map(),textures=new Map(),frameCount=16;
  // Original code-drawn ink masks: deliberately uneven, matte and photocopied.
  // Texture randomness is seeded, so grain sticks to the body during animation.
  function inkDrawing(ctx,cell){
    let seed=719+cell*977;
    const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const line=(points,width,color)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();};
    function shape(points,color){
      ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();
      ctx.save();ctx.clip();
      for(let n=0;n<1800;n++){ctx.fillStyle=n%3?'rgba(0,0,0,.23)':'rgba(205,186,172,.22)';ctx.fillRect(rnd()*192,rnd()*256,.4+rnd()*1.7,.5+rnd()*2);}
      for(let n=0;n<45;n++){const x=rnd()*192,y=rnd()*256;line([[x,y],[x-5+rnd()*10,y+12+rnd()*35]],.5,'rgba(0,0,0,.45)');}
      ctx.restore();
      for(let n=0;n<4;n++)line([...points,points[0]].map(([x,y])=>[x+(rnd()-.5)*3,y+(rnd()-.5)*3]),.7,'#211a1b');
    }
    const lean=(cell%3-1)*7;
    // Crooked, weight-bearing limbs and a torn coat silhouette.
    for(const side of [-1,1]){
      const arm=[[96+side*21,94],[96+side*(34+cell%3*4),137],[96+side*48,178+side*8]];
      line(arm,7,'#121113');line(arm.map(([x,y])=>[x+2,y]),1,'#514446');
      for(let f=0;f<3;f++)line([[96+side*48,178+side*8],[96+side*(49+f*3),195+side*8-f*2]],1,'#211c20');
      const leg=[[96+side*13,143],[96+side*20+lean,194],[96+side*27,244],[96+side*39,248]];
      line(leg,8,'#141215');line(leg.map(([x,y])=>[x-2,y]),1,'#5a4a4d');
    }
    shape([[85,62],[109,62],[114,87],[127,101],[117,137],[126,162],[106,157],[99,166],[78,158],[68,143],[77,112],[70,99],[83,85]],'#151315');
    const heads=[
      [[57,24],[111,12],[134,34],[104,83],[81,76]],
      [[79,13],[103,9],[117,30],[115,73],[96,86],[73,65],[70,32]],
      [[8,19],[181,14],[125,47],[105,82],[85,78],[68,45]],
      [[61,36],[84,17],[120,21],[135,43],[107,91],[77,68]],
      [[84,4],[103,9],[113,68],[99,88],[81,73]],
      [[51,31],[72,13],[121,17],[138,38],[122,70],[86,81],[60,57]],
      [[68,11],[111,20],[126,49],[111,84],[79,74],[61,39]],
      [[39,20],[136,13],[150,34],[117,54],[105,89],[87,81],[70,48]]
    ];
    shape(heads[cell],cell===2?'#111113':['#6b3839','#88716b','#242025','#6d5550'][cell%4]);
    if(cell===1)for(let n=0;n<28;n++){const side=n%2?-1:1;line([[96+side*21,18],[96+side*(24+rnd()*8),58],[96+side*(27+rnd()*12),106+rnd()*22]],.6,'#1a171b');}
    for(const [x,y,w,h] of [[84,40,cell===2?3:5,cell===1?13:7],[105,39,cell===2?3:6,cell===1?14:8]]){
      ctx.beginPath();ctx.ellipse(x,y,w+2,h+2,-.12,0,Math.PI*2);ctx.fillStyle=cell===2?'#b3aaa1':'#281c20';ctx.fill();
      ctx.beginPath();ctx.ellipse(x+1,y,w,h,.15,0,Math.PI*2);ctx.fillStyle='#08080b';ctx.fill();
      line([[x-w-2,y-h],[x-w-3,y+h+5]],.6,'#b29b8a');
    }
    if(cell!==2)shape([[83,56],[105,53],[109,61],[100,78],[94,83],[87,72]],'#0b090d');
    for(let n=0;n<14;n++){const x=58+rnd()*78,y=17+rnd()*58;line([[x,y],[x+(x-96)*.55,y-8-rnd()*19]],.5,'rgba(87,67,68,.65)');}
  }
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
      const tc=texture.getContext('2d');inkDrawing(tc,cell);textures.set(cell,texture);
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
    for(const m of g.monsters)if(m.life>0&&m.revealed){const emergence=Emergence.pose(m.id,m.revealProgress);if(m.exhausted){emergence.sy=.72;emergence.angle=.12;emergence.alpha=.65;}actors.push({x:m.x,y:m.y,id:m.id,age:m.age,alpha:emergence.alpha,moving:m.moving,phase:m.phase,emergence});}
    if(g.mainWoman>0)actors.push({x:g.woman.x,y:g.woman.y,id:1,age:g.time,alpha:g.mainWoman,moving:g.woman.moving,phase:g.woman.phase});
    actors.sort((a,b)=>a.y-b.y).forEach(m=>{
      c.save();
      if(m.emergence){const p=m.emergence;c.translate(m.x+p.x,m.y+p.y);c.rotate(p.angle);c.scale(p.sx,p.sy);creature(0,0,m.id,m.age,m.alpha,m.moving,m.phase);}
      else creature(m.x,m.y,m.id,m.age,m.alpha,m.moving,m.phase);
      c.restore();
    });
    c.restore();
  }
  return {draw,ready,pose,get textureCount(){return textures.size;},get cachedFrames(){return frames.size;},get loaded(){return loaded;}};
})();
