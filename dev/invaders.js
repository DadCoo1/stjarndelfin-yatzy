/* =====================================================================
   invaders.js – Space Attack, ensamspel med oändligt många nivåer
   (svårighetsgrad ökar mjukt upp till nivå 100 och fortsätter sedan)
   ===================================================================== */
'use strict';
const INV = (()=>{
  const W=400, H=600;
  let cv=null, ctx=null, raf=0, last=0, st=null, keys={}, touch=null, paused=false, overlay='menu', shake=0, dpr=1;
  const save=()=>{ try{ return JSON.parse(lsGet('ry_inv'))||{best:0,maxLevel:1,kills:0,games:0} }catch(e){ return {best:0,maxLevel:1,kills:0,games:0} } };
  const store=o=>lsSet('ry_inv',JSON.stringify(o));
  /* ---------- pixelsprites (11×8, två bildrutor) ---------- */
  // Egna figurer för Space Attack: snäckan, sjöstjärnan, ögonmaneten, raketen och ringskeppet
  const SPR={
    a:[['00000111000','00011111100','00111001110','01110110111','01101111011','01111111111','00111111110','01100000011'],
       ['00000111000','00011111100','00111001110','01110110111','01101111011','01111111111','00111111110','00110001100']],
    b:[['00000100000','00001110000','11111111111','01111011110','00111111100','00110001100','01100000110','11000000011'],
       ['00000100000','10001110001','01111111110','00111011100','00111111100','00110001100','00110001100','00100000100']],
    c:[['00011111000','00111111100','01110001110','01100100110','01110001110','00111111100','00101010100','01010101010'],
       ['00011111000','00111111100','01110001110','01100100110','01110001110','00111111100','01010101010','00101010100']],
    p:[['00000100000','00001110000','00011011000','00011111000','00111111100','01111111110','11011111011','10001010001']],
    u:[['00000111100000','00011111111000','01111111111110','11101101101111','01111111111110','00011000011000','00110000001100']]
  };
  const CACHE={};
  function sprite(key,frame,color){
    const k=key+frame+color; if(CACHE[k]) return CACHE[k];
    const rows=SPR[key][frame], w=rows[0].length, h=rows.length, c=document.createElement('canvas'); c.width=w*3; c.height=h*3;
    const x=c.getContext('2d'); x.fillStyle=color; rows.forEach((r,y)=>[...r].forEach((b,i)=>{ if(b==='1') x.fillRect(i*3,y*3,3,3); }));
    return CACHE[k]=c;
  }
  /* ---------- ljud ---------- */
  const S={ shoot(){ tone(880,.07,'square',.035,0,440); }, pop(){ hit(0,1400,.35,.08); tone(200,.1,'square',.04,0,80); },
    boom(){ hit(0,200,.8,.35); tone(90,.4,'sawtooth',.08,0,30); }, hurt(){ hit(0,300,.9,.5); tone(300,.6,'sawtooth',.1,0,40); },
    power(){ [660,880,1320].forEach((f,i)=>tone(f,.12,'sine',.08,i*.07)); }, level(){ [523,659,784,1046,1318].forEach((f,i)=>tone(f,.18,'triangle',.08,i*.08)); },
    ufo(){ tone(500,.25,'sine',.03,0,700); }, march(n){ tone([110,98,87,82][n%4],.09,'square',.045); } };
  /* ---------- nivåer ---------- */
  function levelCfg(n){
    const t=Math.min(n,100)/100, over=Math.max(0,n-100);
    const rows=Math.min(3+Math.floor(n/5),6), cols=Math.min(6+Math.floor(n/7),10);
    return { n, rows, cols, boss:n%10===0,
      speed: 18 + t*120 + over*0.4, step: 10 + t*8, fire: Math.max(.22, 1.5 - t*1.15 - over*0.004), bspeed: 150 + t*170 + over*0.5,
      startY: 70 + Math.min(n,60)*0.7, armor: n>=12 ? Math.min(3, 1+Math.floor((n-8)/25)) : 1, shields: n<35?4:n<70?3:2,
      pattern: n%6, aimed: n>=20 ? Math.min(.6,(n-15)/100) : 0 };
  }
  function mask(p,r,c,R,C){ // formationsmönster
    if(p===1) return (r+c)%2===0 || r===R-1;
    if(p===2){ const mid=(C-1)/2; return Math.abs(c-mid) <= r+1.5; }
    if(p===3){ const mid=(C-1)/2, mr=(R-1)/2; return Math.abs(c-mid)/mid + Math.abs(r-mr)/Math.max(mr,1) <= 1.15; }
    if(p===4) return c%3!==1 || r%2===0;
    if(p===5) return !(r===1 && c>1 && c<C-2);
    return true;
  }
  // pågående runda sparas, så att den finns kvar om mobilen stänger appen
  const RUN='ry_inv_run';
  function saveRun(){ if(st && st.live && st.lives>0 && st.level) lsSet(RUN, JSON.stringify({level:st.level, score:Math.round(st.score), lives:st.lives, kills:st.kills||0, startLevel:st.startLevel||1, t:Date.now()})); }
  function clearRun(){ lsSet(RUN,''); }
  function loadRun(){ try{ const r=JSON.parse(lsGet(RUN)); return r && Number.isInteger(r.level) && r.level>=1 && r.level<=9999 && Number.isInteger(r.lives) && r.lives>0 && r.lives<=6 && Number.isFinite(r.score) && Date.now()-r.t<14*864e5 ? r : null; }catch(e){ return null; } }
  function newLevel(n){
    const L=levelCfg(n); st.resetting=false; st.level=n; setTimeout(saveRun,0); st.cfg=L; st.aliens=[]; st.ab=[]; st.pb=[]; st.drops=[]; st.ufo=null; st.boss=null; st.dir=1; st.fireT=1.2; st.marchT=0; st.march=0; st.frame=0; st.frameT=0; st.banner=1.6;
    const sw=33, sh=28, gx=(W-(L.cols-1)*sw)/2;
    if(!L.boss){
      for(let r=0;r<L.rows;r++) for(let c=0;c<L.cols;c++){ if(!mask(L.pattern,r,c,L.rows,L.cols)) continue;
        const type = r===0 ? 'c' : r<=2 ? 'a' : 'b';
        const hp = r===0 ? L.armor : (L.armor>1 && r===1 ? L.armor-1 : 1);
        st.aliens.push({x:gx+c*sw, y:L.startY+r*sh, type, hp, max:hp, pts:type==='c'?30:type==='a'?20:10, alive:true}); }
    } else {
      const bhp=40+n*3;
      st.boss={x:W/2, y:110, hp:bhp, max:bhp, t:0, vx:60+Math.min(n,100)*1.2, fireT:1.5};
      for(let c=0;c<6;c++) st.aliens.push({x:W/2-82+c*33, y:190, type:'b', hp:1, max:1, pts:10, alive:true});
    }
    // sköldar
    st.shields=[]; const ns=L.shields; for(let k=0;k<ns;k++){ const cx=(W/(ns+1))*(k+1); for(let y=0;y<4;y++) for(let x=0;x<8;x++){ if((y===3&&(x===2||x===3||x===4||x===5))||(y===0&&(x===0||x===7))) continue; st.shields.push({x:cx-24+x*6, y:H-120+y*6, hp:3}); } }
  }
  function newGame(lv){
    const sv=save(); sv.games++; store(sv); if(typeof srvStat==='function') srvStat('game',{game:'inv', title:'Space Attack', mode:'solo'});
    st={score:0, lives:3, p:{x:W/2, y:H-46, cd:0, inv:2}, pow:{double:0,rapid:0,shield:0}, parts:[], stars:makeStars(), kills:0, startLevel:lv, live:true};
    newLevel(lv); overlay=null; paused=false; showOverlay(); hud(); start();
  }
  function makeStars(){ const a=[]; for(let i=0;i<90;i++) a.push({x:Math.random()*W, y:Math.random()*H, z:.3+Math.random()*1.7}); return a; }
  /* ---------- uppdatering ---------- */
  function update(dt){
    const L=st.cfg, p=st.p;
    st.stars.forEach(s=>{ s.y+=s.z*18*dt; if(s.y>H){ s.y=0; s.x=Math.random()*W; } });
    if(st.banner>0) st.banner-=dt;
    // spelare
    let mv=0; if(keys.ArrowLeft||keys.a||keys.A) mv-=1; if(keys.ArrowRight||keys.d||keys.D) mv+=1;
    if(touch){ const d=touch.x-p.x; p.x+=Math.sign(d)*Math.min(Math.abs(d), 420*dt); } else p.x+=mv*260*dt;
    p.x=Math.max(18,Math.min(W-18,p.x)); p.cd-=dt; if(p.inv>0) p.inv-=dt;
    const firing = keys[' '] || keys.Space || !!touch;
    if(firing && p.cd<=0 && st.banner<1.2){ const rate=st.pow.rapid>0?.13:.34; p.cd=rate;
      if(st.pow.double>0){ st.pb.push({x:p.x-7,y:p.y-12,vx:-25},{x:p.x+7,y:p.y-12,vx:25}); } else st.pb.push({x:p.x,y:p.y-12,vx:0}); S.shoot(); }
    for(const k of ['double','rapid']) if(st.pow[k]>0) st.pow[k]-=dt;
    st.pb.forEach(b=>{ b.y-=480*dt; b.x+=b.vx*dt; }); st.pb=st.pb.filter(b=>b.y>-10);
    // formation
    const alive=st.aliens.filter(a=>a.alive);
    st.frameT+=dt;
    if(alive.length){
      const total=st.aliens.length, frac=alive.length/Math.max(total,1);
      const sp=L.speed*(1+ (1-frac)*2.2);
      let minX=1e9,maxX=-1e9; alive.forEach(a=>{ minX=Math.min(minX,a.x); maxX=Math.max(maxX,a.x); });
      let dx=st.dir*sp*dt;
      if(maxX+dx>W-18 || minX+dx<18){ st.dir*=-1; dx=0; alive.forEach(a=>a.y+=L.step); }
      alive.forEach(a=>a.x+=dx);
      st.marchT-=dt; if(st.marchT<=0){ st.marchT=Math.max(.12, .7*frac+.1 - L.n*0.002); S.march(st.march++); st.frame^=1; }
      // fiendeskott
      st.fireT-=dt;
      if(st.fireT<=0){ st.fireT=L.fire*(.6+Math.random()*.8);
        const cols={}; alive.forEach(a=>{ const k=Math.round(a.x); if(!cols[k]||cols[k].y<a.y) cols[k]=a; });
        const shooters=Object.values(cols); let s=shooters[rint(shooters.length)];
        if(L.aimed && Math.random()<L.aimed) s=shooters.reduce((b,a)=>Math.abs(a.x-p.x)<Math.abs(b.x-p.x)?a:b, s);
        st.ab.push({x:s.x,y:s.y+12,vx:0,vy:L.bspeed}); }
      if(!st.resetting && alive.some(a=>a.y>p.y-24)){ st.resetting=true; loseLife(true); return; }
    }
    // boss
    const B=st.boss;
    if(B && B.hp>0){ B.t+=dt; B.x+= B.vx*dt; if(B.x<60||B.x>W-60){ B.vx*=-1; B.x=Math.max(60,Math.min(W-60,B.x)); } B.y=110+Math.sin(B.t*1.3)*18;
      B.fireT-=dt; if(B.fireT<=0){ B.fireT=Math.max(.5, 1.6-L.n*0.008); const k=3+Math.min(4,Math.floor(L.n/25)); for(let i=0;i<k;i++){ const a=Math.PI/2+(i-(k-1)/2)*.22; st.ab.push({x:B.x,y:B.y+26,vx:Math.cos(a)*L.bspeed*.8,vy:Math.sin(a)*L.bspeed*.8}); } tone(140,.2,'sawtooth',.05,0,80); } }
    // UFO
    if(!st.ufo && !B && Math.random()<dt*0.08){ const d=Math.random()<.5?1:-1; st.ufo={x:d>0?-30:W+30, y:46, vx:d*(90+L.n*0.4), pts:[50,100,150,300][rint(4)]}; S.ufo(); }
    if(st.ufo){ st.ufo.x+=st.ufo.vx*dt; if(st.ufo.x<-40||st.ufo.x>W+40) st.ufo=null; }
    st.ab.forEach(b=>{ b.x+=b.vx*dt; b.y+=b.vy*dt; }); st.ab=st.ab.filter(b=>b.y<H+10 && b.x>-10 && b.x<W+10);
    // fallande power-ups
    st.drops.forEach(d=>d.y+=90*dt); st.drops=st.drops.filter(d=>{ if(d.y>H) return false;
      if(Math.abs(d.x-p.x)<18 && Math.abs(d.y-p.y)<16){ grant(d.k); return false; } return true; });
    // kollisioner: spelarskott
    st.pb=st.pb.filter(b=>{
      for(const a of alive){ if(a.alive && Math.abs(b.x-a.x)<15 && Math.abs(b.y-a.y)<12){ a.hp--; if(a.hp<=0){ a.alive=false; st.score+=a.pts*(1+Math.floor(L.n/10)*.5); st.kills++; burst(a.x,a.y,a.type==='c'?'#f0abfc':a.type==='a'?'#67e8f9':'#a3e635',14); S.pop();
            if(Math.random()<.045+Math.min(.04,L.n*.0006)) st.drops.push({x:a.x,y:a.y,k:['double','rapid','shield','double','rapid','life'][rint(Math.random()<.12?6:5)]}); }
          else { burst(b.x,b.y,'#fff',4); tone(1500,.04,'square',.03); } return false; } }
      if(B && B.hp>0 && Math.abs(b.x-B.x)<44 && Math.abs(b.y-B.y)<24){ B.hp--; burst(b.x,b.y,'#fde047',5); tone(400+B.hp,.04,'square',.03); if(B.hp<=0){ st.score+=500+L.n*25; for(let k=0;k<6;k++) setTimeout(()=>{ if(st) burst(B.x+(Math.random()*80-40),B.y+(Math.random()*40-20),'#fb923c',26); S.boom(); },k*120); shake=.6; st.drops.push({x:B.x,y:B.y,k:'life'}); } return false; }
      if(st.ufo && Math.abs(b.x-st.ufo.x)<22 && Math.abs(b.y-st.ufo.y)<10){ st.score+=st.ufo.pts; floatTxt(st.ufo.x,st.ufo.y,'+'+st.ufo.pts); burst(st.ufo.x,st.ufo.y,'#f472b6',24); S.boom(); st.ufo=null; return false; }
      for(const s of st.shields){ if(s.hp>0 && b.x>s.x-1 && b.x<s.x+7 && b.y>s.y && b.y<s.y+7){ s.hp--; return false; } }
      return true; });
    // kollisioner: fiendeskott
    st.ab=st.ab.filter(b=>{
      for(const s of st.shields){ if(s.hp>0 && b.x>s.x-1 && b.x<s.x+7 && b.y>s.y && b.y<s.y+7){ s.hp--; return false; } }
      if(Math.abs(b.x-p.x)<14 && Math.abs(b.y-p.y)<10){ if(p.inv>0) return false; if(st.pow.shield>0){ st.pow.shield=0; burst(p.x,p.y,'#7df9ff',18); tone(900,.2,'sine',.08,0,300); p.inv=1; return false; } loseLife(false); return false; }
      return true; });
    alive.forEach(a=>{ if(!a.alive) return; st.shields.forEach(s=>{ if(s.hp>0 && Math.abs(s.x+3-a.x)<15 && Math.abs(s.y+3-a.y)<12) s.hp=0; }); });
    // partiklar
    st.parts.forEach(q=>{ q.x+=q.vx*dt; q.y+=q.vy*dt; q.vy+=60*dt; q.t-=dt; }); st.parts=st.parts.filter(q=>q.t>0);
    if(shake>0) shake-=dt;
    // nivå klar?
    if(!st.aliens.some(a=>a.alive) && (!B || B.hp<=0) && !st.clearing){ st.clearing=true; S.level();
      const sv=save(); const next=st.level+1; if(next>sv.maxLevel){ sv.maxLevel=next; store(sv); }
      if(st.level%10===0 && st.lives<6){ st.lives++; floatTxt(W/2,H/2+40,'+1 liv ❤'); }
      setTimeout(()=>{ if(!st) return; st.clearing=false; newLevel(next); hud(); },1500); }
    hud();
  }
  function grant(k){ S.power(); const txt={double:'Dubbelskott!',rapid:'Snabbeld!',shield:'Sköld!',life:'+1 liv!'}[k]; floatTxt(st.p.x,st.p.y-30,txt);
    if(k==='life') st.lives=Math.min(6,st.lives+1); else if(k==='shield') st.pow.shield=1; else st.pow[k]=10; }
  function loseLife(invaded){
    S.hurt(); burst(st.p.x,st.p.y,'#7df9ff',30); shake=.5; buzz([60,40,120]);
    st.lives--; st.p.inv=2.2; st.ab=[]; st.pow.double=st.pow.rapid=0;
    if(invaded && st.lives>0){ const lv=st.level; setTimeout(()=>{ if(st){ newLevel(lv); hud(); } },600); }
    if(st.lives<=0) gameOver();
  }
  function gameOver(){
    clearRun(); st.live=false;
    const sv=save(); const rec=st.score>sv.best; if(rec) sv.best=Math.round(st.score); sv.kills+=st.kills; store(sv);
    overlay='over'; st.rec=rec; showOverlay();
    if(typeof DUEL!=='undefined' && DUEL.report('inv',{v:Math.round(st.score), hi:true, txt:`${Math.round(st.score)} poäng · nivå ${st.level}`})) return;
    if(rec){ celebrate('REKORD!'); sparkles(40); }
  }
  function burst(x,y,c,n){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, s=40+Math.random()*140; st.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:.4+Math.random()*.5,c}); } }
  function floatTxt(x,y,t){ st.parts.push({x,y,vx:0,vy:-40,t:1.2,c:'#fde047',txt:t}); }
  /* ---------- ritning ---------- */
  function draw(){
    const g=ctx; g.save(); g.setTransform(dpr*sc,0,0,dpr*sc,0,0);
    if(shake>0){ g.translate((Math.random()-.5)*8*shake,(Math.random()-.5)*8*shake); }
    const grd=g.createLinearGradient(0,0,0,H); grd.addColorStop(0,'#050320'); grd.addColorStop(.6,'#0b1550'); grd.addColorStop(1,'#13285f'); g.fillStyle=grd; g.fillRect(-10,-10,W+20,H+20);
    st.stars.forEach(s=>{ g.globalAlpha=.25+s.z*.35; g.fillStyle='#fff'; g.fillRect(s.x,s.y,s.z,s.z); }); g.globalAlpha=1;
    // sköldar
    st.shields.forEach(s=>{ if(s.hp>0){ g.fillStyle=['','#0e7490','#06b6d4','#67e8f9'][s.hp]; g.fillRect(s.x,s.y,6,6); } });
    // fiender
    const col={a:'#67e8f9',b:'#a3e635',c:'#f0abfc'};
    st.aliens.forEach(a=>{ if(!a.alive) return; const c = a.max>1 ? (a.hp>=3?'#fb7185':a.hp===2?'#fbbf24':col[a.type]) : col[a.type]; const s=sprite(a.type,st.frame,c);
      g.shadowColor=c; g.shadowBlur=8; g.drawImage(s,a.x-s.width/2,a.y-s.height/2); });
    g.shadowBlur=0;
    // boss
    const B=st.boss; if(B && B.hp>0){ const s=sprite('c',st.frame,'#fb7185'); g.shadowColor='#fb7185'; g.shadowBlur=20; g.drawImage(s,B.x-s.width*1.5,B.y-s.height*1.5,s.width*3,s.height*3); g.shadowBlur=0;
      g.fillStyle='rgba(255,255,255,.15)'; g.fillRect(W/2-120,18,240,8); g.fillStyle='#fb7185'; g.fillRect(W/2-120,18,240*B.hp/B.max,8); g.fillStyle='#fff'; g.font='bold 10px Fredoka, sans-serif'; g.textAlign='center'; g.fillText('BOSS',W/2,14); }
    if(st.ufo){ const s=sprite('u',0,'#f472b6'); g.shadowColor='#f472b6'; g.shadowBlur=12; g.drawImage(s,st.ufo.x-s.width/2,st.ufo.y-s.height/2); g.shadowBlur=0; }
    // skott
    g.fillStyle='#fef08a'; st.pb.forEach(b=>{ g.shadowColor='#fef08a'; g.shadowBlur=8; g.fillRect(b.x-1.5,b.y-7,3,10); });
    g.fillStyle='#fb7185'; st.ab.forEach(b=>{ g.shadowColor='#fb7185'; g.fillRect(b.x-2,b.y-5,4,9); }); g.shadowBlur=0;
    // drops
    st.drops.forEach(d=>{ g.font='18px sans-serif'; g.textAlign='center'; g.fillText({double:'⚡',rapid:'🔥',shield:'🛡️',life:'❤️'}[d.k],d.x,d.y+6); });
    // spelare
    const p=st.p; if(st.lives>0 && !(p.inv>0 && Math.floor(p.inv*10)%2)){ const s=sprite('p',0,'#7df9ff'); g.shadowColor='#7df9ff'; g.shadowBlur=14; g.drawImage(s,p.x-s.width/2,p.y-s.height/2); g.shadowBlur=0;
      g.fillStyle=Math.random()<.5?'#f472b6':'#fbbf24'; g.fillRect(p.x-3,p.y+12,6,4+Math.random()*5);
      if(st.pow.shield>0){ g.strokeStyle='rgba(125,249,255,.7)'; g.lineWidth=2; g.beginPath(); g.arc(p.x,p.y,22,0,Math.PI*2); g.stroke(); } }
    // partiklar
    st.parts.forEach(q=>{ g.globalAlpha=Math.min(1,q.t*2); if(q.txt){ g.fillStyle=q.c; g.font='bold 15px Fredoka, sans-serif'; g.textAlign='center'; g.fillText(q.txt,q.x,q.y); } else { g.fillStyle=q.c; g.fillRect(q.x-1.5,q.y-1.5,3,3); } }); g.globalAlpha=1;
    // nivåbanner
    if(st.banner>0){ g.globalAlpha=Math.min(1,st.banner); g.fillStyle='#fff'; g.textAlign='center'; g.font='bold 34px Fredoka, sans-serif'; g.shadowColor='#7df9ff'; g.shadowBlur=20;
      g.fillText(st.cfg.boss?`BOSS – NIVÅ ${st.level}`:`NIVÅ ${st.level}`,W/2,H/2-10); g.font='15px Fredoka, sans-serif'; g.shadowBlur=0; g.fillStyle='#cdeeff'; g.fillText(st.level>=100?'Legendariskt rymdhjälte-läge 🌟':'Gör dig redo!',W/2,H/2+18); g.globalAlpha=1; }
    // aktiva power-ups
    let px=8; ['double','rapid'].forEach(k=>{ if(st.pow[k]>0){ g.font='12px sans-serif'; g.textAlign='left'; g.fillStyle='#fde047'; g.fillText((k==='double'?'⚡':'🔥')+Math.ceil(st.pow[k])+'s',px,H-8); px+=46; } });
    g.restore();
  }
  let sc=1;
  function fit(){
    if(!cv) return; const wrap=cv.parentElement, r=wrap.getBoundingClientRect();
    const availH=window.innerHeight-r.top-8, availW=r.width;
    sc=Math.min(availW/W, availH/H); dpr=Math.min(2,window.devicePixelRatio||1);
    cv.style.width=(W*sc)+'px'; cv.style.height=(H*sc)+'px'; cv.width=Math.round(W*sc*dpr); cv.height=Math.round(H*sc*dpr);
    ctx.imageSmoothingEnabled=false;
    if(st) draw();
  }
  function loop(t){
    raf=0; if(view!=='inv' || !st){ return; }
    const dt=Math.min(.033,(t-last)/1000||0); last=t;
    if(!paused && !overlay && !document.hidden) update(dt);
    if(st) draw();
    raf=requestAnimationFrame(loop);
  }
  function start(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(loop); } }
  function stop(){ if(raf) cancelAnimationFrame(raf); raf=0; keys={}; touch=null; if(st && !overlay){ paused=true; } }
  function hud(){ const l=document.getElementById('ivL'), s=document.getElementById('ivS'), h=document.getElementById('ivLives');
    if(l) l.textContent=st?st.level:1; if(s) s.textContent=st?Math.round(st.score):0; if(h) h.textContent=st?'❤'.repeat(Math.max(0,st.lives)):'❤❤❤'; }
  function showOverlay(){
    const o=document.getElementById('ivOverlay'); if(!o) return;
    const sv=save(), ck=Math.max(1, Math.floor((sv.maxLevel-1)/5)*5+1);
    if(!overlay){ o.className='inv-ov'; o.innerHTML=''; return; }
    o.className='inv-ov show';
    if(overlay==='menu'){
      const cps=[]; for(let l=1;l<=ck;l+=5) cps.push(l);
      o.innerHTML=`<div class="iv-card"><div class="iv-title">SPACE<br>INVADERS</div><div class="iv-sub">Försvara Fröknarnas galax! 👾</div>
        <div class="iv-stats"><span>🏆 Rekord <b>${sv.best}</b></span><span>🚀 Högsta nivå <b>${sv.maxLevel}</b></span></div>
        <button class="iv-btn" data-iv="go" data-l="1">▶ Starta nivå 1</button>
        <button class="iv-btn alt" data-duel="names" data-k="inv">👥 Turas om på samma enhet</button>
        ${ck>1?`<button class="iv-btn alt" data-iv="go" data-l="${ck}">⏩ Fortsätt från nivå ${ck}</button>`:''}
        ${cps.length>2?`<div class="iv-cps">${cps.slice(-12).map(l=>`<button data-iv="go" data-l="${l}">${l}</button>`).join('')}</div>`:''}
        <div class="iv-help">${FINE_PTR?'⬅ ➡ styr · Mellanslag skjuter · P pausar':'Håll fingret på skärmen och dra – skeppet följer och skjuter av sig självt'}<br>Varje 10:e nivå väntar en boss. Fånga ⚡ 🔥 🛡️ ❤️!</div></div>`;
    } else if(overlay==='pause'){
      o.innerHTML=`<div class="iv-card"><div class="iv-title sm">Paus</div><div class="iv-stats col"><span>Nivå <b>${st.level}</b></span><span>Poäng <b>${Math.round(st.score)}</b></span><span>Liv <b>${'❤'.repeat(Math.max(0,st.lives))}</b></span></div><button class="iv-btn" data-iv="resume">▶ Fortsätt</button><button class="iv-btn alt" data-iv="menu">↺ Avsluta rundan</button><button class="iv-btn alt" data-act="lobby">🏠 Lobby</button></div>`;
    } else if(overlay==='over'){
      o.innerHTML=`<div class="iv-card"><div class="iv-title sm">${st.rec?'NYTT REKORD!':'GAME OVER'}</div>
        <div class="iv-stats col"><span>Poäng <b>${Math.round(st.score)}</b></span><span>Nivå <b>${st.level}</b></span><span>Fiender <b>${st.kills}</b></span></div>
        <button class="iv-btn" data-iv="go" data-l="${Math.max(1, Math.floor((st.level-1)/5)*5+1)}">↻ Försök igen från nivå ${Math.max(1, Math.floor((st.level-1)/5)*5+1)}</button>
        <button class="iv-btn alt" data-iv="menu">☰ Meny</button><button class="iv-btn alt" data-act="lobby">🏠 Lobby</button></div>`;
    }
  }
  function html(){
    return `<div id="invRoot" class="inv"><div class="inv-top"><button class="iconbtn" data-act="lobby" aria-label="Lobby">‹</button>
      <div class="inv-hud"><span>NIVÅ <b id="ivL">1</b></span><span>POÄNG <b id="ivS">0</b></span><span class="lv" id="ivLives">❤❤❤</span></div>
      <button class="iconbtn" data-iv="pause" aria-label="Paus">⏸</button></div>
      <div class="inv-stage"><canvas id="ivc"></canvas><div id="ivOverlay" class="inv-ov"></div></div></div>`;
  }
  function mount(){
    cv=document.getElementById('ivc'); ctx=cv.getContext('2d');
    const run=!st && loadRun();
    if(run){ st={score:run.score,lives:run.lives,p:{x:W/2,y:H-46,cd:0,inv:2},pow:{double:0,rapid:0,shield:0},parts:[],stars:makeStars(),kills:run.kills,startLevel:run.startLevel,live:true}; newLevel(run.level); overlay='pause'; paused=true; }
    else if(!st){ st={score:0,lives:3,p:{x:W/2,y:H-46,cd:0,inv:0},pow:{double:0,rapid:0,shield:0},parts:[],stars:makeStars(),kills:0}; newLevel(1); st.banner=0; overlay='menu'; }
    else if(!overlay){ overlay='pause'; paused=true; }
    fit(); showOverlay(); hud(); start();
    const pos=e=>{ const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)/sc, y:(e.clientY-r.top)/sc}; };
    cv.addEventListener('pointerdown',e=>{ if(overlay) return; e.preventDefault(); unlockAudio(); touch=pos(e); try{ cv.setPointerCapture(e.pointerId) }catch(_){} });
    cv.addEventListener('pointermove',e=>{ if(touch) touch=pos(e); });
    const up=()=>{ touch=null; }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  }
  window.addEventListener('resize',()=>{ if(view==='inv') requestAnimationFrame(fit); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && view==='inv' && st){ saveRun(); if(!overlay){ overlay='pause'; paused=true; showOverlay(); } } });
  window.addEventListener('pagehide',()=>{ if(view==='inv') saveRun(); });
  document.addEventListener('keydown',e=>{
    if(view!=='inv') return;
    if(/INPUT|TEXTAREA/.test((e.target&&e.target.tagName)||'')) return;
    if(e.key===' '||e.key.startsWith('Arrow')) e.preventDefault();
    if((e.key==='p'||e.key==='P'||e.key==='Escape') && st && !M().classList.contains('show')){ if(overlay==='pause'){ overlay=null; paused=false; showOverlay(); } else if(!overlay){ overlay='pause'; paused=true; showOverlay(); } return; }
    if(overlay==='menu' && e.key==='Enter'){ document.querySelector('[data-iv="go"]')?.click(); return; }
    keys[e.key]=true; if(e.key===' ') keys.Space=true;
  });
  document.addEventListener('keyup',e=>{ keys[e.key]=false; if(e.key===' ') keys.Space=false; });
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-iv]'); if(!b) return; unlockAudio();
    const a=b.dataset.iv;
    if(a==='go') newGame(+b.dataset.l||1);
    if(a==='pause' && st){ if(overlay==='pause'){ overlay=null; paused=false; } else if(!overlay){ overlay='pause'; paused=true; } showOverlay(); }
    if(a==='resume'){ overlay=null; paused=false; showOverlay(); }
    if(a==='menu'){ if(st && overlay==='pause'){ clearRun(); st.live=false; }
      if(st && overlay==='pause'){ const sv=save(); if(st.score>sv.best){ sv.best=Math.round(st.score); store(sv); } } overlay='menu'; showOverlay(); }
  });
  return { html, mount, stop, open(){ closeModal(); view='inv'; render(); }, go(l){ newGame(l||1); }, stats(){ return save(); } };
})();
function openInv(){ INV.open(); }
function invStatsHTML(){ const s=INV.stats(); if(!s.games) return ''; return `<section><h2 class="sec">🚀 Space Attack</h2><div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><b>${s.best}</b><span>rekord</span></div><div class="kpi"><b>${s.maxLevel}</b><span>högsta nivå</span></div><div class="kpi"><b>${s.kills}</b><span>besegrade</span></div></div></section>`; }
(function(){ const st=document.createElement('style'); st.textContent=`
.inv{display:flex;flex-direction:column;align-items:center}
.inv-top{display:flex;align-items:center;gap:8px;width:100%;max-width:640px;margin-bottom:8px}
.inv-hud{flex:1;display:flex;justify-content:center;gap:14px;font-size:12px;color:var(--dim);letter-spacing:1px}
.inv-hud b{color:#fff;font-size:16px;margin-left:4px}.inv-hud .lv{color:#fb7185;font-size:15px;letter-spacing:2px}
.inv-stage{position:relative;width:100%;display:flex;justify-content:center}
#ivc{display:block;border-radius:18px;box-shadow:0 0 0 1px rgba(125,249,255,.3),0 20px 60px rgba(0,0,0,.6),0 0 40px rgba(99,102,241,.25);touch-action:none;cursor:crosshair}
.inv-ov{position:absolute;top:0;right:0;bottom:0;left:0;display:none;align-items:center;justify-content:center;padding:14px}
.inv-ov.show{display:flex}
.iv-card{width:min(330px,92%);padding:22px 18px;border-radius:24px;text-align:center;background:rgba(5,8,40,.88);border:1px solid rgba(125,249,255,.45);box-shadow:0 0 40px rgba(99,102,241,.4);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.iv-title{font-size:36px;font-weight:700;line-height:1;letter-spacing:3px;background:linear-gradient(180deg,#a3e635,#22d3ee 55%,#f0abfc);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 12px rgba(34,211,238,.6))}
.iv-title.sm{font-size:28px;margin-bottom:12px}
.iv-sub{color:#cdeeff;margin:8px 0 12px}
.iv-stats{display:flex;justify-content:center;gap:14px;font-size:13px;color:var(--dim);margin-bottom:14px}.iv-stats b{color:#fde047;font-size:16px}
.iv-stats.col{flex-direction:column;gap:4px;font-size:15px}
.iv-btn{display:block;width:100%;margin:8px 0;padding:13px;border-radius:16px;font-size:17px;font-weight:700;background:linear-gradient(135deg,#22d3ee,#6366f1 60%,#a855f7);box-shadow:0 0 18px rgba(99,102,241,.5)}
.iv-btn.alt{background:rgba(255,255,255,.08);box-shadow:none;font-weight:600;font-size:15px;border:1px solid var(--line)}
.iv-cps{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0}
.iv-cps button{min-width:38px;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid var(--line);font-size:13px}
.iv-help{font-size:12px;color:var(--dim);margin-top:10px;line-height:1.5}
`; document.head.appendChild(st); })();
