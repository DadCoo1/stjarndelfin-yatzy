/* =====================================================================
   kina.js – Kinaschack (2–6 spelare)
   Stjärnbräde med 121 hål. Varje spelare börjar med 10 kulor i ett hörn
   och ska flytta alla till hörnet mitt emot. Man flyttar ett steg till ett
   tomt grannhål, eller hoppar över en kula (vilken som helst) till ett
   tomt hål bakom – flera hopp i rad är tillåtet. Man får hoppa genom
   andras hörn men inte stanna där.
   ===================================================================== */
'use strict';
(function(){
  /* ---------- brädets geometri (kubkoordinater x+y+z=0) ---------- */
  const DIRS=[[1,-1,0],[1,0,-1],[0,1,-1],[-1,1,0],[-1,0,1],[0,-1,1]];
  const HOLES=[]; const AT=new Map();
  for(let x=-8;x<=8;x++) for(let y=-8;y<=8;y++){ const z=-x-y; if(z<-8||z>8) continue;
    const ax=Math.abs(x), ay=Math.abs(y), az=Math.abs(z);
    const inHex = ax<=4 && ay<=4 && az<=4;
    const inTri = (ax>=5 && ay<=4 && az<=4) || (ay>=5 && ax<=4 && az<=4) || (az>=5 && ax<=4 && ay<=4);
    if(inHex||inTri){ AT.set(x+','+y+','+z, HOLES.length); HOLES.push({x,y,z}); } }
  const HN=HOLES.length;                                   // 121
  const idx=(x,y,z)=>AT.has(x+','+y+','+z) ? AT.get(x+','+y+','+z) : -1;
  const NB=HOLES.map(h=>DIRS.map(([dx,dy,dz])=>idx(h.x+dx,h.y+dy,h.z+dz)));
  const JMP=HOLES.map(h=>DIRS.map(([dx,dy,dz])=>[idx(h.x+dx,h.y+dy,h.z+dz), idx(h.x+2*dx,h.y+2*dy,h.z+2*dz)]));
  // pixelposition (spetsig hexagon, y nedåt)
  const PX=HOLES.map(h=>({px:(h.x-h.y)*0.5, py:h.z*Math.sqrt(3)/2}));
  // de sex hörnen, ordnade medurs med start längst ner
  const TRI_DEF=[['x',1],['x',-1],['y',1],['y',-1],['z',1],['z',-1]];
  const triOf = h => { for(let t=0;t<6;t++){ const [k,s]=TRI_DEF[t]; if(h[k]*s>=5) return t; } return -1; };
  const triCenters=TRI_DEF.map((_,t)=>{ let sx=0,sy=0,n=0; HOLES.forEach((h,i)=>{ if(triOf(h)===t){ sx+=PX[i].px; sy+=PX[i].py; n++; } }); return {x:sx/n,y:sy/n,a:Math.atan2(sy/n,sx/n)}; });
  // medurs (skärmkoordinater) från "nederst" (vinkel +90°)
  const ORDER=[0,1,2,3,4,5].sort((a,b)=>{ const f=t=>((triCenters[t].a - Math.PI/2)+4*Math.PI)%(2*Math.PI); return f(a)-f(b); });
  const CORNER=HOLES.map(h=>{ const t=triOf(h); return t<0?-1:ORDER.indexOf(t); });       // hörn 0–5 (medurs), -1 = mitten
  const CORNER_HOLES=[0,1,2,3,4,5].map(c=>{ const a=[]; for(let i=0;i<HN;i++) if(CORNER[i]===c) a.push(i); return a; });
  const APEX=CORNER_HOLES.map(hs=>hs.reduce((best,i)=>{ const h=HOLES[i]; const m=Math.max(Math.abs(h.x),Math.abs(h.y),Math.abs(h.z)); return m>best.m?{i,m}:best; },{i:-1,m:-1}).i);
  const hexDist=(a,b)=>{ const A=HOLES[a], B=HOLES[b]; return Math.max(Math.abs(A.x-B.x),Math.abs(A.y-B.y),Math.abs(A.z-B.z)); };
  const CORNERS_FOR={2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5]};
  const COLORS=[['#3b82f6','#93c5fd','Blå'],['#ef4444','#fca5a5','Röd'],['#22c55e','#86efac','Grön'],['#facc15','#fef08a','Gul'],['#a855f7','#d8b4fe','Lila'],['#f97316','#fdba74','Orange']];
  const BOTS=['Blixt 🤖','Pixel 🤖','Nova 🤖','Robban 🤖','Komet 🤖'];
  const target = (g,s) => (g.corners[s]+3)%6;

  /* ---------- regler ---------- */
  function canStop(g, seat, i){ const c=CORNER[i]; return c<0 || c===g.corners[seat] || c===target(g,seat); }
  // alla mål en kula kan nå: {dest: path}
  function reach(g, seat, from){
    const b=g.board, out=new Map();
    for(const n of NB[from]) if(n>=0 && b[n]<0 && canStop(g,seat,n)) out.set(n,[from,n]);
    const seen=new Set([from]); const q=[[from,[from]]];
    while(q.length){ const [at,path]=q.shift();
      for(const [over,land] of JMP[at]){ if(over<0||land<0||b[over]<0||b[land]>=0||seen.has(land)) continue;
        seen.add(land); const p=[...path,land]; q.push([land,p]); if(canStop(g,seat,land) && !out.has(land)) out.set(land,p); } }
    return out;
  }
  function allMoves(g, seat){ const m=[]; for(let i=0;i<HN;i++) if(g.board[i]===seat) for(const [to,path] of reach(g,seat,i)) m.push({from:i,to,path}); return m; }
  function validPath(g, seat, path){
    if(!Array.isArray(path) || path.length<2 || path.length>40 || !path.every(i=>Number.isInteger(i)&&i>=0&&i<HN)) return false;
    if(g.board[path[0]]!==seat || new Set(path).size!==path.length) return false;
    const to=path[path.length-1]; if(g.board[to]>=0 || !canStop(g,seat,to)) return false;
    if(path.length===2 && NB[path[0]].includes(to)) return true;
    for(let k=0;k<path.length-1;k++){ const a=path[k], c=path[k+1]; const j=JMP[a].find(([o,l])=>l===c); if(!j || g.board[j[0]]<0 || g.board[c]>=0) return false; }
    return true;
  }
  const inTarget=(g,s)=>CORNER_HOLES[target(g,s)].filter(i=>g.board[i]===s).length;
  function hasWon(g,s){ const T=CORNER_HOLES[target(g,s)]; return T.every(i=>g.board[i]>=0) && T.some(i=>g.board[i]===s); }   // motståndares kulor kan inte blockera en vinst
  function nextTurn(g){
    const n=g.names.length;
    for(let k=1;k<=n;k++){ const s=(g.cur+k)%n; if(allMoves(g,s).length){ g.cur=s; return; } }
    g.over=true; g.winner=-1;
  }

  /* ---------- datorspelaren ---------- */
  function aiMove(g, seat){
    const moves=allMoves(g,seat); if(!moves.length) return null;
    const apex=APEX[target(g,seat)], T=new Set(CORNER_HOLES[target(g,seat)]);
    const mine=[]; for(let i=0;i<HN;i++) if(g.board[i]===seat) mine.push(i);
    const worst=Math.max(...mine.map(i=>hexDist(i,apex)));
    const hard=g.ai[seat]==='hard', last=(g.hist||{})[seat];
    const evalMove=(m, board)=>{
      const d0=hexDist(m.from,apex), d1=hexDist(m.to,apex);
      let s=(d0-d1)*1.0;
      if(T.has(m.to) && !T.has(m.from)) s+=1.5;               // in i målet
      if(T.has(m.from) && !T.has(m.to)) s-=4;                  // ut ur målet: nej tack
      if(d0===worst) s+=0.35*(d0-d1);                          // hjälp eftersläntrare
      if(last && m.from===last.to && m.to===last.from) s-=3;   // inte fram och tillbaka
      return s;
    };
    let scored=moves.map(m=>({m, s:evalMove(m)}));
    if(hard){
      // titta ett eget drag framåt: vad öppnar draget för nästa gång?
      for(const o of scored){ if(o.s<-1) continue;
        const b=g.board; b[o.m.to]=seat; b[o.m.from]=-1;
        let best=0; for(const m2 of allMoves(g,seat)){ const v=evalMove(m2); if(v>best) best=v; }
        b[o.m.from]=seat; b[o.m.to]=-1; o.s+=0.55*best; }
    } else {
      scored.forEach(o=>o.s+=Math.random()*1.6);
      if(Math.random()<0.15){ const ok=scored.filter(o=>o.s>0.5); if(ok.length) return {type:'move', path:ok[rint(ok.length)].m.path}; }
    }
    scored.sort((a,b)=>b.s-a.s);
    return {type:'move', path:scored[0].m.path};
  }

  /* ---------- spelet i motorn ---------- */
  GINFO.kina={name:'Kinaschack', icon:'⭐', ai:BOTS[0], bots:BOTS, max:6, grad:'linear-gradient(135deg,#f43f5e,#f59e0b 50%,#22c55e)'};
  KIND.kina={
    init(){ return {board:new Array(HN).fill(-1), corners:[], hist:{}, moves:0}; },
    start(g){
      const n=g.names.length; g.corners=CORNERS_FOR[Math.max(2,Math.min(6,n))].slice(0,n);
      g.board=new Array(HN).fill(-1); g.corners.forEach((c,s)=>CORNER_HOLES[c].forEach(i=>g.board[i]=s));
      g.hist={}; g.moves=0; g.cur=g.starter%n; g.last=null;
    },
    valid(g){ const n=g.names.length, waiting=g.started===false;      // i väntrummet finns inga hörn än
      return n>=1 && n<=6 && (waiting || n>=2) && Array.isArray(g.board) && g.board.length===HN && g.board.every(v=>Number.isInteger(v)&&v>=-1&&v<6)
      && Array.isArray(g.corners) && (waiting ? g.corners.length<=6 : g.corners.length===n) && g.corners.every(c=>isI(c,0,5)) && isI(g.cur,0,Math.max(0,n-1))
      && (g.last==null || (typeof g.last==='object' && Array.isArray(g.last.path) && g.last.path.length<=40 && g.last.path.every(i=>isI(i,0,HN-1)))); },
    waitingFor(g){ return g.cur; },
    scoreOf(g,i){ return `${inTarget(g,i)}/10 i mål`; },
    apply(g,a,seat){
      if(g.over || seat!==g.cur) return false;
      if(a.type==='pass'){ if(allMoves(g,seat).length) return false; g.last={seat, pass:true, t:Date.now()}; nextTurn(g); return true; }
      if(a.type!=='move' || !validPath(g,seat,a.path)) return false;
      const from=a.path[0], to=a.path[a.path.length-1];
      g.board[to]=seat; g.board[from]=-1; g.moves++;
      g.hist=g.hist||{}; g.hist[seat]={from,to};
      g.last={seat, path:a.path.slice(), t:Date.now()};
      if(hasWon(g,seat)){ g.over=true; g.winner=seat; return true; }
      if(g.moves>220*g.names.length){ g.over=true; const sc=g.names.map((_,s)=>inTarget(g,s)), mx=Math.max(...sc); g.winner=sc.filter(v=>v===mx).length>1?-1:sc.indexOf(mx); return true; }
      nextTurn(g); return true;
    },
    aiSeat(g){ return !g.over && isAI(g.cur) ? g.cur : null; },
    aiDelay(g){ return 650 + rint(500); },
    ai(g,seat){ return aiMove(g,seat) || {type:'pass'}; },
    effects(prev,d){ if(d.last && (!prev.last || prev.last.t!==d.last.t) && d.last.path){ const jumps=d.last.path.length>2 || !NB[d.last.path[0]].includes(d.last.path[1]); jumps ? tone(660,.07,'sine',.06) : sfx.bubble(); } },
    html(){ return kinaHTML(); },
    mounted(){ kinaAnimate(); }
  };

  /* ---------- utseende ---------- */
  let sel=null, animT=null;
  const R=0.42;
  function kinaHTML(){
    const g=G, me=meSeat(), myTurn=canActG(me) && g.cur===me;
    const mySeatForView = (mode==='online') ? (mySeat ?? 0) : (g.ai ? Math.max(0,g.ai.findIndex(a=>!a)) : 0);
    // rotera så att mitt hörn är längst ner
    const rot = -60*g.corners[mySeatForView];
    if(!myTurn) sel=null;
    if(sel!==null && g.board[sel]!==me) sel=null;
    const dests = sel!==null ? reach(g,me,sel) : new Map();
    const xs=PX.map(p=>p.px), ys=PX.map(p=>p.py), pad=1.0;
    const minX=Math.min(...xs)-pad, maxX=Math.max(...xs)+pad, minY=Math.min(...ys)-pad, maxY=Math.max(...ys)+pad;
    const anim = g.last && g.last.path && g.last.t!==animT;
    // hörnens färgade bakgrund
    let tri=''; g.corners.forEach((c,s)=>{ const col=COLORS[s][0];
      [c, (c+3)%6].forEach((cc,k)=>{ const pts=CORNER_HOLES[cc].map(i=>PX[i]); const hull=triHull(pts);
        tri+=`<polygon points="${hull}" fill="${col}" fill-opacity="${k?0.10:0.22}" stroke="${col}" stroke-opacity="${k?0.55:0.35}" stroke-width="0.06" ${k?'stroke-dasharray="0.25 0.18"':''}/>`; }); });
    let holes='', marbles='';
    for(let i=0;i<HN;i++){ const p=PX[i], v=g.board[i];
      const d=dests.has(i);
      holes+=`<circle class="kh ${d?'dest':''}" cx="${p.px}" cy="${p.py}" r="${d?0.30:0.18}" data-k="hole" data-i="${i}"/>`;
      if(v>=0){
        const land = anim && i===g.last.path[g.last.path.length-1];
        marbles+=`<circle class="km ${v===me&&myTurn?'mine':''} ${sel===i?'sel':''} ${land?'land':''}" cx="${p.px}" cy="${p.py}" r="${R}" fill="url(#kg${v})" data-k="m" data-i="${i}"/>`;
      }
    }
    let trail='';
    if(g.last && g.last.path){ const pts=g.last.path.map(i=>`${PX[i].px},${PX[i].py}`).join(' ');
      trail=`<polyline points="${pts}" class="ktrail" stroke="${COLORS[g.last.seat][1]}"/><circle cx="${PX[g.last.path[0]].px}" cy="${PX[g.last.path[0]].py}" r="0.2" class="kfrom" stroke="${COLORS[g.last.seat][1]}"/>`; }
    const defs=COLORS.map((c,s)=>`<radialGradient id="kg${s}" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".25" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[0]}"/></radialGradient>`).join('');
    const svg=`<svg class="kboard" viewBox="${minX} ${minY} ${maxX-minX} ${maxY-minY}"><defs>${defs}</defs><g transform="rotate(${rot})">${tri}${holes}${trail}${marbles}<circle id="kAnim" r="${R}" cx="0" cy="0" style="display:none"/></g></svg>`;
    const noMoves = myTurn && !allMoves(g,me).length;
    let sub;
    if(g.over) sub='';
    else if(myTurn) sub = noMoves ? 'Du kan inte flytta någon kula – stå över denna gång' : sel!==null ? (dests.size?'Tryck på ett lysande hål':'Den kulan kan inte flytta – välj en annan') : 'Din tur – välj en av dina kulor';
    else sub=`${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> funderar…`;
    const legend=g.names.map((n,s)=>`<span class="kleg ${g.cur===s&&!g.over?'on':''}"><i style="background:${COLORS[s][0]}"></i>${esc(bare(n))} ${inTarget(g,s)}/10</span>`).join('');
    return kinaHead() + `<div class="gsub">${sub}</div><div class="kwrap">${svg}</div>
      ${noMoves?'<div class="gbtns"><button class="pri" data-g="kpass">Stå över ⏭️</button></div>':''}
      ${g.over?gOverHTML(g.winner===-1?'Ingen hann ända fram.':`${esc(pname(g.winner))} flyttade alla kulor till målet ⭐`):''}
      <div class="ghint">Steg till ett grannhål, eller hoppa över kulor – flera hopp i rad går bra. Du får hoppa genom andras hörn men inte stanna där.</div>`;
  }
  function kinaHead(){
    const g=G, me=meSeat();
    return `<div class="khead">${g.names.map((n,s)=>`<div class="gp ${!g.over&&g.cur===s?'on':''} ${g.over&&g.winner===s?'win':''}"><span><i class="kdot" style="background:${COLORS[s][0]}"></i>${g.over&&g.winner===s?'👑 ':''}${esc(bare(n))}${isAI(s)?' 🤖':''}${mode==='online'&&s===mySeat?' <em>du</em>':''}</span><b>${inTarget(g,s)}/10 i mål</b></div>`).join('')}</div>`;
  }
  // tre hörnpunkter för triangelns bakgrund
  function triHull(pts){ const cx=pts.reduce((a,p)=>a+p.px,0)/pts.length, cy=pts.reduce((a,p)=>a+p.py,0)/pts.length;
    const far=pts.map(p=>({p,d:Math.hypot(p.px-cx,p.py-cy),a:Math.atan2(p.py-cy,p.px-cx)})).sort((a,b)=>b.d-a.d).slice(0,3).sort((a,b)=>a.a-b.a);
    return far.map(({p})=>{ const k=1+0.55/Math.hypot(p.px-cx,p.py-cy); return `${cx+(p.px-cx)*k},${cy+(p.py-cy)*k}`; }).join(' '); }
  // kulan hoppar längs sin väg
  function kinaAnimate(){
    const g=G; if(!g || !g.last || !g.last.path || g.last.t===animT) return;
    animT=g.last.t;
    const el=document.getElementById('kAnim'), land=document.querySelector('.km.land'); if(!el){ return; }
    const path=g.last.path.map(i=>PX[i]); el.setAttribute('fill',`url(#kg${g.last.seat})`); el.style.display='';
    if(land) land.style.opacity='0';
    let seg=0; const per=path.length>2?170:220; let t0=null;
    const step=ts=>{ if(t0===null) t0=ts; const f=Math.min(1,(ts-t0)/per); const a=path[seg], b=path[seg+1];
      const hop = path.length>2 || seg>0 ? Math.sin(Math.PI*f)*0.5 : 0;
      el.setAttribute('cx', a.px+(b.px-a.px)*f); el.setAttribute('cy', a.py+(b.py-a.py)*f); el.setAttribute('r', R*(1+hop*0.35));
      if(f<1){ requestAnimationFrame(step); return; }
      seg++; t0=null; if(path.length>2) tone(560+seg*70,.05,'sine',.05);
      if(seg<path.length-1){ requestAnimationFrame(step); return; }
      el.style.display='none'; if(land) land.style.opacity='';
    };
    requestAnimationFrame(step);
  }

  /* ---------- klick ---------- */
  document.addEventListener('click',e=>{
    if(!G || G.kind!=='kina' || view!=='game') return;
    const b=e.target.closest('[data-k],[data-g="kpass"]'); if(!b) return;
    if(b.dataset.g==='kpass'){ doAct({type:'pass'}); return; }
    const me=meSeat(); if(!canActG(me) || G.cur!==me) return;
    const i=+b.dataset.i;
    if(b.dataset.k==='m' && G.board[i]===me){ sel = sel===i ? null : i; sfx.bubble(); render(); return; }
    if(sel!==null){ const d=reach(G,me,sel); if(d.has(i)){ const path=d.get(i); sel=null; doAct({type:'move', path}); return; } sel=null; render(); }
  });

  /* ---------- meny: mot datorn (1–5) eller bjud in (2–6) ---------- */
  let botN=2;
  window.showKinaMenu=function(){
    openModal(`<h3>⭐ Kinaschack</h3><p>Flytta alla dina tio kulor till hörnet mitt emot. Ett steg i taget – eller hoppa över andra kulor, gärna flera hopp i rad. Först i mål vinner!</p>
      <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      <label>Hur många datorspelare?</label><div class="seg" id="kbots">${[1,2,3,4,5].map(n=>`<button data-kb="${n}" class="${botN===n?'sel':''}">${n}</button>`).join('')}</div>
      <label>Hur bra är de?</label><div class="seg" id="segg">${gLevelHTML()}</div>
      <div class="btns" style="flex-direction:column"><button class="pri" data-kmenu="ai">🤖 Spela mot datorn</button>
        <button class="pri" data-kmenu="host" style="background:linear-gradient(135deg,#f472b6,#a855f7)">🚀 Bjud in kompisar (2–6 spelare)</button>
        <button data-act="close">Avbryt</button></div>`,'kmenu');
  };
  document.addEventListener('click',e=>{
    const kb=e.target.closest('[data-kb]'); if(kb){ botN=+kb.dataset.kb; kb.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('sel',x===kb)); sfx.bubble(); return; }
    const b=e.target.closest('[data-kmenu]'); if(!b) return;
    const n=(document.getElementById('nm')?.value||'').trim();
    if(b.dataset.kmenu==='ai'){ const nm=n||'Du'; lsSet('ry_name',nm); unlockAudio(); startGameLocal('kina', nm, gLevel, botN); }
    if(b.dataset.kmenu==='host'){ if(!n){ toast('Skriv ditt namn 🐬'); return; } lsSet('ry_name',n); unlockAudio(); closeModal(); hostGame(n,'free','kina'); }
  });

  /* ---------- stil ---------- */
  const st=document.createElement('style'); st.textContent=`
.khead{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 6px}
.khead .gp{flex:1 1 30%;min-width:96px;padding:7px 10px}
.khead .gp span{font-size:14px}.khead .gp b{font-size:12px}
.kdot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:-1px;box-shadow:0 0 6px currentColor}
.kwrap{position:relative;width:100%;max-width:min(560px,100%,calc((100dvh - 250px)/1.08));margin:0 auto;aspect-ratio:1/1.08;border-radius:28px;
  background:radial-gradient(circle at 50% 45%,rgba(56,189,248,.18),rgba(15,23,42,.55) 70%);border:1px solid var(--line);box-shadow:inset 0 0 40px rgba(0,0,0,.35)}
.kboard{width:100%;height:100%;display:block;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.kh{fill:rgba(2,6,23,.55);stroke:rgba(148,163,184,.35);stroke-width:.05}
.kh.dest{fill:rgba(250,204,21,.25);stroke:#facc15;stroke-width:.09;animation:kpulse 1s ease-in-out infinite;cursor:pointer}
@keyframes kpulse{50%{stroke-opacity:.35}}
.km{stroke:rgba(0,0,0,.35);stroke-width:.04;filter:drop-shadow(0 .08px .1px rgba(0,0,0,.6))}
.km.mine{cursor:pointer}
.km.sel{stroke:#fff;stroke-width:.12;filter:drop-shadow(0 0 .25px #fff)}
.ktrail{fill:none;stroke-width:.09;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:.25 .15;opacity:.75}
.kfrom{fill:none;stroke-width:.07;opacity:.7}
.kleg{display:none}
body.desk .kwrap{max-width:min(680px,100%,calc((100vh - 330px)/1.08))}
`; document.head.appendChild(st);
})();
