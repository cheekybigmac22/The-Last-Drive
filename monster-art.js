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
  function creature(x,y,id,age,alpha=1){
    if(alpha<=0)return;
    const cell=id%8,cw=atlas.naturalWidth/4,ch=atlas.naturalHeight/2;
    const sx=(cell%4)*cw,sy=Math.floor(cell/4)*ch;
    const height=(id===1?172:150)+(Math.floor(id/8)%5)*6;
    const width=height*cw/ch;
    c.save();c.globalAlpha=alpha;
    c.fillStyle='rgba(16,13,25,.32)';c.beginPath();c.ellipse(x+5,y+25,21,7,0,0,Math.PI*2);c.fill();
    c.translate(x,y+24);c.rotate(Math.sin(age*1.8+id)*.018);
    c.drawImage(atlas,sx,sy,cw,ch,-width/2,-height,width,height);
    c.restore();
  }
  function draw(g,W,H){
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,layer.width,layer.height);
    if(!loaded)return;
    c.setTransform(layer.width/W,0,0,layer.height/H,0,0);
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    const shake=g.shake&&g.running?Math.round(Math.sin(g.time*51)*g.shake*4)*2:0;
    c.save();c.translate(shake-Math.round(g.cameraX/2)*2,0);
    const actors=[];
    for(const m of g.monsters)if(m.life>0&&m.revealed)actors.push({x:m.x,y:m.y,id:m.id,age:m.age,alpha:m.revealProgress});
    const womanAlpha=g.mainRush>0?Math.min(1,g.mainRush*5):Math.max(0,Math.min(1,(g.mainWoman-.2)*2));
    if(womanAlpha>0)actors.push({x:g.x+68*(1-g.mainRush),y:H-32-g.mainRush*83,id:1,age:g.time,alpha:womanAlpha});
    actors.sort((a,b)=>a.y-b.y).forEach(m=>creature(m.x,m.y,m.id,m.age,m.alpha));
    c.restore();
  }
  return {draw,ready,get loaded(){return loaded;}};
})();
