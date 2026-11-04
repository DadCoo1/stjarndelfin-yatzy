/* =====================================================================
   slalom.js – Slalom och storslalom i Vemdalsfjällen
   • kameran bakom åkaren (pseudo-3D på canvas), animeinspirerad stil
   • ensam, parallellslalom mot datorn eller online mot en kompis
   • online: var och en kör sin egen åkare; positionen skickas ({t:'sl'})
     så att motståndaren syns i grannbanan, tiden skickas som ett drag
   ===================================================================== */
'use strict';
const SLALOM = (()=>{
  /* ---------- banan ---------- */
  const DISC={
    gs:{name:'Storslalom', short:'SL', gates:24, gap:24, swing:6.5, half:2.6, slope:.31, drag:.0038, turn:1.45, maxHead:1.0, fric:.10, panel:true,  piste:24},
    sl:{name:'Slalom',     short:'SL', gates:36, gap:10.5, swing:3.2, half:2.0, slope:.25, drag:.0068, turn:2.6, maxHead:1.05, fric:.075, panel:false, piste:19}
  };
  const PAR={gates:{gs:20,sl:28}, lane:8.5};
  function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  // mittlinjen svänger mjukt så att backen känns levande
  const mid = z => 7*Math.sin(z/170) + 3.5*Math.sin(z/63+1.3);
  function course(g){
    const d=DISC[g.disc], r=rng(g.seed), par=g.par, n=par?PAR.gates[g.disc]:d.gates;
    const lanes = par ? [-PAR.lane, PAR.lane] : [0];
    const start=26, gates=lanes.map(()=>[]);
    let z=start;
    for(let i=0;i<n;i++){
      const side = i%2===0 ? 1 : -1;
      const jitter = (r()-.5)*d.swing*.5, gz=(r()-.5)*d.gap*.25;
      // ibland en "fördröjd" port med längre avstånd, som i riktiga banor
      const extra = !par && i>3 && r()<.12 ? d.gap*.6 : 0;
      z += d.gap + extra + gz*0;
      lanes.forEach((L,k)=>{ const s = k===1 ? -side : side;     // parallellbanorna är spegelvända
        const cx = mid(z) + L + s*(d.swing+jitter*(k===1?-1:1));
        gates[k].push({z, cx, x0:cx-d.half, x1:cx+d.half, side:s, col: par ? (k===0?'r':'b') : (i%2===0?'r':'b'), hit:0, pass:null}); });
    }
    const L = z + d.gap*1.6;
    return {d, gates, lanes, L, half: par ? d.piste*.5+PAR.lane+6 : d.piste*.5};
  }

  /* ---------- tillstånd under ett åk (inte i G) ---------- */
  let R=null, cv=null, ctx=null, raf=0, lastT=0, W=360, H=640, sendT=0, pend={disc:'gs',par:false,pen:true}, fresh=false;
  const keys={}; let steer=0, drag=null;
  function newRun(){
    const C=course(G), me=meSeat();
    const mkSk=(k,isAIsk)=>({k, x: mid(0)+(C.lanes[k]||0), z:2, v:0, th:0, om:0, t:0, done:false, dsq:false, missed:0, pen:0, gi:0, ai:isAIsk, lean:0, trail:[], last:{}});
    const sk = G.par ? [mkSk(0,isAI(0)&&mode==='local'), mkSk(1,isAI(1)&&mode==='local')] : [mkSk(0,false)];
    R={gid:G.id+':'+(G.go||0), C, sk, me: G.par?me:0, cd:3.2, started:false, t0:0, parts:[], shake:0, flash:null, finishT:0, sent:false, cheer:0, beeped:-1,
       remote: null, splitAt: C.gates[0][Math.floor(C.gates[0].length/2)].z, split:null};
  }
  const meSk = () => R.sk[R.me];

  /* ---------- fysik ---------- */
  function physics(s,dt,input){
    const d=R.C.d;
    if(s.done){ s.v=Math.max(0,s.v-14*dt); s.th*=Math.pow(.2,dt); s.z+=s.v*Math.cos(s.th)*dt; s.x+=s.v*Math.sin(s.th)*dt; return; }
    const target = input*d.maxHead;
    const om = Math.max(-d.turn, Math.min(d.turn, (target-s.th)*6));
    s.th += om*dt; s.om=om;
    const a = 9.81*d.slope*Math.cos(s.th) - d.drag*s.v*s.v - d.fric*Math.abs(om)*s.v - (s.dragExtra||0);
    s.v = Math.max(0, s.v + a*dt);
    if(s.v<1.5 && Math.abs(s.th)>.9) s.v=1.5;                      // aldrig helt stilla på tvären
    const pz=s.z, px=s.x;
    s.z += s.v*Math.cos(s.th)*dt; s.x += s.v*Math.sin(s.th)*dt; s.t += dt;
    s.lean += ((om/d.turn)*.9 - s.lean)*Math.min(1,dt*8);
    // utanför pisten: djupsnö bromsar, staketet stoppar
    const lim = R.C.half+2.5, off = Math.abs(s.x-mid(s.z))-R.C.half;
    if(off>0){ s.v*=Math.pow(.55,dt); }
    if(Math.abs(s.x-mid(s.z))>lim){ s.x=mid(s.z)+Math.sign(s.x-mid(s.z))*lim; s.th*=.5; }
    // portar
    const gs=R.C.gates[s.k]; const g=gs[s.gi];
    if(g && pz<g.z && s.z>=g.z){
      const f=(g.z-pz)/(s.z-pz||1), xg=px+(s.x-px)*f;
      const ok = xg>=g.x0-.35 && xg<=g.x1+.35;
      const nearPole = Math.min(Math.abs(xg-g.x0),Math.abs(xg-g.x1));
      if(ok){ g.pass=true; if(nearPole<.55){ g.hit=1; s.v*=.97; if(s===meSk()) poleSfx(); } }
      else { g.pass=false; s.missed++; if(G.pen){ s.pen+=3; if(s===meSk()){ toast('Missad port +3 s',1300); sfx.unbubble(); } }
        else { s.dsq=true; s.done=true; if(s===meSk()){ toast('Ur! Missad port 😬',2200); sfx.unbubble(); } } }
      s.gi++;
      if(s===meSk() && s.gi===Math.floor(gs.length/2) && !R.split) R.split=s.t;
    }
    if(!s.done && s.z>=R.C.L){ s.done=true; s.finish=s.t+s.pen; if(s===meSk()) finishSfx(); }
    s.trail.push(s.x, s.z); if(s.trail.length>240) s.trail.splice(0,2);
  }
  // datorn: siktar på nästa ports mitt, lite innanför, och börjar svängen i tid
  const AILV={easy:{gain:1.5,cap:.74,late:.5,wob:0,slow:.45}, medium:{gain:1.5,cap:.86,late:.47,wob:0,slow:.2}, hard:{gain:1.55,cap:1,late:.44,wob:0,slow:0}};
  function aiInput(s,lv,dt){
    const P=AILV[lv]||AILV.medium, gs=R.C.gates[s.k], d=R.C.d;
    const g=gs[s.gi]; if(!g) return 0;
    // sikta på portens mitt (lite mot insidan); i god tid före porten börjar siktet glida mot nästa port
    const aim=q=>q.cx - q.side*d.half*.3;
    let tx=aim(g), tz=g.z;
    const nx=gs[s.gi+1], lead=s.v*P.late;
    if(nx && g.z-s.z < lead){ const f=1-(g.z-s.z)/lead; tx=tx+(aim(nx)-tx)*f*.5; }
    tx=Math.max(g.x0+.7, Math.min(g.x1-.7, tx));            // siktet ligger alltid inne i porten
    const want=Math.atan2(tx-s.x, Math.max(1.5,tz-s.z));
    s.wob=(s.wob||0)+dt; const wob=Math.sin(s.wob*2.3)*P.wob;
    s.dragExtra = (s.v > (d===DISC.gs?27:17.5)*P.cap ? 2.5 : 0) + P.slow;
    return Math.max(-1,Math.min(1,want*P.gain/d.maxHead + wob));
  }

  /* ---------- ljud ---------- */
  function poleSfx(){ tone(1300,.05,'square',.06); hit(0,2400,.25,.03); buzz(10); }
  function finishSfx(){ [523,659,784,1047].forEach((f,i)=>tone(f,.25,'triangle',.09,i*.1)); crowd(1.2,.35); }
  function crowd(sec,vol){ if(sfxOff()||!AC) return; try{ const t=AC.currentTime, s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain();
    s.buffer=noiseBuf(sec); f.type='bandpass'; f.frequency.value=900; f.Q.value=.6; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.15); g.gain.exponentialRampToValueAtTime(.0001,t+sec);
    s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t+sec+.05); }catch(e){} }
  let windG=null, windS=null;
  function wind(v){ if(sfxOff()||!AC){ return; } try{
      if(!windG){ windS=AC.createBufferSource(); windS.buffer=noiseBuf(2); windS.loop=true; const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700; windG=AC.createGain(); windG.gain.value=0; windS.connect(f).connect(windG).connect(AC.destination); windS.start(); }
      windG.gain.setTargetAtTime(Math.min(.09, v*v*.00012), AC.currentTime, .15); }catch(e){} }
  function windOff(){ if(windG) try{ windG.gain.setTargetAtTime(0,AC.currentTime,.1); }catch(e){} }

  /* ---------- förritade bilder (fjäll, dal, träd, publik) ---------- */
  const SPR={};
  function off(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return [c,c.getContext('2d')]; }
  function makeTree(kind){
    const [c,x]=off(80,150); const cx=40;
    if(kind==='birch'){ x.strokeStyle='#e8e2d6'; x.lineWidth=5; x.beginPath(); x.moveTo(cx,150); x.lineTo(cx-3,40); x.stroke(); x.strokeStyle='#3b3a37'; x.lineWidth=1.5; for(let y=60;y<145;y+=13){ x.beginPath(); x.moveTo(cx-4,y); x.lineTo(cx+1,y+2); x.stroke(); }
      x.strokeStyle='#6b5b52'; x.lineWidth=1.3; for(let k=0;k<14;k++){ const y=40+k*6, s=k%2?1:-1; x.beginPath(); x.moveTo(cx-2,y); x.quadraticCurveTo(cx+s*12,y-4,cx+s*(16+k%3*4),y+10); x.stroke(); }
      x.fillStyle='rgba(255,255,255,.85)'; for(let k=0;k<10;k++){ x.beginPath(); x.ellipse(cx+(k%2?10:-10)+(k*3%7-3),48+k*8,6,2.4,0,0,7); x.fill(); }
      return c; }
    // gran med snö – mörka lager, ljusa snökanter
    x.fillStyle='#3d2b1f'; x.fillRect(cx-3,128,6,22);
    const layers=7;
    for(let i=0;i<layers;i++){ const t=i/(layers-1), y=10+t*112, w=8+t*30;
      x.fillStyle=i%2?'#1f4d3a':'#245a43'; x.beginPath(); x.moveTo(cx,y-14); x.lineTo(cx-w,y+12); x.quadraticCurveTo(cx,y+4,cx+w,y+12); x.closePath(); x.fill();
      x.fillStyle='#163a2c'; x.beginPath(); x.moveTo(cx,y-14); x.lineTo(cx+w,y+12); x.quadraticCurveTo(cx+w*.5,y+8,cx+2,y+6); x.closePath(); x.fill();
      x.fillStyle='rgba(248,252,255,.95)'; x.beginPath(); x.moveTo(cx-w*.9,y+9); x.quadraticCurveTo(cx-w*.3,y+1,cx+w*.15,y+5); x.quadraticCurveTo(cx-w*.3,y+7,cx-w*.9,y+11); x.fill();
      x.fillStyle='rgba(205,225,245,.9)'; x.beginPath(); x.moveTo(cx+w*.2,y+5); x.quadraticCurveTo(cx+w*.6,y+3,cx+w*.85,y+10); x.quadraticCurveTo(cx+w*.5,y+8,cx+w*.2,y+7); x.fill(); }
    x.fillStyle='#fff'; x.beginPath(); x.ellipse(cx,4,3.5,6,0,0,7); x.fill();
    return c;
  }
  const JACKETS=['#e11d48','#2563eb','#f59e0b','#16a34a','#7c3aed','#0891b2','#f97316','#db2777','#facc15','#334155'];
  function makeFan(i){
    const [c,x]=off(26,56); const col=JACKETS[i%JACKETS.length], hat=JACKETS[(i*3+2)%JACKETS.length];
    x.fillStyle='#1e293b'; x.fillRect(8,40,4,14); x.fillRect(14,40,4,14);
    x.fillStyle=col; x.beginPath(); x.roundRect(5,20,16,23,5); x.fill();
    x.fillStyle='rgba(0,0,0,.18)'; x.fillRect(13,20,8,23);
    const up=i%3===0; x.strokeStyle=col; x.lineWidth=4; x.lineCap='round'; x.beginPath();
    if(up){ x.moveTo(6,23); x.lineTo(1,8); x.moveTo(20,23); x.lineTo(25,8); } else { x.moveTo(6,24); x.lineTo(3,36); x.moveTo(20,24); x.lineTo(23,36); } x.stroke();
    x.fillStyle='#f5d0b5'; x.beginPath(); x.arc(13,14,6,0,7); x.fill();
    x.fillStyle=hat; x.beginPath(); x.arc(13,12,6.3,Math.PI,0); x.fill(); x.beginPath(); x.arc(13,4.5,2.6,0,7); x.fill();
    if(i%5===1){ x.fillStyle='#fff'; x.fillRect(1,0,1.5,9); }   // liten flagga
    return c;
  }
  // bakgrunden: himmel, rundade fjäll, dalen med byn och kyrkan
  function makeBackdrop(w,h){
    const hz=Math.round(h*HZ), vb=Math.round(h*VB);
    const [c,x]=off(w*2, hz+vb+4);
    const g=x.createLinearGradient(0,0,0,hz); g.addColorStop(0,'#5b8fd6'); g.addColorStop(.55,'#a9c7ee'); g.addColorStop(.85,'#f6d5d9'); g.addColorStop(1,'#ffe3c4');
    x.fillStyle=g; x.fillRect(0,0,c.width,hz+vb+4);
    // låg vintersol
    const sx=c.width*.62, sy=hz*.82; const sg=x.createRadialGradient(sx,sy,2,sx,sy,hz*.6); sg.addColorStop(0,'rgba(255,240,200,.95)'); sg.addColorStop(.12,'rgba(255,214,170,.6)'); sg.addColorStop(1,'rgba(255,214,170,0)'); x.fillStyle=sg; x.fillRect(0,0,c.width,hz+vb);
    // moln i animestil
    const cl=(cx,cy,s)=>{ x.fillStyle='rgba(255,255,255,.85)'; [[0,0,1],[.9,-.25,.8],[1.7,.05,.7],[-.8,.1,.7]].forEach(([dx,dy,r])=>{ x.beginPath(); x.arc(cx+dx*s,cy+dy*s,r*s*.7,0,7); x.fill(); }); x.fillStyle='rgba(214,224,245,.55)'; x.fillRect(cx-s*1.2,cy+s*.25,s*3.1,s*.2); };
    cl(c.width*.18,hz*.22,26); cl(c.width*.47,hz*.12,18); cl(c.width*.8,hz*.3,22); cl(c.width*1.15,hz*.18,24); cl(c.width*1.6,hz*.26,20);
    // fjäll: tre lager mjuka rundade toppar (Vemdalsfjällen – kalfjäll ovan trädgränsen)
    const fell=(base,amp,seed,colTop,colShade,tree)=>{ const r=rng(seed); const pts=[]; let p=0; const N=9;
      for(let i=0;i<=N;i++){ const xx=i/N*c.width; const top=base-amp*(.45+.55*Math.abs(Math.sin(i*1.1+seed)))*(.8+r()*.4); pts.push([xx,top]); }
      x.beginPath(); x.moveTo(0,hz+2); x.lineTo(pts[0][0],pts[0][1]);
      for(let i=1;i<pts.length;i++){ const [a,b]=pts[i-1], [cxx,cy]=pts[i]; x.bezierCurveTo(a+(cxx-a)*.45,b,a+(cxx-a)*.55,cy,cxx,cy); }
      x.lineTo(c.width,hz+2); x.closePath();
      const gg=x.createLinearGradient(0,base-amp,0,hz); gg.addColorStop(0,colTop); gg.addColorStop(1,colShade); x.fillStyle=gg; x.fill();
      // skuggsida med cel-skuggning
      x.save(); x.clip();
      for(let i=0;i<pts.length;i++){ const [px,py]=pts[i]; const sg=x.createRadialGradient(px+c.width/N*.35,py+(hz-py)*.55,4,px+c.width/N*.35,py+(hz-py)*.55,c.width/N*.55);
        sg.addColorStop(0,'rgba(120,128,205,.30)'); sg.addColorStop(1,'rgba(120,128,205,0)'); x.fillStyle=sg; x.fillRect(px-c.width/N,py,c.width/N*2,hz-py); }
      if(tree){ // skog nedanför trädgränsen
        x.fillStyle=tree; const tl=base-amp*.15; for(let xx=0;xx<c.width;xx+=3){ const y=tl+Math.sin(xx*.05+seed)*4+r()*3; x.fillRect(xx,y,3,hz-y+2); }
        x.fillStyle='rgba(255,255,255,.35)'; for(let xx=0;xx<c.width;xx+=7){ const y=tl+Math.sin(xx*.05+seed)*4+r()*14; x.fillRect(xx,y,2,1.5); } }
      x.restore();
      x.strokeStyle='rgba(90,110,160,.25)'; x.lineWidth=1.2; x.stroke();
    };
    fell(hz*.66,hz*.22,3,'#f6f3ff','#c9c7ea',null);
    fell(hz*.82,hz*.2,7,'#f1f5fd','#a9bde0','#3d5d6e');
    fell(hz*.96,hz*.14,11,'#e5edf8','#93a9cf','#2c4a3d');
    // dalen nedanför horisonten: skog, frusen sjö, byn och den åttkantiga kyrkan
    const vg=x.createLinearGradient(0,hz,0,hz+vb); vg.addColorStop(0,'#c4d2e6'); vg.addColorStop(1,'#dfe8f4'); x.fillStyle=vg; x.fillRect(0,hz,c.width,vb+4);
    x.fillStyle='#cfe0f0'; x.beginPath(); x.ellipse(c.width*.3,hz+vb*.55,c.width*.12,vb*.18,0,0,7); x.fill(); x.fillStyle='rgba(255,255,255,.6)'; x.fillRect(c.width*.22,hz+vb*.52,c.width*.12,1);
    const rr=rng(99);
    x.fillStyle='#2f4f43'; for(let xx=0;xx<c.width;xx+=4){ if(rr()<.55){ const y=hz+rr()*vb*.4; x.beginPath(); x.moveTo(xx,y); x.lineTo(xx+2,y-5-rr()*4); x.lineTo(xx+4,y); x.fill(); } }
    // röda hus med vita knutar
    for(let k=0;k<26;k++){ const hx=c.width*(.38+rr()*.5), hy=hz+vb*(.35+rr()*.5), s=3+rr()*2.5;
      x.fillStyle='#a3271f'; x.fillRect(hx,hy,s*2,s); x.fillStyle='#fff'; x.fillRect(hx,hy,.7,s); x.fillRect(hx+s*2-.7,hy,.7,s); x.fillStyle='#3b3b45'; x.beginPath(); x.moveTo(hx-.6,hy); x.lineTo(hx+s,hy-s*.7); x.lineTo(hx+s*2+.6,hy); x.fill();
      x.fillStyle='rgba(255,255,255,.9)'; x.beginPath(); x.moveTo(hx-.3,hy-.2); x.lineTo(hx+s,hy-s*.7); x.lineTo(hx+s*2+.3,hy-.2); x.lineTo(hx+s,hy-s*.45); x.fill();
      if(rr()<.5){ x.fillStyle='#ffe08a'; x.fillRect(hx+s*.6,hy+s*.35,1.2,1.2); } }
    // Vemdalens åttkantiga kyrka: vit med svart lökkupol, och klockstapeln bredvid
    const kx=c.width*.55, ky=hz+vb*.62;
    x.fillStyle='#fdfdfd'; x.fillRect(kx-7,ky-10,14,10); x.fillStyle='#2b2b33'; x.beginPath(); x.moveTo(kx-8,ky-10); x.lineTo(kx,ky-16); x.lineTo(kx+8,ky-10); x.fill();
    x.fillStyle='#fdfdfd'; x.fillRect(kx-2.5,ky-21,5,6); x.fillStyle='#2b2b33'; x.beginPath(); x.ellipse(kx,ky-23,3,3.2,0,0,7); x.fill(); x.fillRect(kx-.4,ky-30,.8,5);
    x.fillStyle='#fdfdfd'; x.fillRect(kx+12,ky-12,4,12); x.fillStyle='#2b2b33'; x.beginPath(); x.moveTo(kx+11,ky-12); x.lineTo(kx+14,ky-18); x.lineTo(kx+17,ky-12); x.fill();
    // ljusare dis närmast
    const hz2=x.createLinearGradient(0,hz-6,0,hz+vb); hz2.addColorStop(0,'rgba(255,236,226,.45)'); hz2.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=hz2; x.fillRect(0,hz-6,c.width,vb+10);
    return c;
  }
  function sprites(){ if(SPR.ok) return; SPR.tree=[makeTree('spruce'),makeTree('spruce2'),makeTree('birch')]; SPR.fan=Array.from({length:12},(_,i)=>makeFan(i)); SPR.ok=1; }

  /* ---------- projektion ---------- */
  const HZ=.25, VB=.07, CAMH=3.1, BACK=5.0, ZMAX=210;
  let cam={x:0,z:0,yaw:0,roll:0}, F=500, KY=.92;
  function P(x,z,y=0){ const dz=z-cam.z; if(dz<.3) return null; const xs=x-cam.x-(dz)*Math.tan(cam.yaw);
    return [W/2 + xs*F/dz, H*(HZ+VB) + (CAMH-y)*F/dz*KY, F/dz]; }

  /* ---------- ritning ---------- */
  let BD=null, BDsize='';
  function drawScene(dt){
    const s=meSk(); const C=R.C;
    // kamera: bakom och lite ovanför, vrider sig med åkaren
    const tx=s.x-Math.sin(s.th)*2.2, tz=s.z-BACK;
    cam.x += (tx-cam.x)*Math.min(1,dt*6); cam.z=tz; cam.yaw += (s.th*.42-cam.yaw)*Math.min(1,dt*4); cam.roll += (-s.lean*.07-cam.roll)*Math.min(1,dt*5);
    F=Math.min(W,H)*1.05; KY=(.80-(HZ+VB))*H/(CAMH*F/BACK);
    ctx.save();
    const sh=R.shake>0?(Math.random()-.5)*R.shake*8:0;
    ctx.translate(W/2+sh,H*.6); ctx.rotate(cam.roll); ctx.translate(-W/2,-H*.6);
    // bakgrund
    const key=W+'x'+H; if(BDsize!==key){ BD=makeBackdrop(W,H); BDsize=key; }
    const off=((cam.x*1.4 + cam.yaw*W*.9)%W+W)%W; ctx.drawImage(BD,-W*.5-off,0,BD.width,BD.height); ctx.drawImage(BD,-W*.5-off+BD.width,0,BD.width,BD.height);
    // marken: remsor bakifrån och fram
    const top=H*(HZ+VB);
    const zs=[]; for(let dz=ZMAX; dz>.6; dz-= Math.max(.6, dz*.06)) zs.push(cam.z+dz);
    let prev=null;
    for(const z of zs){ const m=mid(z), pL=P(m-C.half,z), pR=P(m+C.half,z), oL=P(m-C.half-60,z), oR=P(m+C.half+60,z); if(!pL) continue;
      if(prev){ const far=Math.min(1,(z-cam.z)/ZMAX);
        // terrängen utanför pisten (lös snö, lite blåare)
        ctx.fillStyle=`rgb(${226-far*14},${234-far*10},${246-far*4})`; quad(prev.oL,prev.oR,oR,oL);
        // pisten: preparerad, randig ”manchester”
        const band = Math.floor(z/5)%2;
        ctx.fillStyle = band ? `rgb(${246-far*16},${250-far*12},${255-far*6})` : `rgb(${242-far*16},${247-far*12},${254-far*6})`;
        quad(prev.pL,prev.pR,pR,pL);
        if(z>C.L && z<C.L+80){ ctx.fillStyle='rgba(239,68,68,.08)'; quad(prev.pL,prev.pR,pR,pL); }
      }
      prev={pL,pR,oL,oR}; }
    // preparerade "manchester"-ränder längs backen
    ctx.strokeStyle='rgba(165,185,215,.28)'; ctx.lineWidth=1;
    for(let lx=-C.half+1; lx<C.half; lx+=1.6){ ctx.beginPath(); let f=true; for(let dz=1; dz<70; dz+=dz<10?1:4){ const z=cam.z+dz, p=P(mid(z)+lx,z); if(!p) continue; f?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]); f=false; } ctx.stroke(); }
    // mål- och startlinjer
    line3d(C.L,'#ef4444',.35);
    // spår i snön längs idealsvängarna (tidigare åkare)
    ctx.strokeStyle='rgba(150,170,200,.35)'; ctx.lineWidth=1.2;
    C.gates.forEach(gs=>{ ctx.beginPath(); let first=true; for(let i=0;i<gs.length;i++){ const g=gs[i]; if(g.z<cam.z+1||g.z>cam.z+ZMAX) continue; const p=P(g.cx-g.side*C.d.half*.4,g.z); if(!p) continue; first?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]); first=false; } ctx.stroke(); });
    // åkarens egna spår
    ctx.strokeStyle='rgba(130,150,185,.5)'; ctx.lineWidth=1.5;
    for(const sk of R.sk){ if(sk===s) continue; ctx.beginPath(); let f=true; for(let i=0;i<sk.trail.length;i+=2){ const p=P(sk.trail[i],sk.trail[i+1]); if(!p){ f=true; continue; } f?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]); f=false; } ctx.stroke(); }
    // föremål sorterade bakifrån
    const objs=[];
    const zA=cam.z+.8, zB=cam.z+ZMAX;
    // träd, staket och publik längs kanterna (bestämda av z, så de står stilla)
    for(let z=Math.ceil(zA/6)*6; z<zB; z+=6){ const m=mid(z), r=rng(Math.round(z)*7+1);
      for(const sd of [-1,1]){
        objs.push({z, t:'fence', x:m+sd*(C.half+1.2), sd});
        for(let k=0;k<3;k++){ const xx=m+sd*(C.half+6+r()*28+k*9); objs.push({z:z+r()*5, t:'tree', x:xx, v:r()<.18?2:(r()<.5?0:1), s:.85+r()*.6}); }
        const crowdZone = (z>C.L-70&&z<C.L+10) || ((Math.floor(z/90)%3===1) && z<C.L) || z<40;
        if(crowdZone){ for(let k=0;k<4;k++) objs.push({z:z+k*1.4, t:'fan', x:m+sd*(C.half+2.3+r()*2.5), v:Math.floor(r()*12), ph:r()*6}); }
        if(z%48===0) objs.push({z, t:'banner', x:m+sd*(C.half+1.25), sd});
      } }
    C.gates.forEach((gs,k)=>gs.forEach((g,i)=>{ if(g.z>zA-1&&g.z<zB) objs.push({z:g.z, t:'gate', g, i, k}); }));
    objs.push({z:C.L, t:'finish'});
    R.sk.forEach(sk=>{ if(sk!==s && sk.z>zA) objs.push({z:sk.z, t:'skier', sk}); });
    objs.sort((a,b)=>b.z-a.z);
    for(const o of objs) drawObj(o);
    // snöstänk
    R.parts=R.parts.filter(p=>(p.t-=dt)>0);
    for(const p of R.parts){ p.x+=p.vx*dt; p.z+=p.vz*dt; p.y+=p.vy*dt; p.vy-=9*dt; const q=P(p.x,p.z,Math.max(0,p.y)); if(!q) continue; ctx.globalAlpha=Math.min(1,p.t*2); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(q[0],q[1],Math.max(1,q[2]*.06),0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    // egen åkare
    drawSkier(s, null, true);
    ctx.restore();
    hud();
  }
  function quad(a,b,c,d){ ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]); ctx.lineTo(d[0],d[1]); ctx.closePath(); ctx.fill(); }
  function line3d(z,col,w){ const m=mid(z), a=P(m-R.C.half,z), b=P(m+R.C.half,z); if(!a) return; ctx.strokeStyle=col; ctx.lineWidth=Math.max(1,w*a[2]); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); }
  function drawObj(o){
    const C=R.C, now=performance.now()/1000;
    if(o.t==='tree'){ const p=P(o.x,o.z); if(!p) return; const img=SPR.tree[o.v]; const h=p[2]*7.5*o.s, w=h*img.width/img.height; if(p[0]+w<0||p[0]-w>W) return; ctx.drawImage(img,p[0]-w/2,p[1]-h,w,h); return; }
    if(o.t==='fan'){ const p=P(o.x,o.z); if(!p) return; const img=SPR.fan[o.v]; const h=p[2]*1.75, w=h*img.width/img.height; if(h<1.5) return; const jump=Math.max(0,Math.sin(now*6+o.ph))*h*.12*(Math.abs(o.z-meSk().z)<40?1:.3);
      ctx.drawImage(img,p[0]-w/2,p[1]-h-jump,w,h);
      if(o.v%4===2 && h>8){ ctx.fillStyle=o.v%8===2?'#006aa7':'#e11d48'; const fx=p[0]+w*.45, fy=p[1]-h*1.15-jump; ctx.fillRect(fx,fy,1,h*.5); ctx.beginPath(); ctx.moveTo(fx,fy); ctx.quadraticCurveTo(fx+h*.25,fy+h*.08+Math.sin(now*8+o.ph)*h*.05,fx+h*.42,fy+h*.05); ctx.lineTo(fx+h*.42,fy+h*.25); ctx.quadraticCurveTo(fx+h*.2,fy+h*.3,fx,fy+h*.22); ctx.fill();
        if(o.v%8===2){ ctx.fillStyle='#fecc00'; ctx.fillRect(fx+h*.1,fy+h*.04,h*.06,h*.22); ctx.fillRect(fx,fy+h*.11,h*.42,h*.05); } }
      return; }
    if(o.t==='fence'){ const z2=o.z+6, m2=mid(z2), a=P(o.x,o.z), b=P(m2+o.sd*(C.half+1.2),z2); if(!a||!b) return; const ha=a[2]*1.1, hb=b[2]*1.1;
      ctx.fillStyle='rgba(37,99,235,.55)'; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(b[0],b[1]-hb); ctx.lineTo(a[0],a[1]-ha); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(30,64,175,.8)'; ctx.lineWidth=Math.max(.5,a[2]*.05); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(a[0],a[1]-ha); ctx.stroke(); return; }
    if(o.t==='banner'){ const a=P(o.x,o.z), b=P(mid(o.z+4)+o.sd*(C.half+1.25),o.z+4); if(!a||!b) return; const ha=a[2]*.8;
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(a[0],a[1]-a[2]*.15); ctx.lineTo(b[0],b[1]-b[2]*.15); ctx.lineTo(b[0],b[1]-b[2]*.95); ctx.lineTo(a[0],a[1]-a[2]*.95); ctx.closePath(); ctx.fill();
      if(ha>6){ ctx.save(); ctx.fillStyle='#e11d48'; ctx.font=`800 ${Math.max(6,ha*.55)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; const txt=['VEMDALEN','KRYA PÅ DIG 💙','FRÖKNARNA','HEJA! 🐬'][Math.floor(o.z/48)%4];
        ctx.translate((a[0]+b[0])/2,(a[1]+b[1])/2-ha*.55); ctx.fillText(txt,0,0); ctx.restore(); } return; }
    if(o.t==='finish'){ const m=mid(o.z), a=P(m-C.half-1,o.z), b=P(m+C.half+1,o.z); if(!a) return; const h=a[2]*4.2;
      ctx.fillStyle='#1e3a8a'; ctx.fillRect(a[0]-a[2]*.3,a[1]-h,a[2]*.6,h); ctx.fillRect(b[0]-b[2]*.3,b[1]-h,b[2]*.6,h);
      const g=ctx.createLinearGradient(0,a[1]-h,0,a[1]-h*.7); g.addColorStop(0,'#ef4444'); g.addColorStop(1,'#b91c1c'); ctx.fillStyle=g; ctx.fillRect(a[0],a[1]-h,b[0]-a[0],h*.28);
      if(h>10){ ctx.fillStyle='#fff'; ctx.font=`900 ${h*.18}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('MÅL · VEMDALEN',(a[0]+b[0])/2,a[1]-h*.86); } return; }
    if(o.t==='gate'){ drawGate(o.g,o.i,o.k); return; }
    if(o.t==='skier'){ drawSkier(o.sk, P(o.sk.x,o.sk.z), false); return; }
  }
  function drawGate(g,i,k){
    const C=R.C, a=P(g.x0,g.z), b=P(g.x1,g.z); if(!a||!b) return;
    const col = g.col==='r' ? '#ef4444' : '#2563eb', dark = g.col==='r' ? '#991b1b' : '#1e3a8a';
    const h=a[2]*1.85, pw=Math.max(1,a[2]*.045);
    const bend = g.hit ? Math.max(0,1-(performance.now()-(g.hitT||(g.hitT=performance.now())))/600)*.5 : 0;
    // skugga
    ctx.fillStyle='rgba(80,110,160,.18)'; ctx.beginPath(); ctx.ellipse((a[0]+b[0])/2+a[2]*.5,a[1]+1,(b[0]-a[0])/2,a[2]*.1,0,0,7); ctx.fill();
    const pole=(p,bnd)=>{ ctx.strokeStyle=col; ctx.lineWidth=pw*2; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.quadraticCurveTo(p[0]+bnd*h*.3,p[1]-h*.5,p[0]+bnd*h*.6,p[1]-h*.95); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=pw*.6; ctx.beginPath(); ctx.moveTo(p[0]-pw*.4,p[1]-h*.1); ctx.lineTo(p[0]-pw*.4+bnd*h*.5,p[1]-h*.85); ctx.stroke(); };
    pole(a, g.side<0?bend:0); pole(b, g.side>0?-bend:0);
    if(C.d.panel){ // storslalom: ett stångpar med flagga på var sida om porten
      const t=performance.now()/1000;
      [[g.x0-.8,g.x0],[g.x1,g.x1+.8]].forEach(([xa,xb],j)=>{ const pa=P(xa,g.z), pb=P(xb,g.z); if(!pa||!pb) return; const wv=Math.sin(t*3+i+j)*h*.025;
        if(j===0) pole(pa,0); else pole(pb,0);
        ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(pa[0],pa[1]-h*.95); ctx.quadraticCurveTo((pa[0]+pb[0])/2,pa[1]-h*.95+wv,pb[0],pb[1]-h*.95); ctx.lineTo(pb[0],pb[1]-h*.5); ctx.quadraticCurveTo((pa[0]+pb[0])/2,pa[1]-h*.5+wv,pa[0],pa[1]-h*.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc((pa[0]+pb[0])/2,pa[1]-h*.72+wv*.5,Math.max(.8,(pb[0]-pa[0])*.22),0,7); ctx.fill();
        ctx.fillStyle=dark; ctx.fillRect(pa[0],pa[1]-h*.52,pb[0]-pa[0],Math.max(.5,h*.02)); });
    } else if(h>18){ // slalom: små flaggor på stängerna
      [a,b].forEach(p=>{ ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(p[0],p[1]-h*.95); ctx.lineTo(p[0]+h*.2,p[1]-h*.88); ctx.lineTo(p[0],p[1]-h*.8); ctx.fill(); }); }
    if(g.pass===false){ ctx.fillStyle='rgba(239,68,68,.9)'; ctx.font=`900 ${Math.max(10,h*.5)}px system-ui`; ctx.textAlign='center'; ctx.fillText('✕',(a[0]+b[0])/2,a[1]-h*.3); }
  }
  // åkaren bakifrån: hjälm, glasögonband, tävlingsdräkt, stavar och skidor
  function drawSkier(s, p, me){
    let x,y,sc;
    if(me){ x=W/2+(s.x-cam.x-BACK*Math.tan(cam.yaw))*F/BACK; y=H*.80; sc=F/BACK; }
    else { if(!p) return; [x,y,sc]=p; }
    const u=sc*(me?.0145:.0128), L=s.lean, tuck=Math.max(0,1-Math.abs(L)*1.5)*Math.min(1,s.v/14);
    const suit = s.k===0 ? ['#e11d48','#f9a8d4','#fde047'] : ['#2563eb','#93c5fd','#f8fafc'];
    if(me && R.sk.length===1) suit[0]='#7c3aed', suit[1]='#22d3ee', suit[2]='#fde047';
    ctx.save(); ctx.translate(x,y); ctx.scale(u,u);
    // skugga
    ctx.fillStyle='rgba(70,100,150,.25)'; ctx.beginPath(); ctx.ellipse(10+L*20,2,46,9,0,0,7); ctx.fill();
    ctx.rotate(L*.45);
    // skidor (lite utåt i svängen)
    const sp=10+Math.abs(L)*6;
    ctx.fillStyle='#111827'; [-1,1].forEach(d=>{ ctx.save(); ctx.translate(d*sp,0); ctx.rotate(-s.th*.15+d*.02); ctx.beginPath(); ctx.roundRect(-4,-6,8,22,3); ctx.fill(); ctx.fillStyle=suit[1]; ctx.fillRect(-4,-6,8,3); ctx.fillStyle='#111827'; ctx.restore(); });
    // pjäxor
    ctx.fillStyle=suit[2]==='#f8fafc'?'#e2e8f0':'#facc15'; [-1,1].forEach(d=>{ ctx.beginPath(); ctx.roundRect(d*sp-7,-18,14,16,4); ctx.fill(); });
    // ben
    const crouch=20+tuck*14;
    ctx.fillStyle=suit[0]; [-1,1].forEach(d=>{ ctx.beginPath(); ctx.moveTo(d*sp-6,-16); ctx.lineTo(d*(sp*.6)-8,-16-crouch); ctx.lineTo(d*(sp*.6)+8,-16-crouch); ctx.lineTo(d*sp+6,-16); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle='rgba(0,0,0,.15)'; ctx.beginPath(); ctx.moveTo(sp-6,-16); ctx.lineTo(sp*.6+8,-16-crouch); ctx.lineTo(sp*.6+2,-16-crouch); ctx.lineTo(sp-1,-16); ctx.fill();
    // kropp
    const by=-16-crouch, bh=50-tuck*16;
    const g=ctx.createLinearGradient(-22,0,22,0); g.addColorStop(0,suit[0]); g.addColorStop(.5,suit[1]); g.addColorStop(1,suit[0]);
    ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-17,by); ctx.quadraticCurveTo(-24,by-bh*.6,-14,by-bh); ctx.lineTo(14,by-bh); ctx.quadraticCurveTo(24,by-bh*.6,17,by); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.8)'; ctx.font='800 12px system-ui'; ctx.textAlign='center'; ctx.fillText(s.k===0?'1':'2',0,by-bh*.45);
    // armar och stavar
    const ay=by-bh*.8;
    [-1,1].forEach(d=>{ const hx=d*(26+tuck*-6)+L*6, hy=ay+18+tuck*6;
      ctx.strokeStyle=suit[0]; ctx.lineWidth=8; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(d*14,ay); ctx.lineTo(hx,hy); ctx.stroke();
      ctx.fillStyle='#111827'; ctx.beginPath(); ctx.arc(hx,hy,5,0,7); ctx.fill();
      ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(hx+d*(10+tuck*14),hy+(tuck?6:38)); ctx.stroke(); });
    // hjälm med glasögonband
    const hy=by-bh-14;
    ctx.fillStyle=suit[2]; ctx.beginPath(); ctx.ellipse(0,hy,15,16,0,0,7); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-5,hy-7,6,4,-.4,0,7); ctx.fill();
    ctx.fillStyle='#111827'; ctx.fillRect(-15,hy+1,30,5); ctx.fillStyle=suit[1]; ctx.fillRect(-6,hy+1,12,5);
    ctx.restore();
  }
  function hud(){
    const s=meSk(), C=R.C, t=R.started? (s.done? (s.finish??s.t) : s.t) : 0;
    ctx.fillStyle='rgba(15,23,42,.55)'; ctx.beginPath(); ctx.roundRect(10,10,150,58,14); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='800 26px ui-monospace,monospace'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(fmt(t+(s.done?0:s.pen)),20,16);
    ctx.font='600 12px system-ui'; ctx.fillStyle='#cbd5e1'; ctx.fillText(`Port ${Math.min(s.gi,C.gates[s.k].length)}/${C.gates[s.k].length} · ${Math.round(s.v*3.6)} km/h`,20,48);
    const best=bestOf(); if(R.split && s.gi>=Math.floor(C.gates[s.k].length/2) && s.gi<Math.floor(C.gates[s.k].length/2)+5 && best.split){ const d=R.split-best.split; ctx.fillStyle=d<=0?'#22c55e':'#ef4444'; ctx.font='800 20px system-ui'; ctx.fillText((d<=0?'−':'+')+Math.abs(d).toFixed(2),170,22); }
    if(R.sk.length>1){ const o=R.sk[1-R.me], dz=o.z-s.z; ctx.fillStyle='rgba(15,23,42,.55)'; ctx.beginPath(); ctx.roundRect(W-150,10,140,40,12); ctx.fill();
      ctx.fillStyle=o.k===0?'#fda4af':'#93c5fd'; ctx.font='700 13px system-ui'; ctx.textAlign='right'; ctx.fillText(`${bare(pname(o.k))}: ${o.done?(o.dsq?'ur':fmt(o.finish)):(dz>=0?'+':'')+dz.toFixed(0)+' m'}`,W-20,24); }
    // nedräkning
    if(!R.started && R.cd>0){ const n=Math.ceil(R.cd); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 90px system-ui'; ctx.fillStyle='#fff'; ctx.save(); ctx.shadowColor='#ef4444'; ctx.shadowBlur=25; ctx.fillText(n>3?'':String(n),W/2,H*.42); ctx.restore(); }
    else if(R.started && s.t<.8){ ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 72px system-ui'; ctx.fillStyle='#22c55e'; ctx.fillText('KÖR!',W/2,H*.42); }
  }
  const fmt=t=>{ const m=Math.floor(t/60), s=t-m*60; return (m?m+':':'')+(m?String(s.toFixed(2)).padStart(5,'0'):s.toFixed(2)); };
  const bestKey=()=>`sl_best_${G.disc}${G.par?'p':''}`;
  function bestOf(){ try{ return JSON.parse(lsGet(bestKey()))||{}; }catch(e){ return {}; } }

  /* ---------- slingan ---------- */
  function loop(now){
    raf=0; if(!G||G.kind!=='slalom'||view!=='game'||!cv||!cv.isConnected){ windOff(); return; }
    raf=requestAnimationFrame(loop);
    const dt=Math.min(.05,(now-(lastT||now))/1000); lastT=now;
    const runId=G.id+':'+(G.go||0); if(!R||R.gid!==runId) newRun();
    if(!G.started&&mode==='online'){ draw(dt); return; }
    const s=meSk();
    // styrning
    let inp=0; if(drag) inp=Math.max(-1,Math.min(1,(drag.x-drag.x0)/(W*.22))); const kx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0); if(kx) steer+=(kx-steer)*Math.min(1,dt*6); else steer*=Math.pow(.02,dt); if(kx||!drag) inp=inp||steer;
    if(!R.started){ R.cd-=dt; const n=Math.ceil(R.cd); if(n!==R.beeped && n>=1 && n<=3){ R.beeped=n; tone(660,.12,'sine',.12); } if(R.cd<=0){ R.started=true; tone(1320,.35,'sine',.13); crowd(.8,.12); } }
    else {
      const lv=G.ai||[];
      for(const sk of R.sk){
        if(sk===s) physics(sk,dt,inp);
        else if(sk.ai) physics(sk,dt,aiInput(sk,lv[sk.k],dt));
        else if(R.remote){ const r=R.remote; sk.x+=(r.x-sk.x)*Math.min(1,dt*10); sk.z+=(r.z+ (r.v||0)*Math.min(.15,(now-r.at)/1000) - sk.z)*Math.min(1,dt*10); sk.th=r.th; sk.lean=r.l||0; sk.v=r.v; sk.done=!!r.d; sk.dsq=!!r.q; sk.finish=r.f; sk.gi=r.gi||sk.gi; }
      }
      // snöstänk när man svänger hårt
      if(!s.done && Math.abs(s.om)>.6 && s.v>5){ for(let i=0;i<2;i++) R.parts.push({x:s.x-Math.sin(s.th)*.3+(Math.random()-.5)*.6, z:s.z, y:.1, vx:-Math.cos(s.th)*Math.sign(s.om)*(2+Math.random()*3), vz:s.v*.3, vy:1+Math.random()*2.5, t:.5}); }
      if(R.parts.length>160) R.parts.splice(0,R.parts.length-160);
      R.shake=Math.max(0,R.shake-dt*3);
      wind(s.done?0:s.v);
      // publikens jubel när man passerar
      R.cheer-=dt; if(R.cheer<=0 && (Math.floor(s.z/90)%3===1 || s.z>R.C.L-70)){ crowd(1,.05); R.cheer=2.2; if(Math.random()<.5) tone(1180,.4,'triangle',.03); }
      // online: skicka min position
      if(mode==='online' && now-sendT>66){ sendT=now; send({t:'sl', g:G.id, n:G.go||0, x:+s.x.toFixed(2), z:+s.z.toFixed(2), th:+s.th.toFixed(3), l:+s.lean.toFixed(2), v:+s.v.toFixed(2), gi:s.gi, d:s.done?1:0, q:s.dsq?1:0, f:s.finish!=null?+s.finish.toFixed(3):null}); }
      // åket klart: rapportera tiden
      if(s.done && !R.sent && (s.v<.5 || s.dsq || performance.now()-(R.finishT||(R.finishT=performance.now()))>1200)){ R.sent=true; windOff(); finishRun(s); }
      // datorn i grannbanan
      for(const sk of R.sk) if(sk.ai && sk.done && !sk.sentAI){ sk.sentAI=true; applyAndPublish({type:'finish', seat:sk.k, ms:sk.dsq?null:Math.round(sk.finish*1000)}, sk.k); }
    }
    draw(dt);
  }
  function finishRun(s){
    const ms = s.dsq ? null : Math.round((s.finish)*1000);
    if(ms){ const B=bestOf(); if(!B.t||ms<B.t){ lsSet(bestKey(),JSON.stringify({t:ms,split:R.split,d:Date.now()})); if(B.t) setTimeout(()=>{ toast('🏆 Nytt personligt rekord!',2500); sparkles(30); },400); } }
    doAct({type:'finish', seat:G.par?meSeat():0, ms, missed:s.missed});
  }

  function fit(){ if(!cv) return; const host=cv.parentElement; const r=host.getBoundingClientRect(); const w=Math.round(Math.min(host.clientWidth, 700)), h=Math.round(Math.max(320, Math.min(window.innerHeight - r.top - 10, w*1.9)));
    const dpr=Math.min(2,window.devicePixelRatio||1); cv.style.width=w+'px'; cv.style.height=h+'px'; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); W=w; H=h; BDsize=''; scaleDpr=dpr; }
  let scaleDpr=1;
  window.addEventListener('resize',()=>{ if(G&&G.kind==='slalom'&&view==='game') fit(); });
  function mount(){
    const host=document.getElementById('slHost'); if(!host) return; sprites();
    if(!cv){ cv=document.createElement('canvas'); cv.className='sl-cv'; ctx=cv.getContext('2d');
      cv.addEventListener('pointerdown',e=>{ e.preventDefault(); unlockAudio(); drag={x0:e.clientX, x:e.clientX, id:e.pointerId}; try{ cv.setPointerCapture(e.pointerId); }catch(er){} });
      window.addEventListener('pointermove',e=>{ if(drag&&e.pointerId===drag.id){ drag.x=e.clientX; } },{passive:true});
      const up=e=>{ if(drag&&e.pointerId===drag.id) drag=null; }; window.addEventListener('pointerup',up); window.addEventListener('pointercancel',up);
      cv.addEventListener('contextmenu',e=>e.preventDefault()); }
    host.appendChild(cv); fit();
    if(!raf){ lastT=0; raf=requestAnimationFrame(loop); }
  }
  // ritningen räknar i CSS-pixlar; skala om varje bildruta
  function draw(dt){ ctx.setTransform(scaleDpr,0,0,scaleDpr,0,0); ctx.save(); drawScene(dt); ctx.restore(); }
  document.addEventListener('keydown',e=>{ if(G&&G.kind==='slalom'&&view==='game'&&['ArrowLeft','ArrowRight'].includes(e.code)){ keys[e.code]=true; e.preventDefault(); } });
  document.addEventListener('keyup',e=>{ keys[e.code]=false; });

  /* ---------- nätet ---------- */
  function onNet(m, seat){
    if(!G||G.kind!=='slalom'||m.g!==G.id||!R||(m.n||0)!==(G.go||0)) return;
    const ok=['x','z','th','v'].every(k=>Number.isFinite(m[k])); if(!ok) return;
    R.remote={x:m.x,z:m.z,th:m.th,l:+m.l||0,v:m.v,gi:+m.gi||0,d:m.d,q:m.q,f:Number.isFinite(m.f)?m.f:null,at:performance.now()};
  }

  /* ---------- spelmotorn ---------- */
  GINFO.slalom={name:'Slalom', icon:'⛷️', ai:'Blixt 🤖', max:2, desc:'Storslalom och slalom i Vemdalsfjällen', grad:'linear-gradient(135deg,#60a5fa,#e0f2fe 55%,#ef4444)'};
  KIND.slalom={
    init(){ const base=!fresh&&G&&G.kind==='slalom'?G:null; fresh=false; const o=base?{disc:base.disc,par:base.par,pen:base.pen}:pend;
      return {disc:o.disc, par:o.par, pen:o.pen, seed:Math.floor(Math.random()*1e9), res:[null,null], go:0, cur:0}; },
    start(g){ g.seed=Math.floor(Math.random()*1e9); g.res=g.names.map(()=>null); g.go=(g.go||0)+1; g.cur=0; if(g.names.length>1) g.par=true; },
    valid(g){ return g.names.length>=1&&g.names.length<=2 && (g.disc==='gs'||g.disc==='sl') && typeof g.par==='boolean' && typeof g.pen==='boolean' && Number.isInteger(g.seed)
      && Array.isArray(g.res) && g.res.every(r=>r===null||(r&&(r.ms===null||(Number.isInteger(r.ms)&&r.ms>3000&&r.ms<900000)))); },
    waitingFor(){ return -1; },
    scoreOf(g,i){ const r=g.res&&g.res[i]; return r? (r.ms===null?'ur':fmt(r.ms/1000)) : (g.started===false?'':'åker…'); },
    apply(g,a,seat){
      if(a.type==='resign'){ if(g.over) return false; g.res[seat]={ms:null}; }
      else if(a.type==='finish'){ if(g.over||g.res[seat]) return false; if(!(a.ms===null||(Number.isInteger(a.ms)&&a.ms>3000&&a.ms<900000))) return false; g.res[seat]={ms:a.ms}; g.last={t:Date.now(),seat,ms:a.ms}; }
      else return false;
      if(g.res.every(Boolean)){ g.over=true; const t=g.res.map(r=>r.ms===null?Infinity:r.ms); const mn=Math.min(...t);
        g.winner = g.names.length===1 ? (mn<Infinity?0:-2) : mn===Infinity ? -1 : t.filter(x=>x===mn).length>1 ? -1 : t.indexOf(mn); }
      return true; },
    aiSeat(){ return null; },
    effects(prev,d){ if(d.last&&(!prev.last||prev.last.t!==d.last.t)&&d.last.seat!==meSeat()&&d.names.length>1) toast(`${bare(pname(d.last.seat))} i mål: ${d.last.ms===null?'ur 😬':fmt(d.last.ms/1000)}`,2000); },
    html(){
      const g=G, me=meSeat(), B=bestOf();
      let over='';
      if(g.over){ const rows=g.names.map((n,i)=>{ const r=g.res[i]; return `<div class="sl-res ${g.winner===i?'win':''}"><b>${esc(bare(n))}</b><span>${r&&r.ms!==null?fmt(r.ms/1000):'ur'}</span></div>`; }).join('');
        const solo=g.names.length===1, r=g.res[0];
        over=`<div class="sl-over"><div class="gover ${solo?(r.ms!==null?'won':'lost'):g.winner===me?'won':g.winner===-1?'tie':'lost'}"><div class="gi">${solo?(r.ms!==null?'⛷️':'😬'):g.winner===me?'🏆':g.winner===-1?'🤝':'🎿'}</div>
          <h3>${solo?(r.ms!==null?'I mål!':'Ur!'):g.winner===me?'Du vann!':g.winner===-1?'Oavgjort':esc(bare(pname(g.winner)))+' vann'}</h3>${rows}
          ${B.t?`<p class="sl-pb">Ditt rekord i ${DISC[g.disc].name.toLowerCase()}${g.par?' (parallell)':''}: <b>${fmt(B.t/1000)}</b></p>`:''}
          <div class="gbtns"><button class="pri" data-g="rematch">🔄 Åk igen</button><button data-act="lobby">🏠 Lobby</button></div></div></div>`; }
      return `<div class="sl-wrap"><div id="slHost" class="sl-host"></div>${over}</div>
        <div class="ghint">${DISC[g.disc].name}${g.par?' · parallell':''} · Dra fingret åt sidan (eller ← →) för att svänga, släpp för att åka rakt. ${g.pen?'Missad port +3 s.':'Missad port = ur.'} ${g.over?'':KIT.resignHTML()}</div>`; },
    mounted(){ mount(); }
  };

  /* ---------- meny ---------- */
  let mDisc=lsGet('sl_disc')||'gs', mPen=lsGet('sl_pen')!=='0';
  const segD=()=>Object.entries(DISC).map(([k,d])=>`<button data-sl="disc" data-v="${k}" class="${mDisc===k?'sel':''}">${k==='gs'?'🚩':'🎌'} ${d.name}</button>`).join('');
  const segP=()=>`<button data-sl="pen" data-v="1" class="${mPen?'sel':''}">+3 s straff</button><button data-sl="pen" data-v="0" class="${!mPen?'sel':''}">Riktiga regler: ur</button>`;
  const lvlName={easy:'🐣 Lätt',medium:'🙂 Medel',hard:'🧠 Svår'};
  let mLvl=lsGet('sl_lvl')||'medium';
  const segL=()=>Object.entries(lvlName).map(([k,l])=>`<button data-sl="lvl" data-v="${k}" class="${mLvl===k?'sel':''}">${l}</button>`).join('');
  function bestLine(){ const f=k=>{ try{ const b=JSON.parse(lsGet(k)); return b&&b.t?fmt(b.t/1000):'–'; }catch(e){ return '–'; } }; return `Rekord: storslalom ${f('sl_best_gs')} · slalom ${f('sl_best_sl')}`; }
  GINFO.slalom.menu=function(){
    openModal(`<h3>⛷️ Slalom i Vemdalsfjällen</h3><p>Åk genom portarna så fort du kan. Dra fingret åt sidan för att svänga – ju mindre du svänger, desto snabbare går det.</p>
      <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      <label>Gren</label><div class="seg" id="slD">${segD()}</div>
      <label>Missad port</label><div class="seg" id="slP">${segP()}</div>
      <label>Datorns nivå (parallellslalom)</label><div class="seg" id="slL">${segL()}</div>
      <div class="setnote">${bestLine()}</div>
      <div class="btns" style="flex-direction:column"><button class="pri" data-sl="solo">⏱️ Åk ensam mot klockan</button>
        <button class="pri" data-sl="ai" style="background:linear-gradient(135deg,#ef4444,#2563eb)">🤖 Parallellslalom mot datorn</button>
        <button class="pri" data-sl="host" style="background:linear-gradient(135deg,#f472b6,#a855f7)">🚀 Parallellslalom mot en kompis</button>
        <button data-act="close">Avbryt</button></div>`,'slmenu'); };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-sl]'); if(!b) return; const a=b.dataset.sl, nm=(document.getElementById('nm')?.value||'').trim();
    if(a==='disc'){ mDisc=b.dataset.v; lsSet('sl_disc',mDisc); document.getElementById('slD').innerHTML=segD(); sfx.bubble(); return; }
    if(a==='pen'){ mPen=b.dataset.v==='1'; lsSet('sl_pen',mPen?'1':'0'); document.getElementById('slP').innerHTML=segP(); sfx.bubble(); return; }
    if(a==='lvl'){ mLvl=b.dataset.v; lsSet('sl_lvl',mLvl); document.getElementById('slL').innerHTML=segL(); sfx.bubble(); return; }
    const n=nm||'Du'; lsSet('ry_name',n); unlockAudio();
    if(a==='solo'){ pend={disc:mDisc,par:false,pen:mPen}; fresh=true; KIT.startSolo('slalom',n); return; }
    if(a==='ai'){ pend={disc:mDisc,par:true,pen:mPen}; fresh=true; startGameLocal('slalom',n,mLvl,1); return; }
    if(a==='host'){ if(!nm){ toast('Skriv ditt namn 🐬'); return; } pend={disc:mDisc,par:true,pen:mPen}; fresh=true; closeModal(); hostGame(n,'free','slalom'); return; } });

  const st=document.createElement('style'); st.textContent=`
.sl-wrap{position:relative;margin:0 auto}
.sl-host{display:flex;justify-content:center}
.sl-cv{display:block;border-radius:16px;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.sl-over{position:absolute;inset:0;display:grid;place-items:center;padding:14px;background:rgba(15,23,42,.25)}
.sl-over .gover{max-width:330px;width:100%;background:rgba(11,16,40,.9);backdrop-filter:blur(6px)}
.sl-res{display:flex;justify-content:space-between;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.06);margin:4px 0;font-variant-numeric:tabular-nums}
.sl-res.win{background:rgba(250,204,21,.2);border:1px solid var(--gold)}
.sl-pb{font-size:13px;opacity:.85}`; document.head.appendChild(st);

  return { net:onNet, __test:(typeof DEV!=='undefined'&&DEV)?{course,physics,aiInput,DISC,run:()=>R,newRun,mid,AILV}:undefined };
})();
