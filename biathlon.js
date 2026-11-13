/* =====================================================================
   biathlon.js – Skidskytte på Östersunds skidstadion (nationalarenan)
   • banan: stadion med läktare och Arctura-tornet, lång stigning ut från
     stadion, platå med utsikt över Storsjön och Frösön, snabb utförskörning
     genom skogen, kuperat, en kort brant "hacka" och utför in mot stadion
   • skating i takt (vänster/höger), puls som stiger i backarna och sjunker
     i utförsåkningen – pulsen syns sedan i siktet
   • skyttet: diopter och korn med ringkorn, tavlor på 50 m (svart 115 mm,
     träffyta liggande 45 mm / stående 115 mm), andning, hjärtslag, darr,
     drift i stående, vind med flaggor och knäppar på sidan, rekyl,
     mantelrepetering, smäll, eko och "klonk" när tavlan fälls
   • straffrunda 150 m per bom, sprint (3 varv, ligg + stå) eller kort
   • träna bara skyttet: liggande, stående eller växla, lugn eller hög puls
   • TV-bilder: kameraåkningar över skytten (drönare, sidled, över axeln)
   ===================================================================== */
'use strict';
const BIATHLON = (()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t, smooth=t=>t*t*(3-2*t);
  function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const now=()=>performance.now()/1000;
  const fmtT=t=>{ if(!(t>=0)) return '–'; const m=Math.floor(t/60), s=t-m*60; return m? `${m}:${s.toFixed(1).padStart(4,'0')}` : s.toFixed(1); };
  const BOTS=['Blixt 🤖','Stjärna 🤖','Komet 🤖'];

  /* ---------- format ---------- */
  const FMT={
    sprint:{name:'Sprint', laps:3, st:['L','S'], desc:'3 varv · liggande + stående'},
    kort:{name:'Kort lopp', laps:2, st:['L'], desc:'2 varv · liggande'},
    tr:{name:'Träna skytte', laps:0, st:[], desc:'bara skyttet'}
  };
  const LP=700, PEN=150, LINE=15, RANGE=40, TR_N=4;   // varvlängd, straffrunda, start/mål, skjutvallen (m in på varvet)
  const PNAME={L:'liggande', S:'stående'};
  const trSeries=g=> g.trPos==='V' ? ['L','L','S','S'] : Array(TR_N).fill(g.trPos||'L');

  /* ---------- banan: Östersunds skidstadion ---------- */
  // [typ, längd, lutning (+ = uppför), halvbredd, svängning, skog, publik]
  const SECT=[
    ['stadium', 92,  .00, 8.5,  0,     0,  2],
    ['climb',   68,  .035,4.2,  .004, .45, 1],
    ['big',    128,  .095,3.7, -.0035,.7,  1],     // den långa stigningen ut från stadion
    ['top',     22,  .03, 4.0,  0,    .3,  2],
    ['view',    88, -.012,4.6,  .0025,.08, 0],     // platån med utsikt över Storsjön
    ['desc',   108, -.11, 4.0,  .009, 1,   0],     // snabb, slingrande utförskörning genom skogen
    ['undul',   92,  0,   3.8, -.007, 1,   0],
    ['hack',    46,  .12, 3.6,  0,    .8,  1],     // kort brant hacka
    ['into',    56, -.11, 5.5,  .002, .3,  1]      // utför in mot stadion
  ];
  function buildLap(){
    const N=LP, grade=new Float32Array(N+1), half=new Float32Array(N+1), cv=new Float32Array(N+1), kind=new Array(N+1), trees=new Float32Array(N+1), crowd=new Uint8Array(N+1);
    let i=0, pg=0, ph=SECT[0][3], pc=0;
    for(const [k,L,g,h,c,tr,cr] of SECT){ for(let j=0;j<L&&i<=N;j++,i++){ const b=smooth(Math.min(1,j/14));
        let gg=lerp(pg,g,b); if(k==='undul') gg=.055*Math.sin(j/92*Math.PI*6);
        grade[i]=gg; half[i]=lerp(ph,h,b); cv[i]=lerp(pc,c,b); kind[i]=k; trees[i]=tr; crowd[i]=cr; }
      pg=k==='undul'?0:g; ph=h; pc=c; }
    for(;i<=N;i++){ grade[i]=0; half[i]=ph; cv[i]=0; kind[i]='stadium'; trees[i]=0; crowd[i]=2; }
    const y=new Float32Array(N+1), x=new Float32Array(N+1); let head=0;
    for(let k=1;k<=N;k++){ y[k]=y[k-1]+grade[k]; head=clamp(head+cv[k]*.6,-.35,.35); head*=.995; x[k]=x[k-1]+Math.tan(head); }
    for(let k=0;k<=N;k++){ y[k]-=y[N]*k/N; x[k]-=x[N]*k/N; }           // slutna varv: höjd och sidled går ihop
    for(let k=1;k<=N;k++) grade[k]=y[k]-y[k-1];
    return {N, grade, y, x, half, kind, trees, crowd, loop:true};
  }
  function buildPen(){
    const N=PEN, o={N, grade:new Float32Array(N+1), y:new Float32Array(N+1), x:new Float32Array(N+1), half:new Float32Array(N+1).fill(3.2), kind:new Array(N+1).fill('pen'), trees:new Float32Array(N+1), crowd:new Uint8Array(N+1).fill(1), loop:true};
    for(let k=0;k<=N;k++) o.x[k]=Math.sin(k/N*Math.PI*2)*9;           // ovalen syns som en mjuk sväng
    return o;
  }
  const TL=buildLap(), TP=buildPen(); let T=TL;
  const wrap=(z,N)=>((z%N)+N)%N;
  const at=(A,arr,z)=>{ const q=wrap(z,A.N), i=Math.floor(q), f=q-i; return arr[i]+(arr[Math.min(A.N,i+1)]-arr[i])*f; };
  const mid=z=>at(T,T.x,z), elev=z=>at(T,T.y,z), halfAt=z=>at(T,T.half,z), gradeAt=(z,A=T)=>at(A,A.grade,z);
  const kindAt=(z,A=T)=>A.kind[Math.round(wrap(z,A.N))]||'';

  /* ---------- åkfysik ---------- */
  const PH={m:70, mu:.03, c:.006, k:.95};
  const idealGap=(gr,v)=>clamp(.64-gr*1.9-v*.006,.36,.72);       // takten: snabbare i uppförsbackar
  function push(a,side){
    const t=a.t, gap=t-(a.lastPush??-9), gr=gradeAt(a.z,a.ph==='pen'?TP:TL), ideal=idealGap(gr,a.v);
    let q=1; const bad=[];
    if(a.lastSide===side){ q=.35; bad.push('side'); }
    else if(gap<ideal*.6){ q=.45; bad.push('fast'); }
    else if(gap<ideal*.8) q=.8;
    if(a.hr>188) q*=.88;                      // mjölksyra
    const dv=PH.k*q*(a.pw||1)/(1+a.v*.13);
    a.v+=dv; a.lastPush=t; a.lastSide=side; a.stride=1; a.work+=1.15+Math.max(0,gr)*9-(q<.5?-.6:0);
    return {q,bad};
  }
  function skiStep(a,dt,A){
    const gr=gradeAt(a.ph==='pen'?a.pz:a.z,A), sinG=gr/Math.sqrt(1+gr*gr);
    const idle=a.t-(a.lastPush??-9);
    const wantTuck = (gr<-.035 && idle>.55 && a.v>6) ? 1 : 0;
    a.tuck+=(wantTuck-a.tuck)*Math.min(1,dt*4);
    const acc=-9.81*sinG - PH.mu*9.81 - PH.c*(1-.45*a.tuck)*a.v*a.v;
    a.v=Math.max(0,a.v+acc*dt); if(a.v<.4 && gr>.02) a.v=.4;
    const d=a.v*dt; if(a.ph==='pen') a.pz+=d; else a.z+=d;
    a.t+=dt; a.stride=Math.max(0,a.stride-dt*2.4);
    // puls: arbete senaste sekunderna → målpuls
    a.work*=Math.pow(.62,dt); const effort=clamp(a.work/7.5,0,1.25);
    const target=lerp(112,197,clamp(effort,0,1)) - a.tuck*18;
    a.hr+= (target-a.hr)*dt/(target>a.hr?7:12); a.hr=clamp(a.hr,60,199);
  }

  /* ---------- runtime ---------- */
  let R=null, cv=null, ctx=null, raf=0, lastT=0, W=360, H=640, dpr=1, sendT=0, fresh=false;
  let pend={fmt:'sprint', wind:true, easy:false, tv:true, trPos:'L', trHr:'race'};
  const keys={};
  const meSeat2=()=> (typeof meSeat==='function' ? meSeat() : 0) ?? 0;
  const stagesOf=g=> g.fmt==='tr' ? trSeries(g) : FMT[g.fmt].st;
  function mkA(k,isAi){ return {k, ai:isAi, lv:isAi?(G.ai[k]||'medium'):null, z:0, pz:0, v:0, hr:isAi?95:92, t:0, ph:'ski', lap:0, st:0, sh:[], pen:0, tuck:0, stride:0, lastPush:null, lastSide:null, work:0, pw:1, done:false, finish:null, lane:(k*2+11), rangeT:0}; }
  function newRun(){
    const n=G.names.length, me=G.names.length>1?meSeat2():0;
    const A=G.names.map((_,k)=>mkA(k, mode==='local' && isAI(k)));
    A.forEach(a=>{ a.z=LINE-6-((a.k*2)%5)*1.4; a.x=(a.k%3-1)*2.2; if(a.ai){ const L={easy:.86,medium:.93,hard:.99}[a.lv]||.93; a.pw=L; } });
    R={gid:G.id+':'+(G.go||0), wx:WEATHER.pick((G.seed||1)+(G.go||0)*17), wxs:WEATHER.mkState(), A, me, cd:G.fmt==='tr'?0:3.5, started:G.fmt==='tr', parts:[], banner:null, remote:{}, sent:false, beeped:-1,
       sc:null, cine:null, trI:0, trLog:[], foot:{L:0,R:0}, rhythm:[]};
    if(G.fmt==='tr'){ const a=A[0]; a.ph='range'; a.hr=G.trHr==='race'?174:84; startRange(a); }
  }
  const meA=()=>R.A[R.me];

  /* ---------- skjutvallen ---------- */
  const SP=170, BLACK=57.5;   // mm: avstånd mellan tavlornas mitt, svarta cirkelns radie
  const TX=k=>(k-2)*SP;
  function windFor(g,a){ if(!g.wind) return {b:0,ph:0}; const r=rng((g.seed||1)+a.st*977+a.k*31); return {b:(r()*2-1)*2.6, ph:r()*6}; }
  function startRange(a){
    const g=G, pos=stagesOf(g)[a.st]; a.ph='range'; a.v=0; a.rangeT=0;
    if(a!==meA()){ // datorn eller en kompis: skyttet simuleras / kommer över nätet
      const lv=a.lv||'medium', p=pos==='L'?{easy:.62,medium:.8,hard:.92}[lv]:{easy:.5,medium:.68,hard:.84}[lv];
      const base=pos==='L'?{easy:15,medium:12,hard:9}[lv]:{easy:12,medium:10,hard:8}[lv];
      a.aiShots=[]; let t=base+Math.random()*3; for(let i=0;i<5;i++){ t+= (pos==='L'?3.2:2.9)+Math.random()*1.6; a.aiShots.push({t, hit: Math.random()<p*(a.hr>180?.93:1)}); }
      a.aiDone=t+3+Math.random()*2; return; }
    const S={pos, shots:[], hits:[0,0,0,0,0], fl:[0,0,0,0,0], left:5, tStart:a.t, readyAt:a.t+(g.tv!==false?3.6:2.4), phase:'arrive',
      aim:{x:TX(0)+(Math.random()-.5)*260, y:(Math.random()-.5)*220}, P:null, pv:{x:0,y:0}, pp:{x:0,y:0}, br:Math.random()*6, hb:1, hold:0,
      drift:Array.from({length:4},()=>Math.random()*6), trm:{x:0,y:0}, beat:0, bolt:0, rec:0, clicks:g.wind?(+lsGet('bs_clicks_'+pos)||0):0, wind:windFor(g,a), puffs:[], leaveAt:null, lastShotT:0};
    S.P={...S.aim}; R.sc=S;
    if(g.tv!==false) R.cine={shots: pos==='L'?['drone','prone']:['drone','stand'], t0:now(), dur:[1.8,2.0], role:'arrive'};
    else R.cine=null;
  }
  function wind(S){ const t=now(); return S.wind.b + (S.wind.b?(.7*Math.sin(t*.55+S.wind.ph)+.35*Math.sin(t*1.7+S.wind.ph*2)):0); }
  // sikteslägets svaj: andning, drift, darr och hjärtslag
  const POS={L:{br:24, dr:7, tr:1.1, pk:4.2, rec:16}, S:{br:30, dr:46, tr:3.2, pk:2.2, rec:24}};
  function swayStep(S,a,dt){
    const pp=POS[S.pos], ease=G.easy?.6:1, h=clamp((a.hr-68)/112,0,1.3);
    // andning: fortare och djupare med hög puls; håller man andan klingar den av – för länge och det börjar skaka
    S.hold = R.holding ? S.hold+dt : 0;
    const tgt = R.holding ? (S.hold<5.5?.1:Math.min(1,.1+(S.hold-5.5)*.22)) : 1;
    S.hb += (tgt-S.hb)*Math.min(1,dt*(R.holding?3.2:1.8));
    S.br += dt*Math.PI*2*(.2+.24*h)*(R.holding&&S.hold<5.5?.25:1);
    const bA=pp.br*ease*(.55+.6*h)*S.hb;
    const bx=bA*.22*Math.sin(S.br+.7), by=bA*Math.sin(S.br);
    // långsam drift (mest i stående)
    S.drift[0]+=dt*.37; S.drift[1]+=dt*.53; S.drift[2]+=dt*.29; S.drift[3]+=dt*.71;
    const dA=pp.dr*ease*(.7+.8*h), dx=dA*(.6*Math.sin(S.drift[0])+.4*Math.sin(S.drift[3]*1.3)), dy=dA*.75*(.6*Math.sin(S.drift[1])+.4*Math.sin(S.drift[2]*1.7));
    // darr: växer med pulsen och när man håller andan för länge
    const tA=pp.tr*ease*(.6+1.6*h*h)*(S.hold>5.5?1+(S.hold-5.5)*.6:1);
    S.trm.x=S.trm.x*.8+(Math.random()-.5)*tA*1.4; S.trm.y=S.trm.y*.8+(Math.random()-.5)*tA*1.4;
    // hjärtslag: en liten knyck uppåt i varje slag (dämpad fjäder) – rekylen går genom samma fjäder
    S.beat+=dt*a.hr/60; if(S.beat>=1){ S.beat-=1; S.pv.y+=pp.pk*ease*(.4+h)*7; S.pv.x+=(Math.random()-.5)*pp.pk*2; heartSfx(a.hr); }
    for(const k of ['x','y']){ const acc=-90*S.pp[k]-11*S.pv[k]; S.pv[k]+=acc*dt; S.pp[k]+=S.pv[k]*dt; }
    // pulsen sjunker på vallen
    a.hr += ((R.holding&&S.hold>6?a.hr+2:96)-a.hr)*dt/16;
    // mantelrepetering: siktbilden lyfter och återvänder
    S.bolt=Math.max(0,S.bolt-dt); S.rec=Math.max(0,S.rec-dt);
    // den riktpunkt skytten styr med fingret följer med lite tröghet (muskelspänning)
    S.aim.x+= (S.P.x-S.aim.x)*Math.min(1,dt*(S.pos==='L'?9:6)); S.aim.y+= (S.P.y-S.aim.y)*Math.min(1,dt*(S.pos==='L'?9:6));
    const bo=S.bolt>0? Math.sin(S.bolt/.5*Math.PI) : 0;
    S.cur={x:S.aim.x+bx+dx+S.trm.x+S.pp.x+bo*-14, y:S.aim.y+by+dy+S.trm.y+S.pp.y+bo*60};
  }
  function fire(){
    const S=R.sc, a=meA(); if(!S||S.phase!=='aim'||S.left<=0||S.bolt>0||a.t<S.readyAt) return;
    const disp=()=>{ let u=0; for(let i=0;i<4;i++) u+=Math.random(); return (u-2)*3.4; };    // gevär + ammunition ≈ 10 mm grupp
    const w=wind(S), ix=S.cur.x+w*7+S.clicks*6+disp(), iy=S.cur.y+disp();
    const rHit = S.pos==='L' && !G.easy ? 22.5 : BLACK;
    let hitK=-1; for(let k=0;k<5;k++){ if(Math.hypot(ix-TX(k),iy)<=rHit){ hitK=k; break; } }
    const ok = hitK>=0 && !S.hits[hitK];
    const shot={x:ix,y:iy,k:hitK,ok,t:a.t-S.tStart}; S.shots.push(shot); S.left--; S.lastShotT=now();
    shotSfx(); buzz(18);
    // rekyl genom fjädern, sedan mantelrepetering
    S.pv.y+=POS[S.pos].rec*9; S.pv.x+=(Math.random()-.5)*20; S.rec=.25;
    setTimeout(()=>{ if(R&&R.sc===S){ if(ok){ S.hits[hitK]=1; S.fl[hitK]=now(); if(R.rec) R.rec.ev.push({t:R.rec.t,k:hitK}); targetSfx(); crowdSfx(true); } else { if(Math.abs(iy)>110||Math.abs(ix)>2*SP+100) S.puffs.push({x:ix,y:iy,t:now()}); if(Math.random()<.6) crowdSfx(false); } } },165);
    if(S.left>0) setTimeout(()=>{ if(R&&R.sc===S){ S.bolt=.5; boltSfx(); } },230);
    else { S.leaveAt=a.t+1.1; }
  }
  function endRange(a,misses){
    a.sh.push(misses); a.pen=misses*PEN; a.rangeT=0;
    if(G.fmt==='tr'){ return; }
    if(a.pen>0){ a.ph='pen'; a.pz=0; } else { a.ph='ski'; }
    a.st++; a.v=2.4; a.lastPush=null;
  }

  /* ---------- ljud ---------- */
  let amb=null;
  function burst(sec,type,freq,vol,q=1,when=0){ if(sfxOff()||!AC) return; try{ const t=AC.currentTime+when, s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain();
    s.buffer=noiseBuf(sec); f.type=type; f.frequency.value=freq; f.Q.value=q; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+sec);
    s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t+sec+.05); }catch(e){} }
  // .22 LR: kort skarp smäll, en dov tryckvåg och ekot från läktaren och skogen
  function shotSfx(){ burst(.07,'highpass',2200,.55,.7); burst(.12,'bandpass',700,.35,.8); tone(110,.07,'sine',.22,0,60); burst(.35,'bandpass',1500,.09,.6,.21); burst(.5,'bandpass',900,.05,.5,.48); }
  function boltSfx(){ hit(0,4200,.13,.012); hit(.06,3000,.1,.015); hit(.2,3600,.14,.012); hit(.27,2500,.12,.02); }
  function targetSfx(){ tone(1850,.16,'triangle',.07); tone(2770,.09,'sine',.04); hit(0,1400,.12,.03); }
  function heartSfx(hr){ if(!R||!R.sc) return; const v=clamp((hr-70)/120,0,1)*.22+.03; tone(52,.11,'sine',v); tone(46,.1,'sine',v*.65,.15); }
  function crowdSfx(good){ const v=.04+Math.random()*.04; if(good) { burst(.7,'bandpass',1100,v,.6); burst(.6,'bandpass',2100,v*.5,.8); } else burst(.9,'bandpass',420,v*.8,.7); }
  function strideSfx(v,q){ burst(.14,'bandpass',1500+v*60,Math.min(.12,.03+v*.008)*(q<.5?.6:1),1.3); }
  function ambInit(){ if(amb||sfxOff()||!AC) return; try{
      const mk=(sec,type,freq,q)=>{ const s=AC.createBufferSource(); s.buffer=noiseBuf(sec); s.loop=true; const f=AC.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=AC.createGain(); g.gain.value=0; s.connect(f).connect(g).connect(AC.destination); s.start(); return {f,g}; };
      amb={ glide:mk(1.7,'bandpass',600,.8), wind:mk(2,'lowpass',500,.7), crowd:mk(2.3,'bandpass',900,.4), breath:mk(1.1,'bandpass',800,.9) };
    }catch(e){ amb=null; } }
  function ambUpdate(a){ if(!amb) return; const t=AC.currentTime, sc=R.sc&&a.ph==='range', v=sc?0:a.v, k=a.ph==='pen'?'pen':kindAt(a.z,TL);
    amb.glide.g.gain.setTargetAtTime(clamp(v/9,0,1)*.05,t,.15);
    amb.wind.g.gain.setTargetAtTime(Math.min(.06,v*v*.0009),t,.2);
    const crowd = sc ? .05 : (k==='stadium'||k==='pen'||k==='into') ? .06 : (TL.crowd[Math.round(wrap(a.z,LP))]?.03:0);
    amb.crowd.g.gain.setTargetAtTime(crowd,t,.5);
    // andningen i siktet: in och ut, tyst när man håller andan
    let br=0; if(sc&&R.sc){ const S=R.sc; br = R.holding&&S.hold<5.5 ? 0 : clamp((a.hr-70)/110,0,1)*.05*(.5+.5*Math.sin(S.br)); }
    else if(!sc && a.ph!=='done') br=clamp((a.hr-110)/90,0,1)*.03*(.5+.5*Math.sin(a.t*a.hr/60*Math.PI*.5));
    amb.breath.g.gain.setTargetAtTime(br,t,.08); }
  function ambOff(){ if(!amb) return; const t=AC.currentTime; for(const k in amb) amb[k].g.gain.setTargetAtTime(0,t,.1); }

  /* ---------- förritat: träd, publik, bakgrund med Storsjön ---------- */
  const SPR={};
  const weakB=()=>{ try{ return document.body.classList.contains('weak') || (navigator.hardwareConcurrency||8)<=2; }catch(e){ return false; } };
  function off(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return [c,c.getContext('2d')]; }
  function makeTree(v){
    const [c,x]=off(160,300), cx=40; x.scale(2,2);
    if(v===2){ x.strokeStyle='#e8e2d6'; x.lineWidth=5; x.beginPath(); x.moveTo(cx,150); x.lineTo(cx-3,40); x.stroke(); x.strokeStyle='#3b3a37'; x.lineWidth=1.5; for(let y=60;y<145;y+=13){ x.beginPath(); x.moveTo(cx-4,y); x.lineTo(cx+1,y+2); x.stroke(); }
      x.strokeStyle='#6b5b52'; x.lineWidth=1.3; for(let k=0;k<14;k++){ const y=40+k*6, s=k%2?1:-1; x.beginPath(); x.moveTo(cx-2,y); x.quadraticCurveTo(cx+s*12,y-4,cx+s*(16+k%3*4),y+10); x.stroke(); }
      x.fillStyle='rgba(255,255,255,.85)'; for(let k=0;k<10;k++){ x.beginPath(); x.ellipse(cx+(k%2?10:-10)+(k*3%7-3),48+k*8,6,2.4,0,0,7); x.fill(); } return c; }
    x.fillStyle='#3d2b1f'; x.fillRect(cx-3,128,6,22);
    const n=v?8:7; for(let i=0;i<n;i++){ const t=i/(n-1), y=10+t*112, w=8+t*(v?26:31);
      x.fillStyle=i%2?'#1f4d3a':'#245a43'; x.beginPath(); x.moveTo(cx,y-14); x.lineTo(cx-w,y+12); x.quadraticCurveTo(cx,y+4,cx+w,y+12); x.closePath(); x.fill();
      x.fillStyle='#163a2c'; x.beginPath(); x.moveTo(cx,y-14); x.lineTo(cx+w,y+12); x.quadraticCurveTo(cx+w*.5,y+8,cx+2,y+6); x.closePath(); x.fill();
      x.fillStyle='rgba(248,252,255,.95)'; x.beginPath(); x.moveTo(cx-w*.9,y+9); x.quadraticCurveTo(cx-w*.3,y+1,cx+w*.15,y+5); x.quadraticCurveTo(cx-w*.3,y+7,cx-w*.9,y+11); x.fill(); }
    x.fillStyle='#fff'; x.beginPath(); x.ellipse(cx,4,3.5,6,0,0,7); x.fill(); return c;
  }
  const JACK=['#e11d48','#2563eb','#f59e0b','#16a34a','#7c3aed','#0891b2','#f97316','#db2777','#facc15','#334155','#1d4ed8','#fde047'];
  function makeFan(i){
    const [c,x]=off(52,112); x.scale(2,2); const col=JACK[i%JACK.length], hat=JACK[(i*5+3)%JACK.length];
    x.fillStyle='#1e293b'; x.fillRect(8,40,4,14); x.fillRect(14,40,4,14);
    x.fillStyle=col; x.beginPath(); x.roundRect(5,20,16,23,5); x.fill(); x.fillStyle='rgba(0,0,0,.18)'; x.fillRect(13,20,8,23);
    x.strokeStyle=col; x.lineWidth=4; x.lineCap='round'; x.beginPath(); if(i%3===0){ x.moveTo(6,23); x.lineTo(1,8); x.moveTo(20,23); x.lineTo(25,8); } else { x.moveTo(6,24); x.lineTo(3,36); x.moveTo(20,24); x.lineTo(23,36); } x.stroke();
    x.fillStyle='#f5d0b5'; x.beginPath(); x.arc(13,14,6,0,7); x.fill(); x.fillStyle=hat; x.beginPath(); x.arc(13,12,6.3,Math.PI,0); x.fill(); x.beginPath(); x.arc(13,4.5,2.6,0,7); x.fill();
    if(i%4===1){ x.fillStyle='#006aa7'; x.fillRect(19,0,7,5); x.fillStyle='#fecc00'; x.fillRect(21,0,1.6,5); x.fillRect(19,1.8,7,1.4); x.fillStyle='#fff'; x.fillRect(18.5,0,.8,12); }   // svensk flagga
    return c;
  }
  // panorama: låg novembersol, Oviksfjällen långt bort, frusna Storsjön med Frösön och kyrkan
  function makeBackdrop(w,h){
    const hz=Math.round(h*.30), vb=Math.round(h*.12), K=Math.min(2,dpr), [cc,x]=off(w*2*K,(hz+vb+4)*K), c={width:w*2,height:hz+vb+4}; x.scale(K,K);
    const g=x.createLinearGradient(0,0,0,hz); g.addColorStop(0,'#4f7fc4'); g.addColorStop(.5,'#9ebbe3'); g.addColorStop(.82,'#f3cdd0'); g.addColorStop(1,'#ffd9b0');
    x.fillStyle=g; x.fillRect(0,0,c.width,hz+vb+4);
    const sx=c.width*.3, sy=hz*.9, sg=x.createRadialGradient(sx,sy,2,sx,sy,hz*.7); sg.addColorStop(0,'rgba(255,236,190,.95)'); sg.addColorStop(.1,'rgba(255,205,160,.55)'); sg.addColorStop(1,'rgba(255,205,160,0)'); x.fillStyle=sg; x.fillRect(0,0,c.width,hz+vb);
    const r=rng(17);
    const cl=(cx,cy,s)=>{ x.fillStyle='rgba(255,255,255,.75)'; [[0,0,1],[.9,-.25,.8],[1.7,.05,.7],[-.8,.1,.7]].forEach(([dx,dy,q])=>{ x.beginPath(); x.arc(cx+dx*s,cy+dy*s,q*s*.7,0,7); x.fill(); }); };
    for(let i=0;i<6;i++) cl(c.width*(.08+i*.17)+r()*40, hz*(.12+r()*.25), 14+r()*12);
    // fjällen i väster: blå, avlägsna, snötäckta toppar
    const ridge=(base,amp,seed,col,snow)=>{ const rr=rng(seed); x.beginPath(); x.moveTo(0,hz); let px=0;
      for(let xx=0;xx<=c.width;xx+=c.width/14){ const y=base-amp*(.35+.65*Math.abs(Math.sin(xx/c.width*7+seed)))*(.8+rr()*.4); x.lineTo(xx,y); px=xx; } x.lineTo(c.width,hz); x.closePath();
      const gg=x.createLinearGradient(0,base-amp,0,hz); gg.addColorStop(0,snow); gg.addColorStop(1,col); x.fillStyle=gg; x.fill(); };
    ridge(hz*.86,hz*.2,5,'#a9b9d8','#eef2fb'); ridge(hz*.93,hz*.1,9,'#7f97be','#d5def0');
    // Frösön och stranden: mörk skog
    x.fillStyle='#365247'; x.beginPath(); x.moveTo(0,hz); for(let xx=0;xx<=c.width;xx+=6){ const isl=Math.max(0,Math.sin(xx/c.width*Math.PI*2.2+.6)); x.lineTo(xx,hz-2-isl*hz*.07-r()*2); } x.lineTo(c.width,hz+2); x.lineTo(0,hz+2); x.fill();
    // Frösö kyrka (vit, rött tak) och lite bebyggelse
    const kx=c.width*.22, ky=hz-hz*.055; x.fillStyle='#fbfbfb'; x.fillRect(kx-6,ky-6,12,6); x.fillStyle='#9a2a22'; x.beginPath(); x.moveTo(kx-7,ky-6); x.lineTo(kx,ky-10); x.lineTo(kx+7,ky-6); x.fill(); x.fillStyle='#fbfbfb'; x.fillRect(kx+7,ky-12,3,12); x.fillStyle='#9a2a22'; x.beginPath(); x.moveTo(kx+6,ky-12); x.lineTo(kx+8.5,ky-17); x.lineTo(kx+11,ky-12); x.fill();
    // den frusna sjön, snötäckt med glittrande ränder
    const lg=x.createLinearGradient(0,hz,0,hz+vb); lg.addColorStop(0,'#c9d7ea'); lg.addColorStop(.5,'#e3ecf7'); lg.addColorStop(1,'#f3f7fc'); x.fillStyle=lg; x.fillRect(0,hz+1,c.width,vb+4);
    x.fillStyle='rgba(255,255,255,.75)'; for(let i=0;i<26;i++){ const yy=hz+3+Math.pow(r(),1.6)*vb; x.fillRect(r()*c.width,yy,20+r()*80,.8); }
    x.fillStyle='rgba(120,140,170,.35)'; for(let i=0;i<9;i++){ x.fillRect(r()*c.width,hz+4+r()*vb*.6,1.2,.8); }   // skidåkare på isen
    // staden Östersund vid stranden till höger
    for(let i=0;i<34;i++){ const bx=c.width*(.62+r()*.3), by=hz+2+r()*vb*.18, s=2+r()*3; x.fillStyle=['#efe7da','#a3271f','#d9c39a','#cfd7e3'][i%4]; x.fillRect(bx,by-s,s*1.6,s); }
    const hz2=x.createLinearGradient(0,hz-8,0,hz+vb); hz2.addColorStop(0,'rgba(255,232,220,.4)'); hz2.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=hz2; x.fillRect(0,hz-8,c.width,vb+10);
    x.setTransform(1,0,0,1,0,0); return {c:cc,hz,vb,w:c.width,h:c.height,K};
  }
  function sprites(){ if(SPR.ok) return; SPR.tree=[makeTree(0),makeTree(1),makeTree(2)]; SPR.fan=Array.from({length:16},(_,i)=>makeFan(i)); SPR.ok=1; }

  /* ---------- skidåkningen i pseudo-3D ---------- */
  const CAMH=2.35, BACK=4.6, ZMAX=170;
  let cam={x:0,z:0,y:0,yaw:0,pitch:0}, F=500, YA=400, BD=null, BDkey='', lastYH=0;
  const DS=DRONE.make('bs_dr'), DSO=DRONE.make('bs_dro',true); let DCUR=DS; let DM=false, DZA=0, DZB=0, VIEWK='back';
  function P(x,z,h=0){ if(DM) return DRONE.proj(DCUR.C,x,elev(z)+h,z); const dz=z-cam.z; if(dz<.3) return null; const xs=x-cam.x-dz*Math.tan(cam.yaw); return [W/2+xs*F/dz, YA+F*((cam.y-(elev(z)+h))/dz-Math.tan(cam.pitch)), F/dz]; }
  function quad(a,b,c,d){ ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]); ctx.lineTo(d[0],d[1]); ctx.closePath(); ctx.fill(); }
  function drawSki(dt){
    const a=meA(), pen=a.ph==='pen', z=pen?a.pz:a.z; T=pen?TP:TL;
    if(glOkB()){ try{ ctx.clearRect(0,0,W,H); glSki(dt,a,pen,z); glShow(true); R.g3=true; return; }catch(e){ GLON=false; glSyncB(); try{ console.warn('3D-grafiken stängdes av:',e); }catch(_){} } }
    R.g3=false; glShow(false);
    const DD=R.camO?DSO:DS.on?DS:null; if(DD){ drawDroneB(dt,a,pen,z,DD); return; }
    const sway=Math.sin(a.t*2.6)*.35*(1-a.tuck);
    const tx=mid(z)+sway, tz=z-BACK;
    cam.x+=(tx-cam.x)*Math.min(1,dt*5); cam.z=tz;
    const head=Math.atan((mid(z+8)-mid(z))/8);   // banans riktning (lutning i sidled per meter) cam.yaw+=((head*.8)-cam.yaw)*Math.min(1,dt*3);
    const ahead=Math.atan(-(elev(z+10)-elev(z))/10); cam.pitch+=(ahead*.85-cam.pitch)*Math.min(1,dt*2.4);
    cam.y=elev(cam.z)+CAMH; F=Math.min(W,H)*1.05;
    YA=H*.8 - F*((cam.y-elev(z))/BACK - Math.tan(cam.pitch));
    const key=W+'x'+H+':'+R.wx.kind+R.wx.seed; if(BDkey!==key){ BD=makeBackdrop(W,H); WEATHER.tintBackdrop(BD.c,BD.hz*BD.K,R.wx); BDkey=key; }
    const yH=YA-F*Math.tan(cam.pitch), top=yH-BD.hz; lastYH=yH;
    ctx.fillStyle=WEATHER.sky(R.wx)||'#4f7fc4'; ctx.fillRect(0,0,W,H);
    const bw=BD.w, per=bw*2; let x0=-((((cam.x*1.1+cam.yaw*W*.95)+(pen?0:wrap(a.z,LP)*.9))%per+per)%per)-bw*.2;
    for(let k=0;k<4&&x0<W;k++,x0+=bw){ if(x0+bw<0) continue; if(k%2===0) ctx.drawImage(BD.c,x0,top,BD.w,BD.h); else { ctx.save(); ctx.translate(x0+bw,top); ctx.scale(-1,1); ctx.drawImage(BD.c,0,0,BD.w,BD.h); ctx.restore(); } }
    ctx.fillStyle='#eef3fa'; ctx.fillRect(0,top+BD.h-1,W,H);
    const objs=collect(z,pen); let oi=0;
    const zs=[]; for(let dz=ZMAX; dz>.6; dz-=Math.max(.7,dz*.06)) zs.push(cam.z+dz);
    let prev=null;
    for(const zz of zs){
      const m=mid(zz), hw=halfAt(zz), pL=P(m-hw,zz), pR=P(m+hw,zz), oL=P(m-hw-80,zz), oR=P(m+hw+80,zz);
      if(!pL) continue;
      if(prev){ const far=Math.min(1,(zz-cam.z)/ZMAX), tr=T.trees[Math.round(wrap(zz,T.N))]||0;
        ctx.fillStyle=`rgb(${226-far*14-tr*14},${234-far*10-tr*8},${246-far*5})`; quad(prev.oL,prev.oR,oR,oL);
        const band=(Math.floor(zz/4)%2)*2, gr=gradeAt(zz), sh=clamp(gr*60,-8,8);
        ctx.fillStyle=`rgb(${247-far*16-band+sh},${250-far*12-band+sh},${255-far*6})`; quad(prev.pL,prev.pR,pR,pL);
        // vallade kanter (plogvall) och korduroy närmast
        ctx.fillStyle='rgba(190,205,228,.55)'; const e1=P(m-hw-.6,zz), e2=P(m+hw+.6,zz), q1=P(mid(prev.z)-halfAt(prev.z)-.6,prev.z), q2=P(mid(prev.z)+halfAt(prev.z)+.6,prev.z);
        if(e1&&q1){ quad(q1,prev.pL,pL,e1); quad(prev.pR,q2,e2,pR); }
        if(zz-cam.z<45){ ctx.strokeStyle='rgba(160,180,212,.28)'; ctx.lineWidth=1; ctx.beginPath(); const pm=mid(prev.z), ph=halfAt(prev.z);
          for(let lx=-.9;lx<.95;lx+=.12){ const p1=P(pm+lx*ph,prev.z), p2=P(m+lx*hw,zz); if(p1&&p2){ ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); } } ctx.stroke(); }
        if(zz-cam.z<70 && hw>3){ ctx.strokeStyle='rgba(130,152,196,.55)'; ctx.lineWidth=Math.max(1,F/(zz-cam.z)*.05); ctx.beginPath(); const pm=mid(prev.z), ph=halfAt(prev.z);
          for(const o of [.55,.78,1.25,1.48]){ const p1=P(pm+ph-o,prev.z), p2=P(m+hw-o,zz); if(p1&&p2){ ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); } } ctx.stroke(); }
        // start-/mållinjen
        if(!pen){ const q=wrap(zz,LP); if(q>LINE-.4&&q<LINE+.6){ ctx.fillStyle='rgba(239,68,68,.85)'; quad(prev.pL,prev.pR,pR,pL); } }
      }
      while(oi<objs.length && objs[oi].z>=zz){ drawObj(objs[oi]); oi++; }
      prev={pL,pR,oL,oR,z:zz};
    }
    while(oi<objs.length){ drawObj(objs[oi]); oi++; }
    // snöstänk från skären
    R.parts=R.parts.filter(p=>(p.t-=dt)>0);
    for(const p of R.parts){ p.x+=p.vx*dt; p.z+=p.vz*dt; p.y+=p.vy*dt; p.vy-=9*dt; const q=P(p.x,p.z,Math.max(0,p.y)); if(!q) continue; ctx.globalAlpha=Math.min(1,p.t*2.4); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(q[0],q[1],Math.max(.8,q[2]*.04*p.r),0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    skier3(a,mid(z),z,true);
  }
  // drönaren: äkta 3D-kamera runt åkaren
  function drawDroneB(dt,a,pen,z,D){ DCUR=D;
    const fx=mid(z+3)-mid(z-3), Cc=DRONE.solve(D,{x:mid(z),y:elev(z)+1,z},fx/6,1,dt,W,H,zz=>elev(zz));
    DM=true; VIEWK=DRONE.facing(Cc,fx/6,1);
    const key=W+'x'+H+':'+R.wx.kind+R.wx.seed; if(BDkey!==key){ BD=makeBackdrop(W,H); WEATHER.tintBackdrop(BD.c,BD.hz*BD.K,R.wx); BDkey=key; }
    const yH=H/2-Cc.f*Math.tan(Cc.pitch); lastYH=yH;
    ctx.fillStyle=WEATHER.sky(R.wx)||'#4f7fc4'; ctx.fillRect(0,0,W,H);
    if(yH>0){ const top=yH-BD.hz, bw=BD.w; let x0=-(((Cc.yaw*Cc.f*.9)%(bw*2)+bw*2)%(bw*2))-bw*.2;
      for(let k=0;k<4&&x0<W;k++,x0+=bw){ if(x0+bw<0) continue; if(k%2===0) ctx.drawImage(BD.c,x0,top,BD.w,BD.h); else { ctx.save(); ctx.translate(x0+bw,top); ctx.scale(-1,1); ctx.drawImage(BD.c,0,0,BD.w,BD.h); ctx.restore(); } }
      ctx.fillStyle='#eef3fa'; ctx.fillRect(0,top+BD.h-1,W,H); }
    else { ctx.fillStyle='#eef3fa'; ctx.fillRect(0,0,W,H); }
    DZA=z-120; DZB=z+220;
    const L=[], BANDS=[[0,6],[6,22],[22,80]]; let prev=null;
    for(let zz=DZA; zz<=DZB; zz+=Math.max(.8,Math.abs(zz-D.C.z)*.03)){
      const m=mid(zz), hw=halfAt(zz), e={z:zz, m, hw};
      if(prev){ const zc=(zz+prev.z)/2, tr=T.trees[Math.round(wrap(zc,T.N))]||0, band=(Math.floor(zz/4)%2)*2, line=!pen&&wrap(zc,LP)>LINE-.6&&wrap(zc,LP)<LINE+.6;
        const pc=P(mid(zc),zc), q=[P(prev.m-prev.hw,prev.z),P(prev.m+prev.hw,prev.z),P(m+hw,zz),P(m-hw,zz)];
        if(pc&&q.every(v=>v&&v[3]>1.5)){ const col=line?'rgba(239,68,68,.85)':`rgb(${247-band},${250-band},255)`; L.push({Z:pc[3]+.8, d:()=>{ ctx.fillStyle=col; quad(...q); }}); }
        const oc=`rgb(${226-tr*14},${234-tr*8},246)`;
        for(const sd of [-1,1]) for(const [b0,b1] of BANDS){ const cc=P(mid(zc)+sd*(halfAt(zc)+(b0+b1)/2),zc), qq=[P(prev.m+sd*(prev.hw+b0),prev.z),P(prev.m+sd*(prev.hw+b1),prev.z),P(m+sd*(hw+b1),zz),P(m+sd*(hw+b0),zz)];
          if(cc&&qq.every(v=>v&&v[3]>1.5)) L.push({Z:cc[3]+.8, d:()=>{ ctx.fillStyle=oc; quad(...qq); }}); } }
      prev=e; }
    for(const o of collect(z,pen)){ const x=o.x!=null?o.x : o.a ? mid(o.a.ph==='pen'?o.a.pz:o.a.z) : mid(o.z), p=P(x,o.z); if(!p) continue;
      const flat=o.t==='mat'; if(!flat&&p[3]<4) continue; L.push({Z:p[3]+(flat?.4:0), d:()=>drawObj(o)}); }
    const pm=P(mid(z),z); if(pm) L.push({Z:pm[3]-.05, d:()=>skier3(a,mid(z),z,true)});
    L.sort((p,q)=>q.Z-p.Z); for(const it of L) it.d();
    R.parts=R.parts.filter(p=>(p.t-=dt)>0);
    for(const p of R.parts){ p.x+=p.vx*dt; p.z+=p.vz*dt; p.y+=p.vy*dt; p.vy-=9*dt; const q=P(p.x,p.z,Math.max(0,p.y)); if(!q) continue; ctx.globalAlpha=Math.min(1,p.t*2.4); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(q[0],q[1],Math.max(.8,q[2]*.04*p.r),0,7); ctx.fill(); }
    ctx.globalAlpha=1; DM=false;
  }
  // föremål runt banan (i varvets koordinater, upprepas varje varv)
  const STATIC=(()=>{ const o=[], r=rng(77);
    o.push({q:LINE, t:'arch'});
    for(let q=4;q<92;q+=7) o.push({q, t:'stand', sd:-1});
    o.push({q:66, t:'screen'}); o.push({q:132, t:'tower'});
    for(let q=RANGE-6;q<RANGE+10;q+=1.2) o.push({q, t:'mat', i:Math.round((q-RANGE+6)/1.2)});
    o.push({q:RANGE+50, t:'targets'});
    for(let q=0;q<LP;q+=9){ const k=TL.kind[q]; if(k==='stadium'||k==='into'||k==='top'||k==='climb') o.push({q, t:'flag', sd:r()<.5?-1:1, ph:r()*6}); }
    return o; })();
  function collect(z,pen){
    const objs=[], zA=DM?DZA:cam.z+.8, zB=DM?DZB:cam.z+ZMAX, N=T.N;
    for(let zz=Math.ceil(zA/5)*5; zz<zB; zz+=5){ const qi=Math.round(wrap(zz,N)), m=mid(zz), hw=halfAt(zz), r=rng(qi*7+(pen?999:1)), dens=T.trees[qi]||0, cr=T.crowd[qi];
      for(const sd of [-1,1]){
        if(cr) objs.push({z:zz, t:'fence', x:m+sd*(hw+1.3), sd});
        const n=Math.round(dens*4+r()*1.2)-(zz-cam.z>110?1:0);
        for(let k=0;k<n;k++){ const dist=dens>.8?2.5+r()*6+k*5:9+r()*28+k*9; if(!pen && wrap(zz,LP)<100 && sd>0) continue; objs.push({z:zz+r()*5, t:'tree', x:m+sd*(hw+dist), v:r()<(dens>.8?.1:.3)?2:(r()<.5?0:1), s:.8+r()*.7}); }
        if(cr && !(sd<0 && !pen && wrap(zz,LP)<92)){ const nn=cr>1?4:2; for(let k=0;k<nn;k++) objs.push({z:zz+k*1.2, t:'fan', x:m+sd*(hw+2.3+r()*3), v:Math.floor(r()*16), ph:r()*6}); }
      }
    }
    if(!pen){ const base=Math.floor(zA/LP)*LP; for(const b of [base-LP,base,base+LP]) for(const s of STATIC){ const zz=b+s.q; if(zz>zA&&zz<zB) objs.push({...s, z:zz}); } }
    else { for(let zz=Math.ceil(zA/30)*30; zz<zB; zz+=30) objs.push({z:zz, t:'range2', x:mid(zz)+halfAt(zz)+6}); }
    // de andra åkarna
    const me=meA();
    for(const a of R.A){ if(a===me||a.ph==='range'||a.done&&a.ph==='done') continue; const az = pen ? (a.ph==='pen'?a.pz:null) : (a.ph==='ski'?a.z:null); if(az==null) continue;
      if(az>zA&&az<zB) objs.push({z:az, t:'skier', a}); }
    objs.sort((p,q)=>q.z-p.z); return objs;
  }
  const now2=()=>performance.now()/1000;
  function drawObj(o){
    const t=now2();
    if(o.t==='tree'&&DM&&VIEWK==='top'){ const p=P(o.x,o.z); if(!p) return; const r=p[2]*(o.v===2?1.6:2.3)*o.s; if(r<.8) return; ctx.fillStyle=o.v===2?'rgba(120,110,100,.7)':'#1f4d3a'; ctx.beginPath(); ctx.arc(p[0],p[1],r,0,7); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(p[0]-r*.25,p[1]-r*.25,r*.5,0,7); ctx.fill(); return; }
    if(o.t==='fan'&&DM&&VIEWK==='top'){ const p=P(o.x,o.z); if(!p) return; ctx.fillStyle=JACK[o.v%JACK.length]; ctx.beginPath(); ctx.arc(p[0],p[1],Math.max(1,p[2]*.28),0,7); ctx.fill(); return; }
    if(o.t==='tree'){ const p=P(o.x,o.z); if(!p) return; const img=SPR.tree[o.v], h=p[2]*8*o.s, w=h*img.width/img.height; if(p[0]+w*4<0||p[0]-w>W||h<1) return;
      if(h>14){ const q1=P(o.x-.7*o.s,o.z), q2=P(o.x+.7*o.s,o.z), q3=P(o.x+(R.wx.kind==='sun'?9:4)*o.s,o.z+3*o.s); if(q1&&q2&&q3){ ctx.fillStyle=WEATHER.shadow(R.wx,.13); ctx.beginPath(); ctx.moveTo(q1[0],q1[1]); ctx.lineTo(q2[0],q2[1]); ctx.lineTo(q3[0],q3[1]); ctx.fill(); } } ctx.drawImage(img,p[0]-w/2,p[1]-h,w,h); return; }
    if(o.t==='fan'){ const p=P(o.x,o.z); if(!p) return; const img=SPR.fan[o.v], h=p[2]*1.75, w=h*img.width/img.height; if(h<1.5) return; if(h>12){ ctx.fillStyle=WEATHER.shadow(R.wx,.16); ctx.beginPath(); ctx.ellipse(p[0]+w*.2,p[1],w*.6,Math.max(1,h*.045),0,0,7); ctx.fill(); } const j=Math.max(0,Math.sin(t*6+o.ph))*h*.1; ctx.drawImage(img,p[0]-w/2,p[1]-h-j,w,h); return; }
    if(o.t==='fence'){ const z2=o.z+5, x2=mid(z2)+o.sd*(halfAt(z2)+1.3), a=P(o.x,o.z), b=P(x2,z2); if(!a||!b) return;
      const at=DM?P(o.x,o.z,1):[a[0],a[1]-a[2]], bt=DM?P(x2,z2,1):[b[0],b[1]-b[2]]; if(!at||!bt) return; const L=(p,q,f)=>[p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f];
      ctx.fillStyle='rgba(30,64,175,.6)'; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(bt[0],bt[1]); ctx.lineTo(at[0],at[1]); ctx.closePath(); ctx.fill();
      const a1=L(a,at,.62), b1=L(b,bt,.62), b2=L(b,bt,.48), a2=L(a,at,.48);
      ctx.fillStyle='rgba(250,204,21,.9)'; ctx.beginPath(); ctx.moveTo(a1[0],a1[1]); ctx.lineTo(b1[0],b1[1]); ctx.lineTo(b2[0],b2[1]); ctx.lineTo(a2[0],a2[1]); ctx.closePath(); ctx.fill(); return; }
    if(o.t==='flag'){ const m=mid(o.z), x=m+o.sd*(halfAt(o.z)+3.5), p=P(x,o.z); if(!p||p[2]<1) return; const h=p[2]*5; ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=Math.max(1,p[2]*.06); ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[0],p[1]-h); ctx.stroke();
      const fw=p[2]*1.6, fh=p[2]*1, wv=Math.sin(t*4+o.ph)*fh*.15; ctx.fillStyle='#006aa7'; ctx.beginPath(); ctx.moveTo(p[0],p[1]-h); ctx.quadraticCurveTo(p[0]+fw/2,p[1]-h+wv,p[0]+fw,p[1]-h); ctx.lineTo(p[0]+fw,p[1]-h+fh); ctx.quadraticCurveTo(p[0]+fw/2,p[1]-h+fh+wv,p[0],p[1]-h+fh); ctx.fill();
      ctx.fillStyle='#fecc00'; ctx.fillRect(p[0]+fw*.3,p[1]-h,fw*.13,fh); ctx.fillRect(p[0],p[1]-h+fh*.42,fw,fh*.16); return; }
    if(o.t==='stand'){ // läktaren till vänster: trappsteg med publik
      const m=mid(o.z), x0=m-halfAt(o.z)-3; for(let row=0;row<7;row++){ const x=x0-row*1.6, hgt=row*1.1; const a=P(x,o.z,hgt), b=P(x,o.z+7,hgt), a2=P(x,o.z,hgt+1.1), b2=P(x,o.z+7,hgt+1.1); if(!a||!b||!a2||!b2) continue;
        ctx.fillStyle=row%2?'#475569':'#52617a'; quad(a,b,b2,a2);
        const n=Math.max(2,Math.min(9,Math.round(a[2]*.5))); for(let k=0;k<n;k++){ const zz=o.z+(k+.5)*7/n, p=P(x-.4,zz,hgt+1.1); if(!p) continue; const img=SPR.fan[(row*5+k+Math.round(o.z))%16], hh=p[2]*1.3, ww=hh*img.width/img.height, j=Math.max(0,Math.sin(t*5+k+row))*hh*.08; ctx.drawImage(img,p[0]-ww/2,p[1]-hh-j,ww,hh); } }
      return; }
    if(o.t==='arch'){ const m=mid(o.z), hw=halfAt(o.z)+1, a=P(m-hw,o.z), b=P(m+hw,o.z), a2=P(m-hw,o.z,5.2), b2=P(m+hw,o.z,5.2), a3=P(m-hw,o.z,4.1); if(!a||!b||!a2||!b2) return;
      ctx.strokeStyle='#0b2e7a'; ctx.lineWidth=Math.max(2,a[2]*.6); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(a2[0],a2[1]); ctx.moveTo(b[0],b[1]); ctx.lineTo(b2[0],b2[1]); ctx.stroke();
      ctx.fillStyle='#0b2e7a'; ctx.fillRect(a2[0],a2[1],b2[0]-a2[0],a3[1]-a2[1]); ctx.fillStyle='#facc15'; ctx.font=`900 ${Math.max(6,(a3[1]-a2[1])*.62)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('ÖSTERSUND · SKIDSKYTTE',(a2[0]+b2[0])/2,(a2[1]+a3[1])/2); return; }
    if(o.t==='screen'){ const m=mid(o.z), x=m-halfAt(o.z)-16, a=P(x-4,o.z,6), b=P(x+4,o.z,6), c=P(x-4,o.z,11); if(!a||!b||!c) return; ctx.fillStyle='#111827'; ctx.fillRect(a[0],c[1],b[0]-a[0],a[1]-c[1]); ctx.fillStyle='#1e3a8a'; ctx.fillRect(a[0]+2,c[1]+2,b[0]-a[0]-4,a[1]-c[1]-4);
      const lp=P(x,o.z,0); if(lp){ ctx.fillStyle='#334155'; ctx.fillRect(lp[0]-1,a[1],2,lp[1]-a[1]); } if(b[0]-a[0]>30){ ctx.fillStyle='#fff'; ctx.font=`700 ${(a[1]-c[1])*.2}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; const me=meA(); ctx.fillText(`${Math.round(me.hr)} ♥  ${fmtT(me.t)}`,(a[0]+b[0])/2,(a[1]+c[1])/2); } return; }
    if(o.t==='tower'){ // Arctura: smalt, högt ljustorn vid stadion
      const m=mid(o.z), x=m-48, b=P(x,o.z), tp=P(x,o.z,58); if(!b||!tp) return; const w=Math.max(1.5,b[2]*1.4);
      const g=ctx.createLinearGradient(b[0]-w,0,b[0]+w,0); g.addColorStop(0,'#cbd5e1'); g.addColorStop(.5,'#f8fafc'); g.addColorStop(1,'#94a3b8'); ctx.fillStyle=g;
      ctx.beginPath(); ctx.moveTo(b[0]-w,b[1]); ctx.lineTo(tp[0]-w*.35,tp[1]); ctx.lineTo(tp[0]+w*.35,tp[1]); ctx.lineTo(b[0]+w,b[1]); ctx.fill();
      ctx.fillStyle='rgba(125,211,252,.95)'; for(let k=0;k<6;k++){ const yy=lerp(b[1],tp[1],.35+k*.11); ctx.fillRect(lerp(b[0],tp[0],.35+k*.11)-w*.45,yy,w*.9,Math.max(1,w*.25)); }
      const gl=ctx.createRadialGradient(tp[0],tp[1],1,tp[0],tp[1],w*5); gl.addColorStop(0,'rgba(186,230,253,.9)'); gl.addColorStop(1,'rgba(186,230,253,0)'); ctx.fillStyle=gl; ctx.fillRect(tp[0]-w*5,tp[1]-w*5,w*10,w*10); return; }
    if(o.t==='mat'){ const m=mid(o.z), x0=m+halfAt(o.z)+2; for(let L=0;L<12;L++){ const x=x0+L*2.6, a=P(x,o.z), b=P(x+1.6,o.z), c=P(x+1.6,o.z+1.1), d=P(x,o.z+1.1); if(!a||!b||!c||!d) continue; ctx.fillStyle=L%2?'#1f2937':'#273449'; quad(a,b,c,d); }
      return; }
    if(o.t==='targets'){ const m=mid(o.z), x0=m+halfAt(o.z)+2; for(let L=0;L<12;L++){ const x=x0+L*2.6+.8, a=P(x-.5,o.z,.5), b=P(x+.5,o.z,.5), c=P(x-.5,o.z,.95); if(!a||!b||!c) continue;
        ctx.fillStyle='#e5e7eb'; ctx.fillRect(a[0],c[1],b[0]-a[0],a[1]-c[1]); ctx.fillStyle='#111'; const rr=Math.max(.6,(b[0]-a[0])*.08); for(let k=0;k<5;k++){ ctx.beginPath(); ctx.arc(lerp(a[0],b[0],.14+k*.18),(a[1]+c[1])/2,rr,0,7); ctx.fill(); }
        const nb=P(x,o.z,1.5); if(nb&&a[2]>6){ ctx.fillStyle='#fff'; ctx.fillRect(nb[0]-a[2]*.25,nb[1]-a[2]*.25,a[2]*.5,a[2]*.4); ctx.fillStyle='#111'; ctx.font=`800 ${a[2]*.3}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(L*2+1),nb[0],nb[1]-a[2]*.05); } }
      return; }
    if(o.t==='range2'){ const a=P(o.x,o.z), b=P(o.x+22,o.z), c=P(o.x+22,o.z,3), d=P(o.x,o.z,3); if(!a||!b||!c||!d) return; ctx.fillStyle='#e2e8f0'; quad(a,b,c,d); ctx.fillStyle='rgba(30,64,175,.7)'; ctx.fillRect(a[0],d[1],b[0]-a[0],(a[1]-d[1])*.25); return; }
    if(o.t==='skier'){ const az=o.a.ph==='pen'?o.a.pz:o.a.z; skier3(o.a,mid(az)+(o.a.k%3-1)*1.4,az,false); return; }
  }
  // åkaren i äkta 3D: skejt med tyngdöverföring till glidskidan, stakning med båda stavarna, gevär på ryggen
  const SUIT=[{b:'#0b2e7a',m:'#1d4ed8',a:'#facc15'},{b:'#991b1b',m:'#dc2626',a:'#f8fafc'},{b:'#14532d',m:'#16a34a',a:'#f8fafc'},{b:'#3f3f46',m:'#71717a',a:'#f97316'}];
  function limb(x1,y1,x2,y2,w1,w2,col){ const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L; ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x1+nx*w1/2,y1+ny*w1/2); ctx.lineTo(x2+nx*w2/2,y2+ny*w2/2); ctx.lineTo(x2-nx*w2/2,y2-ny*w2/2); ctx.lineTo(x1-nx*w1/2,y1-ny*w1/2); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(x1,y1,w1/2,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(x2,y2,w2/2,0,7); ctx.fill(); }
  const sm=t=>{ t=clamp(t,0,1); return t*t*(3-2*t); };
  const add3=(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
  function ik(a,b,l1,l2,bend){ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], d=Math.min(l1+l2-.002,Math.hypot(dx,dy,dz)||.001), k=(l1*l1-l2*l2+d*d)/(2*d), h=Math.sqrt(Math.max(0,l1*l1-k*k));
    const D=Math.hypot(dx,dy,dz)||.001, ux=dx/D, uy=dy/D, uz=dz/D; let bx=bend[0], by=bend[1], bz=bend[2]; const dt=bx*ux+by*uy+bz*uz; bx-=dt*ux; by-=dt*uy; bz-=dt*uz; const bl=Math.hypot(bx,by,bz)||1;
    return [a[0]+ux*k+bx/bl*h, a[1]+uy*k+by/bl*h, a[2]+uz*k+bz/bl*h]; }
  function skier3(a,wx,wz,me){
    const hd=Math.atan2(mid(wz+2)-mid(wz-2),4), ch=Math.cos(hd), sh=Math.sin(hd);
    const J=v=>P(wx+v[0]*ch+v[2]*sh, wz-v[0]*sh+v[2]*ch, v[1]);
    const dep=p=>DM?p[3]:F/p[2];
    const W3=v=>{ const x=wx+v[0]*ch+v[2]*sh, z=wz-v[0]*sh+v[2]*ch; return [x,elev(z)+v[1],z]; };
    const c0=CAP?CAPP:J([0,.9,0]); if(!CAP){ if(!c0||c0[2]<1.2) return; if(c0[0]<-c0[2]*2||c0[0]>W+c0[2]*2) return; }
    const md=a.done&&a.mood?a.mood:null, tn=now(), S=SUIT[a.k%4], st=md?0:clamp(a.stride||0,0,1);
    const tk=md?0:(a.tuck||0), e=sm(st), u=1-st, sd=a.lastSide==='L'?-1:1, nt=1-tk;
    const crunch=Math.sin(Math.PI*st)*nt, hop=md==='cheer'?Math.abs(Math.sin(tn*6.5))*.1:0;
    // fötter: glidskidan under kroppen, frånskjutsbenet ut och bak, lyfts när det hämtas hem
    const gF=[-sd*(.19+.05*e*nt), hop, .12*e*nt], pF=[sd*(.22+.3*e*nt), hop+.07*Math.sin(Math.PI*u)*nt*(st>0?1:0), -.22*e*nt];
    const hip=[gF[0]*.5*e, .92-.12*e*nt-.05*crunch-.27*tk-(md==='sad'?.03:0)+hop, .02-.12*tk];
    const lean=.38+.24*crunch+.8*tk+(md==='sad'?.18:0)-(md==='cheer'?.3:0), tdir=[0,Math.cos(lean),Math.sin(lean)], back=[0,Math.sin(lean),-Math.cos(lean)];
    const chest=add3(add3(hip,tdir,.5),[-sd*.03*e,0,0]);
    const head=add3(chest,[0,.2*Math.cos(lean*.45)-(md==='sad'?.04:0),.2*Math.sin(lean*.45)+.02+(md==='sad'?.06:0)]);
    const list=[], sc0=c0[2];
    const seg=(p,q,w1,w2,col,bias=0)=>{ if(CAP){ CAP.push(['c',W3(p),W3(q),w1/2,w2/2,col]); return; } const A=J(p), B=J(q); if(!A||!B) return; list.push({z:(dep(A)+dep(B))/2+bias, f:()=>limb(A[0],A[1],B[0],B[1],Math.max(1,w1*A[2]),Math.max(1,w2*B[2]),col)}); };
    const line=(p,q,w,col,bias=0)=>{ if(CAP){ CAP.push(['c',W3(p),W3(q),w/2,w/2,col]); return; } const A=J(p), B=J(q); if(!A||!B) return; list.push({z:(dep(A)+dep(B))/2+bias, f:()=>{ ctx.strokeStyle=col; ctx.lineWidth=Math.max(1,w*(A[2]+B[2])/2); ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.lineTo(B[0],B[1]); ctx.stroke(); }}); };
    // skugga på snön
    if(!CAP){ ctx.fillStyle=WEATHER.shadow(R.wx,.24); ctx.beginPath(); let ok=true; const ox=R.wx.kind==='sun'?.28:0; for(let i=0;i<12;i++){ const t=i/12*Math.PI*2, p=J([hip[0]+ox+Math.cos(t)*.42,0,hip[2]-.05+Math.sin(t)*.8]); if(!p){ ok=false; break; } i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]); } if(ok) ctx.fill(); }
    for(const k of [-1,1]){
      const f=k===sd?pF:gF, ang=k*(tk>.5?.03:.24), d=[Math.sin(ang),0,Math.cos(ang)], ankle=[f[0],f[1]+.1,f[2]-.02], hj=[hip[0]+k*.1,hip[1],hip[2]];
      // skidan med färgad mittrand, bindning och pjäxa
      const tail=add3(f,d,-.7), tip=add3(f,d,1.1); tip[1]+=.03+f[1]*.4;
      line(tail,tip,.052,'#f8fafc',.06); line(add3(f,d,-.7),add3(f,d,.95),.018,S.m,.055); line(tail,tip,.06,'rgba(15,23,42,.25)',.07);
      seg(add3(f,d,-.1),add3(f,d,.2),.085,.075,'#111827',.02); seg([f[0],f[1]+.03,f[2]],ankle,.085,.08,'#111827');
      const knee=ik(hj,ankle,.45,.45,[k*.22,0,1]);
      seg(ankle,knee,.085,.115,S.b); seg(knee,hj,.12,.165,S.b); line(add3(ankle,[k*.045,0,0]),add3(knee,[k*.06,0,0]),.02,S.a,-.01);
      // armar och stavar
      const sp=[chest[0]+k*.19,chest[1]-.02,chest[2]-k*sd*.04*e];
      const d1=sm(u/.5), r1=sm((u-.5)/.5); let hand, tipP, L=1.42;
      if(md==='cheer'){ const w=Math.sin(tn*9+k)*.05; hand=add3(sp,[k*.2+w,.5,.06]); tipP=add3(hand,[k*.6,1.3,0]); }
      else if(md==='sad'){ hand=add3(sp,[k*.03,-.54,.08]); tipP=[hand[0]+k*.12,0,hand[2]-.7]; }
      else if(tk>.5){ hand=add3(sp,[-k*.07,-.1,.3]); tipP=add3(hand,[k*.04,.3,-1.45]); }
      else { const hz=u<.5?lerp(.36,-.28,d1):lerp(-.28,.1,r1), hy=u<.5?lerp(-.02,-.5,d1):lerp(-.5,-.38,r1); hand=add3(sp,[k*.07,hy,hz]);
        if(u<.5 && st>0){ const dz=Math.sqrt(Math.max(.04,L*L-hand[1]*hand[1])); tipP=[hand[0]+k*.1,0,hand[2]-dz]; }
        else { const A=1+.22*Math.sin(Math.PI*r1); tipP=add3(hand,[k*.07,-Math.cos(A)*L,-Math.sin(A)*L]); if(tipP[1]<0) tipP[1]=0; } }
      const elbow=ik(sp,hand,.3,.28,md==='cheer'?[k,0,-.3]:[k*.6,-.5,-.6]);
      line(hand,tipP,.02,'#cbd5e1'); if(CAP) CAP.push(['s',W3(add3(tipP,[hand[0]-tipP[0],hand[1]-tipP[1],hand[2]-tipP[2]],.06)),.035,'#334155']); else { const bk=add3(tipP,[hand[0]-tipP[0],hand[1]-tipP[1],hand[2]-tipP[2]],.06), bp=J(bk); if(bp&&bp[2]>14) list.push({z:dep(bp), f:()=>{ ctx.strokeStyle='#334155'; ctx.lineWidth=Math.max(1,bp[2]*.012); ctx.beginPath(); ctx.ellipse(bp[0],bp[1],bp[2]*.045,bp[2]*.02,0,0,7); ctx.stroke(); }}); }
      seg(sp,elbow,.105,.09,S.b); seg(elbow,hand,.085,.075,S.m); seg(hand,add3(hand,[0,.03,0]),.085,.085,'#0f172a',-.01);
    }
    // bål, höft och axlar
    seg([hip[0]-.1,hip[1],hip[2]],[hip[0]+.1,hip[1],hip[2]],.19,.19,S.b,.01);
    seg(add3(hip,tdir,.04),add3(chest,tdir,-.06),.3,.36,S.b); seg(add3(hip,tdir,.1),add3(chest,tdir,-.1),.17,.22,S.m,-.005);
    seg([chest[0]-.17,chest[1]-.02,chest[2]+sd*.04*e],[chest[0]+.17,chest[1]-.02,chest[2]-sd*.04*e],.15,.15,S.b);
    // nummerlapp fram och bak
    for(const s of [1,-1]){ const b0=add3(add3(hip,tdir,.2),back,s*.105), b1=add3(add3(hip,tdir,.43),back,s*.125); seg(b0,b1,.24,.27,'#fff',.0);
      const m=J(add3(add3(hip,tdir,.33),back,s*.2)), cc=J(add3(hip,tdir,.33)); if(m&&cc&&m[2]>22&&dep(m)<dep(cc)) list.push({z:dep(m)-.05, f:()=>{ ctx.fillStyle='#111827'; ctx.font=`900 ${Math.max(6,m[2]*.15)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(a.lane),m[0],m[1]); }}); }
    // geväret på ryggen: kolven vid vänster höft, pipan upp över höger axel
    { const butt=add3(add3(add3(hip,tdir,.1),back,.17),[-.1,0,0]), muz=add3(add3(add3(hip,tdir,.95),back,.16),[.11,0,0]), mid2=[lerp(butt[0],muz[0],.42),lerp(butt[1],muz[1],.42),lerp(butt[2],muz[2],.42)];
      seg(butt,mid2,.085,.06,'#3b2416',.0); line(butt,mid2,.03,'#6b4428',-.01); line(mid2,muz,.028,'#1f2937'); line(add3(chest,back,.1),add3(add3(hip,tdir,.12),back,.12),.022,'#111827',.005); }
    // huvud: mössa i landslagsfärger, ansikte när kameran är framför
    if(CAP){ seg(add3(chest,tdir,.02),add3(head,[0,-.06,-.01]),.085,.08,'#f1c7a5'); CAP.push(['s',W3(head),.108,'#f1c7a5'],['s',W3(add3(head,[0,.045,-.02])),.105,S.b],['s',W3(add3(head,[0,.15,-.02])),.032,S.a]);
      for(const k of [-1,1]) CAP.push(['s',W3(add3(head,[k*.035,.01,.1])),.012,'#1e293b']); return; }
    { const hp=J(head), nose=J(add3(head,[0,-.02,.1])); if(hp&&nose){ const front=dep(nose)<dep(hp)-.02, r=Math.max(1.5,hp[2]*.108);
      seg(add3(chest,tdir,.02),add3(head,[0,-.06,-.01]),.085,.08,'#f1c7a5');
      list.push({z:dep(hp)-.02, f:()=>{ ctx.fillStyle='#f1c7a5'; ctx.beginPath(); ctx.arc(hp[0],hp[1],r,0,7); ctx.fill();
        if(front){ const fx=hp[0]+(nose[0]-hp[0])*.9, fy=hp[1]+(nose[1]-hp[1])*.5; if(r>5){ ctx.fillStyle='#1e293b'; ctx.beginPath(); ctx.arc(fx-r*.33,fy+r*.05,r*.11,0,7); ctx.arc(fx+r*.33,fy+r*.05,r*.11,0,7); ctx.fill(); ctx.strokeStyle='#9a3412'; ctx.lineWidth=Math.max(1,r*.1); ctx.beginPath(); ctx.arc(fx,fy+r*.35,r*.28,.2,Math.PI-.2); ctx.stroke(); }
          ctx.fillStyle=S.b; ctx.beginPath(); ctx.arc(hp[0],hp[1],r*1.04,Math.PI*1.02,-Math.PI*.02); ctx.fill(); ctx.fillStyle=S.a; ctx.fillRect(hp[0]-r*1.04,hp[1]-r*.2,r*2.08,r*.22); }
        else { ctx.fillStyle=S.b; ctx.beginPath(); ctx.arc(hp[0],hp[1],r*1.04,Math.PI*.86,Math.PI*.14); ctx.fill(); ctx.strokeStyle=S.a; ctx.lineWidth=Math.max(1,r*.2); ctx.beginPath(); ctx.arc(hp[0],hp[1],r*.98,Math.PI*.9,Math.PI*.1,true); ctx.stroke(); }
        ctx.fillStyle=S.a; ctx.beginPath(); ctx.arc(hp[0],hp[1]-r*1.05,r*.26,0,7); ctx.fill(); }}); } }
    list.sort((p,q)=>q.z-p.z); for(const it of list) it.f();
    // andedräkt i kylan när pulsen är hög
    if(me && !md && a.hr>130 && sc0>20){ const hp=J(add3(head,[0,-.03,.2])); if(hp){ const k=(tn*1.6)%1; ctx.fillStyle=`rgba(255,255,255,${(.22*(1-k)).toFixed(3)})`; ctx.beginPath(); ctx.arc(hp[0],hp[1]-k*sc0*.12,sc0*(.05+k*.1),0,7); ctx.fill(); } }
  }


  /* ---------- 3D-grafik med grafikkortet (slalomgl.js), som i slalom; enkel grafik som reserv ---------- */
  let GLB=null, glcv=null, GLON=lsGet('bs_gl')!=='0', glVis=false, CAP=null; const CAPP=[0,0,1,1], GCB={x:0,yaw:0,pitch:0,init:0};
  const SUNB=(()=>{ const v=[.62,.36,-.6], l=Math.hypot(...v); return v.map(x=>x/l); })();   // låg vintersol snett bakifrån
  const glOkB=()=>GLON && !!glcv && !!GLB && GLB.ok();
  const glLabelB=()=>GLON?'🖼️ Enkel grafik':'✨ 3D-grafik';
  function glSyncB(explicit){ if(!glcv) return; if(GLON){ if(typeof SLGL==='undefined') GLON=false; else { if(!GLB) GLB=SLGL.create(); if(!GLB.init(glcv)){ GLON=false; if(explicit){ lsSet('bs_gl','0'); try{ toast('3D-grafiken går inte att starta på den här enheten'); }catch(e){} } } } }
    if(!GLON) glShow(false); const b=document.querySelector('.bs-glb'); if(b) b.textContent=glLabelB(); }
  function glShow(on){ if(glcv && glVis!==on){ glVis=on; glcv.style.display=on?'block':'none'; } }
  // mark utanför spåret: plant närmast (stadion, publik), sedan kullar och skogsåsar; Storsjön till höger med fjällen bortom
  for(const A of [TL,TP]){ const N=A.N, fr=new Float32Array(N+1); for(let i=0;i<=N;i++){ let s=0; for(let k=-18;k<=18;k++) s+=(A.crowd[((i+k)%N+N)%N]?26:7); fr[i]=s/37; } A.fr=fr; let mn=1e9; for(let i=0;i<=N;i++) mn=Math.min(mn,A.y[i]); A.lake=mn-16; }
  function gyB(x,z){ const m=mid(z), hw=halfAt(z), s=x-m, d=Math.abs(s)-hw, y0=elev(z); if(d<=0) return y0;
    const e=Math.max(0,d-at(T,T.fr,z)); if(e<=0) return y0; const w=6.2831853/T.N, k=1-Math.exp(-e/30);
    let h=k*(2.4+1.7*Math.sin(w*3*z+s*.02)+1.2*Math.sin(w*7*z-s*.037+1.3));
    if(s<0) h+=e*e*.0004+Math.min(e,900)*.035*(1+.6*Math.sin(w*2*z+s*.006));
    else { const lk=smooth(clamp((e-150)/160,0,1)); h=lerp(h,T.lake-y0,lk); if(e>1350) h+=Math.pow(e-1350,1.08)*.16*(1+.35*Math.sin(w*4*z+s*.004)); }
    return y0+h; }
  function tintB(x,z,y,o){ const m=mid(z), s=x-m, d=Math.abs(s)-halfAt(z), e=d-at(T,T.fr,z), w=6.2831853/T.N, dens=T.trees[Math.round(wrap(z,T.N))]||0;
    o.m=2; if(s>0 && y<T.lake+.6 && e>150){ o.r=.80; o.g=.86; o.b=.93; return; }
    let f=d<40 ? dens*clamp((d-1)/8,0,1)*.6 : clamp((.55+.45*Math.sin(w*5*z+s*.013)*Math.sin(s*.004+1))*(s<0?1:.75),0,1);
    if(y-T.lake>130) f*=clamp(1-(y-T.lake-130)/60,0,1);
    o.r=.93-.55*f; o.g=.95-.45*f; o.b=.985-.53*f; }
  function glBuildB(pen){
    const A=T, N=A.N, Z0=-180, Z1=N+210, B=new SLGL.Builder(120000), B2=new SLGL.Builder(20000), RR=rng(4242);
    // spåret och marken närmast: tätt rutnät som följer spårets mittlinje
    const OUT=[.7,1.6,3,5,8,12,17,24,33,45,60,80,105,140,190,260], IN=[-1,-.75,-.5,-.25,0,.25,.5,.75,1], NO=OUT.length, NX=NO*2+IN.length, DZ=2, NZ=Math.floor((Z1-Z0)/DZ)+1;
    const offs=(i,hw)=> i<NO ? -hw-OUT[NO-1-i] : i<NO+IN.length ? IN[i-NO]*hw : hw+OUT[i-NO-IN.length];
    GLB.addGrid(NX,NZ,(i,j,o)=>{ const z=Z0+j*DZ, m=mid(z), hw=halfAt(z), dx=offs(i,hw), x=m+dx; o.x=x; o.z=z; o.y=gyB(x,z);
      if(Math.abs(dx)<=hw+.01){ o.r=.955; o.g=.965; o.b=.985; o.m=1; } else if(Math.abs(dx)<hw+.8){ o.r=.84; o.g=.88; o.b=.95; o.m=2; o.y+=.12; } else tintB(x,z,o.y,o); });
    // landskapet runt omkring: glest rutnät
    const FS=70, X0=-1500, FNX=Math.ceil(4300/FS)+1, ZF=Z0-1400, FNZ=Math.ceil((Z1-Z0+2800)/FS)+1;
    const inNear=(x,z)=> z>Z0+FS && z<Z1-FS && Math.abs(x-mid(z))<halfAt(z)+260-FS*1.2;
    GLB.addGrid(FNX,FNZ,(i,j,o)=>{ const x=X0+i*FS, z=ZF+j*FS; o.x=x; o.z=z; o.y=gyB(x,z)-(inNear(x,z)?6:0); tintB(x,z,o.y+(inNear(x,z)?6:0),o); },
      (i,j)=>{ const x=X0+i*FS, z=ZF+j*FS; return inNear(x,z)&&inNear(x+FS,z)&&inNear(x,z+FS)&&inNear(x+FS,z+FS); });
    // klassiska spår, startlinjen
    if(!pen){ for(let z=Z0;z<Z1;z+=DZ){ const z2=z+DZ, h1=halfAt(z), h2=halfAt(z2); if(h1<3) continue; for(const o of [.55,.78,1.25,1.48]){ const x1=mid(z)+h1-o, x2=mid(z2)+h2-o, w=.045;
        B2.quad([x1-w,elev(z)+.012,z],[x1+w,elev(z)+.012,z],[x2+w,elev(z2)+.012,z2],[x2-w,elev(z2)+.012,z2],[.7,.76,.88],3); } }
      for(let b=-LP;b<=LP;b+=LP){ const z=b+LINE; if(z<Z0||z>Z1) continue; const m=mid(z), hw=halfAt(z); B2.quad([m-hw,elev(z)+.02,z-.25],[m+hw,elev(z)+.02,z-.25],[m+hw,elev(z+.25)+.02,z+.25],[m-hw,elev(z+.25)+.02,z+.25],[.94,.27,.27],3); } }
    // träd, publik, stängsel, flaggor – samma placering som i den enkla grafiken
    const fan=(x,y,z,v,sc)=>{ sc=sc||1; const c=SLGL.hex(JACK[v%JACK.length]); B.box(x-.2*sc,x+.2*sc,y,y+.8*sc,z-.13*sc,z+.13*sc,[.13,.16,.24],0); B.box(x-.25*sc,x+.25*sc,y+.8*sc,y+1.42*sc,z-.16*sc,z+.16*sc,c,0); B.sphere([x,y+1.57*sc,z],.13*sc,[.95,.8,.68],0,4,3); B.sphere([x,y+1.66*sc,z],.12*sc,SLGL.hex(JACK[(v*5+3)%JACK.length]),0,4,3); };
    const tree=(x,z,v,s)=>{ const y=gyB(x,z), h=8*s;
      if(v===2){ B.cone([x,y-.2,z],[x+.15,y+h*.82,z],.13*s,.035,[.9,.89,.86],0,5); for(let k=0;k<6;k++){ const a=RR()*6.28, hh=h*(.34+k*.08), l=h*(.34-k*.03); B.cone([x+.08,y+hh,z],[x+Math.cos(a)*l*.6,y+hh+l*.75,z+Math.sin(a)*l*.6],.05*s,.008,[.5,.44,.42],0,3,[.88,.89,.93]); } }
      else { const r=(v?1.5:1.9)*s, g=v?[.10,.27,.20]:[.08,.23,.165]; B.cone([x,y-.3,z],[x,y+h*.2,z],.2*s,.15*s,[.28,.2,.14],0,4); for(let k=0;k<4;k++) B.cone([x,y+h*(.1+.2*k),z],[x,y+Math.min(h,h*(.47+.2*k)),z],r*(1-.23*k),0,g,0,6,[.80,.86,.90]); } };
    for(let zz=Math.ceil(Z0/5)*5; zz<Z1; zz+=5){ const qi=Math.round(wrap(zz,N)), m=mid(zz), hw=halfAt(zz), r=rng(qi*7+(pen?999:1)), dens=A.trees[qi]||0, cr=A.crowd[qi];
      for(const sd of [-1,1]){
        if(cr){ const z2=zz+5, x1=m+sd*(hw+1.3), x2=mid(z2)+sd*(halfAt(z2)+1.3), y1=elev(zz), y2=elev(z2); B.quad([x1,y1+.05,zz],[x2,y2+.05,z2],[x2,y2+1,z2],[x1,y1+1,zz],[.19,.33,.75],4); B.quad([x1-sd*.01,y1+.48,zz],[x2-sd*.01,y2+.48,z2],[x2-sd*.01,y2+.62,z2],[x1-sd*.01,y1+.62,zz],[.98,.8,.08],4); B.cone([x1,y1,zz],[x1,y1+1.1,zz],.03,.03,[.12,.16,.3],0,4); }
        const n=Math.round(dens*4+r()*1.2);
        for(let k=0;k<n;k++){ const dist=dens>.8?2.5+r()*6+k*5:9+r()*28+k*9; if(!pen && wrap(zz,LP)<100 && sd>0) continue; const tz=zz+r()*5, v=r()<(dens>.8?.1:.3)?2:(r()<.5?0:1), s=.8+r()*.7; tree(m+sd*(hw+dist),tz,v,s); }
        if(cr && !(sd<0 && !pen && wrap(zz,LP)<92)){ const nn=cr>1?4:2; for(let k=0;k<nn;k++){ const fx=m+sd*(hw+2.3+r()*3), v=Math.floor(r()*16), fz=zz+k*1.2; fan(fx,elev(fz),fz,v); r(); } }
      }
      if(dens>.2 && !pen) for(let k=0;k<2;k++){ if(r()<.35) continue; const sd=r()<.5?-1:1, dist=45+r()*90; tree(m+sd*(hw+dist),zz+r()*5,r()<.25?2:(r()<.5?0:1),.9+r()*.6); }   // glesare skog längre ut
    }
    if(!pen){ for(let b=-LP;b<=LP;b+=LP) for(const s of STATIC){ const z=b+s.q; if(z<Z0||z>Z1) continue; const m=mid(z), hw=halfAt(z), y=elev(z);
      if(s.t==='arch'){ const x1=m-hw-1, x2=m+hw+1; for(const x of [x1,x2]) B.box(x-.25,x+.25,y,y+5.2,z-.25,z+.25,[.04,.18,.48],0); B.box(x1-.25,x2+.25,y+4.1,y+5.2,z-.3,z+.3,[.04,.18,.48],0); B.box(x1+1,x2-1,y+4.45,y+4.85,z-.33,z+.33,[.98,.8,.08],0); }
      else if(s.t==='stand'){ const x0=m-hw-3; for(let row=0;row<7;row++){ const x=x0-row*1.6, hg=row*1.1; B.box(x-1.6,x,y+hg,y+hg+1.1,z,z+7,row%2?[.28,.33,.41]:[.32,.38,.48],0); for(let k=0;k<5;k++) fan(x-.5,y+hg+1.1,z+(k+.5)*7/5,row*5+k+Math.round(z),.85); } }
      else if(s.t==='screen'){ const x=m-hw-16; B.cone([x,y-.2,z],[x,y+6,z],.12,.12,[.2,.25,.33],0,5); B.box(x-4,x+4,y+6,y+11,z-.2,z+.2,[.07,.09,.15],0); B.wall([x-3.8,y+6.2,z-.22],[x+3.8,y+6.2,z-.22],[x+3.8,y+10.8,z-.22],[x-3.8,y+10.8,z-.22],[0,0,-1],[.14,.25,.62],3); }
      else if(s.t==='tower'){ const x=m-48; B.cone([x,y-1,z],[x,y+58,z],1.5,.5,[.88,.91,.95],0,8); for(let k=0;k<6;k++){ const t=.35+k*.11; B.cone([x,y+58*t-.3,z],[x,y+58*t+.3,z],1.5+(.5-1.5)*t+.06,1.5+(.5-1.5)*t+.05,[1.5,1.9,2.1],3,8); } B.sphere([x,y+58.6,z],.7,[1.8,2.2,2.4],3,8,5); }
      else if(s.t==='mat'){ const x0=m+hw+2; for(let L=0;L<12;L++){ const x=x0+L*2.6; B.box(x,x+1.6,y,y+.05,z,z+1.1,L%2?[.12,.16,.22]:[.15,.2,.29],0); } }
      else if(s.t==='targets'){ const x0=m+hw+2; for(let L=0;L<12;L++){ const x=x0+L*2.6+.8; B.box(x-.55,x+.55,y,y+1,z,z+.4,[.9,.91,.93],0); for(let k=0;k<5;k++) B.wall([x-.5+.14*1+k*.18-.05,y+.67,z-.01],[x-.5+.14+k*.18+.05,y+.67,z-.01],[x-.5+.14+k*.18+.05,y+.77,z-.01],[x-.5+.14+k*.18-.05,y+.77,z-.01],[0,0,-1],[.05,.05,.06],3);
          B.box(x-.25,x+.25,y+1.25,y+1.65,z,z+.05,[.97,.97,.97],0); } }
      else if(s.t==='flag'){ const x=m+s.sd*(hw+3.5); B.cone([x,y-.2,z],[x,y+5,z],.05,.04,[.8,.84,.88],0,4); B.quad([x,y+4,z],[x,y+4,z+1.6],[x,y+5,z+1.6],[x,y+5,z],[0,.42,.65],4); B.quad([x+.01,y+4,z+.48],[x+.01,y+4,z+.69],[x+.01,y+5,z+.69],[x+.01,y+5,z+.48],[1,.8,0],4); B.quad([x+.02,y+4.42,z],[x+.02,y+4.42,z+1.6],[x+.02,y+4.58,z+1.6],[x+.02,y+4.58,z],[1,.8,0],4); } } }
    else for(let zz=Math.ceil(Z0/30)*30; zz<Z1; zz+=30){ const x=mid(zz)+halfAt(zz)+6, y=elev(zz); B.box(x,x+22,y,y+3,zz-.15,zz+.15,[.89,.91,.94],0); B.box(x,x+22,y+2.25,y+3,zz-.17,zz+.17,[.12,.25,.69],0); }
    GLB.addMesh(B,true); GLB.addMesh(B2,false);
  }
  function glSki(dt,a,pen,z){
    T=pen?TP:TL; const N=T.N, base=Math.floor(z/N)*N;
    if(!GLB.use(pen?'pen':'lap')) glBuildB(pen);
    const DD=R.camO?DSO:DS.on?DS:null; let C;
    if(DD){ DCUR=DD; const fx=mid(z+3)-mid(z-3), Cc=DRONE.solve(DD,{x:mid(z),y:elev(z)+1,z},fx/6,1,dt,W,H,zz=>elev(zz)); C={x:Cc.x,y:Cc.y,z:Cc.z-base,yaw:Cc.yaw,pitch:Cc.pitch,f:Cc.f}; GCB.init=0; }
    else { // bakom åkaren, som i den enkla grafiken: åkaren nere i bild, spåret framåt
      const k=GCB.init?1:0, sway=Math.sin(a.t*2.6)*.35*(1-a.tuck), tx=mid(z)+sway, ez=z-BACK, f=Math.min(W,H)*1.05;
      GCB.x=k?GCB.x+(tx-GCB.x)*Math.min(1,dt*5):tx;
      const head=Math.atan((mid(z+8)-mid(z))/8); GCB.yaw=k?GCB.yaw+(head*.8-GCB.yaw)*Math.min(1,dt*3):head*.8;
      const ey=Math.max(elev(ez)+CAMH,elev(z)+1.6), ahead=Math.atan(-(elev(z+10)-elev(z))/10)*.85, want=ahead-Math.atan((ey-(elev(z)+.9))/BACK)*0;
      GCB.pitch=k?GCB.pitch+(want-GCB.pitch)*Math.min(1,dt*2.4):want; GCB.init=1;
      const cy=H*.8-f*((ey-elev(z))/BACK-Math.tan(GCB.pitch));   // samma bildutsnitt som den enkla grafiken: åkaren nere i bild
      C={x:GCB.x,y:ey,z:ez-base,yaw:GCB.yaw,pitch:GCB.pitch,f,cy}; }
    lastYH=(C.cy==null?H/2:C.cy)-C.f*Math.tan(C.pitch);
    const B=GLB.dyn().reset(), put=q=>[q[0],q[1],q[2]-base];
    const cap=(o,wx,wz)=>{ CAP=[]; let L; try{ skier3(o,wx,wz,o===a); } finally { L=CAP; CAP=null; }
      for(const q of L){ if(q[0]==='c') B.capsule(put(q[1]),put(q[2]),q[3],q[4],q[5],0,6); else if(q[0]==='s') B.sphere(put(q[1]),q[2],q[3],0,8,5); } };
    cap(a,mid(z),z);
    for(const o of R.A){ if(o===a||o.ph==='range'||o.done&&o.ph==='done') continue; const az=pen?(o.ph==='pen'?o.pz:null):(o.ph==='ski'?o.z:null); if(az==null||az<z-150||az>z+260) continue; cap(o,mid(az)+(o.k%3-1)*1.4,az); }
    R.parts=R.parts.filter(p=>(p.t-=dt)>0); for(const p of R.parts){ p.x+=p.vx*dt; p.z+=p.vz*dt; p.y+=p.vy*dt; p.vy-=9*dt; B.sphere([p.x,elev(p.z)+Math.max(.02,p.y),p.z-base],.035*(p.r||1),[1,1,1],2,4,3); }
    GLB.render({C,W,H,sun:SUNB,wx:R.wx,focus:[mid(z),elev(z),z-base+(DD?0:14)],shadowR:DD?80:55,time:now()});
    // text på startportalen och storbildsskärmen, ritad ovanpå 3D-bilden
    if(!pen) for(let bq=Math.floor(z/LP)*LP-LP; bq<=z+LP; bq+=LP) for(const o of STATIC){ const zz=bq+o.q; if(zz<z-30||zz>z+220) continue; const m=mid(zz), hw=halfAt(zz), y=elev(zz);
      if(o.t==='arch'){ const q=GLB.project(C,W,H,[m,y+4.65,zz-base-.31]); if(!q||q[2]<3) continue; const w=(2*hw+2.5)*q[2]; ctx.fillStyle='#facc15'; ctx.font=`900 ${Math.max(6,q[2]*.62)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; if(ctx.measureText('ÖSTERSUND · SKIDSKYTTE').width<w*.9) ctx.fillText('ÖSTERSUND · SKIDSKYTTE',q[0],q[1]); }
      else if(o.t==='screen'){ const q=GLB.project(C,W,H,[m-hw-16,y+8.5,zz-base-.23]); if(!q||q[2]*8<30) continue; const me=meA(); ctx.fillStyle='#fff'; ctx.font=`700 ${q[2]*1}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(`${Math.round(me.hr)} ♥  ${fmtT(me.t)}`,q[0],q[1]); } }
  }

  /* ---------- siktbilden ---------- */
  let WC=null, WCb=null, WCkey='', Zs=1;
  // målplanet i mm (x höger, y upp) runt mitten av tavlan, ritas en gång per storlek
  function buildWorld(){
    const S=Math.min(W,H); Zs=S*.115/115;
    const X0=-1500, X1=1500, Y0=-1000, Y1=1200, sc=Zs*Math.min(dpr,2), w=Math.ceil((X1-X0)*sc), h=Math.ceil((Y1-Y0)*sc);
    const [c,x]=off(w,h); x.scale(sc,sc); x.translate(-X0,Y1);    // nu: (mm x, -mm y)
    const r=rng(5);
    x.fillStyle='#eaf0f7'; x.fillRect(X0,-Y1,X1-X0,Y1-Y0);
    // skogen bakom vallen och himlen
    const sky=x.createLinearGradient(0,-Y1,0,-700); sky.addColorStop(0,'#c7d6ea'); sky.addColorStop(1,'#e8eef6'); x.fillStyle=sky; x.fillRect(X0,-Y1,X1-X0,Y1-700);
    for(let i=0;i<70;i++){ const tx=X0+r()*(X1-X0), th=300+r()*500, tw=th*.32; x.fillStyle=['#2b4a3c','#24433a','#30513f'][i%3]; x.beginPath(); x.moveTo(tx,-(700+th)); x.lineTo(tx-tw,-700); x.lineTo(tx+tw,-700); x.fill(); x.fillStyle='rgba(255,255,255,.55)'; x.fillRect(tx-tw*.5,-(700+th*.45),tw,8); }
    // skyddsvallen av snö
    const berm=x.createLinearGradient(0,-720,0,-150); berm.addColorStop(0,'#f6f9fd'); berm.addColorStop(1,'#dbe5f1'); x.fillStyle=berm; x.beginPath(); x.moveTo(X0,-150); x.lineTo(X0,-650); for(let xx=X0;xx<=X1;xx+=100) x.lineTo(xx,-700-Math.sin(xx*.004)*25); x.lineTo(X1,-150); x.fill();
    // marken framför: snö med lite skuggor
    const gr=x.createLinearGradient(0,150,0,1000); gr.addColorStop(0,'#e7eef7'); gr.addColorStop(1,'#f5f8fc'); x.fillStyle=gr; x.fillRect(X0,150,X1-X0,900);
    // grannbanornas ställ syns i kanterna
    for(const nx of [-1,1]){ x.fillStyle='#5b6472'; x.fillRect(nx*1300-450,-140,900,300); x.fillStyle='#f3f4f6'; x.fillRect(nx*1300-430,-110,860,220); x.fillStyle='#111'; for(let k=0;k<5;k++){ x.beginPath(); x.arc(nx*1300+(k-2)*SP,0,BLACK,0,7); x.fill(); } }
    // vårt tavelställ: metallram, vit tavla, fem svarta cirklar
    x.fillStyle='#4b5563'; x.fillRect(-2*SP-130,-150,4*SP+260,310); x.fillStyle='#374151'; x.fillRect(-2*SP-130,130,4*SP+260,30);
    x.fillStyle='#f8fafc'; x.fillRect(-2*SP-108,-118,4*SP+216,236);
    for(let k=0;k<5;k++){ x.fillStyle='#0b0b0c'; x.beginPath(); x.arc(TX(k),0,BLACK,0,7); x.fill(); x.strokeStyle='rgba(255,255,255,.08)'; x.lineWidth=2; x.beginPath(); x.arc(TX(k),0,22.5,0,7); x.stroke(); }
    // nummerskylt
    x.fillStyle='#fff'; x.fillRect(-90,-330,180,140); x.strokeStyle='#111'; x.lineWidth=6; x.strokeRect(-90,-330,180,140); x.fillStyle='#111'; x.font='900 110px system-ui'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(String(meA()?meA().lane:12),0,-258);
    x.fillStyle='#64748b'; x.fillRect(-8,-190,16,40);
    // vindflaggornas stänger (flaggorna ritas levande)
    x.fillStyle='#9ca3af'; for(const fx of [-560,560]) x.fillRect(fx-5,-560,10,560);
    WC=c;
    const [b,bx]=off(Math.ceil(w/6),Math.ceil(h/6)); bx.imageSmoothingEnabled=true; bx.drawImage(c,0,0,b.width,b.height); WCb=b;
    WC.X0=X0; WC.Y1=Y1; WC.k=Math.min(dpr,2);
  }
  function drawWorld(src,ox,oy,S2){ ctx.drawImage(src, ox+WC.X0*Zs, oy-WC.Y1*Zs, (WC.width/WC.k), (WC.height/WC.k)); }
  function drawScope(dt){
    const a=meA(), S=R.sc; const key=W+'x'+H+':'+a.lane; if(WCkey!==key){ buildWorld(); WCkey=key; }
    const Smin=Math.min(W,H), cx=W/2, cy=H*.44, Rr=Smin*.47, Ra=BLACK*Zs*1.62, Rt=Ra*2.05;
    const cur=S.cur||S.aim;
    // rifeln rör sig: hela siktbilden flyttas mot målet, siktet ligger still (lite parallax mellan diopter och korn när geväret lyfts)
    const ox=cx-cur.x*Zs, oy=cy+cur.y*Zs;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    const par= S.bolt>0 ? Math.sin(S.bolt/.5*Math.PI) : 0;
    const pcx=cx+par*Rr*.12, pcy=cy+par*Rr*.3;          // diopterns öga förskjuts när man repeterar
    ctx.save(); ctx.beginPath(); ctx.arc(pcx,pcy,Rr,0,Math.PI*2); ctx.clip();
    ctx.imageSmoothingEnabled=true; drawWorld(WCb,ox,oy); drawTargetsLive(S,ox,oy,true); drawFlags(S,ox,oy,true);
    ctx.restore();
    // kornets tunnel: mörk, lite oskarp kant
    ctx.save(); ring(cx,cy,Rt,Ra); ctx.fillStyle='#0d0f12'; ctx.fill('evenodd');
    const tg=ctx.createRadialGradient(cx,cy,Rt*.9,cx,cy,Rt*1.12); tg.addColorStop(0,'rgba(13,15,18,1)'); tg.addColorStop(1,'rgba(13,15,18,0)'); ctx.fillStyle=tg; ring(cx,cy,Rt*1.12,Rt*.9); ctx.fill('evenodd');
    ctx.restore();
    // genom ringkornet: skarpt
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,Ra,0,Math.PI*2); ctx.clip();
    drawWorld(WC,ox,oy); ctx.globalAlpha=.28; drawWorld(WCb,ox,oy); ctx.globalAlpha=1;   // ögat fokuserar på kornet: tavlan blir en aning mjuk
    drawTargetsLive(S,ox,oy,false); drawFlags(S,ox,oy,false); drawPuffs(S,ox,oy);
    ctx.restore();
    // ringkornets kant: tunn svart ring med ljusreflex
    ctx.strokeStyle='#050506'; ctx.lineWidth=Math.max(1.5,Ra*.07); ctx.beginPath(); ctx.arc(cx,cy,Ra,0,7); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.14)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(cx,cy,Ra*1.06,-2.4,-1.2); ctx.stroke();
    // diopterns hål: mjuk mörk kant, allt utanför svart
    const vg=ctx.createRadialGradient(pcx,pcy,Rr*.78,pcx,pcy,Rr*1.01); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(.7,'rgba(0,0,0,.55)'); vg.addColorStop(1,'rgba(0,0,0,1)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.rect(0,0,W,H); ctx.moveTo(pcx+Rr*1.005,pcy); ctx.arc(pcx,pcy,Rr*1.005,0,Math.PI*2,true); ctx.closePath(); ctx.fill('evenodd');
    // svag kromatisk kant
    ctx.strokeStyle='rgba(120,160,255,.07)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(pcx,pcy,Rr*.86,0,7); ctx.stroke();
    // rekylen: kort skakning och ljus blixt i ögat
    if(S.rec>0){ ctx.fillStyle=`rgba(255,250,235,${S.rec*.35})`; ctx.fillRect(0,0,W,H); }
    scopeHud(S,a,cx,cy,Rr);
  }
  function ring(x,y,r1,r2){ ctx.beginPath(); ctx.moveTo(x+r1,y); ctx.arc(x,y,r1,0,Math.PI*2); ctx.closePath(); ctx.moveTo(x+r2,y); ctx.arc(x,y,r2,0,Math.PI*2,true); ctx.closePath(); }
  function drawTargetsLive(S,ox,oy,soft){
    const t=now();
    for(let k=0;k<5;k++){ if(!S.hits[k]) continue; const e=clamp((t-S.fl[k])/.14,0,1), r=BLACK*Zs*(soft?1.08:1), x=ox+TX(k)*Zs, y=oy;
      ctx.save(); ctx.beginPath(); ctx.arc(x,y,BLACK*Zs+(soft?2:0),0,7); ctx.clip();
      ctx.fillStyle=soft?'rgba(245,248,252,.9)':'#f8fafc'; ctx.beginPath(); ctx.arc(x,y+(1-e)*r*2,r,0,7); ctx.fill(); ctx.restore(); }
  }
  function drawFlags(S,ox,oy,soft){
    const w=wind(S), t=now(), dir=Math.sign(w)||1, th=clamp(Math.abs(w)/4,0,1)*1.35;
    for(const fx of [-560,560]){ const x=ox+fx*Zs, y=oy-560*Zs, L=150*Zs, wid=L*.45, fl=Math.sin(t*(3+Math.abs(w)*2)+fx)*L*.07;
      const ux=dir*Math.sin(th), uy=Math.cos(th), A=[x,y], B=[x,y+wid], C=[x+ux*L,y+wid+uy*L], D=[x+ux*L,y+uy*L];
      ctx.fillStyle=soft?'rgba(239,68,68,.75)':'#ef4444'; ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.quadraticCurveTo((A[0]+D[0])/2+fl,(A[1]+D[1])/2-fl*.5,D[0],D[1]); ctx.lineTo(C[0],C[1]); ctx.quadraticCurveTo((B[0]+C[0])/2+fl,(B[1]+C[1])/2-fl*.5,B[0],B[1]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=soft?'rgba(250,204,21,.7)':'#facc15'; ctx.lineWidth=Math.max(1,wid*.25); ctx.beginPath(); ctx.moveTo((A[0]+B[0])/2,(A[1]+B[1])/2); ctx.lineTo((C[0]+D[0])/2,(C[1]+D[1])/2); ctx.stroke(); }
  }
  function drawPuffs(S,ox,oy){ const t=now(); S.puffs=S.puffs.filter(p=>t-p.t<.6); for(const p of S.puffs){ const e=(t-p.t)/.6; ctx.fillStyle=`rgba(255,255,255,${.8*(1-e)})`; for(let i=0;i<6;i++){ const ang=i*1.05, rr=(8+e*40)*Zs; ctx.beginPath(); ctx.arc(ox+(p.x+Math.cos(ang)*rr/Zs*.6)*Zs,oy-(p.y+Math.sin(ang)*rr/Zs*.4+e*30)*Zs,rr*.5,0,7); ctx.fill(); } } }
  function scopeHud(S,a,cx,cy,Rr){
    // överst: bana, ställning, tid
    ctx.fillStyle='rgba(15,23,42,.6)'; ctx.beginPath(); ctx.roundRect(10,10,W-20,46,12); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='800 15px system-ui'; ctx.textAlign='left'; ctx.textBaseline='middle';
    const lbl=G.fmt==='tr'?`Serie ${R.trI+1}/${TR_N}`:`Skytte ${a.st+1}`; ctx.fillText(`Bana ${a.lane} · ${S.pos==='L'?'Liggande':'Stående'} · ${lbl}`,20,26);
    ctx.font='600 12px system-ui'; ctx.fillStyle='#cbd5e1'; ctx.fillText(G.fmt==='tr'?`Tid på vallen ${fmtT(a.t-S.tStart)}`:`Total ${fmtT(a.t)} · på vallen ${fmtT(a.t-S.tStart)}`,20,44);
    // träffbild som på TV: fem cirklar
    for(let k=0;k<5;k++){ const x=W-28-(4-k)*20, y=33; ctx.fillStyle=S.hits[k]?'#f8fafc':'#111'; ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,7.5,0,7); ctx.fill(); ctx.stroke(); }
    // puls: hjärta som slår i takt
    const hb=Math.pow(1-(S.beat%1),6), hx=24, hy=H-158;
    ctx.save(); ctx.translate(hx,hy); ctx.scale(1+hb*.18,1+hb*.18); ctx.fillStyle='#ef4444'; ctx.font='26px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('❤',0,0); ctx.restore();
    ctx.fillStyle='#fff'; ctx.font='800 22px ui-monospace,monospace'; ctx.textAlign='left'; ctx.fillText(String(Math.round(a.hr)),42,hy+1); ctx.font='600 11px system-ui'; ctx.fillStyle='#cbd5e1'; ctx.fillText('slag/min',43,hy+19);
    // andning: lungmätare
    const lw=90, lx=W-lw-14, ly=H-170; ctx.fillStyle='rgba(15,23,42,.6)'; ctx.beginPath(); ctx.roundRect(lx-6,ly-8,lw+12,32,9); ctx.fill();
    ctx.fillStyle='#cbd5e1'; ctx.font='600 11px system-ui'; ctx.textAlign='left'; ctx.fillText(R.holding?(S.hold<5.5?'Håller andan':'Andas!'):'Andas',lx,ly+2);
    const f= R.holding? clamp(1-S.hold/8,0,1) : 1; ctx.fillStyle='rgba(255,255,255,.15)'; ctx.fillRect(lx,ly+10,lw,6); ctx.fillStyle= f>.32?'#38bdf8':'#ef4444'; ctx.fillRect(lx,ly+10,lw*f,6);
    // patroner kvar
    for(let i=0;i<5;i++){ const x=cx-40+i*20, y=cy+Rr+14; if(y>H-120) break; ctx.fillStyle=i<S.left?'#d4a017':'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.roundRect(x-3.5,y,7,16,2); ctx.fill(); }
    // vind och knäppar
    const w=wind(S); ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='700 12px system-ui'; ctx.textAlign='center';
    if(G.wind) ctx.fillText(`Vind ${w<-.15?'←':w>.15?'→':'·'} ${Math.abs(w).toFixed(1).replace('.',',')} m/s   ·   Sikte ${S.clicks===0?'0':Math.abs(S.clicks)+' klick '+(S.clicks<0?'V':'H')}`,cx,H-122);
    if(a.t<S.readyAt){ ctx.fillStyle='#fde047'; ctx.font='800 18px system-ui'; ctx.fillText(S.pos==='L'?'Lägger sig och tar fram geväret…':'Ställer sig och tar fram geväret…',cx,cy-Rr-8>70?cy-Rr-8:80); }
    else if(S.left===5 && a.t-S.readyAt<3.5){ ctx.fillStyle='#fde047'; ctx.font='700 13px system-ui'; ctx.fillText('Dra = sikta · håll kvar = håll andan',cx,cy-Rr-8>70?cy-Rr-8:80); }
  }

  /* ---------- TV-bilder: kameraåkningar över skytten ---------- */
  const C3={x:0,y:1,z:-3,yaw:0,pitch:0,f:500};
  function look(p,l){ C3.x=p[0]; C3.y=p[1]; C3.z=p[2]; const dx=l[0]-p[0], dy=l[1]-p[1], dz=l[2]-p[2]; C3.yaw=Math.atan2(dx,dz); C3.pitch=Math.atan2(-dy,Math.hypot(dx,dz)); }
  function p3(x,y,z){ const dx=x-C3.x, dy=y-C3.y, dz=z-C3.z, cyw=Math.cos(C3.yaw), syw=Math.sin(C3.yaw);
    const X=dx*cyw-dz*syw, Z0=dx*syw+dz*cyw, cp=Math.cos(C3.pitch), sp=Math.sin(C3.pitch); const Y=dy*cp+Z0*sp, Z=-dy*sp+Z0*cp;
    if(Z<.05) return null; return [W/2+X*C3.f/Z, H/2-Y*C3.f/Z, C3.f/Z, Z]; }
  const FILTER_OK = (()=>{ try{ const c=document.createElement('canvas').getContext('2d'); return 'filter' in c; }catch(e){ return false; } })();
  let focusD=2;
  function blurFor(Z){ if(!FILTER_OK) return 'none'; const b=Math.abs(1/Z-1/focusD)*C3.f*.012; return b<.4?'none':`blur(${Math.min(6,b).toFixed(1)}px)`; }
  // primitiver
  function cap(a,b,r,col,list){ list.push({Z:(a[2]+b[2])/2+((a[0]+b[0])*0), d:()=>{ const p=p3(...a), q=p3(...b); if(!p||!q) return; ctx.strokeStyle=col; ctx.lineCap='round'; ctx.lineWidth=Math.max(1,2*r*(p[2]+q[2])/2); ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.14)'; ctx.lineWidth=Math.max(.5,r*(p[2]+q[2])/2*.5); ctx.beginPath(); ctx.moveTo(p[0]-r*p[2]*.3,p[1]-r*p[2]*.4); ctx.lineTo(q[0]-r*q[2]*.3,q[1]-r*q[2]*.4); ctx.stroke(); }, at:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]}); }
  function ball(c,r,col,list,ex){ list.push({at:c, d:()=>{ const p=p3(...c); if(!p) return; ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(p[0],p[1],r*p[2],r*p[2]*(ex||1),0,0,7); ctx.fill(); }}); }
  function poly(pts,col,list){ list.push({at:pts.reduce((s,p)=>[s[0]+p[0]/pts.length,s[1]+p[1]/pts.length,s[2]+p[2]/pts.length],[0,0,0]), d:()=>{ const q=pts.map(p=>p3(...p)); if(q.some(v=>!v)) return; ctx.fillStyle=col; ctx.beginPath(); q.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1])); ctx.closePath(); ctx.fill(); }}); }
  function box(x0,x1,y0,y1,z0,z1,cTop,cSide,cFront,list){ poly([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],cTop,list); poly([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],cFront,list); poly([[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],cSide,list); poly([[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]],cSide,list); }
  // en skytt i 3D (liggande eller stående), x=bana, framåt = +z mot tavlorna
  function athlete(L,pos,x0,S,list,breath){
    const b=breath||0, s=SUIT[S]||SUIT[0], skin='#f1c7a5';
    if(pos==='L'){
      const y=.11+b*.01, X=v=>[x0+v[0],v[1],v[2]];
      // skidorna ligger kvar på fötterna, bakåt
      for(const sx of [-.2,.12]){ poly([X([sx-.04,.02,-.9]),X([sx+.04,.02,-.9]),X([sx+.06,.02,-2.55]),X([sx-.02,.02,-2.55])],'#e2e8f0',list); }
      cap(X([-.18,y,-.05]),X([-.24,.1,-.55]),.075,s.b,list); cap(X([-.24,.1,-.55]),X([-.2,.07,-1.0]),.06,s.b,list);
      cap(X([.1,y,-.05]),X([.14,.1,-.56]),.075,s.b,list); cap(X([.14,.1,-.56]),X([.12,.07,-1.0]),.06,s.b,list);
      cap(X([-.2,.07,-1.0]),X([-.2,.09,-.86]),.055,'#111827',list); cap(X([.12,.07,-1.0]),X([.12,.09,-.86]),.055,'#111827',list);
      cap(X([-.04,y+.02,0]),X([.04,.2+b*.02,.5]),.17,s.m,list);       // rygg
      cap(X([-.12,.19,.42]),X([.2,.19,.46]),.08,s.b,list);           // axlar
      // vänster arm under geväret, armbågen i snön; höger hand på greppet
      cap(X([-.12,.19,.44]),X([-.08,.05,.74]),.055,s.b,list); cap(X([-.08,.05,.74]),X([.03,.24,.98]),.05,s.m,list);
      cap(X([.2,.19,.46]),X([.3,.06,.56]),.055,s.b,list); cap(X([.3,.06,.56]),X([.12,.24,.66]),.05,s.m,list);
      ball(X([.03,.24,.98]),.045,'#0f172a',list); ball(X([.12,.24,.66]),.045,'#0f172a',list);
      // geväret: kolv mot axeln, pipa mot tavlan, diopter och korntunnel
      cap(X([.15,.24,.44]),X([.08,.27,.86]),.045,'#4a2c1a',list); cap(X([.08,.27,.86]),X([.02,.3,1.5]),.014,'#1f2937',list);
      cap(X([.09,.33,.62]),X([.09,.34,.66]),.02,'#374151',list); cap(X([.02,.33,1.44]),X([.02,.33,1.5]),.022,'#111827',list);
      cap(X([.07,.21,.7]),X([.07,.15,.73]),.025,'#111827',list);     // magasin
      cap(X([-.1,.15,.5]),X([.04,.26,.92]),.012,'#0f172a',list);     // remmen
      // huvud mot kindstödet, mössa
      ball(X([.07,.33,.6]),.105,skin,list); ball(X([.06,.37,.58]),.11,s.b,list,.75);
      // stavarna på marken
      cap(X([-.55,.02,-.6]),X([-.5,.02,.9]),.01,'#94a3b8',list); cap(X([-.62,.02,-.6]),X([-.58,.02,.9]),.01,'#94a3b8',list);
    } else {
      const X=v=>[x0+v[0],v[1],v[2]], sw=b*.01;
      for(const sx of [-.2,.2]) poly([X([sx-.04,.02,-.8]),X([sx+.04,.02,-.8]),X([sx+.04,.02,1.0]),X([sx-.04,.02,1.0])],'#e2e8f0',list);
      cap(X([-.2,.06,.05]),X([-.16,.5,.04]),.07,s.b,list); cap(X([-.16,.5,.04]),X([-.12,.92,0]),.085,s.b,list);
      cap(X([.2,.06,-.05]),X([.17,.5,-.04]),.07,s.b,list); cap(X([.17,.5,-.04]),X([.12,.92,0]),.085,s.b,list);
      cap(X([.0,.95,0]),X([-.04+sw,1.42,-.06]),.17,s.m,list);
      cap(X([-.2,1.42,-.02]),X([.18,1.44,-.1]),.08,s.b,list);
      // vänster armbåge mot höften, handen under förstocken
      cap(X([-.2,1.42,-.02]),X([-.2,1.06,.1]),.055,s.b,list); cap(X([-.2,1.06,.1]),X([-.05,1.38,.42]),.05,s.m,list);
      cap(X([.18,1.44,-.1]),X([.26,1.32,.1]),.055,s.b,list); cap(X([.26,1.32,.1]),X([.1,1.42,.15]),.05,s.m,list);
      ball(X([-.05,1.38,.42]),.045,'#0f172a',list); ball(X([.1,1.42,.15]),.045,'#0f172a',list);
      cap(X([.12,1.42,-.06]),X([.02,1.47,.45]),.045,'#4a2c1a',list); cap(X([.02,1.47,.45]),X([-.04,1.5,1.05]),.014,'#1f2937',list);
      cap(X([.05,1.53,.12]),X([.05,1.54,.16]),.02,'#374151',list); cap(X([-.04,1.53,1.0]),X([-.04,1.53,1.05]),.022,'#111827',list);
      ball(X([.03,1.56,.04]),.105,skin,list); ball(X([.02,1.6,.02]),.11,s.b,list,.75);
      cap(X([-.6,0,.4]),X([-.62,1.4,.42]),.01,'#94a3b8',list); cap(X([-.67,0,.38]),X([-.69,1.4,.4]),.01,'#94a3b8',list);   // stavarna i stavstället
    }
  }
  function rangeScene(list,me,S){
    // mattor, banor, tavlor på 50 m, vallen, publik och läktare bakom skyttarna
    for(let L=-7;L<=7;L++){ const x=L*2.6; poly([[x-.85,.005,-1.4],[x+.85,.005,-1.4],[x+.85,.005,1.4],[x-.85,.005,1.4]],L===0?'#1f2a3d':'#263247',list);
      const nb=[[x-1.1,.02,1.45],[x-.75,.02,1.45],[x-.75,.4,1.45],[x-1.1,.4,1.45]]; poly(nb,'#f8fafc',list);
      list.push({at:[x-.92,.21,1.44], d:()=>{ const p=p3(x-.92,.21,1.44); if(!p||p[2]<25) return; ctx.fillStyle='#111'; ctx.font=`900 ${p[2]*.26}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(me.lane+L*2),p[0],p[1]); }});
      // tavlan
      box(x-.55,x+.55,.25,.85,50,50.25,'#9ca3af','#6b7280','#4b5563',list);
      list.push({at:[x,.55,49.98], d:()=>{ const c=p3(x,.55,49.98); if(!c) return; const s=c[2]; ctx.fillStyle='#f8fafc'; ctx.fillRect(c[0]-.48*s,c[1]-.12*s,.96*s,.24*s);
        for(let k=0;k<5;k++){ const hit = L===0 ? S&&S.hits[k] : ((L*7+k*3)%5<3 && (S&&S.left<5)); ctx.fillStyle=hit?'#f1f5f9':'#0b0b0c'; ctx.beginPath(); ctx.arc(c[0]+(k-2)*.17*s,c[1],Math.max(.6,.0575*s),0,7); ctx.fill(); if(hit){ ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=.6; ctx.stroke(); } } }});
      // andra skyttar
      if(L!==0 && Math.abs(L)<=6 && (L*5+3)%4!==0) athlete(L,(L%3===0?'S':(S&&S.pos)||'L'),x,(Math.abs(L)+1)%4,list,0);
    }
    box(-22,22,0,3.2,52,58,'#f1f5f9','#dfe7f1','#e8eef6',list);             // snövallen bakom tavlorna
    for(let i=0;i<26;i++){ const x=-30+i*2.4, z=60+(i*7)%9, h=6+(i*13)%6; poly([[x,0,z],[x+1.4,h,z],[x+2.8,0,z]],i%2?'#24433a':'#2b4a3c',list); }
    // läktaren och Arctura bakom skyttarna
    for(let r=0;r<8;r++) box(-26,26,r*.9,r*.9+.9,-16-r*1.4,-14.6-r*1.4,'#64748b','#475569',r%2?'#52617a':'#5b6b85',list);
    for(let r=0;r<8;r++) for(let i=0;i<28;i++){ const x=-25+i*1.85+(r%2)*.9, y=r*.9+.9, z=-15.2-r*1.4; list.push({at:[x,y+.4,z], d:()=>{ const p=p3(x,y,z); if(!p||p[2]<2) return; const img=SPR.fan[(i*3+r*5)%16], h=p[2]*.95, w=h*img.width/img.height; const j=Math.max(0,Math.sin(now()*5+i+r))*h*.08; ctx.drawImage(img,p[0]-w/2,p[1]-h-j,w,h); }}); }
    list.push({at:[-40,30,-40], d:()=>{ const b=p3(-40,0,-40), t=p3(-40,58,-40); if(!b||!t) return; const w=Math.max(2,b[2]*1.3); ctx.fillStyle='#e2e8f0'; ctx.beginPath(); ctx.moveTo(b[0]-w,b[1]); ctx.lineTo(t[0]-w*.35,t[1]); ctx.lineTo(t[0]+w*.35,t[1]); ctx.lineTo(b[0]+w,b[1]); ctx.fill(); ctx.fillStyle='rgba(125,211,252,.9)'; for(let k=0;k<6;k++){ const yy=lerp(b[1],t[1],.35+k*.11); ctx.fillRect(lerp(b[0],t[0],.35+k*.11)-w*.45,yy,w*.9,Math.max(1,w*.25)); } }});
  }
  const SHOTS={
    // drönaren glider in över vallen mot vår bana
    drone:t=>{ const e=smooth(t); return {p:[lerp(-26,-6,e),lerp(24,9,e),lerp(-30,-9,e)], l:[lerp(0,0,e),0,lerp(14,6,e)], f:6+e*4, lbl:true}; },
    // låg sidled längs den liggande skytten, skärpa på geväret, tavlorna mjuka
    prone:t=>{ const e=smooth(t); return {p:[lerp(-2.3,-1.7,e),lerp(.55,.5,e),lerp(-1.9,1.7,e)], l:[0,lerp(.15,.28,e),lerp(-.4,.9,e)], f:lerp(2.4,1.9,e)}; },
    // runt den stående skytten, framifrån-snett
    stand:t=>{ const e=smooth(t), ang=lerp(-2.4,-1.5,e); return {p:[Math.sin(ang)*3.2,1.0+e*.3,.3-Math.cos(ang)*3.2], l:[0,1.2,.3], f:3.2}; },
    // över axeln mot tavlorna, skärpan dras från geväret till tavlorna
    over:t=>{ const e=smooth(t), pos=R&&R.sc?R.sc.pos:'L', hy=pos==='L'?.45:1.75; return {p:[lerp(.45,.3,e),hy+.42,lerp(-3.6,-3.0,e)], l:[lerp(.05,-.05,e),hy+.1,50], z:3.2, f:lerp(4,50,clamp(e*1.5-.15,0,1))}; }
  };
  let LAY=null;
  let cineSlow=0, cineLast=0, NOBLUR=false;
  function bucket(Z){ if(!FILTER_OK||NOBLUR) return 0; const b=Math.abs(1/Z-1/focusD)*C3.f*.012; return b<.6?0:b<1.6?1.2:b<3?2.4:4; }
  function drawLayers(list){
    const tn=performance.now(); if(cineLast&&tn-cineLast<200){ cineSlow = tn-cineLast>45 ? cineSlow+1 : Math.max(0,cineSlow-1); if(cineSlow>8) NOBLUR=true; } cineLast=tn;
    if(!FILTER_OK||NOBLUR){ for(const o of list) if(o.Z>0) o.d(); return; }
    const lw=Math.ceil(cv.width/2), lh=Math.ceil(cv.height/2);     // lagren i halv upplösning: suddigt ändå, och mycket snabbare
    if(!LAY||LAY.width!==lw||LAY.height!==lh){ LAY=document.createElement('canvas'); LAY.width=lw; LAY.height=lh; LAY.x=LAY.getContext('2d'); }
    const main=ctx; let cur=null, seg=[];
    const flush=()=>{ if(!seg.length) return; if(!cur){ for(const o of seg) o.d(); seg=[]; return; }
      ctx=LAY.x; ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,LAY.width,LAY.height); ctx.setTransform(dpr/2,0,0,dpr/2,0,0); for(const o of seg) o.d(); ctx=main;
      ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.filter=`blur(${(cur*dpr/2).toFixed(1)}px)`; ctx.drawImage(LAY,0,0,cv.width,cv.height); ctx.restore(); seg=[]; };
    for(const o of list){ if(o.Z<=0) continue; const b=bucket(o.Z); if(b!==cur){ flush(); cur=b; } seg.push(o); }
    flush(); ctx=main;
  }
  function drawCine(){
    const c=R.cine, t=now()-c.t0; let acc=0, i=0; for(;i<c.shots.length;i++){ if(t<acc+c.dur[i]) break; acc+=c.dur[i]; }
    if(i>=c.shots.length){ R.cine=null; return false; }
    const k=c.shots[i], u=(t-acc)/c.dur[i], sh=SHOTS[k](u), a=meA(), S=R.sc||{pos:c.pos||'L',hits:[0,0,0,0,0],left:5};
    look(sh.p,sh.l); C3.f=Math.min(W,H)*1.1*(sh.z||1); focusD=sh.f;
    // himmel och panorama med Storsjön
    const key=W+'x'+H+':'+R.wx.kind+R.wx.seed; if(BDkey!==key){ BD=makeBackdrop(W,H); WEATHER.tintBackdrop(BD.c,BD.hz*BD.K,R.wx); BDkey=key; }
    const yH=H/2-C3.f*Math.tan(C3.pitch), top=yH-BD.hz; lastYH=yH; ctx.fillStyle=WEATHER.sky(R.wx)||'#4f7fc4'; ctx.fillRect(0,0,W,H);
    const bw=BD.w; let x0=-((C3.yaw*C3.f*.9%bw)+bw)%bw-bw*.3; for(let n=0;n<3;n++,x0+=bw){ ctx.save(); if(FILTER_OK&&!NOBLUR) ctx.filter='blur(1.5px)'; if(n%2){ ctx.translate(x0+bw,top); ctx.scale(-1,1); ctx.drawImage(BD.c,0,0,BD.w,BD.h); } else ctx.drawImage(BD.c,x0,top,BD.w,BD.h); ctx.restore(); }
    const g=ctx.createLinearGradient(0,yH,0,H); g.addColorStop(0,'#e6edf6'); g.addColorStop(1,'#fbfdff'); ctx.fillStyle=g; ctx.fillRect(0,Math.max(0,yH+BD.vb-2),W,H);
    // marken: spår i snön och skuggor
    const list=[]; rangeScene(list,a,S); athlete(0,S.pos,0,a.k%4,list,Math.sin(now()*1.6));
    list.forEach(o=>{ const p=p3(...o.at); o.Z=p?p[3]:-1; });
    list.sort((p,q)=>q.Z-p.Z);
    drawLayers(list);
    // filmkänsla: svag vinjett, ljusinfall från solen, snöflingor, TV-grafik
    const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.75); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.35)'); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    const sg=ctx.createRadialGradient(W*.1,H*.15,4,W*.1,H*.15,W*.8); sg.addColorStop(0,'rgba(255,220,180,.22)'); sg.addColorStop(1,'rgba(255,220,180,0)'); ctx.fillStyle=sg; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,.7)'; for(let n=0;n<40;n++){ const sx=(n*97.13+now()*(18+n%5*6))%W, sy=(n*53.7+now()*(30+n%7*9))%H; ctx.fillRect(sx,sy,1.6,1.6); }
    const bar=H*.07; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,bar); ctx.fillRect(0,H-bar,W,bar);
    if(c.role!=='hl'){ ctx.fillStyle='rgba(11,46,122,.88)'; ctx.fillRect(14,H-bar-48,Math.min(W-28,290),36); ctx.fillStyle='#facc15'; ctx.fillRect(14,H-bar-48,6,36);
    ctx.fillStyle='#fff'; ctx.font='800 14px system-ui'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(`${bare(pname(a.k))} · bana ${a.lane}`,28,H-bar-36);
    ctx.font='600 11px system-ui'; ctx.fillStyle='#cbd5e1'; ctx.fillText(`${S.pos==='L'?'Liggande':'Stående'} · Östersunds skidstadion${c.role==='leave'?` · ${S.hits.filter(Boolean).length}/5 träff`:''}`,28,H-bar-21); }
    ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.roundRect(W-62,bar+10,48,20,5); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='800 11px system-ui'; ctx.textAlign='center'; ctx.fillText('● LIVE',W-38,bar+20);
    if(c.role!=='hl'){ ctx.fillStyle='rgba(255,255,255,.6)'; ctx.font='600 11px system-ui'; ctx.fillText('Tryck för att hoppa över',W/2,H-bar/2); }
    return true;
  }

  /* ---------- HUD under åkningen ---------- */
  function skiHud(){
    const a=meA(), g=G, laps=FMT[g.fmt].laps;
    ctx.fillStyle='rgba(15,23,42,.58)'; ctx.beginPath(); ctx.roundRect(10,10,168,62,14); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='800 26px ui-monospace,monospace'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(fmtT(R.started?a.t:0),20,15);
    ctx.font='600 12px system-ui'; ctx.fillStyle='#cbd5e1';
    const lapTxt = a.ph==='pen' ? `Straffrunda ${Math.min(Math.floor(a.pz/PEN)+1,Math.round(a.pen/PEN))}/${Math.round(a.pen/PEN)}` : a.ph==='done' ? 'I mål' : `Varv ${Math.min(a.lap+1,laps)}/${laps}`;
    ctx.fillText(`${lapTxt} · ${Math.round(a.v*3.6)} km/h`,20,48);
    // skyttet hittills
    a.sh.forEach((m,i)=>{ const x=10+i*84; ctx.fillStyle='rgba(15,23,42,.58)'; ctx.beginPath(); ctx.roundRect(x,78,78,22,8); ctx.fill(); ctx.fillStyle=m?'#fca5a5':'#86efac'; ctx.font='800 12px system-ui'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(`${FMT[g.fmt].st[i]==='L'?'Ligg':'Stå'}: ${m?m+' bom':'fullt'}`,x+8,89); });
    // puls
    ctx.fillStyle='rgba(15,23,42,.58)'; ctx.beginPath(); ctx.roundRect(8,H-196,96,a.hr>186?52:40,12); ctx.fill();
    const beat=Math.pow(1-((a.t*a.hr/60)%1),5); ctx.save(); ctx.translate(26,H-176); ctx.scale(1+beat*.15,1+beat*.15); ctx.font='24px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#ef4444'; ctx.fillText('❤',0,0); ctx.restore();
    ctx.fillStyle=a.hr>186?'#fca5a5':'#fff'; ctx.font='800 22px ui-monospace,monospace'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(String(Math.round(a.hr)),44,H-175);
    if(a.hr>186){ ctx.font='700 11px system-ui'; ctx.fillStyle='#fca5a5'; ctx.fillText('Mjölksyra!',44,H-156); }
    // placering
    if(R.A.length>1){ const prog=x=> x.done? 1e9-(x.finish||0) : (x.lap*LP*0)+x.z - (x.ph==='pen'?(x.pen-x.pz):0) - (x.ph==='range'?40:0);
      const order=R.A.slice().sort((p,q)=>prog(q)-prog(p)); ctx.fillStyle='rgba(15,23,42,.58)'; ctx.beginPath(); ctx.roundRect(W-150,10,140,14+order.length*17,12); ctx.fill();
      order.forEach((x,i)=>{ ctx.fillStyle=x===a?'#fde047':'#e2e8f0'; ctx.font='700 12px system-ui'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(`${i+1}. ${bare(pname(x.k)).slice(0,10)}`,W-142,17+i*17);
        ctx.textAlign='right'; const d=x.done?fmtT(x.finish):x===a?'':a.done?'på väg':(x.ph==='range'?'🎯':x.ph==='pen'?'↻':`${Math.round(prog(x)-prog(a))>0?'+':''}${Math.round(prog(x)-prog(a))} m`); ctx.fillText(d,W-16,17+i*17); }); }
    // takten: två fotsulor, nästa sida lyser – lagom takt fyller ringen
    if(R.started && a.ph!=='done'){ const ideal=idealGap(gradeAt(a.ph==='pen'?a.pz:a.z,a.ph==='pen'?TP:TL),a.v), since=a.t-(a.lastPush??-9), f=clamp(since/ideal,0,1.4), next=a.lastSide==='L'?'R':'L';
      const fy=H-124; [['L',W*.25],['R',W*.75]].forEach(([s,x])=>{ const on=s===next; ctx.globalAlpha=on?.95:.35; ctx.fillStyle='rgba(15,23,42,.5)'; ctx.beginPath(); ctx.arc(x,fy,26,0,7); ctx.fill();
        if(on){ ctx.strokeStyle=f>=.8&&f<=1.3?'#22c55e':f<.8?'#fde047':'#94a3b8'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(x,fy,24,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,f)); ctx.stroke(); }
        ctx.fillStyle='#fff'; ctx.font='800 16px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(s==='L'?'V':'H',x,fy); }); ctx.globalAlpha=1; }
    // höjdprofil med position
    profile(a);
    if(R.banner&&R.banner.t>0){ ctx.globalAlpha=Math.min(1,R.banner.t*2); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 26px system-ui'; ctx.fillStyle='#fde047'; ctx.fillText(R.banner.txt,W/2,96); ctx.globalAlpha=1; }
    if(!R.started){ const n=Math.ceil(R.cd); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 86px system-ui'; ctx.fillStyle='#fff'; ctx.save(); ctx.shadowColor='#2563eb'; ctx.shadowBlur=24; ctx.fillText(n>3?'':String(n),W/2,H*.4); ctx.restore();
      ctx.font='700 14px system-ui'; ctx.fillStyle='#fff'; ctx.fillText('Tryck växelvis vänster–höger i takt för att skejta',W/2,H*.4+64); ctx.font='800 16px system-ui'; ctx.fillText(`${R.wx.icon} ${R.wx.name}`,W/2,H*.4+90); }
    else if(a.t<.9){ ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 64px system-ui'; ctx.fillStyle='#22c55e'; ctx.fillText('KÖR!',W/2,H*.4); }
  }
  let PROF=null, PROFkey='';
  function profile(a){
    const pw=Math.min(W-24,360), ph=30, key=pw; if(PROFkey!==key){ PROFkey=key; const [c,x]=off(pw*2,ph*2); x.scale(2,2); x.fillStyle='rgba(15,23,42,.55)'; x.beginPath(); x.roundRect(0,0,pw,ph,8); x.fill();
      let lo=1e9,hi=-1e9; for(let i=0;i<=LP;i++){ lo=Math.min(lo,TL.y[i]); hi=Math.max(hi,TL.y[i]); } const px=i=>6+i/LP*(pw-12), py=y=>ph-5-(y-lo)/(hi-lo||1)*(ph-10);
      x.beginPath(); x.moveTo(px(0),ph-3); for(let i=0;i<=LP;i+=3) x.lineTo(px(i),py(TL.y[i])); x.lineTo(px(LP),ph-3); x.closePath(); const g=x.createLinearGradient(0,0,0,ph); g.addColorStop(0,'rgba(240,248,255,.95)'); g.addColorStop(1,'rgba(148,180,220,.55)'); x.fillStyle=g; x.fill();
      x.strokeStyle='#f97316'; x.lineWidth=2; x.beginPath(); let on=false; for(let i=0;i<=LP;i+=2){ if(TL.grade[i]>.07){ on?x.lineTo(px(i),py(TL.y[i])):x.moveTo(px(i),py(TL.y[i])); on=true; } else on=false; } x.stroke();
      x.fillStyle='#ef4444'; x.fillRect(px(LINE)-1,3,2,ph-6); x.fillStyle='#22d3ee'; x.fillRect(px(RANGE)-1,3,2,ph-6);
      PROF={c,pw,ph,px,py}; }
    const x0=12, y0=H-PROF.ph-8; if(a.ph!=='pen') { ctx.drawImage(PROF.c,x0,y0-0,PROF.pw,PROF.ph);
      for(const o of R.A){ if(o.ph!=='ski') continue; const q=wrap(o.z,LP); ctx.fillStyle=o===a?'#fff':'#f87171'; ctx.beginPath(); ctx.arc(x0+PROF.px(q),y0+PROF.py(at(TL,TL.y,q)),o===a?3.6:2.6,0,7); ctx.fill(); if(o===a){ ctx.strokeStyle='#0b2e7a'; ctx.lineWidth=1.5; ctx.stroke(); } }
      ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='700 10px system-ui'; ctx.textAlign='right'; ctx.textBaseline='top'; ctx.fillText(`${Math.round(gradeAt(a.z,TL)*100)} %`,x0+PROF.pw-6,y0+3); }
  }

  /* ---------- slingan ---------- */
  function step(dt){
    const a=meA(), g=G, nf=FMT[g.fmt], laps=nf.laps, stages=stagesOf(g);
    if(!R.started){ R.cd-=dt; const n=Math.ceil(R.cd); if(n!==R.beeped&&n>=1&&n<=3){ R.beeped=n; tone(660,.12,'sine',.12); } if(R.cd<=0){ R.started=true; tone(1320,.35,'sine',.13); ambInit(); crowdSfx(true); } return; }
    for(const x of R.A){
      if(x.done) { if(x.ph==='done'){ x.v=Math.max(0,x.v-3*dt); x.z+=x.v*dt; } continue; }
      if(x!==a && !x.ai){ remoteStep(x); continue; }
      if(x.ph==='ski'||x.ph==='pen'){
        if(x.ai || (x===a && DEV && window.__bsAuto)){ const A0=x.ph==='pen'?TP:TL, ideal=idealGap(gradeAt(x.ph==='pen'?x.pz:x.z,A0),x.v); if(x.t-(x.lastPush??-9)>=ideal*(x.ai?1:1.02) && !(gradeAt(x.ph==='pen'?x.pz:x.z,A0)<-.05&&x.v>7.5)) { push(x,x.lastSide==='L'?'R':'L'); if(x===a) strideSfx(x.v,1); } }
        skiStep(x,dt,x.ph==='pen'?TP:TL);
        if(x.ph==='pen' && x.pz>=x.pen){ x.ph='ski'; x.pz=0; x.pen=0; if(x===a){ R.banner={txt:'Ut på nästa varv!',t:1.4}; } }
        if(x.ph==='ski'){
          const lapsDone=Math.floor((x.z-LINE)/LP)+ (x.z>=LINE?1:0);   // antal gånger man passerat linjen
          const fin = x.z>=LINE+laps*LP;
          if(fin){ x.done=true; x.ph='done'; x.finish=x.t; x.mood=moodOf(x); if(x===a){ finishSfx(); } continue; }
          x.lap=Math.max(0,lapsDone-1);
          // in på vallen efter varv i (i = 1..)
          const due=x.st<stages.length && x.z>=LINE+(x.st+1)*LP+(RANGE-LINE);
          if(due){ x.z=LINE+(x.st+1)*LP+(RANGE-LINE); startRange(x); if(x===a){ R.banner=null; } }
        }
      } else if(x.ph==='range'){
        x.t+=dt;
        if(x!==a){ x.rangeT+=dt; x.hr+=(96-x.hr)*dt/16; if(x.rangeT>=x.aiDone){ endRange(x,x.aiShots.filter(s=>!s.hit).length); } }
        else rangeStep(x,dt);
      }
    }
    if(a.ph==='ski' && !a.done){ const ideal=idealGap(gradeAt(a.z,TL),a.v); if(a.t-(a.lastPush??-9)>ideal*2.2 && a.v<3 && gradeAt(a.z,TL)>.03 && !R.hintT){ R.banner={txt:'Tryck V–H i takt!',t:1.4}; R.hintT=4; } }
    if(R.hintT) R.hintT=Math.max(0,R.hintT-dt);
    if(G.fmt!=='tr') recStep(dt);
    if(R.banner) R.banner.t-=dt;
    // datorns och mitt mål
    for(const x of R.A) if(x.done && !x.sent && (x.ai || x===a)){ if(x===a && performance.now()-(R.finT||(R.finT=performance.now()))<3600) continue; x.sent=true; const act={type:'finish', ms:Math.round(x.finish*1000), sh:x.sh.slice()}; if(x.ai) applyAndPublish(act,x.k); else { ambOff(); doAct(act); } }
  }
  function rangeStep(a,dt){ /* (inspelningen sker i step) */
    const S=R.sc; if(!S) return; a.t+=0; // tiden räknas i loop
    if(S.phase==='arrive'){ if(!R.cine && a.t>=S.readyAt) { S.phase='aim'; showCtl(true); } }
    if(S.phase==='aim'||S.phase==='arrive'){ swayStep(S,a,dt); }
    if(S.phase==='aim' && DEV && window.__bsAuto && S.left>0 && S.bolt<=0 && a.t>=S.readyAt){
      const k=S.hits.findIndex(h=>!h), tx=TX(k<0?0:k)-wind(S)*7-S.clicks*6; S.P.x+=(tx-S.cur.x)*.12; S.P.y+=(0-S.cur.y)*.12; R.holding=true;
      if(Math.hypot(S.cur.x-tx,S.cur.y)<(S.pos==='L'?9:30) && now()-S.lastShotT>.9) fire(); }
    if(S.leaveAt!=null && a.t>=S.leaveAt && S.phase==='aim'){
      S.phase='leave'; R.holding=false; showCtl(false);
      const misses=5-S.hits.reduce((s,x)=>s+x,0);
      if(G.tv!==false){ R.cine={shots:['over'], t0:now(), dur:[2.3], role:'leave'}; }
      S.misses=misses; S.leaveT=a.t+(G.tv!==false?2.3:1.2);
    }
    if(S.phase==='leave' && a.t>=S.leaveT && !R.cine){
      const misses=S.misses; if(G.wind) lsSet('bs_clicks_'+S.pos,String(S.clicks));
      if(G.fmt==='tr'){ R.trLog.push({pos:S.pos, hits:S.hits.slice(), shots:S.shots.slice(), t:a.t-S.tStart, w:S.wind.b}); a.sh.push(misses); R.sc=null; R.trI++; R.trCard=true; showCtl(false); render(); return; }
      R.sc=null; endRange(a,misses); R.banner={txt: misses? `${misses} bom – ${misses} straffrunda${misses>1?'or':''}`:'Fullt! 🎯', t:2}; if(!misses){ sparkles(18); crowdSfx(true); }
    }
  }
  function moodOf(x){ const shots=x.sh.length*5, miss=x.sh.reduce((p,q)=>p+q,0); return shots && miss>=shots*.5 ? 'sad' : 'cheer'; }   // grunden är jubel – depp bara om minst hälften av skotten bommats
  function remoteStep(x){ const r=R.remote[x.k]; if(!r) return; x.z+=(r.z-x.z)*.25; x.pz=r.pz; x.v=r.v; x.hr=r.hr; x.ph=r.ph; x.lap=r.lap; x.sh=r.sh||x.sh; x.t=r.t; x.lastSide=r.ls; x.stride=r.st; x.tuck=r.tk; if(r.f!=null){ if(!x.done) x.mood=moodOf(x); x.done=true; x.ph='done'; x.finish=r.f; } }
  /* ---------- inspelning, repris och höjdpunkter ---------- */
  const PHC=['ski','pen','range','done'];
  function recStep(dt){
    if(!R.rec) R.rec={fr:[],ev:[],acc:0,t:0,end:null};
    const r=R.rec; r.t+=dt; if(r.end!=null&&r.t>r.end) return; if(r.end==null&&R.A.every(x=>x.done)) r.end=r.t+3.6;
    r.acc+=dt; if(r.acc<1/15) return; r.acc=0; const a=meA(), S=R.sc;
    const f={t:r.t, A:R.A.map(x=>{ if(!x._shR||x._shR.length!==x.sh.length) x._shR=x.sh.slice(); return [x.z,x.pz,PHC.indexOf(x.ph),x.v,x.stride||0,x.lastSide==='L'?0:1,x.tuck||0,x.hr,x.lap,x.mood==='cheer'?1:x.mood==='sad'?2:0,x.t,x.finish??-1,x._shR,x.st]; })};
    if(a.ph==='range'&&S&&S.phase==='aim') f.sc=[S.cur?S.cur.x:S.aim.x,S.cur?S.cur.y:S.aim.y,S.bolt,S.rec,S.left,S.pos==='L'?0:1,wind(S),S.clicks,S.hold,a.t-S.tStart];
    r.fr.push(f);
  }
  let RS=null;
  function applyFrame(t){
    const fr=R.rec.fr, i=REPLAY.find(fr,t), A=fr[i], B=fr[Math.min(fr.length-1,i+1)], u=B.t>A.t?clamp((t-A.t)/(B.t-A.t),0,1):0;
    R.A.forEach((x,j)=>{ const p=A.A[j], q=B.A[j]; if(!p) return; const L=n=>p[n]+(q[n]-p[n])*u, jump=Math.abs(q[0]-p[0])>30;
      x.z=jump?p[0]:L(0); x.pz=Math.abs(q[1]-p[1])>30?p[1]:L(1); x.ph=PHC[p[2]]; x.v=L(3); x.stride=p[4]; x.lastSide=p[5]?'R':'L'; x.tuck=L(6); x.hr=L(7); x.lap=p[8]; x.mood=p[9]===1?'cheer':p[9]===2?'sad':null; x.t=L(10); x.finish=p[11]>=0?p[11]:null; x.sh=p[12]; x.st=p[13]; x.done=x.ph==='done'; });
    const a=meA();
    if(A.sc&&a.ph==='range'){ const c=A.sc, d=B.sc||c, L=n=>c[n]+(d[n]-c[n])*u; const pos=c[5]?'S':'L';
      if(!RS||RS.st!==a.st){ RS={st:a.st, pos, hits:[0,0,0,0,0], fl:[0,0,0,0,0], puffs:[], shots:[], wind:{b:0,ph:0}, phase:'aim', readyAt:-1, P:{x:0,y:0}, pp:{x:0,y:0}, pv:{x:0,y:0}}; }
      RS.cur={x:L(0),y:L(1)}; RS.aim=RS.cur; RS.bolt=c[2]; RS.rec=c[3]; RS.left=c[4]; RS.wind.b=c[6]; RS.clicks=c[7]; RS.hold=c[8]; RS.tStart=a.t-c[9]; RS.beat=(t*a.hr/60)%1;
      // träffarna i den här serien: de som fällts fram till nu
      const st0=t-c[9]; RS.hits=[0,0,0,0,0]; for(const e of R.rec.ev){ if(e.t<st0-.01) continue; if(e.t>t) break; RS.hits[e.k]=1; RS.fl[e.k]=now()-(t-e.t); }
      R.sc=RS; }
    else R.sc=null;
  }
  function buildClips(){
    const fr=R.rec.fr, me=R.me, T=fr[fr.length-1].t, a=meA(), out=[];
    const st=(fr.find(f=>f.A[me][3]>.5)||fr[0]).t, fi=fr.find(f=>f.A[me][2]===3), fin=fi?fi.t:T;
    const add=c=>{ c.t0=clamp(c.t0,0,T); c.t1=clamp(c.t1,c.t0+.3,T); out.push(c); };
    add({t0:st-.5, t1:st+2.6, view:'fly', z0:.22, z1:.16, rate:1, cap:`${FMT[G.fmt].name} · Östersund · ${R.wx.icon} ${R.wx.name}`});
    const climb=fr.find(f=>f.A[me][2]===0&&f.A[me][0]>LINE+235); if(climb) add({t0:climb.t, t1:climb.t+3.2, view:'ofr', z0:.14, z1:.04, rate:.7, cap:'Långa backen ut från stadion', slow:1});
    let vm=0, tv=st+20; for(const f of fr){ const x=f.A[me]; if(x[2]===0&&f.t<fin&&x[3]>vm){ vm=x[3]; tv=f.t; } } add({t0:tv-1.4, t1:tv+1.4, view:'low', z0:.06, z1:.06, a0:-.3, a1:.3, rate:.5, cap:`${Math.round(vm*3.6)} km/h utför genom skogen`, slow:1});
    // skjutningarna: ankomst som TV-bild, sedan serien snabbspolad över axeln
    let k=0; while(true){ const i0=fr.findIndex(f=>f.sc&&f.A[me][13]===k&&f.A[me][2]===2); if(i0<0) break; let i1=i0; while(i1+1<fr.length&&fr[i1+1].A[me][2]===2) i1++;
      const tA=fr[i0].t, tB=fr[i1].t, pos=fr[i0].sc[5]?'S':'L', hits=R.rec.ev.filter(e=>e.t>=tA-.5&&e.t<=tB+.5).length;
      add({t0:tA-2.2, t1:tA, cine:pos==='L'?'prone':'stand', pos, rate:1, cap:`${pos==='L'?'Liggande':'Stående'} skytte`});
      add({t0:tA, t1:tB, cine:'over', pos, rate:(tB-tA)/3.6, cap:`${hits}/5 ${hits===5?'– fullt! 🎯':hits>=4?'– snyggt!':''}`});
      const pz=fr.findIndex((f,j)=>j>i1&&f.A[me][2]===1); if(pz>0&&fr[pz].t-tB<6) add({t0:fr[pz].t+1, t1:fr[pz].t+3.6, view:'top', z0:.3, z1:.22, rate:1, cap:'Straffrunda…'});
      k++; }
    add({t0:fin-2.2, t1:fin+.3, view:'front', z0:.22, z1:.05, rate:.5, slow:1, cap:`I mål: ${fmtT(a.finish??fin)}`});
    add({t0:fin+.3, t1:Math.min(T,fin+3.4), view:'close', z0:.05, z1:.03, a0:-.7, a1:1.7, rate:.85, cap:a.mood==='cheer'?'🎉 Jubel!':'Nästa gång! 💪'});
    out.sort((p,q)=>p.t0-q.t0); const res=[]; for(const c of out){ const p=res[res.length-1]; if(p&&c.t0<p.t1-.01){ if(c.t1-p.t1<.8) continue; c.t0=p.t1; } res.push(c); }
    return res;
  }
  function startPlay(mode){
    if(!R||!R.rec||R.rec.fr.length<10){ toast('Ingen inspelning ännu'); return; }
    const T0=R.rec.fr[R.rec.fr.length-1].t, clips=mode==='hl'?buildClips():null;
    R.play={mode, t:clips?clips[0].t0:0, T:T0, speed:1, playing:true, clips, ci:0, rt:0, flash:0}; R.camO=mode==='hl'; RS=null; DSO.cut=true; ambOff(); render();
  }
  function stopPlay(){ if(!R||!R.play) return; R.play=null; R.camO=false; R.cine=null; applyFrame(R.rec.fr[R.rec.fr.length-1].t); R.sc=null; render(); }
  function playStep(dt){
    const p=R.play; let rate=1; p.rt+=dt; p.flash=Math.max(0,p.flash-dt*3); R.cine=null;
    let c=p.mode==='hl'?p.clips[p.ci]:null;
    if(p.mode==='hl'&&p.playing&&(!c||p.t>=c.t1-1e-3)){ p.ci++; c=p.clips[p.ci]; if(!c){ p.playing=false; p.done=true; p.ci=p.clips.length-1; c=p.clips[p.ci]; REPLAY.refresh('bs',p); } else { p.t=c.t0; p.flash=.9; DSO.cut=true; tone(880,.06,'sine',.05); } }
    if(c){ const u=clamp((p.t-c.t0)/Math.max(.01,c.t1-c.t0),0,1); rate=c.rate; p.cap=c.cap; p.capA=Math.min(u*5,(1-u)*5,1); p.slow=!!c.slow&&rate<.9;
      if(c.cine){ R.camO=false; const dur=(c.t1-c.t0)/rate; R.cine={shots:[c.cine], t0:now()-u*dur, dur:[dur+1], role:'hl', pos:c.pos}; }
      else { R.camO=true; DSO.view=c.view; DSO.zoom=lerp(c.z0,c.z1,smooth(u)); DSO.ang=lerp(c.a0||0,c.a1||0,u); DSO.k=u; DSO.fast=6; } }
    if(p.playing){ p.t=Math.min(p.T,p.t+dt*p.speed*rate); if(p.mode==='replay'&&p.t>=p.T){ p.playing=false; REPLAY.refresh('bs',p); } }
    applyFrame(p.t);
    if((p.syncT=(p.syncT||0)+dt)>.25){ p.syncT=0; REPLAY.sync('bs',p); }
  }
  REPLAY.register('bs',(a,v)=>{ if(!R||!R.play) return; const p=R.play;
    if(a==='close'){ stopPlay(); return; }
    if(a==='play'){ if(p.done){ p.done=false; p.ci=0; p.t=p.clips[0].t0; p.rt=0; DSO.cut=true; p.playing=true; } else { if(p.mode==='replay'&&p.t>=p.T-.01) p.t=0; p.playing=!p.playing; } }
    if(a==='speed') p.speed={1:.5,.5:.25,.25:2,2:1}[p.speed]||1;
    if(a==='seek') p.t=v*p.T;
    REPLAY.refresh('bs',p); });
  const rpBtns=()=> R&&R.rec&&R.rec.fr.length>10 ? `<div class="rp-btns"><button data-bsx="rp">⏪ Repris</button><button data-bsx="hl">🎬 Höjdpunkter</button></div>` : '';
  function loop(ms){
    raf=0; if(!G||G.kind!=='skidskytte'||view!=='game'||!cv||!cv.isConnected){ ambOff(); showCtl(false); return; }
    raf=requestAnimationFrame(loop);
    const dt=Math.min(.05,(ms-(lastT||ms))/1000); lastT=ms;
    const id=G.id+':'+(G.go||0); if(!R||R.gid!==id) newRun();
    if(R.play){ playStep(dt); draw(dt); return; }
    if(G.over){ if(R.rec&&!R.rec.fin){ R.rec.fin=1; R.rec.end=null; R.rec.acc=1; recStep(0); } draw(dt); return; }
    const a=meA();
    const reps=(DEV&&window.__bsSpeed)||1; for(let i=0;i<reps;i++){ step(dt); if(a.ph==='range'&&R.sc&&R.sc.phase!=='leave'&&R.sc.bolt<=0) break; }   // testerna kan snabbspola
    // tangentbord
    if(a.ph==='range'&&R.sc){ const S=R.sc, k=1.2; if(keys.ArrowLeft) S.P.x-=k; if(keys.ArrowRight) S.P.x+=k; if(keys.ArrowUp) S.P.y+=k; if(keys.ArrowDown) S.P.y-=k; R.holding = R.ptr!=null || !!keys.ShiftLeft || !!keys.ShiftRight || !!(DEV&&window.__bsAuto); }
    // snöstänk från skären
    if((a.ph==='ski'||a.ph==='pen') && a.stride>.85 && a.v>2){ const sd=a.lastSide==='L'?-1:1, z=a.ph==='pen'?a.pz:a.z; for(let i=0;i<2;i++) R.parts.push({x:mid(z)+sd*(.6+Math.random()*.3), z:z+.2, y:.03, vx:sd*(1+Math.random()*2), vz:a.v*.3, vy:.6+Math.random()*1.4, t:.45, r:.7+Math.random()*.8}); }
    if(R.parts.length>140) R.parts.splice(0,R.parts.length-140);
    // firande efter målgång: drönaren går nära och kretsar runt åkaren en stund
    if(a.done){ R.celebT=(R.celebT||0)+dt; if(R.celebT<7){ if(!R.camO){ R.camO=true; DSO.cut=true; DSO.view='close'; DSO.zoom=.04; DSO.fast=2.5; } DSO.ang=-.8+R.celebT*.35; } else R.camO=false; }
    ambUpdate(a);
    if(mode==='online' && ms-sendT>90){ sendT=ms; send({t:'bs', g:G.id, n:G.go||0, s:meSeat2(), z:+a.z.toFixed(2), pz:+a.pz.toFixed(1), v:+a.v.toFixed(2), hr:Math.round(a.hr), ph:a.ph, lap:a.lap, sh:a.sh, tm:+a.t.toFixed(2), ls:a.lastSide, st:+a.stride.toFixed(2), tk:+a.tuck.toFixed(2), f:a.done?+a.finish.toFixed(2):null}); }
    draw(dt);
  }
  function draw(dt){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const a=meA(), p=R.play;
    drawMain(dt,a);
    const scope = a.ph==='range' && R.sc && !R.cine;
    WEATHER.post(ctx,W,H,scope?null:lastYH,R.g3?{...R.wx,fog:0,flat:0,kind:R.wx.kind==='sun'?'gl':R.wx.kind}:R.wx,R.wxs,dt,scope?0:a.v,scope?{scope:true,cy:H*.44}:null);
    if(p) REPLAY.overlay(ctx,W,H,{mode:p.mode, speed:p.speed, flash:p.flash, title:p.mode==='hl'?Math.max(0,1.8-p.rt):0, sub:`${FMT[G.fmt].name} · ${bare(pname(a.k))}`, cap:p.cap, capA:p.capA, slow:p.slow&&p.playing});
  }
  function drawMain(dt,a){
    R.g3=false; glShow(false);
    if(R.cine && drawCine()) return;
    if(a.ph==='range' && R.sc){ drawScope(dt); return; }
    if(G.fmt==='tr'){ drawTrBg(); return; }
    ctx.save(); drawSki(dt); ctx.restore(); if(!R.play||R.play.mode!=='hl') skiHud();
  }
  function drawTrBg(){ // mellan seriernas: stillbild av vallen från drönaren
    ctx.fillStyle='#0b1020'; ctx.fillRect(0,0,W,H);
    const t0=now(); C3.f=Math.min(W,H)*1.1; const sh=SHOTS.drone(1); look(sh.p,sh.l); focusD=sh.f;
    const key=W+'x'+H+':'+R.wx.kind+R.wx.seed; if(BDkey!==key){ BD=makeBackdrop(W,H); WEATHER.tintBackdrop(BD.c,BD.hz*BD.K,R.wx); BDkey=key; }
    const yH=H/2-C3.f*Math.tan(C3.pitch), top=yH-BD.hz; lastYH=yH; ctx.fillStyle=WEATHER.sky(R.wx)||'#4f7fc4'; ctx.fillRect(0,0,W,H); ctx.drawImage(BD.c,-BD.w*.25,top,BD.w,BD.h); ctx.fillStyle='#eef3fa'; ctx.fillRect(0,yH+BD.vb-2,W,H);
    const list=[]; rangeScene(list,meA(),{hits:[0,0,0,0,0],left:5,pos:'L'}); list.forEach(o=>{ const p=p3(...o.at); o.Z=p?p[3]:-1; }); list.sort((p,q)=>q.Z-p.Z); for(const o of list) if(o.Z>0) o.d();
    ctx.fillStyle='rgba(2,6,23,.45)'; ctx.fillRect(0,0,W,H);
  }
  function finishSfx(){ [523,659,784,1047].forEach((f,i)=>tone(f,.25,'triangle',.09,i*.1)); crowdSfx(true); crowdSfx(true); }

  /* ---------- in/ut ---------- */
  function fit(){ if(!cv) return; const host=cv.parentElement, r=host.getBoundingClientRect(); const w=Math.round(Math.min(host.clientWidth,700)), h=Math.round(Math.max(340,Math.min(window.innerHeight-r.top-10,w*1.9)));
    dpr=Math.min(weakB()?1.5:3, window.devicePixelRatio||1, Math.sqrt(2.8e6/(w*h))); cv.style.width=w+'px'; cv.style.height=h+'px'; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); W=w; H=h; BDkey=''; WCkey=''; PROFkey='';
    if(glcv){ const d2=Math.min(dpr,weakB()?1.25:2.5,Math.sqrt(2.3e6/(w*h))); glcv.width=Math.round(w*d2); glcv.height=Math.round(h*d2); glcv.style.width=w+'px'; glcv.style.height=h+'px'; glcv.style.left=cv.offsetLeft+'px'; glcv.style.top=cv.offsetTop+'px'; } }
  window.addEventListener('resize',()=>{ if(G&&G.kind==='skidskytte'&&view==='game') fit(); });
  function showCtl(on){ const c=document.getElementById('bsCtl'); if(c) c.classList.toggle('on',!!on); const d=document.querySelector('.dr-bar[data-dk="bs_dr"]'); if(d) d.style.display=on?'none':''; }
  function tapSki(e){ const a=meA(); if(!R.started||(a.ph!=='ski'&&a.ph!=='pen')||a.done) return; const r=cv.getBoundingClientRect(), side=(e.clientX-r.left)<r.width/2?'L':'R'; doPush(side); }
  function doPush(side){ const a=meA(); const res=push(a,side); strideSfx(a.v,res.q); if(res.bad.includes('side')) R.banner={txt:'Växla ben!',t:.8}; else if(res.bad.includes('fast')) R.banner={txt:'Lugnare takt',t:.8}; }
  function mount(){
    const host=document.getElementById('bsHost'); if(!host) return; sprites();
    if(!cv){ cv=document.createElement('canvas'); cv.className='bs-cv'; ctx=cv.getContext('2d');
      cv.addEventListener('pointerdown',e=>{ e.preventDefault(); unlockAudio(); ambInit();
        if(R&&R.play) return;
        if(R&&R.cine&&R.cine.role!=='still'){ R.cine=null; return; }
        const a=R&&meA(); if(!a) return;
        if(R.trCard) return;
        if(a.ph==='range'&&R.sc){ R.ptr={id:e.pointerId,x:e.clientX,y:e.clientY}; try{ cv.setPointerCapture(e.pointerId); }catch(er){} return; }
        tapSki(e); });
      cv.addEventListener('pointermove',e=>{ if(!R||!R.ptr||e.pointerId!==R.ptr.id||!R.sc) return; const S=R.sc, k=(S.pos==='L'?.55:.65)/Zs; S.P.x+=(e.clientX-R.ptr.x)*k; S.P.y-=(e.clientY-R.ptr.y)*k; S.P.x=clamp(S.P.x,-900,900); S.P.y=clamp(S.P.y,-600,700); R.ptr.x=e.clientX; R.ptr.y=e.clientY; });
      const up=e=>{ if(R&&R.ptr&&e.pointerId===R.ptr.id){ R.ptr=null; R.holding=false; } }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
      cv.addEventListener('contextmenu',e=>e.preventDefault()); }
    if(!glcv){ glcv=document.createElement('canvas'); glcv.className='bs-glc'; }
    host.appendChild(glcv); host.appendChild(cv); glVis=null; glSyncB(); fit();
    if(!raf){ lastT=0; raf=requestAnimationFrame(loop); }
  }
  document.addEventListener('pointerdown',e=>{ const b=e.target.closest('[data-bs]'); if(!b||!G||G.kind!=='skidskytte'||!R) return; e.preventDefault(); const k=b.dataset.bs, S=R.sc;
    if(k==='fire'){ unlockAudio(); fire(); return; }
    if(k==='cl'&&S&&G.wind){ S.clicks=clamp(S.clicks+ +b.dataset.d,-20,20); hit(0,3800,.08,.01); return; } });
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-bsx]'); if(!b||!G||G.kind!=='skidskytte'||!R) return; const k=b.dataset.bsx;
    if(k==='next'){ R.trCard=false; const a=meA(); if(R.trI>=TR_N){ finishTr(); return; } a.hr=G.trHr==='race'?172+Math.random()*6:84; a.st=R.trI; startRange(a); render(); }
    if(k==='end'){ finishTr(); }
    if(k==='gl'){ GLON=!GLON; lsSet('bs_gl',GLON?'1':'0'); glSyncB(true); fit(); return; }
    if(k==='rp'||k==='hl'){ unlockAudio(); startPlay(k==='rp'?'replay':'hl'); } });
  function finishTr(){ const a=meA(); R.trCard=false; const tot=R.trLog.reduce((s,x)=>s+x.t,0); const hits=R.trLog.reduce((s,x)=>s+x.hits.reduce((p,q)=>p+q,0),0);
    const key=`bs_tr_${G.trPos}_${G.trHr}_${G.easy?1:0}`; try{ const B=JSON.parse(lsGet(key))||{}; const pct=hits/(R.trLog.length*5); if(R.trLog.length===TR_N && (!B.hits||hits>B.hits||(hits===B.hits&&tot<B.t))) lsSet(key,JSON.stringify({hits,t:tot,d:Date.now()})); }catch(e){}
    while(a.sh.length<TR_N) a.sh.push(5);
    doAct({type:'finish', ms:Math.max(3001,Math.round(tot*1000)), sh:a.sh.slice(0,TR_N)}); }
  document.addEventListener('keydown',e=>{ if(!G||G.kind!=='skidskytte'||view!=='game'||!R) return; const a=meA();
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','Space','KeyA','KeyD'].includes(e.code)){ e.preventDefault(); }
    if(a.ph==='ski'||a.ph==='pen'){ if(e.repeat) return; if(e.code==='ArrowLeft'||e.code==='KeyA') { if(R.started) doPush('L'); } if(e.code==='ArrowRight'||e.code==='KeyD') { if(R.started) doPush('R'); } return; }
    if(e.code==='Space'){ if(R.cine&&R.cine.role!=='still'){ R.cine=null; return; } fire(); }
    keys[e.code]=true; });
  document.addEventListener('keyup',e=>{ keys[e.code]=false; });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) ambOff(); });

  /* ---------- nätet ---------- */
  function onNet(m){
    if(!G||G.kind!=='skidskytte'||m.g!==G.id||!R||(m.n||0)!==(G.go||0)) return;
    if(!Number.isInteger(m.s)||m.s<0||m.s>=G.names.length||m.s===meSeat2()) return;
    if(!['z','v','hr','tm'].every(k=>Number.isFinite(m[k]))||!['ski','pen','range','done'].includes(m.ph)) return;
    R.remote[m.s]={z:m.z,pz:+m.pz||0,v:m.v,hr:m.hr,ph:m.ph,lap:+m.lap||0,sh:Array.isArray(m.sh)?m.sh.filter(x=>Number.isInteger(x)&&x>=0&&x<=5).slice(0,4):[],t:m.tm,ls:m.ls==='L'?'L':'R',st:+m.st||0,tk:+m.tk||0,f:Number.isFinite(m.f)?m.f:null};
  }

  /* ---------- spelmotorn ---------- */
  GINFO.skidskytte={name:'Skidskytte', icon:'🎯', ai:BOTS[0], bots:BOTS, max:4, desc:'Östersunds skidstadion · sprint, kort lopp eller träna skyttet', grad:'linear-gradient(135deg,#0b2e7a,#60a5fa 55%,#facc15)'};
  const okMs=x=>x===null||(Number.isInteger(x)&&x>3000&&x<3600000);
  // egen avslutning: ingen "VINST!" i träning eller när man åker ensam
  const overFx=d=>{ const solo=d.names.length===1, me=meSeat2();
    if(d.fmt==='tr'){ const r=d.res[0], n=r.sh.length*5, h=n-r.sh.reduce((s,x)=>s+x,0), q=h/Math.max(1,n);
      if(q>=.9){ celebrate(q>=1?'FULLT!':'TOPPKLASS!'); sfx.win(); sparkles(50); } else if(q>=.55){ sfx.pick(); sparkles(22); } else { tone(523,.18,'triangle',.08); tone(659,.22,'triangle',.08,.15); } return; }
    if(solo){ tone(523,.2,'triangle',.09); tone(784,.3,'triangle',.09,.18); sparkles(20); return; }
    if(d.winner===me){ celebrate('VINST!'); sfx.win(); sparkles(50); } else if(d.winner===-1){ sfx.pick(); sparkles(16); } else { tone(392,.3,'triangle',.1); tone(330,.4,'triangle',.1,.25); } };
  KIND.skidskytte={
    init(){ const base=!fresh&&G&&G.kind==='skidskytte'?G:null; fresh=false; const o=base?{fmt:base.fmt,wind:base.wind,easy:base.easy,tv:base.tv,trPos:base.trPos,trHr:base.trHr}:pend;
      return {fmt:o.fmt, wind:!!o.wind, easy:!!o.easy, tv:o.tv!==false, trPos:o.trPos||'L', trHr:o.trHr||'race', seed:0, res:[], go:0, cur:0}; },
    start(g){ g.seed=Math.floor(Math.random()*1e9); g.res=g.names.map(()=>({ms:-1,sh:[]})); g.go=(g.go||0)+1; g.cur=0; if(g.fmt==='tr'&&g.names.length>1) g.fmt='sprint'; },
    valid(g){ return g.names.length>=1&&g.names.length<=4 && Object.prototype.hasOwnProperty.call(FMT,g.fmt) && ['L','S','V'].includes(g.trPos) && ['race','calm'].includes(g.trHr) && Number.isInteger(g.seed)
      && Array.isArray(g.res) && g.res.every(r=>r&&typeof r==='object'&&(r.ms===-1||okMs(r.ms))&&Array.isArray(r.sh)&&r.sh.length<=TR_N&&r.sh.every(x=>Number.isInteger(x)&&x>=0&&x<=5)); },
    waitingFor(){ return -1; },
    scoreOf(g,i){ const r=g.res&&g.res[i]; if(!r) return ''; if(r.ms===-1) return '–'; if(r.ms===null) return 'bröt'; return g.fmt==='tr'? `${r.sh.length*5-r.sh.reduce((s,x)=>s+x,0)}/${r.sh.length*5}` : `${fmtT(r.ms/1000)} (${r.sh.join('+')})`; },
    apply(g,a,seat){
      if(a.type==='resign'){ if(g.over||g.res[seat].ms!==-1) return false; g.res[seat]={ms:null,sh:g.res[seat].sh}; }
      else if(a.type==='finish'){ const need=g.fmt==='tr'?TR_N:FMT[g.fmt].st.length; if(g.over||g.res[seat].ms!==-1||!okMs(a.ms)||a.ms===null||!Array.isArray(a.sh)||a.sh.length!==need||!a.sh.every(x=>Number.isInteger(x)&&x>=0&&x<=5)) return false;
        g.res[seat]={ms:a.ms,sh:a.sh.slice()}; g.last={t:Date.now(),seat,ms:a.ms,sh:a.sh.slice()}; }
      else return false;
      if(g.res.every(r=>r.ms!==-1)){ g.over=true; const t=g.res.map(r=>r.ms==null?Infinity:r.ms), mn=Math.min(...t);
        g.winner = g.fmt==='tr' ? -2 : g.names.length===1 ? (mn<Infinity?0:-2) : mn===Infinity?-1 : t.filter(x=>x===mn).length>1?-1:t.indexOf(mn); }
      return true; },
    aiSeat(){ return null; },
    overFx, noStats:d=>d.fmt==='tr',
    effects(prev,d){ if(d.last&&(!prev.last||prev.last.t!==d.last.t)&&d.last.seat!==meSeat2()&&d.names.length>1) toast(`${bare(pname(d.last.seat))} i mål: ${fmtT(d.last.ms/1000)} (${d.last.sh.join('+')})`,2200); },
    html(){
      const g=G, me=meSeat2(); let over='';
      if(g.over){
        const solo=g.names.length===1, rows=g.names.map((n,i)=>({i,n,r:g.res[i]})).sort((p,q)=>(p.r.ms??1e12)-(q.r.ms??1e12));
        const tr=g.fmt==='tr', hits=r=>r.sh.length*5-r.sh.reduce((s,x)=>s+x,0);
        const log = tr && R && R.trLog.length ? `<div class="bs-log">${R.trLog.map((l,i)=>`<div><span>${i+1}. ${l.pos==='L'?'Ligg':'Stå'}</span><span class="bs-dots">${l.hits.map(h=>h?'⚪':'⚫').join('')}</span><span>${fmtT(l.t)}</span></div>${targetSvg(l)}`).join('')}</div>` : '';
        over=`<div class="bs-over"><div class="gover ${solo?'won':g.winner===me?'won':g.winner===-1?'tie':'lost'}"><div class="gi">${tr?'🎯':solo?'⏱️':g.winner===me?'🏆':'🎿'}</div>
          <h3>${tr?`${hits(g.res[0])} av ${g.res[0].sh.length*5} träff`:solo?`I mål: ${fmtT(g.res[0].ms/1000)}`:g.winner===me?'Du vann!':g.winner===-1?'Oavgjort':esc(bare(pname(g.winner)))+' vann'}</h3>
          ${tr?`<p class="bs-pep">${pep(hits(g.res[0]),g.res[0].sh.length*5)}</p>`+log:`<div class="bs-res">${rows.map((x,k)=>`<div class="${g.winner===x.i?'win':''}"><b>${k+1}. ${esc(bare(x.n))}</b><span>${x.r.ms==null?'bröt':fmtT(x.r.ms/1000)} · ${x.r.sh.join('+')}</span></div>`).join('')}</div><p class="bs-pb">Siffrorna efter tiden = bommar per skytte (straffrunda 150 m per bom)</p>`}
          ${tr?'':rpBtns()}<div class="gbtns"><button class="pri" data-g="rematch">🔄 ${tr?'Träna igen':'Nytt lopp'}</button><button data-act="lobby">🏠 Lobby</button></div></div></div>`; }
      else if(R && R.trCard){ const l=R.trLog[R.trLog.length-1], h=l.hits.reduce((s,x)=>s+x,0);
        over=`<div class="bs-over"><div class="gover tie"><div class="gi">${h===5?'🎯':'🔫'}</div><h3>Serie ${R.trLog.length}: ${h}/5 – ${fmtT(l.t)}</h3>${targetSvg(l)}
          <p class="bs-pb">${l.w&&G.wind?`Vinden: ${Math.abs(l.w).toFixed(1).replace('.',',')} m/s från ${l.w>0?'vänster':'höger'}. `:''}${tipFor(l)}</p>
          <div class="gbtns">${R.trI<TR_N?`<button class="pri" data-bsx="next">▶️ Nästa serie (${stagesOf(G)[R.trI]==='L'?'liggande':'stående'})</button>`:`<button class="pri" data-bsx="end">✅ Se resultatet</button>`}${R.trI<TR_N?'<button data-bsx="end">Avsluta</button>':''}</div></div></div>`; }
      const tr=g.fmt==='tr';
      return `<div class="bs-wrap ${R&&R.play?'rp-on'+(R.play.mode==='hl'?' rp-hl':''):''}"><div id="bsHost" class="bs-host"></div>${R&&R.play?REPLAY.bar('bs',R.play):''}${tr?'':`<button class="bs-glb" data-bsx="gl">${glLabelB()}</button>`}
        ${tr?'':DRONE.panel(DS)}<div class="bs-ctl" id="bsCtl">${g.wind?'<button class="bs-cl" data-bs="cl" data-d="-1" aria-label="Knäpp vänster">◀ klick</button>':''}<button class="bs-fire" data-bs="fire">AVFYRA</button>${g.wind?'<button class="bs-cl" data-bs="cl" data-d="1" aria-label="Knäpp höger">klick ▶</button>':''}</div>${over}</div>
        <div class="ghint">${tr?`Träna skytte · ${g.trPos==='L'?'liggande':g.trPos==='S'?'stående':'växla ligg/stå'} · ${g.trHr==='race'?'hög puls':'lugn puls'}`:`${FMT[g.fmt].name} · ${FMT[g.fmt].desc}`} · Skejta: tryck växelvis vänster–höger (← →). Skytte: dra för att sikta, håll kvar fingret för att hålla andan, tryck AVFYRA (mellanslag). ${g.wind?'Vinden syns på flaggorna – flytta träffläget med knäpparna.':''} ${KIT.resignHTML()}</div>`;
    },
    mounted(){ mount(); if(R&&R.sc&&meA().ph==='range'&&R.sc.phase==='aim') showCtl(true); }
  };
  // peppande omdöme efter träningen – beröm först när det är förtjänat
  function pep(h,n){ const r=h/Math.max(1,n);
    if(r>=1) return 'Fullt! Världsklass – varenda skott satt! 🏆';
    if(r>=.9) return 'Toppklass! Så skjuter de bästa i världscupen. 🎯';
    if(r>=.75) return 'Mycket bra skjutet – nära landslagsnivå!';
    if(r>=.55) return 'Riktigt bra! Lugn andning och mjukt avtryck lönar sig.';
    if(r>=.3) return 'Det lossnar! Vänta tills ringen ligger stilla runt tavlan innan du trycker.';
    return 'Bra kämpat – skytte är svårt i början! Håll kvar fingret för att hålla andan, och tryck när siktet är som lugnast. Det blir bättre för varje serie. 💪'; }
  function targetSvg(l){ const s=v=>(v/1).toFixed(1);
    const dots=l.shots.map(p=>`<circle cx="${s(p.x)}" cy="${s(-p.y)}" r="9" fill="${p.ok?'#22c55e':'#ef4444'}" stroke="#fff" stroke-width="3"/>`).join('');
    return `<svg class="bs-tsvg" viewBox="${-2*SP-120} -130 ${4*SP+240} 260"><rect x="${-2*SP-110}" y="-120" width="${4*SP+220}" height="240" rx="12" fill="#f8fafc"/>${[0,1,2,3,4].map(k=>`<circle cx="${TX(k)}" cy="0" r="${BLACK}" fill="${l.hits[k]?'#e2e8f0':'#0b0b0c'}"/>${l.pos==='L'&&!G.easy?`<circle cx="${TX(k)}" cy="0" r="22.5" fill="none" stroke="${l.hits[k]?'#94a3b8':'#475569'}" stroke-width="2"/>`:''}`).join('')}${dots}</svg>`; }
  function tipFor(l){ const miss=l.shots.filter(p=>!p.ok); if(!miss.length) return 'Fullt – snyggt! 🎯'; const mx=miss.reduce((s,p)=>s+(p.x-TX(p.k>=0?p.k:Math.round(p.x/SP)+2)),0)/miss.length, my=miss.reduce((s,p)=>s+p.y,0)/miss.length;
    if(Math.abs(mx)>25&&Math.abs(mx)>Math.abs(my)) return `Bommarna hamnade mest till ${mx>0?'höger':'vänster'} – prova ${Math.max(1,Math.round(Math.abs(mx)/6))} klick åt ${mx>0?'vänster':'höger'}.`;
    if(Math.abs(my)>25) return `Bommarna gick mest ${my>0?'högt':'lågt'} – avfyra i andningens vändläge och håll andan.`;
    return 'Spridda bommar – vänta tills pulsen lugnat sig lite och håll andan innan du trycker.'; }

  /* ---------- meny ---------- */
  const st=k=>lsGet('bs_'+k);
  let mFmt=st('fmt')||'sprint', mWind=st('wind')!=='0', mEasy=st('easy')==='1', mTv=st('tv')!=='0', mPos=st('pos')||'L', mHr=st('hr')||'race', mLvl=st('lvl')||'medium', mBots=+(st('bots')||1);
  const seg=(k,opts,cur)=>opts.map(([v,l])=>`<button data-bsm="${k}" data-v="${v}" class="${String(cur)===String(v)?'sel':''}">${l}</button>`).join('');
  function menuHTML(){ const tr=mFmt==='tr';
    return `<h3>🎯 Skidskytte – Östersund</h3><p>Nationalarenan på Östberget: ut från stadion, upp för långa backen, platån med utsikt över Storsjön och Frösön, utför genom skogen och in till vallen. Skjut fem skott – varje bom kostar en straffrunda på 150 m.</p>
      <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      <label>Lopp</label><div class="seg" id="bsF">${seg('fmt',[['sprint','🏁 Sprint'],['kort','⏱️ Kort'],['tr','🎯 Träna skytte']],mFmt)}</div>
      ${tr?`<label>Ställning</label><div class="seg">${seg('pos',[['L','Liggande'],['S','Stående'],['V','Växla']],mPos)}</div>
      <label>Puls</label><div class="seg">${seg('hr',[['race','❤️‍🔥 Som i tävling'],['calm','😌 Lugn']],mHr)}</div>`:''}
      <label>Vind</label><div class="seg">${seg('wind',[['1','🌬️ Med vind'],['0','Vindstilla']],mWind?1:0)}</div>
      <label>Skytte</label><div class="seg">${seg('easy',[['0','Som proffsen (45 mm liggande)'],['1','Lättare']],mEasy?1:0)}</div>
      <label>TV-bilder på vallen</label><div class="seg">${seg('tv',[['1','📺 På'],['0','Av']],mTv?1:0)}</div>
      ${tr?'':`<label>Datorspelare och nivå</label><div class="seg">${seg('bots',[[1,'1'],[2,'2'],[3,'3']],mBots)}</div><div class="seg">${seg('lvl',[['easy','🐣 Lätt'],['medium','🙂 Medel'],['hard','🧠 Svår']],mLvl)}</div>`}
      <div class="setnote">${recLine()}</div>
      <div class="btns" style="flex-direction:column">${tr?`<button class="pri" data-bsm="go" data-v="solo">🎯 Börja träna</button>`:`<button class="pri" data-bsm="go" data-v="solo">⏱️ Åk ensam mot klockan</button>
        <button class="pri" data-bsm="go" data-v="ai" style="background:linear-gradient(135deg,#ef4444,#2563eb)">🤖 Tävla mot datorn</button>
        <button class="pri" data-bsm="go" data-v="host" style="background:linear-gradient(135deg,#f472b6,#a855f7)">🚀 Tävla mot kompisar (2–4)</button>`}
        <button data-act="close">Avbryt</button></div>`; }
  function recLine(){ const f=k=>{ try{ return JSON.parse(lsGet(k))||{}; }catch(e){ return {}; } };
    const s=f('bs_best_sprint'), k=f('bs_best_kort'), l=f(`bs_tr_L_race_0`), sS=f(`bs_tr_S_race_0`);
    return `Bästa: sprint ${s.t?fmtT(s.t):'–'} · kort ${k.t?fmtT(k.t):'–'} · träning ligg ${l.hits!=null?l.hits+'/20':'–'} · stå ${sS.hits!=null?sS.hits+'/20':'–'}`; }
  GINFO.skidskytte.menu=()=>openModal(menuHTML(),'bsmenu');
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-bsm]'); if(!b) return; const k=b.dataset.bsm, v=b.dataset.v;
    const keep=()=>{ const nm=document.getElementById('nm'); const val=nm?nm.value:''; openModal(menuHTML(),'bsmenu'); const n2=document.getElementById('nm'); if(n2) n2.value=val; };
    if(k==='fmt'){ mFmt=v; lsSet('bs_fmt',v); sfx.bubble(); keep(); return; }
    if(k==='wind'){ mWind=v==='1'; lsSet('bs_wind',v); sfx.bubble(); keep(); return; }
    if(k==='easy'){ mEasy=v==='1'; lsSet('bs_easy',v); sfx.bubble(); keep(); return; }
    if(k==='tv'){ mTv=v==='1'; lsSet('bs_tv',v); sfx.bubble(); keep(); return; }
    if(k==='pos'){ mPos=v; lsSet('bs_pos',v); sfx.bubble(); keep(); return; }
    if(k==='hr'){ mHr=v; lsSet('bs_hr',v); sfx.bubble(); keep(); return; }
    if(k==='lvl'){ mLvl=v; lsSet('bs_lvl',v); sfx.bubble(); keep(); return; }
    if(k==='bots'){ mBots=+v; lsSet('bs_bots',v); sfx.bubble(); keep(); return; }
    if(k==='go'){ const nm=(document.getElementById('nm')?.value||'').trim(), n=nm||'Du'; lsSet('ry_name',n); unlockAudio();
      pend={fmt:mFmt, wind:mWind, easy:mEasy, tv:mTv, trPos:mPos, trHr:mHr}; fresh=true;
      if(v==='solo'){ KIT.startSolo('skidskytte',n); return; }
      if(v==='ai'){ startGameLocal('skidskytte',n,mLvl,mBots); return; }
      if(v==='host'){ if(!nm){ toast('Skriv ditt namn 🐬'); fresh=false; return; } closeModal(); hostGame(n,'free','skidskytte'); return; } } });
  // rekord när loppet är slut
  const _apply=KIND.skidskytte.apply;
  KIND.skidskytte.apply=function(g,a,seat){ const ok=_apply(g,a,seat); if(ok&&a.type==='finish'&&seat===meSeat2()&&g.fmt!=='tr'){ try{ const key='bs_best_'+g.fmt, B=JSON.parse(lsGet(key))||{}; const t=a.ms/1000; if(!B.t||t<B.t){ lsSet(key,JSON.stringify({t,sh:a.sh,d:Date.now()})); if(B.t) setTimeout(()=>{ toast('🏆 Nytt rekord!',2500); sparkles(30); },500); } }catch(e){} } return ok; };

  const css=document.createElement('style'); css.textContent=`
.bs-wrap{position:relative;margin:0 auto}.bs-host{display:flex;justify-content:center;position:relative;z-index:0}
.bs-glc{position:absolute;left:0;top:0;border-radius:16px;display:none}.bs-cv{position:relative;z-index:1}
.bs-glb{position:absolute;right:8px;top:8px;padding:7px 11px;border-radius:12px;border:1px solid rgba(255,255,255,.35);background:rgba(15,23,42,.6);color:#fff;font-size:12.5px;font-weight:700;z-index:3;touch-action:manipulation}
.rp-on .bs-glb{display:none}
.bs-cv{display:block;border-radius:16px;touch-action:none;-webkit-user-select:none;user-select:none;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.bs-ctl{position:absolute;left:0;right:0;bottom:10px;display:none;justify-content:center;align-items:center;gap:14px;pointer-events:none}
.bs-ctl.on{display:flex}.bs-ctl button{pointer-events:auto;touch-action:manipulation}
.bs-fire{width:96px;height:96px;border-radius:50%;border:3px solid rgba(255,255,255,.75);background:radial-gradient(circle at 40% 35%,#f87171,#b91c1c 70%);color:#fff;font-weight:900;font-size:14px;letter-spacing:.5px;box-shadow:0 6px 18px rgba(0,0,0,.5)}
.bs-fire:active{transform:scale(.95)}
.bs-cl{padding:9px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.35);background:rgba(15,23,42,.7);color:#e2e8f0;font-size:12.5px;font-weight:700}
.bs-over{position:absolute;top:0;right:0;bottom:0;left:0;display:grid;place-items:center;padding:12px;background:rgba(15,23,42,.35);overflow:auto}
.bs-over .gover{max-width:360px;width:100%;background:rgba(11,16,40,.92);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.bs-res>div{display:flex;justify-content:space-between;gap:10px;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.06);margin:4px 0;font-variant-numeric:tabular-nums}
.bs-res>div.win{background:rgba(250,204,21,.2);border:1px solid var(--gold)}
.bs-pb{font-size:12.5px;opacity:.85}.bs-pep{font-size:14px;font-weight:700;margin:4px 0 8px;line-height:1.35}.bs-tsvg{width:100%;max-width:300px;display:block;margin:6px auto}
.bs-log>div:not(svg){display:flex;justify-content:space-between;font-size:13px;padding:2px 4px}.bs-dots{letter-spacing:1px}`;
  document.head.appendChild(css);

  return { net:onNet, __test:(typeof DEV!=='undefined'&&DEV)?{gl:()=>GLB&&GLB.ok()?GLB.stats():{tris:0},wc:()=>WC,wcb:()=>WCb,run:()=>R,step:dt=>step(dt),TL,TP,push,skiStep,idealGap,newRun,fire,meA,wind}:undefined };
})();
