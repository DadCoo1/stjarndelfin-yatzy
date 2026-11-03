/* =====================================================================
   games.js – Sänka skepp, Mastermind och Hänga gubbe
   Gemensam tvåspelarmotor: mot datorn (lokalt) eller online där värden
   tar emot drag ("act") och skickar ut hela tillståndet till alla.
   ===================================================================== */
'use strict';
const KIND = {};
const GINFO = {
  ships:{name:'Sänka skepp', icon:'🚢', ai:'Amiral Blixt 🤖', grad:'linear-gradient(135deg,#0ea5e9,#1e3a8a)'},
  mm:   {name:'Mastermind',  icon:'🔮', ai:'Blixt 🤖',        grad:'linear-gradient(135deg,#a855f7,#ec4899)'},
  hang: {name:'Hänga gubbe', icon:'🪢', ai:'Blixt 🤖',        grad:'linear-gradient(135deg,#f59e0b,#ef4444)'}
};
const isKind = () => !!(G && G.kind && G.kind!=='yatzy' && KIND[G.kind]);
const gName = () => isKind() ? GINFO[G.kind].name : 'Yatzy';
const gIcon = () => isKind() ? GINFO[G.kind].icon : '🎲';
const meSeat = () => mode==='online' ? mySeat : 0;
const maxP = () => isKind() ? (GINFO[G.kind].max||2) : 4;
const canActG = seat => !!(G && !G.over && ready() && (mode==='online' ? seat===mySeat : !isAI(seat)));
const clone = o => JSON.parse(JSON.stringify(o));
const bare = n => String(n||'').replace(/\s*🤖$/,'');
const gen = n => { const b=bare(n); return /[sxz]$/i.test(b) ? b : b+'s'; };   // svensk genitiv: Blixts, Tindras, Max

function gNewState(kind, names, starter=0, ai=null, seq=0){
  return Object.assign({kind, id:Math.random().toString(36).slice(2,9)+Date.now().toString(36), names, ai, starter, cur:starter,
    started:true, over:false, winner:null, seq, last:null, createdAt:Date.now(), updatedAt:Date.now()}, KIND[kind].init());
}
// kopia av tillståndet där det som `seat` inte får se är bortplockat
function gRedact(g, seat){
  if(!g || g.over || !KIND[g.kind] || !KIND[g.kind].redact) return g;
  const c=clone(g); KIND[g.kind].redact(c, seat); return c;
}
const isArrI=(a,n,lo,hi)=>Array.isArray(a) && a.length<=n && a.every(x=>Number.isInteger(x)&&x>=lo&&x<=hi);
function startGameLocal(kind, name, level, bots=1){
  stopNet(); clearTimeout(aiTimer); closeModal();
  mode='local'; mySeat=0; gameId=null; role=null;
  const bn=GINFO[kind].bots ? GINFO[kind].bots.slice(0,Math.max(1,Math.min(5,bots))) : [GINFO[kind].ai];
  G=gNewState(kind,[name, ...bn],0,[false, ...bn.map(()=>level)]); KIND[kind].start(G); lsSet('ry_local', JSON.stringify(G));
  view='game'; resetDrafts(); render(); gMaybeAI();
}
function gStartOnline(){
  const prev=clone(G); G.started=true; G.cur=G.starter=0; Object.assign(G, KIND[G.kind].init()); KIND[G.kind].start(G);
  G.seq=(G.seq||0)+1; saveNet(); hostBroadcast({t:'state',state:G}); gOnChange(prev,G); render();
}
// ett drag från den här enheten
function doAct(a){
  if(!isKind()) return;
  unlockAudio();
  if(mode==='online' && role==='guest'){ if(net!=='connected'){ toast('Ingen kontakt just nu 📡'); return; } send({t:'act', a}); return; }
  const seat = mode==='online' ? mySeat : (Number.isInteger(a.seat) ? a.seat : 0);
  applyAndPublish(a, seat);
}
// värden (eller lokalt spel) tillämpar ett drag och sprider resultatet
function applyAndPublish(a, seat){
  if(!isKind() || !a || typeof a!=='object' || Array.isArray(a) || typeof a.type!=='string') return false;
  const prev=clone(G);
  if(a.type==='rematch'){
    if(!G.over) return false;
    const n=gNewState(G.kind, G.names.slice(), ((G.starter||0)+1)%G.names.length, G.ai, G.seq); KIND[G.kind].start(n); G=n;
  } else {
    let ok=false; try{ ok=KIND[G.kind].apply(G,a,seat); }catch(e){ ok=false; }
    if(!ok){ G=prev; return false; }                  // ogiltigt drag: inget ändras
  }
  G.seq=(G.seq||0)+1; G.updatedAt=Date.now();
  if(mode==='online'){ saveNet(); hostBroadcast({t:'state',state:G}); }
  else if(mode==='local') lsSet('ry_local', JSON.stringify(G));        // spel mot datorn finns kvar om appen stängs
  gOnChange(prev,G); render(); gMaybeAI();
  return true;
}
function gOnChange(prev,d){
  if(!prev) return;
  if(prev.id!==d.id){ if(M().classList.contains('show')) closeModal(); resetDrafts(); toast(`Ny match! ${pname(d.cur)} börjar 🚀`); }
  else KIND[d.kind].effects && KIND[d.kind].effects(prev,d);
  if(d.over && !(prev.over && prev.id===d.id)) gFinish(d);
  const me=meSeat();
  if(mode==='online' && !d.over && ready() && d.cur===me && (prev.cur!==me || prev.id!==d.id || prev.started===false) && (!KIND[d.kind].waitingFor || KIND[d.kind].waitingFor(d)===me))
    setTimeout(()=>notifyTurn(`Din tur, ${pname(me)}!`),500);
}
function gMaybeAI(){
  clearTimeout(aiTimer);
  if(mode!=='local' || !isKind() || G.over) return;
  const k=KIND[G.kind], seat=k.aiSeat ? k.aiSeat(G) : (isAI(G.cur)?G.cur:null);
  if(seat===null || seat===undefined) return;
  aiTimer=setTimeout(()=>{ if(!isKind()||G.over||mode!=='local') return; const a=k.ai(G,seat); if(a) applyAndPublish(a,seat); }, k.aiDelay ? k.aiDelay(G) : 1000);
}
/* ---------- resultat & statistik ---------- */
function stats2(){ try{ return JSON.parse(lsGet('ry_stats2'))||{games:[]} }catch(e){ return {games:[]} } }
function gFinish(d){
  const me=meSeat(), st=stats2();
  if(!st.games.some(g=>g.id===d.id) && me!==null && me!==undefined){
    const res = d.winner===-1 ? 'T' : d.winner===me ? 'W' : 'L';
    const others=d.names.map((n,i)=>i).filter(i=>i!==me);
    const lvl = x => ({hard:'svår',medium:'medel'})[x]||'lätt';
    const oppName = i => isAI(i) ? `${bare(d.names[i])} 🤖 ${lvl(d.ai[i])}` : d.names[i];
    const opp = others.length===1 ? oppName(others[0]) : others.every(i=>isAI(i)) ? `${others.length} datorspelare (${lvl(d.ai[others[0]])})` : others.map(i=>bare(d.names[i])).join(', ');
    st.games.push({id:d.id, kind:d.kind, d:Date.now(), me:d.names[me], opp, res, mode});
    if(st.games.length>500) st.games=st.games.slice(-500);
    lsSet('ry_stats2', JSON.stringify(st));
  }
  const won = d.winner===me;
  setTimeout(()=>{ if(won){ celebrate('VINST!'); sfx.win(); sparkles(50); } else if(d.winner===-1){ sfx.pick(); sparkles(16); } else { tone(392,.3,'triangle',.1); tone(330,.4,'triangle',.1,.25); tone(262,.6,'triangle',.1,.5); } },400);
  if(view!=='game') notice({icon:'🏁', title:`${GINFO[d.kind].name} är klar`, text: won?'Du vann! 🏆':d.winner===-1?'Oavgjort':'Se hur det gick', actions:[{label:'Visa', run:backToGame}]});
}
function otherStatsHTML(){
  const st=stats2(); let h='';
  const byKind={};
  st.games.forEach(g=>{ const k=byKind[g.kind]||(byKind[g.kind]={W:0,L:0,T:0,opp:{}}); k[g.res]++; const o=k.opp[g.opp]||(k.opp[g.opp]={W:0,L:0,T:0}); o[g.res]++; });
  const kinds=Object.keys(byKind);
  if(kinds.length){
    h+=`<section><h2 class="sec">Fler spel</h2><div class="stbl"><div class="tr h"><div>Spel / motståndare</div><div class="r">V – F – O</div><div class="r">Matcher</div></div>`;
    kinds.forEach(k=>{ const s=byKind[k];
      h+=`<div class="tr"><div class="l"><b>${GINFO[k].icon} ${GINFO[k].name}</b></div><div class="r wl"><span class="w">${s.W}</span> – <span class="f">${s.L}</span> – <span class="o">${s.T}</span></div><div class="r">${s.W+s.L+s.T}</div></div>`;
      Object.entries(s.opp).forEach(([n,o])=>{ h+=`<div class="tr"><div class="l m" style="padding-left:14px">mot ${esc(n)}</div><div class="r wl"><span class="w">${o.W}</span> – <span class="f">${o.L}</span> – <span class="o">${o.T}</span></div><div class="r m">${o.W+o.L+o.T}</div></div>`; });
    });
    h+='</div></section>';
  }
  if(typeof invStatsHTML==='function') h+=invStatsHTML();
  return h;
}
/* ---------- gemensamt utseende ---------- */
function gHeadHTML(sub){
  const me=meSeat();
  const pl=G.names.map((n,i)=>{ const on=!G.over && G.cur===i && (!KIND[G.kind].waitingFor || KIND[G.kind].waitingFor(G)===i); const isMe = mode==='online' ? i===mySeat : !isAI(i);
    return `<div class="gp ${on?'on':''} ${G.over&&G.winner===i?'win':''}"><span>${G.over&&G.winner===i?'👑 ':''}${esc(n)}${isMe&&mode==='online'?' <em>du</em>':''}</span><b>${KIND[G.kind].scoreOf?KIND[G.kind].scoreOf(G,i):''}</b></div>`; }).join('<div class="gvs">vs</div>');
  return `<div class="ghead">${pl}</div>${sub?`<div class="gsub">${sub}</div>`:''}`;
}
function gOverHTML(text){
  const me=meSeat(), won=G.winner===me, tie=G.winner===-1;
  return `<div class="gover ${won?'won':tie?'tie':'lost'}"><div class="gi">${won?'🏆':tie?'🤝':'🌊'}</div><h3>${tie?'Oavgjort!':won?'Du vann!':`${esc(pname(G.winner))} vann!`}</h3><p>${text||''}</p>
    <div class="gbtns"><button class="pri" data-g="rematch">🔄 Spela igen</button><button data-act="lobby">🏠 Lobby</button></div></div>`;
}
let shipsDraft=null, mmDraft=null, hgDraft=null, gAnimT=null;
function resetDrafts(){ shipsDraft=null; mmDraft=null; hgDraft=null; gAnimT=null; }

/* =====================================================================
   1) SÄNKA SKEPP
   ===================================================================== */
const N=10, FLEET=[{id:'carrier',name:'Hangarfartyg',len:5},{id:'battle',name:'Slagskepp',len:4},{id:'cruiser',name:'Kryssare',len:3},{id:'sub',name:'Ubåt',len:3},{id:'destroyer',name:'Jagare',len:2}];
const COLS='ABCDEFGHIJ';
function shipCells(r,c,len,vert){ const out=[]; for(let k=0;k<len;k++){ const rr=r+(vert?k:0), cc=c+(vert?0:k); if(rr>=N||cc>=N) return null; out.push(rr*N+cc); } return out; }
function neighbors8(i){ const r=Math.floor(i/N), c=i%N, out=[]; for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){ if(!dr&&!dc) continue; const rr=r+dr, cc=c+dc; if(rr>=0&&rr<N&&cc>=0&&cc<N) out.push(rr*N+cc); } return out; }
function blockedBy(ships, exceptId){ const s=new Set(); ships.forEach(sh=>{ if(sh.id===exceptId) return; sh.cells.forEach(i=>{ s.add(i); neighbors8(i).forEach(n=>s.add(n)); }); }); return s; }
function canPlace(ships, id, cells){ if(!cells) return false; const b=blockedBy(ships,id); return cells.every(i=>!b.has(i)); }
function validFleet(ships){
  if(!Array.isArray(ships) || ships.length!==FLEET.length) return false;
  for(const f of FLEET){ const s=ships.find(x=>x.id===f.id); if(!s || !Array.isArray(s.cells) || s.cells.length!==f.len) return false;
    const r0=Math.floor(s.cells[0]/N), c0=s.cells[0]%N, vert=s.cells.length>1 && s.cells[1]-s.cells[0]===N;
    const exp=shipCells(r0,c0,f.len,vert); if(!exp || exp.join()!==s.cells.join()) return false;
    if(!canPlace(ships, s.id, s.cells)) return false; }
  return true;
}
function randomFleet(){
  for(let tries=0;tries<200;tries++){
    const ships=[]; let ok=true;
    for(const f of FLEET){ let placed=false;
      for(let k=0;k<300 && !placed;k++){ const vert=rint(2)===1, r=rint(N), c=rint(N), cells=shipCells(r,c,f.len,vert); if(cells && canPlace(ships,f.id,cells)){ ships.push({id:f.id,len:f.len,cells}); placed=true; } }
      if(!placed){ ok=false; break; } }
    if(ok) return ships;
  }
  return null;
}
const sunkShips = b => (b.ships||[]).filter(s=>s.cells.every(i=>b.shots.includes(i)));
KIND.ships = {
  init(){ return {phase:'place', boards:[{ships:null,ready:false,shots:[]},{ships:null,ready:false,shots:[]}]}; },
  redact(g,seat){ const b=g.boards && g.boards[1-seat]; if(!b || !b.ships) return;
    if(g.phase!=='battle'){ b.ships=null; return; }
    // osänkta skepp: bara träffade rutor syns (plus utfyllnad som aldrig kan vara skjuten)
    b.ships=b.ships.map((s,k)=> s.cells.every(i=>b.shots.includes(i)) ? s : {id:'?'+k, len:s.len, cells:[...s.cells.filter(i=>b.shots.includes(i)), ...Array.from({length:s.len},(_,j)=>-1-j-k*10)]}); },
  valid(g){ return ['place','battle'].includes(g.phase) && Array.isArray(g.boards) && g.boards.length===2 && g.boards.every(b=>b && typeof b==='object' && isArrI(b.shots,100,0,99) && typeof b.ready==='boolean' &&
    (b.ships===null || (Array.isArray(b.ships) && b.ships.length<=5 && b.ships.every(s=>s && typeof s.id==='string' && s.id.length<12 && isI(s.len,1,5) && isArrI(s.cells,10,-100,99))))) && isI(g.cur,0,1); },
  start(g){ g.phase='place'; g.boards=[{ships:null,ready:false,shots:[]},{ships:null,ready:false,shots:[]}];
    [0,1].forEach(i=>{ if(g.ai && g.ai[i]){ g.boards[i].ships=randomFleet(); g.boards[i].ready=true; } }); },
  waitingFor(g){ if(g.phase==='place'){ const me=meSeat(); return g.boards[me] && !g.boards[me].ready ? me : null; } return g.cur; },
  scoreOf(g,i){ if(g.phase!=='battle' && !g.over) return g.boards[i].ready?'✅ klar':'⚓ placerar'; const opp=g.boards[1-i]; return `${sunkShips(opp).length}/5 sänkta`; },
  apply(g,a,seat){
    const me=g.boards[seat], opp=g.boards[1-seat];
    if(a.type==='ready' && g.phase==='place'){
      if(!validFleet(a.ships)) return false;
      me.ships=a.ships.map(s=>({id:s.id,len:s.cells.length,cells:s.cells.slice()})); me.ready=true;
      if(g.boards.every(b=>b.ready)){ g.phase='battle'; g.cur=g.starter; g.last=null; }
      return true;
    }
    if(a.type==='unready' && g.phase==='place' && me.ready){ me.ready=false; return true; }
    if(a.type==='shoot' && g.phase==='battle' && !g.over && seat===g.cur){
      const i=a.i|0; if(i<0||i>=N*N||opp.shots.includes(i)) return false;
      opp.shots.push(i);
      const ship=opp.ships.find(s=>s.cells.includes(i)); let sunk=null;
      if(ship && ship.cells.every(c=>opp.shots.includes(c))) sunk=ship.id;
      if(ship && sunkShips(opp).length===FLEET.length){ g.over=true; g.winner=seat; }
      if(!ship) g.cur=1-seat;                               // träff = skjut igen
      g.last={seat, i, hit:!!ship, sunk, t:Date.now()};
      return true;
    }
    return false;
  },
  aiSeat(g){ return g.phase==='battle' && isAI(g.cur) ? g.cur : null; },
  aiDelay(g){ return g.last && g.last.seat===g.cur && g.last.hit ? 900 : 1200; },
  ai(g,seat){
    const b=g.boards[1-seat], shots=new Set(b.shots), sunk=sunkShips(b), sunkCells=new Set(sunk.flatMap(s=>s.cells));
    const near=new Set(); sunk.forEach(s=>s.cells.forEach(i=>neighbors8(i).forEach(n=>near.add(n))));
    const free=i=>i>=0 && i<N*N && !shots.has(i) && !near.has(i);
    const hits=b.shots.filter(i=>!sunkCells.has(i) && b.ships.some(s=>s.cells.includes(i)));
    const easy = g.ai[seat]==='easy';
    if(hits.length && !(easy && Math.random()<.35)){
      let cand=[];
      if(hits.length>=2){ const rows=new Set(hits.map(i=>Math.floor(i/N))), cols=new Set(hits.map(i=>i%N));
        if(rows.size===1){ const r=[...rows][0], cs=hits.map(i=>i%N); cand=[r*N+Math.min(...cs)-1, r*N+Math.max(...cs)+1].filter(i=>Math.floor(i/N)===r); }
        else if(cols.size===1){ const c=[...cols][0], rs=hits.map(i=>Math.floor(i/N)); cand=[(Math.min(...rs)-1)*N+c,(Math.max(...rs)+1)*N+c]; } }
      cand=cand.filter(free);
      if(!cand.length) hits.forEach(h=>{ const r=Math.floor(h/N), c=h%N; [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([rr,cc])=>{ if(rr>=0&&rr<N&&cc>=0&&cc<N && free(rr*N+cc)) cand.push(rr*N+cc); }); });
      if(cand.length) return {type:'shoot', i:cand[rint(cand.length)]};
    }
    let pool=[]; for(let i=0;i<N*N;i++) if(free(i)) pool.push(i);
    if(!easy){ const par=pool.filter(i=>(Math.floor(i/N)+i%N)%2===0); if(par.length) pool=par;
      // föredra rutor långt från kanten och från tidigare missar
      const score=i=>{ const r=Math.floor(i/N), c=i%N; let s=0; [[0,1],[1,0],[0,-1],[-1,0]].forEach(([dr,dc])=>{ let k=1; while(k<5){ const rr=r+dr*k, cc=c+dc*k; if(rr<0||rr>=N||cc<0||cc>=N||!free(rr*N+cc)) break; k++; } s+=k; }); return s+Math.random()*2; };
      pool.sort((x,y)=>score(y)-score(x)); pool=pool.slice(0,Math.max(1,Math.ceil(pool.length/4))); }
    return {type:'shoot', i:pool[rint(pool.length)]};
  },
  effects(prev,d){
    if(prev.phase==='place' && d.phase==='battle'){ toast('Alla flottor är på plats – striden börjar! ⚓',3000); sfx.turn(); return; }
    const L=d.last; if(!L || (prev.last && prev.last.t===L.t)) return;
    tone(1100,.12,'sawtooth',.035,0,180);
    if(!L.hit) setTimeout(()=>{ hit(0,900,.45,.28); hit(.06,2200,.25,.3); },220);
    else setTimeout(()=>{ hit(0,160,.95,.45); hit(.04,80,.8,.55); tone(70,.5,'sine',.22,0,32); buzz(L.seat===meSeat()?30:[80,40,120]); },220);
    if(L.sunk){ const f=FLEET.find(x=>x.id===L.sunk); setTimeout(()=>{ tone(320,.9,'sawtooth',.06,0,55); toast(`💥 Sänkt: ${L.seat===meSeat()?'motståndarens':'ditt'} ${f.name.toLowerCase()}!`,2600); },500); }
  },
  html(){
    const me=meSeat(), my=G.boards[me], op=G.boards[1-me];
    if(G.phase==='place'){
      if(!my.ready) return gHeadHTML('Placera din flotta – skeppen får inte nudda varandra') + shipsPlaceHTML();
      return gHeadHTML() + `<div class="gwait">⚓ Din flotta är klar! Väntar på att <b>${esc(pname(1-me))}</b> placerar sin…</div>
        <div class="sboards one">${shipsBoardHTML(my, {mine:true, label:'⚓ Din flotta'})}</div><div class="gbtns"><button data-g="unready">✏️ Ändra placering</button></div>`;
    }
    const myTurn=!G.over && G.cur===me && canActG(me);
    const L=G.last;
    let sub = G.over ? '' : myTurn ? (L && L.seat===me && L.hit ? '💥 Träff! Skjut igen' : '🎯 Din tur – välj en ruta att skjuta på') : `⏳ ${esc(bare(pname(G.cur)))} siktar…`;
    return gHeadHTML(sub) + (G.over?gOverHTML(`${esc(pname(G.winner))} sänkte hela flottan på ${G.boards[1-G.winner].shots.length} skott.`):'') +
      `<div class="sboards">${shipsBoardHTML(op,{mine:false, label:`🎯 ${esc(gen(pname(1-me)))} hav`, active:myTurn, reveal:G.over})}${shipsBoardHTML(my,{mine:true, small:true, label:'⚓ Din flotta'})}</div>`;
  },
  mounted(){ shipsFx(); }
};
function shipSegClass(ship,i){ const k=ship.cells.indexOf(i), vert=ship.cells.length>1 && ship.cells[1]-ship.cells[0]===N; return `seg ${vert?'v':'h'} ${k===0?'s0':''} ${k===ship.cells.length-1?'s1':''}`; }
function shipsBoardHTML(b,o){
  const sunk=sunkShips(b), sunkCells=new Set(sunk.flatMap(s=>s.cells)), near=new Set();
  sunk.forEach(s=>s.cells.forEach(i=>neighbors8(i).forEach(n=>near.add(n))));
  let cells='';
  for(let i=0;i<N*N;i++){
    const ship=(b.ships||[]).find(s=>s.cells.includes(i)), shot=b.shots.includes(i);
    let cls='sc', inner='';
    const showShip = ship && (o.mine || sunkCells.has(i) || o.reveal);
    if(showShip) cls+=' ship '+shipSegClass(ship,i)+(sunkCells.has(i)?' sunk':'');
    if(shot && ship){ cls+=' hit'; inner='<i>🔥</i>'; }
    else if(shot){ cls+=' miss'; inner='<i class="dot"></i>'; }
    else if(!o.mine && near.has(i)) cls+=' near';
    const click = !o.mine && o.active && !shot && !near.has(i);
    cells+=`<div class="${cls}${click?' tgt':''}" ${click?`data-g="shoot" data-i="${i}"`:''} data-cell="${o.mine?'m':'o'}${i}">${inner}</div>`;
  }
  const status=FLEET.map(f=>{ const s=(b.ships||[]).find(x=>x.id===f.id); const dead=s && sunkCells.has(s.cells[0]); return `<span class="${dead?'dead':''}" title="${f.name}">${'▮'.repeat(f.len)}</span>`; }).join('');
  return `<div class="sboard ${o.small?'small':''} ${o.active?'active':''}"><div class="slabel">${o.label}<span class="fleet">${status}</span></div>
    <div class="sgrid-wrap"><div class="scolh">${[...COLS].map(c=>`<b>${c}</b>`).join('')}</div><div class="srowh">${Array.from({length:N},(_,k)=>`<b>${k+1}</b>`).join('')}</div>
    <div class="sgrid">${cells}</div></div></div>`;
}
function ensureShipsDraft(){
  if(!shipsDraft || shipsDraft.gid!==G.id){ const mine=G.boards[meSeat()].ships; shipsDraft={gid:G.id, ships:mine?clone(mine):[], sel:null, vert:false, hover:null}; }
  if(!shipsDraft.sel){ const nx=FLEET.find(f=>!shipsDraft.ships.some(s=>s.id===f.id)); shipsDraft.sel=nx?nx.id:null; }
  return shipsDraft;
}
function shipsPlaceHTML(){
  const D=ensureShipsDraft(), sel=FLEET.find(f=>f.id===D.sel);
  let prev=null, prevOk=false;
  if(sel && D.hover!==null){ prev=shipCells(Math.floor(D.hover/N), D.hover%N, sel.len, D.vert); prevOk=canPlace(D.ships, sel.id, prev); }
  let cells='';
  for(let i=0;i<N*N;i++){
    const ship=D.ships.find(s=>s.cells.includes(i));
    let cls='sc place'; if(ship) cls+=' ship '+shipSegClass(ship,i);
    if(prev && prev.includes(i)) cls+= prevOk?' pv-ok':' pv-bad';
    cells+=`<div class="${cls}" data-g="place" data-i="${i}"></div>`;
  }
  const all=D.ships.length===FLEET.length;
  return `<div class="splace">
    <div class="sships">${FLEET.map(f=>{ const placed=D.ships.some(s=>s.id===f.id); return `<button data-g="selship" data-id="${f.id}" class="${D.sel===f.id?'sel':''} ${placed?'done':''}"><span class="mini">${'<i></i>'.repeat(f.len)}</span>${f.name}${placed?' ✓':''}</button>`; }).join('')}</div>
    <div class="sboard big"><div class="sgrid-wrap"><div class="scolh">${[...COLS].map(c=>`<b>${c}</b>`).join('')}</div><div class="srowh">${Array.from({length:N},(_,k)=>`<b>${k+1}</b>`).join('')}</div><div class="sgrid">${cells}</div></div></div>
    <div class="gbtns"><button data-g="rotate">↻ ${D.vert?'Lodrätt':'Vågrätt'}</button><button data-g="randomfleet">🎲 Slumpa</button><button data-g="clearfleet">🧹 Rensa</button>
      <button class="pri" data-g="fleetready" ${all?'':'disabled'}>✅ Klar</button></div>
    <div class="ghint">${sel?`Tryck i rutnätet för att lägga <b>${sel.name.toLowerCase()}</b> (${sel.len} rutor). Tryck på ett utlagt skepp för att flytta det.`:'Alla skepp är utlagda – tryck <b>✅ Klar</b>.'}</div></div>`;
}
function shipsFx(){
  const L=G && G.last; if(!L || L.t===gAnimT || G.phase!=='battle') return; gAnimT=L.t;
  const mineBoard = L.seat!==meSeat();   // motståndaren sköt på min tavla
  const el=document.querySelector(`[data-cell="${mineBoard?'m':'o'}${L.i}"]`); if(!el) return;
  el.classList.add(L.hit?'fx-boom':'fx-splash');
  if(L.hit){ const bd=el.closest('.sboard'); bd && (bd.classList.remove('shake'), void bd.offsetWidth, bd.classList.add('shake'));
    const r=el.getBoundingClientRect(), party=document.getElementById('party');
    for(let k=0;k<(L.sunk?22:12);k++){ const p=document.createElement('div'); p.className='ember'; const a=Math.random()*Math.PI*2, d=20+Math.random()*(L.sunk?90:50);
      p.style.left=(r.left+r.width/2)+'px'; p.style.top=(r.top+r.height/2)+'px'; p.style.setProperty('--dx',Math.cos(a)*d+'px'); p.style.setProperty('--dy',Math.sin(a)*d+'px');
      p.style.background=['#fde047','#fb923c','#ef4444','#fff'][k%4]; party.appendChild(p); setTimeout(()=>p.remove(),700); } }
}

/* =====================================================================
   2) MASTERMIND
   ===================================================================== */
const MMC=[{c:'#ef4444',n:'röd'},{c:'#f59e0b',n:'orange'},{c:'#facc15',n:'gul'},{c:'#22c55e',n:'grön'},{c:'#3b82f6',n:'blå'},{c:'#d946ef',n:'lila'}];
const MM_LEN=4, MM_ROWS=10;
function mmFeedback(code,guess){ let b=0; const cc=[0,0,0,0,0,0], gc=[0,0,0,0,0,0]; for(let k=0;k<MM_LEN;k++){ if(code[k]===guess[k]) b++; else { cc[code[k]]++; gc[guess[k]]++; } } let w=0; for(let k=0;k<6;k++) w+=Math.min(cc[k],gc[k]); return {b,w}; }
const MM_ALL=(()=>{ const a=[]; for(let i=0;i<1296;i++) a.push([Math.floor(i/216)%6,Math.floor(i/36)%6,Math.floor(i/6)%6,i%6]); return a; })();
const validCode = c => Array.isArray(c) && c.length===MM_LEN && c.every(x=>Number.isInteger(x)&&x>=0&&x<6);
const mmMaker = (g,r) => r===0 ? g.starter : 1-g.starter;
KIND.mm = {
  init(){ return {round:0, phase:'set', codes:[null,null], guesses:[[],[]], results:[null,null]}; },
  redact(g,seat){ const r=g.round; if(g.phase==='guess' && mmMaker(g,r)!==seat && g.codes[r]) g.codes[r]=[0,0,0,0]; },
  valid(g){ return isI(g.round,0,1) && ['set','guess','reveal'].includes(g.phase) && isI(g.cur,0,1) && Array.isArray(g.codes) && g.codes.length===2 && g.codes.every(c=>c===null||validCode(c)) &&
    Array.isArray(g.guesses) && g.guesses.length===2 && g.guesses.every(a=>Array.isArray(a) && a.length<=MM_ROWS && a.every(h=>h && validCode(h.g) && isI(h.b,0,4) && isI(h.w,0,4))) &&
    Array.isArray(g.results) && g.results.every(v=>v===null||isI(v,1,MM_ROWS+1)); },
  start(g){ Object.assign(g,this.init()); g.cur=mmMaker(g,0); },
  waitingFor(g){ return g.phase==='reveal' ? null : g.cur; },
  scoreOf(g,i){ const r=[0,1].find(r=>1-mmMaker(g,r)===i); const v=g.results[r]; return v===null?'':v>MM_ROWS?'❌':`${v} gissn.`; },
  apply(g,a,seat){
    const r=g.round, maker=mmMaker(g,r), breaker=1-maker;
    if(a.type==='setcode' && g.phase==='set' && seat===maker && validCode(a.code)){ g.codes[r]=a.code.slice(); g.phase='guess'; g.cur=breaker; g.last={t:Date.now(),type:'set'}; return true; }
    if(a.type==='guess' && g.phase==='guess' && seat===breaker && validCode(a.g)){
      const fb=mmFeedback(g.codes[r],a.g); g.guesses[r].push({g:a.g.slice(),b:fb.b,w:fb.w});
      g.last={t:Date.now(),type:'guess',b:fb.b,w:fb.w};
      if(fb.b===MM_LEN || g.guesses[r].length>=MM_ROWS){ g.results[r]= fb.b===MM_LEN ? g.guesses[r].length : MM_ROWS+1; g.phase='reveal'; g.cur=maker; }
      return true;
    }
    if(a.type==='next' && g.phase==='reveal'){
      if(r===0){ g.round=1; g.phase='set'; g.cur=mmMaker(g,1); }
      else { g.over=true; const [a0,a1]=g.results, b0=1-mmMaker(g,0), b1=1-mmMaker(g,1); g.winner = a0<a1 ? b0 : a1<a0 ? b1 : -1; }
      g.last={t:Date.now(),type:'next'}; return true;
    }
    return false;
  },
  aiSeat(g){ if(g.phase==='reveal') return null; return isAI(g.cur) ? g.cur : null; },
  aiDelay(g){ return g.phase==='set' ? 900 : 1500; },
  ai(g,seat){
    const r=g.round;
    if(g.phase==='set') return {type:'setcode', code:Array.from({length:MM_LEN},()=>rint(6))};
    const hist=g.guesses[r];
    if(!hist.length) return {type:'guess', g: g.ai[seat]==='hard' ? [0,0,1,1].map(x=>(x+rint(6))%6) : Array.from({length:MM_LEN},()=>rint(6))};
    const cand=MM_ALL.filter(c=>hist.every(h=>{ const f=mmFeedback(c,h.g); return f.b===h.b && f.w===h.w; }));
    if(g.ai[seat]==='easy' && Math.random()<.3) return {type:'guess', g:Array.from({length:MM_LEN},()=>rint(6))};
    return {type:'guess', g: cand.length ? cand[rint(cand.length)] : Array.from({length:MM_LEN},()=>rint(6))};
  },
  effects(prev,d){
    const L=d.last; if(!L || (prev.last && prev.last.t===L.t)) return;
    if(L.type==='set'){ sfx.bubble(); }
    if(L.type==='guess'){ for(let k=0;k<L.b;k++) tone(1046,.12,'sine',.09,.25+k*.12); for(let k=0;k<L.w;k++) tone(660,.1,'triangle',.07,.25+(L.b+k)*.12); if(!L.b&&!L.w) tone(220,.2,'triangle',.07,.25);
      if(d.phase==='reveal'){ const r=prev.round, ok=d.results[r]<=MM_ROWS; setTimeout(()=>{ ok ? (sfx.yatzy(), sparkles(24)) : sfx.zero(); toast(ok?`Knäckt på ${d.results[r]} gissningar! 🔓`:'Koden höll – inte knäckt 🔒',3000); },700); } }
  },
  html(){
    const me=meSeat(), r=G.round, maker=mmMaker(G,r), breaker=1-maker;
    if(G.over){ const [a0,a1]=G.results, b0=1-mmMaker(G,0), b1=1-mmMaker(G,1); const f=v=>v>MM_ROWS?'knäckte inte koden':`knäckte koden på ${v} gissningar`;
      return gHeadHTML() + gOverHTML(`${esc(pname(b0))} ${f(a0)}. ${esc(pname(b1))} ${f(a1)}.`) + mmBoardHTML(1,true); }
    let sub;
    if(G.phase==='set') sub = maker===me && canActG(me) ? `🔒 Runda ${r+1} av 2 – hitta på en hemlig kod som ${esc(bare(pname(breaker)))} ska knäcka` : `⏳ ${esc(pname(maker))} hittar på en hemlig kod…`;
    else if(G.phase==='guess') sub = breaker===me && canActG(me) ? `🔮 Runda ${r+1} av 2 – knäck ${esc(gen(pname(maker)))} kod` : `👀 ${esc(bare(pname(breaker)))} försöker knäcka ${maker===me?'din':esc(gen(pname(maker)))} kod`;
    else sub=`Runda ${r+1} klar`;
    let body='';
    if(G.phase==='set' && maker===me && canActG(me)) body = mmInputHTML('setcode');
    else body = mmBoardHTML(r, false) + (G.phase==='guess' && breaker===me && canActG(me) ? mmInputHTML('guess') : '') +
      (G.phase==='reveal' ? `<div class="gbtns"><button class="pri" data-g="mmnext">${r===0?'Nästa runda ›':'Se resultatet 🏁'}</button></div>` : '');
    return gHeadHTML(sub) + body + `<div class="ghint"><span class="mfb inl"><i class="b"></i></span> = rätt färg på rätt plats · <span class="mfb inl"><i class="w"></i></span> = rätt färg men fel plats</div>`;
  }
};
function peg(ci,extra=''){ return ci===null||ci===undefined ? `<span class="peg empty ${extra}"></span>` : `<span class="peg ${extra}" style="--pc:${MMC[ci].c}"></span>`; }
let mmAnimT=null;
function mmBoardHTML(r, final){
  const me=meSeat(), maker=mmMaker(G,r), show = final || G.phase==='reveal' || maker===me || G.over;
  const code=G.codes[r];
  const rows=[];
  for(let k=0;k<MM_ROWS;k++){
    const h=G.guesses[r][k], cur=!h && k===G.guesses[r].length && G.phase==='guess';
    const fb = h ? Array.from({length:MM_LEN},(_,j)=>j<h.b?'<i class="b"></i>':j<h.b+h.w?'<i class="w"></i>':'<i></i>').join('') : '<i></i><i></i><i></i><i></i>';
    const fresh = h && k===G.guesses[r].length-1 && G.last && G.last.type==='guess' && G.last.t!==mmAnimT;
    rows.push(`<div class="mrow ${cur?'cur':''} ${h&&h.b===MM_LEN?'win':''}"><span class="mn">${k+1}</span><span class="mpegs">${h?h.g.map((c,j)=>`<span class="peg ${fresh?'pdrop':''}" style="--pc:${MMC[c].c};animation-delay:${j*70}ms"></span>`).join(''):Array.from({length:MM_LEN},()=>peg(null)).join('')}</span><span class="mfb ${fresh?'fbpop':''}">${fb}</span></div>`);
  }
  const secret = code ? (show ? code.map(c=>peg(c)).join('') : Array.from({length:MM_LEN},()=>'<span class="peg hidden">?</span>').join('')) : Array.from({length:MM_LEN},()=>peg(null)).join('');
  if(G.last && G.last.type==='guess') setTimeout(()=>{ mmAnimT=G&&G.last?G.last.t:null; },0);
  return `<div class="mboard"><div class="msecret"><span>${show&&code?'🔓':'🔒'} ${G.over&&r===1?'Runda 2 – ':''}Hemlig kod</span><span class="mpegs">${secret}</span></div>${rows.join('')}</div>`;
}
function mmInputHTML(kind){
  if(!mmDraft || mmDraft.key!==G.id+kind+G.round+G.guesses[G.round].length) mmDraft={key:G.id+kind+G.round+G.guesses[G.round].length, slots:[null,null,null,null], pos:0};
  const full=mmDraft.slots.every(x=>x!==null);
  return `<div class="minput"><div class="mslots">${mmDraft.slots.map((c,i)=>`<button data-g="mmslot" data-i="${i}" class="${i===mmDraft.pos?'at':''}">${peg(c)}</button>`).join('')}</div>
    <div class="mpal">${MMC.map((c,i)=>`<button data-g="mmcolor" data-c="${i}" aria-label="${c.n}">${peg(i)}</button>`).join('')}</div>
    <div class="gbtns"><button data-g="mmclear">⌫ Rensa</button><button class="pri" data-g="${kind==='setcode'?'mmset':'mmguess'}" ${full?'':'disabled'}>${kind==='setcode'?'🔒 Lås koden':'✓ Gissa'}</button></div></div>`;
}

/* =====================================================================
   3) HÄNGA GUBBE
   ===================================================================== */
const HG_WORDS={
  'Rymden':['RAKET','PLANET','STJÄRNA','KOMET','GALAX','ASTRONAUT','MÅNEN','SATURNUS','JUPITER','MARS','SOLSYSTEM','METEOR','TELESKOP','RYMDSTATION','NEBULOSA','UNIVERSUM','SVART HÅL','NORRSKEN','STJÄRNBILD','RYMDDRÄKT'],
  'Havet':['DELFIN','VAL','MANET','SJÖSTJÄRNA','KORALLREV','BLÄCKFISK','SNÄCKA','HAJ','SKÖLDPADDA','SÄL','FYR','SEGELBÅT','UBÅT','VÅGOR','PÄRLA','SJÖHÄST','TÅNG','ATLANTEN','STRAND','DYKARE'],
  'Djur':['LEOPARD','GIRAFF','ELEFANT','PANDA','KÄNGURU','FLAMINGO','PINGVIN','EKORRE','IGELKOTT','UGGLA','PAPEGOJA','ZEBRA','LODJUR','RÄV','HAMSTER','KANIN','ISBJÖRN','KOALA','TIGER','HÄST'],
  'Skidor':['SLALOM','STÖRTLOPP','SKIDLIFT','PISTE','PULKA','PJÄXOR','STAVAR','PORTAR','SNÖKANON','MÅLGÅNG','GOGGLES','SKIDBACKE','STORSLALOM','HJÄLM','KNÄVÄRMARE','FJÄLLET','LIFTKORT','SNÖFLINGA','BACKHOPP','VALLA'],
  'Mat':['PANNKAKA','KANELBULLE','GLASS','JORDGUBBE','PIZZA','SPAGETTI','KÖTTBULLAR','POPCORN','CHOKLAD','SMÖRGÅS','BLÅBÄR','TACOS','PRINSESSTÅRTA','SEMLA','VÅFFLA','HALLONSAFT','BANAN','APELSIN','MUFFINS','LASAGNE'],
  'Hemma':['SOFFA','LAMPA','KUDDE','TÄCKE','SPEGEL','FÖNSTER','KYLSKÅP','MOBIL','DATOR','GARDIN','TANDBORSTE','NYCKEL','PARAPLY','KLOCKA','BOKHYLLA','TRAPPA','DUSCH','BADKAR','LEKSAK','RYGGSÄCK']
};
const HG_MAX=11, ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ';
const SV_FREQ='EANRTSILDOMKGVHFUPBÄCÖYÅJXZWQ';
const hgSetter = (g,r) => r===0 ? g.starter : 1-g.starter;
const hgWrong = (word,guessed) => guessed.filter(l=>!word.includes(l)).length;
const hgSolved = (word,guessed) => [...word].every(ch=>!ALPHA.includes(ch) || guessed.includes(ch));
function hgClean(w){ return (w||'').toUpperCase().replace(/\s+/g,' ').trim(); }
function hgValid(w){ return /^[A-ZÅÄÖ]+( [A-ZÅÄÖ]+)?$/.test(w) && w.replace(/ /g,'').length>=3 && w.length<=16; }
KIND.hang = {
  init(){ return {round:0, phase:'set', words:[null,null], hints:[null,null], guessed:[[],[]], results:[null,null]}; },
  redact(g,seat){ const r=g.round, w=g.words[r]; if(g.phase==='guess' && hgSetter(g,r)!==seat && w) g.words[r]=[...w].map(ch=>ch===' '||g.guessed[r].includes(ch)?ch:'_').join(''); },
  valid(g){ const okW=w=>w===null||(typeof w==='string' && w.length<=16 && /^[A-ZÅÄÖ _]*$/.test(w)); return isI(g.round,0,1) && ['set','guess','reveal'].includes(g.phase) && isI(g.cur,0,1) &&
    Array.isArray(g.words) && g.words.length===2 && g.words.every(okW) && Array.isArray(g.hints) && g.hints.every(h=>h===null||(typeof h==='string'&&h.length<=24)) &&
    Array.isArray(g.guessed) && g.guessed.length===2 && g.guessed.every(a=>Array.isArray(a) && a.length<=29 && a.every(l=>typeof l==='string' && /^[A-ZÅÄÖ]$/.test(l))) &&
    Array.isArray(g.results) && g.results.every(v=>v===null||isI(v,0,40)); },
  start(g){ Object.assign(g,this.init()); g.cur=hgSetter(g,0); },
  waitingFor(g){ return g.phase==='reveal' ? null : g.cur; },
  scoreOf(g,i){ const r=[0,1].find(r=>1-hgSetter(g,r)===i); const v=g.results[r]; return v===null?'':v>HG_MAX?'💀':`${v} fel`; },
  apply(g,a,seat){
    const r=g.round, setter=hgSetter(g,r), guesser=1-setter;
    if(a.type==='setword' && g.phase==='set' && seat===setter){ const w=hgClean(a.word); if(!hgValid(w)) return false;
      g.words[r]=w; g.hints[r]=String(a.hint||'').slice(0,24); g.phase='guess'; g.cur=guesser; g.last={t:Date.now(),type:'set'}; return true; }
    if(a.type==='letter' && g.phase==='guess' && seat===guesser){ const l=String(a.l||'').toUpperCase(); if(l.length!==1 || !ALPHA.includes(l) || g.guessed[r].includes(l)) return false;
      g.guessed[r].push(l); const w=g.words[r], ok=w.includes(l), wrong=hgWrong(w,g.guessed[r]), solved=hgSolved(w,g.guessed[r]);
      g.last={t:Date.now(),type:'letter',l,ok};
      if(solved || wrong>=HG_MAX){ g.results[r]= solved ? wrong : HG_MAX+1; g.phase='reveal'; g.cur=setter; }
      return true; }
    if(a.type==='next' && g.phase==='reveal'){
      if(r===0){ g.round=1; g.phase='set'; g.cur=hgSetter(g,1); }
      else { g.over=true; const [a0,a1]=g.results, b0=1-hgSetter(g,0), b1=1-hgSetter(g,1); g.winner = a0<a1 ? b0 : a1<a0 ? b1 : -1; }
      g.last={t:Date.now(),type:'next'}; return true; }
    return false;
  },
  aiSeat(g){ if(g.phase==='reveal') return null; return isAI(g.cur) ? g.cur : null; },
  aiDelay(g){ return g.phase==='set' ? 900 : 1100; },
  ai(g,seat){
    const r=g.round;
    if(g.phase==='set'){ const cats=Object.keys(HG_WORDS), cat=cats[rint(cats.length)], list=HG_WORDS[cat]; return {type:'setword', word:list[rint(list.length)], hint:cat}; }
    const w=g.words[r], gs=g.guessed[r];
    const pattern=[...w].map(ch=>ch===' '?' ':gs.includes(ch)?ch:'_');
    const wrongL=gs.filter(l=>!w.includes(l));
    let cands=Object.values(HG_WORDS).flat().filter(x=>x.length===w.length && [...x].every((ch,k)=>pattern[k]==='_' ? (ch!==' ' && !gs.includes(ch)) : ch===pattern[k]) && !wrongL.some(l=>x.includes(l)));
    const cnt={}; cands.forEach(x=>new Set(x).forEach(ch=>{ if(ALPHA.includes(ch) && !gs.includes(ch)) cnt[ch]=(cnt[ch]||0)+1; }));
    let order=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);
    if(!order.length || g.ai[seat]==='easy' && Math.random()<.4) order=[...SV_FREQ].filter(l=>!gs.includes(l)).slice(0, g.ai[seat]==='easy'?14:8);
    if(g.ai[seat]==='easy') order=order.slice(0,Math.min(order.length,4));
    const pick=order[g.ai[seat]==='hard'?0:rint(order.length)] || [...SV_FREQ].find(l=>!gs.includes(l));
    return {type:'letter', l:pick};
  },
  effects(prev,d){
    const L=d.last; if(!L || (prev.last && prev.last.t===L.t)) return;
    if(L.type==='letter'){ L.ok ? (tone(784,.1,'sine',.1), tone(1046,.14,'sine',.08,.08)) : (tone(196,.22,'triangle',.1,0,150), buzz(25));
      if(d.phase==='reveal'){ const r=prev.round, ok=d.results[r]<=HG_MAX; setTimeout(()=>{ ok ? (sfx.yatzy(), sparkles(24)) : (tone(330,.3,'sawtooth',.06,0,110)); toast(ok?'Ordet är löst! 🎉':`Gubben hängdes 😵 Ordet var ${d.words[r]}`,3200); },500); } }
  },
  html(){
    const me=meSeat(), r=G.round, setter=hgSetter(G,r), guesser=1-setter;
    if(G.over){ const [a0,a1]=G.results, b0=1-hgSetter(G,0), b1=1-hgSetter(G,1); const f=v=>v>HG_MAX?'blev hängd':`löste ordet med ${v} fel`;
      return gHeadHTML() + gOverHTML(`${esc(pname(b0))} ${f(a0)}. ${esc(pname(b1))} ${f(a1)}.`) + hgPlayHTML(1,false); }
    if(G.phase==='set'){
      if(setter===me && canActG(me)) return gHeadHTML(`✏️ Runda ${r+1} av 2 – välj ett hemligt ord som ${esc(bare(pname(guesser)))} ska gissa`) + hgSetHTML();
      return gHeadHTML(`⏳ ${esc(pname(setter))} väljer ett hemligt ord…`) + `<div class="gwait big">🤔</div>`;
    }
    const mine = guesser===me && canActG(me) && G.phase==='guess';
    const sub = G.phase==='reveal' ? `Runda ${r+1} klar` : mine ? `🔤 Runda ${r+1} av 2 – gissa ${esc(gen(pname(setter)))} ord` : `👀 ${esc(bare(pname(guesser)))} gissar ${setter===me?'ditt':esc(gen(pname(setter)))} ord`;
    return gHeadHTML(sub) + hgPlayHTML(r, mine) + (G.phase==='reveal' ? `<div class="gbtns"><button class="pri" data-g="hgnext">${r===0?'Nästa runda ›':'Se resultatet 🏁'}</button></div>` : '');
  }
};
function hgSVG(wrong, state){
  const P=[ 'M14 206 Q70 178 126 206', 'M50 200 L50 18', 'M44 20 L150 20', 'M50 54 L84 20', 'M140 20 L140 44',
    'M140 44 m-15 15 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0', 'M140 74 L140 130', 'M140 88 L117 112', 'M140 88 L163 112', 'M140 130 L121 168', 'M140 130 L159 168' ];
  const parts=P.map((d,k)=>k<wrong?`<path d="${d}" class="hp ${k===wrong-1?'new':''} ${k<5?'wood':''}"/>`:'').join('');
  let face='';
  if(wrong>=6){ face = state==='dead' ? '<path d="M132 54 l5 5 m0 -5 l-5 5 M143 54 l5 5 m0 -5 l-5 5" class="hp face"/><path d="M133 67 q7 -5 14 0" class="hp face"/>'
                     : '<circle cx="134.5" cy="57" r="1.8" fill="#16213e"/><circle cx="145.5" cy="57" r="1.8" fill="#16213e"/><path d="M133 64 q7 '+(state==='saved'?'6':'2')+' 14 0" class="hp face"/>'; }
  return `<svg class="hgsvg ${state}" viewBox="0 0 180 214">${parts}${face}</svg>`;
}
function hgPlayHTML(r, mine){
  const w=G.words[r], gs=G.guessed[r], wrong=hgWrong(w,gs), me=meSeat(), setter=hgSetter(G,r);
  const showAll = G.phase==='reveal' || G.over || setter===me;
  const state = G.results[r]!==null ? (G.results[r]>HG_MAX?'dead':'saved') : '';
  const letters=[...w].map((ch,k)=>ch===' '?'<span class="hgsp"></span>':`<span class="hgl ${gs.includes(ch)?'got':''} ${!gs.includes(ch)&&showAll?'miss':''}">${gs.includes(ch)||showAll?ch:''}</span>`).join('');
  const rows=['QWERTYUIOPÅ','ASDFGHJKLÖÄ','ZXCVBNM'];
  const kb = mine ? `<div class="hgkb">${rows.map(row=>`<div>${[...row].map(l=>{ const used=gs.includes(l), ok=used&&w.includes(l); return `<button data-g="hgletter" data-l="${l}" ${used?'disabled':''} class="${used?(ok?'ok':'no'):''}">${l}</button>`; }).join('')}</div>`).join('')}</div>` :
    `<div class="hgused">${gs.length?gs.map(l=>`<span class="${w.includes(l)?'ok':'no'}">${l}</span>`).join(''):'<span class="m">Inga bokstäver gissade än</span>'}</div>`;
  return `<div class="hgwrap"><div class="hgart">${hgSVG(wrong,state)}<div class="hgcount">${wrong} / ${HG_MAX} fel</div></div>
    <div class="hgright">${G.hints[r]?`<div class="hghint">💡 Ledtråd: <b>${esc(G.hints[r])}</b></div>`:''}<div class="hgword">${letters}</div>${kb}</div></div>`;
}
function hgSetHTML(){
  if(!hgDraft || hgDraft.key!==G.id+G.round) hgDraft={key:G.id+G.round, word:'', hint:''};
  const cats=Object.keys(HG_WORDS);
  return `<div class="hgset"><label>Hemligt ord (3–16 bokstäver, A–Ö)</label>
    <input id="hgword" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" value="${esc(hgDraft.word)}" placeholder="t.ex. DELFIN">
    <div class="hgshow"><button data-g="hgpeek">👁 Visa/dölj</button><button data-g="hgrand">🎲 Slumpa ett ord</button></div>
    <label>Ledtråd (valfri)</label><input id="hghint" maxlength="24" value="${esc(hgDraft.hint)}" placeholder="t.ex. Djur">
    <div class="chips">${cats.map(c=>`<button data-g="hgcat" data-c="${c}">${c}</button>`).join('')}</div>
    <div class="gbtns"><button class="pri" data-g="hgset">🔒 Klar</button></div></div>`;
}

/* =====================================================================
   Klick & tangenter för spelen
   ===================================================================== */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-g]'); if(!b || !isKind()) return;
  const k=b.dataset.g, me=meSeat();
  switch(k){
    case 'rematch': doAct({type:'rematch', seat:me}); break;
    // sänka skepp
    case 'shoot': if(canActG(me) && G.cur===me) doAct({type:'shoot', i:+b.dataset.i, seat:me}); break;
    case 'place': { const D=ensureShipsDraft(), i=+b.dataset.i, on=D.ships.find(s=>s.cells.includes(i));
      if(on){ D.ships=D.ships.filter(s=>s!==on); D.sel=on.id; D.vert=on.cells.length>1 && on.cells[1]-on.cells[0]===N; sfx.unbubble(); render(); break; }
      const f=FLEET.find(x=>x.id===D.sel); if(!f) break;
      let cells=shipCells(Math.floor(i/N), i%N, f.len, D.vert);
      if(!cells){ const r=Math.floor(i/N), c=i%N; cells=shipCells(D.vert?N-f.len:r, D.vert?c:N-f.len, f.len, D.vert); }   // skjut in från kanten
      if(!canPlace(D.ships,f.id,cells)){ toast('Skeppen får inte ligga på eller nudda varandra ⚓'); sfx.zero(); break; }
      D.ships.push({id:f.id,len:f.len,cells}); D.sel=null; D.hover=null; sfx.bubble(); render(); break; }
    case 'selship': { const D=ensureShipsDraft(), id=b.dataset.id; const on=D.ships.find(s=>s.id===id); if(on) D.ships=D.ships.filter(s=>s!==on); D.sel=id; render(); break; }
    case 'rotate': { const D=ensureShipsDraft(); D.vert=!D.vert; render(); break; }
    case 'randomfleet': { const D=ensureShipsDraft(); D.ships=randomFleet()||[]; D.sel=null; sfx.roll(); render(); break; }
    case 'clearfleet': { const D=ensureShipsDraft(); D.ships=[]; D.sel=null; render(); break; }
    case 'fleetready': { const D=ensureShipsDraft(); if(validFleet(D.ships)) doAct({type:'ready', ships:D.ships, seat:me}); break; }
    case 'unready': shipsDraft=null; doAct({type:'unready', seat:me}); break;
    // mastermind
    case 'mmcolor': if(mmDraft){ mmDraft.slots[mmDraft.pos]=+b.dataset.c; const nx=mmDraft.slots.findIndex(x=>x===null); mmDraft.pos = nx<0 ? mmDraft.pos : nx; tone(520+(+b.dataset.c)*70,.08,'sine',.1); render(); } break;
    case 'mmslot': if(mmDraft){ const i=+b.dataset.i; if(mmDraft.pos===i && mmDraft.slots[i]!==null) mmDraft.slots[i]=null; mmDraft.pos=i; render(); } break;
    case 'mmclear': if(mmDraft){ mmDraft.slots=[null,null,null,null]; mmDraft.pos=0; render(); } break;
    case 'mmset': if(mmDraft && mmDraft.slots.every(x=>x!==null)) doAct({type:'setcode', code:mmDraft.slots.slice(), seat:me}); break;
    case 'mmguess': if(mmDraft && mmDraft.slots.every(x=>x!==null)) doAct({type:'guess', g:mmDraft.slots.slice(), seat:me}); break;
    case 'mmnext': doAct({type:'next', seat:me}); break;
    // hänga gubbe
    case 'hgletter': doAct({type:'letter', l:b.dataset.l, seat:me}); break;
    case 'hgnext': doAct({type:'next', seat:me}); break;
    case 'hgpeek': { const i=document.getElementById('hgword'); if(i) i.type = i.type==='password'?'text':'password'; break; }
    case 'hgrand': { const cats=Object.keys(HG_WORDS), c=cats[rint(cats.length)], l=HG_WORDS[c]; hgDraft.word=l[rint(l.length)]; hgDraft.hint=c; render(); break; }
    case 'hgcat': { hgDraft.word=(document.getElementById('hgword')||{}).value||hgDraft.word; hgDraft.hint=b.dataset.c; render(); break; }
    case 'hgset': { const w=hgClean((document.getElementById('hgword')||{}).value), h=((document.getElementById('hghint')||{}).value||'').trim();
      if(!hgValid(w)){ toast('Ordet ska vara 3–16 bokstäver A–Ö (högst ett mellanslag) ✏️',3500); break; }
      doAct({type:'setword', word:w, hint:h, seat:me}); break; }
  }
});
document.addEventListener('input',e=>{ if(!hgDraft) return; if(e.target.id==='hgword'){ hgDraft.word=e.target.value; } if(e.target.id==='hghint'){ hgDraft.hint=e.target.value; } });
document.addEventListener('mouseover',e=>{
  if(!isKind() || G.kind!=='ships' || G.phase!=='place') return;
  const c=e.target.closest('[data-g="place"]'); const D=shipsDraft; if(!D) return;
  const i = c ? +c.dataset.i : null; if(i===D.hover) return; D.hover=i;
  document.querySelectorAll('.pv-ok,.pv-bad').forEach(x=>x.classList.remove('pv-ok','pv-bad'));
  const f=FLEET.find(x=>x.id===D.sel); if(!f || i===null) return;
  const cells=shipCells(Math.floor(i/N), i%N, f.len, D.vert); if(!cells) return;
  const ok=canPlace(D.ships,f.id,cells); cells.forEach(k=>document.querySelector(`[data-g="place"][data-i="${k}"]`)?.classList.add(ok?'pv-ok':'pv-bad'));
});
document.addEventListener('keydown',e=>{
  if(view!=='game' || !isKind() || e.ctrlKey || e.metaKey || e.altKey) return;
  if(/INPUT|TEXTAREA/.test((e.target&&e.target.tagName)||'')) return;
  const me=meSeat();
  if(G.kind==='hang' && G.phase==='guess' && canActG(me) && G.cur===me){ const l=e.key.toUpperCase(); if(l.length===1 && ALPHA.includes(l)){ e.preventDefault(); doAct({type:'letter', l, seat:me}); } }
  if(G.kind==='ships' && G.phase==='place' && (e.key==='r'||e.key==='R')){ const D=ensureShipsDraft(); D.vert=!D.vert; render(); }
  if(G.kind==='mm' && mmDraft && /^[1-6]$/.test(e.key)){ document.querySelector(`[data-g="mmcolor"][data-c="${+e.key-1}"]`)?.click(); }
  if(G.kind==='mm' && e.key==='Backspace' && mmDraft){ e.preventDefault(); const i=Math.max(0,(mmDraft.slots.findIndex(x=>x===null)<0?MM_LEN:mmDraft.slots.findIndex(x=>x===null))-1); mmDraft.slots[i]=null; mmDraft.pos=i; render(); }
  if(e.key==='Enter'){ const p=document.querySelector('.gbtns .pri:not(:disabled)'); if(p){ e.preventDefault(); p.click(); } }
});

/* ---------- meny för ett spel ---------- */
let gLevel='easy';
function showGameMenu(kind){
  if(kind==='kina' && typeof showKinaMenu==='function') return showKinaMenu();
  if(kind==='ordfajt' && typeof showOrdfajtMenu==='function') return showOrdfajtMenu();
  const info=GINFO[kind];
  const rules={ships:'Placera fem skepp i hemlighet och turas om att skjuta. Träff = skjut igen. Den som först sänker hela flottan vinner.',
    mm:'Den ena hittar på en hemlig kod med fyra färger, den andra gissar rad för rad. Två rundor – den som knäcker koden på minst gissningar vinner.',
    hang:'Den ena väljer ett hemligt ord, den andra gissar bokstäver. Vid fel ritas galgen upp bit för bit. Två rundor – minst fel vinner.'}[kind];
  openModal(`<h3>${info.icon} ${info.name}</h3><p>${rules}</p>
    <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
    <label>Mot datorn – hur bra är ${esc(info.ai.replace(' 🤖',''))}?</label><div class="seg" id="segg">${gLevelHTML()}</div>
    <div class="btns" style="flex-direction:column"><button class="pri" data-g2="ai" data-k="${kind}">🤖 Spela mot datorn</button>
      <button class="pri" data-g2="host" data-k="${kind}" style="background:linear-gradient(135deg,#f472b6,#a855f7)">🚀 Bjud in en kompis (online)</button>
      <button data-act="close">Avbryt</button></div>`,'gmenu');
}
function gLevelHTML(){ return `<button data-g2="lvl" data-l="easy" class="${gLevel==='easy'?'sel':''}">🐣 Lätt</button><button data-g2="lvl" data-l="hard" class="${gLevel==='hard'?'sel':''}">🧠 Svår</button>`; }
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-g2]'); if(!b) return;
  const k=b.dataset.k, a=b.dataset.g2;
  if(a==='lvl'){ gLevel=b.dataset.l; document.getElementById('segg').innerHTML=gLevelHTML(); sfx.bubble(); return; }
  const n=(document.getElementById('nm')?.value||'').trim();
  if(a==='ai'){ const nm=n||'Du'; lsSet('ry_name',nm); unlockAudio(); startGameLocal(k, nm, gLevel); }
  if(a==='host'){ if(!n){ toast('Skriv ditt namn 🐬'); return; } lsSet('ry_name',n); unlockAudio(); closeModal(); hostGame(n,'free',k); }
});

/* ---------- stil ---------- */
(function(){ const st=document.createElement('style'); st.textContent=`
.ghead{display:flex;align-items:stretch;gap:8px;margin:2px 0 8px}
.gp{flex:1;min-width:0;padding:9px 12px;border-radius:16px;background:var(--glass);border:1px solid var(--line);display:flex;flex-direction:column}
.gp span{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gp span em{font-style:normal;font-size:11px;padding:1px 6px;border-radius:999px;background:rgba(255,211,110,.2);color:var(--gold);margin-left:4px}
.gp b{font-size:13px;color:var(--dim);font-weight:500}
.gp.on{background:linear-gradient(135deg,rgba(34,211,238,.28),rgba(168,85,247,.28));border-color:rgba(125,249,255,.7);box-shadow:0 0 18px rgba(62,230,255,.3)}
.gp.win{border-color:var(--gold);box-shadow:0 0 18px rgba(255,211,110,.45)}
.gvs{align-self:center;font-size:12px;color:var(--dim);font-weight:700}
.gsub{text-align:center;font-size:15px;margin:4px 0 12px;color:#dff6ff;min-height:22px}
.gwait{text-align:center;padding:22px 12px;border-radius:20px;background:var(--glass);border:1px dashed var(--line);margin-bottom:12px}
.gwait.big{font-size:60px;animation:bob 1.6s ease-in-out infinite;border:0;background:none}
.ghint{text-align:center;font-size:12.5px;color:var(--dim);margin:10px 0}
.gbtns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:12px 0}
.gbtns button{padding:12px 16px;border-radius:16px;font-weight:600;font-size:15px;background:var(--glass2);border:1px solid var(--line)}
.gbtns button.pri{background:linear-gradient(135deg,#22d3ee,#6366f1);border:0}
.gbtns button:disabled{opacity:.4}
.gover{text-align:center;padding:16px;border-radius:22px;margin-bottom:12px;border:1px solid var(--line);background:var(--glass)}
.gover.won{background:linear-gradient(135deg,rgba(255,211,110,.22),rgba(168,85,247,.25));border-color:rgba(255,211,110,.6)}
.gover .gi{font-size:46px}.gover h3{margin:4px 0;font-size:24px}.gover p{margin:0;color:#d9e9ff}
/* sänka skepp */
.sboards{display:grid;grid-template-columns:1fr;gap:14px;justify-items:center}
body.desk .sboards:not(.one){grid-template-columns:1.35fr 1fr;align-items:start}
.sboard{width:100%;max-width:440px}
.sboard.small{max-width:300px}
body.desk .sboard{max-width:520px} body.desk .sboard.small{max-width:400px}
.slabel{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--dim);margin:0 0 6px 22px}
.slabel .fleet{display:flex;gap:4px;font-size:9px;letter-spacing:-1px;color:#7dd3fc}.slabel .fleet .dead{color:#ef4444;text-decoration:line-through;opacity:.6}
.sgrid-wrap{display:grid;grid-template-columns:18px 1fr;grid-template-rows:16px 1fr}
.scolh{grid-column:2;display:grid;grid-template-columns:repeat(10,1fr);font-size:10px;color:var(--dim);text-align:center}
.srowh{grid-row:2;display:grid;grid-template-rows:repeat(10,1fr);font-size:10px;color:var(--dim);align-items:center}
.scolh b,.srowh b{font-weight:600}
.sgrid{grid-column:2;grid-row:2;display:grid;grid-template-columns:repeat(10,1fr);gap:2px;padding:3px;border-radius:12px;aspect-ratio:1;
  background:linear-gradient(160deg,#0c4a6e,#082f49);box-shadow:inset 0 0 30px rgba(0,0,0,.45),0 10px 30px rgba(0,0,0,.35);border:1px solid rgba(125,211,252,.35)}
.sboard.active .sgrid{box-shadow:inset 0 0 30px rgba(0,0,0,.45),0 0 0 2px rgba(125,249,255,.6),0 0 30px rgba(62,230,255,.35)}
.sc{position:relative;border-radius:4px;background:radial-gradient(circle at 30% 25%,rgba(125,211,252,.22),rgba(14,116,144,.25));display:grid;place-items:center}
.sc.tgt{cursor:crosshair}
@media (hover:hover){ .sc.tgt:hover{background:rgba(250,204,21,.45);box-shadow:0 0 0 2px #facc15 inset} .sc.place:hover{filter:brightness(1.3)} }
.sc.ship{background:linear-gradient(180deg,#cbd5e1,#64748b);box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}
.sc.ship.h{border-radius:2px}.sc.ship.h.s0{border-radius:12px 3px 3px 12px}.sc.ship.h.s1{border-radius:3px 12px 12px 3px}
.sc.ship.v.s0{border-radius:12px 12px 3px 3px}.sc.ship.v.s1{border-radius:3px 3px 12px 12px}
.sc.ship.sunk{background:linear-gradient(180deg,#57534e,#1c1917)}
.sc.hit{background:radial-gradient(circle,#fb923c,#b91c1c 70%)}
.sc.ship.hit{background:radial-gradient(circle,#fb923c,#7f1d1d 75%)}
.sc i{font-style:normal;font-size:clamp(9px,2.4vw,16px);line-height:1}
.sc .dot{width:28%;height:28%;border-radius:50%;background:#e0f2fe;opacity:.85;box-shadow:0 0 6px #7dd3fc}
.sc.near{background:rgba(14,116,144,.08)}
.sc.near::after{content:'';width:18%;height:18%;border-radius:50%;background:rgba(224,242,254,.3)}
.sc.pv-ok{background:rgba(74,222,128,.55)!important;box-shadow:0 0 0 1px #4ade80 inset}
.sc.pv-bad{background:rgba(248,113,113,.55)!important}
.sc.fx-boom{animation:boom .6s ease}
@keyframes boom{0%{transform:scale(.4);filter:brightness(3)}40%{transform:scale(1.5)}100%{transform:scale(1)}}
.sc.fx-splash::before{content:'';position:absolute;inset:-30%;border-radius:50%;border:2px solid #e0f2fe;animation:splash .7s ease-out forwards}
@keyframes splash{from{transform:scale(.2);opacity:1}to{transform:scale(1.6);opacity:0}}
.sboard.shake{animation:shake .35s ease}
.ember{position:fixed;width:6px;height:6px;margin:-3px;border-radius:50%;pointer-events:none;z-index:50;animation:dr .65s ease-out forwards}
.splace{display:flex;flex-direction:column;align-items:center}
.sships{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:10px}
.sships button{display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:12px;background:rgba(0,0,0,.25);border:1.5px solid var(--line);font-size:13px}
.sships button.sel{border-color:var(--aqua);background:rgba(62,230,255,.16)}
.sships button.done{opacity:.55}
.sships .mini{display:flex;gap:1px}.sships .mini i{width:7px;height:9px;border-radius:2px;background:#94a3b8}
.sboard.big{max-width:460px}
/* mastermind */
.mboard{max-width:420px;margin:0 auto;padding:10px;border-radius:22px;background:linear-gradient(170deg,#3b0764,#1e1b4b);border:1px solid rgba(216,180,254,.35);box-shadow:0 14px 40px rgba(0,0,0,.4)}
.msecret{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin-bottom:8px;border-radius:14px;background:rgba(0,0,0,.35);font-size:13px;color:#e9d5ff}
.mrow{display:grid;grid-template-columns:24px 1fr 46px;align-items:center;gap:8px;padding:5px 8px;border-radius:12px}
.mrow.cur{background:rgba(216,180,254,.14);box-shadow:inset 0 0 0 1px rgba(216,180,254,.5)}
.mrow.win{background:rgba(74,222,128,.18)}
.mn{font-size:12px;color:#c4b5fd;text-align:right}
.mpegs{display:flex;gap:8px;justify-content:center}
.peg{width:30px;height:30px;border-radius:50%;display:inline-grid;place-items:center;background:radial-gradient(circle at 32% 28%,#fff 0 8%,var(--pc) 34%,color-mix(in srgb,var(--pc) 55%,#000) 100%);box-shadow:0 3px 6px rgba(0,0,0,.45),inset 0 -2px 4px rgba(0,0,0,.3)}
.peg.empty{background:radial-gradient(circle,rgba(0,0,0,.55),rgba(0,0,0,.25));box-shadow:inset 0 2px 4px rgba(0,0,0,.6)}
.peg.hidden{background:linear-gradient(135deg,#64748b,#334155);color:#e2e8f0;font-weight:700}
.peg.pdrop{animation:pegdrop .35s cubic-bezier(.3,1.6,.5,1) both}
@keyframes pegdrop{from{transform:translateY(-18px) scale(.5);opacity:0}}
.mfb{display:grid;grid-template-columns:repeat(2,14px);gap:4px;justify-content:center}
.mfb.inl{display:inline-grid;grid-template-columns:14px;vertical-align:-3px}
.mfb.fbpop i{animation:pop .4s ease .32s both}
.mfb i{width:14px;height:14px;border-radius:50%;background:rgba(0,0,0,.28);box-shadow:inset 0 1px 2px rgba(0,0,0,.5)}
.mfb i.b{background:radial-gradient(circle at 35% 30%,#fda4af,#e11d48 60%,#881337);box-shadow:0 0 6px rgba(244,63,94,.8)}
.mfb i.w{background:radial-gradient(circle at 35% 30%,#fff,#cbd5e1)}
.minput{max-width:420px;margin:12px auto 0;padding:12px;border-radius:20px;background:var(--glass);border:1px solid var(--line)}
.mslots{display:flex;justify-content:center;gap:10px;margin-bottom:12px}
.mslots button{padding:4px;border-radius:50%;border:2px solid transparent}
.mslots button.at{border-color:var(--aqua);box-shadow:0 0 12px rgba(62,230,255,.6)}
.mslots .peg{width:40px;height:40px}
.mpal{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
.mpal button{padding:3px;border-radius:50%}.mpal .peg{width:42px;height:42px}
@media (hover:hover){ .mpal button:hover .peg{transform:scale(1.12)} }
/* hänga gubbe */
.hgwrap{display:grid;grid-template-columns:1fr;gap:10px;align-items:center;max-width:720px;margin:0 auto}
body.desk .hgwrap{grid-template-columns:300px 1fr;gap:24px}
.hgart{position:relative;margin:0 auto;width:min(230px,58vw);padding:8px;border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line)}
.hgsvg{width:100%;display:block}
.hgsvg .hp{fill:none;stroke:#e0f2fe;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.hgsvg .hp.wood{stroke:#fcd34d}
.hgsvg .hp.face{stroke:#16213e;stroke-width:2.2}
.hgsvg .hp.new{stroke-dasharray:300;stroke-dashoffset:300;animation:draw .7s ease forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.hgsvg.saved .hp:not(.wood){stroke:#86efac}
.hgsvg.dead .hp:not(.wood):not(.face){stroke:#fca5a5}
.hgsvg path:nth-child(6){fill:#fde68a}
.hgcount{text-align:center;font-size:13px;color:var(--dim);margin-top:2px}
.hghint{text-align:center;font-size:14px;margin-bottom:10px;color:#fde68a}
.hgword{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:6px 0 14px}
.hgl{width:clamp(24px,7.4vw,40px);height:clamp(34px,9.5vw,50px);display:grid;place-items:center;border-bottom:3px solid #7dd3fc;font-size:clamp(18px,5.6vw,30px);font-weight:700}
.hgl.got{animation:pop .45s ease;color:#fff}
.hgl.miss{color:#fca5a5}
.hgsp{width:14px}
.hgkb{display:flex;flex-direction:column;gap:6px;align-items:center}
.hgkb div{display:flex;gap:3px;justify-content:center}
.hgkb button{width:min(44px,calc((100vw - 64px)/11));height:44px;padding:0;border-radius:10px;background:var(--glass2);border:1px solid var(--line);font-weight:700;font-size:16px}
.hgkb button.ok{background:rgba(74,222,128,.35);border-color:#4ade80}
.hgkb button.no{background:rgba(248,113,113,.18);border-color:transparent;opacity:.5}
@media (hover:hover){ .hgkb button:not(:disabled):hover{background:rgba(125,249,255,.25);transform:translateY(-2px)} }
.hgused{display:flex;flex-wrap:wrap;gap:5px;justify-content:center}
.hgused span{padding:4px 8px;border-radius:8px;font-weight:700}.hgused .ok{background:rgba(74,222,128,.3)}.hgused .no{background:rgba(248,113,113,.25);text-decoration:line-through}.hgused .m{color:var(--dim);font-weight:400}
.hgset{max-width:420px;margin:0 auto;padding:16px;border-radius:20px;background:var(--glass);border:1px solid var(--line)}
.hgset label{display:block;font-size:13px;color:var(--dim);margin:10px 2px 5px}
.hgset input{width:100%;padding:13px 14px;border-radius:14px;border:1px solid var(--line);background:rgba(0,0,0,.25);color:var(--txt);font-size:20px;letter-spacing:2px;text-transform:uppercase;outline:none;font-family:inherit}
.hgset #hghint{font-size:16px;letter-spacing:0;text-transform:none}
.hgset .chips{margin-top:8px}.hgshow{display:flex;gap:8px;margin-top:8px}.hgshow button{flex:1;padding:9px;border-radius:12px;background:rgba(0,0,0,.25);border:1px solid var(--line);font-size:13px}
`; document.head.appendChild(st); })();
