/* =====================================================================
   strat.js – Fyra i rad, Luffarschack och Othello
   Tvåspelarspel: online eller mot datorn (tre nivåer).
   ===================================================================== */
'use strict';
(function(){
  const COL=['#f43f5e','#facc15'];          // röd, gul
  const now=()=>Date.now();
  const isInt=(x,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi;
  const okBoard=(b,n,lo,hi)=>Array.isArray(b)&&b.length===n&&b.every(x=>isInt(x,lo,hi));
  const baseValid=g=> g.names.length>=1 && g.names.length<=2 && (g.started===false||g.names.length===2);
  const st=document.createElement('style'); document.head.appendChild(st);
  const css=s=>{ st.textContent+=s; };

  /* =================================================================
     1) FYRA I RAD – 7 kolumner × 6 rader
     ================================================================= */
  const C4W=7, C4H=6;
  function c4Drop(b,c){ for(let r=C4H-1;r>=0;r--) if(b[r*C4W+c]<0) return r; return -1; }
  function c4Win(b,r,c){ const p=b[r*C4W+c]; for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){ const cells=[[r,c]];
      for(const s of [1,-1]){ let rr=r+dr*s, cc=c+dc*s; while(rr>=0&&rr<C4H&&cc>=0&&cc<C4W&&b[rr*C4W+cc]===p){ cells.push([rr,cc]); rr+=dr*s; cc+=dc*s; } }
      if(cells.length>=4) return cells.map(([a,d])=>a*C4W+d); } return null; }
  function c4Eval(b,me){ // poäng för fönster om fyra
    let s=0; const op=1-me;
    for(let r=0;r<C4H;r++) if(b[r*C4W+3]===me) s+=3; else if(b[r*C4W+3]===op) s-=3;
    const win=(cells)=>{ let m=0,o=0,e=0; for(const i of cells){ const v=b[i]; if(v===me) m++; else if(v===op) o++; else e++; }
      if(m&&o) return 0; if(m===3&&e===1) return 6; if(m===2&&e===2) return 2; if(o===3&&e===1) return -8; if(o===2&&e===2) return -2; return 0; };
    for(let r=0;r<C4H;r++) for(let c=0;c<C4W;c++) for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){ const er=r+dr*3, ec=c+dc*3; if(er<0||er>=C4H||ec<0||ec>=C4W) continue; s+=win([0,1,2,3].map(k=>(r+dr*k)*C4W+c+dc*k)); }
    return s;
  }
  const ORDER=[3,2,4,1,5,0,6];
  function c4Negamax(b,depth,alpha,beta,p,root){
    let best=-1e9, bestC=-1; let any=false;
    for(const c of ORDER){ const r=c4Drop(b,c); if(r<0) continue; any=true; const i=r*C4W+c; b[i]=p;
      let v; if(c4Win(b,r,c)) v=100000+depth; else if(depth<=1) v=c4Eval(b,p); else v=-c4Negamax(b,depth-1,-beta,-alpha,1-p,false).v;
      b[i]=-1; if(v>best){ best=v; bestC=c; } if(best>alpha) alpha=best; if(alpha>=beta) break; }
    if(!any) return {v:0,c:-1};
    return {v:best,c:bestC};
  }
  GINFO.c4={name:'Fyra i rad', icon:'🔴', ai:'Blixt 🤖', max:2, desc:'Få fyra i rad före motståndaren', grad:'linear-gradient(135deg,#f43f5e,#f59e0b)'};
  KIND.c4={
    init(){ return {board:new Array(C4W*C4H).fill(-1), win:null}; },
    start(g){ g.board=new Array(C4W*C4H).fill(-1); g.win=null; g.cur=g.starter%2; },
    valid(g){ return baseValid(g) && okBoard(g.board,C4W*C4H,-1,1) && (g.win===null||g.win===undefined||(Array.isArray(g.win)&&g.win.length<=7)); },
    waitingFor(g){ return g.cur; },
    scoreOf(g,i){ return `<span class="c4dot" style="background:${COL[i]}"></span>`; },
    apply(g,a,seat){
      if(a.type==='resign') return KIT.resign(g,seat);
      if(g.over||seat!==g.cur||a.type!=='drop'||!isInt(a.c,0,C4W-1)) return false;
      const r=c4Drop(g.board,a.c); if(r<0) return false; g.board[r*C4W+a.c]=seat;
      g.last={seat,c:a.c,r,t:now()}; const w=c4Win(g.board,r,a.c);
      if(w){ g.over=true; g.winner=seat; g.win=w; } else if(g.board.every(x=>x>=0)){ g.over=true; g.winner=-1; } else g.cur=1-seat;
      return true; },
    aiSeat(g){ return !g.over&&isAI(g.cur)?g.cur:null; },
    aiDelay(){ return 550; },
    ai(g,seat){ const lv=g.ai[seat]; const b=g.board.slice();
      const legal=ORDER.filter(c=>c4Drop(b,c)>=0);
      if(lv==='easy'){ // vinn eller blockera ibland, annars slump
        for(const p of [seat,1-seat]) for(const c of legal){ const r=c4Drop(b,c); b[r*C4W+c]=p; const w=c4Win(b,r,c); b[r*C4W+c]=-1; if(w && Math.random()<.75) return {type:'drop',c}; }
        return {type:'drop',c:legal[rint(legal.length)]}; }
      const d = lv==='hard' ? 8 : 4; const res=c4Negamax(b,d,-1e9,1e9,seat,true);
      return {type:'drop',c: res.c>=0?res.c:legal[0]}; },
    effects(prev,d){ if(d.last&&(!prev.last||prev.last.t!==d.last.t)&&d.last.c!=null) sfx.bubble(); },
    html(){
      const g=G, me=meSeat(), my=!g.over&&g.cur===me&&canActG(me), W=new Set(g.win||[]);
      let cells=''; for(let r=0;r<C4H;r++) for(let c=0;c<C4W;c++){ const v=g.board[r*C4W+c], last=g.last&&g.last.r===r&&g.last.c===c;
        cells+=`<div class="c4c" data-c4="${c}">${v>=0?`<i class="c4p ${last?'drop':''} ${W.has(r*C4W+c)?'win':''}" style="--pc:${COL[v]};--r:${r+1}"></i>`:''}</div>`; }
      return gHeadHTML(KIT.turnText(g,'tryck på en kolumn')) + `<div class="c4b ${my?'my':''}" style="--hc:${COL[me]||COL[0]}">${cells}</div>`
        + (g.over? gOverHTML(g.winner===-1?'Brädet är fullt.':'Fyra i rad!') : `<div class="ghint">${KIT.resignHTML()}</div>`); }
  };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-c4]'); if(!b||!G||G.kind!=='c4') return; const me=meSeat(); if(G.over||G.cur!==me||!canActG(me)) return; doAct({type:'drop',c:+b.dataset.c4}); });
  css(`.c4b{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;padding:8px;border-radius:18px;background:linear-gradient(160deg,#1d4ed8,#1e3a8a);max-width:min(470px,100%,calc((100dvh - 260px)*7/6));margin:8px auto;box-shadow:0 10px 30px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.15)}
.c4c{aspect-ratio:1;border-radius:50%;background:#0b1530;box-shadow:inset 0 3px 6px rgba(0,0,0,.6);position:relative;cursor:pointer}
.c4b.my .c4c:hover{background:#14224a}
.c4p{position:absolute;inset:3px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,transparent 45%),var(--pc);box-shadow:inset 0 -3px 6px rgba(0,0,0,.35)}
.c4p.drop{animation:c4d .45s cubic-bezier(.5,0,.75,1.3)}@keyframes c4d{from{transform:translateY(calc(var(--r)*-118%))}}
.c4p.win{animation:c4w 1s ease-in-out infinite alternate;box-shadow:0 0 0 3px #fff,0 0 18px var(--pc)}@keyframes c4w{to{transform:scale(.86)}}
.c4dot{display:inline-block;width:16px;height:16px;border-radius:50%;vertical-align:middle;box-shadow:inset 0 -2px 3px rgba(0,0,0,.3)}`);
  GINFO.c4.menu=()=>KIT.menu('c4',{rules:'Släpp brickor i kolumnerna. Den som först får fyra i rad – vågrätt, lodrätt eller snett – vinner.'});

  /* =================================================================
     2) LUFFARSCHACK – fem i rad på 15 × 15
     ================================================================= */
  const GN=15;
  const SYM=['✕','◯'];
  function gmLine(b,i,dr,dc){ const r=Math.floor(i/GN), c=i%GN, p=b[i]; const cells=[i];
    for(const s of [1,-1]){ let rr=r+dr*s, cc=c+dc*s; while(rr>=0&&rr<GN&&cc>=0&&cc<GN&&b[rr*GN+cc]===p){ cells.push(rr*GN+cc); rr+=dr*s; cc+=dc*s; } } return cells; }
  function gmWin(b,i){ for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){ const l=gmLine(b,i,dr,dc); if(l.length>=5) return l; } return null; }
  // värde för att lägga p på i: hur långa och öppna rader det ger
  function gmScore(b,i,p){
    const r=Math.floor(i/GN), c=i%GN; let s=0;
    for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
      let n=1, open=0;
      for(const sg of [1,-1]){ let rr=r+dr*sg, cc=c+dc*sg; while(rr>=0&&rr<GN&&cc>=0&&cc<GN&&b[rr*GN+cc]===p){ n++; rr+=dr*sg; cc+=dc*sg; }
        if(rr>=0&&rr<GN&&cc>=0&&cc<GN&&b[rr*GN+cc]<0) open++; }
      if(n>=5) s+=1e6; else if(n===4) s+= open===2?1e5: open===1?1e4:0; else if(n===3) s+= open===2?5000: open===1?400:0; else if(n===2) s+= open===2?200: open===1?30:0; else s+= open*4;
    }
    return s;
  }
  function gmCands(b){ const out=[]; for(let i=0;i<GN*GN;i++){ if(b[i]>=0) continue; const r=Math.floor(i/GN), c=i%GN; let near=false;
      for(let dr=-2;dr<=2&&!near;dr++) for(let dc=-2;dc<=2;dc++){ const rr=r+dr, cc=c+dc; if(rr>=0&&rr<GN&&cc>=0&&cc<GN&&b[rr*GN+cc]>=0){ near=true; break; } } if(near) out.push(i); }
    return out.length?out:[Math.floor(GN*GN/2)]; }
  GINFO.gomoku={name:'Luffarschack', icon:'✖️', ai:'Blixt 🤖', max:2, desc:'Fem i rad på stort rutnät', grad:'linear-gradient(135deg,#64748b,#0ea5e9)'};
  KIND.gomoku={
    init(){ return {board:new Array(GN*GN).fill(-1), win:null}; },
    start(g){ g.board=new Array(GN*GN).fill(-1); g.win=null; g.cur=g.starter%2; },
    valid(g){ return baseValid(g) && okBoard(g.board,GN*GN,-1,1) && (g.win==null||(Array.isArray(g.win)&&g.win.length<=15)); },
    waitingFor(g){ return g.cur; },
    scoreOf(g,i){ return `<span class="gm-s${i}">${SYM[i]}</span>`; },
    apply(g,a,seat){
      if(a.type==='resign') return KIT.resign(g,seat);
      if(g.over||seat!==g.cur||a.type!=='put'||!isInt(a.i,0,GN*GN-1)||g.board[a.i]>=0) return false;
      g.board[a.i]=seat; g.last={seat,i:a.i,t:now()}; const w=gmWin(g.board,a.i);
      if(w){ g.over=true; g.winner=seat; g.win=w; } else if(g.board.every(x=>x>=0)){ g.over=true; g.winner=-1; } else g.cur=1-seat;
      return true; },
    aiSeat(g){ return !g.over&&isAI(g.cur)?g.cur:null; },
    aiDelay(){ return 500; },
    ai(g,seat){ const b=g.board, lv=g.ai[seat], cs=gmCands(b);
      const sc=cs.map(i=>{ const at=gmScore(b,i,seat), df=gmScore(b,i,1-seat);
        const k = lv==='hard' ? at*1.1+df : lv==='medium' ? at+df*.8 : at*.6+df*.5;
        return {i, v:k + Math.random()*(lv==='easy'?400:lv==='medium'?40:4)}; }).sort((a,b)=>b.v-a.v);
      let pick=sc[0]; if(lv==='easy' && Math.random()<.35) pick=sc[Math.min(sc.length-1,rint(4))];
      return {type:'put', i:pick.i}; },
    effects(prev,d){ if(d.last&&(!prev.last||prev.last.t!==d.last.t)&&d.last.i!=null) sfx.pop(); },
    html(){
      const g=G, me=meSeat(), W=new Set(g.win||[]); let cells='';
      for(let i=0;i<GN*GN;i++){ const v=g.board[i]; cells+=`<div class="gmc ${g.last&&g.last.i===i?'last':''} ${W.has(i)?'win':''}" data-gm="${i}">${v>=0?`<b class="gm-s${v}">${SYM[v]}</b>`:''}</div>`; }
      return gHeadHTML(KIT.turnText(g,'tryck på en ruta')) + `<div class="gmb">${cells}</div>` + (g.over? gOverHTML(g.winner===-1?'Rutnätet är fullt.':'Fem i rad!') : `<div class="ghint">Få fem i rad – vågrätt, lodrätt eller snett. ${KIT.resignHTML()}</div>`); }
  };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-gm]'); if(!b||!G||G.kind!=='gomoku') return; const me=meSeat(); if(G.over||G.cur!==me||!canActG(me)) return; const i=+b.dataset.gm; if(G.board[i]>=0) return; doAct({type:'put',i}); });
  css(`.gmb{display:grid;grid-template-columns:repeat(15,minmax(0,1fr));grid-template-rows:repeat(15,minmax(0,1fr));gap:1px;background:#3b4b7a;padding:1px;border-radius:10px;aspect-ratio:1;max-width:min(560px,100%,calc(100dvh - 250px));margin:8px auto;container-type:inline-size}
.gmc{background:#f8f1dc;display:grid;place-items:center;cursor:pointer;min-width:0;min-height:0}
.gmc b{font-size:calc(100cqw/15*.72);line-height:1;font-weight:900}.gm-s0{color:#e11d48}.gm-s1{color:#2563eb}
.gmc.last{background:#fde68a}.gmc.win{background:#86efac}`);
  GINFO.gomoku.menu=()=>KIT.menu('gomoku',{rules:'Turas om att sätta kryss och ringar. Den som först får fem i rad – vågrätt, lodrätt eller snett – vinner.'});

  /* =================================================================
     3) OTHELLO – 8 × 8
     ================================================================= */
  const ON=8, DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const WT=[100,-20,10,5,5,10,-20,100,-20,-50,-2,-2,-2,-2,-50,-20,10,-2,-1,-1,-1,-1,-2,10,5,-2,-1,-1,-1,-1,-2,5,5,-2,-1,-1,-1,-1,-2,5,10,-2,-1,-1,-1,-1,-2,10,-20,-50,-2,-2,-2,-2,-50,-20,100,-20,10,5,5,10,-20,100];
  function flips(b,i,p){ if(b[i]>=0) return []; const r=i>>3, c=i&7, out=[];
    for(const [dr,dc] of DIRS){ const line=[]; let rr=r+dr, cc=c+dc; while(rr>=0&&rr<ON&&cc>=0&&cc<ON&&b[rr*ON+cc]===1-p){ line.push(rr*ON+cc); rr+=dr; cc+=dc; }
      if(line.length && rr>=0&&rr<ON&&cc>=0&&cc<ON&&b[rr*ON+cc]===p) out.push(...line); } return out; }
  const moves=(b,p)=>{ const m=[]; for(let i=0;i<64;i++) if(b[i]<0 && flips(b,i,p).length) m.push(i); return m; };
  function oEval(b,p){ let s=0, n=0; for(let i=0;i<64;i++){ if(b[i]===p){ s+=WT[i]; n++; } else if(b[i]===1-p){ s-=WT[i]; n--; } }
    const e=b.filter(x=>x<0).length; if(e<12) s+=n*6; return s + (moves(b,p).length-moves(b,1-p).length)*4; }
  function oSearch(b,d,a,be,p,passed){
    const ms=moves(b,p);
    if(!ms.length){ if(passed||!moves(b,1-p).length){ const n=b.filter(x=>x===p).length-b.filter(x=>x===1-p).length; return {v:n>0?1e5+n:n<0?-1e5+n:0}; }
      return {v:-oSearch(b,d,-be,-a,1-p,true).v}; }
    if(d===0) return {v:oEval(b,p)};
    ms.sort((x,y)=>WT[y]-WT[x]); let best=-1e9, bm=ms[0];
    for(const m of ms){ const f=flips(b,m,p), c=b.slice(); c[m]=p; f.forEach(i=>c[i]=p); const v=-oSearch(c,d-1,-be,-a,1-p,false).v; if(v>best){ best=v; bm=m; } if(best>a) a=best; if(a>=be) break; }
    return {v:best,m:bm};
  }
  const OCOL=['#111827','#f8fafc'], ONAME=['svart','vit'];
  GINFO.othello={name:'Othello', icon:'⚫', ai:'Blixt 🤖', max:2, desc:'Vänd motståndarens brickor', grad:'linear-gradient(135deg,#15803d,#0f172a)'};
  KIND.othello={
    init(){ return {board:[]}; },
    start(g){ const b=new Array(64).fill(-1); b[27]=1; b[36]=1; b[28]=0; b[35]=0; g.board=b; g.cur=g.starter%2; g.passed=false; },
    valid(g){ return baseValid(g) && (g.started===false ? true : okBoard(g.board,64,-1,1)); },
    waitingFor(g){ return g.cur; },
    scoreOf(g,i){ return `<span class="odot" style="background:${OCOL[i]}"></span> ${(g.board||[]).filter(x=>x===i).length}`; },
    apply(g,a,seat){
      if(a.type==='resign') return KIT.resign(g,seat);
      if(g.over||seat!==g.cur||a.type!=='put'||!isInt(a.i,0,63)) return false;
      const f=flips(g.board,a.i,seat); if(!f.length) return false;
      g.board[a.i]=seat; f.forEach(i=>g.board[i]=seat); g.last={seat,i:a.i,f,t:now()};
      const o=1-seat;
      if(moves(g.board,o).length){ g.cur=o; g.passed=false; }
      else if(moves(g.board,seat).length){ g.cur=seat; g.passed=true; g.last.pass=o; }
      else { g.over=true; const a0=g.board.filter(x=>x===0).length, a1=g.board.filter(x=>x===1).length; g.winner=a0>a1?0:a1>a0?1:-1; }
      return true; },
    aiSeat(g){ return !g.over&&isAI(g.cur)?g.cur:null; },
    aiDelay(){ return 650; },
    ai(g,seat){ const lv=g.ai[seat], ms=moves(g.board,seat); if(!ms.length) return null;
      if(lv==='easy'){ ms.sort((a,b)=>flips(g.board,b,seat).length-flips(g.board,a,seat).length); return {type:'put', i: Math.random()<.5?ms[0]:ms[rint(ms.length)]}; }
      const r=oSearch(g.board.slice(), lv==='hard'?5:2, -1e9, 1e9, seat, false); return {type:'put', i:r.m!=null?r.m:ms[0]}; },
    effects(prev,d){ if(d.last&&(!prev.last||prev.last.t!==d.last.t)){ sfx.pop(); if(d.last.pass!=null) toast(`${pname(d.last.pass)} kan inte lägga – ${pname(d.cur)} igen`,2200); } },
    html(){
      const g=G, me=meSeat(), my=!g.over&&g.cur===me&&canActG(me), legal=new Set(my?moves(g.board,me):[]), F=new Set(g.last&&g.last.f||[]);
      let cells=''; for(let i=0;i<64;i++){ const v=g.board[i];
        cells+=`<div class="oc ${legal.has(i)?'ok':''}" data-oth="${i}">${v>=0?`<i class="op ${F.has(i)?'flip':''} ${g.last&&g.last.i===i?'new':''}" style="--pc:${OCOL[v]}"></i>`:''}</div>`; }
      const n0=g.board.filter(x=>x===0).length, n1=g.board.filter(x=>x===1).length;
      return gHeadHTML(KIT.turnText(g,`du är ${ONAME[me]||''}`)) + `<div class="ob">${cells}</div>`
        + (g.over? gOverHTML(`${n0} – ${n1}`) : `<div class="ghint">Lägg så att du stänger in motståndarens brickor – de vänds till din färg. Prickarna visar var du kan lägga. ${KIT.resignHTML()}</div>`); }
  };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-oth]'); if(!b||!G||G.kind!=='othello') return; const me=meSeat(); if(G.over||G.cur!==me||!canActG(me)) return; const i=+b.dataset.oth; if(!flips(G.board,i,me).length) return; doAct({type:'put',i}); });
  css(`.ob{display:grid;grid-template-columns:repeat(8,1fr);gap:3px;padding:6px;border-radius:14px;background:#0f3d24;max-width:min(480px,100%,calc(100dvh - 260px));margin:8px auto;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.oc{aspect-ratio:1;background:#15803d;border-radius:4px;position:relative;cursor:pointer}
.oc.ok::after{content:'';position:absolute;inset:38%;border-radius:50%;background:rgba(255,255,255,.35)}
.op{position:absolute;inset:8%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff5,transparent 50%),var(--pc);box-shadow:0 3px 6px rgba(0,0,0,.45)}
.op.flip{animation:ofl .5s ease}@keyframes ofl{0%{transform:rotateY(0)}50%{transform:rotateY(90deg)}100%{transform:rotateY(0)}}
.op.new{box-shadow:0 0 0 3px #facc15,0 3px 6px rgba(0,0,0,.45)}
.odot{display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;border:1px solid #94a3b8}`);
  GINFO.othello.menu=()=>KIT.menu('othello',{rules:'Lägg dina brickor så att du stänger in motståndarens i en rad – då vänds de till din färg. Flest brickor när brädet är fullt vinner.'});

  window.__stratTest=(typeof DEV!=='undefined'&&DEV)?{c4Win,c4Negamax,gmWin,flips,moves,oSearch}:undefined;
})();
