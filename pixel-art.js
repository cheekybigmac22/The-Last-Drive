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
    { ground:'#653349', speck:'#4b2940', road:'#3b304b', curb:'#a66b7e', tree:['#352740','#71364f','#a34b67','#d17a89'], roof:'#945567' },
    {ground:'#79a76a',speck:'#608d57',road:'#6e7261',curb:'#bbbd90',tree:['#365d48','#54834c','#81ad58','#b7ce73'],roof:'#987663'},
    {ground:'#cbdcdf',speck:'#a9c4d0',road:'#758699',curb:'#eef0db',tree:['#345c68','#527884','#82a6af','#d5e8dd'],roof:'#9faec2'},
    {ground:'#d0be82',speck:'#af9e6f',road:'#7d7c72',curb:'#e4d4a0',tree:['#286659','#4a8d63','#7bb174','#bcce82'],roof:'#7d9ca5'}
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
  Object.assign(glyphs,{'1':['010','110','010','010','111'],'3':['110','001','010','001','110'],'5':['111','100','110','001','110'],'6':['011','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','110']});
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
  function person(x,y,id=0,phase=0) {
    const colors=['#bf5772','#66a09a','#e3b565','#7381a6','#cb8056','#a8babb','#758f59','#8b618e'];
    const step=Math.round(Math.sin(phase)*2)*2;
    const skin=['#d6b995','#aa827e','#795e62','#e3c6a8'][Math.floor(id/3)%4];
    oval(x+3,y+12,12,6,shadow);
    if(id===40){P(x-9,y-28,20,36,'#352b3b');P(x-11,y-17,5,26,'#433247');P(x+9,y-17,5,26,'#433247');}
    P(x-6,y-25,14,14,ink);P(x-4,y-23,10,10,skin);P(x-6,y-25,14,4,'#46394b');
    if(id%5===0&&id!==40){P(x-8,y-26,18,6,colors[id%8]);P(x-10,y-22,22,2,cream);}
    P(x-10,y-9,22,20,ink);P(x-8,y-7,18,16,colors[id%8]);
    P(x-14,y-6-step,6,16,skin);P(x+10,y-6+step,6,16,skin);
    if(id%3===0){P(x-6,y-6,12,14,'#43495f');P(x-4,y-4,8,4,'#7e8fa0');}
    P(x-8,y+9,6,12+step,ink);P(x+4,y+9,6,12-step,ink);
    P(x-10,y+20+step,8,4,'#a0b7b8');P(x+4,y+20-step,8,4,'#a0b7b8');
  }
  function pickup(x,y,t) {
    const bob=Math.round(Math.sin(t*5)*2)*2;
    oval(x+2,y+12,13,6,shadow);
    frame(x-12,y-14+bob,26,30,ink,'#e6ce70');P(x-8,y-10+bob,18,22,'#66c4b0');
    sprite(x-4,y-8+bob,['0011','0110','1111','0010','0100'],{'1':'#fff0bc'},2);
    P(x-5,y-18+bob,12,4,ink);P(x-20,y-2+bob,4,2,'#c9f2cd');P(x+18,y+2+bob,4,2,'#c9f2cd');
  }
  function house(x,y,p,seed,biome) {
    const abandoned=biome>=4;
    const walls=abandoned?['#a8898c','#938198','#c19391']:['#e1ceac','#b8d0c2','#c6bdc7','#d8b999'];
    const roofs=abandoned?['#794960','#665573','#946078']:['#aa5554','#567e8b','#997295','#ba8557'];
    const roofColor=biome===1?'#b57b60':roofs[seed%roofs.length];
    const wall=walls[seed%walls.length],door=abandoned?'#463248':'#4b6981';
    // Individual fenced plots, porch paths, planted gardens, and shaded facades.
    P(x-43,y-57,86,105,p.speck);P(x-41,y-55,82,101,p.ground);
    for(const side of [-1,1]){
      P(x+side*42,y-56,2,100,'#b9bbaa');
      for(let yy=-54;yy<44;yy+=10)P(x+side*42-2,y+yy,6,6,cream);
    }
    P(x-42,y-56,86,2,cream);P(x-42,y+44,26,2,cream);P(x+18,y+44,26,2,cream);
    P(x-10,y+24,24,22,p.curb);P(x-6,y+28,16,2,cream);P(x-6,y+36,16,2,cream);
    P(x-29,y-42,74,78,shadow);
    frame(x-34,y-28,70,58,ink,wall);P(x+28,y-26,6,54,p.roof);
    P(x-30,y+22,60,6,abandoned?'#766170':'#9c9b8e');
    for(const wx of [-22,18]){
      frame(x+wx-8,y+1,16,17,ink,abandoned?'#bbae9b':'#78a5b4');
      P(x+wx-6,y+3,10,4,abandoned?'#e5c287':'#c3e0d1');
      P(x+wx,y+3,2,12,wall);P(x+wx-6,y+10,12,2,wall);
      P(x+wx-12,y+2,4,17,roofColor);P(x+wx+8,y+2,4,17,roofColor);
      P(x+wx-10,y+18,22,3,cream);
      if(abandoned&&seed%3===0)line(x+wx-6,y+3,x+wx+5,y+15,'#65505f',4);
    }
    frame(x-7,y+5,16,25,ink,door);P(x-3,y+8,8,8,'#a7c5c0');P(x+3,y+21,2,2,'#eacb77');
    P(x-10,y+29,22,4,p.curb);P(x-12,y+33,26,4,'#657f89');
    P(x-38,y-38,78,34,ink);P(x-34,y-44,70,8,ink);P(x-28,y-50,58,8,ink);
    P(x-36,y-36,74,28,roofColor);P(x-32,y-42,66,8,roofColor);P(x-26,y-48,54,8,roofColor);
    P(x-26,y-48,54,4,abandoned?'#ba8b95':'#ddaa93');
    for(let row=0;row<6;row++){
      const yy=y-42+row*6,half=row===0?30:36;
      P(x-half,yy,half*2,2,abandoned?'#67435a':'#754d61');
      for(let xx=-half+6+(row%2)*6;xx<half-2;xx+=12)P(x+xx,yy+2,2,4,abandoned?'#936b80':'#c58c82');
    }
    P(x-38,y-8,78,4,ink);P(x-36,y-8,72,2,'#d0b7a4');
    frame(x+16,y-56,10,22,ink,'#a4908a');P(x+18,y-54,6,4,'#d9c7b4');P(x+18,y-46,6,2,'#715c65');
    // Flower boxes and tiny clipped hedges keep plots detailed at native pixels.
    for(const side of [-1,1]){
      P(x+side*27-9,y+30,20,9,p.tree[0]);P(x+side*27-7,y+28,16,6,p.tree[2]);
      for(let i=0;i<3;i++)P(x+side*27-5+i*5,y+27+i%2*2,2,3,seed%2?'#e4be72':'#e694a0');
    }
    P(x+28,y+39,2,10,ink);frame(x+23,y+36,12,8,ink,roofColor);P(x+24,y+38,6,2,cream);
    if(biome===2||biome===4){P(x-32,y-3,4,26,p.tree[1]);P(x-30,y+10,8,4,p.tree[2]);P(x-32,y+20,6,4,p.tree[2]);}
  }
  function roadRibbon(s,width,color,travel,H,offset=0) {
    const dx=s.x2-s.x1,dy=s.y2-s.y1,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
    const points=[
      [s.x1+nx*(offset-width/2),s.y1+travel+ny*(offset-width/2)],
      [s.x2+nx*(offset-width/2),s.y2+travel+ny*(offset-width/2)],
      [s.x2+nx*(offset+width/2),s.y2+travel+ny*(offset+width/2)],
      [s.x1+nx*(offset+width/2),s.y1+travel+ny*(offset+width/2)]
    ];
    const top=Math.max(-2,Math.floor(Math.min(...points.map(a=>a[1]))/2)*2);
    const bottom=Math.min(H+2,Math.ceil(Math.max(...points.map(a=>a[1]))/2)*2);
    for(let y=top;y<bottom;y+=2){
      const hits=[];
      for(let i=0;i<4;i++){
        const a=points[i],b=points[(i+1)%4],sample=y+1;
        if((a[1]<=sample&&b[1]>sample)||(b[1]<=sample&&a[1]>sample))hits.push(a[0]+(sample-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      if(hits.length>1)P(Math.min(...hits),y,Math.max(...hits)-Math.min(...hits),2,color);
    }
  }
  function terrain(g,W,H,p) {
    const cam=g.cameraX,travel=g.scroll;
    P(cam-4,0,W+8,H,p.ground);
    const cell=64;
    for(let xx=Math.floor((cam-64)/cell)*cell;xx<cam+W+64;xx+=cell){
      const first=Math.floor(-travel/cell);
      for(let j=first;j<first+Math.ceil(H/cell)+2;j++){
        const yy=j*cell+travel,seed=Math.floor(xx/cell),p=palettes[World.biome(xx+32,j*cell+32)];
        P(xx,yy,cell,cell,p.ground);
        for(let n=0;n<4;n++){const dx=hash(seed+n,j)*56,dy=hash(seed,j+n)*56;P(xx+dx,yy+dy,4+n%2*4,2,p.speck);}
      }
    }
    const streets=RoadNetwork.segments(cam-120,-travel-120,cam+W+120,H-travel+120);
    // Lay all sidewalks, then all road surfaces, so connected junctions are open.
    for(const [extra,color] of [[40,ink],[36,p.curb],[8,'#69838f'],[0,p.road]])for(const s of streets){
      const sp=palettes[World.biome((s.x1+s.x2)/2,(s.y1+s.y2)/2)];
      const shade=extra===40?ink:extra===36?sp.curb:extra===8?'#69838f':sp.road;
      roadRibbon(s,s.width+extra,shade,travel,H);
      for(const [x,y] of [[s.x1,s.y1],[s.x2,s.y2]])if(y+travel>-100&&y+travel<H+100)oval(x,y+travel,(s.width+extra)/2,(s.width+extra)/2,shade);
    }
    for(const s of streets){
      const dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
      // Short lane dashes and angled crossing bars follow each individual street.
      for(let d=90;d<len-85;d+=56){
        const x=s.x1+ux*d,y=s.y1+travel+uy*d;
        if(y<-60||y>H+60)continue;
        line(x,y,x+ux*25,y+uy*25,'#b9ceca',3);
        if(s.id==='highway')for(const offset of [-125,125])line(x+offset,y,x+offset+ux*25,y+uy*25,'#b9ceca',3);
      }
      for(const end of (s.id==='highway'?[]:[76,len-76]))for(let lane=-s.width/2+10;lane<s.width/2-8;lane+=13){
        const x=s.x1+ux*end+nx*lane,y=s.y1+travel+uy*end+ny*lane;
        if(y>-40&&y<H+40)line(x,y,x+ux*16,y+uy*16,'#c8d8cf',6);
      }
      const seed=Math.floor(hash(s.x1,s.y1)*10000);
      for(let d=134;d<len-110;d+=142){
        const offset=(hash(seed,d)-.5)*s.width*.6,x=s.x1+ux*d+nx*offset,y=s.y1+travel+uy*d+ny*offset;
        if(y<-30||y>H+30)continue;
        line(x-9,y-7,x-3,y+1,'#293b55',2);line(x-3,y+1,x+8,y+3,'#293b55',2);
        if(seed%3===0){oval(x+11,y+10,9,6,'#29384f');P(x+6,y+6,6,2,'#6c8792');}
        for(const side of [-1,1]){
          const gx=s.x1+ux*d+nx*side*(s.width/2+11),gy=s.y1+travel+uy*d+ny*side*(s.width/2+11);
          P(gx-5,gy-7,10,14,'#4a6274');for(let k=0;k<3;k++)P(gx-3,gy-5+k*4,6,2,'#a6b8b4');
        }
      }
    }
  }
  function landmark(o,y,p){
    const x=o.x,seed=o.seed;
    if(['house','barn','cabin'].includes(o.kind)){
      house(x,y,p,seed,o.biome);
      if(o.kind==='barn'){P(x-12,y+8,26,22,'#a45349');line(x-10,y+10,x+12,y+28,cream,2);line(x+12,y+10,x-10,y+28,cream,2);}
      if(o.kind==='cabin')for(let j=0;j<5;j++)P(x-32,y-42+j*6,66,4,'#e4efdf');
    }else if(o.kind==='tree')tree(x,y,p,seed);
    else if(o.kind==='palm')palm(x,y,p);
    else if(o.kind==='cactus')cactus(x,y);
    else if(o.kind==='rock')rock(x,y,p,seed);
    else if(o.kind==='pyramid'||o.kind==='temple'){
      const desert=o.kind==='pyramid';
      oval(x+8,y+26,56,25,shadow);
      for(let j=0;j<12;j++){const w=108-j*8;P(x-w/2,y+36-j*8,w,8,desert?(j%2?'#bc8550':'#d7a55e'):(j%2?'#6e8580':'#96a393'));P(x,y+36-j*8,w/2,8,desert?'#aa7149':'#546b68');}
      frame(x-10,y+6,20,30,ink,'#352b39');P(x-7,y+10,8,24,'#564150');
      for(let j=0;j<6;j++)P(x-20,y+38+j*2,40,2,j%2?p.curb:p.speck);
    }else if(o.kind==='dune'){
      for(let j=0;j<14;j++){const w=84-Math.abs(j-7)*6;P(x-w/2,y-20+j*4,w,4,j<7?'#e3b875':'#c3975d');}
      line(x-28,y-3,x+4,y-18,'#f3d193',4);line(x+4,y-18,x+32,y,'#ab8053',2);
    }else if(o.kind==='pond'||o.kind==='fountain'){
      oval(x,y,44,27,p.curb);oval(x,y,38,22,'#40758a');oval(x-5,y-5,29,14,'#599eaa');
      for(let j=0;j<4;j++)P(x-24+j*13,y-6+(j%2)*12,12,2,'#a6d2ce');
      if(o.kind==='fountain'){frame(x-5,y-30,12,32,ink,p.curb);oval(x,y-28,20,8,cream);line(x,y-36,x-15,y-13,'#a6d2ce',3);}
    }else if(o.kind==='pine'){
      P(x-4,y,8,25,'#65505b');
      for(let k=0;k<4;k++)for(let j=0;j<9;j++)P(x-j*3,y-60+k*15+j*3,j*6+2,3,j<3?'#e0ede3':p.tree[1+k%2]);
    }else if(o.kind==='ice'||o.kind==='crystal'){
      const color=o.kind==='ice'?'#8ec9d9':'#c58bab';oval(x+5,y+15,30,16,shadow);
      for(let j=0;j<13;j++){const w=j<5?j*6:30;P(x-w/2,y-42+j*5,w,5,color);P(x,y-42+j*5,w/2,5,o.kind==='ice'?'#5e9fb8':'#805c89');}
      line(x-4,y-31,x-4,y+9,cream,3);
    }else if(o.kind==='lighthouse'){
      oval(x+12,y+20,34,18,shadow);frame(x-24,y-72,48,104,ink,cream);
      P(x+14,y-68,8,96,'#9c9dad');for(let j=0;j<3;j++)P(x-22,y-50+j*30,44,12,'#ba5261');
      frame(x-28,y-90,56,20,ink,'#6ea6b3');P(x-18,y-87,14,14,'#f3da86');P(x-32,y-72,64,4,ink);P(x-30,y-94,60,6,'#ab4d5b');
    }else if(o.kind==='boat'){
      for(let j=0;j<10;j++){const w=70-Math.abs(j-5)*6;P(x-w/2,y-18+j*4,w,4,j%3?'#9b624c':'#d4b68b');}
      frame(x-24,y-10,48,18,ink,'#4b7f89');line(x-22,y-22,x+23,y+20,cream,4);
    }else if(o.kind==='hay'){
      frame(x-24,y-20,48,40,'#8f794a','#d6b755');for(let j=0;j<7;j++)P(x-20+j*6,y-18,2,34,'#f0d378');P(x-14,y-20,4,40,'#8f794a');P(x+12,y-20,4,40,'#8f794a');
    }else{
      frame(x-25,y-35,50,67,ink,p.roof);P(x-14,y-43,14,55,p.curb);P(x+12,y-18,12,40,p.speck);line(x-4,y-30,x+6,y+8,ink,4);
    }
    // Permanent, coordinate-derived landmark plates help identify a repeated place.
    if(o.landmark||seed%5===0){frame(x-21,y+o.ry+4,44,14,ink,p.curb);label(String(seed%1000).padStart(3,'0'),x-16,y+o.ry+6,ink);}
  }
  function scenery(g,W,H){
    return World.props(g.cameraX-100,-g.scroll-150,g.cameraX+W+100,H-g.scroll+100)
      .map(o=>({y:o.y+g.scroll+o.ry,draw:()=>landmark(o,o.y+g.scroll,palettes[o.biome])}));
  }
  function draw(target,g,W,H) {
    const p=palettes[g.biome];
    c.setTransform(.5,0,0,.5,0,0);
    c.imageSmoothingEnabled=false;
    c.save();c.translate(-g.cameraX,0);
    terrain(g,W,H,p);
    const actors=scenery(g,W,H,p);
    for(const v of g.traffic)actors.push({y:v.y+46,draw:()=>{c.save();c.translate(Math.round(v.x/2)*2,Math.round(v.y/2)*2);c.rotate(v.angle||0);car(0,0,v.tone,v.model);c.restore();}});
    for(const b of g.pickups)actors.push({y:b.y+15,draw:()=>pickup(b.x,b.y,g.time+b.pulse)});
    for(const p of g.pedestrians)actors.push({y:p.y+24,draw:()=>person(p.x,p.y,p.id,p.phase)});
    for(const m of g.monsters){
      if(!m.revealed||m.revealProgress<1)actors.push({y:m.y+24,draw:()=>{
        const t=m.revealed?m.revealProgress:0;
        const emergence=Emergence.pose(m.id,t);
        c.save();c.globalAlpha=1-t*.9;c.translate(m.x,m.y);c.rotate(emergence.humanAngle);c.scale(emergence.humanSx,emergence.humanSy);
        if(emergence.split>0){
          for(const side of [-1,1]){c.save();c.beginPath();c.rect(side<0?-60:0,-100,60,200);c.clip();person(side*emergence.split,0,m.id,Math.sin(m.age*12)*t);c.restore();}
        }else person(0,0,m.id,m.revealed?Math.sin(m.age*16)*t:m.age*5);
        if(t>.3){P(-4,-20,3,3,cream);P(3,-20,3,3,cream);}c.restore();
      }});
      if(m.revealed)actors.push({y:m.y+50,draw:()=>{
        const safe=m.revealProgress<1||m.revealGrace>0,color=safe?'#f3cb6e':'#ed786a';
        for(let i=0;i<40;i++){const a=i/40*Math.PI*2;P(m.x+Math.cos(a)*44,m.y+Math.sin(a)*25+8,3,3,color);}
        if(safe){frame(m.x-30,m.y+40,60,8,ink,'#594452');P(m.x-28,m.y+42,56*m.revealProgress,4,color);label('RUN',m.x-12,m.y-48,color);}
      }});
    }
    const wy=g.woman.y,wx=g.woman.x;
    const womanAlpha=g.mainWoman;
    if(womanAlpha<1)actors.push({y:wy+20,draw:()=>{c.save();c.globalAlpha=1-womanAlpha;c.translate(wx,wy);c.scale(1,1+womanAlpha*.4);person(0,0,40,g.woman.phase);c.restore();}});
    actors.push({y:H/2+24,draw:()=>{c.save();c.translate(g.x,H/2);c.rotate(g.heading);bike(0,0,0,g.moving?g.burst:0,g.time);c.restore();}});
    actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());
    for(const part of g.particles)P(part.x,part.y,2,4,part.kind==='boost'?'#edc96f':'#749096');
    c.restore();
    // Darkness is drawn on the pixel grid. The motorcycle headlight points in
    // the riding direction, while warning rings remain locally readable.
    c.save();
    const fx=Math.sin(g.heading),fy=-Math.cos(g.heading);
    const glows=[...g.monsters.filter(m=>m.revealed&&(m.revealProgress<1||m.revealGrace>0)),...g.pickups];
    for(let y=0;y<H;y+=12)for(let x=0;x<W;x+=12){
      const dx=x+6-W/2,dy=y+6-H/2,d=Math.hypot(dx,dy),along=dx*fx+dy*fy,across=Math.abs(dx*fy-dy*fx);
      let light=Math.max(0,1-d/125)*.28;
      if(along>0&&along<360&&across<28+along*.32)light=Math.max(light,.49*(1-along/480)*(1-across/(36+along*.42)));
      for(const m of glows){const distance=Math.hypot(x+6-(m.x-g.cameraX),y+6-m.y);light=Math.max(light,Math.max(0,1-distance/90)*.35);}
      P(x,y,12,12,'rgba(5,9,27,'+Math.max(.15,.66-light)+')');
    }
    c.restore();
    target.setTransform(1,0,0,1,0,0);target.imageSmoothingEnabled=false;
    target.fillStyle=ink;target.fillRect(0,0,W,H);
    const shake=g.shake&&g.running?Math.round(Math.sin(g.time*51)*g.shake*4)*2:0;
    target.drawImage(buffer,shake,0,W,H);
    if(g.red>0){target.fillStyle='#e65e78';target.globalAlpha=Math.min(.2,g.red*.2);target.fillRect(0,0,W,H);target.globalAlpha=1;}
  }
  return {draw};
})();
