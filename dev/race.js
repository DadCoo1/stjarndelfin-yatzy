/* ================= Sommarvägen – eget arkadracingspel =================
   En roadtrip genom Sverige i en öppen sportbil: Västkusten, midsommar, höstskog, fjäll och storstan.
   Pseudo-3D-väg (segment som projiceras), egen grafik ritad i kod och egen musik på bilradion. */
const RACE=(function(){
  /* ---------- konstanter ---------- */
  const SEG=200, ROADW=2000, CAMH=1000, DEPTH=1/Math.tan(50*Math.PI/180), DRAW=230, RUMB=3, LANES=3;
  const PZ=CAMH*DEPTH, MAXS=SEG*60, ACC=MAXS/5.2, BRK=-MAXS*1.1, DEC=-MAXS/6, OFFDEC=-MAXS/1.8, OFFLIM=MAXS/4, CENT=.3, PW=.3;
  const STAGE=2050, INTRO=40, OUTRO=420, KMH=292;
  const DIFF={latt:{t:82,cp:64,cars:20,lab:'Lätt'}, normal:{t:70,cp:56,cars:36,lab:'Normal'}, svar:{t:60,cp:49,cars:58,lab:'Svår'}};
  const CARCOL=[['Havsblå','#0ea5e9','#075985'],['Körsbär','#e11d48','#881337'],['Citron','#facc15','#a16207'],['Mint','#34d399','#047857'],['Pärlvit','#f1f5f9','#94a3b8'],['Natt','#334155','#0f172a'],['Lila','#a855f7','#6b21a8']];
  const HAIR=[['Blont','#f4d27a'],['Brunt','#7c4a22'],['Svart','#1f1a17'],['Rött','#c2410c'],['Rosa','#f472b6'],['Blått','#60a5fa']];
  const PAS=[['Ingen','none'],['Kompis','kid'],['Hund','dog']];
  let cfg={diff:'normal', radio:0, color:0, dh:1, ph:0, pas:'dog', auto:true};
  try{ cfg={...cfg, ...JSON.parse(lsGet('race_cfg')||'{}')}; }catch(e){}
  if(!DIFF[cfg.diff]) cfg.diff='normal';
  const saveCfg=()=>lsSet('race_cfg',JSON.stringify(cfg));
  const stats=()=>{ try{ return {best:0,games:0,fin:0,hs:[], ...JSON.parse(lsGet('race_stats')||'{}')}; }catch(e){ return {best:0,games:0,fin:0,hs:[]}; } };
  const saveStats=s=>lsSet('race_stats',JSON.stringify(s));

  /* ---------- hjälpare ---------- */
  const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,p)=>a+(b-a)*p;
  const easeIn=(a,b,p)=>a+(b-a)*p*p, easeIO=(a,b,p)=>a+(b-a)*((-Math.cos(p*Math.PI)/2)+.5);
  function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const mix=(a,b,p)=>[a[0]+(b[0]-a[0])*p, a[1]+(b[1]-a[1])*p, a[2]+(b[2]-a[2])*p];
  const rgb=c=>`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
  const hex2=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  function mk(w,h,fn){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); fn(g,w,h); return c; }

  /* ---------- världarna ---------- */
  const T=[
    {name:'Västkusten', sub:'Klippor, hav och salta vindar', sky:['#1e6fd9','#7cc4ff','#dff3ff'], sun:{x:.74,y:.2,r:.05,c:'#fffbe6',g:'rgba(255,244,200,.5)'}, fog:[214,236,250],
      grass:[[196,184,140],[184,171,128]], road:[[118,122,130],[112,116,124]], rumble:[[236,236,236],[205,50,50]], lane:[245,245,245], far:'sea', near:'skerry'},
    {name:'Midsommarvägen', sub:'Blommande ängar och röda stugor', sky:['#2563eb','#93c5fd','#fff7d6'], sun:{x:.25,y:.16,r:.05,c:'#fffbe6',g:'rgba(255,240,190,.5)'}, fog:[220,236,214],
      grass:[[104,176,64],[92,162,56]], road:[[116,118,124],[110,112,118]], rumble:[[240,240,240],[205,50,50]], lane:[245,245,245], far:'hills', near:'forest'},
    {name:'Höstskogen', sub:'Guld, koppar och skymning', sky:['#5b21b6','#f472b6','#fdba74'], sun:{x:.6,y:.36,r:.08,c:'#fff1c2',g:'rgba(253,186,116,.65)'}, fog:[240,170,140],
      grass:[[164,112,46],[150,101,40]], road:[[96,92,98],[90,86,92]], rumble:[[240,240,240],[40,40,48]], lane:[250,236,200], far:'autumn', near:'autumnNear'},
    {name:'Fjällvägen', sub:'Snö, renar och kalla vindar', sky:['#1e3a8a','#60a5fa','#e0f2fe'], sun:{x:.3,y:.14,r:.045,c:'#ffffff',g:'rgba(255,255,255,.45)'}, fog:[226,238,250],
      grass:[[238,244,252],[224,233,246]], road:[[104,110,122],[98,104,116]], rumble:[[245,245,245],[234,88,12]], lane:[245,245,245], far:'mountains', near:'snowforest'},
    {name:'Storstan', sub:'Neon, gatlyktor och målgång', sky:['#070420','#2e1065','#be185d'], moon:{x:.78,y:.14,r:.035}, fog:[70,30,90],
      grass:[[40,36,56],[34,30,48]], road:[[54,54,66],[50,50,62]], rumble:[[250,204,21],[42,42,52]], lane:[250,214,90], far:'skyline', near:'city'}
  ];
  const BLEND=70;

  /* ---------- sprites (allt ritat i kod) ---------- */
  const SP={};
  function sprite(name,w,h,ww,col,fn){ const big=!/^(car|van|truck|g[A-Z])/.test(name); SP[name]={c:mk(w,h,fn), ww:ww*(big?1.55:1), col}; }
  function shade(g,x,y,w,h,c1,c2){ const gr=g.createLinearGradient(x,0,x+w,0); gr.addColorStop(0,c1); gr.addColorStop(1,c2); return gr; }
  function buildSprites(){
    // Västkusten
    sprite('rock',240,150,950,true,(g,w,h)=>{ const gr=g.createRadialGradient(w*.38,h*.35,10,w*.5,h*.6,w*.6); gr.addColorStop(0,'#e4d4cb'); gr.addColorStop(.55,'#a8958c'); gr.addColorStop(1,'#5f514c');
      g.fillStyle=gr; g.beginPath(); g.moveTo(4,h); g.quadraticCurveTo(10,h*.35,w*.35,h*.18); g.quadraticCurveTo(w*.62,0,w*.8,h*.28); g.quadraticCurveTo(w,h*.5,w-4,h); g.fill();
      g.strokeStyle='rgba(60,45,40,.35)'; g.lineWidth=3; g.beginPath(); g.moveTo(w*.3,h*.4); g.quadraticCurveTo(w*.45,h*.6,w*.4,h); g.moveTo(w*.66,h*.35); g.lineTo(w*.72,h*.8); g.stroke();
      g.fillStyle='rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(w*.4,h*.3,w*.16,h*.06,-.3,0,7); g.fill(); });
    sprite('rock2',340,130,1450,true,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#d6c3b8'); gr.addColorStop(1,'#6b5b55');
      g.fillStyle=gr; g.beginPath(); g.moveTo(0,h); g.quadraticCurveTo(w*.1,h*.3,w*.4,h*.2); g.quadraticCurveTo(w*.7,h*.05,w*.9,h*.4); g.quadraticCurveTo(w,h*.7,w,h); g.fill();
      g.fillStyle='#e8d02a55'; for(let i=0;i<9;i++){ g.beginPath(); g.ellipse(w*(.2+i*.07),h*(.4+Math.sin(i)*.15),12,6,0,0,7); g.fill(); } });
    sprite('lighthouse',140,440,760,true,(g,w,h)=>{ g.fillStyle='#6b5b55'; g.beginPath(); g.ellipse(w/2,h-10,w*.48,16,0,0,7); g.fill();
      g.fillStyle=shade(g,30,0,80,0,'#ffffff','#c9d3dd'); g.beginPath(); g.moveTo(32,h-14); g.lineTo(46,110); g.lineTo(94,110); g.lineTo(108,h-14); g.fill();
      g.fillStyle=shade(g,30,0,80,0,'#ef4444','#991b1b'); [[h-140,h-90],[h-270,h-220]].forEach(([a,b])=>{ const k=y=>32+14*(h-14-y)/(h-124); g.beginPath(); g.moveTo(k(a),a); g.lineTo(w-k(a),a); g.lineTo(w-k(b),b); g.lineTo(k(b),b); g.fill(); });
      g.fillStyle='#1f2937'; g.fillRect(38,100,64,12); g.fillStyle='#fde68a'; g.fillRect(48,64,44,36); g.fillStyle='#1f2937'; g.fillRect(48,64,4,36); g.fillRect(88,64,4,36); g.fillRect(68,64,4,36);
      g.fillStyle='#b91c1c'; g.beginPath(); g.moveTo(42,66); g.lineTo(70,30); g.lineTo(98,66); g.fill(); g.fillStyle='#111'; g.fillRect(68,18,4,14);
      g.fillStyle='#1f2937'; g.fillRect(64,h-60,12,26); });
    sprite('hut',170,210,640,true,(g,w,h)=>{ const cols=['#38bdf8','#ffffff']; for(let i=0;i<8;i++){ g.fillStyle=cols[i%2]; g.fillRect(14+i*17.75,70,17.75,h-70); }
      g.fillStyle='rgba(0,0,0,.12)'; g.fillRect(14,70,142,h-70); g.fillStyle='rgba(255,255,255,.0)';
      g.fillStyle='#334155'; g.beginPath(); g.moveTo(4,76); g.lineTo(w/2,14); g.lineTo(w-4,76); g.fill(); g.fillStyle='#fef3c7'; g.fillRect(64,110,42,h-110); g.fillStyle='#78350f'; g.fillRect(64,110,42,6); });
    sprite('grass',130,80,420,false,(g,w,h)=>{ for(let i=0;i<34;i++){ const x=10+Math.random()*(w-20), c=['#a3a35b','#c8b874','#7d8b45','#d6c88e'][i%4]; g.strokeStyle=c; g.lineWidth=3; g.beginPath(); g.moveTo(x,h); g.quadraticCurveTo(x+(Math.random()-.5)*30,h*.5,x+(Math.random()-.5)*40,Math.random()*h*.4); g.stroke(); } });
    sprite('boat',200,230,1300,false,(g,w,h)=>{ g.fillStyle='#fff'; g.beginPath(); g.moveTo(98,10); g.lineTo(98,190); g.lineTo(20,190); g.fill(); g.fillStyle='#e2e8f0'; g.beginPath(); g.moveTo(104,30); g.lineTo(104,190); g.lineTo(170,190); g.fill();
      g.fillStyle='#1e3a8a'; g.beginPath(); g.moveTo(10,196); g.lineTo(190,196); g.lineTo(166,224); g.lineTo(30,224); g.fill(); g.fillStyle='#475569'; g.fillRect(98,6,5,190); });
    // Midsommar
    sprite('stuga',340,270,1900,true,(g,w,h)=>{ g.fillStyle=shade(g,20,0,300,0,'#b42318','#7f1d1d'); g.fillRect(24,96,292,h-96);
      g.fillStyle='rgba(0,0,0,.12)'; for(let x=30;x<316;x+=12) g.fillRect(x,96,2,h-96);
      g.fillStyle='#f8fafc'; g.fillRect(20,94,12,h-94); g.fillRect(308,94,12,h-94);
      g.fillStyle='#1f2937'; g.beginPath(); g.moveTo(6,104); g.lineTo(70,24); g.lineTo(270,24); g.lineTo(334,104); g.fill(); g.fillStyle='#0f172a'; g.fillRect(232,4,24,40);
      for(const x of [60,236]){ g.fillStyle='#f8fafc'; g.fillRect(x-4,134,52,58); g.fillStyle='#fde68a'; g.fillRect(x,138,44,50); g.fillStyle='#f8fafc'; g.fillRect(x+20,138,4,50); g.fillRect(x,161,44,4); }
      g.fillStyle='#f8fafc'; g.fillRect(146,150,52,h-150); g.fillStyle='#14532d'; g.fillRect(152,156,40,h-156); });
    sprite('stang',180,440,760,true,(g,w,h)=>{ const leaf=(x,y,r)=>{ g.fillStyle=['#166534','#15803d','#22c55e'][Math.floor(Math.random()*3)]; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); };
      for(let y=40;y<h-6;y+=7){ leaf(w/2-4+Math.random()*8,y,9); }
      for(let x=12;x<w-12;x+=7) leaf(x,92+Math.random()*4,8);
      for(const cx of [30,150]){ g.strokeStyle='#15803d'; g.lineWidth=12; g.beginPath(); g.ellipse(cx,140,24,34,0,0,7); g.stroke(); for(let a=0;a<6.3;a+=.7){ g.fillStyle=['#facc15','#f472b6','#fff','#a855f7'][Math.floor(a*3)%4]; g.beginPath(); g.arc(cx+Math.cos(a)*24,140+Math.sin(a)*34,4,0,7); g.fill(); } }
      for(let i=0;i<40;i++){ g.fillStyle=['#facc15','#f472b6','#fff','#60a5fa'][i%4]; g.beginPath(); g.arc(w/2-6+Math.random()*12,30+Math.random()*(h-60),3.5,0,7); g.fill(); }
      g.fillStyle='#fef08a'; g.beginPath(); g.arc(w/2,30,10,0,7); g.fill(); });
    const birch=(fol)=>(g,w,h)=>{ g.fillStyle='#f5f5f4'; g.beginPath(); g.moveTo(w/2-9,h); g.lineTo(w/2-5,90); g.lineTo(w/2+5,90); g.lineTo(w/2+9,h); g.fill();
      g.fillStyle='#1c1917'; for(let y=110;y<h;y+=18+Math.random()*16){ g.fillRect(w/2-8+Math.random()*6,y,6+Math.random()*6,3); }
      for(let i=0;i<70;i++){ const a=Math.random()*6.28, r=Math.random(); g.fillStyle=fol[i%fol.length]; g.beginPath(); g.ellipse(w/2+Math.cos(a)*r*w*.42, 140+Math.sin(a)*r*120-30*(1-r), 16, 12, a, 0, 7); g.fill(); } };
    sprite('birch',190,420,950,true,birch(['#4d7c0f','#65a30d','#84cc16','#a3e635','#3f6212']));
    sprite('birchA',190,420,950,true,birch(['#ea580c','#f59e0b','#facc15','#c2410c','#fbbf24']));
    sprite('hay',170,120,620,true,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#ffffff'); gr.addColorStop(1,'#cbd5e1'); g.fillStyle=gr; g.beginPath(); g.roundRect(6,10,w-12,h-12,30); g.fill();
      g.strokeStyle='rgba(100,116,139,.35)'; g.lineWidth=2; for(let x=30;x<w-20;x+=22){ g.beginPath(); g.moveTo(x,14); g.lineTo(x,h-4); g.stroke(); } });
    sprite('flowers',170,50,520,false,(g,w,h)=>{ for(let i=0;i<60;i++){ g.fillStyle=['#facc15','#f472b6','#fff','#a855f7','#60a5fa'][i%5]; g.beginPath(); g.arc(Math.random()*w,h*.2+Math.random()*h*.8,3.5+Math.random()*2,0,7); g.fill(); } });
    sprite('flag',230,400,700,true,(g,w,h)=>{ g.fillStyle='#e5e7eb'; g.fillRect(14,10,8,h-10); g.fillStyle='#facc15'; g.beginPath(); g.arc(18,10,8,0,7); g.fill();
      g.save(); g.beginPath(); for(let x=0;x<=200;x+=4){ const y=24+Math.sin(x/32)*8; x?g.lineTo(22+x,y):g.moveTo(22,y); } for(let x=200;x>=0;x-=4){ g.lineTo(22+x,144+Math.sin(x/32)*8); } g.closePath(); g.clip();
      g.fillStyle='#1d4ed8'; g.fillRect(22,10,210,150); g.fillStyle='#facc15'; g.fillRect(22,70,210,26); g.fillRect(80,10,26,150); g.restore(); });
    sprite('field',420,60,2400,false,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#fde047'); gr.addColorStop(1,'#ca8a04'); g.fillStyle=gr; g.beginPath(); g.moveTo(0,h); g.quadraticCurveTo(w/2,-h*.6,w,h); g.fill(); });
    // Höst
    const pine=(c1,c2,snow)=>(g,w,h)=>{ g.fillStyle='#57361c'; g.fillRect(w/2-8,h-60,16,60);
      for(let i=0;i<6;i++){ const y=30+i*58, hw=24+i*14; g.fillStyle=i%2?c1:c2; g.beginPath(); g.moveTo(w/2,y-30); g.lineTo(w/2+hw,y+44); g.lineTo(w/2-hw,y+44); g.fill();
        if(snow){ g.fillStyle='#f8fafc'; g.beginPath(); g.moveTo(w/2,y-30); g.lineTo(w/2+hw*.7,y+22); g.quadraticCurveTo(w/2,y+8,w/2-hw*.7,y+22); g.fill(); } } };
    sprite('pine',210,420,980,true,pine('#14532d','#166534'));
    sprite('pineS',210,420,980,true,pine('#14532d','#1e5a3a',true));
    sprite('moose',160,210,520,true,(g,w,h)=>{ g.fillStyle='#78716c'; g.fillRect(w/2-5,110,10,h-110);
      g.fillStyle='#dc2626'; g.beginPath(); g.moveTo(w/2,6); g.lineTo(w-6,124); g.lineTo(6,124); g.fill(); g.fillStyle='#fde047'; g.beginPath(); g.moveTo(w/2,26); g.lineTo(w-24,112); g.lineTo(24,112); g.fill();
      g.fillStyle='#111'; g.beginPath(); g.ellipse(w/2+4,86,24,11,0,0,7); g.fill(); g.fillRect(w/2-14,90,4,16); g.fillRect(w/2+16,90,4,16); g.fillRect(w/2-20,72,10,14); g.beginPath(); g.ellipse(w/2-24,70,8,6,.4,0,7); g.fill();
      g.fillRect(w/2-28,56,3,10); g.fillRect(w/2-20,56,3,10); });
    sprite('barn',320,230,1800,true,(g,w,h)=>{ g.fillStyle=shade(g,20,0,280,0,'#8b8378','#57534e'); g.fillRect(20,80,280,h-80); g.fillStyle='rgba(0,0,0,.18)'; for(let x=26;x<300;x+=14) g.fillRect(x,80,3,h-80);
      g.fillStyle='#44403c'; g.beginPath(); g.moveTo(4,88); g.lineTo(w/2,14); g.lineTo(w-4,88); g.fill(); g.fillStyle='#292524'; g.fillRect(126,130,68,h-130); g.strokeStyle='#a8a29e'; g.lineWidth=4; g.beginPath(); g.moveTo(126,130); g.lineTo(194,h); g.moveTo(194,130); g.lineTo(126,h); g.stroke(); });
    sprite('mush',90,80,260,false,(g,w,h)=>{ g.fillStyle='#fef3c7'; g.fillRect(w/2-9,36,18,h-36); g.fillStyle='#dc2626'; g.beginPath(); g.ellipse(w/2,38,40,28,0,Math.PI,0); g.fill(); g.fillStyle='#fff'; for(const [x,y] of [[-18,28],[6,18],[22,30],[-4,32]]){ g.beginPath(); g.arc(w/2+x,y,4,0,7); g.fill(); } });
    // Fjäll
    sprite('reindeer',190,170,620,true,(g,w,h)=>{ g.fillStyle='#6b4f3a'; g.beginPath(); g.ellipse(96,90,56,26,0,0,7); g.fill(); g.fillStyle='#f5f5f4'; g.beginPath(); g.ellipse(64,98,18,14,0,0,7); g.fill();
      g.fillStyle='#57412f'; for(const x of [56,74,118,136]) g.fillRect(x,100,8,h-102); g.fillStyle='#6b4f3a'; g.beginPath(); g.moveTo(140,80); g.lineTo(166,40); g.lineTo(182,48); g.lineTo(160,92); g.fill();
      g.strokeStyle='#d6c7b0'; g.lineWidth=5; g.lineCap='round'; g.beginPath(); g.moveTo(168,40); g.quadraticCurveTo(150,10,130,6); g.moveTo(152,20); g.lineTo(160,6); g.moveTo(174,40); g.quadraticCurveTo(186,10,180,0); g.stroke(); });
    sprite('pole',40,240,110,false,(g,w,h)=>{ for(let y=0;y<h;y+=30){ g.fillStyle=(y/30)%2?'#111827':'#f97316'; g.fillRect(w/2-6,y,12,30); } });
    sprite('cabin',300,230,1700,true,(g,w,h)=>{ g.fillStyle='#7c4a22'; g.fillRect(24,96,252,h-96); g.fillStyle='rgba(0,0,0,.22)'; for(let y=100;y<h;y+=14) g.fillRect(24,y,252,3);
      g.fillStyle='#fff'; g.beginPath(); g.moveTo(4,104); g.lineTo(w/2,20); g.lineTo(w-4,104); g.lineTo(w-14,110); g.lineTo(w/2,36); g.lineTo(14,110); g.fill(); g.fillStyle='#e2e8f0'; g.beginPath(); g.moveTo(14,110); g.lineTo(w/2,36); g.lineTo(w-14,110); g.lineTo(w-24,104); g.lineTo(w/2,50); g.lineTo(24,104); g.fill();
      g.fillStyle='#fbbf24'; g.fillRect(60,136,52,44); g.fillRect(188,136,52,44); g.fillStyle='#7c4a22'; g.fillRect(84,136,4,44); g.fillRect(212,136,4,44); g.fillStyle='#f8fafc'; g.beginPath(); g.ellipse(w/2,h-6,w*.46,10,0,0,7); g.fill(); });
    sprite('snowbank',240,70,1000,false,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#ffffff'); gr.addColorStop(1,'#cbd5e1'); g.fillStyle=gr; g.beginPath(); g.moveTo(0,h); g.quadraticCurveTo(w*.25,0,w*.5,h*.3); g.quadraticCurveTo(w*.8,0,w,h); g.fill(); });
    // Storstan
    sprite('lamp',150,440,700,true,(g,w,h)=>{ const gl=g.createRadialGradient(118,40,4,118,40,60); gl.addColorStop(0,'rgba(255,236,170,.95)'); gl.addColorStop(1,'rgba(255,200,90,0)'); g.fillStyle=gl; g.fillRect(50,0,100,110);
      g.strokeStyle='#334155'; g.lineWidth=10; g.beginPath(); g.moveTo(30,h); g.lineTo(30,60); g.quadraticCurveTo(30,30,70,30); g.lineTo(110,30); g.stroke(); g.fillStyle='#fef3c7'; g.beginPath(); g.ellipse(116,40,20,8,0,0,7); g.fill(); });
    const bld=(c1,c2,seed)=>(g,w,h)=>{ const r=rng(seed); g.fillStyle=shade(g,0,0,w,0,c1,c2); g.fillRect(6,20,w-12,h-20); g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(6,20,w-12,10);
      for(let y=46;y<h-60;y+=36) for(let x=22;x<w-36;x+=34){ g.fillStyle=r()<.55?['#fde68a','#fef3c7','#fbbf24','#a5f3fc'][Math.floor(r()*4)]:'#1e1b2e'; g.fillRect(x,y,20,22); }
      g.fillStyle='#fde68a'; g.fillRect(w/2-30,h-54,60,54); g.fillStyle='#78350f'; g.fillRect(w/2-2,h-54,4,54); };
    sprite('bld1',300,440,2500,true,bld('#3b2a5c','#1e1638',7)); sprite('bld2',300,520,2500,true,bld('#334155','#1e293b',11)); sprite('bld3',280,380,2300,true,bld('#5b2246','#2d1028',23));
    const neon=(txt,c)=>(g,w,h)=>{ g.fillStyle='#1e293b'; g.fillRect(w/2-6,100,12,h-100); g.fillStyle='#0b1020'; g.beginPath(); g.roundRect(6,6,w-12,104,14); g.fill();
      g.font='bold 58px Fredoka, system-ui, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.shadowColor=c; g.shadowBlur=26; g.fillStyle=c; g.fillText(txt,w/2,60); g.shadowBlur=8; g.fillStyle='#fff'; g.fillText(txt,w/2,60);
      g.shadowBlur=0; g.strokeStyle=c; g.lineWidth=4; g.beginPath(); g.roundRect(12,12,w-24,92,10); g.stroke(); };
    sprite('neon1',280,240,1300,true,neon('PIZZA','#f472b6')); sprite('neon2',260,240,1200,true,neon('BIO','#22d3ee')); sprite('neon3',280,240,1300,true,neon('KIOSK','#a3e635')); sprite('neon4',300,240,1400,true,neon('HOTELL','#facc15'));
    sprite('treeC',170,320,800,true,(g,w,h)=>{ g.fillStyle='#3f2d20'; g.fillRect(w/2-7,h-110,14,110); for(let i=0;i<40;i++){ g.fillStyle=['#14532d','#166534','#1a3d2b'][i%3]; g.beginPath(); g.arc(w/2+(Math.random()-.5)*110,90+(Math.random()-.5)*130,26,0,7); g.fill(); } });
    // portaler
    const gate=(txt,c1,c2,check)=>(g,w,h)=>{ g.fillStyle='#e5e7eb'; g.fillRect(20,40,24,h-40); g.fillRect(w-44,40,24,h-40); g.fillStyle='#94a3b8'; g.fillRect(36,40,8,h-40); g.fillRect(w-28,40,8,h-40);
      const gr=g.createLinearGradient(0,30,0,140); gr.addColorStop(0,c1); gr.addColorStop(1,c2); g.fillStyle=gr; g.fillRect(10,30,w-20,110);
      if(check){ for(let x=10;x<w-10;x+=20) for(let y=0;y<2;y++){ g.fillStyle=((x/20+y)%2)?'#111':'#fff'; g.fillRect(x,30+y*12+(y?86:0),20,12); } }
      g.font='bold 74px Fredoka, system-ui, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='rgba(0,0,0,.35)'; g.fillText(txt,w/2+3,89); g.fillStyle='#fff'; g.fillText(txt,w/2,86); };
    sprite('gStart',900,330,5200,false,gate('START','#22c55e','#15803d'));
    sprite('gCheck',900,330,5200,false,gate('CHECKPOINT','#2563eb','#1e3a8a',true));
    sprite('gGoal',900,330,5200,false,gate('MÅL','#e11d48','#9f1239',true));
    // trafik (bakifrån)
    const car=(col,dark,kind)=>(g,w,h)=>{
      const body=g.createLinearGradient(0,0,0,h); body.addColorStop(0,col); body.addColorStop(1,dark);
      g.fillStyle='rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(w/2,h-6,w*.5,8,0,0,7); g.fill();
      g.fillStyle='#111'; g.fillRect(10,h-40,34,36); g.fillRect(w-44,h-40,34,36);
      if(kind==='truck'){ g.fillStyle=shade(g,0,0,w,0,'#f1f5f9','#94a3b8'); g.fillRect(8,6,w-16,h-50); g.strokeStyle='rgba(0,0,0,.25)'; g.lineWidth=3; g.strokeRect(10,8,w-20,h-54); g.beginPath(); g.moveTo(w/2,8); g.lineTo(w/2,h-46); g.stroke();
        g.fillStyle=col; g.fillRect(8,h-58,w-16,22); g.font='bold 30px Fredoka, sans-serif'; g.textAlign='center'; g.fillStyle=dark; g.fillText('FRAKT',w/2,h*.42);
        g.fillStyle='#ef4444'; g.fillRect(14,h-54,26,12); g.fillRect(w-40,h-54,26,12); return; }
      if(kind==='van'){ g.fillStyle=body; g.beginPath(); g.roundRect(8,10,w-16,h-46,22); g.fill(); g.fillStyle='#0f172a'; g.beginPath(); g.roundRect(26,26,w-52,h*.32,12); g.fill(); g.fillStyle='rgba(255,255,255,.15)'; g.fillRect(30,30,w-60,10);
        g.fillStyle='#ef4444'; g.fillRect(14,h-80,22,30); g.fillRect(w-36,h-80,22,30); g.fillStyle='#e2e8f0'; g.fillRect(w/2-36,h-66,72,20); g.fillStyle='#111'; g.font='bold 15px sans-serif'; g.textAlign='center'; g.fillText('RES 01',w/2,h-51); return; }
      g.fillStyle=body; g.beginPath(); g.moveTo(6,h-30); g.lineTo(10,h*.5); g.quadraticCurveTo(20,h*.12,w*.3,h*.1); g.lineTo(w*.7,h*.1); g.quadraticCurveTo(w-20,h*.12,w-10,h*.5); g.lineTo(w-6,h-30); g.closePath(); g.fill();
      g.fillStyle='#0f172a'; g.beginPath(); g.moveTo(w*.24,h*.42); g.lineTo(w*.3,h*.16); g.lineTo(w*.7,h*.16); g.lineTo(w*.76,h*.42); g.fill(); g.fillStyle='rgba(255,255,255,.14)'; g.fillRect(w*.32,h*.2,w*.36,6);
      g.fillStyle='#dc2626'; g.beginPath(); g.roundRect(14,h*.5,40,18,6); g.fill(); g.beginPath(); g.roundRect(w-54,h*.5,40,18,6); g.fill();
      g.fillStyle='#e2e8f0'; g.fillRect(w/2-30,h*.56,60,18); g.fillStyle='#333'; g.fillRect(8,h-34,w-16,8); };
    const TC=[['#ef4444','#7f1d1d'],['#3b82f6','#1e3a8a'],['#10b981','#065f46'],['#f59e0b','#92400e'],['#e2e8f0','#64748b'],['#8b5cf6','#4c1d95'],['#111827','#030712']];
    TC.forEach(([a,b],i)=>sprite('car'+i,220,160,600,true,car(a,b,'car')));
    sprite('van',230,220,680,true,car('#f8fafc','#94a3b8','van')); sprite('van2',230,220,680,true,car('#fde68a','#b45309','van'));
    sprite('truck',260,330,800,true,car('#dc2626','#7f1d1d','truck')); sprite('truck2',260,330,800,true,car('#2563eb','#1e3a8a','truck'));
  }
  const POOL=[
    {near:[['rock',3],['rock2',2],['grass',4],['hut',1.4],['lighthouse',.4]], far:[['boat',1]], farSide:-1},
    {near:[['birch',3],['stuga',1.2],['hay',2],['flowers',3],['stang',.4],['flag',.7]], far:[['field',1.2],['birch',1]]},
    {near:[['birchA',3],['pine',3],['barn',.8],['moose',.6],['mush',1.5]], far:[['pine',2],['birchA',1]]},
    {near:[['pineS',4],['snowbank',3],['reindeer',.8],['cabin',.8],['pole',2.5]], far:[['pineS',2]]},
    {near:[['lamp',3],['neon1',.7],['neon2',.7],['neon3',.7],['neon4',.7],['treeC',1.5]], far:[['bld1',1],['bld2',1],['bld3',1]]}
  ];

  /* ---------- bakgrunder (lager som rullar i sidled) ---------- */
  const BG=[];
  function buildBG(){
    T.forEach((t,ti)=>{
      const r=rng(100+ti), FW=1600, FH=300;
      const far=mk(FW,FH,(g,w,h)=>{
        if(t.far==='sea'){ const s=g.createLinearGradient(0,h*.72,0,h); s.addColorStop(0,'#3b82c4'); s.addColorStop(1,'#1e5aa0'); g.fillStyle=s; g.fillRect(0,h*.78,w,h*.22);
          for(let i=0;i<9;i++){ const x=r()*w, ww=60+r()*160, hh=8+r()*22; g.fillStyle=['#6b7f8f','#7e8f9b','#5d6f7d'][i%3]; g.beginPath(); g.moveTo(x,h*.8); g.quadraticCurveTo(x+ww/2,h*.8-hh*2,x+ww,h*.8); g.fill(); }
          g.fillStyle='rgba(255,255,255,.5)'; for(let i=0;i<80;i++) g.fillRect(r()*w,h*.8+r()*h*.18,6+r()*14,2);
          for(let i=0;i<5;i++){ const x=r()*w; g.fillStyle='#fff'; g.beginPath(); g.moveTo(x,h*.78); g.lineTo(x,h*.7); g.lineTo(x+8,h*.78); g.fill(); } }
        else if(t.far==='hills'){ for(let k=0;k<2;k++){ g.fillStyle=k?'#5f8f6a':'#8fb5a0'; g.beginPath(); g.moveTo(0,h); for(let x=0;x<=w;x+=20) g.lineTo(x,h*(.62+k*.1)-Math.sin(x/(170+k*60)+k*2)*24-Math.sin(x/53)*6); g.lineTo(w,h); g.fill(); } }
        else if(t.far==='autumn'){ g.fillStyle='rgba(255,220,180,.25)'; g.fillRect(0,h*.86,w,h*.14); for(let k=0;k<2;k++){ g.fillStyle=k?'#7c2d3a':'#b45372'; g.beginPath(); g.moveTo(0,h*.9); for(let x=0;x<=w;x+=16) g.lineTo(x,h*(.55+k*.14)-Math.sin(x/(140+k*80))*22-Math.abs(Math.sin(x/9))*6); g.lineTo(w,h*.9); g.fill(); }
          g.fillStyle='rgba(255,200,150,.55)'; for(let i=0;i<40;i++) g.fillRect(r()*w,h*.88+r()*h*.1,20+r()*40,2); }
        else if(t.far==='mountains'){ for(let k=0;k<2;k++){ g.fillStyle=k?'#64748b':'#94a3b8'; g.beginPath(); g.moveTo(0,h); let x=0; while(x<w){ const pw=120+r()*220, ph=h*(.15+r()*.35)+k*40; g.lineTo(x+pw/2,ph); g.lineTo(x+pw,h*.8); x+=pw*.8; } g.lineTo(w,h); g.fill(); }
          g.globalCompositeOperation='source-atop'; g.fillStyle='rgba(255,255,255,.85)'; g.fillRect(0,0,w,h*.42); g.globalCompositeOperation='source-over'; }
        else if(t.far==='skyline'){ let x=0; while(x<w){ const bw=30+r()*70, bh=h*(.2+r()*.55); g.fillStyle=['#1a1033','#24124a','#150b2b'][Math.floor(r()*3)]; g.fillRect(x,h-bh,bw,bh); for(let y=h-bh+8;y<h-6;y+=12) for(let xx=x+5;xx<x+bw-6;xx+=10) if(r()<.3){ g.fillStyle=['#fde68a','#f0abfc','#a5f3fc'][Math.floor(r()*3)]; g.fillRect(xx,y,4,5); } x+=bw+2; }
          g.fillStyle='#ef4444'; for(let i=0;i<6;i++) g.fillRect(r()*w,h*.3+r()*h*.3,3,3); }
      });
      const near=mk(FW,FH,(g,w,h)=>{
        if(t.near==='skerry'){ g.fillStyle='#8a7a72'; g.beginPath(); g.moveTo(0,h); for(let x=0;x<=w;x+=24) g.lineTo(x,h*.82-Math.max(0,Math.sin(x/150))*50-Math.sin(x/37)*6); g.lineTo(w,h); g.fill(); }
        else if(t.near==='forest' || t.near==='autumnNear' || t.near==='snowforest'){ const cs= t.near==='forest'?['#2f5f3a','#3d7347']: t.near==='autumnNear'?['#5a2a1e','#7c3a1a']:['#284235','#365a47'];
          g.fillStyle=cs[0]; g.fillRect(0,h*.86,w,h*.14);
          for(let x=0;x<w;x+=10+r()*14){ const th=30+r()*70; g.fillStyle=cs[Math.floor(r()*2)]; g.beginPath(); g.moveTo(x-12,h*.88); g.lineTo(x,h*.88-th); g.lineTo(x+12,h*.88); g.fill();
            if(t.near==='snowforest'){ g.fillStyle='rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(x-4,h*.88-th*.7); g.lineTo(x,h*.88-th); g.lineTo(x+4,h*.88-th*.7); g.fill(); }
            if(t.near==='autumnNear' && r()<.4){ g.fillStyle=['#ea580c','#f59e0b','#facc15'][Math.floor(r()*3)]; g.beginPath(); g.arc(x,h*.88-th*.6,10+r()*10,0,7); g.fill(); } } }
        else if(t.near==='city'){ let x=0; while(x<w){ const bw=50+r()*90, bh=h*(.15+r()*.35); g.fillStyle='#0d0820'; g.fillRect(x,h-bh,bw,bh); for(let y=h-bh+10;y<h-8;y+=16) for(let xx=x+6;xx<x+bw-8;xx+=14) if(r()<.45){ g.fillStyle=['#fbbf24','#fde68a','#f472b6'][Math.floor(r()*3)]; g.fillRect(xx,y,6,8); } x+=bw+r()*20; } }
      });
      BG[ti]={far,near};
    });
  }

  /* ---------- banan ---------- */
  let segs=[], trackLen=0, cars=[], stageStart=[];
  const lastY=()=>segs.length?segs[segs.length-1].p2.w.y:0;
  function addSeg(curve,y,t){ const n=segs.length; const tb=n-(stageStart[t]||0); segs.push({i:n, p1:{w:{y:lastY(),z:n*SEG},c:{},s:{}}, p2:{w:{y,z:(n+1)*SEG},c:{},s:{}}, curve, t, k: t>0 && tb<BLEND ? tb/BLEND : 1, sprites:[], cars:[], clip:0}); }
  function addRoad(e,hd,l,curve,dy,t){ const sy=lastY(), ey=sy+dy*SEG, tot=e+hd+l;
    for(let n=0;n<e;n++) addSeg(easeIn(0,curve,n/e), easeIO(sy,ey,n/tot), t);
    for(let n=0;n<hd;n++) addSeg(curve, easeIO(sy,ey,(e+n)/tot), t);
    for(let n=0;n<l;n++) addSeg(easeIO(curve,0,n/l), easeIO(sy,ey,(e+hd+n)/tot), t); }
  function build(diff){
    segs=[]; cars=[]; stageStart=[];
    const R=rng(4242);
    stageStart[0]=0; addRoad(0,INTRO,0,0,0,0);
    for(let t=0;t<T.length;t++){
      if(t>0) stageStart[t]=segs.length;
      const end=(stageStart[t]||0)+STAGE + (t===0?INTRO:0);
      const hilly=[.6,.8,1,1.6,.4][t], curvy=[1,.8,1.1,.9,1.2][t];
      while(segs.length<end-40){
        const len=[25,50,75][Math.floor(R()*3)], k=R();
        const c=(R()<.5?-1:1)*[2,3,4,6][Math.floor(R()*4)]*curvy, hh=(R()<.5?-1:1)*[0,20,40,60][Math.floor(R()*4)]*hilly;
        if(k<.22) addRoad(len/2,len,len/2,0,hh*.5,t);
        else if(k<.62) addRoad(len/2,len,len/2,c,hh,t);
        else if(k<.82){ addRoad(len/3,len/2,len/3,c,hh*.4,t); addRoad(len/3,len/2,len/3,-c,-hh*.4,t); }
        else addRoad(len/2,len/2,len/2,c*.5,hh,t);
      }
      addRoad(10,Math.max(0,end-segs.length-20),10,0,0,t);
    }
    addRoad(20,OUTRO,20,0,-lastY()/SEG*.2,T.length-1);
    trackLen=segs.length*SEG;
    // dekor
    const add=(n,name,off)=>{ if(segs[n] && SP[name]) segs[n].sprites.push({s:SP[name], off}); };
    add(14,'gStart',0); for(let t=1;t<T.length;t++) add(stageStart[t],'gCheck',0);
    const goalSeg=segs.length-OUTRO-30; add(goalSeg,'gGoal',0); segs.goal=goalSeg;
    for(let n=20;n<segs.length;n++){
      const t=segs[n].t, P=POOL[t];
      if(n%3===0 && R()<.75){ const side=R()<.5?-1:1; add(n, pick(P.near,R), side*(1.25+R()*1.4)); }
      if(n%5===0 && R()<.6){ const side=P.farSide||(R()<.5?-1:1); add(n, pick(P.far,R), side*(3+R()*4)); }
      if(t===4 && n%8===0){ add(n,'lamp',-1.2); add(n,'lamp',1.2); }
      if(t===3 && n%6===0){ add(n,'pole',-1.12); add(n,'pole',1.12); }
    }
    // trafik
    const TS=['car0','car1','car2','car3','car4','car5','car6','car0','car1','car3','van','van2','truck','truck2'];
    const nCars=DIFF[diff].cars*T.length;
    for(let i=0;i<nCars;i++){
      const z=(INTRO+30+Math.floor(R()*(segs.length-INTRO-OUTRO-60)))*SEG;
      const name=TS[Math.floor(R()*TS.length)], sp=SP[name];
      const lane=Math.floor(R()*LANES), off=-.66+lane*.66;
      const speed=MAXS*(.22+R()*.3)*(name.startsWith('truck')?.8:1);
      const c={z, off, toff:off, s:sp, w:sp.ww/ROADW, speed, seg:null};
      c.seg=findSeg(z); c.seg.cars.push(c); cars.push(c);
    }
  }
  function pick(list,R){ let tot=0; for(const [,w] of list) tot+=w; let x=R()*tot; for(const [n,w] of list){ x-=w; if(x<=0) return n; } return list[0][0]; }
  const findSeg=z=>segs[clamp(Math.floor(z/SEG),0,segs.length-1)];

  /* ---------- tillstånd ---------- */
  let root=null, cv=null, ctx=null, W=0, H=0, U=0, HZ=.5, dpr=1, raf=0, lastT=0, acc=0, overlay='menu', built=false;
  let st=null; const keys={}, pad={l:false,r:false,g:false,b:false};
  function newGame(){
    build(cfg.diff); const D=DIFF[cfg.diff];
    st={pos:0, x:0, speed:0, time:D.t, score:0, stage:0, sky:0, near:0, crash:0, spin:0, bump:0, shake:0, over:false, fin:false, finT:0, run:true, started:0, cd:3.2,
      pops:[], parts:[], wave:0, nm:0, cps:0, startAt:Date.now(), banner:{t:2.8, a:T[0].name, b:'Etapp 1 av 5 · '+T[0].sub}, steer:0, lean:0, cheer:0, hair:0, prevT:0, tFade:1};
    overlay=null; showOverlay(); radio.play(cfg.radio); engine.start();
    const s=stats(); s.games++; saveStats(s);
  }

  /* ---------- uppdatering ---------- */
  function update(dt){
    if(!st || overlay) return;
    const D=DIFF[cfg.diff];
    if(st.cd>0){ const was=Math.ceil(st.cd); st.cd-=dt; const now=Math.ceil(st.cd); if(now!==was && now>0) beep(now===1?660:440,.15); if(st.cd<=0) beep(990,.35); return; }
    const pseg=findSeg(st.pos+PZ), sp=st.speed/MAXS, dx=dt*2*Math.max(sp,.18);
    const left=keys.ArrowLeft||keys.a||pad.l, right=keys.ArrowRight||keys.d||pad.r;
    const brake=keys.ArrowDown||keys.s||pad.b, gas=!st.over && !st.fin && (cfg.auto ? !brake : (keys.ArrowUp||keys.w||pad.g));
    // styrning
    let steer=0;
    if(st.crash<=0 && !st.fin){ if(left) steer-=1; if(right) steer+=1; }
    if(st.fin) steer = clamp(-st.x*2,-1,1)*.5;
    if(window.__raceAuto && st.crash<=0 && !st.fin) steer=autoSteer(pseg);
    st.steer=lerp(st.steer,steer,clamp(dt*10,0,1));
    st.x += st.steer*dx*1.1;
    st.x -= dx*sp*pseg.curve*CENT;
    // gas och broms
    if(st.crash>0){ st.crash-=dt; st.spin+=dt*14*Math.max(.2,st.crash); st.speed*=Math.pow(.12,dt); if(st.crash<=0){ st.spin=0; st.x=clamp(st.x,-.9,.9); } }
    else if(st.fin){ st.speed+=DEC*.6*dt; }
    else if(brake) st.speed+=BRK*dt;
    else if(gas) st.speed+=ACC*dt*(1-.35*sp);
    else st.speed+=DEC*dt;
    // utanför vägen
    const off=st.x<-1||st.x>1;
    if(off && st.speed>OFFLIM) st.speed+=OFFDEC*dt;
    if(off && st.crash<=0){
      for(const s of pseg.sprites){ if(!s.s.col) continue; const sw=s.s.ww/ROADW; const so=s.off+sw/2*(s.off>0?1:-1);
        if(Math.abs(st.x-so)<(PW+sw)/2){ if(st.speed>MAXS*.33){ st.crash=1.3; st.shake=.6; crashSnd(); buzz([60,40,120]); st.x=clamp(st.x,-2.2,2.2); } else { st.speed*=.2; st.shake=.25; thud(); st.x+= st.x>0?-.18:.18; } st.pos=Math.max(0,st.pos-SEG*.3); break; } }
      if(Math.random()<sp*1.4) dust(st.x<0?-1:1);
    }
    // trafik
    for(const c of pseg.cars){ if(st.speed>c.speed && Math.abs(st.x-c.off)<(PW+c.w)/2*.95){ st.speed=Math.max(c.speed*.85, st.speed*.45); st.pos=Math.max(0,c.z-PZ-SEG*.2); st.shake=.35; st.bump=.5; thud(); buzz(40); break; } }
    st.x=clamp(st.x,-3,3); st.speed=clamp(st.speed,0,MAXS);
    const oldPos=st.pos; st.pos=Math.min(st.pos+dt*st.speed, trackLen-SEG*(DRAW+4));
    updateCars(dt);
    nearMiss(oldPos);
    // bakgrund i sidled
    st.sky+=.0011*pseg.curve*sp; st.near+=.0024*pseg.curve*sp;
    // etapper
    const ps=findSeg(st.pos+PZ);
    if(ps.t!==st.stage && !st.fin){ st.prevT=st.stage; st.stage=ps.t; st.tFade=0; st.time+=D.cp; st.cps++; st.cheer=2.2; st.banner={t:3.2, a:'CHECKPOINT!', b:`+${D.cp} sekunder · Etapp ${st.stage+1}: ${T[st.stage].name}`, c:true}; jingle(); st.score+=2000; pop('+2 000',W/2,H*.32,'#fde047'); }
    if(st.tFade<1) st.tFade=Math.min(1,st.tFade+dt/2.4);
    if(!st.fin && ps.i>=segs.goal){ st.fin=true; st.finT=0; st.cheer=99; const bonus=Math.round(st.time)*1000; st.bonus=bonus; st.score+=bonus; st.banner={t:4, a:'MÅL!', b:`Tidsbonus +${bonus.toLocaleString('sv-SE')}`, c:true}; fanfare(); fireworks(); }
    if(st.fin){ st.finT+=dt; if(st.finT>4.5 && overlay!=='over') end(true); }
    // tid
    if(!st.fin && !st.over){ st.time-=dt; if(st.time<=10 && Math.ceil(st.time)!==Math.ceil(st.time+dt)) beep(880,.08); if(st.time<=0){ st.time=0; st.over=true; st.overT=0; st.banner={t:9, a:'TIDEN ÄR SLUT', b:'Bilen rullar till stopp…'}; sadSnd(); } }
    if(st.over){ st.overT+=dt; if((st.speed<MAXS*.03 && st.overT>1.5) || st.overT>6) end(false); }
    // poäng
    if(!st.over && !st.fin) st.score+=dt*st.speed*.045*(off?.3:1);
    // effekter
    st.shake=Math.max(0,st.shake-dt); st.bump=Math.max(0,st.bump-dt); st.cheer=Math.max(0,st.cheer-dt); st.hair+=dt*(2+sp*16); st.wave+=dt;
    st.lean=lerp(st.lean, -st.steer*sp - pseg.curve*sp*.12, clamp(dt*6,0,1));
    const yawT = st.crash>0 ? Math.sin(st.spin)*.95 : clamp(st.steer*.9 + pseg.curve*sp*.07, -1, 1)*Math.min(1,sp*2.5);
    st.yaw=lerp(st.yaw||0, yawT, clamp(dt*7,0,1));
    if(st.banner) { st.banner.t-=dt; if(st.banner.t<=0) st.banner=null; }
    for(const p of st.pops){ p.life-=dt; p.y-=dt*40; } st.pops=st.pops.filter(p=>p.life>0);
    for(const p of st.parts){ p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.g*dt; p.r+=p.gr*dt; } st.parts=st.parts.filter(p=>p.life>0);
    if(Math.abs(pseg.curve*sp)>3.6 && st.speed>MAXS*.7 && !off && Math.random()<.5) smoke();
    engine.set(sp, off, Math.abs(pseg.curve*sp)>3.6 && st.speed>MAXS*.7 || (brake && st.speed>MAXS*.4), st.crash>0);
  }
  function autoSteer(pseg){ // testpilot: följ vägen och väj för bilar
    let target=0; const ahead=[];
    for(let n=0;n<34;n++){ const s=segs[pseg.i+n]; if(s) for(const c of s.cars) if(c.speed<st.speed*.98) ahead.push(c); }
    const blocked=x=>ahead.some(c=>Math.abs(x-c.off)<(PW+c.w)/2+.12);
    if(blocked(target)){ target = !blocked(-.66)?-.66 : !blocked(.66)?.66 : !blocked(-.9)?-.9:.9; }
    const look=segs[pseg.i+6]; target-= (look?look.curve:0)*.04;
    const d=target-st.x; return Math.abs(d)<.04?0:clamp(d*6,-1,1);
  }
  function updateCars(dt){
    for(const c of cars){
      const old=c.seg;
      if(Math.random()<.002) c.toff=[-.66,0,.66][Math.floor(Math.random()*3)];
      c.off=lerp(c.off,c.toff,clamp(dt*.8,0,1));
      c.z+=dt*c.speed; if(c.z>=trackLen-SEG) c.z-=trackLen-SEG*(INTRO+40);
      const ns=findSeg(c.z); if(ns!==old){ const i=old.cars.indexOf(c); if(i>=0) old.cars.splice(i,1); ns.cars.push(c); c.seg=ns; }
    }
  }
  function nearMiss(oldPos){
    if(st.speed<MAXS*.55 || st.over || st.fin) return;
    const a=oldPos+PZ, b=st.pos+PZ, s0=findSeg(a).i;
    for(let n=s0-1;n<=s0+2;n++){ const s=segs[n]; if(!s) continue;
      for(const c of s.cars){ if(c.z>=a-SEG*.1 && c.z<b && !c.nm){ const gap=Math.abs(st.x-c.off)-(PW+c.w)/2; if(gap>-0.02 && gap<.22){ c.nm=true; st.nm++; const pts=500+Math.round((.22-gap)*4000); st.score+=pts; pop('Nära ögat! +'+pts,W/2+(c.off<st.x?-1:1)*W*.12,H*.55,'#22d3ee'); whoosh(); st.cheer=Math.max(st.cheer,1); } } } }
  }
  function pop(txt,x,y,c){ st.pops.push({txt,x,y,c,life:1.4}); }
  function dust(side){ const snow=st.stage===3, city=st.stage===4; st.parts.push({x:W/2+side*W*.13+(Math.random()-.5)*W*.1, y:H-H*.05, vx:(Math.random()-.5)*60, vy:-40-Math.random()*60, g:60, r:6+Math.random()*8, gr:30, life:.8, c: snow?'rgba(255,255,255,.75)': city?'rgba(160,160,170,.4)':'rgba(170,140,90,.55)'}); }
  function smoke(){ for(const s of [-1,1]) st.parts.push({x:W/2+s*W*.12, y:H-H*.04, vx:(Math.random()-.5)*40, vy:-20-Math.random()*20, g:0, r:5, gr:40, life:.6, c:'rgba(230,230,235,.45)'}); }
  function fireworks(){ for(let k=0;k<7;k++) setTimeout(()=>{ if(!st) return; const cx=W*(.2+Math.random()*.6), cy=H*(.12+Math.random()*.2), col=['#f472b6','#facc15','#22d3ee','#a3e635','#f97316'][k%5];
      for(let i=0;i<46;i++){ const a=i/46*6.28, v=80+Math.random()*90; st.parts.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:60,r:2.6,gr:0,life:1.4+Math.random()*.5,c:col,glow:true}); } boom(); },k*520); }

  /* ---------- rendering ---------- */
  function project(p,cx,cy,cz){ p.c.x=-cx; p.c.y=p.w.y-cy; p.c.z=p.w.z-cz; p.s.scale=DEPTH/p.c.z; p.s.x=Math.round(W/2+p.s.scale*p.c.x*U); p.s.y=Math.round(H*HZ-p.s.scale*p.c.y*U); p.s.w=Math.round(p.s.scale*ROADW*U); }
  function segCols(s){ const t=T[s.t], pt=T[Math.max(0,s.t-1)], k=s.k, alt=Math.floor(s.i/RUMB)%2;
    const m=(a,b)=>k>=1?a:mix(b,a,k);
    return {grass:m(t.grass[alt],pt.grass[alt]), road:m(t.road[alt],pt.road[alt]), rumble:m(t.rumble[alt],pt.rumble[alt]), lane:alt?null:m(t.lane,pt.lane), fog:m(t.fog,pt.fog)}; }
  function poly(x1,y1,x2,y2,x3,y3,x4,y4,c){ ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.lineTo(x4,y4); ctx.closePath(); ctx.fill(); }
  function drawSeg(s,fog){
    const p1=s.p1.s, p2=s.p2.s, c=segCols(s), F=x=>fog>0?rgb(mix(x,c.fog,fog)):rgb(x);
    ctx.fillStyle=F(c.grass); ctx.fillRect(0,p2.y-1,W,p1.y-p2.y+2);
    const r1=p1.w/Math.max(6,2*LANES), r2=p2.w/Math.max(6,2*LANES);
    const y2=p2.y-1;   // en pixel överlapp: inga glipor mellan segmenten
    poly(p1.x-p1.w-r1,p1.y,p1.x-p1.w,p1.y,p2.x-p2.w,y2,p2.x-p2.w-r2,y2,F(c.rumble));
    poly(p1.x+p1.w+r1,p1.y,p1.x+p1.w,p1.y,p2.x+p2.w,y2,p2.x+p2.w+r2,y2,F(c.rumble));
    poly(p1.x-p1.w,p1.y,p1.x+p1.w,p1.y,p2.x+p2.w,y2,p2.x-p2.w,y2,F(c.road));
    if(c.lane){ const l1=p1.w/48, l2=p2.w/48, lw1=p1.w*2/LANES, lw2=p2.w*2/LANES; let x1=p1.x-p1.w+lw1, x2=p2.x-p2.w+lw2;
      for(let l=1;l<LANES;l++,x1+=lw1,x2+=lw2) poly(x1-l1/2,p1.y,x1+l1/2,p1.y,x2+l2/2,p2.y,x2-l2/2,p2.y,F(c.lane)); }
  }
  function drawSprite(sp,scale,x,y,ox,oy,clipY,alpha){
    const dw=sp.ww*scale*U, dh=dw*sp.c.height/sp.c.width; x+=dw*ox; y+=dh*oy;
    if(dw<1 || x>W || x+dw<0) return;
    const ch=clipY?Math.max(0,y+dh-clipY):0; if(ch>=dh) return;
    if(alpha<1) ctx.globalAlpha=alpha;
    ctx.drawImage(sp.c,0,0,sp.c.width,sp.c.height-sp.c.height*ch/dh,x,y,dw,dh-ch);
    if(alpha<1) ctx.globalAlpha=1;
  }
  function drawSky(ti,alpha){
    const t=T[ti], b=BG[ti]; ctx.globalAlpha=alpha;
    const g=ctx.createLinearGradient(0,0,0,H*HZ); g.addColorStop(0,t.sky[0]); g.addColorStop(.62,t.sky[1]); g.addColorStop(1,t.sky[2]); ctx.fillStyle=g; ctx.fillRect(0,0,W,H*HZ+2);
    const sx=((t.sun||t.moon).x - st.sky*.6%1+2)%1*W;
    if(t.sun){ const r=t.sun.r*Math.max(W,H), y=t.sun.y*H*HZ*2; const gl=ctx.createRadialGradient(sx,y,r*.4,sx,y,r*4); gl.addColorStop(0,t.sun.g); gl.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=gl; ctx.fillRect(sx-r*4,y-r*4,r*8,r*8); ctx.fillStyle=t.sun.c; ctx.beginPath(); ctx.arc(sx,y,r,0,7); ctx.fill(); }
    if(t.moon){ ctx.fillStyle='rgba(255,255,255,.85)'; const R=rng(9); for(let i=0;i<90;i++){ const x=(R()*W*1.5 - st.sky*80%W + W*2)%W; ctx.fillRect(x,R()*H*HZ*.8,R()<.1?2:1,R()<.1?2:1); }
      const r=t.moon.r*Math.max(W,H), y=t.moon.y*H*HZ*2; ctx.fillStyle='#fef9c3'; ctx.beginPath(); ctx.arc(sx,y,r,0,7); ctx.fill(); ctx.fillStyle=t.sky[0]; ctx.beginPath(); ctx.arc(sx+r*.45,y-r*.2,r*.9,0,7); ctx.fill(); }
    if(!t.moon){ ctx.fillStyle='rgba(255,255,255,.55)'; const R=rng(ti+3); for(let i=0;i<7;i++){ const cx=((R()*1.4 - st.sky*.3)%1+1)%1*W*1.3-W*.15, cy=H*HZ*(.12+R()*.45), s=W*(.05+R()*.06); for(let k=0;k<4;k++){ ctx.beginPath(); ctx.ellipse(cx+k*s*.6,cy+(k%2)*s*.12,s*.55,s*.22,0,0,7); ctx.fill(); } } }
    layer(b.far, st.sky, H*.24, H*HZ+2); layer(b.near, st.near, H*.2, H*HZ+3);
    ctx.globalAlpha=1;
  }
  function layer(img,off,h,bottom){ const w=img.width*h/img.height; let x=-(((off*w)%w)+w)%w; for(;x<W;x+=w) ctx.drawImage(img,x,bottom-h,w+1,h); }
  function draw(){
    if(!ctx || !st) return;
    ctx.save();
    if(st.shake>0) ctx.translate((Math.random()-.5)*st.shake*18,(Math.random()-.5)*st.shake*12);
    const base=findSeg(st.pos), bp=(st.pos%SEG)/SEG, pseg=findSeg(st.pos+PZ), pp=((st.pos+PZ)%SEG)/SEG, py=lerp(pseg.p1.w.y,pseg.p2.w.y,pp);
    if(st.tFade<1) drawSky(st.prevT,1); drawSky(st.stage, st.tFade<1?st.tFade:1);
    let maxy=H, x=0, dx=-(base.curve*bp);
    for(let n=0;n<DRAW;n++){
      const s=segs[base.i+n]; if(!s) break; s.clip=maxy; s.n=n;
      project(s.p1, st.x*ROADW-x, py+CAMH, st.pos); project(s.p2, st.x*ROADW-x-dx, py+CAMH, st.pos);
      x+=dx; dx+=s.curve;
      if(s.p1.c.z<=DEPTH || s.p2.s.y>=s.p1.s.y || s.p2.s.y>=maxy) continue;
      const f=n/DRAW; drawSeg(s, f>.45?Math.min(1,(f-.45)*1.9)**1.5:0);
      maxy=s.p1.s.y;
    }
    for(let n=DRAW-1;n>0;n--){
      const s=segs[base.i+n]; if(!s) continue; const a=n>DRAW*.7?clamp((DRAW-n)/(DRAW*.3),0,1):1;
      for(const c of s.cars){ const p=(c.z%SEG)/SEG, sc=lerp(s.p1.s.scale,s.p2.s.scale,p), cx=lerp(s.p1.s.x,s.p2.s.x,p)+sc*c.off*ROADW*U, cy=lerp(s.p1.s.y,s.p2.s.y,p); drawSprite(c.s,sc,cx,cy,-.5,-1,s.clip,a); }
      for(const sp of s.sprites){ const sc=s.p1.s.scale, sx=s.p1.s.x+sc*sp.off*ROADW*U; drawSprite(sp.s,sc,sx,s.p1.s.y,sp.off===0?-.5:sp.off<0?-1:0,-1,s.clip,a); }
      if(s===pseg) drawPlayer();
    }
    for(const p of st.parts){ ctx.globalAlpha=clamp(p.life*1.6,0,1); ctx.fillStyle=p.c; if(p.glow){ ctx.shadowColor=p.c; ctx.shadowBlur=8; } ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); ctx.shadowBlur=0; } ctx.globalAlpha=1;
    if(st.stage===4 && st.tFade>=0){ const g=ctx.createLinearGradient(0,H*.6,0,H); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(255,190,90,.1)'); ctx.fillStyle=g; ctx.fillRect(0,H*.6,W,H*.4); }
    ctx.restore();
    hud();
  }

  /* ---------- spelarens bil (ritas live: lutning, studs, hår i vinden) ---------- */
  let bodyC=null, bodyKey='';
  function carBody(){ const key=cfg.color; if(bodyC && bodyKey===key) return bodyC; bodyKey=key; const [,c1,c2]=CARCOL[cfg.color]||CARCOL[0];
    bodyC=mk(520,250,(g,w,h)=>{
      g.fillStyle='rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(w/2,h-10,w*.48,16,0,0,7); g.fill();
      g.fillStyle='#0b0b0f'; g.beginPath(); g.roundRect(26,h-82,92,72,14); g.fill(); g.beginPath(); g.roundRect(w-118,h-82,92,72,14); g.fill();
      g.strokeStyle='#27272a'; g.lineWidth=4; for(const x0 of [36,w-108]) for(let i=0;i<6;i++){ g.beginPath(); g.moveTo(x0+i*14,h-80); g.lineTo(x0+i*14,h-12); g.stroke(); }
      const bd=g.createLinearGradient(0,60,0,h-30); bd.addColorStop(0,'#fff'); bd.addColorStop(.06,c1); bd.addColorStop(.55,c1); bd.addColorStop(1,c2);
      g.fillStyle=bd; g.beginPath(); g.moveTo(14,h-56); g.quadraticCurveTo(6,120,40,92); g.quadraticCurveTo(80,70,w/2,72); g.quadraticCurveTo(w-80,70,w-40,92); g.quadraticCurveTo(w-6,120,w-14,h-56); g.quadraticCurveTo(w/2,h-30,14,h-56); g.fill();
      g.fillStyle='rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(44,96); g.quadraticCurveTo(w/2,74,w-44,96); g.quadraticCurveTo(w/2,86,44,104); g.fill();
      g.fillStyle='rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(20,h-70); g.quadraticCurveTo(w/2,h-40,w-20,h-70); g.lineTo(w-14,h-56); g.quadraticCurveTo(w/2,h-30,14,h-56); g.fill();
      // baklyktor
      for(const x of [70,118,w-118,w-70]){ const gl=g.createRadialGradient(x,138,2,x,138,22); gl.addColorStop(0,'#fecaca'); gl.addColorStop(.35,'#ef4444'); gl.addColorStop(1,'#7f1d1d'); g.fillStyle=gl; g.beginPath(); g.arc(x,138,19,0,7); g.fill(); g.strokeStyle='#e5e7eb'; g.lineWidth=3; g.stroke(); }
      g.fillStyle='#fde68a'; g.fillRect(w/2-60,124,120,32); g.strokeStyle='#111'; g.lineWidth=3; g.strokeRect(w/2-60,124,120,32);
      g.fillStyle='#1d4ed8'; g.fillRect(w/2-60,124,14,32); g.fillStyle='#111'; g.font='bold 22px Fredoka, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('SOL 26',w/2+6,141);
      g.fillStyle=shade(g,0,0,w,0,'#e5e7eb','#9ca3af'); g.beginPath(); g.roundRect(30,h-64,w-60,12,6); g.fill();
      for(const x of [w/2-90,w/2+70]){ g.fillStyle='#9ca3af'; g.beginPath(); g.roundRect(x,h-58,22,14,6); g.fill(); g.fillStyle='#27272a'; g.beginPath(); g.ellipse(x+11,h-51,7,4,0,0,7); g.fill(); }
      // säten och vindruta
      g.fillStyle='#78350f'; for(const x of [w/2-100,w/2+30]){ g.beginPath(); g.roundRect(x,40,70,48,14); g.fill(); g.fillStyle='#92400e'; g.fillRect(x+8,46,54,6); g.fillStyle='#78350f'; }
      g.strokeStyle='rgba(203,213,225,.85)'; g.lineWidth=5; g.beginPath(); g.moveTo(40,92); g.quadraticCurveTo(w/2,18,w-40,92); g.stroke();
      g.fillStyle='rgba(186,230,253,.18)'; g.beginPath(); g.moveTo(44,92); g.quadraticCurveTo(w/2,22,w-44,92); g.quadraticCurveTo(w/2,64,44,92); g.fill();
      for(const s of [-1,1]){ g.fillStyle=c2; g.beginPath(); g.roundRect(w/2+s*228-14,78,28,16,5); g.fill(); g.fillStyle='#94a3b8'; g.fillRect(w/2+s*228-10,80,20,10); }
    }); FRAMES={}; return bodyC; }
  // bilen lite snett bakifrån: bakpartiet förskjuts och sidan (med framhjul) syns på svängens sida
  let FRAMES={};
  function carFrame(yaw){
    const rear=carBody(), q=Math.round(clamp(yaw,-1,1)*5)/5; if(FRAMES[q]) return FRAMES[q];
    const [,c1,c2]=CARCOL[cfg.color]||CARCOL[0], d=Math.sign(q), a=Math.abs(q), sx=1-.16*a, rx=60-q*52;
    return FRAMES[q]=mk(640,250,(g,w,h)=>{
      g.fillStyle='rgba(0,0,0,.38)'; g.beginPath(); g.ellipse(rx+260*sx+d*60*a,h-10,250+60*a,16,0,0,7); g.fill();
      if(a>0){
        const xr = d>0 ? rx+520*sx-26 : rx+26, xf = xr+d*175*a;
        // framhjul och bakhjulets sida
        g.fillStyle='#0b0b0f'; g.beginPath(); g.ellipse(xf-d*34*a,h-60,8+16*a,32,0,0,7); g.fill(); g.fillStyle='#a1a1aa'; g.beginPath(); g.ellipse(xf-d*34*a,h-60,3+7*a,15,0,0,7); g.fill();
        g.fillStyle='#0b0b0f'; g.beginPath(); g.ellipse(xr+d*16*a,h-46,6+10*a,36,0,0,7); g.fill();
        // sidan
        const gr=g.createLinearGradient(xr,0,xf,0); gr.addColorStop(0,c1); gr.addColorStop(1,c2);
        g.fillStyle=gr; g.beginPath(); g.moveTo(xr,98); g.quadraticCurveTo((xr+xf)/2,86,xf,92); g.quadraticCurveTo(xf+d*10*a,(92+h-84)/2,xf,h-84); g.lineTo(xf-d*8*a,h-80); g.quadraticCurveTo((xr+xf)/2,h-58,xr,h-54); g.closePath(); g.fill();
        g.strokeStyle='rgba(255,255,255,.35)'; g.lineWidth=3; g.beginPath(); g.moveTo(xr,102); g.quadraticCurveTo((xr+xf)/2,90,xf,96); g.stroke();
        g.strokeStyle='rgba(0,0,0,.25)'; g.lineWidth=2; g.beginPath(); g.moveTo(xr+d*48*a,100); g.lineTo(xr+d*46*a,h-60); g.stroke();
        g.fillStyle='rgba(0,0,0,.22)'; g.beginPath(); g.moveTo(xr,h-70); g.quadraticCurveTo((xr+xf)/2,h-76,xf,h-92); g.lineTo(xf,h-84); g.quadraticCurveTo((xr+xf)/2,h-58,xr,h-54); g.fill();
        // vindrutans sida och backspegel
        g.strokeStyle='rgba(203,213,225,.85)'; g.lineWidth=4; g.beginPath(); g.moveTo(d>0?rx+(520-44)*sx:rx+44*sx,92); g.lineTo(xr+d*70*a,70); g.stroke();
        g.fillStyle=c2; g.beginPath(); g.roundRect(xr+d*78*a-10,80,20,12,4); g.fill();
      }
      g.drawImage(rear,rx,0,520*sx,h);
    }); }
  function head(g,x,y,s,hair,kind,phase,shirt){
    if(kind==='dog'){ g.fillStyle='#a16207'; g.beginPath(); g.ellipse(x,y+26*s,20*s,16*s,0,0,7); g.fill();
      g.fillStyle='#c2410c'; g.beginPath(); g.ellipse(x,y,17*s,16*s,0,0,7); g.fill(); g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x-5*s,y-6*s,6*s,4*s,-.4,0,7); g.fill();
      g.fillStyle='#7c2d12'; for(const k of [-1,1]){ g.save(); g.translate(x+k*13*s,y-8*s); g.rotate(k*(.7+Math.sin(phase*1.9+k)*.45)); g.beginPath(); g.ellipse(0,11*s,7*s,15*s,0,0,7); g.fill(); g.restore(); } return; }
    // axlar och hals
    g.fillStyle=shirt; g.beginPath(); g.moveTo(x-30*s,y+60*s); g.quadraticCurveTo(x-30*s,y+24*s,x-8*s,y+20*s); g.lineTo(x+8*s,y+20*s); g.quadraticCurveTo(x+30*s,y+24*s,x+30*s,y+60*s); g.fill();
    g.fillStyle='#e8b48f'; g.fillRect(x-6*s,y+8*s,12*s,14*s);
    // hår bakifrån
    g.fillStyle=hair; g.beginPath(); g.ellipse(x,y,16*s,17.5*s,0,0,7); g.fill();
    g.fillStyle='#e8b48f'; for(const k of [-1,1]){ g.beginPath(); g.ellipse(x+k*16*s,y+2*s,3*s,5*s,0,0,7); g.fill(); }
    if(kind==='long'){ g.strokeStyle=hair; g.lineCap='round';
      for(let i=0;i<9;i++){ const a=(i-4)/4, w=Math.sin(phase*3.1+i*.9)*7*s; g.lineWidth=7*s; g.beginPath(); g.moveTo(x+a*12*s,y+4*s); g.quadraticCurveTo(x+a*18*s+w,y+22*s,x+a*24*s+w*1.8,y+34*s+Math.cos(phase*2.3+i)*5*s); g.stroke(); }
      g.lineWidth=3*s; g.strokeStyle='rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(x-6*s,y-8*s); g.quadraticCurveTo(x+2*s,y+6*s,x+(Math.sin(phase*3)*6)*s,y+26*s); g.stroke(); }
    else { g.fillStyle='rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(x,y+8*s,14*s,8*s,0,0,Math.PI); g.fill(); for(let i=0;i<5;i++){ g.fillStyle=hair; g.beginPath(); g.ellipse(x+(i-2)*6*s, y-15*s+Math.sin(phase*4+i)*1.5*s, 4*s, 4*s,0,0,7); g.fill(); } }
    g.fillStyle='rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(x-5*s,y-8*s,6*s,4*s,-.4,0,7); g.fill();
  }
  function drawPlayer(){
    const yaw=st.yaw||0, b=carFrame(yaw), q=Math.round(clamp(yaw,-1,1)*5)/5, a=Math.abs(q), sx=1-.16*a, rx=60-q*52;
    const cw=Math.min(W*.66, U*.98), ch=cw*b.height/520, pseg=findSeg(st.pos+PZ);
    const sp=st.speed/MAXS, off=st.x<-1||st.x>1;
    const bounce=(Math.sin(st.wave*24)*(off?3.5:.7)*sp + (st.bump>0?Math.sin(st.bump*40)*4:0))*cw/400;
    const up = pseg.p2.w.y>pseg.p1.w.y ? -ch*.015 : 0;
    const x=W/2, y=H-ch*.12+bounce+up;
    ctx.save(); ctx.translate(x,y); ctx.rotate(st.lean*.05 + Math.sin(st.spin)*(st.crash>0?.25:0)); if(st.crash>0) ctx.translate(Math.sin(st.spin*1.3)*cw*.06,0);
    const s=cw/520;
    // huvuden (före karossen så att sätena skymmer dem)
    const hx=st.lean*10*s + q*46*s;
    const dh=HAIR[cfg.dh]||HAIR[1], ph=HAIR[cfg.ph]||HAIR[0];
    ctx.save(); ctx.translate(-320*s,-ch);
    const DX=(rx+(260-66)*sx)*s+hx, PX=(rx+(260+66)*sx)*s+hx;
    if(cfg.pas==='kid' && st.cheer>0){ ctx.strokeStyle='#e8b48f'; ctx.lineWidth=11*s; ctx.lineCap='round'; const wv=Math.sin(st.wave*12)*10*s; ctx.beginPath(); ctx.moveTo(PX+24*s,40*s); ctx.quadraticCurveTo(PX+44*s,10*s,PX+40*s+wv,-30*s); ctx.stroke(); ctx.fillStyle='#e8b48f'; ctx.beginPath(); ctx.arc(PX+40*s+wv,-32*s,8*s,0,7); ctx.fill(); }
    if(cfg.pas!=='none') head(ctx,PX,cfg.pas==='dog'?22*s:12*s,s*1.25,ph[1],cfg.pas==='dog'?'dog':'long',st.hair,'#f472b6');
    head(ctx,DX,10*s,s*1.3,dh[1],'short',st.hair,'#f8fafc');
    if(st.cheer>0 && st.fin){ ctx.strokeStyle='#e8b48f'; ctx.lineWidth=11*s; ctx.lineCap='round'; const wv=Math.sin(st.wave*10)*8*s; ctx.beginPath(); ctx.moveTo(DX-24*s,40*s); ctx.quadraticCurveTo(DX-44*s,10*s,DX-40*s+wv,-30*s); ctx.stroke(); }
    ctx.drawImage(b,0,0,640*s,ch);
    const LX=px=>(rx+px*sx)*s;
    // bromsljus
    const brake=(keys.ArrowDown||keys.s||pad.b) && st.speed>0;
    if(brake||st.crash>0){ ctx.globalCompositeOperation='lighter'; for(const px of [70,118,402,450]){ const X=LX(px), gl=ctx.createRadialGradient(X,138*s,0,X,138*s,46*s); gl.addColorStop(0,'rgba(255,80,80,.9)'); gl.addColorStop(1,'rgba(255,0,0,0)'); ctx.fillStyle=gl; ctx.fillRect(X-46*s,138*s-46*s,92*s,92*s); } ctx.globalCompositeOperation='source-over'; }
    if(st.stage===4){ ctx.globalCompositeOperation='lighter'; for(const px of [70,118,402,450]){ ctx.fillStyle='rgba(255,60,60,.25)'; ctx.beginPath(); ctx.arc(LX(px),138*s,30*s,0,7); ctx.fill(); } ctx.globalCompositeOperation='source-over'; }
    ctx.restore(); ctx.restore();
  }

  /* ---------- HUD ---------- */
  const fmt=n=>Math.round(n).toLocaleString('sv-SE');
  function txt(t,x,y,size,col,align,stroke){ ctx.font=`700 ${size}px Fredoka, system-ui, sans-serif`; ctx.textAlign=align||'left'; ctx.textBaseline='top'; ctx.lineJoin='round';
    ctx.lineWidth=Math.max(3,size/6); ctx.strokeStyle=stroke||'rgba(0,0,0,.65)'; ctx.strokeText(t,x,y); ctx.fillStyle=col; ctx.fillText(t,x,y); }
  function hud(){
    const S=Math.min(W,H*1.3)/420, top=Math.max(8, (root&&root.dataset.sat?+root.dataset.sat:0))+6*S;
    txt('TID',14*S,top,13*S,'#fde68a');
    const tcol= st.time<=10 && !st.fin ? (Math.floor(st.time*4)%2?'#fff':'#ef4444') : '#facc15';
    txt(String(Math.ceil(st.time)),14*S,top+13*S,40*S,tcol);
    txt('POÄNG',W-14*S,top,13*S,'#a5f3fc','right'); txt(fmt(st.score),W-14*S,top+13*S,24*S,'#fff','right');
    // etapp och karta
    const pw=W*.36, px=W/2-pw/2, py=top+4*S; ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(px,py,pw,10*S,5*S); ctx.fill();
    const prog=clamp(st.pos/(segs.goal*SEG),0,1); for(let t=1;t<T.length;t++){ const q=stageStart[t]/segs.goal; ctx.fillStyle='#fff'; ctx.fillRect(px+pw*q-1,py,2,10*S); }
    const gr=ctx.createLinearGradient(px,0,px+pw,0); gr.addColorStop(0,'#38bdf8'); gr.addColorStop(.25,'#22c55e'); gr.addColorStop(.5,'#f97316'); gr.addColorStop(.75,'#e0f2fe'); gr.addColorStop(1,'#d946ef'); ctx.fillStyle=gr; ctx.beginPath(); ctx.roundRect(px,py,Math.max(10*S,pw*prog),10*S,5*S); ctx.fill();
    txt(`${st.stage+1}/5 · ${T[st.stage].name}`,W/2,py+13*S,12*S,'#fff','center');
    // hastighet
    const kmh=Math.round(st.speed/MAXS*KMH), bx=14*S, by=(root&&root.classList.contains('touch')) ? top+62*S : H-62*S;
    txt(String(kmh),bx,by,34*S,'#fff'); txt('km/h',bx+ (String(kmh).length*19+6)*S,by+18*S,12*S,'#cbd5e1');
    const bars=14; for(let i=0;i<bars;i++){ const on=i/bars < st.speed/MAXS; ctx.fillStyle=on?(i>10?'#ef4444':i>7?'#facc15':'#22c55e'):'rgba(255,255,255,.18)'; ctx.fillRect(bx+i*8*S,by+40*S,6*S,(6+i*.6)*S); }
    if(radio.cur>=0 && radio.showT>0){ ctx.globalAlpha=clamp(radio.showT,0,1); txt('📻 '+STATIONS[radio.cur].name,W-14*S,H-34*S,13*S,'#fde68a','right'); ctx.globalAlpha=1; }
    for(const p of st.pops){ ctx.globalAlpha=clamp(p.life,0,1); txt(p.txt,p.x,p.y,18*S,p.c,'center'); } ctx.globalAlpha=1;
    if(st.banner){ const b=st.banner, a=clamp(Math.min(b.t, 3.2-b.t+.3),0,1)*(b.t>8?1:1), y=H*.25; ctx.globalAlpha=clamp(b.t*2,0,1);
      txt(b.a,W/2,y,(b.c?34:30)*S,b.c?'#fde047':'#fff','center'); if(b.b) txt(b.b,W/2,y+38*S,14*S,'#e0f2fe','center'); ctx.globalAlpha=1; void a; }
    if(st.cd>0){ const n=Math.ceil(st.cd); const sz=(70+(st.cd%1)*40)*S; txt(n>3?'':String(n),W/2,H*.38,sz,n===1?'#22c55e':'#facc15','center'); }
    else if(st.cd>-1){ ctx.globalAlpha=clamp(1+st.cd,0,1); txt('KÖR!',W/2,H*.38,80*S,'#22c55e','center'); ctx.globalAlpha=1; st.cd-=1/60; }
  }

  /* ---------- ljud: motor, vind, däckskrik ---------- */
  const OUT=()=>{ if(!AC) return null; if(!AUD.bus){ AUD.bus=AC.createGain(); AUD.bus.gain.value=1; AUD.bus.connect(AC.destination); } return AUD.bus; };
  const AUD={bus:null};
  const silent=()=>typeof muted!=='undefined' && muted;
  const engine={ n:null,
    start(){ this.stop(); if(!AC || silent()) return; try{ const o1=AC.createOscillator(), o2=AC.createOscillator(), lp=AC.createBiquadFilter(), g=AC.createGain();
      o1.type='sawtooth'; o2.type='square'; lp.type='lowpass'; lp.frequency.value=700; g.gain.value=0; o1.connect(lp); o2.connect(lp); lp.connect(g).connect(OUT());
      const nz=AC.createBufferSource(); nz.buffer=noiseBuf(2); nz.loop=true; const wf=AC.createBiquadFilter(); wf.type='lowpass'; wf.frequency.value=900; const wg=AC.createGain(); wg.gain.value=0; nz.connect(wf).connect(wg).connect(OUT());
      const sq=AC.createBufferSource(); sq.buffer=noiseBuf(1.3); sq.loop=true; const sf=AC.createBiquadFilter(); sf.type='bandpass'; sf.frequency.value=2600; sf.Q.value=4; const sg=AC.createGain(); sg.gain.value=0; sq.connect(sf).connect(sg).connect(OUT());
      o1.start(); o2.start(); nz.start(); sq.start(); this.n={o1,o2,lp,g,wg,sg,nz,sq}; }catch(e){ this.n=null; } },
    set(sp,off,squeal,crash){ const n=this.n; if(!n) return; const t=AC.currentTime;
      const G=[0,.24,.44,.64,.82,1.01]; let gi=0; while(gi<G.length-2 && sp>G[gi+1]) gi++; const r=(sp-G[gi])/(G[gi+1]-G[gi]);
      const f=48+r*72+gi*9; n.o1.frequency.setTargetAtTime(f,t,.05); n.o2.frequency.setTargetAtTime(f*.5,t,.05); n.lp.frequency.setTargetAtTime(500+sp*1400,t,.1);
      n.g.gain.setTargetAtTime(silent()?0:.05+sp*.03,t,.1); n.wg.gain.setTargetAtTime(silent()?0:sp*sp*.07+(off?.04:0),t,.2); n.sg.gain.setTargetAtTime(silent()?0:(squeal||crash?.06:0),t,.05); },
    stop(){ const n=this.n; this.n=null; if(!n) return; try{ const t=AC.currentTime; n.g.gain.setTargetAtTime(0,t,.1); n.wg.gain.setTargetAtTime(0,t,.1); n.sg.gain.setTargetAtTime(0,t,.05); setTimeout(()=>{ try{ n.o1.stop(); n.o2.stop(); n.nz.stop(); n.sq.stop(); }catch(e){} },500); }catch(e){} }
  };
  const beep=(f,d)=>tone(f,d,'square',.07);
  const thud=()=>{ hit(0,160,.6,.12); tone(90,.18,'sine',.2,0,50); };
  const crashSnd=()=>{ hit(0,400,.8,.35); hit(.08,1200,.5,.3); tone(140,.5,'sawtooth',.08,0,40); };
  const whoosh=()=>{ hit(0,1800,.25,.25); };
  const jingle=()=>{ [784,988,1175,1568].forEach((f,i)=>tone(f,.22,'square',.06,i*.1)); };
  const fanfare=()=>{ [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,.32,'square',.06,i*.15)); };
  const sadSnd=()=>{ [494,466,440,392].forEach((f,i)=>tone(f,.4,'triangle',.08,i*.3)); };
  const boom=()=>{ hit(0,300,.5,.5); hit(.05,2600,.2,.4); };

  /* ---------- bilradion: tre egna låtar, spelas live med Web Audio ---------- */
  const N=m=>440*Math.pow(2,(m-69)/12);
  const STATIONS=[
    {name:'Radio Kvällssol', bpm:122, lead:'square', arp:true,
      chords:[[57,61,64],[54,57,61],[50,54,57],[52,56,59],[50,54,57],[52,56,59],[54,57,61],[52,56,59]],
      drums:{k:'x...x...x...x...', s:'....x.......x...', h:'..x...x...x...x.', c:'x.x.x.x.x.x.x.x.'},
      mel:[[0,76,4],[4,76,2],[6,78,2],[8,81,6],[14,80,2],[16,78,4],[20,76,2],[22,73,2],[24,76,8],[32,74,4],[36,76,2],[38,78,2],[40,81,4],[44,83,4],[48,80,6],[54,78,2],[56,76,8],
        [64,81,2],[66,83,2],[68,85,4],[72,83,4],[76,81,4],[80,83,6],[86,81,2],[88,80,8],[96,76,2],[98,78,2],[100,80,4],[104,81,4],[108,80,4],[112,78,4],[116,80,4],[120,81,8]]},
    {name:'Fjällvind FM', bpm:136, lead:'sawtooth', bass16:true,
      chords:[[50,53,57],[46,50,53],[48,52,55],[45,48,52],[50,53,57],[46,50,53],[53,57,60],[48,52,55]],
      drums:{k:'x.....x...x.....', s:'....x.......x...', h:'x.x.x.x.x.x.x.x.', c:'................'},
      mel:[[0,74,3],[3,77,3],[6,81,2],[8,79,4],[12,77,4],[16,74,6],[22,72,2],[24,74,8],[32,76,3],[35,79,3],[38,84,2],[40,83,4],[44,79,4],[48,81,8],[56,76,4],[60,79,4],
        [64,86,4],[68,84,2],[70,81,2],[72,84,4],[76,81,4],[80,82,6],[86,81,2],[88,77,8],[96,77,3],[99,81,3],[102,84,2],[104,86,4],[108,84,4],[112,83,4],[116,79,4],[120,76,8]]},
    {name:'Midnatt 104', bpm:100, lead:'triangle', soft:true,
      chords:[[53,57,60,64],[52,55,59,62],[50,53,57,60],[48,52,55,59],[46,50,53,57],[45,48,52,55],[43,46,50,53],[48,52,55,58]],
      drums:{k:'x.........x.....', s:'....x.......x...', h:'x.x.x.x.x.x.x.x.', c:'................'},
      mel:[[0,72,6],[6,74,2],[8,76,4],[12,79,4],[16,76,8],[24,74,4],[28,71,4],[32,72,6],[38,74,2],[40,77,4],[44,76,4],[48,72,12],[60,74,4],
        [64,77,6],[70,76,2],[72,74,4],[76,72,4],[80,76,8],[88,72,8],[96,74,4],[100,77,4],[104,81,4],[108,79,4],[112,76,12],[124,74,4]]}
  ];
  const radio={cur:-1, timer:null, next:0, step:0, out:null, showT:0, echo:null,
    play(i){ this.stop(); this.cur=i; this.showT=3; if(i<0 || i>=STATIONS.length || !AC) return;
      try{ this.out=AC.createGain(); this.out.gain.value=silent()?0:.42; this.out.connect(OUT());
        const d=AC.createDelay(1), fb=AC.createGain(), wet=AC.createGain(); d.delayTime.value=60/STATIONS[i].bpm*.75; fb.gain.value=.3; wet.gain.value=.25; d.connect(fb).connect(d); d.connect(wet).connect(this.out); this.echo=d;
        this.next=AC.currentTime+.15; this.step=0; this.timer=setInterval(()=>this.sched(),90); this.sched(); }catch(e){} },
    stop(){ clearInterval(this.timer); this.timer=null; const o=this.out; this.out=null; if(o){ try{ o.gain.setTargetAtTime(0,AC.currentTime,.08); setTimeout(()=>{ try{ o.disconnect(); }catch(e){} },600); }catch(e){} } },
    sched(){ const S=STATIONS[this.cur]; if(!S || !this.out) return; const dt=60/S.bpm/4;
      while(this.next<AC.currentTime+.25){ const st16=this.step%128, bar=Math.floor(st16/16), s=st16%16, t=this.next, ch=S.chords[bar];
        if(S.drums.k[s]==='x') kick(t,this.out); if(S.drums.s[s]==='x') snare(t,this.out,S.soft); if(S.drums.h[s]==='x') hat(t,this.out,.05,S.soft?.025:.04); else if(S.drums.c[s]==='x') hat(t,this.out,.02,.018);
        if(s===0) ch.forEach(m=>padN(N(m),t,dt*16,this.out,S.soft));
        const root=ch[0]-12; if(S.bass16) bass(N(s%4===3?root+12:root),t,dt*.9,this.out); else if(s%2===0) bass(N(s===6||s===14?root+12:root),t,dt*1.8,this.out);
        if(S.arp && s%2===1) note(N(ch[(s>>1)%ch.length]+24),t,dt*1.6,'triangle',.022,this.out);
        for(const [ms,m,l] of S.mel) if(ms===st16) note(N(m),t,dt*l*.95,S.lead,S.soft?.07:.045,this.out,this.echo,true);
        this.next+=dt; this.step++; } }
  };
  function env(g,t,a,v,dur,r){ g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+a); g.gain.setValueAtTime(v,t+Math.max(a,dur-r)); g.gain.linearRampToValueAtTime(0,t+dur); }
  function note(f,t,dur,type,vol,out,echo,vib){ try{ const o=AC.createOscillator(), g=AC.createGain(), lp=AC.createBiquadFilter(); o.type=type; o.frequency.value=f; lp.type='lowpass'; lp.frequency.value=type==='triangle'?5000:2600;
    if(vib){ const l=AC.createOscillator(), lg=AC.createGain(); l.frequency.value=5.5; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*.008,t+Math.min(.3,dur)); l.connect(lg).connect(o.frequency); l.start(t); l.stop(t+dur+.05); }
    env(g,t,.012,vol,dur,Math.min(.08,dur*.4)); o.connect(lp).connect(g).connect(out); if(echo) g.connect(echo); o.start(t); o.stop(t+dur+.05); }catch(e){} }
  function padN(f,t,dur,out,soft){ for(const det of [-6,6]){ const o=AC.createOscillator(), g=AC.createGain(), lp=AC.createBiquadFilter(); o.type=soft?'triangle':'sawtooth'; o.frequency.value=f; o.detune.value=det; lp.type='lowpass'; lp.frequency.value=soft?1600:1100;
    env(g,t,.08,soft?.028:.014,dur,.2); o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t+dur+.05); } }
  function bass(f,t,dur,out){ const o=AC.createOscillator(), g=AC.createGain(), lp=AC.createBiquadFilter(); o.type='sawtooth'; o.frequency.value=f; lp.type='lowpass'; lp.Q.value=6; lp.frequency.setValueAtTime(1400,t); lp.frequency.exponentialRampToValueAtTime(220,t+dur);
    env(g,t,.005,.11,dur,.03); o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t+dur+.05); }
  function kick(t,out){ const o=AC.createOscillator(), g=AC.createGain(); o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(42,t+.13); g.gain.setValueAtTime(.55,t); g.gain.exponentialRampToValueAtTime(.001,t+.3); o.connect(g).connect(out); o.start(t); o.stop(t+.32); }
  function snare(t,out,soft){ if(!NB) NB=noiseBuf(1); const s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain(); s.buffer=NB; f.type='bandpass'; f.frequency.value=soft?2600:1800; f.Q.value=.8;
    g.gain.setValueAtTime(soft?.12:.28,t); g.gain.exponentialRampToValueAtTime(.001,t+(soft?.08:.18)); s.connect(f).connect(g).connect(out); s.start(t,Math.random()*.5,.25); if(!soft) note(190,t,.08,'triangle',.08,out); }
  function hat(t,out,dur,vol){ if(!NB) NB=noiseBuf(1); const s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain(); s.buffer=NB; f.type='highpass'; f.frequency.value=7500; g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); s.connect(f).connect(g).connect(out); s.start(t,Math.random()*.5,dur+.02); }

  /* ---------- slinga ---------- */
  function loop(now){
    raf=0; if(view!=='race'){ return; }
    const dt=Math.min(.05,(now-lastT)/1000||0); lastT=now; acc+=dt;
    if(st){ let n=0; while(acc>=1/60 && n<4){ update(1/60); acc-=1/60; n++; } if(n===4) acc=0; draw(); }
    if(radio.showT>0) radio.showT-=dt;
    raf=requestAnimationFrame(loop);
  }
  function startLoop(){ if(!raf){ lastT=performance.now(); raf=requestAnimationFrame(loop); } }
  function stop(){ if(raf) cancelAnimationFrame(raf); raf=0; engine.stop(); radio.stop(); for(const k in pad) pad[k]=false; if(typeof musicOn!=='undefined' && musicOn && typeof startMusic==='function') setTimeout(()=>{ if(view!=='race') startMusic(); },400); }

  function end(won){
    if(overlay==='over') return;
    const s=stats(); st.won=won; if(won) s.fin++;
    const sc=Math.round(st.score); st.rec=sc>s.best; if(st.rec) s.best=sc;
    const entry={n:(lsGet('ry_name')||'Du').slice(0,14), s:sc, st:won?6:st.stage+1, d:Date.now(), df:cfg.diff};
    s.hs=[...(s.hs||[]), entry].sort((a,b)=>b.s-a.s).slice(0,10); st.rank=s.hs.indexOf(entry); saveStats(s);
    engine.set(0,false,false,false); setTimeout(()=>engine.stop(),300);
    overlay='over'; showOverlay();
  }

  /* ---------- skal: HTML, menyer och kontroller ---------- */
  const TOUCH = typeof FINE_PTR!=='undefined' ? !FINE_PTR : ('ontouchstart' in window);
  function html(){
    return `<div id="raceRoot" class="rc ${TOUCH?'touch':''}"><canvas id="rcc"></canvas>
      <div class="rc-top"><button class="rc-ib" data-act="lobby" aria-label="Lobby">‹</button><button class="rc-ib" data-rc="radio" aria-label="Byt radiokanal">📻</button><button class="rc-ib" data-rc="pause" aria-label="Paus">⏸</button></div>
      <div class="rc-pad"><div class="rc-l"><button data-p="l" aria-label="Vänster">◀</button><button data-p="r" aria-label="Höger">▶</button></div>
        <div class="rc-r"><button data-p="b" class="br" aria-label="Broms">BROMS</button><button data-p="g" class="gs ${cfg.auto?'hide':''}" aria-label="Gas">GAS</button></div></div>
      <div id="rcOv" class="rc-ov"></div></div>`;
  }
  const sw=(k,v,lab,on,style)=>`<button class="rc-ch ${on?'on':''}" data-rc="set" data-k="${k}" data-v="${v}" ${style?`style="${style}"`:''}>${lab}</button>`;
  function hsHTML(hl){ const s=stats(); if(!s.hs || !s.hs.length) return '<p class="rc-dim">Ingen har kört än – bli först på topplistan!</p>';
    return `<ol class="rc-hs">${s.hs.map((e,i)=>`<li class="${i===hl?'me':''}"><span>${i+1}.</span><b>${esc(e.n)}</b><em>${e.st>5?'🏁':'Etapp '+e.st}</em><i>${fmt(e.s)}</i></li>`).join('')}</ol>`; }
  function showOverlay(){
    const o=document.getElementById('rcOv'); if(!o) return;
    o.classList.toggle('show',!!overlay); root && root.classList.toggle('playing',!overlay);
    if(!overlay){ o.innerHTML=''; return; }
    const s=stats();
    if(overlay==='menu'){
      o.innerHTML=`<div class="rc-card"><div class="rc-logo">SOMMAR<span>VÄGEN</span></div><div class="rc-sub">En roadtrip genom Sverige · 5 etapper</div>
        <button class="rc-go" data-rc="go">🏁 KÖR!</button>
        <div class="rc-row"><label>Bil</label><div>${CARCOL.map(([n,c],i)=>sw('color',i,'',cfg.color===i,`background:${c}`)).join('')}</div></div>
        <div class="rc-row"><label>Passagerare</label><div>${PAS.map(([n,v])=>sw('pas',v,n,cfg.pas===v)).join('')}</div></div>
        <div class="rc-row"><label>Ditt hår</label><div>${HAIR.map(([n,c],i)=>sw('dh',i,'',cfg.dh===i,`background:${c}`)).join('')}</div></div>
        ${cfg.pas==='kid'?`<div class="rc-row"><label>Kompisens hår</label><div>${HAIR.map(([n,c],i)=>sw('ph',i,'',cfg.ph===i,`background:${c}`)).join('')}</div></div>`:''}
        <div class="rc-row"><label>Bilradion</label><div>${STATIONS.map((x,i)=>sw('radio',i,x.name,cfg.radio===i)).join('')}${sw('radio',-1,'Av',cfg.radio===-1)}</div></div>
        <div class="rc-row"><label>Svårighet</label><div>${Object.entries(DIFF).map(([k,d])=>sw('diff',k,d.lab,cfg.diff===k)).join('')}</div></div>
        <div class="rc-row"><label>Gas</label><div>${sw('auto',1,'Automatisk',cfg.auto)}${sw('auto',0,'Själv',!cfg.auto)}</div></div>
        <details class="rc-det"><summary>🏆 Topplista${s.best?` · rekord ${fmt(s.best)}`:''}</summary>${hsHTML(-1)}</details>
        <div class="rc-help">${TOUCH?'◀ ▶ styr · BROMS bromsar':'← → styr · ↑ gas · ↓ broms · P paus'} · Hinn till nästa checkpoint innan tiden tar slut. Kör nära andra bilar för bonus!</div></div>`;
    } else if(overlay==='pause'){
      o.innerHTML=`<div class="rc-card"><div class="rc-logo sm">PAUS</div><div class="rc-sub">${T[st.stage].name} · ${fmt(st.score)} poäng</div>
        <button class="rc-go" data-rc="resume">▶ Fortsätt</button><button class="rc-alt" data-rc="restart">↻ Börja om</button><button class="rc-alt" data-rc="menu">☰ Meny</button></div>`;
    } else if(overlay==='over'){
      const done=st.won;
      o.innerHTML=`<div class="rc-card"><div class="rc-logo sm">${done?'DU KOM I MÅL!':'TIDEN TOG SLUT'}</div>
        <div class="rc-sub">${done?'Hela vägen genom Sverige 🇸🇪':`Du kom till etapp ${st.stage+1}: ${T[st.stage].name}`}</div>
        <div class="rc-score">${fmt(st.score)}<small>poäng${st.rec?' · NYTT REKORD! 🏆':''}</small></div>
        <div class="rc-sub">${st.nm} nära ögat · ${st.cps} checkpoints${done?` · tidsbonus ${fmt(st.bonus||0)}`:''}</div>
        ${hsHTML(st.rank)}
        <button class="rc-go" data-rc="go">↻ Kör igen</button><button class="rc-alt" data-rc="menu">☰ Meny</button><button class="rc-alt" data-act="lobby">🏠 Lobby</button></div>`;
      if(st.rec || done) { try{ celebrate && celebrate(); }catch(e){} }
    }
  }
  function fit(){
    if(!cv) return; const r=root.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1);
    const cw=Math.max(200,r.width), chh=Math.max(200,r.height); const q=Math.min(1, 900/Math.max(cw,chh));   // begränsa upplösningen för jämn fart
    cv.width=Math.round(cw*dpr*q); cv.height=Math.round(chh*dpr*q); cv.style.width=cw+'px'; cv.style.height=chh+'px';
    W=cv.width; H=cv.height; const port=H>W*1.1; HZ = port ? .47 : .5; U= port ? W*.64 : Math.max(W, H*.8)/2;
    try{ root.dataset.sat=String(parseFloat(getComputedStyle(root).getPropertyValue('--sat'))*dpr*q||0); }catch(e){}
    if(st) draw();
  }
  function mount(){
    root=document.getElementById('raceRoot'); cv=document.getElementById('rcc'); ctx=cv.getContext('2d');
    if(!built){ buildSprites(); buildBG(); built=true; }
    if(typeof stopMusic==='function') stopMusic();
    if(!st){ build(cfg.diff); st={pos:SEG*10, x:0, speed:0, time:DIFF[cfg.diff].t, score:0, stage:0, sky:0, near:0, crash:0, spin:0, bump:0, shake:0, pops:[], parts:[], wave:0, nm:0, cps:0, cd:0, steer:0, lean:0, cheer:0, hair:0, prevT:0, tFade:1, demo:true}; overlay='menu'; }
    else if(!overlay){ overlay='pause'; }
    fit(); showOverlay(); startLoop();
    // håll-knappar
    root.querySelectorAll('[data-p]').forEach(b=>{
      const k=b.dataset.p, on=e=>{ e.preventDefault(); unlockAudio(); if(typeof stopMusic==='function') stopMusic(); pad[k]=true; b.classList.add('on'); try{ b.setPointerCapture(e.pointerId); }catch(_){} }, off=()=>{ pad[k]=false; b.classList.remove('on'); };
      b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off); b.addEventListener('pointercancel',off); b.addEventListener('lostpointercapture',off);
      b.addEventListener('contextmenu',e=>e.preventDefault());
    });
    // dra på skärmen för att styra (tumme på vänster halva)
    let drag=null;
    cv.addEventListener('pointerdown',e=>{ if(overlay) return; drag={x:e.clientX}; try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
    cv.addEventListener('pointermove',e=>{ if(!drag) return; const d=e.clientX-drag.x; pad.l=d<-12; pad.r=d>12; });
    const up=()=>{ if(drag){ drag=null; pad.l=pad.r=false; } }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  }
  window.addEventListener('resize',()=>{ if(view==='race') requestAnimationFrame(fit); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && view==='race'){ if(st && !overlay && !st.demo){ overlay='pause'; showOverlay(); } engine.stop(); radio.stop(); } });
  document.addEventListener('keydown',e=>{
    if(view!=='race') return; if(/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||'')) return;
    if(e.key===' '||e.key.startsWith('Arrow')) e.preventDefault();
    if(e.key==='p'||e.key==='P'||e.key==='Escape'){ if(overlay==='pause') resume(); else if(!overlay){ overlay='pause'; showOverlay(); engine.stop(); radio.stop(); } return; }
    if(e.key==='Enter' && (overlay==='menu'||overlay==='over')){ unlockAudio(); newGame(); return; }
    keys[e.key.length===1?e.key.toLowerCase():e.key]=true;
  });
  document.addEventListener('keyup',e=>{ keys[e.key.length===1?e.key.toLowerCase():e.key]=false; });
  function resume(){ overlay=null; showOverlay(); engine.start(); radio.play(cfg.radio); lastT=performance.now(); }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-rc]'); if(!b || view!=='race') return; unlockAudio(); if(typeof stopMusic==='function') stopMusic();
    const a=b.dataset.rc;
    if(a==='go'){ newGame(); }
    else if(a==='pause'){ if(overlay==='pause') resume(); else if(!overlay){ overlay='pause'; showOverlay(); engine.stop(); radio.stop(); } }
    else if(a==='resume') resume();
    else if(a==='restart') newGame();
    else if(a==='menu'){ overlay='menu'; engine.stop(); radio.stop(); showOverlay(); }
    else if(a==='radio'){ cfg.radio = cfg.radio+1>=STATIONS.length ? -1 : cfg.radio+1; saveCfg(); if(!overlay) radio.play(cfg.radio); radio.cur=cfg.radio; radio.showT=3; if(cfg.radio<0) toast('📻 Radion är av'); if(overlay==='menu') showOverlay(); }
    else if(a==='set'){ const k=b.dataset.k, v=b.dataset.v; cfg[k]= k==='diff'||k==='pas' ? v : k==='auto' ? v==='1' : +v; saveCfg();
      if(k==='radio' && overlay==='menu'){ radio.play(cfg.radio); setTimeout(()=>{ if(overlay==='menu') radio.stop(); },6000); }
      if(k==='auto') root.querySelector('.gs')?.classList.toggle('hide',cfg.auto);
      showOverlay(); }
  });

  /* ---------- stil ---------- */
  const css=document.createElement('style'); css.textContent=`
.rc{position:fixed;top:0;right:0;bottom:0;left:0;z-index:3;background:#000;overflow:hidden;--sat:env(safe-area-inset-top);touch-action:none;-webkit-user-select:none;user-select:none}
#rcc{display:block;width:100%;height:100%}
.rc-top{position:absolute;top:0;left:0;right:0;height:0}
.rc-top .rc-ib{position:absolute;top:calc(max(8px,env(safe-area-inset-top)) + 64px)}
.rc-top .rc-ib[data-act=lobby]{left:10px;top:max(8px,env(safe-area-inset-top))}
.rc.playing .rc-top .rc-ib[data-act=lobby]{display:none}
.rc-top .rc-ib[data-rc=radio]{right:62px}
.rc-top .rc-ib[data-rc=pause]{right:10px}
.rc:not(.playing) .rc-top .rc-ib[data-rc]{display:none}
.rc-ib{width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,.35);color:#fff;font-size:20px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.2)}
.rc-pad{position:absolute;left:0;right:0;bottom:max(10px,env(safe-area-inset-bottom));display:none;justify-content:space-between;padding:0 12px;pointer-events:none}
.rc.touch.playing .rc-pad{display:flex}
.rc-pad>div{display:flex;gap:10px;pointer-events:auto}
.rc-pad button{width:76px;height:76px;border-radius:50%;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.35);color:#fff;font-size:26px;font-weight:700;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);touch-action:none}
.rc-pad button.on{background:rgba(255,255,255,.4);transform:scale(.95)}
.rc-pad .br{font-size:14px;background:rgba(239,68,68,.35)}
.rc-pad .gs{font-size:15px;background:rgba(34,197,94,.4)}
.rc-pad .hide{display:none}
.rc.touch.playing .rc-pad{bottom:max(10px,env(safe-area-inset-bottom))}
.rc-ov{position:absolute;top:0;right:0;bottom:0;left:0;display:none;align-items:center;justify-content:center;padding:14px;background:radial-gradient(ellipse at 50% 40%,rgba(0,0,0,.15),rgba(0,0,0,.55));overflow:auto}
.rc-ov.show{display:flex}
.rc-card{width:min(420px,96%);max-height:96%;overflow:auto;padding:20px 16px 16px;border-radius:24px;text-align:center;color:#fff;background:linear-gradient(180deg,rgba(30,27,75,.92),rgba(76,29,149,.9) 60%,rgba(190,24,93,.88));border:1px solid rgba(255,255,255,.25);box-shadow:0 20px 60px rgba(0,0,0,.5)}
.rc-logo{font:700 44px/1 Fredoka,system-ui,sans-serif;letter-spacing:2px;background:linear-gradient(180deg,#fef08a,#fb923c 55%,#f43f5e);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 rgba(0,0,0,.35));font-style:italic}
.rc-logo span{display:block;font-size:.8em;background:linear-gradient(180deg,#a5f3fc,#38bdf8 60%,#6366f1);-webkit-background-clip:text;background-clip:text;color:transparent}
.rc-logo.sm{font-size:30px}
.rc-sub{color:#e0e7ff;font-size:14px;margin:6px 0 10px}
.rc-dim{color:#c7d2fe;font-size:13px}
.rc-go{display:block;width:100%;margin:10px 0;padding:14px;border-radius:16px;font-size:20px;font-weight:700;color:#fff;background:linear-gradient(135deg,#f97316,#e11d48);box-shadow:0 6px 0 #9f1239,0 10px 24px rgba(0,0,0,.35)}
.rc-go:active{transform:translateY(3px);box-shadow:0 3px 0 #9f1239}
.rc-alt{display:block;width:100%;margin:8px 0;padding:11px;border-radius:14px;font-size:15px;font-weight:600;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25)}
.rc-row{display:flex;align-items:center;gap:8px;margin:8px 0;text-align:left}
.rc-row label{width:92px;flex:none;font-size:12.5px;color:#c7d2fe}
.rc-row>div{display:flex;flex-wrap:wrap;gap:6px}
.rc-ch{min-width:30px;height:30px;padding:0 10px;border-radius:999px;font-size:12.5px;color:#fff;background:rgba(255,255,255,.12);border:2px solid transparent}
.rc-ch[style]{padding:0;width:30px}
.rc-ch.on{border-color:#fde047;background-color:rgba(253,224,71,.25)}
.rc-ch[style].on{box-shadow:0 0 0 2px #fde047}
.rc-det{margin-top:8px;text-align:left;font-size:14px}
.rc-det summary{cursor:pointer;color:#fde68a}
.rc-hs{list-style:none;margin:8px 0;padding:0;text-align:left;font-size:14px}
.rc-hs li{display:flex;gap:8px;padding:5px 8px;border-radius:8px}
.rc-hs li:nth-child(odd){background:rgba(255,255,255,.06)}
.rc-hs li.me{background:rgba(253,224,71,.3)}
.rc-hs span{width:22px;color:#c7d2fe}.rc-hs b{flex:1;font-weight:600}.rc-hs em{color:#c7d2fe;font-style:normal;font-size:12px}.rc-hs i{font-style:normal;color:#fde047;font-weight:700;min-width:70px;text-align:right}
.rc-score{font:700 46px/1 Fredoka,sans-serif;color:#fde047;margin:8px 0}
.rc-score small{display:block;font-size:14px;color:#fff;font-weight:500;margin-top:4px}
.rc-help{font-size:12px;color:#c7d2fe;margin-top:12px;line-height:1.45}
`; document.head.appendChild(css);

  return {html, mount, stop, open(){ closeModal(); view='race'; render(); }, stats,
    __test: (typeof DEV!=='undefined' && DEV) ? {draw:()=>draw(), state:()=>st, segs:()=>segs, go:()=>newGame(), cfg:()=>cfg, sim:sec=>{ for(let i=0;i<sec*60;i++) update(1/60); return st; }, overlay:()=>overlay} : undefined};
})();
function openRace(){ RACE.open(); }
