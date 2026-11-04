/* =====================================================================
   slalom.js – Slalom och storslalom i Vemdalsfjällen
   • kameran bakom åkaren (pseudo-3D på canvas med höjdskillnader),
     animeinspirerad stil
   • terräng: branter, rullar, flacker, slingrande skogsdalar, öppna ytor
   • bansättning enligt Svenska Skidförbundets "Nu sätter vi bana!":
     SL: portbredd 4–6 m, 6–13 m mellan vändstänger, hårnålar (2 stängda),
         vertikaler (3–4 stängda), öppna portar först och sist
     SL/GS: kombinationer aldrig i början/slutet, fartkontrollport före,
         varierad rytm och radie, mer sväng i branter, rakare på flacken
     GS: portbredd 4–8 m, 10–27 m mellan portar, långa svängar och rytmbyten
   • ensam, parallellslalom mot datorn eller online mot en kompis
   ===================================================================== */
'use strict';
const SLALOM = (()=>{
  const DISC={
    gs:{name:'Storslalom', gates:22, drag:.0046, turn:1.75, maxHead:1.0, fric:.10, panel:true,  vcap:27},
    sl:{name:'Slalom',     gates:36, drag:.0085, turn:3.2, maxHead:1.1, fric:.07, panel:false, vcap:17.5}
  };
  function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const lerp=(a,b,t)=>a+(b-a)*t, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), smooth=t=>t*t*(3-2*t);

  /* ---------- terrängen: tabeller per meter ---------- */
  let T=null;   // {N, pitch[], y[], mid[], half[], kind[], trees[], crowd[], net[], lift[]}
  function terrain(seed, par, lenNeed){
    const r=rng(seed^0x5eed), N=Math.ceil(lenNeed)+260;
    // sektioner: [typ, längd, lutning, halvbredd, svängighet, trädtäthet, publik, nät]
    const S=[['start',34,.22,par?30:24,0,.3,1,1]];
    let z=34;
    const pick=()=>{ const k=r(); if(k<.2) return 'steep'; if(k<.34) return 'roll'; if(k<.5) return 'flat'; if(k<.78) return 'forest'; return 'open'; };
    let last='start';
    while(z<lenNeed-70){ let t=pick(); if(t===last) t= t==='forest'?'open':'forest'; last=t;
      let L, p, h, cv, tr, cr=0, nt=0;
      if(t==='steep'){ L=60+r()*70; p=.46+r()*.12; h=par?30:26+r()*6; cv=0; tr=.5; cr=r()<.6?1:0; nt=1; }
      else if(t==='roll'){ L=40+r()*30; p=.16; h=par?30:24; cv=0; tr=.4; }
      else if(t==='flat'){ L=50+r()*50; p=.12+r()*.06; h=par?30:22+r()*8; cv=(r()-.5)*.004; tr=.3; }
      else if(t==='forest'){ L=80+r()*90; p=.27+r()*.1; h=par?28:16+r()*5; cv=(r()<.5?-1:1)*(.003+r()*.004); tr=1; }
      else { L=70+r()*60; p=.24+r()*.1; h=par?32:30+r()*10; cv=(r()-.5)*.003; tr=.15; cr=r()<.5?1:0; }
      if(par) cv*=.3;
      S.push([t,L,p,h,cv,tr,cr,nt]); z+=L; }
    S.push(['finish',70,.3,par?32:30,0,.35,1,1]); z+=70;
    S.push(['runout',200,.05,par?36:34,0,.35,1,1]);
    // per meter, med mjuka övergångar (rullar får skarpare krön)
    const pitch=new Float32Array(N), half=new Float32Array(N), cvv=new Float32Array(N), kind=new Array(N), trees=new Float32Array(N), crowd=new Uint8Array(N), net=new Uint8Array(N);
    let i=0, prevP=S[0][2], prevH=S[0][3], prevC=0;
    for(const [t,L,p,h,cv,tr,cr,nt] of S){ const n=Math.round(L), blend= t==='roll'?6:22;
      for(let k=0;k<n&&i<N;k++,i++){ const b=smooth(Math.min(1,k/blend));
        // en rulle: först flackt, sedan ett tydligt krön och brant
        let pp = t==='roll' ? (k<n*.45 ? lerp(prevP,.16,b) : lerp(.16,.55,smooth(Math.min(1,(k-n*.45)/5)))) : lerp(prevP,p,b);
        pitch[i]=pp; half[i]=lerp(prevH,h,b); cvv[i]=lerp(prevC,cv,b); kind[i]=t; trees[i]=tr; crowd[i]=cr; net[i]=nt; }
      prevP= t==='roll'?.55:p; prevH=h; prevC=cv; }
    for(;i<N;i++){ pitch[i]=.05; half[i]=prevH; cvv[i]=0; kind[i]='runout'; trees[i]=.35; crowd[i]=1; net[i]=1; }
    const y=new Float32Array(N), mid=new Float32Array(N); let head=0, x=0;
    for(let k=1;k<N;k++){ y[k]=y[k-1]-pitch[k]; head=clamp(head+cvv[k]*.5,-.2,.2); head*=.996; x+=Math.tan(head); if(Math.abs(x)>22) head-=Math.sign(x)*.003; mid[k]=x; }
    return {N,pitch,y,mid,half,kind,trees,crowd,net};
  }
  const at=(arr,z)=>{ const n=T.N-1; if(z<=0) return arr[0]; if(z>=n) return arr[n]; const i=Math.floor(z), f=z-i; return arr[i]+(arr[i+1]-arr[i])*f; };
  const mid=z=>at(T.mid,z), elev=z=>at(T.y,z), pitchAt=z=>at(T.pitch,z), halfAt=z=>at(T.half,z);

  /* ---------- bansättning ---------- */
  // en port: a,b = stängernas fötter {x,z}; open = vinkelrät mot fallinjen; aim = idealt passage-ställe
  function mkGate(a,b,col,type,aim){ return {a,b,col,type,aim, zmin:Math.min(a.z,b.z), zmax:Math.max(a.z,b.z), pass:null, hit:0}; }
  function setCourse(g){
    const seed=runSeed(g), tseed=g.std?(g.disc==='gs'?7101:7202):g.seeds[0];   // samma backe båda åken, ny sättning i åk 2
    const d=DISC[g.disc], r=rng(seed), par=g.par, nG=par?(g.disc==='gs'?16:24):d.gates;
    const lenGuess = g.disc==='gs' ? nG*23+90 : nG*9.5+110;
    T=terrain(tseed, par, g.disc==='gs'?16*23+90+6*23:36*9.5+110);
    const lanes = par ? [-8.5, 8.5] : [0];
    const out=lanes.map(()=>[]);
    // fallinjen för banan: följer pistens mitt
    const fx=(z,L)=>mid(z)+L;
    if(g.disc==='gs'){
      // GS: öppna portar; rytm via avstånd 14–27 m och sidoförskjutning, "långa svängar" ibland
      let z=30, side=r()<.5?1:-1, col=r()<.5?'r':'b';
      for(let i=0;i<nG;i++){
        const p=pitchAt(z+10), steep=clamp((p-.2)/.35,0,1);
        let dist=lerp(24,21,steep)+(r()-.5)*3, off=lerp(2.8,4.4,steep)+(r()-.5)*1;
        const end = i>=nG-2, beg = i<1;
        if(!end&&!beg&&!par){ const k=r(); if(k<.14){ dist=26+r()*1; off+=1.5; } else if(k<.26){ dist=16+r()*2; off-=.8; } }   // lång sväng / rytmbyte
        if(end) off=3.5;
        z+=clamp(dist,14,27);
        const w=4+r()*4;                                      // portbredd 4–8 m mellan de inre stängerna
        lanes.forEach((L,k)=>{ const s = k===1?-side:side, turn=fx(z,L)+s*off;   // vändstången (inre stången närmast fallinjen)
          const a={x:turn,z}, b={x:turn+s*w,z};
          const gt=mkGate(s>0?a:b, s>0?b:a, par?(k===0?'r':'b'):col, 'gs', {x:turn+s*1.1,z}); gt.turn={x:turn,z}; gt.side=s; out[k].push(gt);
        });
        side=-side; col=col==='r'?'b':'r';
      }
    } else {
      // SL: plan med kombinationer – aldrig bland de första/sista 4 portarna
      const plan=[]; for(let i=0;i<nG;i++) plan.push('o');
      if(!par){
        const put=(type,len)=>{ for(let tries=0;tries<40;tries++){ const i=5+Math.floor(r()*(nG-10-len)); if(plan.slice(i-2,i+len+2).every(x=>x==='o') && (tries>30 || r()<.6)){ for(let k=0;k<len;k++) plan[i+k]=type; return; } } };
        put('v',3+Math.floor(r()*2));                                  // vertikal: 3–4 stängda portar
        const ls=1+Math.floor(r()*2); for(let k=0;k<ls;k++) put('L',1); // långsväng (dubbelkäpp)
        if(r()<.5) put('v',3);
        const hp=2+Math.floor(r()*2); for(let h=0;h<hp;h++) put('h',2);  // hårnålar: 2 stängda portar
      }
      let z=28, side=r()<.5?1:-1, col=r()<.5?'r':'b', i=0;
      let prevTurn=null;
      while(i<nG){
        const p=pitchAt(z+6), steep=clamp((p-.2)/.35,0,1);
        if(plan[i]==='o'||plan[i]==='L'){
          const long=plan[i]==='L';
          // avstånd vändstång–vändstång 6–13 m; mer sidoförskjutning i branter
          let off=lerp(1.7,2.3,steep)+(r()-.5)*.6;
          if(plan[i+1]&&plan[i+1]!=='o') off=lerp(2.8,3.4,steep);         // fartkontroll före kombination
          if(i>=nG-2) off=1.5;
          if(par) off*=.85;                                                  // parallellbanor sätts lite rakare
          let dz=lerp(10,8.8,steep)+(r()-.5)*1.6;                          // nedför mellan vändstängerna
          if(long){ dz=12.2+r()*.6; off+=1.1; }                             // långsväng
          else if(r()<.1 && i>3 && i<nG-4){ dz=11.4; off+=.4; }            // rytmbyte
          const lat = prevTurn ? Math.abs((fx(z+dz,0)+side*off)-prevTurn.x) : off*2;
          if(Math.hypot(dz,lat)>13) dz=Math.sqrt(169-lat*lat);              // vändstång–vändstång högst 13 m
          if(Math.hypot(dz,lat)<6) dz=Math.sqrt(36-Math.min(35,lat*lat));   // och minst 6 m
          z+=dz;
          // enkelkäpp i vanliga portar; dubbelkäpp i första/sista porten och i långsvängar (regel 613.4)
          const dbl = long || i===0 || i>=nG-1, w = dbl ? 4+r()*2 : 14;
          lanes.forEach((L,k)=>{ const s=k===1?-side:side, turn=fx(z,L)+s*off, a={x:turn,z}, b={x:turn+s*w,z};
            const gt=mkGate(s>0?a:b, s>0?b:a, par?(k===0?'r':'b'):col, dbl?'open':'single', {x:turn+s*.75,z}); gt.turn={x:turn,z}; gt.side=s; out[k].push(gt); });
          prevTurn={x:fx(z,0)+side*off,z};
          side=-side; col=col==='r'?'b':'r'; i++;
        } else {
          // stängda portar längs fallinjen: åkaren korsar linjen fram och tillbaka
          const type=plan[i]; let n=0; while(plan[i+n]===type) n++;
          z+=9.5; const L=5.4, gap=type==='h'?1:.9;
          const cx=fx(z,0); let from=prevTurn ? (Math.sign(prevTurn.x-cx)||1) : -side;
          for(let k=0;k<n;k++){ const za=z+k*(L+gap), zb=za+L;
            const gt=mkGate({x:cx,z:za},{x:cx,z:zb},col,'closed',{x:cx,z:(za+zb)/2}); gt.turn={x:cx,z:(za+zb)/2}; gt.from=from; from=-from; out[0].push(gt);
            col=col==='r'?'b':'r'; }
          z+=n*(L+gap)-gap; prevTurn={x:cx,z};
          side = (n%2===0) ? side : -side;     // efter ett udda antal korsningar fortsätter rytmen åt andra hållet
          i+=n;
        }
      }
    }
    // målet: efter sista porten
    const lastZ=Math.max(...out.map(gs=>gs[gs.length-1].zmax));
    const L=lastZ+(g.disc==='gs'?32:22);
    return {d, gates:out, lanes, L};
  }

  // fröet för aktuellt åk: standardbanan är alltid densamma, annars nya frön per parti
  const runSeed=g=> g.std ? (g.disc==='gs'?[51101,51202]:[52101,52202])[(g.run||1)-1] + (g.par?7:0) : g.seeds[(g.run||1)-1];

  /* ---------- åket ---------- */
  let R=null, cv=null, ctx=null, raf=0, lastT=0, W=360, H=640, sendT=0, pend={disc:'gs',par:false,pen:true}, fresh=false;
  const keys={}; let steer=0, drag=null;
  function newRun(){
    const C=setCourse(G), me=meSeat();
    const lane=k=> G.par ? ((G.run||1)===2 ? 1-k : k) : 0;     // i parallell byter man bana till åk 2
    const mkSk=(k,isAIsk)=>({k, lane:lane(k), x: mid(2)+(C.lanes[lane(k)]||0), z:2, v:0, th:0, om:0, t:0, done:false, dsq:false, missed:0, pen:0, gi:0, ai:isAIsk, lean:0, tuck:0, straight:0, plant:0, lastSign:0, trail:[]});
    const sk = G.par ? [mkSk(0,isAI(0)&&mode==='local'), mkSk(1,isAI(1)&&mode==='local')] : [mkSk(0,false)];
    R={gid:G.id+':'+(G.go||0), C, sk, me: G.par?me:0, cd:3.2, started:false, parts:[], shake:0, finishT:0, sent:false, cheer:1.5, beeped:-1, remote:null, split:null};
  }
  const meSk = () => R.sk[R.me];

  /* ---------- fysik ---------- */
  function crossed(g,px,pz,x,z){
    if(g.type==='closed'){ if((px-g.a.x)*(x-g.a.x)>0) return null; const f=(g.a.x-px)/((x-px)||1e-6), zc=pz+(z-pz)*f; return (zc>=g.zmin-.35&&zc<=g.zmax+.35) ? Math.min(Math.abs(zc-g.zmin),Math.abs(zc-g.zmax)) : -1; }
    if(pz>g.zmin||z<g.zmin) return null; const f=(g.zmin-pz)/((z-pz)||1e-6), xc=px+(x-px)*f, lo=Math.min(g.a.x,g.b.x), hi=Math.max(g.a.x,g.b.x);
    return (xc>=lo-.35&&xc<=hi+.35) ? Math.min(Math.abs(xc-lo),Math.abs(xc-hi)) : -1;
  }
  function physics(s,dt,input){
    const d=R.C.d;
    if(s.done){ s.v=Math.max(0,s.v-12*dt); s.th*=Math.pow(.15,dt); s.z+=s.v*Math.cos(s.th)*dt; s.x+=s.v*Math.sin(s.th)*dt; s.lean*=Math.pow(.1,dt); s.tuck=Math.max(0,s.tuck-dt*2); return; }
    const target = input*d.maxHead;
    const om = clamp((target-s.th)*7, -d.turn, d.turn);
    s.th += om*dt; s.om=om;
    // fartställning: i storslalom på raka partier, i båda grenarna mot mål
    s.straight = Math.abs(om)<.25 ? s.straight+dt : 0;
    const wantTuck = (s.straight>.35 && s.v>8 && (d.panel || s.z>R.C.L-45)) ? 1 : 0;
    s.tuck += (wantTuck-s.tuck)*Math.min(1,dt*4);
    const p=pitchAt(s.z), sinP=p/Math.sqrt(1+p*p);
    const upright=(1-s.tuck)*Math.min(1,Math.abs(om)/d.turn);
    const a = 9.81*sinP*Math.cos(s.th) - d.drag*(1-.4*s.tuck+.15*upright)*s.v*s.v - d.fric*Math.abs(om)*s.v - (s.dragExtra||0);
    s.v = Math.max(0, s.v + a*dt);
    if(s.v<1.5) s.v=Math.min(1.5,s.v+dt*2);
    const pz=s.z, px=s.x;
    s.z += s.v*Math.cos(s.th)*dt; s.x += s.v*Math.sin(s.th)*dt; s.t += dt;
    // kantning/inklination följer centripetalkraften (v·ω), med lite tröghet
    const want=clamp(s.v*om/(9.81*.9), -1.25, 1.25);
    s.lean += (want - s.lean)*Math.min(1,dt*9);
    const sg=Math.sign(om); if(sg && sg!==s.lastSign && Math.abs(om)>.5){ s.lastSign=sg; s.plant=1; if(s===meSk()) edgeSfx(s.v); }
    s.plant=Math.max(0,s.plant-dt*3);
    // utanför pisten: djupsnö bromsar, skogen stoppar
    const off=Math.abs(s.x-mid(s.z))-halfAt(s.z);
    if(off>0) s.v*=Math.pow(.45,dt);
    if(off>4){ s.x=mid(s.z)+Math.sign(s.x-mid(s.z))*(halfAt(s.z)+4); s.th*=.4; }
    // portar i tur och ordning
    const gs=R.C.gates[s.lane];
    let g=gs[s.gi];
    while(g){
      const c=crossed(g,px,pz,s.x,s.z);
      if(c!==null && c>=0){ g.pass=true; if(c<.5){ g.hit=1; g.hitT=performance.now(); s.v*=.975; if(s===meSk()) poleSfx(); } s.gi++; }
      else if(c===-1 && g.type!=='closed' || s.z>g.zmax+(g.type==='closed'?1.5:3)){ miss(s,g); s.gi++; }
      else break;
      if(s===meSk() && s.gi===Math.floor(gs.length/2) && !R.split) R.split=s.t;
      g=gs[s.gi];
    }
    if(!s.done && s.z>=R.C.L){ s.done=true; s.finish=s.t+s.pen; if(s===meSk()) finishSfx(); }
    s.trail.push(s.x, s.z); if(s.trail.length>300) s.trail.splice(0,2);
  }
  function miss(s,g){ g.pass=false; s.missed++;
    if(G.pen){ s.pen+=3; if(s===meSk()){ toast('Missad port +3 s',1300); sfx.unbubble(); } }
    else if(!s.dsq){ s.dsq=true; s.done=true; if(s===meSk()){ toast('Ur! Missad port 😬',2200); sfx.unbubble(); } } }

  // datorn: siktar på nästa ports idealpassage och glider mot nästa i tid
  const AILV={easy:{gain:1.5,late:.5,slow:.45,cap:.78}, medium:{gain:1.55,late:.46,slow:.2,cap:.88}, hard:{gain:1.6,late:.43,slow:0,cap:1}};
  function aiInput(s,lv,dt){
    const P=AILV[lv]||AILV.medium, gs=R.C.gates[s.lane], d=R.C.d;
    const g=gs[s.gi]; if(!g) return clamp((mid(s.z+20)-s.x)*.08,-.5,.5);
    let tx=g.aim.x, tz=g.aim.z;
    const nx=gs[s.gi+1], lead=s.v*(P.late+(d.panel?0:.07));
    if(g.type==='closed'){ const dir=Math.sign(g.a.x-s.x)||1; tx=g.a.x+dir*1.6; tz=clamp(s.z+3, g.zmin+.8, g.zmax-.8); }
    else if(nx && g.zmin-s.z < lead){ const f=1-(g.zmin-s.z)/lead; tx=tx+(nx.aim.x-tx)*f*.5; const lo=Math.min(g.a.x,g.b.x), hi=Math.max(g.a.x,g.b.x); tx=clamp(tx,lo+.6,hi-.6); }
    const want=Math.atan2(tx-s.x, Math.max(1.2,tz-s.z));
    s.dragExtra=(s.v>d.vcap*P.cap?2.5:0)+P.slow;
    return clamp(want*P.gain/d.maxHead,-1,1);
  }

  /* ---------- ljud ---------- */
  let snd=null;
  function sndInit(){ if(snd||sfxOff()||!AC) return; try{
      const mk=(sec,type,freq,q)=>{ const s=AC.createBufferSource(); s.buffer=noiseBuf(sec); s.loop=true; const f=AC.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=AC.createGain(); g.gain.value=0; s.connect(f).connect(g).connect(AC.destination); s.start(); return {f,g}; };
      snd={ wind:mk(2,'lowpass',600,.7), carve:mk(1.5,'bandpass',1400,1.4), skid:mk(1.3,'highpass',3200,.5), glide:mk(1.7,'bandpass',420,.8) };
    }catch(e){ snd=null; } }
  function sndUpdate(s){ if(!snd) return; const t=AC.currentTime, v=s.done?0:s.v, om=Math.abs(s.om||0), d=R.C.d;
    const carve=clamp(om*v/22,0,1), skid=clamp((om/d.turn-.55)*2.2,0,1)*clamp(v/10,0,1);
    snd.wind.g.gain.setTargetAtTime(Math.min(.08,v*v*.00011*(1+s.tuck*.6)),t,.15);
    snd.carve.g.gain.setTargetAtTime(carve*.16,t,.05); snd.carve.f.frequency.setTargetAtTime(900+v*45+carve*500,t,.05);
    snd.skid.g.gain.setTargetAtTime(skid*.11,t,.04);
    snd.glide.g.gain.setTargetAtTime(clamp(v/25,0,1)*.035,t,.2); }
  function sndOff(){ if(!snd) return; const t=AC.currentTime; for(const k in snd) snd[k].g.gain.setTargetAtTime(0,t,.1); }
  function burst(sec,type,freq,vol,q=1){ if(sfxOff()||!AC) return; try{ const t=AC.currentTime, s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain();
    s.buffer=noiseBuf(sec); f.type=type; f.frequency.value=freq; f.Q.value=q; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+sec);
    s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t+sec+.05); }catch(e){} }
  function edgeSfx(v){ burst(.16,'bandpass',1800+v*30,Math.min(.14,.04+v*.004),1.2); }        // "schh" i kantbytet
  function poleSfx(){ tone(1300,.05,'square',.05); hit(0,2400,.22,.03); buzz(10); }
  function cheer(vol){ burst(1.3,'bandpass',950,vol,.5); burst(1.1,'bandpass',1900,vol*.5,.7); if(Math.random()<.6) [0,.18,.42].forEach(w=>tone(1180+Math.random()*80,.35,'triangle',vol*.35,w)); }
  function finishSfx(){ [523,659,784,1047].forEach((f,i)=>tone(f,.25,'triangle',.09,i*.1)); cheer(.3); }

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


  /* ---------- projektion med höjd ---------- */
  const HZ=.30, VB=.09, CAMH=2.9, BACK=5.2, ZMAX=200;
  let cam={x:0,z:0,y:0,yaw:0,roll:0,pitch:.3}, F=500, YA=400;
  function P(x,z,h=0){ const dz=z-cam.z; if(dz<.3) return null; const xs=x-cam.x-dz*Math.tan(cam.yaw);
    return [W/2 + xs*F/dz, YA + F*((cam.y-(elev(z)+h))/dz - Math.tan(cam.pitch)), F/dz]; }

  /* ---------- ritning ---------- */
  let BD=null, BDsize='';
  const now=()=>performance.now()/1000;
  function drawScene(dt){
    const s=meSk(), C=R.C;
    const tx=s.x-Math.sin(s.th)*1.8, tz=s.z-BACK;
    cam.x += (tx-cam.x)*Math.min(1,dt*6); cam.z=tz;
    cam.yaw += (s.th*.4-cam.yaw)*Math.min(1,dt*4); cam.roll += (-s.lean*.06-cam.roll)*Math.min(1,dt*5);
    const ahead=Math.atan(pitchAt(s.z+6)); cam.pitch += (ahead-cam.pitch)*Math.min(1,dt*2.2);
    cam.y = elev(cam.z)+CAMH;
    F=Math.min(W,H)*1.05;
    // åkaren alltid på 80 % av höjden
    YA = H*.80 - F*((cam.y-elev(s.z))/BACK - Math.tan(cam.pitch));
    const sh=R.shake>0?(Math.random()-.5)*R.shake*8:0;
    ctx.translate(W/2+sh,H*.6); ctx.rotate(cam.roll); ctx.translate(-W/2,-H*.6);
    // himmel, fjäll och dal: den sanna horisonten flyttar sig med kamerans lutning
    const key=W+'x'+H; if(BDsize!==key){ BD=makeBackdrop(W,H); BDsize=key; }
    const yH = YA - F*Math.tan(cam.pitch), hz=Math.round(H*HZ);
    ctx.fillStyle='#5b8fd6'; ctx.fillRect(-W,-H,W*3,H*3);
    // varannan kopia spegelvänd: kanterna möts alltid, ingen skarv i fjällen
    const bw=BD.width, per=bw*2, top=yH-hz; let x0=-(((cam.x*1.2 + cam.yaw*W*.9)%per+per)%per)-bw*.25;
    for(let k=0;k<4&&x0<W;k++,x0+=bw){ if(x0+bw<0) continue; if(k%2===0) ctx.drawImage(BD,x0,top); else { ctx.save(); ctx.translate(x0+bw,top); ctx.scale(-1,1); ctx.drawImage(BD,0,0); ctx.restore(); } }
    ctx.fillStyle='#dfe8f4'; ctx.fillRect(-W,top+BD.height-1,W*3,H*2);
    // föremål, sorterade bakifrån
    const objs=collect(C,s); let oi=0;
    // marken: remsor bakifrån och fram, föremålen ritas in mellan remsorna (krön skymmer det bakom)
    const zs=[]; for(let dz=ZMAX; dz>.6; dz-=Math.max(.7,dz*.065)) zs.push(cam.z+dz);
    let prev=null;
    for(const z of zs){
      const m=mid(z), hw=halfAt(z), pL=P(m-hw,z), pR=P(m+hw,z), oL=P(m-hw-70,z), oR=P(m+hw+70,z);
      if(!pL) continue;
      if(prev){ const far=Math.min(1,(z-cam.z)/ZMAX), sl=pitchAt(z);
        // terrängen utanför pisten
        const fo=T.trees[Math.round(z)|0]||.3;
        ctx.fillStyle=`rgb(${224-far*12-fo*10},${233-far*9-fo*6},${245-far*4})`; quad(prev.oL,prev.oR,oR,oL);
        // pisten: branter lite skuggigare, flacken ljusare
        const sh2=clamp((sl-.25)*40,-6,10), band=(Math.floor(z/5)%2)*3;
        ctx.fillStyle=`rgb(${246-far*16-sh2-band},${250-far*12-sh2*.7-band},${255-far*6})`; quad(prev.pL,prev.pR,pR,pL);
        if(z>C.L && z<C.L+4){ ctx.fillStyle='rgba(239,68,68,.8)'; quad(prev.pL,prev.pR,pR,pL); }
        // preparerade ränder närmast
        if(z-cam.z<55){ ctx.strokeStyle='rgba(160,180,212,.3)'; ctx.lineWidth=1; ctx.beginPath(); const pm=mid(prev.z), ph=halfAt(prev.z);
          for(let lx=-1+.5;lx<1;lx+=.075){ const a=P(pm+lx*ph,prev.z), b=P(m+lx*hw,z); if(a&&b){ ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); } } ctx.stroke(); }
      }
      while(oi<objs.length && objs[oi].z>=z){ drawObj(objs[oi]); oi++; }
      prev={pL,pR,oL,oR,z};
    }
    while(oi<objs.length){ drawObj(objs[oi]); oi++; }
    // snöstänk
    R.parts=R.parts.filter(p=>(p.t-=dt)>0);
    for(const p of R.parts){ p.x+=p.vx*dt; p.z+=p.vz*dt; p.y+=p.vy*dt; p.vy-=9*dt; const q=P(p.x,p.z,Math.max(0,p.y)); if(!q) continue; ctx.globalAlpha=Math.min(1,p.t*2.2); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(q[0],q[1],Math.max(1,q[2]*.05*p.r),0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    drawSkier(s,null,true);
  }
  function collect(C,s){
    const objs=[], zA=cam.z+.8, zB=cam.z+ZMAX;
    for(let z=Math.ceil(zA/5)*5; z<zB; z+=5){ const zi=Math.round(z), m=mid(z), hw=halfAt(z), r=rng(zi*7+1), dens=T.trees[zi]||.3, cr=T.crowd[zi], nt=T.net[zi];
      for(const sd of [-1,1]){
        if(nt||cr) objs.push({z, t:'fence', x:m+sd*(hw+1.2), sd});
        // skogen: i skogsdalar tätt inpå pisten, på öppna ytor glest och längre bort
        const n=Math.round(dens*4+r()*1.2) - (z-cam.z>120?1:0);
        for(let k=0;k<n;k++){ const dist = dens>.8 ? 2+r()*6+k*5 : 8+r()*30+k*9; objs.push({z:z+r()*5, t:'tree', x:m+sd*(hw+dist), v: r()<(dens>.8?.08:.28)?2:(r()<.5?0:1), s:.8+r()*.7}); }
        if(cr){ for(let k=0;k<3;k++) objs.push({z:z+k*1.6, t:'fan', x:m+sd*(hw+2.4+r()*2.6), v:Math.floor(r()*12), ph:r()*6}); }
        if(nt && zi%45===0) objs.push({z, t:'banner', x:m+sd*(hw+1.25), sd});
      }
      // stollift längs öppna ytor
      if(T.kind[zi]==='open' && zi%40===0) objs.push({z, t:'lift', x:m+hw+22});
    }
    C.gates.forEach((gs,k)=>gs.forEach((g,i)=>{ if(!(g.zmax>zA-1&&g.zmin<zB)) return;
      if(g.type==='closed'){ objs.push({z:g.zmin, t:'gate', g, i, k, pole:'a'}, {z:g.zmax, t:'gate', g, i, k, pole:'b'});
        const me=meSk(); if(k===me.lane && i===me.gi) objs.push({z:(g.zmin+g.zmax)/2-.02, t:'arrow', g}); }
      else objs.push({z:g.zmax, t:'gate', g, i, k}); }));
    // spår från tidigare åkare genom portarnas idealpassager
    C.gates.forEach(gs=>{ for(let i=1;i<gs.length;i++){ const a=gs[i-1].aim, b=gs[i].aim; if(b.z>zA&&a.z<zB) objs.push({z:b.z, t:'rut', a, b}); } });
    // blå färg sprayad i snön: in- och utgång vid varje sväng
    C.gates.forEach(gs=>gs.forEach(g=>{ if(g.type!=='closed'||g.zmax<zA||g.zmin>zB) return; const zm=(g.zmin+g.zmax)/2, f=g.from||1;
      objs.push({z:zm+.01, t:'dye', p:{x:g.a.x+f*2.4,z:zm-2.2}, a:{x:g.a.x,z:zm}, n:{x:g.a.x-f*2.4,z:zm+2.2}}); }));
    C.gates.forEach(gs=>gs.forEach((g,i)=>{ if(g.type==='closed'||g.aim.z<zA||g.aim.z>zB) return; const pv=gs[i-1], nx=gs[i+1];
      const dirTo=(q,len)=>{ if(!q) return null; const dx=q.aim.x-g.aim.x, dz=q.aim.z-g.aim.z, L=Math.hypot(dx,dz)||1; return {x:g.aim.x+dx/L*len, z:g.aim.z+dz/L*len}; };
      objs.push({z:g.aim.z+.01, t:'dye', p:dirTo(pv,3.6), a:{x:g.aim.x+(g.side||0)*.35,z:g.aim.z}, n:dirTo(nx,3)}); }));
    objs.push({z:C.L, t:'finish'});
    R.sk.forEach(o=>{ if(o!==s && o.z>zA) objs.push({z:o.z, t:'skier', sk:o}); });
    objs.sort((a,b)=>b.z-a.z);
    return objs;
  }
  function quad(a,b,c,d){ ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]); ctx.lineTo(d[0],d[1]); ctx.closePath(); ctx.fill(); }
  function drawObj(o){
    const C=R.C, t=now();
    if(o.t==='rut'){ const a=P(o.a.x,o.a.z), b=P(o.b.x,o.b.z); if(!a||!b) return; ctx.strokeStyle='rgba(140,162,196,.32)'; ctx.lineWidth=Math.max(.6,b[2]*.06);
      const mx=(o.a.x+o.b.x)/2+(o.b.x-o.a.x)*.0, mz=(o.a.z+o.b.z)/2, c=P(mx-(o.b.x-o.a.x)*.18,mz); ctx.beginPath(); ctx.moveTo(a[0],a[1]); if(c) ctx.quadraticCurveTo(c[0],c[1],b[0],b[1]); else ctx.lineTo(b[0],b[1]); ctx.stroke(); return; }
    if(o.t==='dye'){ const a=P(o.a.x,o.a.z); if(!a) return; ctx.strokeStyle='rgba(29,78,216,.5)'; ctx.lineCap='round'; const dl=Math.min(a[2],40); ctx.setLineDash([dl*.6,dl*.35]);
      ctx.lineWidth=clamp(a[2]*.16,1,7); ctx.beginPath(); const p=o.p&&P(o.p.x,o.p.z), n=o.n&&P(o.n.x,o.n.z);
      if(p){ ctx.moveTo(p[0],p[1]); ctx.lineTo(a[0],a[1]); } else ctx.moveTo(a[0],a[1]); if(n) ctx.lineTo(n[0],n[1]); ctx.stroke(); ctx.setLineDash([]); return; }
    if(o.t==='tree'){ const p=P(o.x,o.z); if(!p) return; const img=SPR.tree[o.v]; const h=p[2]*8*o.s, w=h*img.width/img.height; if(p[0]+w<0||p[0]-w>W||h<1) return; ctx.drawImage(img,p[0]-w/2,p[1]-h,w,h); return; }
    if(o.t==='fan'){ const p=P(o.x,o.z); if(!p) return; const img=SPR.fan[o.v]; const h=p[2]*1.75, w=h*img.width/img.height; if(h<1.5) return; const near=Math.abs(o.z-meSk().z)<35, jump=Math.max(0,Math.sin(t*6+o.ph))*h*.12*(near?1:.25);
      ctx.drawImage(img,p[0]-w/2,p[1]-h-jump,w,h);
      if(o.v%4===2 && h>8){ ctx.fillStyle=o.v%8===2?'#006aa7':'#e11d48'; const fx=p[0]+w*.45, fy=p[1]-h*1.15-jump; ctx.fillRect(fx,fy,1,h*.5); ctx.beginPath(); ctx.moveTo(fx,fy); ctx.quadraticCurveTo(fx+h*.25,fy+h*.08+Math.sin(t*8+o.ph)*h*.05,fx+h*.42,fy+h*.05); ctx.lineTo(fx+h*.42,fy+h*.25); ctx.quadraticCurveTo(fx+h*.2,fy+h*.3,fx,fy+h*.22); ctx.fill();
        if(o.v%8===2){ ctx.fillStyle='#fecc00'; ctx.fillRect(fx+h*.1,fy+h*.04,h*.06,h*.22); ctx.fillRect(fx,fy+h*.11,h*.42,h*.05); } }
      return; }
    if(o.t==='fence'){ const z2=o.z+5, a=P(o.x,o.z), b=P(mid(z2)+o.sd*(halfAt(z2)+1.2),z2); if(!a||!b) return; const ha=a[2]*1.1, hb=b[2]*1.1;
      ctx.fillStyle='rgba(37,99,235,.55)'; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(b[0],b[1]-hb); ctx.lineTo(a[0],a[1]-ha); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(30,64,175,.8)'; ctx.lineWidth=Math.max(.5,a[2]*.05); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(a[0],a[1]-ha); ctx.stroke(); return; }
    if(o.t==='banner'){ const z2=o.z+4, a=P(o.x,o.z), b=P(mid(z2)+o.sd*(halfAt(z2)+1.25),z2); if(!a||!b) return; const ha=a[2]*.8;
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(a[0],a[1]-a[2]*.15); ctx.lineTo(b[0],b[1]-b[2]*.15); ctx.lineTo(b[0],b[1]-b[2]*.95); ctx.lineTo(a[0],a[1]-a[2]*.95); ctx.closePath(); ctx.fill();
      if(ha>6){ ctx.save(); ctx.fillStyle='#e11d48'; ctx.font=`800 ${Math.max(6,ha*.55)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; const txt=['VEMDALEN','KRYA PÅ DIG 💙','FRÖKNARNA','HEJA! 🐬'][Math.floor(o.z/45)%4];
        ctx.translate((a[0]+b[0])/2,(a[1]+b[1])/2-ha*.55); ctx.fillText(txt,0,0); ctx.restore(); } return; }
    if(o.t==='lift'){ const p=P(o.x,o.z), q=P(o.x,o.z,10.5); if(!p||!q) return; const w=Math.max(1,p[2]*.35);
      ctx.fillStyle='#64748b'; ctx.fillRect(p[0]-w/2,q[1],w,p[1]-q[1]); ctx.fillRect(p[0]-p[2]*1.4,q[1],p[2]*2.8,Math.max(1,p[2]*.25));
      const n=P(o.x,o.z+40,10.5); if(n){ ctx.strokeStyle='rgba(51,65,85,.8)'; ctx.lineWidth=Math.max(.5,p[2]*.04); [-1.2,1.2].forEach(dx=>{ ctx.beginPath(); ctx.moveTo(q[0]+dx*p[2],q[1]); ctx.quadraticCurveTo((q[0]+n[0])/2+dx*(p[2]+n[2])/2,(q[1]+n[1])/2+p[2]*.6,n[0]+dx*n[2],n[1]); ctx.stroke(); });
        const f=((t*.25)%1); const cz=o.z+f*40, c=P(o.x+1.2,cz,9.2); if(c){ ctx.fillStyle='#ef4444'; ctx.fillRect(c[0]-c[2]*.5,c[1],c[2],c[2]*.6); ctx.fillStyle='#334155'; ctx.fillRect(c[0]-.5,c[1]-c[2]*1.1,1,c[2]*1.1); } }
      return; }
    if(o.t==='finish'){ const m=mid(o.z), hw=halfAt(o.z), a=P(m-hw-1,o.z), b=P(m+hw+1,o.z); if(!a) return; const h=a[2]*4.4;
      ctx.fillStyle='#1e3a8a'; ctx.fillRect(a[0]-a[2]*.3,a[1]-h,a[2]*.6,h); ctx.fillRect(b[0]-b[2]*.3,b[1]-h,b[2]*.6,h);
      const g=ctx.createLinearGradient(0,a[1]-h,0,a[1]-h*.7); g.addColorStop(0,'#ef4444'); g.addColorStop(1,'#b91c1c'); ctx.fillStyle=g; ctx.fillRect(a[0],a[1]-h,b[0]-a[0],h*.28);
      if(h>10){ ctx.fillStyle='#fff'; ctx.font=`900 ${h*.18}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('MÅL · VEMDALEN',(a[0]+b[0])/2,a[1]-h*.86); } return; }
    if(o.t==='gate'){ drawGate(o.g,o.i,o.pole); return; }
    if(o.t==='arrow'){ const g=o.g, zm=(g.zmin+g.zmax)/2, f=g.from||1, p0=P(g.a.x+f*1.6,zm), p1=P(g.a.x-f*1.6,zm); if(!p0||!p1) return;   // pil på snön: åt vilket håll man korsar nästa stängda port
      const sz=clamp(p0[2]*.5,3,18), d=Math.sign(p1[0]-p0[0])||-f; ctx.fillStyle=`rgba(250,204,21,${.8+.2*Math.sin(t*6)})`; ctx.strokeStyle='rgba(30,58,138,.85)'; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(p0[0],p0[1]-sz*.38); ctx.lineTo(p1[0]-d*sz,p1[1]-sz*.38); ctx.lineTo(p1[0]-d*sz,p1[1]-sz*.95); ctx.lineTo(p1[0],p1[1]); ctx.lineTo(p1[0]-d*sz,p1[1]+sz*.95); ctx.lineTo(p1[0]-d*sz,p1[1]+sz*.38); ctx.lineTo(p0[0],p0[1]+sz*.38); ctx.closePath(); ctx.fill(); ctx.stroke(); return; }
    if(o.t==='skier'){ drawSkier(o.sk, P(o.sk.x,o.sk.z), false); return; }
  }
  function drawGate(g,i){
    const C=R.C, a=P(g.a.x,g.a.z), b=P(g.b.x,g.b.z), only=arguments[2];
    if(g.type==='closed'){ if(only==='a'&&!a || only==='b'&&!b) return; } else if(!a||!b) return;
    const col = g.col==='r' ? '#ef4444' : '#2563eb', dark = g.col==='r' ? '#991b1b' : '#1e3a8a', t=now();
    const bend = g.hit ? Math.max(0,1-(performance.now()-(g.hitT||0))/600)*.55 : 0;
    const pole=(p,bnd)=>{ const h=p[2]*1.8, pw=Math.max(1,p[2]*.045); ctx.strokeStyle=col; ctx.lineWidth=pw*2; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.quadraticCurveTo(p[0]+bnd*h*.3,p[1]-h*.5,p[0]+bnd*h*.6,p[1]-h*.95); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=pw*.6; ctx.beginPath(); ctx.moveTo(p[0]-pw*.4,p[1]-h*.1); ctx.lineTo(p[0]-pw*.4+bnd*h*.5,p[1]-h*.85); ctx.stroke();
      ctx.fillStyle='rgba(80,110,160,.18)'; ctx.beginPath(); ctx.ellipse(p[0]+p[2]*.4,p[1]+1,p[2]*.35,p[2]*.08,0,0,7); ctx.fill(); };
    if(g.type==='gs'){ // ett stångpar med flagga på var sida om porten
      const wv=Math.sin(t*3+i)*a[2]*.05;
      [[g.a.x-.75,g.a.x],[g.b.x,g.b.x+.75]].forEach(([xa,xb])=>{ const pa=P(xa,g.a.z), pb=P(xb,g.a.z); if(!pa||!pb) return; const h=pa[2]*1.8;
        pole(pa,0); pole(pb,0);
        ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(pa[0],pa[1]-h*.95); ctx.quadraticCurveTo((pa[0]+pb[0])/2,pa[1]-h*.95+wv,pb[0],pb[1]-h*.95); ctx.lineTo(pb[0],pb[1]-h*.5); ctx.quadraticCurveTo((pa[0]+pb[0])/2,pa[1]-h*.5+wv,pa[0],pa[1]-h*.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc((pa[0]+pb[0])/2,pa[1]-h*.72+wv*.5,Math.max(.8,(pb[0]-pa[0])*.22),0,7); ctx.fill();
        ctx.fillStyle=dark; ctx.fillRect(pa[0],pa[1]-h*.52,pb[0]-pa[0],Math.max(.5,h*.02)); });
    } else {
      // slalom: ledade käppar utan flagga; vändstången viker sig vid träff
      const tp=P(g.turn.x,g.turn.z); const away = g.type==='closed' ? (g.aim.x>g.a.x?-1:1) : (g.side||1)*-1;
      if(g.type==='single'){ if(tp) pole(tp, bend*away); }
      else if(g.type==='closed'){ if(only==='b') pole(b,0); else pole(a,bend*(g.aim.x>g.a.x?-1:1)); }
      else { const tA = Math.abs(g.a.x-g.turn.x)<.01; pole(a,tA?bend*away:0); pole(b,!tA?bend*away:0); }
    }
    if(g.pass===false && only!=='b'){ const q=P(g.aim.x,g.aim.z)||a||b; if(!q) return; ctx.fillStyle='rgba(239,68,68,.9)'; ctx.font=`900 ${Math.max(10,q[2]*.9)}px system-ui`; ctx.textAlign='center'; ctx.fillText('✕',q[0],q[1]-q[2]*.6); }
  }

  // åkaren bakifrån – en sammanhängande figur: skidor → bindning → pjäxor → ben → höft → rygg → armar → stavar → hjälm
  const SUITS={ swe:{base:'#0b2e7a', mid:'#1d4ed8', acc:'#facc15', boot:'#f8fafc', bootAcc:'#1d4ed8', helm:'#facc15', helmAcc:'#1d4ed8', ski:'#f8fafc', skiAcc:'#1d4ed8', glove:'#0f172a', bib:'#ffffff', bibTxt:'#0b2e7a'},
                red:{base:'#991b1b', mid:'#dc2626', acc:'#f8fafc', boot:'#111827', bootAcc:'#dc2626', helm:'#f8fafc', helmAcc:'#dc2626', ski:'#111827', skiAcc:'#dc2626', glove:'#111827', bib:'#facc15', bibTxt:'#111827'} };
  function limb(x1,y1,x2,y2,w1,w2,col){ const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L;
    ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x1+nx*w1/2,y1+ny*w1/2); ctx.lineTo(x2+nx*w2/2,y2+ny*w2/2); ctx.lineTo(x2-nx*w2/2,y2-ny*w2/2); ctx.lineTo(x1-nx*w1/2,y1-ny*w1/2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x1,y1,w1/2,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(x2,y2,w2/2,0,7); ctx.fill(); }
  function drawSkier(s, p, me){
    let x,y,sc;
    if(me){ x=W/2+(s.x-cam.x-BACK*Math.tan(cam.yaw))*F/BACK; y=H*.80; sc=F/BACK; }
    else { if(!p) return; [x,y,sc]=p; }
    const u=sc*(me?.0118:.0105), E=clamp(s.lean,-1.2,1.2), tk=s.tuck||0, rel=s.th-cam.yaw, dir=Math.sign(E)||1, inc=E*.6;
    const S = (s.k===0) ? SUITS.swe : SUITS.red;
    const t=performance.now()/1000;
    ctx.save(); ctx.translate(x,y); ctx.scale(u,u);
    // skugga
    ctx.fillStyle='rgba(60,90,140,.22)'; ctx.beginPath(); ctx.ellipse(-E*20,10,62,14,0,0,7); ctx.fill();
    const st=11+Math.abs(E)*2, shiftX=-E*12, tip=Math.sin(rel)*34;
    const feet=[-1,1].map(side=>{ const outer=side!==dir; return {side, outer, x:side*st+shiftX, y: outer?0:-4}; });
    // 1) skidor (spets bort från kameran = uppåt i bild), med kant/sula när de kantas
    feet.forEach(f=>{ ctx.save(); ctx.translate(f.x,f.y);
      const ew=Math.abs(E)*5, sx=-dir*4;
      const tl=-tip*.55;                                      // bakänden pekar åt andra hållet
      if(ew>.6){ ctx.fillStyle='#1e293b'; ctx.beginPath(); ctx.moveTo(tl+sx,34); ctx.lineTo(tl+sx-dir*ew*1.3,34); ctx.lineTo(tip+sx*.4-dir*ew*.4,-58); ctx.lineTo(tip+sx*.4,-58); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(226,232,240,.9)'; ctx.lineWidth=1.1; ctx.beginPath(); ctx.moveTo(tl+sx-dir*ew*1.3,34); ctx.lineTo(tip+sx*.4-dir*ew*.4,-58); ctx.stroke(); }
      ctx.fillStyle=S.ski; ctx.beginPath(); ctx.moveTo(tl-5.5,34); ctx.quadraticCurveTo(tl,36.5,tl+5.5,34); ctx.lineTo(tip+2.2,-56); ctx.quadraticCurveTo(tip,-61,tip-2.2,-56); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(15,23,42,.35)'; ctx.lineWidth=.8; ctx.stroke();
      ctx.fillStyle=S.skiAcc; ctx.beginPath(); ctx.moveTo(tl-1.8,33); ctx.lineTo(tl+1.8,33); ctx.lineTo(tip+.7,-54); ctx.lineTo(tip-.7,-54); ctx.closePath(); ctx.fill();
      // bindning
      ctx.fillStyle='#94a3b8'; ctx.beginPath(); ctx.roundRect(-5.5,4,11,10,2); ctx.fill(); ctx.fillStyle='#475569'; ctx.fillRect(-5.5,12,11,2.5);
      ctx.restore(); });
    // 2) ben: underben från pjäxans skaft till knät, lår till höften – lutade in i svängen
    const crouch=1-tk*.42, shin=32*crouch, thigh=34*crouch;
    const hipC={x:shiftX+Math.sin(inc)*(shin+thigh)*.95, y:-18-(shin+thigh)*Math.cos(inc)*.95};
    const legs=feet.map(f=>{ const top={x:f.x+Math.sin(inc)*14, y:f.y-16};              // pjäxans skaft
      const hp={x:hipC.x+f.side*10, y:hipC.y};
      const kn={x:(top.x+hp.x)/2+dir*3+f.side*tk*6, y:(top.y+hp.y)/2+2-tk*3};
      return {f,top,kn,hp}; });
    // innerbenet (bortre) först, ytterbenet sist
    legs.sort((a,b)=>(a.f.outer?1:0)-(b.f.outer?1:0)).forEach(L=>{
      limb(L.top.x,L.top.y,L.kn.x,L.kn.y,11,12.5,S.base);
      limb(L.kn.x,L.kn.y,L.hp.x,L.hp.y,12.5,16,S.base);
      // sidorand i dräkten
      ctx.strokeStyle=S.acc; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(L.top.x+L.f.side*4.5,L.top.y); ctx.lineTo(L.kn.x+L.f.side*5,L.kn.y); ctx.lineTo(L.hp.x+L.f.side*6.5,L.hp.y); ctx.stroke();
      // pjäxa: sitter på skidan
      const f=L.f; ctx.save(); ctx.translate(f.x,f.y); ctx.rotate(inc*.5);
      ctx.fillStyle=S.boot; ctx.beginPath(); ctx.moveTo(-7,8); ctx.lineTo(7,8); ctx.lineTo(6.5,-17); ctx.quadraticCurveTo(0,-20,-6.5,-17); ctx.closePath(); ctx.fill();
      ctx.fillStyle=S.bootAcc; ctx.fillRect(-7,-4,14,3); ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(-6,-12,12,1.6); ctx.fillRect(-6,1,12,1.6);
      ctx.fillStyle='#1f2937'; ctx.fillRect(-7.5,6,15,3);
      ctx.restore(); });
    // 3) höft och rygg (mer upprätt än benen = vinkling; framåtfälld i fartställning)
    const torso=E*.2, bh=56-tk*30, bw=20+tk*3;
    ctx.save(); ctx.translate(hipC.x,hipC.y); ctx.rotate(torso);
    ctx.fillStyle=S.base; ctx.beginPath(); ctx.ellipse(0,0,bw*.95,9,0,0,7); ctx.fill();          // säte
    const gr=ctx.createLinearGradient(-bw,0,bw,0); gr.addColorStop(0,S.base); gr.addColorStop(.5,S.mid); gr.addColorStop(1,S.base);
    ctx.fillStyle=gr; ctx.beginPath(); ctx.moveTo(-bw*.9,2); ctx.quadraticCurveTo(-bw*1.15,-bh*.55,-bw*.8,-bh); ctx.quadraticCurveTo(0,-bh-4-tk*4,bw*.8,-bh); ctx.quadraticCurveTo(bw*1.15,-bh*.55,bw*.9,2); ctx.closePath(); ctx.fill();
    // gula svep längs sidorna
    ctx.strokeStyle=S.acc; ctx.lineWidth=3; [-1,1].forEach(sd=>{ ctx.beginPath(); ctx.moveTo(sd*bw*.88,0); ctx.quadraticCurveTo(sd*bw*1.08,-bh*.5,sd*bw*.72,-bh*.95); ctx.stroke(); });
    // startnummerväst
    if(bh>30){ ctx.fillStyle=S.bib; ctx.beginPath(); ctx.roundRect(-bw*.55,-bh*.82,bw*1.1,bh*.52,4); ctx.fill();
      ctx.fillStyle=S.bibTxt; ctx.font=`900 ${Math.max(9,bh*.3)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(s.k+1),0,-bh*.56); }
    // 4) armar och stavar
    const sh={y:-bh+6};
    [-1,1].forEach(side=>{ const shX=side*bw*.78;
      let el, hd, tipP;
      if(tk>.5){ el={x:side*(bw-1),y:sh.y+12}; hd={x:side*8,y:sh.y+2}; tipP={x:side*(bw+24),y:sh.y-30}; }   // händerna fram, stavarna under armarna
      else { const plant = side===dir ? s.plant : 0, swing=Math.sin(t*2.2)*1.5;
        el={x:side*(bw+10)-E*4, y:sh.y+20}; hd={x:side*(bw+16)-E*6+swing, y:sh.y+34-plant*6};
        tipP = plant>0 ? {x:hd.x+side*4, y:hd.y-26} : {x:hd.x+side*8, y:hd.y+40}; }
      // stav: handtag i handen, skaft, trissa
      ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=2.6; ctx.beginPath(); ctx.moveTo(hd.x,hd.y); ctx.lineTo(tipP.x,tipP.y); ctx.stroke();
      ctx.strokeStyle='#334155'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.ellipse(tipP.x+(hd.x-tipP.x)*.1,tipP.y+(hd.y-tipP.y)*.1,4.5,1.8,0,0,7); ctx.stroke();
      limb(shX,sh.y,el.x,el.y,10,9,S.base); limb(el.x,el.y,hd.x,hd.y,9,8,S.mid);
      ctx.fillStyle=S.glove; ctx.beginPath(); ctx.arc(hd.x,hd.y,5.5,0,7); ctx.fill();
      ctx.fillStyle='#ef4444'; ctx.fillRect(hd.x-2,hd.y-9,4,6);   // stavhandtag
    });
    // 5) nacke, hjälm och glasögonband
    const hy=-bh-12+tk*8;
    ctx.fillStyle=S.base; ctx.fillRect(-6,hy+6,12,8);
    ctx.fillStyle=S.helm; ctx.beginPath(); ctx.ellipse(0,hy,15.5,16,0,0,7); ctx.fill();
    ctx.fillStyle=S.helmAcc; ctx.beginPath(); ctx.moveTo(-3,hy-16); ctx.lineTo(3,hy-16); ctx.lineTo(4,hy+8); ctx.lineTo(-4,hy+8); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-6,hy-8,5,3.5,-.4,0,7); ctx.fill();
    ctx.fillStyle='#111827'; ctx.fillRect(-15.5,hy+1,31,5.5); ctx.fillStyle=S.acc; ctx.fillRect(-7,hy+1.5,14,4.5);
    ctx.restore(); ctx.restore();
  }
  // liten karta (banan uppifrån) och höjdprofil, ritas en gång per åk och storlek
  function maps(){
    const C=R.C, key=W+'x'+H+':'+R.gid; if(R.mapKey===key) return; R.mapKey=key;
    const L=C.L+10, mw=46, mh=Math.round(Math.min(170,H*.24)), pw=Math.round(W-24), ph=30;
    let xmin=1e9,xmax=-1e9; for(let z=0;z<L;z+=4){ const m=mid(z), h=halfAt(z); xmin=Math.min(xmin,m-h); xmax=Math.max(xmax,m+h); }
    const zs=(mh-8)/L, xs=Math.min((mw-8)/(xmax-xmin), zs*2.2), xc=(xmin+xmax)/2;
    const mx=x=>mw/2+(x-xc)*xs, my=z=>4+z*zs;
    const [mc,m]=off(mw*2,mh*2); m.scale(2,2);
    m.fillStyle='rgba(15,23,42,.55)'; m.beginPath(); m.roundRect(0,0,mw,mh,8); m.fill();
    m.fillStyle='rgba(240,248,255,.9)'; m.beginPath(); for(let z=0;z<=L;z+=3) m.lineTo(mx(mid(z)-halfAt(z)),my(z)); for(let z=L;z>=0;z-=3) m.lineTo(mx(mid(z)+halfAt(z)),my(z)); m.closePath(); m.fill();
    m.fillStyle='rgba(22,101,52,.55)'; for(let z=0;z<L;z+=6){ if((T.trees[z]||0)>.8){ m.fillRect(mx(mid(z)-halfAt(z))-3,my(z),2.5,6*zs+.5); m.fillRect(mx(mid(z)+halfAt(z))+.5,my(z),2.5,6*zs+.5); } }
    C.gates.forEach(gs=>gs.forEach(g=>{ m.fillStyle=g.col==='r'?'#ef4444':'#2563eb'; m.fillRect(mx(g.turn.x)-1,my(g.turn.z)-.8,2,1.6); }));
    m.fillStyle='#ef4444'; m.fillRect(mx(mid(C.L)-halfAt(C.L)),my(C.L)-1,(halfAt(C.L)*2)*xs,2);
    const [pc,q]=off(pw*2,ph*2); q.scale(2,2);
    q.fillStyle='rgba(15,23,42,.55)'; q.beginPath(); q.roundRect(0,0,pw,ph,8); q.fill();
    const y0=T.y[0], y1=at(T.y,L), px=z=>6+z/L*(pw-12), py=y=>5+(y0-y)/(y0-y1)*(ph-10);
    q.beginPath(); q.moveTo(px(0),ph-3); for(let z=0;z<=L;z+=2) q.lineTo(px(z),py(at(T.y,z))); q.lineTo(px(L),ph-3); q.closePath();
    const gg=q.createLinearGradient(0,0,0,ph); gg.addColorStop(0,'rgba(240,248,255,.95)'); gg.addColorStop(1,'rgba(148,180,220,.6)'); q.fillStyle=gg; q.fill();
    // branta partier markeras
    q.strokeStyle='#f97316'; q.lineWidth=2; q.beginPath(); let on=false; for(let z=0;z<=L;z+=2){ const st=at(T.pitch,z)>.42; if(st){ on?q.lineTo(px(z),py(at(T.y,z))):q.moveTo(px(z),py(at(T.y,z))); on=true; } else on=false; } q.stroke();
    q.fillStyle='#ef4444'; q.fillRect(px(C.L)-1,3,2,ph-6);
    R.map={mc,mw,mh,mx,my,pc,pw,ph,px,py};
  }
  function minimap(){
    maps(); const M=R.map, x0=W-M.mw-10, y0=R.sk.length>1?58:12, s=meSk();
    ctx.drawImage(M.mc,x0,y0,M.mw,M.mh);
    R.sk.forEach(o=>{ if(o!==s){ ctx.fillStyle=o.k===0?'#facc15':'#f87171'; ctx.beginPath(); ctx.arc(x0+M.mx(o.x),y0+M.my(Math.min(o.z,R.C.L)),2.6,0,7); ctx.fill(); } });
    ctx.fillStyle='#fff'; ctx.strokeStyle='#0b2e7a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x0+M.mx(s.x),y0+M.my(Math.min(s.z,R.C.L)),3.3,0,7); ctx.fill(); ctx.stroke();
    const px0=12, py0=H-M.ph-8; ctx.drawImage(M.pc,px0,py0,M.pw,M.ph);
    R.sk.forEach(o=>{ const z=Math.min(o.z,R.C.L); ctx.fillStyle=o===s?'#fff':(o.k===0?'#facc15':'#f87171'); ctx.beginPath(); ctx.arc(px0+M.px(z),py0+M.py(elev(z)),o===s?3.6:2.8,0,7); ctx.fill(); if(o===s){ ctx.strokeStyle='#0b2e7a'; ctx.lineWidth=1.5; ctx.stroke(); } });
    ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='700 10px system-ui'; ctx.textAlign='right'; ctx.textBaseline='top'; ctx.fillText(`${Math.round(at(T.pitch,s.z)*100)} %`,px0+M.pw-6,py0+3);
  }
  function hud(){
    minimap();
    const s=meSk(), C=R.C, t=R.started? (s.done? (s.finish??s.t) : s.t+s.pen) : 0, n=C.gates[s.lane].length;
    ctx.fillStyle='rgba(15,23,42,.55)'; ctx.beginPath(); ctx.roundRect(10,10,160,58,14); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='800 26px ui-monospace,monospace'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(fmt(t),20,16);
    ctx.font='600 12px system-ui'; ctx.fillStyle='#cbd5e1'; ctx.fillText(`Port ${Math.min(s.gi,n)}/${n} · ${Math.round(s.v*3.6)} km/h`,20,48);
    const best=bestOf(), half=Math.floor(n/2); if(R.split && s.gi>=half && s.gi<half+5 && best.split){ const d=R.split-best.split; ctx.fillStyle=d<=0?'#22c55e':'#ef4444'; ctx.font='800 20px system-ui'; ctx.fillText((d<=0?'−':'+')+Math.abs(d).toFixed(2),180,22); }
    if(R.sk.length>1){ const o=R.sk[1-R.me], dz=o.z-s.z; ctx.fillStyle='rgba(15,23,42,.55)'; ctx.beginPath(); ctx.roundRect(W-150,10,140,40,12); ctx.fill();
      ctx.fillStyle=o.k===0?'#fda4af':'#93c5fd'; ctx.font='700 13px system-ui'; ctx.textAlign='right'; ctx.fillText(`${bare(pname(o.k))}: ${o.done?(o.dsq?'ur':fmt(o.finish)):(dz>=0?'+':'')+dz.toFixed(0)+' m'}`,W-20,24); }
    const kind=T.kind[Math.round(s.z)|0];
    if(R.started && !s.done && kind==='steep' && (R.steepShown||0)<s.z-200){ R.steepShown=s.z; R.banner={txt:'⚠️ Brant!',t:1.6}; }
    if(R.banner&&R.banner.t>0){ ctx.globalAlpha=Math.min(1,R.banner.t*2); ctx.textAlign='center'; ctx.font='900 30px system-ui'; ctx.fillStyle='#fde047'; ctx.fillText(R.banner.txt,W/2,82); ctx.globalAlpha=1; }
    if(!R.started && R.cd>0){ const n2=Math.ceil(R.cd); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 90px system-ui'; ctx.fillStyle='#fff'; ctx.save(); ctx.shadowColor='#ef4444'; ctx.shadowBlur=25; ctx.fillText(n2>3?'':String(n2),W/2,H*.42); ctx.restore(); }
    else if(R.started && s.t<.8){ ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 72px system-ui'; ctx.fillStyle='#22c55e'; ctx.fillText('KÖR!',W/2,H*.42); }
  }
  const fmt=t=>{ const m=Math.floor(t/60), s=t-m*60; return (m?m+':':'')+(m?String(s.toFixed(2)).padStart(5,'0'):s.toFixed(2)); };
  const bestKey=k=>`sl_best3_${G.disc}${G.par?'p':''}_r${k}`;
  function bestOf(k){ if(!G.std) return {}; try{ return JSON.parse(lsGet(bestKey(k==null?(G.run||1):k)))||{}; }catch(e){ return {}; } }

  /* ---------- slingan ---------- */
  function loop(nowMs){
    raf=0; if(!G||G.kind!=='slalom'||view!=='game'||!cv||!cv.isConnected){ sndOff(); return; }
    raf=requestAnimationFrame(loop);
    const dt=Math.min(.05,(nowMs-(lastT||nowMs))/1000); lastT=nowMs;
    const runId=G.id+':'+(G.go||0); if(!R||R.gid!==runId) newRun();
    const s=meSk();
    let inp=0; if(drag) inp=clamp((drag.x-drag.x0)/(W*.22),-1,1);
    const kx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0); if(kx) steer+=(kx-steer)*Math.min(1,dt*6); else steer*=Math.pow(.02,dt); if(!drag) inp=steer;
    if(!R.started){ R.cd-=dt; const n=Math.ceil(R.cd); if(n!==R.beeped && n>=1 && n<=3){ R.beeped=n; tone(660,.12,'sine',.12); } if(R.cd<=0){ R.started=true; tone(1320,.35,'sine',.13); sndInit(); cheer(.12); } }
    else {
      const lv=G.ai||[];
      for(const sk of R.sk){
        if(sk===s) physics(sk,dt, DEV&&window.__slAuto ? aiInput(sk,'hard',dt) : inp);   // autopilot bara för tester i dev
        else if(sk.ai) physics(sk,dt,aiInput(sk,lv[sk.k],dt));
        else if(R.remote){ const r=R.remote; sk.x+=(r.x-sk.x)*Math.min(1,dt*10); sk.z+=(r.z+(r.v||0)*Math.min(.15,(nowMs-r.at)/1000)-sk.z)*Math.min(1,dt*10); sk.th=r.th; sk.lean=r.l||0; sk.tuck=r.k||0; sk.v=r.v; sk.done=!!r.d; sk.dsq=!!r.q; sk.finish=r.f; sk.gi=r.gi||sk.gi; }
      }
      // snöstänk från ytterskidans kant i svängarna
      if(!s.done && Math.abs(s.om)>.45 && s.v>5){ const n=Math.abs(s.om)>R.C.d.turn*.7?3:1; for(let i=0;i<n;i++) R.parts.push({x:s.x-Math.sign(s.om)*.5+(Math.random()-.5)*.4, z:s.z+.3, y:.05, vx:-Math.sign(s.om)*(2+Math.random()*4)*Math.min(1,s.v/14), vz:s.v*.25, vy:1+Math.random()*2.6, t:.55, r:.7+Math.random()*.8}); }
      if(R.parts.length>180) R.parts.splice(0,R.parts.length-180);
      R.shake=Math.max(0,R.shake-dt*3); if(R.banner) R.banner.t-=dt;
      sndUpdate(s);
      // publiken jublar ibland när man åker förbi
      R.cheer-=dt; const zi=Math.round(s.z)|0; if(R.cheer<=0){ R.cheer=2+Math.random()*4; if(T.crowd[zi] && Math.random()<.65 && !s.done) cheer(.05+Math.random()*.06); }
      if(mode==='online' && nowMs-sendT>66){ sendT=nowMs; send({t:'sl', g:G.id, n:G.go||0, x:+s.x.toFixed(2), z:+s.z.toFixed(2), th:+s.th.toFixed(3), l:+s.lean.toFixed(2), k:+(s.tuck||0).toFixed(2), v:+s.v.toFixed(2), gi:s.gi, d:s.done?1:0, q:s.dsq?1:0, f:s.finish!=null?+s.finish.toFixed(3):null}); }
      if(s.done && !R.sent && (s.v<.5 || s.dsq || performance.now()-(R.finishT||(R.finishT=performance.now()))>1500)){ R.sent=true; sndOff(); finishRun(s); }
      for(const sk of R.sk) if(sk.ai && sk.done && !sk.sentAI){ sk.sentAI=true; applyAndPublish({type:'finish', run:G.run, ms:sk.dsq?null:Math.round(sk.finish*1000)}, sk.k); }
    }
    draw(dt);
  }
  function finishRun(s){
    const ms = s.dsq ? null : Math.round((s.finish)*1000);
    if(ms && G.std){ const B=bestOf(); if(!B.t||ms<B.t){ lsSet(bestKey(G.run),JSON.stringify({...B,t:ms,split:R.split,d:Date.now()})); if(B.t) setTimeout(()=>{ toast(`🏆 Rekord i åk ${G.run}!`,2500); sparkles(24); },400); }
      if(G.run===2){ const r1=G.res[G.par?meSeat():0][0]; if(r1>0){ const tot=r1+ms, B0=bestOf(0); if(!B0.total||tot<B0.total){ lsSet(bestKey(0),JSON.stringify({total:tot,d:Date.now()})); if(B0.total) setTimeout(()=>{ toast('🏆 Nytt rekord totalt!',2600); sparkles(40); },1400); } } } }
    doAct({type:'finish', run:G.run, ms});
  }
  let scaleDpr=1;
  function draw(dt){ ctx.setTransform(scaleDpr,0,0,scaleDpr,0,0); ctx.save(); drawScene(dt); ctx.restore(); hud(); }
  function fit(){ if(!cv) return; const host=cv.parentElement; const r=host.getBoundingClientRect(); const w=Math.round(Math.min(host.clientWidth, 700)), h=Math.round(Math.max(320, Math.min(window.innerHeight - r.top - 10, w*1.9)));
    const dpr=Math.min(2,window.devicePixelRatio||1); cv.style.width=w+'px'; cv.style.height=h+'px'; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); W=w; H=h; BDsize=''; scaleDpr=dpr; }
  window.addEventListener('resize',()=>{ if(G&&G.kind==='slalom'&&view==='game') fit(); });
  function mount(){
    const host=document.getElementById('slHost'); if(!host) return; sprites();
    if(!cv){ cv=document.createElement('canvas'); cv.className='sl-cv'; ctx=cv.getContext('2d');
      cv.addEventListener('pointerdown',e=>{ e.preventDefault(); unlockAudio(); sndInit(); drag={x0:e.clientX, x:e.clientX, id:e.pointerId}; try{ cv.setPointerCapture(e.pointerId); }catch(er){} });
      window.addEventListener('pointermove',e=>{ if(drag&&e.pointerId===drag.id) drag.x=e.clientX; },{passive:true});
      const up=e=>{ if(drag&&e.pointerId===drag.id) drag=null; }; window.addEventListener('pointerup',up); window.addEventListener('pointercancel',up);
      cv.addEventListener('contextmenu',e=>e.preventDefault()); }
    host.appendChild(cv); fit();
    if(!raf){ lastT=0; raf=requestAnimationFrame(loop); }
  }
  document.addEventListener('keydown',e=>{ if(G&&G.kind==='slalom'&&view==='game'&&['ArrowLeft','ArrowRight'].includes(e.code)){ keys[e.code]=true; e.preventDefault(); } });
  document.addEventListener('keyup',e=>{ keys[e.code]=false; });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) sndOff(); });

  /* ---------- nätet ---------- */
  function onNet(m){
    if(!G||G.kind!=='slalom'||m.g!==G.id||!R||(m.n||0)!==(G.go||0)) return;
    if(!['x','z','th','v'].every(k=>Number.isFinite(m[k]))) return;
    R.remote={x:m.x,z:m.z,th:m.th,l:+m.l||0,k:+m.k||0,v:m.v,gi:+m.gi||0,d:m.d,q:m.q,f:Number.isFinite(m.f)?m.f:null,at:performance.now()};
  }

  /* ---------- spelmotorn ---------- */
  GINFO.slalom={name:'Slalom', icon:'⛷️', ai:'Blixt 🤖', max:2, desc:'Storslalom och slalom i Vemdalsfjällen', grad:'linear-gradient(135deg,#60a5fa,#e0f2fe 55%,#ef4444)'};
  // tider: res[spelare] = [åk 1, åk 2] i ms, null = ur; undefined = ej åkt
  const okMs=x=>x===null||(Number.isInteger(x)&&x>3000&&x<900000);
  const total=r=>!r||r.length<2||r.some(x=>x===undefined)?undefined: r.some(x=>x===null)?null: r[0]+r[1];
  const runDone=(g,k)=>g.res.every(r=>r[k]!==undefined && r[k]!==-1);
  KIND.slalom={
    init(){ const base=!fresh&&G&&G.kind==='slalom'?G:null; fresh=false; const o=base?{disc:base.disc,par:base.par,pen:base.pen,std:base.std}:pend;
      return {disc:o.disc, par:o.par, pen:o.pen, std:!!o.std, seeds:[0,0], run:1, res:[], go:0, cur:0}; },
    start(g){ g.seeds=[Math.floor(Math.random()*1e9),Math.floor(Math.random()*1e9)]; g.run=1; g.res=g.names.map(()=>[-1,-1]); g.go=(g.go||0)+1; g.cur=0; if(g.names.length>1) g.par=true; },
    valid(g){ return g.names.length>=1&&g.names.length<=2 && (g.disc==='gs'||g.disc==='sl') && typeof g.par==='boolean' && typeof g.pen==='boolean'
      && Array.isArray(g.seeds)&&g.seeds.length===2&&g.seeds.every(Number.isInteger) && (g.run===1||g.run===2)
      && Array.isArray(g.res) && g.res.every(r=>Array.isArray(r)&&r.length===2&&r.every(x=>x===-1||okMs(x))); },
    waitingFor(){ return -1; },
    scoreOf(g,i){ const r=g.res&&g.res[i]; if(!r) return ''; const f=x=>x===-1?'–':x===null?'ur':fmt(x/1000); return g.run===1? f(r[0]) : `${f(r[0])} + ${f(r[1])}`; },
    apply(g,a,seat){
      const k=(g.run||1)-1;
      if(a.type==='resign'){ if(g.over) return false; g.res[seat]=[g.res[seat][0]===-1?null:g.res[seat][0], null]; }
      else if(a.type==='finish'){ if(g.over||g.res[seat][k]!==-1||(a.run&&a.run!==g.run)||!okMs(a.ms)) return false; g.res[seat][k]=a.ms; g.last={t:Date.now(),seat,ms:a.ms,run:g.run}; }
      else if(a.type==='next'){ if(g.over||g.run!==1||!runDone(g,0)) return false; g.run=2; g.go=(g.go||0)+1; g.last={t:Date.now(),type:'next'}; return true; }
      else return false;
      if(g.res.every(r=>r[0]!==-1&&r[1]!==-1)){
        g.over=true; const t=g.res.map(r=>{ const v=total(r); return v==null?Infinity:v; }); const mn=Math.min(...t);
        g.winner = g.names.length===1 ? (mn<Infinity?0:-2) : mn===Infinity ? -1 : t.filter(x=>x===mn).length>1 ? -1 : t.indexOf(mn); }
      return true; },
    aiSeat(){ return null; },
    effects(prev,d){ if(d.last&&(!prev.last||prev.last.t!==d.last.t)&&d.last.seat!=null&&d.last.seat!==meSeat()&&d.names.length>1) toast(`${bare(pname(d.last.seat))} i mål: ${d.last.ms===null?'ur 😬':fmt(d.last.ms/1000)}`,2000); },
    html(){
      const g=G, me=meSeat(), f=x=>x===-1||x===undefined?'–':x===null?'ur':fmt(x/1000);
      let over='';
      const table=()=>g.names.map((n,i)=>{ const r=g.res[i]; return `<div class="sl-res ${g.over&&g.winner===i?'win':''}"><b>${esc(bare(n))}</b><span>${f(r[0])}${g.run===2||g.over?` · ${f(r[1])}`:''}${g.over?` = <b>${f(total(r))}</b>`:''}</span></div>`; }).join('');
      if(g.over){ const solo=g.names.length===1, tt=total(g.res[0]);
        const B=bestOf(0);
        over=`<div class="sl-over"><div class="gover ${solo?(tt!=null?'won':'lost'):g.winner===me?'won':g.winner===-1?'tie':'lost'}"><div class="gi">${solo?(tt!=null?'⛷️':'😬'):g.winner===me?'🏆':g.winner===-1?'🤝':'🎿'}</div>
          <h3>${solo?(tt!=null?'Båda åken klara!':'Ur!'):g.winner===me?'Du vann!':g.winner===-1?'Oavgjort':esc(bare(pname(g.winner)))+' vann'}</h3><p class="sl-pb">Åk 1 · åk 2 = totalt</p>${table()}
          ${g.std&&B.total?`<p class="sl-pb">Ditt rekord på standardbanan: <b>${fmt(B.total/1000)}</b></p>`:''}
          <div class="gbtns"><button class="pri" data-g="rematch">🔄 Ny tävling</button><button data-act="lobby">🏠 Lobby</button></div></div></div>`; }
      else if(g.run===1 && runDone(g,0)){ const can = mode!=='online' || role==='host';
        over=`<div class="sl-over"><div class="gover tie"><div class="gi">⏱️</div><h3>Åk 1 klart</h3>${table()}
          <p class="sl-pb">Åk 2 har en ny bansättning${g.par?' och ni byter bana':''}.</p>
          <div class="gbtns">${can?`<button class="pri" data-sl="next">▶️ Starta åk 2</button>`:'<p>Väntar på att värden startar åk 2…</p>'}</div></div></div>`; }
      return `<div class="sl-wrap"><div id="slHost" class="sl-host"></div>${over}</div>
        <div class="ghint">${DISC[g.disc].name}${g.par?' · parallell':''} · ${g.std?'standardbana':'ny bana'} · åk ${g.run} av 2 · Dra fingret åt sidan (eller ← →) för att svänga, släpp för att åka rakt – då går du ned i fartställning. ${g.pen?'Missad port +3 s.':'Missad port = ur.'} ${g.over?'':KIT.resignHTML()}</div>`; },
    mounted(){ mount(); }
  };

  /* ---------- meny ---------- */
  let mDisc=lsGet('sl_disc')||'gs', mPen=lsGet('sl_pen')!=='0';
  const segD=()=>Object.entries(DISC).map(([k,d])=>`<button data-sl="disc" data-v="${k}" class="${mDisc===k?'sel':''}">${k==='gs'?'🚩':'🎌'} ${d.name}</button>`).join('');
  const segP=()=>`<button data-sl="pen" data-v="1" class="${mPen?'sel':''}">+3 s straff</button><button data-sl="pen" data-v="0" class="${!mPen?'sel':''}">Riktiga regler: ur</button>`;
  let mStd=lsGet('sl_std')!=='0';
  const segS=()=>`<button data-sl="std" data-v="1" class="${mStd?'sel':''}">📌 Standardsättning</button><button data-sl="std" data-v="0" class="${!mStd?'sel':''}">🎲 Helt ny bana</button>`;
  const lvlName={easy:'🐣 Lätt',medium:'🙂 Medel',hard:'🧠 Svår'};
  let mLvl=lsGet('sl_lvl')||'medium';
  const segL=()=>Object.entries(lvlName).map(([k,l])=>`<button data-sl="lvl" data-v="${k}" class="${mLvl===k?'sel':''}">${l}</button>`).join('');
  function bestLine(){ const f=k=>{ try{ const b=JSON.parse(lsGet(k)); return b&&b.total?fmt(b.total/1000):'–'; }catch(e){ return '–'; } }; return `Rekord på standardbanan (två åk): storslalom ${f('sl_best3_gs_r0')} · slalom ${f('sl_best3_sl_r0')}`; }
  GINFO.slalom.menu=function(){
    openModal(`<h3>⛷️ Slalom i Vemdalsfjällen</h3><p>Två åk med olika bansättning – lägst sammanlagd tid vinner. Dra fingret åt sidan för att svänga; släpp och åk rakt så går du ned i fartställning.</p>
      <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      <label>Gren</label><div class="seg" id="slD">${segD()}</div>
      <label>Bana</label><div class="seg" id="slS">${segS()}</div>
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
    if(a==='std'){ mStd=b.dataset.v==='1'; lsSet('sl_std',mStd?'1':'0'); document.getElementById('slS').innerHTML=segS(); sfx.bubble(); return; }
    if(a==='next'){ unlockAudio(); doAct({type:'next'}); return; }
    if(a==='lvl'){ mLvl=b.dataset.v; lsSet('sl_lvl',mLvl); document.getElementById('slL').innerHTML=segL(); sfx.bubble(); return; }
    const n=nm||'Du'; lsSet('ry_name',n); unlockAudio();
    if(a==='solo'){ pend={disc:mDisc,par:false,pen:mPen,std:mStd}; fresh=true; KIT.startSolo('slalom',n); return; }
    if(a==='ai'){ pend={disc:mDisc,par:true,pen:mPen,std:mStd}; fresh=true; startGameLocal('slalom',n,mLvl,1); return; }
    if(a==='host'){ if(!nm){ toast('Skriv ditt namn 🐬'); return; } pend={disc:mDisc,par:true,pen:mPen,std:mStd}; fresh=true; closeModal(); hostGame(n,'free','slalom'); return; } });

  const st=document.createElement('style'); st.textContent=`
.sl-wrap{position:relative;margin:0 auto}
.sl-host{display:flex;justify-content:center}
.sl-cv{display:block;border-radius:16px;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.sl-over{position:absolute;inset:0;display:grid;place-items:center;padding:14px;background:rgba(15,23,42,.25)}
.sl-over .gover{max-width:330px;width:100%;background:rgba(11,16,40,.9);backdrop-filter:blur(6px)}
.sl-res{display:flex;justify-content:space-between;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.06);margin:4px 0;font-variant-numeric:tabular-nums}
.sl-res.win{background:rgba(250,204,21,.2);border:1px solid var(--gold)}
.sl-pb{font-size:13px;opacity:.85}`; document.head.appendChild(st);

  return { net:onNet, __test:(typeof DEV!=='undefined'&&DEV)?{setCourse,physics,aiInput,DISC,run:()=>R,newRun,mid,AILV,terrain:()=>T}:undefined };
})();
