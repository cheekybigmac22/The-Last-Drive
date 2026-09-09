/* Original, code-drawn pixel sprites. The entire scene is rasterized at 320 × 410
   and enlarged without smoothing; scenery and actors share one world camera. */
const PixelArt = (() => {
  const buffer = document.createElement('canvas');
  buffer.width = 320; buffer.height = 410;
  const c = buffer.getContext('2d');
  const ink = '#202640', shadow = '#29334e', cream = '#e2e4cc';
  const palettes = [
    { ground:'#688c7c', speck:'#507467', road:'#385675', curb:'#91b2b5', tree:['#285d50','#40814c','#68af50','#9aca65'], roof:'#8ba9b2' },
    { ground:'#be925f', speck:'#a97b51', road:'#665764', curb:'#cdba8b', tree:['#385b48','#557745','#78a558','#acc079'], roof:'#aa795f' },
    { ground:'#366655', speck:'#294e48', road:'#4a5962', curb:'#92a990', tree:['#183e42','#23634e','#45864e','#76ae63'], roof:'#72857d' },
    { ground:'#53576a', speck:'#414958', road:'#35465f', curb:'#8a919f', tree:['#383f51','#556452','#80876c','#b4a279'], roof:'#71818b' },
    { ground:'#764657', speck:'#5d344f', road:'#494153', curb:'#a48088', tree:['#4b3049','#853d59','#b65265','#db8b78'], roof:'#866678' },
    { ground:'#3b354f', speck:'#292c44', road:'#393c55', curb:'#777588', tree:['#29283f','#494156','#766073','#a28e95'], roof:'#645c77' },
    { ground:'#653349', speck:'#4b2940', road:'#3b304b', curb:'#a66b7e', tree:['#352740','#71364f','#a34b67','#d17a89'], roof:'#945567' }
  ];
  const mod = (v,n) => ((v%n)+n)%n;
  function hash(x,y=0) { let n = Math.imul(x|0,374761393)^Math.imul(y|0,668265263); n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967296; }
  function P(x,y,w,h,color) {
    c.fillStyle=color; c.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,Math.max(2,Math.round(w/2)*2),Math.max(2,Math.round(h/2)*2));
  }
  function line(x1,y1,x2,y2,color,width=2) {
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))/2));
    for(let i=0;i<=steps;i++) P(x1+(x2-x1)*i/steps,y1+(y2-y1)*i/steps,width,width,color);
  }
  function oval(x,y,rx,ry,color) {
    for(let row=-ry;row<=ry;row+=2) {
      const half=Math.sqrt(Math.max(0,1-row*row/(ry*ry)))*rx;
      P(x-half,y+row,half*2,2,color);
    }
  }
  function frame(x,y,w,h,edge,fill) { P(x,y,w,h,edge); P(x+2,y+2,w-4,h-4,fill); }
  function sprite(x,y,rows,colors,scale=2) {
    rows.forEach((row,j)=>[...row].forEach((ch,i)=>{if(colors[ch])P(x+i*scale,y+j*scale,scale,scale,colors[ch]);}));
  }
  const glyphs = {
    A:['010','101','111','101','101'], B:['110','101','110','101','110'], C:['011','100','100','100','011'],
    D:['110','101','101','101','110'], E:['111','100','110','100','111'], F:['111','100','110','100','100'],
    G:['011','100','101','101','011'], H:['101','101','111','101','101'], I:['111','010','010','010','111'],
    L:['100','100','100','100','111'], M:['101','111','111','101','101'], N:['101','111','111','111','101'],
    O:['010','101','101','101','010'], P:['110','101','110','100','100'], R:['110','101','110','101','101'],
    S:['011','100','010','001','110'], T:['111','010','010','010','010'], U:['101','101','101','101','111'],
    X:['101','101','010','101','101'], Y:['101','101','010','010','010'], '0':['111','101','101','101','111'],
    '4':['101','101','111','001','001'], '2':['110','001','010','100','111']
  };
  function label(text,x,y,color=cream,size=2) {
    [...text].forEach((ch,i)=>{const rows=glyphs[ch]; if(rows)sprite(x+i*size*4,y,rows,{'1':color},size);});
  }
  function tree(x,y,p,seed=0,small=false) {
    const r=small?16:30;
    oval(x+8,y+14,r,r*.58,shadow);
    P(x-4,y-6,8,28,'#503b3d'); P(x,y,4,18,'#8a6a4e');
    oval(x,y-10,r,r*.82,p.tree[0]);
    oval(x-3,y-16,r-4,r*.64,p.tree[1]);
    oval(x-9,y-20,r*.54,r*.44,p.tree[2]);
    oval(x+8,y-10,r*.48,r*.4,p.tree[2]);
    for(let j=0;j<9;j++){const dx=(hash(seed,j)-.5)*r*1.4,dy=(hash(seed+1,j)-.5)*r;
      P(x+dx,y-16+dy,4,2,j%3?p.tree[2]:p.tree[3]);}
  }
  function palm(x,y,p) {
    oval(x+12,y+14,35,12,shadow);
    line(x+8,y+20,x,y-24,'#503c3d',8);line(x+6,y+16,x-2,y-24,'#b88a5c',4);
    for(const [dx,dy] of [[-40,-12],[38,-6],[-26,26],[28,22],[-6,-34]]) {
      line(x,y-28,x+dx,y-28+dy,p.tree[0],12);
      line(x-2,y-32,x+dx,y-30+dy,p.tree[2],6);
      line(x,y-30,x+dx*.7,y-30+dy*.65,p.tree[3],2);
    }
    P(x-5,y-26,12,10,'#aa8f59');
  }
  function cactus(x,y) {
    oval(x+8,y+12,18,8,'#9e7655');
    frame(x-6,y-36,14,50,ink,'#568151');P(x-4,y-32,4,42,'#8eac68');
    line(x-6,y-8,x-20,y-8,'#34594b',8);line(x-20,y-8,x-20,y-26,'#34594b',8);
    line(x+6,y-18,x+22,y-18,'#34594b',8);line(x+22,y-18,x+22,y-34,'#34594b',8);
    P(x+20,y-32,4,12,'#8eac68');P(x-20,y-24,4,12,'#779c58');P(x-2,y-38,4,4,'#d2bf73');
  }
  function rock(x,y,p,seed) {
    oval(x+6,y+6,17,12,shadow);oval(x,y,18,13,p.speck);oval(x-4,y-4,13,9,p.curb);
    P(x-10,y-6,8,4,cream);P(x+8,y+2,8,6,p.roof);line(x-2,y-8,x+2,y+4,p.speck,2);
  }
  function roof(x,y,w,h,p,seed) {
    P(x+12,y+18,w,h,shadow);
    frame(x,y+12,w,h,ink,'#455a6c');
    for(let xx=8;xx<w-8;xx+=18){P(x+xx,y+h+6,10,8,'#a2c6bf');P(x+xx,y+h+14,10,2,'#3b3b53');}
    frame(x,y,w,h,ink,p.roof);P(x+4,y+4,w-8,4,'#c7d9cf');P(x+4,y+4,4,h-8,'#b8d0c7');
    P(x+w-8,y+6,4,h-10,'#536c83');P(x+8,y+h-8,w-16,4,'#536c83');
    for(let yy=14;yy<h-10;yy+=14)P(x+8,y+yy,w-18,2,'#75929f');
    frame(x+14,y+16,30,24,'#53647a','#bbcdc7');
    for(let i=0;i<4;i++)P(x+20,y+20+i*4,18,2,'#668394');
    P(x+14,y+40,34,6,'#53647a');
    if(w>82){frame(x+w-34,y+h-38,22,24,'#4c627b','#9eb5b5');oval(x+w-24,y+h-28,6,6,'#4c627b');}
    if(seed%3===0){P(x+w-16,y-10,6,34,ink);P(x+w-14,y-8,2,28,'#eac77c');}
  }
  function cone(x,y) {
    P(x-10,y+6,22,8,ink);P(x-8,y+4,18,8,'#de8150');
    P(x-6,y-6,14,14,'#f4b64f');P(x-4,y-14,10,12,'#e76547');P(x-2,y-20,6,8,cream);
    P(x-4,y-6,10,4,cream);P(x+2,y,4,8,'#ad4144');
  }
  function barrier(x,y) {
    P(x-22,y+8,4,18,ink);P(x+18,y+8,4,18,ink);
    frame(x-26,y-8,54,20,ink,cream);
    for(let j=0;j<4;j++)line(x-23+j*14,y-4,x-13+j*14,y+6,'#ed8847',6);
    P(x-22,y+20,8,4,'#abbabe');P(x+14,y+20,10,4,'#abbabe');
  }
  function lamp(x,y,side=1) {
    oval(x+10,y+12,15,7,shadow);frame(x-8,y,18,16,ink,'#788da3');
    P(x-4,y-78,8,88,ink);P(x-2,y-76,4,82,'#bacbd0');
    const left=side<0?x-112:x;
    P(left,y-80,114,10,ink);P(left+2,y-80,110,4,'#b9bed7');
    frame(x+side*100-18,y-82,38,14,ink,'#91a4c4');P(x+side*100-14,y-82,26,4,'#e1e3d0');
    P(x-8,y-42,18,24,ink);P(x-6,y-40,14,20,'#bf5863');oval(x+1,y-30,5,5,'#e5d787');
  }
  function sign(x,y,text,color='#578d83') {
    P(x-2,y-18,4,32,ink);P(x,y-18,2,32,'#b9c7c5');
    const w=text.length*8+12;frame(x-w/2,y-40,w,22,ink,cream);P(x-w/2+4,y-36,w-8,14,color);
    label(text,x-w/2+6,y-34);
  }
  function car(x,y,tone='#cf4260',kind=0) {
    const truck=kind===1,bus=kind===2,w=truck?54:bus?50:42,h=truck?124:bus?126:82;
    const left=x-w/2,top=y-h/2;
    P(left+8,top+12,w+4,h+4,shadow);
    for(const yy of [top+10,top+h-24]){P(left-4,yy,6,18,ink);P(left+w-2,yy,6,18,ink);}
    frame(left,top,w,h,ink,tone);P(left+2,top+6,4,h-12,'#eab07f');P(left+w-6,top+6,4,h-12,'#913e57');
    if(truck){
      frame(left+2,top+2,w-4,h-38,'#5d6b81','#bdceca');
      for(let yy=8;yy<h-40;yy+=10){P(left+6,top+yy,w-12,2,'#91a9af');P(left+6,top+yy+2,w-12,2,'#e0e3d8');}
      P(left+6,top+h-30,w-12,14,'#32506d');P(left+8,top+h-30,w-16,4,'#9fc5cd');
    } else {
      const windY=top+(bus?20:14);
      frame(left+6,windY,w-12,18,ink,'#426987');P(left+8,windY+2,w-16,4,'#b1d6cf');
      P(left+8,windY+6,4,8,'#759eb4');
      frame(left+7,top+h-24,w-14,12,ink,'#43607f');
      if(bus){for(let yy=44;yy<h-26;yy+=16){P(left+4,top+yy,4,10,'#eac557');P(left+w-8,top+yy,4,10,'#764256');}P(x-4,top+40,8,48,'#e9ba4c');}
      else {P(left+8,top+36,w-16,20,tone);P(left+10,top+38,4,16,'#edc2a3');P(x-2,top+4,4,8,cream);P(x-2,top+34,4,26,cream);}
    }
    P(left+4,top,10,4,'#f4e7ba');P(left+w-14,top,10,4,'#f4e7ba');
    P(left+4,top+h-6,8,4,'#f46652');P(left+w-12,top+h-6,8,4,'#f46652');P(x-6,top+h-4,12,2,cream);
    P(left-6,top+26,6,4,'#b1c5c5');P(left+w,top+26,6,4,'#b1c5c5');
  }
  const rider = [
    '.......kk.......','......kggk......','......kggk......','......kggk......',
    '.....kkwwkk.....','....krwwwwrk....','...krraaarrrk...', '...kraaaaarrk...',
    '...kraaaanrrk...', '....knnnnnnk....', '.....kvvvvk.....', '..kkkvrvvvrkkk..',
    '.kgkkrrvvrrkkgk.', '.kgkkrrrrrrkkgk.', '..kkmrrrrrrmkk..', '....mrrllrrm....',
    '....mrrllrrm....', '....mbbllbbm....', '....mbbllbbm....', '....kbbllbbk....',
    '....kbkkkkbk....', '....kbkrrkbk....', '....kgkrrkgk....', '....kgkrrkgk....',
    '.....kkrrkk.....', '......krrk......', '......kook......', '......kook......',
    '......kggk......', '......kggk......', '.......kk.......'
  ];
  function bike(x,y,lean,burst,time) {
    oval(x+6,y+18,19,30,shadow);
    if(burst>0){
      const length=22+(Math.floor(time*18)%3)*8;
      P(x-6,y+26,12,length,'#d65b65');P(x-4,y+24,8,length-4,'#f3ad53');P(x-2,y+24,4,length-12,'#fff0b5');
      for(let i=0;i<5;i++)P(x-24+i*12,y+24+mod(time*230+i*18,80),2,12,'#a9e4d5');
    }
    sprite(x-16+Math.round(lean*2)*2,y-36,rider,{k:ink,g:'#8198a9',w:cream,r:'#c63769',a:'#ef6582',n:'#303249',v:'#f4898c',m:'#d4b9a6',l:'#e95773',b:'#503750',o:'#fff0ac'});
  }
  function person(x,y,id=0,scale=1) {
    const colors=['#bf5772','#66a09a','#e3b565','#7381a6'];
    oval(x+3,y+12,12,6,shadow);
    P(x-6,y-25,14,14,ink);P(x-4,y-23,10,10,'#d6b995');P(x-6,y-25,14,4,'#46394b');
    P(x-10,y-9,22,20,ink);P(x-8,y-7,18,16,colors[id%4]);P(x-14,y-6,6,16,'#aa827e');P(x+10,y-6,6,16,'#aa827e');
    P(x-8,y+9,6,12,ink);P(x+4,y+9,6,12,ink);P(x-10,y+20,8,4,'#77919d');P(x+4,y+20,8,4,'#77919d');
  }
  function monster(x,y,id,age,scale=1) {
    // Forty combinations of silhouette, anatomy, palette, eyes and jaw. All edges
    // remain on the same pixel grid as the bike; no blurred shapes or gradients.
    const family=id%5, skin=['#c2c7b6','#b995ba','#a7beb5','#d0baa1'][Math.floor(id/5)%4];
    const dark=['#68617e','#64475f','#52746d','#7e6479'][Math.floor(id/5)%4];
    const swing=Math.round(Math.sin(age*5+id)*3)*2;
    oval(x+6,y+19,25,12,shadow);
    if(family===3){ // low, many-jointed crawler
      for(const side of [-1,1])for(let i=0;i<3;i++){
        line(x+side*8,y-14+i*10,x+side*(26+i*6),y-20+i*13+swing,dark,6);
        line(x+side*(26+i*6),y-20+i*13+swing,x+side*(34+i*5),y+2+i*10,skin,4);
      }
    } else {
      for(const side of [-1,1]){
        const reach=family===1?40:family===2?32:24;
        line(x+side*8,y-8,x+side*reach,y+4+side*swing,ink,8);
        line(x+side*8,y-10,x+side*reach,y+2+side*swing,dark,4);
        for(let i=0;i<3;i++)line(x+side*reach,y+4+side*swing,x+side*(reach+i*3),y+14+i*2+side*swing,skin,2);
      }
    }
    frame(x-12,y-20,26,36,ink,dark);P(x-8,y-18,8,22,skin);
    for(let i=0;i<4;i++)P(x-5,y-12+i*6,16,2,'#424456');
    if(family!==3){
      line(x-7,y+12,x-14+swing,y+32,dark,6);line(x+7,y+12,x+14-swing,y+32,skin,6);
      P(x-18+swing,y+30,12,4,ink);P(x+10-swing,y+30,12,4,ink);
    }
    const hy=y-(family===1?50:family===4?26:36),hw=family===4?38:family===2?28:24;
    frame(x-hw/2-2,hy-2,hw+4,26,ink,skin);P(x+hw/2-4,hy+4,4,20,dark);
    if(family===2){for(const side of [-1,1]){line(x+side*9,hy,x+side*24,hy-16,dark,4);line(x+side*24,hy-16,x+side*20,hy-28,skin,2);}}
    if(id%2===0){P(x-hw/2-2,hy-2,hw+4,4,'#383447');P(x-hw/2-4,hy+2,4,28,'#383447');}
    const gap=family===4?10:6;
    for(const side of [-1,1]){P(x+side*gap-4,hy+6,8,8,ink);if(id%4!==0)P(x+side*gap-2,hy+8,2,2,'#e9e1bb');}
    frame(x-(family===4?14:7),hy+16,family===4?28:16,family===4?16:10,ink,'#312338');
    for(let i=0;i<(family===4?7:4);i++){P(x-(family===4?12:5)+i*4,hy+16,2,4,cream);if(id%3===0)P(x-(family===4?12:5)+i*4,hy+23,2,4,cream);}
  }
  function pickup(x,y,t) {
    const bob=Math.round(Math.sin(t*5)*2)*2;
    oval(x+2,y+12,13,6,shadow);
    frame(x-12,y-14+bob,26,30,ink,'#e6ce70');P(x-8,y-10+bob,18,22,'#66c4b0');
    sprite(x-4,y-8+bob,['0011','0110','1111','0010','0100'],{'1':'#fff0bc'},2);
    P(x-5,y-18+bob,12,4,ink);P(x-20,y-2+bob,4,2,'#c9f2cd');P(x+18,y+2+bob,4,2,'#c9f2cd');
  }
  function terrain(g,W,H,p) {
    const cam=g.cameraX,travel=g.scroll,highway=g.biome===0;
    P(cam-4,0,W+8,H,p.ground);
    const cell=64;
    for(let xx=Math.floor((cam-64)/cell)*cell;xx<cam+W+64;xx+=cell){
      const first=Math.floor(-travel/cell);
      for(let j=first;j<first+Math.ceil(H/cell)+2;j++){
        const yy=j*cell+travel,seed=Math.floor(xx/cell);
        for(let n=0;n<4;n++){const dx=hash(seed+n,j)*56,dy=hash(seed,j+n)*56;P(xx+dx,yy+dy,4+n%2*4,2,p.speck);}
      }
    }
    const spacing=960,half=highway?240:154;
    const first=Math.floor((cam-W/2-half)/spacing),last=Math.ceil((cam+W-W/2+half)/spacing);
    for(let road=first;road<=last;road++){
      const center=W/2+road*spacing,left=center-half,right=center+half;
      P(left-26,0,half*2+52,H,ink);P(left-24,0,half*2+48,H,p.curb);
      P(left-10,0,half*2+20,H,'#5e7a8b');P(left,0,half*2,H,p.road);
      P(left+4,0,2,H,'#c6ccaa');P(right-6,0,2,H,'#c6ccaa');
      for(let y=mod(travel,32)-32;y<H;y+=32){P(left-22,y,10,2,'#d0ddd0');P(right+12,y,10,2,'#d0ddd0');}
      const lanes=highway?[-120,120]:[0];
      for(const offset of lanes)for(let y=mod(travel,74)-74;y<H;y+=74)P(center+offset-2,y,4,34,'#a9c1c5');
      if(highway){
        for(let y=mod(travel+120,300)-300;y<H+100;y+=300){
          frame(center-18,y,36,204,ink,p.curb);P(center-14,y+6,28,190,'#739c77');P(center-10,y+10,20,182,'#5fae55');
          for(let yy=12;yy<190;yy+=26){P(center-8,y+yy,6,8,'#8cbd64');P(center+6,y+yy+10,4,6,'#3d8c52');}
        }
      }
      // Repairs, potholes, grates and crosswalks stay attached to the road surface.
      const firstRow=Math.floor(-travel/144);
      for(let j=firstRow;j<firstRow+8;j++){
        const y=j*144+travel,x=center+(hash(j,road)-.5)*half*1.65;
        line(x-14,y,x-6,y+8,'#243b57',4);line(x-6,y+8,x-12,y+18,'#243b57',2);line(x-6,y+8,x+10,y+14,'#243b57',2);
        if(j%3===0){oval(x+18,y+26,12,8,'#28374e');P(x+10,y+22,6,4,'#53778b');}
        frame(left-20,y+40,14,28,'#40566c','#8399a3');for(let k=0;k<4;k++)P(left-18,y+44+k*6,10,2,'#34465d');
      }
      for(let y=mod(travel+420,1000)-1000;y<H;y+=1000){
        for(let x=left+14;x<right-10;x+=18)if(Math.abs(x-center)>24||!highway)P(x,y,10,44,'#bdcfca');
        P(left+10,y-10,half*2-20,4,'#a8c1c0');
      }
    }
  }
  function scenery(g,W,H,p) {
    const list=[],cell=144,travel=g.scroll,cam=g.cameraX;
    const add=(y,draw)=>list.push({y,draw});
    for(let col=Math.floor((cam-180)/cell);col<=Math.ceil((cam+W+180)/cell);col++){
      for(let row=Math.floor((-travel-160)/cell);row<=Math.ceil((H-travel+100)/cell);row++){
        const x=col*cell+hash(col,row)*64,y=row*cell+travel,seed=Math.floor(hash(col+11,row)*1000);
        const roadCenter=W/2+Math.round((x-W/2)/960)*960;
        if(Math.abs(x-roadCenter)<(g.biome===0?282:200))continue;
        if(g.biome===0||g.biome===3){
          if(seed%4!==0)add(y+90,()=>roof(x-50,y-40,104+seed%3*12,100,p,seed));
          else add(y+20,()=>tree(x,y,p,seed));
        }else if(g.biome===1){
          if(seed%7===0)add(y+70,()=>{roof(x-46,y-30,94,72,p,seed);sign(x,y+70,'GAS','#af6257');});
          else if(seed%3)add(y+20,()=>cactus(x,y));else add(y+16,()=>rock(x,y,p,seed));
        }else if(g.biome===2){
          add(y+28,()=>seed%3?tree(x,y,p,seed):palm(x,y,p));
          add(y+64,()=>tree(x+48,y+48,p,seed+1,true));
        }else if(g.biome===4){
          add(y+28,()=>tree(x,y,p,seed));if(seed%2)add(y+64,()=>tree(x-44,y+50,p,seed+2,true));
        }else if(g.biome===5){
          add(y+40,()=>{P(x+8,y-68,20,108,shadow);frame(x-8,y-80,24,114,ink,p.roof);P(x-4,y-76,6,104,p.curb);P(x-14,y-86,38,10,p.curb);});
          if(seed%3===0)add(y+50,()=>rock(x+44,y+42,p,seed));
        }else{
          add(y+30,()=>{tree(x,y,p,seed);frame(x-13,y-38,28,24,ink,p.roof);P(x-8,y-30,8,8,'#edc69c');P(x+5,y-30,8,8,'#edc69c');P(x-6,y-16,16,6,ink);});
          if(seed%4===0)add(y+66,()=>{roof(x-42,y,84,52,p,seed);sign(x,y+58,'MOTEL','#8d445d');});
        }
      }
    }
    for(let road=Math.floor((cam-W/2)/960)-1;road<=Math.ceil((cam+W-W/2)/960)+1;road++){
      const center=W/2+road*960,half=g.biome===0?240:154;
      for(let y=mod(travel+120,300)-300;y<H+150;y+=300){
        if(g.biome===0){add(y+52,()=>tree(center,y+42,p,1,true));add(y+170,()=>lamp(center,y+166,1));}
        else if(g.biome===1)add(y+90,()=>sign(center-half-32,y+80,'GAS','#a57757'));
        else add(y+70,()=>lamp(center-half-26,y+66,1));
      }
      for(let y=mod(travel+60,560)-560;y<H+100;y+=560){
        add(y+10,()=>cone(center+half-32,y));add(y+62,()=>cone(center+half-30,y+52));
        add(y+122,()=>barrier(center+half-32,y+104));
        add(y+140,()=>sign(center-half-26,y+132,g.biome===0?'EXIT':'RTE','#527f83'));
        if(g.biome===0||g.biome===3)add(y+300,()=>car(center-half+38,y+260,'#73979c',1));
      }
    }
    return list;
  }
  function draw(target,g,W,H) {
    const p=palettes[g.biome];
    c.setTransform(.5,0,0,.5,0,0);
    c.imageSmoothingEnabled=false;
    c.save();c.translate(-Math.round(g.cameraX/2)*2,0);
    terrain(g,W,H,p);
    const actors=scenery(g,W,H,p);
    for(const v of g.traffic)actors.push({y:v.y+46,draw:()=>car(v.x,v.y,v.tone,v.model)});
    for(const b of g.pickups)actors.push({y:b.y+15,draw:()=>pickup(b.x,b.y,g.time+b.pulse)});
    for(const m of g.monsters)actors.push({y:m.y+34,draw:()=>m.revealed?monster(m.x,m.y,m.id,m.age,m.scale):person(m.x,m.y,m.id)});
    const wy=H-32-g.mainRush*83,wx=g.x+68*(1-g.mainRush);
    actors.push({y:wy+20,draw:()=>g.mainWoman>.2||g.mainRush>0?monster(wx,wy,2,g.time):person(wx,wy,0)});
    actors.push({y:H-85,draw:()=>bike(g.x,H-115,g.lean,g.burst,g.time)});
    actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());
    for(const part of g.particles)P(part.x,part.y,2,4,part.kind==='boost'?'#edc96f':'#749096');
    c.restore();
    target.setTransform(1,0,0,1,0,0);target.imageSmoothingEnabled=false;
    target.fillStyle=ink;target.fillRect(0,0,W,H);
    const shake=g.shake&&g.running?Math.round(Math.sin(g.time*51)*g.shake*4)*2:0;
    target.drawImage(buffer,shake,0,W,H);
    if(g.red>0){target.fillStyle='#e65e78';target.globalAlpha=Math.min(.2,g.red*.2);target.fillRect(0,0,W,H);target.globalAlpha=1;}
  }
  return {draw};
})();
