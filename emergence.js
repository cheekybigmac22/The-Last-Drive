/* Forty identity-specific, non-gory emergence choreographies. Ten motion
   families have four different directions, staging and secondary movements. */
const Emergence=(()=>{
  const names=['Climb from shell','Unfold from spine','Shadow climbs free','Face opens outward','Crawl from silhouette','Peel off double','Spiral escape','Stretch through crown','Fall from shell','Uncoil from chest'];
  const clamp=v=>Math.max(0,Math.min(1,v));
  function pose(id,t){
    t=clamp(t);const family=id%10,variant=Math.floor(id/10),side=variant%2?-1:1;
    const delay=variant*.035,q=clamp((t-delay)/(1-delay)),ease=q*q*(3-2*q),wave=Math.sin(q*Math.PI),wiggle=Math.sin(q*Math.PI*(2+variant));
    const p={name:names[family]+' '+(variant+1),x:0,y:0,sx:1,sy:1,angle:0,alpha:clamp(q*2),humanSx:1,humanSy:1,humanAngle:0,split:0,particles:family,progress:t};
    switch(family){
      case 0:p.y=(1-ease)*82;p.x=side*wave*(14+variant*5);p.sx=.3+.7*ease;p.sy=.28+.72*ease;p.angle=-side*wave*.28;p.humanSy=1-.5*ease;p.split=wave*12;break;
      case 1:p.sx=.12+.88*ease;p.sy=.5+.5*ease;p.angle=side*(1-ease)*1.2;p.humanAngle=-side*wave*.8;p.split=wave*18;break;
      case 2:p.y=(1-ease)*55;p.sx=1+wave*.4;p.sy=.08+.92*ease;p.humanSy=1-ease*.7;p.x=side*wave*variant*8;break;
      case 3:p.y=-(1-ease)*18;p.sx=.1+.9*ease;p.sy=.25+.75*ease;p.humanSx=1+wave*.6;p.split=wave*24;p.angle=wiggle*.12;break;
      case 4:p.y=(1-ease)*48;p.x=side*(1-ease)*35;p.sy=.12+.88*ease;p.angle=side*wave*.7;p.humanAngle=side*ease*1.2;break;
      case 5:p.x=side*wave*(45+variant*10);p.sx=.65+.35*ease;p.humanAngle=-side*wave*.3;p.split=wave*15;p.alpha=ease;break;
      case 6:p.x=Math.sin(q*Math.PI*4)*wave*side*(20+variant*4);p.y=Math.cos(q*Math.PI*4)*wave*20;p.angle=(1-ease)*side*Math.PI*2;p.sx=.2+.8*ease;p.sy=p.sx;p.humanAngle=wiggle*.2;break;
      case 7:p.y=-(1-ease)*50;p.sx=.18+.82*ease;p.sy=.25+.75*ease;p.humanSy=1+wave*.9;p.humanSx=1-wave*.5;p.angle=side*wiggle*.1;break;
      case 8:p.y=-wave*(65+variant*12);p.angle=side*(1-ease)*Math.PI;p.sx=.5+.5*ease;p.sy=p.sx;p.humanSy=1-ease*.6;break;
      case 9:p.sx=.1+.9*ease;p.sy=.08+.92*ease;p.angle=side*wave*(1+variant*.2);p.x=side*wiggle*wave*20;p.humanSx=1+wave*.4;p.split=wave*20;break;
    }
    // Identity-specific recoil and stagger affect both shell and creature.
    p.x+=side*wave*variant*7;p.y+=wiggle*wave*variant*5;p.humanAngle+=side*wave*variant*.09;
    if(t===1)Object.assign(p,{x:0,y:0,sx:1,sy:1,angle:0,alpha:1,split:0});
    return p;
  }
  return {pose};
})();
