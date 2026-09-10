/* Shared, deterministic streets. Coordinates are in the scrolling world: screen
   y = world y + scroll. Nothing is cached, so travelling forever uses fixed memory. */
const RoadNetwork = (() => {
  const blockX = 560, blockY = 500;
  const mod = (n, d) => ((n % d) + d) % d;
  function hash(x, y, salt = 0) {
    let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function node(col, row) {
    return {
      x: col * blockX + 70 + mod(row, 2) * 232 + Math.round((hash(col, row, 1) - .5) * 92 / 2) * 2,
      y: row * blockY + (mod(col + row, 2) ? 64 : -64) + Math.round((hash(col, row, 2) - .5) * 72 / 2) * 2
    };
  }
  function edge(col, row, direction) {
    const a = node(col, row), b = node(col + (direction === 0 ? 1 : 0), row + (direction === 1 ? 1 : 0));
    return { id: `${col}:${row}:${direction}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      width: 92 + Math.floor(hash(col, row, 3 + direction) * 4) * 6 };
  }
  function segments(minX, minY, maxX, maxY) {
    const found = [];
    for (let col = Math.floor(minX / blockX) - 2; col <= Math.ceil(maxX / blockX) + 1; col++) {
      for (let row = Math.floor(minY / blockY) - 1; row <= Math.ceil(maxY / blockY) + 1; row++) {
        for (let direction = 0; direction < 2; direction++) {
          const s = edge(col, row, direction), padding = s.width / 2 + 28;
          if (Math.max(s.x1, s.x2) + padding < minX || Math.min(s.x1, s.x2) - padding > maxX ||
              Math.max(s.y1, s.y2) + padding < minY || Math.min(s.y1, s.y2) - padding > maxY) continue;
          found.push(s);
        }
      }
    }
    return found;
  }
  function closest(x, worldY) {
    let nearest = null;
    const col = Math.floor(x / blockX), row = Math.floor(worldY / blockY);
    // Reuse each of the twenty local junction positions within this query. This
    // keeps sidewalk walkers and plot checks cheap without retaining world data.
    const nodes=[];
    for(let cx=col-2;cx<=col+2;cx++)for(let cy=row-1;cy<=row+2;cy++)nodes.push(node(cx,cy));
    for (let cx = col - 2; cx <= col + 1; cx++) {
      for (let cy = row - 1; cy <= row + 1; cy++) {
        for (let direction = 0; direction < 2; direction++) {
          const index=(cx-col+2)*4+(cy-row+1),a=nodes[index],b=nodes[index+(direction===0?4:1)];
          const vx = b.x - a.x, vy = b.y - a.y;
          const length2 = vx * vx + vy * vy, length = Math.sqrt(length2);
          const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (worldY - a.y) * vy) / length2));
          const px = a.x + t * vx, py = a.y + t * vy, distance = Math.hypot(x - px, worldY - py);
          if (!nearest || distance < nearest.distance) nearest = { segment: edge(cx,cy,direction), t, x: px, y: py, dx: vx / length, dy: vy / length, distance };
        }
      }
    }
    return nearest;
  }
  const intro={id:'highway',x1:320,y1:1000,x2:320,y2:-3200,width:400};
  const tip=closest(320,-3450),join={id:'highway-exit',x1:320,y1:-3200,x2:tip.x,y2:tip.y,width:110};
  function overlaps(s){return Math.max(s.x1,s.x2)>0&&Math.min(s.x1,s.x2)<640&&Math.max(s.y1,s.y2)>-3200&&Math.min(s.y1,s.y2)<1000;}
  function worldSegments(a,b,d,e){
    const list=segments(a,b,d,e).filter(s=>!overlaps(s));
    for(const s of [intro,join])if(Math.max(s.x1,s.x2)+220>=a&&Math.min(s.x1,s.x2)-220<=d&&Math.max(s.y1,s.y2)+220>=b&&Math.min(s.y1,s.y2)-220<=e)list.push(s);
    return list;
  }
  function worldClosest(x,y){
    if(x<-650||x>1290||y<-4000||y>1700)return closest(x,y);
    let nearest=null;
    for(const s of worldSegments(x-800,y-800,x+800,y+800)){
      const vx=s.x2-s.x1,vy=s.y2-s.y1,len=Math.hypot(vx,vy),t=Math.max(0,Math.min(1,((x-s.x1)*vx+(y-s.y1)*vy)/(len*len)));
      const px=s.x1+vx*t,py=s.y1+vy*t,distance=Math.hypot(x-px,y-py);
      if(!nearest||distance<nearest.distance)nearest={segment:s,t,x:px,y:py,dx:vx/len,dy:vy/len,distance};
    }
    return nearest||closest(x,y);
  }
  return {segments:worldSegments,closest:worldClosest};
})();
