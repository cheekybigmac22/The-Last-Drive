/* The opening highway is the only road in this world. */
const RoadNetwork=(()=>{
  const intro={id:'highway',x1:320,y1:1000,x2:320,y2:-3200,width:400};
  function segments(minX,minY,maxX,maxY){
    return maxX>=100&&minX<=540&&maxY>=-3420&&minY<=1220?[intro]:[];
  }
  function closest(x,y){
    const t=Math.max(0,Math.min(1,(1000-y)/4200)),py=1000-t*4200;
    return {segment:intro,t,x:320,y:py,dx:0,dy:-1,distance:Math.hypot(x-320,y-py)};
  }
  return {segments,closest};
})();
