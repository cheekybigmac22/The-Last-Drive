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
  function creature(x,y,id,age,alpha=1,moving=false,phase=0){
    if(alpha<=0)return;
    const cell=id%8,cw=atlas.naturalWidth/4,ch=atlas.naturalHeight/2;
    const sx=(cell%4)*cw,sy=Math.floor(cell/4)*ch;
    const height=(id===1?172:150)+(Math.floor(id/8)%5)*6;
    const width=height*cw/ch;
    c.save();c.globalAlpha=alpha;
    c.fillStyle='rgba(16,13,25,.32)';c.beginPath();c.ellipse(x+5,y+25,21,7,0,0,Math.PI*2);c.fill();
    const stride=moving?Math.sin(phase)*1:0;
    c.translate(x,y+24-Math.abs(stride)*4);c.rotate(stride*.025);
    // Articulated scanline bands: torso bobs, lower limbs swing in opposing
    // phases. Source bands cover the atlas cell exactly, with no new bitmap.
    const bands=32;
    for(let i=0;i<bands;i++){
      const t=i/bands,sh=ch/bands,dh=height/bands+.6;
      if(t<.52)c.drawImage(atlas,sx,sy+i*sh,cw,sh,-width/2+stride*t*2,-height+i*height/bands,width,dh);
      else for(let side=0;side<2;side++){
        const swing=stride*(t-.52)*15*(side?1:-1);
        c.drawImage(atlas,sx+side*cw/2,sy+i*sh,cw/2,sh,-width/2+side*width/2+swing,-height+i*height/bands,width/2,dh);
      }
    }
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
    for(const m of g.monsters)if(m.life>0&&m.revealed)actors.push({x:m.x,y:m.y,id:m.id,age:m.age,alpha:m.revealProgress,moving:m.moving,phase:m.phase});
    if(g.mainWoman>0)actors.push({x:g.woman.x,y:g.woman.y,id:1,age:g.time,alpha:g.mainWoman,moving:g.woman.moving,phase:g.woman.phase});
    actors.sort((a,b)=>a.y-b.y).forEach(m=>creature(m.x,m.y,m.id,m.age,m.alpha,m.moving,m.phase));
    c.restore();
  }
  return {draw,ready,get loaded(){return loaded;}};
})();
