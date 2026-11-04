/* =====================================================================
   pong.js – Pong i rymden
   • mot datorn (tre nivåer), två på samma skärm, eller online mot en kompis
   • online: värdens mobil räknar bollen, gästen skickar sitt racket direkt
     ({t:'pg'} vid sidan av det vanliga spel-tillståndet, ca 30 gånger/s)
   • poängen går genom spelmotorn (applyAndPublish) så returmatch, statistik
     och återanslutning fungerar som i de andra spelen
   ===================================================================== */
'use strict';
const PONG = (()=>{
  const W=360, H=640, T=12, R=8, PY=[H-46, 46], BASEW=78, TARGET=11;
  // err växer med bollens fart (fe), så även Svår missar när det går riktigt fort
  const LV={ easy:{sp:300, err:58, fe:.04, react:.32, aim:0}, medium:{sp:440, err:28, fe:.06, react:.17, aim:.3}, hard:{sp:600, err:10, fe:.055, react:.07, aim:.6} };
  const PU={ big:'↔️', shrink:'🤏', fast:'⚡', multi:'☄️' };
  let P=null, cv=null, ctx=null, raf=0, lastT=0, dpr=1, sendT=0, lastSnap=null, snapAt=0, pending={bonus:true, local2:false}, pFresh=false;
  const ptrs=new Map(), keys={};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const isHostSim=()=> mode==='local' || (mode==='online' && role==='host');
  const mine=()=> mode==='online' ? mySeat : 0;
  const local2=()=> mode==='local' && G && G.local2;

  /* ---------- ljud ---------- */
  const S={ pad(){ tone(520,.07,'square',.06,0,640); }, wall(){ tone(300,.05,'square',.04); },
    goal(){ tone(200,.35,'sawtooth',.08,0,60); }, pu(){ [660,990,1320].forEach((f,i)=>tone(f,.1,'sine',.07,i*.06)); },
    go(){ tone(880,.15,'triangle',.08); }, tick(){ tone(440,.08,'triangle',.06); } };

  /* ---------- fysik ---------- */
  function fresh(){
    return {gid:G.id, balls:[], pads:[{x:W/2,w:BASEW,vx:0,big:0,small:0},{x:W/2,w:BASEW,vx:0,big:0,small:0}], pu:null, puT:6+Math.random()*6,
      cd:2.6, cdShow:true, serveTo:(G.starter||0), last:-1, trail:[], parts:[], shake:0, ai:[{tx:W/2,e:0,t:0},{tx:W/2,e:0,t:0}], remoteX:W/2, sentScore:-1};
  }
  function serve(){
    const to=P.serveTo, sp=300, a=(Math.random()*.6-.3);
    P.balls=[{x:W/2, y:H/2, vx:Math.sin(a)*sp, vy:(to===0?1:-1)*Math.cos(a)*sp, sp}];
    P.last=-1; P.trail=[];
    for(const k of [0,1]){ const lv=LV[(G.ai&&G.ai[k])||'medium']||LV.medium; P.ai[k].t=0; P.ai[k].e=(Math.random()*2-1)*lv.err; }   // ny boll: glöm förra bollens sikte
  }
  function padW(s){ const p=P.pads[s]; return BASEW*(p.big>0?1.6:1)*(p.small>0?.62:1); }
  function hitPad(b,s,prevY){
    const p=P.pads[s], w=padW(s), top=PY[s], surf = s===0 ? top : top+T;
    const crossing = s===0 ? (b.vy>0 && prevY+R<=surf+2 && b.y+R>=surf) : (b.vy<0 && prevY-R>=surf-2 && b.y-R<=surf);
    if(!crossing || Math.abs(b.x-p.x) > w/2+R) return false;
    const off=clamp((b.x-p.x)/(w/2),-1,1), ang=off*1.05;
    b.sp=Math.min(b.sp*1.055, 980);
    b.vx=clamp(Math.sin(ang)*b.sp + p.vx*.12, -b.sp*.9, b.sp*.9);
    const vy=Math.sqrt(Math.max(b.sp*b.sp-b.vx*b.vx, b.sp*b.sp*.18));
    b.vy = s===0 ? -vy : vy; b.y = s===0 ? surf-R : surf+R;
    P.last=s; burst(b.x,b.y,s===0?'#22d3ee':'#f472b6',10); S.pad(); if(s===mine()||local2()) buzz(8);
    // nästa gång motståndaren (om det är datorn) slår: lite slumpfel, och på högre nivåer siktar den bort från den som just slog
    const a=P.ai[1-s], lv=LV[(G.ai&&G.ai[1-s])||'medium']||LV.medium, away = p.x < W/2 ? 1 : -1;
    a.t=0; a.e=(Math.random()*2-1)*(lv.err + Math.max(0,b.sp-320)*lv.fe) - away*lv.aim*(Math.random()*.5+.5)*BASEW/2;
    return true;
  }
  function burst(x,y,c,n){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, v=40+Math.random()*160; P.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:.5,c}); } }
  function predictX(b, yTarget){
    if((yTarget-b.y)*b.vy<=0) return W/2;
    const t=(yTarget-b.y)/b.vy; let x=b.x+b.vx*t; const L=W-2*R;
    x-=R; x=((x%(2*L))+2*L)%(2*L); if(x>L) x=2*L-x; return x+R;
  }
  function aiStep(s,dt){
    const lv=LV[G.ai[s]]||LV.medium, a=P.ai[s], p=P.pads[s];
    a.t+=dt;
    const towards=P.balls.filter(b=> s===0 ? b.vy>0 : b.vy<0).sort((x,y)=>Math.abs(x.y-PY[s])-Math.abs(y.y-PY[s]))[0];
    let tx=W/2; if(towards && a.t>lv.react) tx=predictX(towards, s===0?PY[0]:PY[1]+T)+a.e;
    if(P.pu && !towards && G.ai[s]==='hard') tx=P.pu.x;
    const dx=clamp(tx-p.x, -lv.sp*dt, lv.sp*dt); moveTo(s, p.x+dx, dt);
  }
  function moveTo(s,x,dt){ const p=P.pads[s], w=padW(s), nx=clamp(x, w/2, W-w/2); p.vx = dt>0 ? (nx-p.x)/dt : 0; p.x=nx; }
  function step(dt){
    // racketar
    for(const s of [0,1]){ const p=P.pads[s]; p.big=Math.max(0,p.big-dt); p.small=Math.max(0,p.small-dt);
      if(mode==='local' && isAI(s)) aiStep(s,dt);
      else if(mode==='online' && s!==mySeat) moveTo(s, P.remoteX, dt); }
    if(P.cd>0){ const before=Math.ceil(P.cd); P.cd-=dt; if(P.cdShow && Math.ceil(P.cd)!==before && P.cd>0) S.tick(); if(P.cd<=0){ if(P.cdShow) S.go(); P.cdShow=false; serve(); } return; }
    // bonusar
    if(G.bonus){ P.puT-=dt; if(!P.pu && P.puT<=0){ const k=Object.keys(PU)[rint(4)]; P.pu={k, x:40+Math.random()*(W-80), y:H*.32+Math.random()*H*.36}; P.puT=10+Math.random()*7; } }
    // bollar
    const out=[];
    for(const b of P.balls){
      const n=Math.ceil(dt*Math.hypot(b.vx,b.vy)/6)||1, h=dt/n;
      for(let k=0;k<n;k++){
        const py=b.y; b.x+=b.vx*h; b.y+=b.vy*h;
        if(b.x<R){ b.x=R; b.vx=Math.abs(b.vx); S.wall(); } else if(b.x>W-R){ b.x=W-R; b.vx=-Math.abs(b.vx); S.wall(); }
        hitPad(b,0,py) || hitPad(b,1,py);
        if(P.pu && Math.hypot(b.x-P.pu.x,b.y-P.pu.y)<R+16){ takePU(P.pu.k, b); P.pu=null; }
      }
      if(b.y>H+R*3) out.push(1); else if(b.y<-R*3) out.push(0);
    }
    if(out.length){ goal(out[0]); return; }
    P.trail.push(P.balls.map(b=>[b.x,b.y])); if(P.trail.length>12) P.trail.shift();
  }
  function takePU(k,b){
    const s=P.last; burst(b.x,b.y,'#facc15',18); S.pu();
    if(k==='multi'){ if(P.balls.length<3) P.balls.push({x:b.x,y:b.y,vx:-b.vx,vy:b.vy,sp:b.sp}); return; }
    if(k==='fast'){ P.balls.forEach(x=>{ const f=Math.min(1.3, 1050/Math.max(1,x.sp)); x.vx*=f; x.vy*=f; x.sp*=f; }); return; }
    if(s<0) return;
    if(k==='big') P.pads[s].big=10; if(k==='shrink') P.pads[1-s].small=10;
  }
  function goal(scorer){
    P.balls=[]; P.trail=[]; P.cd=1.1; P.serveTo=1-scorer; P.pu=null;
    if(G && !G.over) applyAndPublish({type:'goal', s:scorer}, 0);
  }

  /* ---------- nätet ---------- */
  function snap(){
    const r=v=>Math.round(v);
    return {t:'pg', g:G.id, b:P.balls.map(b=>[r(b.x),r(b.y),r(b.vx),r(b.vy)]), p:P.pads.map(p=>[r(p.x),Math.round(padW(P.pads.indexOf(p))),p.big>0?1:0,p.small>0?1:0]),
      u:P.pu?[P.pu.k,r(P.pu.x),r(P.pu.y)]:null, c:Math.round(P.cd*10), cs:P.cdShow?1:0, l:P.last};
  }
  function onNet(m, seat){
    if(!G || G.kind!=='pong' || m.g!==G.id) return;
    if(role==='host'){ if(seat===1 && Number.isFinite(m.x)) { if(P && P.gid===G.id) P.remoteX=clamp(+m.x,0,W); } return; }
    // gäst: en ögonblicksbild från värden
    if(!Array.isArray(m.b) || m.b.length>3 || !Array.isArray(m.p) || m.p.length!==2) return;
    const ok=a=>Array.isArray(a)&&a.every(Number.isFinite);
    if(!m.b.every(b=>ok(b)&&b.length===4) || !m.p.every(p=>ok(p)&&p.length===4)) return;
    const prev=lastSnap; lastSnap=m; snapAt=performance.now();
    if(prev && m.l!==prev.l && m.l>=0){ const b=m.b[0]; if(b){ burst(b[0],b[1],m.l===0?'#22d3ee':'#f472b6',10); S.pad(); } }
    if(prev && m.cs && Math.ceil(m.c/10)!==Math.ceil(prev.c/10) && m.c>0) S.tick();
    if(prev && prev.cs && !m.cs) S.go();
    if(m.u===null && prev && prev.u) S.pu();
  }
  function guestApply(){
    if(!lastSnap || !P) return;
    const age=Math.min(.12,(performance.now()-snapAt)/1000), m=lastSnap;
    P.balls=m.b.map(b=>({x:b[0]+b[2]*age, y:b[1]+b[3]*age, vx:b[2], vy:b[3], sp:Math.hypot(b[2],b[3])}));
    const o=1-mySeat; P.pads[o].x=m.p[o][0]; P.pads[o].big=m.p[o][2]?1:0; P.pads[o].small=m.p[o][3]?1:0;
    P.pads[mySeat].big=m.p[mySeat][2]?1:0; P.pads[mySeat].small=m.p[mySeat][3]?1:0;
    P.pu = m.u && PU[m.u[0]] ? {k:m.u[0],x:m.u[1],y:m.u[2]} : null; P.cd=m.c/10; P.cdShow=!!m.cs;
    P.trail.push(P.balls.map(b=>[b.x,b.y])); if(P.trail.length>12) P.trail.shift();
  }

  /* ---------- styrning ---------- */
  const toLogical = (cx,cy)=>{ const r=cv.getBoundingClientRect(); let x=(cx-r.left)/r.width*W, y=(cy-r.top)/r.height*H; if(flip()) y=H-y; return [x,y]; };
  const flip = () => mode==='online' && mySeat===1;
  function seatForPointer(y){ if(local2()) return y>H/2?0:1; return mine(); }
  function ptrsFor(s){ for(const v of ptrs.values()) if(v.s===s) return v; return null; }
  function onDown(e){ if(!cv) return; e.preventDefault(); unlockAudio(); const [x,y]=toLogical(e.clientX,e.clientY); const s=seatForPointer(y); if(isAI(s) && mode==='local') return; ptrs.set(e.pointerId,{s,x}); try{ cv.setPointerCapture(e.pointerId); }catch(err){} }
  function onMove(e){ const v=ptrs.get(e.pointerId); if(!v) return; e.preventDefault(); v.x=toLogical(e.clientX,e.clientY)[0]; }
  function onUp(e){ ptrs.delete(e.pointerId); }
  document.addEventListener('keydown',e=>{ if(G&&G.kind==='pong'&&view==='game'&&['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)){ keys[e.code]=true; e.preventDefault(); } });
  document.addEventListener('keyup',e=>{ keys[e.code]=false; });

  /* ---------- ritning ---------- */
  const STARS=Array.from({length:70},()=>[Math.random()*W,Math.random()*H,Math.random()*1.4+.3,Math.random()]);
  function draw(){
    const s=cv.width/W; ctx.setTransform(s,0,0,s,0,0);
    const fy=y=> flip()? H-y : y;
    let sx=0, sy=0; if(P.shake>0){ sx=(Math.random()-.5)*P.shake*10; sy=(Math.random()-.5)*P.shake*10; }
    ctx.translate(sx,sy);
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0b1028'); g.addColorStop(.5,'#111a3d'); g.addColorStop(1,'#0b1028'); ctx.fillStyle=g; ctx.fillRect(-10,-10,W+20,H+20);
    const t=performance.now()/1000;
    for(const [x,y,r,p] of STARS){ ctx.globalAlpha=.35+.35*Math.sin(t*1.5+p*9); ctx.fillStyle='#cbd5ff'; ctx.fillRect(x,y,r,r); } ctx.globalAlpha=1;
    // mittlinje och poäng
    ctx.strokeStyle='rgba(148,163,255,.25)'; ctx.setLineDash([10,12]); ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke(); ctx.setLineDash([]);
    const me= local2()?0:mine(), op=1-me, sc=G.score||[0,0];
    ctx.font='800 92px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(34,211,238,.13)'; ctx.fillText(sc[me], W/2, H*0.72);
    ctx.fillStyle='rgba(244,114,182,.13)'; if(local2()){ ctx.save(); ctx.translate(W/2,H*0.28); ctx.rotate(Math.PI); ctx.fillText(sc[op],0,0); ctx.restore(); } else ctx.fillText(sc[op], W/2, H*0.28);
    ctx.font='600 13px system-ui,sans-serif'; ctx.fillStyle='rgba(255,255,255,.45)';
    ctx.fillText(bare(pname(me)), W/2, H*0.72+58);
    if(local2()){ ctx.save(); ctx.translate(W/2,H*0.28-58); ctx.rotate(Math.PI); ctx.fillText(bare(pname(op)),0,0); ctx.restore(); } else ctx.fillText(bare(pname(op)), W/2, H*0.28-58);
    // bonus
    if(P.pu){ const y=fy(P.pu.y), pulse=1+.12*Math.sin(t*6); ctx.save(); ctx.shadowColor='#facc15'; ctx.shadowBlur=18; ctx.fillStyle='rgba(250,204,21,.18)'; ctx.beginPath(); ctx.arc(P.pu.x,y,17*pulse,0,7); ctx.fill(); ctx.restore();
      ctx.font='20px system-ui'; ctx.fillText(PU[P.pu.k], P.pu.x, y+1); }
    // racketar
    for(const si of [0,1]){ const p=P.pads[si], w = padW(si), y=fy(si===0?PY[0]:PY[1])-(flip()?T:0), col= si===0?'#22d3ee':'#f472b6';
      ctx.save(); ctx.shadowColor=col; ctx.shadowBlur=18; ctx.fillStyle=col; rr(p.x-w/2, y, w, T, 6); ctx.fill(); ctx.restore(); }
    // svans och bollar
    P.trail.forEach((ps,i)=>{ const a=(i+1)/P.trail.length; ps.forEach(([x,y])=>{ ctx.fillStyle=`rgba(253,224,71,${a*.35})`; ctx.beginPath(); ctx.arc(x,fy(y),R*a,0,7); ctx.fill(); }); });
    for(const b of P.balls){ ctx.save(); ctx.shadowColor='#fde047'; ctx.shadowBlur=22; ctx.fillStyle='#fffbe6'; ctx.beginPath(); ctx.arc(b.x,fy(b.y),R,0,7); ctx.fill(); ctx.restore(); }
    for(const q of P.parts){ ctx.globalAlpha=Math.max(0,q.t*2); ctx.fillStyle=q.c; ctx.fillRect(q.x-1.5,fy(q.y)-1.5,3,3); } ctx.globalAlpha=1;
    // nedräkning / paus
    let msg=null;
    if(P.cd>0 && P.cdShow) msg=String(Math.ceil(P.cd));
    if(G.over) msg=null;
    else if(mode==='online' && !ready()) msg=null;
    else if(mode==='online' && net!=='connected') msg='📡';
    if(msg){ ctx.font='800 70px system-ui,sans-serif'; ctx.fillStyle='#fff'; ctx.save(); ctx.shadowColor='#22d3ee'; ctx.shadowBlur=30; ctx.fillText(msg,W/2,H/2); ctx.restore(); }
    ctx.setTransform(1,0,0,1,0,0);
  }
  function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  /* ---------- slingan ---------- */
  function loop(now){
    raf=0;
    if(!G || G.kind!=='pong' || view!=='game' || !cv || !cv.isConnected){ return; }
    raf=requestAnimationFrame(loop);
    const dt=Math.min(.05,(now-(lastT||now))/1000); lastT=now;
    if(!P || P.gid!==G.id){ P=fresh(); lastSnap=null; }
    // mina fingrar styr mitt racket (eller båda i läget två på samma skärm)
    for(const s of [0,1]){
      const mineS = mode==='online' ? s===mySeat : !isAI(s); if(!mineS) continue;
      const v=ptrsFor(s), kx = (local2()&&s===1) ? (keys.KeyD?1:0)-(keys.KeyA?1:0) : (keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0) + (local2()?0:(keys.KeyD?1:0)-(keys.KeyA?1:0));
      if(v) moveTo(s, v.x, dt); else if(kx) moveTo(s, P.pads[s].x+kx*560*dt, dt); else P.pads[s].vx*=.8; }
    const live = ready() && !G.over && document.visibilityState==='visible' && (mode!=='online' || net==='connected');
    if(isHostSim()){ if(live) step(dt); else for(const s of [0,1]) P.pads[s].vx=0;
      if(mode==='online' && now-sendT>33){ sendT=now; if(ready()) hostBroadcast(snap()); } }
    else { guestApply(); if(now-sendT>33 && live){ sendT=now; send({t:'pg', g:G.id, x:Math.round(P.pads[mySeat].x)}); } }
    P.parts=P.parts.filter(q=>(q.t-=dt)>0); P.parts.forEach(q=>{ q.x+=q.vx*dt; q.y+=q.vy*dt; });
    P.shake=Math.max(0,P.shake-dt*2.5);
    draw();
  }
  function fit(){
    if(!cv) return; const wrap=cv.parentElement; if(!wrap) return;
    const aw=wrap.clientWidth, ah=Math.max(300, window.innerHeight - wrap.getBoundingClientRect().top - 14);
    let w=Math.min(aw, ah*W/H); w=Math.max(200,w); const h=w*H/W;
    dpr=Math.min(2.5, window.devicePixelRatio||1);
    cv.style.width=w+'px'; cv.style.height=h+'px'; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  }
  window.addEventListener('resize',()=>{ if(G&&G.kind==='pong'&&view==='game') fit(); });
  function mount(){
    const host=document.getElementById('pgHost'); if(!host) return;
    if(!cv){ cv=document.createElement('canvas'); cv.className='pg-cv'; ctx=cv.getContext('2d');
      cv.addEventListener('pointerdown',onDown); cv.addEventListener('pointermove',onMove); cv.addEventListener('pointerup',onUp); cv.addEventListener('pointercancel',onUp);
      cv.addEventListener('contextmenu',e=>e.preventDefault()); }
    host.appendChild(cv); fit();
    if(!raf){ lastT=0; raf=requestAnimationFrame(loop); }
  }

  /* ---------- spelmotorn ---------- */
  GINFO.pong={name:'Pong', icon:'🏓', ai:'Blixt 🤖', max:2, grad:'linear-gradient(135deg,#22d3ee,#6366f1 55%,#f472b6)'};
  KIND.pong={
    init(){ // nytt spel från menyn: menyns val; annars (start online, returmatch) samma som förut
      const base = !pFresh && G && G.kind==='pong' ? G : null; pFresh=false;
      return {score:[0,0], bonus: base ? !!base.bonus : pending.bonus, local2: base ? !!base.local2 : pending.local2, cur:0}; },
    start(g){ g.score=[0,0]; g.cur=0; if(g.bonus===undefined) g.bonus=true; },
    valid(g){ return g.names.length>=1 && g.names.length<=2 && (g.started===false || g.names.length===2) && Array.isArray(g.score) && g.score.length===2
      && g.score.every(x=>Number.isInteger(x)&&x>=0&&x<=TARGET) && typeof g.bonus==='boolean'; },
    waitingFor(){ return -1; },
    scoreOf(g,i){ return String(g.score[i]); },
    apply(g,a,seat){
      if(g.over) return false;
      if(a.type==='resign'){ g.over=true;
        if(mode==='online') g.winner=1-seat; else if(g.local2) g.winner = g.score[0]===g.score[1] ? -1 : g.score[0]>g.score[1] ? 0 : 1; else g.winner=1;
        return true; }
      if(a.type!=='goal' || seat!==0 || !(a.s===0||a.s===1)) return false;    // bara värden (eller lokalt) räknar mål
      g.score[a.s]++; g.last={t:Date.now(), s:a.s};
      if(g.score[a.s]>=TARGET){ g.over=true; g.winner=a.s; }
      return true;
    },
    aiSeat(){ return null; },
    effects(prev,d){
      if(d.last && (!prev.last || prev.last.t!==d.last.t)){ S.goal(); if(P){ P.shake=1; } buzz(40);
        const me=local2()?null:mine(); if(me!==null && !d.over) toast(d.last.s===me?'Mål! 🎉':`${bare(pname(d.last.s))} tog poängen`,1100); }
    },
    html(){
      const end = G.over ? gOverHTML(`${G.score[0]} – ${G.score[1]}`) : '';
      const help = mode==='local' && G.local2 ? 'Var sin tumme: nedre halvan styr den blå, övre halvan den rosa.' : 'Dra med fingret (eller ← →) för att styra ditt racket.';
      return `<div class="pg-wrap"><div id="pgHost" class="pg-host"></div>${G.over?`<div class="pg-over">${end}</div>`:''}</div>
        <div class="ghint pg-hint">${help} Först till ${TARGET}. ${G.bonus?'Bonusar: ↔️ större racket, 🤏 mindre för motståndaren, ⚡ snabbare, ☄️ en boll till.':''} ${G.over?'':'<button class="of-link" data-pg="resign">Ge upp</button>'}</div>`;
    },
    mounted(){ mount(); }
  };

  /* ---------- meny ---------- */
  let pLevel=lsGet('pg_lvl')||'medium', pBonus=lsGet('pg_bonus')!=='0';
  const lvlH=()=>[['easy','🐣 Lätt'],['medium','🙂 Medel'],['hard','🧠 Svår']].map(([k,l])=>`<button data-pg="lvl" data-l="${k}" class="${pLevel===k?'sel':''}">${l}</button>`).join('');
  const bonH=()=>`<button data-pg="bonus" data-v="1" class="${pBonus?'sel':''}">✨ Med bonusar</button><button data-pg="bonus" data-v="0" class="${!pBonus?'sel':''}">Klassiskt</button>`;
  window.showPongMenu=function(){
    openModal(`<h3>🏓 Pong</h3><p>Studsa kometen förbi motståndarens racket. Ju längre från mitten du träffar, desto snedare studsar den. Först till ${TARGET} vinner!</p>
      <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      <label>Spelsätt</label><div class="seg" id="pgBon">${bonH()}</div>
      <label>Datorns nivå</label><div class="seg" id="pgLvl">${lvlH()}</div>
      <div class="btns" style="flex-direction:column"><button class="pri" data-pg="ai">🤖 Spela mot datorn</button>
        <button class="pri" data-pg="two" style="background:linear-gradient(135deg,#22d3ee,#6366f1)">👥 Två på samma skärm</button>
        <button class="pri" data-pg="host" style="background:linear-gradient(135deg,#f472b6,#a855f7)">🚀 Bjud in en kompis (online)</button>
        <button data-act="close">Avbryt</button></div>`,'pgmenu');
  };
  function showTwo(){
    openModal(`<h3>👥 Två på samma skärm</h3><p>Lägg mobilen eller plattan platt mellan er. Den som sitter nedtill styr det blå racketet, den som sitter upptill det rosa.</p>
      <label>Blå (nedtill)</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Namn">
      <label>Rosa (upptill)</label><input id="nm2" maxlength="14" value="${esc(lsGet('pg_name2')||'')}" placeholder="Namn">
      <div class="btns"><button data-pg="menu">Tillbaka</button><button class="pri" data-pg="start2">Starta</button></div>`,'pgtwo');
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-pg]'); if(!b) return; const a=b.dataset.pg;
    const nm=()=>(document.getElementById('nm')?.value||'').trim();
    switch(a){
      case 'lvl': pLevel=b.dataset.l; lsSet('pg_lvl',pLevel); document.getElementById('pgLvl').innerHTML=lvlH(); sfx.bubble(); return;
      case 'bonus': pBonus=b.dataset.v==='1'; lsSet('pg_bonus',pBonus?'1':'0'); document.getElementById('pgBon').innerHTML=bonH(); sfx.bubble(); return;
      case 'menu': showPongMenu(); return;
      case 'two': { const n=nm(); if(n) lsSet('ry_name',n); showTwo(); return; }
      case 'ai': { const n=nm()||'Du'; lsSet('ry_name',n); unlockAudio(); pending={bonus:pBonus, local2:false}; pFresh=true; startGameLocal('pong', n, pLevel, 1); return; }
      case 'start2': { const n1=nm()||'Blå', n2=(document.getElementById('nm2')?.value||'').trim()||'Rosa'; lsSet('ry_name',n1); lsSet('pg_name2',n2); unlockAudio();
        pending={bonus:pBonus, local2:true}; pFresh=true; startGameLocal('pong', n1, 'medium', 1); G.names[1]=n2; G.ai=[false,false]; lsSet('ry_local', JSON.stringify(G)); render(); return; }
      case 'host': { const n=nm(); if(!n){ toast('Skriv ditt namn 🐬'); return; } lsSet('ry_name',n); unlockAudio(); closeModal(); pending={bonus:pBonus, local2:false}; pFresh=true; hostGame(n,'free','pong'); return; }
      case 'resign': { if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Säker? Tryck igen'; return; } doAct({type:'resign', who:0}); return; }
    }
  });
  pending={bonus:pBonus, local2:false};

  /* ---------- stil ---------- */
  const st=document.createElement('style'); st.textContent=`
.pg-wrap{position:relative;display:flex;justify-content:center;margin:4px auto 0}
.pg-host{display:flex;justify-content:center;width:100%}
.pg-cv{display:block;border-radius:18px;border:1px solid rgba(148,163,255,.25);box-shadow:0 0 40px rgba(99,102,241,.25);touch-action:none;user-select:none;-webkit-user-select:none}
.pg-over{position:absolute;inset:0;display:grid;place-items:center;padding:16px}
.pg-over .gover{max-width:320px;background:rgba(11,16,40,.88);backdrop-filter:blur(6px)}
.pg-hint{margin-top:8px}
`; document.head.appendChild(st);

  return { net:onNet, __test: (typeof DEV!=='undefined' && DEV) ? { state:()=>P, predictX, step:(dt)=>{ if(!P||P.gid!==G.id) P=fresh(); step(dt); }, LV } : undefined };
})();
