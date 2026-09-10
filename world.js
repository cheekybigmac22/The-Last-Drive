/* Coordinate-stable terrain, landmarks and collision geometry. Revisited places
   regenerate identically, including when a time loop rewinds the rider. */
const World=(()=>{
  const highwayEnd=-3200,seed=27183;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function hash(x,y,s=0){let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s+seed,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
  function highway(x,y){return x>=0&&x<=640&&y>=highwayEnd&&y<1000;}
  function biome(x,y){
    if(highway(x,y))return 0;
    const cell=1000,cx=Math.floor(x/cell),cy=Math.floor(y/cell);let best=Infinity,id=1,regionX=0,regionY=0,depth=0;
    for(let a=cx-2;a<=cx+2;a++)for(let b=cy-2;b<=cy+2;b++){
      const px=(a+.12+hash(a,b,1)*.76)*cell,py=(b+.12+hash(a,b,2)*.76)*cell;
      const d=(px-x)**2+(py-y)**2;
      if(d<best){best=d;id=[1,2,3,7,8,9][Math.floor(hash(a,b,3)*6)];regionX=a;regionY=b;depth=Math.hypot(px-320,py)/1000;}
    }
    // Corruption also follows irregular regions, not fixed-distance rings.
    if(depth>18)return [4,5,6,6][Math.floor(hash(regionX,regionY,8)*4)];
    if(depth>15)return [4,5,5,6][Math.floor(hash(regionX,regionY,8)*4)];
    if(depth>12)return [4,4,5][Math.floor(hash(regionX,regionY,8)*3)];
    return id;
  }
  const cache=new Map();
  function prop(col,row){
    const key=col+':'+row;if(cache.has(key))return cache.get(key);
    const x=col*144+Math.round(hash(col,row,4)*38),y=row*144+Math.round(hash(col,row,5)*38),b=biome(x,y);
    let value=null;
    const road=RoadNetwork.closest(x,y),edge=road.distance-road.segment.width/2;
    if(edge>48&&!(highway(x,y)&&x>100&&x<540)){
      const n=hash(col,row,6),kind=b===1?(n<.13?'pyramid':n<.4?'dune':n<.68?'cactus':'rock'):
        b===2?(n<.12?'temple':n<.28?'pond':n<.62?'palm':'tree'):
        b===3?(n<.72?'house':n<.86?'fountain':'tree'):
        b===7?(n<.22?'barn':n<.35?'pond':n<.54?'hay':'tree'):
        b===8?(n<.22?'cabin':n<.45?'ice':'pine'):
        b===9?(n<.2?'lighthouse':n<.4?'boat':n<.6?'rock':'palm'):
        b>=4&&b<=6?(n<.23?'ruin':n<.42?'crystal':n<.6?'house':'tree'):'tree';
      const size={house:[42,48],barn:[45,42],cabin:[42,44],pyramid:[53,46],dune:[40,22],temple:[46,40],pond:[42,25],fountain:[26,22],hay:[22,18],ice:[26,25],lighthouse:[27,35],boat:[34,18],ruin:[27,30],crystal:[24,25],tree:[20,20],pine:[20,22],palm:[14,18],cactus:[14,22],rock:[24,19]}[kind];
      // Keep every footprint away from the shared connected road network.
      if(edge>Math.max(...size)+25)value={id:key,x,y,biome:b,kind,rx:size[0],ry:size[1],seed:Math.floor(hash(col,row,7)*10000)};
    }
    cache.set(key,value);if(cache.size>3000)cache.delete(cache.keys().next().value);return value;
  }
  function props(minX,minY,maxX,maxY){
    const result=[];
    for(let a=Math.floor((minX-80)/144);a<=Math.ceil((maxX+80)/144);a++)for(let b=Math.floor((minY-80)/144);b<=Math.ceil((maxY+80)/144);b++){
      const p=prop(a,b);if(p&&p.x+p.rx>=minX&&p.x-p.rx<=maxX&&p.y+p.ry>=minY&&p.y-p.ry<=maxY)result.push(p);
    }
    return result;
  }
  function blocked(x,y,r=12){return props(x-r,y-r,x+r,y+r).some(p=>Math.abs(x-p.x)<p.rx+r&&Math.abs(y-p.y)<p.ry+r);}
  function move(actor,dx,dy,r=12){
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6)),sx=dx/steps,sy=dy/steps;
    for(let i=0;i<steps;i++){if(!blocked(actor.x+sx,actor.y,r))actor.x+=sx;if(!blocked(actor.x,actor.y+sy,r))actor.y+=sy;}
  }
  function clear(ax,ay,bx,by,r=12){
    const steps=Math.ceil(Math.hypot(bx-ax,by-ay)/10);
    for(let i=0;i<=steps;i++){const t=steps?i/steps:0;if(blocked(ax+(bx-ax)*t,ay+(by-ay)*t,r))return false;}return true;
  }
  function openPoint(x,y,r=14){
    if(!blocked(x,y,r))return {x,y};
    for(let d=24;d<=240;d+=24)for(let a=0;a<16;a++){const px=x+Math.cos(a*Math.PI/8)*d,py=y+Math.sin(a*Math.PI/8)*d;if(!blocked(px,py,r))return {x:px,y:py};}
    const road=RoadNetwork.closest(x,y);return {x:road.x,y:road.y};
  }
  function route(from,to,r=12){
    if(clear(from.x,from.y,to.x,to.y,r))return [{x:to.x,y:to.y}];
    // Local eight-direction A*: take a shortcut toward the rider, not their trail.
    const step=32,sx=0,sy=0,tx=(to.x-from.x)/step,ty=(to.y-from.y)/step,originX=from.x,originY=from.y;
    const key=(x,y)=>x+':'+y,heuristic=(x,y)=>Math.hypot(x-tx,y-ty);
    const root={x:sx,y:sy,g:0,f:heuristic(sx,sy),parent:null},open=[root],seen=new Map([[key(sx,sy),0]]);
    for(let count=0;open.length&&count<1800;count++){
      let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
      const n=open.splice(best,1)[0];
      if(heuristic(n.x,n.y)<1.5&&clear(originX+n.x*step,originY+n.y*step,to.x,to.y,r)){
        const path=[{x:to.x,y:to.y}];for(let p=n;p.parent;p=p.parent)path.unshift({x:originX+p.x*step,y:originY+p.y*step});
        while(path.length>1&&clear(from.x,from.y,path[1].x,path[1].y,r))path.shift();return path;
      }
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
        if(!dx&&!dy)continue;const x=n.x+dx,y=n.y+dy;
        if(Math.abs(x-sx)>24||Math.abs(y-sy)>24||!clear(originX+n.x*step,originY+n.y*step,originX+x*step,originY+y*step,r))continue;
        const g=n.g+Math.hypot(dx,dy),k=key(x,y);if(seen.has(k)&&seen.get(k)<=g)continue;
        seen.set(k,g);open.push({x,y,g,f:g+heuristic(x,y),parent:n});
      }
    }
    return [];
  }
  return {biome,highway,highwayEnd,hash,props,blocked,move,clear,openPoint,route,get cacheSize(){return cache.size;}};
})();
