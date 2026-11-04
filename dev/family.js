/* =====================================================================
   family.js – Fia och Memory (2–4 spelare, online eller mot datorn)
   ===================================================================== */
'use strict';
(function(){
  const now=()=>Date.now();
  const isInt=(x,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi;
  const st=document.createElement('style'); document.head.appendChild(st); const css=s=>{ st.textContent+=s; };
  const BOTS=['Blixt 🤖','Stjärna 🤖','Komet 🤖'];

  /* =================================================================
     1) FIA – svenska regler: ut på 1 eller 6, sexa ger nytt slag,
        knuffa hem motståndare, exakt slag in i mål, tre försök när
        man inte har någon pjäs ute
     ================================================================= */
  const FCOL=['#ef4444','#3b82f6','#eab308','#22c55e'], FNAME=['röd','blå','gul','grön'];
  const SLOTS={2:[0,2],3:[0,1,2],4:[0,1,2,3]};
  // banan: 40 rutor runt korset på ett 11×11-bräde, medurs
  const PATH=(()=>{ const p=[]; const seg=(r0,c0,dr,dc,n)=>{ for(let k=0;k<n;k++) p.push([r0+dr*k,c0+dc*k]); };
    seg(4,0,0,1,5); seg(3,4,-1,0,4); p.push([0,5]); seg(0,6,1,0,4); p.push([4,6]); seg(4,7,0,1,4); p.push([5,10]); seg(6,10,0,-1,4); p.push([6,6]);
    seg(7,6,1,0,4); p.push([10,5]); seg(10,4,-1,0,4); p.push([6,4]); seg(6,3,0,-1,4); p.push([5,0]); return p; })();
  const LANE=[[[5,1],[5,2],[5,3],[5,4]],[[1,5],[2,5],[3,5],[4,5]],[[5,9],[5,8],[5,7],[5,6]],[[9,5],[8,5],[7,5],[6,5]]];
  const NEST=[[[1,1],[1,2],[2,1],[2,2]],[[1,8],[1,9],[2,8],[2,9]],[[8,8],[8,9],[9,8],[9,9]],[[8,1],[8,2],[9,1],[9,2]]];
  const slotOf=(g,s)=>SLOTS[g.names.length][s];
  const absOf=(g,s,rel)=>(slotOf(g,s)*10+rel)%40;
  function legal(g,s,die){
    const out=[]; const mine=g.pos[s];
    for(let p=0;p<4;p++){ const r=mine[p]; let np;
      if(r===44) continue;
      if(r<0){ if(die!==1&&die!==6) continue; np=0; } else np=r+die;
      if(np>44) continue;
      if(np<44 && mine.some((x,q)=>q!==p && x===np && (np>=40 || x>=0))) continue;   // två egna får inte stå på samma ruta
      out.push(p); }
    return out;
  }
  const active=(g,s)=>g.pos[s].some(x=>x>=0&&x<44);
  const nextSeat=(g,s)=>(s+1)%g.names.length;
  GINFO.fia={name:'Fia', icon:'🎯', ai:BOTS[0], bots:BOTS, max:4, desc:'2–4 spelare · klassiskt med tärning', grad:'linear-gradient(135deg,#ef4444,#3b82f6 40%,#eab308 70%,#22c55e)'};
  KIND.fia={
    init(){ return {pos:[], die:0, phase:'roll', tries:0}; },
    start(g){ g.pos=g.names.map(()=>[-1,-1,-1,-1]); g.die=0; g.phase='roll'; g.tries=0; g.cur=g.starter%g.names.length; },
    valid(g){ const n=g.names.length; if(n<1||n>4) return false; if(g.started===false) return true;
      return n>=2 && Array.isArray(g.pos) && g.pos.length===n && g.pos.every(a=>Array.isArray(a)&&a.length===4&&a.every(x=>isInt(x,-1,44))) && isInt(g.die,0,6) && (g.phase==='roll'||g.phase==='move'); },
    waitingFor(g){ return g.cur; },
    scoreOf(g,i){ const home=(g.pos[i]||[]).filter(x=>x===44).length; return `<span class="fdot" style="background:${FCOL[slotOf(g,i)]}"></span> ${home}/4`; },
    apply(g,a,seat){
      if(a.type==='resign') return KIT.resign(g,seat);
      if(g.over||seat!==g.cur||(g.out||[]).includes(seat)) return false;
      if(a.type==='roll'){ if(g.phase!=='roll') return false;
        g.die=1+rint(6); g.rollT=now(); const L=legal(g,seat,g.die);
        g.last={seat,t:now(),type:'roll',die:g.die};
        if(L.length){ g.phase='move'; return true; }
        if(!active(g,seat) && g.tries<2){ g.tries++; return true; }        // tre försök att komma ut
        g.tries=0; g.phase='roll'; g.cur=nextAlive(g,seat); g.last.pass=true; return true; }
      if(a.type==='move'){ if(g.phase!=='move'||!isInt(a.p,0,3)) return false;
        const L=legal(g,seat,g.die); if(!L.includes(a.p)) return false;
        const r=g.pos[seat][a.p], np = r<0 ? 0 : r+g.die; g.pos[seat][a.p]=np;
        let knocked=null;
        if(np<40){ const ab=absOf(g,seat,np);
          for(let o=0;o<g.names.length;o++){ if(o===seat) continue; g.pos[o]=g.pos[o].map(x=>{ if(x>=0&&x<40&&absOf(g,o,x)===ab){ knocked=o; return -1; } return x; }); } }
        g.last={seat,t:now(),type:'move',p:a.p,from:r,to:np,die:g.die,knocked};
        if(g.pos[seat].every(x=>x===44)){ g.over=true; g.winner=seat; return true; }
        g.tries=0; g.phase='roll';
        if(g.die!==6) g.cur=nextAlive(g,seat);
        return true; }
      return false; },
    aiSeat(g){ return !g.over&&isAI(g.cur)?g.cur:null; },
    aiDelay(g){ return g.phase==='roll'?650:800; },
    ai(g,seat){
      if(g.phase==='roll') return {type:'roll'};
      const L=legal(g,seat,g.die); if(!L.length) return null; const lv=g.ai[seat];
      if(lv==='easy') return {type:'move', p:L[rint(L.length)]};
      const score=p=>{ const r=g.pos[seat][p], np=r<0?0:r+g.die; let v=0;
        if(np===44) v+=60; if(r<0) v+=45; if(np>=40&&r<40) v+=30;
        if(np<40){ const ab=absOf(g,seat,np); for(let o=0;o<g.names.length;o++) if(o!==seat && g.pos[o].some(x=>x>=0&&x<40&&absOf(g,o,x)===ab)) v+=70;
          // fara: motståndare 1–6 rutor bakom
          for(let o=0;o<g.names.length;o++) if(o!==seat) for(const x of g.pos[o]) if(x>=0&&x<40){ const d=(ab-absOf(g,o,x)+40)%40; if(d>=1&&d<=6) v-= lv==='hard'?25:12; } }
        if(r>=0&&r<40){ const ab0=absOf(g,seat,r); for(let o=0;o<g.names.length;o++) if(o!==seat) for(const x of g.pos[o]) if(x>=0&&x<40){ const d=(ab0-absOf(g,o,x)+40)%40; if(d>=1&&d<=6) v+= lv==='hard'?20:8; } }
        v+=np*.5; return v + Math.random()*(lv==='hard'?2:10); };
      return {type:'move', p:L.sort((a,b)=>score(b)-score(a))[0]}; },
    effects(prev,d){ if(!d.last||(prev.last&&prev.last.t===d.last.t)) return;
      if(d.last.type==='roll'){ sfx.roll(); if(d.last.pass) toast(`${pname(d.last.seat)} kunde inte flytta`,1400); }
      else { sfx.pop(); if(d.last.knocked!=null){ sfx.poke(); toast(`💥 ${pname(d.last.seat)} knuffade hem ${pname(d.last.knocked)}!`,2200); } if(d.last.to===44) sparkles(20); } },
    html(){
      const g=G, me=meSeat(), my=!g.over&&g.cur===me&&canActG(me), n=g.names.length;
      const L = my&&g.phase==='move' ? legal(g,me,g.die) : [];
      const at={};   // "r,c" -> [{s,p}]
      for(let s=0;s<n;s++) for(let p=0;p<4;p++){ const r=g.pos[s][p], sl=slotOf(g,s); let rc;
        if(r<0) rc=NEST[sl][p]; else if(r<40) rc=PATH[absOf(g,s,r)]; else if(r<44) rc=LANE[sl][r-40]; else rc=[5,5];
        (at[rc.join(',')]=at[rc.join(',')]||[]).push({s,p}); }
      const kind={}; PATH.forEach((rc,i)=>kind[rc.join(',')]= (i%10===0) ? 'start s'+(i/10) : 'path');
      LANE.forEach((l,sl)=>l.forEach(rc=>kind[rc.join(',')]='lane s'+sl)); NEST.forEach((l,sl)=>l.forEach(rc=>kind[rc.join(',')]='nest s'+sl)); kind['5,5']='goal';
      let cells='';
      for(let r=0;r<11;r++) for(let c=0;c<11;c++){ const k=r+','+c, cl=kind[k]; if(!cl){ cells+='<div></div>'; continue; }
        const ps=at[k]||[]; const pcs = cl==='goal' ? `<div class="fgoal">${[...Array(n).keys()].map(s=>`<i style="color:${FCOL[slotOf(g,s)]}">${'●'.repeat(g.pos[s].filter(x=>x===44).length)}</i>`).join('')}</div>`
          : ps.map(({s,p})=>`<i class="fp ${s===me&&L.includes(p)?'can':''} ${g.last&&g.last.type==='move'&&g.last.seat===s&&g.last.p===p?'moved':''}" data-fia="${s===me?p:''}" style="--pc:${FCOL[slotOf(g,s)]}"></i>`).join('');
        cells+=`<div class="fc ${cl}">${pcs}</div>`; }
      const die=g.die?'⚀⚁⚂⚃⚄⚅'[g.die-1]:'🎲';
      let sub; if(g.over) sub=''; else if(my) sub = g.phase==='roll' ? `<b style="color:var(--gold)">Din tur</b> – slå tärningen${g.tries?` (försök ${g.tries+1} av 3)`:''}` : L.length>1 ? `Du slog ${g.die} – tryck på pjäsen som ska flytta` : `Du slog ${g.die}`;
      else sub=`${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> (${FNAME[slotOf(g,g.cur)]}) ${g.phase==='roll'?'ska slå':`slog ${g.die}`}`;
      return gHeadHTML(sub) + `<div class="fb">${cells}</div>
        ${g.over?gOverHTML('Alla fyra i mål!'):`<div class="fctl"><button class="fdie ${my&&g.phase==='roll'?'go':''}" data-fia="roll" ${my&&g.phase==='roll'?'':'disabled'} style="--pc:${FCOL[slotOf(g,g.cur)]}">${die}</button></div>
        <div class="ghint">Ut med 1 eller 6 · sexa ger ett slag till · landar du på någon åker den hem · exakt slag in i mål. ${KIT.resignHTML()}</div>`}`; },
    mounted(){ // bara ett möjligt drag: gör det åt spelaren
      const g=G, me=meSeat(); clearTimeout(fiaAuto);
      if(!g.over&&g.cur===me&&canActG(me)&&g.phase==='move'){ const L=legal(g,me,g.die); if(L.length===1){ const key=g.seq; fiaAuto=setTimeout(()=>{ if(G&&G.kind==='fia'&&G.seq===key) doAct({type:'move',p:L[0]}); },900); } } }
  };
  function nextAlive(g,s){ let c=s; do{ c=nextSeat(g,c); }while((g.out||[]).includes(c) && c!==s); return c; }
  let fiaAuto=0;
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-fia]'); if(!b||!G||G.kind!=='fia') return; const me=meSeat(); if(G.over||G.cur!==me||!canActG(me)) return;
    const v=b.dataset.fia; if(v==='roll'){ if(G.phase==='roll') doAct({type:'roll'}); return; } if(v===''||G.phase!=='move') return; const p=+v; if(legal(G,me,G.die).includes(p)){ clearTimeout(fiaAuto); doAct({type:'move',p}); } });
  css(`.fb{display:grid;grid-template-columns:repeat(11,1fr);gap:3px;max-width:min(460px,100%,calc(100dvh - 300px));margin:8px auto;padding:8px;border-radius:18px;background:#f8f1dc;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.fc{aspect-ratio:1;border-radius:50%;background:#fff;border:2px solid #cbd5e1;display:grid;place-items:center;position:relative}
.fc.start.s0,.fc.lane.s0,.fc.nest.s0{background:#fecaca;border-color:#ef4444}.fc.start.s1,.fc.lane.s1,.fc.nest.s1{background:#bfdbfe;border-color:#3b82f6}
.fc.start.s2,.fc.lane.s2,.fc.nest.s2{background:#fef08a;border-color:#eab308}.fc.start.s3,.fc.lane.s3,.fc.nest.s3{background:#bbf7d0;border-color:#22c55e}
.fc.goal{border-radius:12px;background:conic-gradient(#3b82f6 0 25%,#eab308 0 50%,#22c55e 0 75%,#ef4444 0);border:0}
.fgoal{font-size:7px;line-height:1;text-align:center;display:flex;flex-direction:column;filter:drop-shadow(0 0 1px #fff)}
.fp{position:absolute;inset:10%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9,transparent 50%),var(--pc);box-shadow:0 2px 4px rgba(0,0,0,.5);border:1.5px solid rgba(0,0,0,.35)}
.fp.can{animation:fpc .7s ease-in-out infinite alternate;cursor:pointer;outline:3px solid #fff;outline-offset:1px}@keyframes fpc{to{transform:scale(1.18)}}
.fp.moved{box-shadow:0 0 0 3px #facc15,0 2px 4px rgba(0,0,0,.5)}
.fctl{display:flex;justify-content:center;margin:6px 0}
.fdie{font-size:56px;line-height:1;width:84px;height:84px;border-radius:20px;background:#fff;color:var(--pc);border:4px solid var(--pc);display:grid;place-items:center}
.fdie.go{animation:fpc .8s ease-in-out infinite alternate}.fdie:disabled{opacity:.85}
.fdot{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle}`);
  GINFO.fia.menu=()=>KIT.menu('fia',{rules:'Slå tärningen och flytta dina fyra pjäser ett varv runt brädet och in i mål. Du kommer ut med en etta eller sexa, och sexa ger ett slag till. Landar du på någon annan åker den hem!', bots:[1,3]});

  /* =================================================================
     2) MEMORY – hitta paren; den som hittar ett par får fortsätta
     ================================================================= */
  const SYMS=['🐬','🐳','🐙','🦀','🐠','🦈','🐢','🪼','🌟','🪐','🚀','🌙','☄️','👽','🛸','🌈','🐆','🦄'];
  const SIZES={16:[4,4],24:[4,6],36:[6,6]};
  let mSize=+(lsGet('kit_memory_size')||16); if(!SIZES[mSize]) mSize=16;
  const seen={};   // datorns minne: speltid -> {index: symbol}
  GINFO.memory={name:'Memory', icon:'🃏', ai:BOTS[0], bots:BOTS, max:4, desc:'Hitta paren · 1–4 spelare', grad:'linear-gradient(135deg,#a855f7,#22d3ee)'};
  KIND.memory={
    init(){ return {size:mSize, cards:[], open:[], owner:[], scores:[], hideNext:false}; },
    start(g){ const n=g.size||16; const syms=KIT.shuffle(SYMS.slice()).slice(0,n/2);
      g.cards=KIT.shuffle([...syms.map((_,i)=>i),...syms.map((_,i)=>i)]); g.sym=syms; g.open=[]; g.owner=new Array(n).fill(-1); g.scores=g.names.map(()=>0); g.hideNext=false; g.cur=g.starter%g.names.length; g.flips=0; },
    redact(g){ g.cards=g.cards.map((c,i)=> g.owner[i]>=0 || g.open.includes(i) ? c : -1); },
    valid(g){ const n=g.names.length; if(n<1||n>4) return false; if(g.started===false) return true; const N=g.cards.length;
      return !!SIZES[N] && g.cards.every(x=>isInt(x,-1,N/2-1)) && Array.isArray(g.sym)&&g.sym.length===N/2&&g.sym.every(s=>SYMS.includes(s))
        && Array.isArray(g.open)&&g.open.length<=2&&g.open.every(i=>isInt(i,0,N-1)) && Array.isArray(g.owner)&&g.owner.length===N&&g.owner.every(x=>isInt(x,-1,n-1)); },
    waitingFor(g){ return g.cur; },
    scoreOf(g,i){ return `${(g.scores||[])[i]||0} par`; },
    apply(g,a,seat){
      if(a.type==='resign') return KIT.resign(g,seat);
      if(g.over||seat!==g.cur||a.type!=='flip'||!isInt(a.i,0,g.cards.length-1)) return false;
      if(g.hideNext){ g.open=[]; g.hideNext=false; }
      if(g.owner[a.i]>=0||g.open.includes(a.i)) return false;
      g.open.push(a.i); g.flips=(g.flips||0)+1; g.last={seat,t:now(),i:a.i};
      if(g.open.length===2){ const [x,y]=g.open;
        if(g.cards[x]===g.cards[y]){ g.owner[x]=g.owner[y]=seat; g.scores[seat]++; g.open=[]; g.last.pair=true;
          if(g.owner.every(o=>o>=0)){ g.over=true; const mx=Math.max(...g.scores); g.winner=g.scores.filter(s=>s===mx).length>1?-1:g.scores.indexOf(mx); } }
        else { g.hideNext=true; g.last.miss=true; let c=seat; do{ c=(c+1)%g.names.length; }while((g.out||[]).includes(c)&&c!==seat); g.cur=c; } }
      return true; },
    aiSeat(g){ return !g.over&&isAI(g.cur)?g.cur:null; },
    aiDelay(g){ return g.hideNext?1500:850; },
    ai(g,seat){
      const mem=seen[g.id]||(seen[g.id]={}), lv=g.ai[seat], keep={easy:.35,medium:.7,hard:.97}[lv]||.7;
      const open = g.hideNext ? [] : g.open;
      const free=[...g.cards.keys()].filter(i=>g.owner[i]<0&&!open.includes(i));
      const known=i=> mem[i]!==undefined && (Math.random()<keep);
      if(open.length===1){ const c=g.cards[open[0]]; const m=free.find(i=>mem[i]===c && known(i)); return {type:'flip', i: m!==undefined?m:free.filter(i=>mem[i]===undefined)[0]??free[rint(free.length)]}; }
      // känt par?
      const by={}; for(const i of free) if(known(i)){ (by[mem[i]]=by[mem[i]]||[]).push(i); }
      for(const k in by) if(by[k].length>=2) return {type:'flip', i:by[k][0]};
      const unk=free.filter(i=>mem[i]===undefined); const pool=unk.length?unk:free; return {type:'flip', i:pool[rint(pool.length)]}; },
    effects(prev,d){
      const mem=seen[d.id]||(seen[d.id]={}); (d.open||[]).forEach(i=>{ if(d.cards[i]>=0) mem[i]=d.cards[i]; });
      if(!d.last||(prev.last&&prev.last.t===d.last.t)) return;
      if(d.last.pair){ sfx.pick(); sparkles(14); } else if(d.last.miss) sfx.unbubble(); else sfx.bubble(); },
    html(){
      const g=G, me=meSeat(), my=!g.over&&g.cur===me&&canActG(me), N=g.cards.length, [rows,cols]=SIZES[N]||[4,4];
      let cells=''; for(let i=0;i<N;i++){ const up=g.owner[i]>=0||g.open.includes(i), c=g.cards[i];
        cells+=`<button class="mc ${up?'up':''} ${g.owner[i]>=0?'got o'+g.owner[i]:''}" data-mem="${i}" ${my&&!up?'':'tabindex="-1"'}><span class="mb"></span><span class="mf">${up&&c>=0?g.sym[c]:''}</span></button>`; }
      const sub = g.over ? '' : my ? `<b style="color:var(--gold)">Din tur</b> – vänd ${g.open.length===1&&!g.hideNext?'ett kort till':'två kort'}` : `${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> vänder…`;
      return gHeadHTML(sub) + `<div class="mg" style="--cols:${cols};--rows:${rows}">${cells}</div>`
        + (g.over ? gOverHTML(g.scores.map((s,i)=>`${esc(bare(g.names[i]))} ${s}`).join(' · ')) : `<div class="ghint">Hittar du ett par får du fortsätta. ${KIT.resignHTML()}</div>`); }
  };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-mem]'); if(!b||!G||G.kind!=='memory') return; const me=meSeat(); if(G.over||G.cur!==me||!canActG(me)) return;
    const i=+b.dataset.mem; if(G.owner[i]>=0||(!G.hideNext&&G.open.includes(i))) return; doAct({type:'flip',i}); });
  css(`.mg{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:8px;max-width:min(520px,100%,calc((100dvh - 270px)*var(--cols)/var(--rows)));margin:10px auto;perspective:800px}
.mc{aspect-ratio:1;position:relative;border:0;padding:0;background:none;transform-style:preserve-3d;transition:transform .35s;cursor:pointer}
.mc.up{transform:rotateY(180deg)}
.mb,.mf{position:absolute;inset:0;border-radius:14px;backface-visibility:hidden;display:grid;place-items:center}
.mb{background:linear-gradient(135deg,#6366f1,#22d3ee);box-shadow:inset 0 0 0 3px rgba(255,255,255,.25),0 4px 10px rgba(0,0,0,.35)}
.mb::after{content:'🐬';font-size:clamp(14px,5vw,28px);opacity:.45}
.mf{transform:rotateY(180deg);background:#fdf6e3;font-size:clamp(22px,9vw,46px);box-shadow:0 4px 10px rgba(0,0,0,.35)}
.mc.got .mf{opacity:.55;box-shadow:inset 0 0 0 4px var(--oc)}.mc.o0{--oc:#22d3ee}.mc.o1{--oc:#f472b6}.mc.o2{--oc:#facc15}.mc.o3{--oc:#22c55e}`);
  const sizeHTML=()=>[[16,'Liten (8 par)'],[24,'Mellan (12)'],[36,'Stor (18)']].map(([n,l])=>`<button data-km="msize" data-k="memory" data-n="${n}" class="${mSize===n?'sel':''}">${l}</button>`).join('');
  GINFO.memory.menu=()=>KIT.menu('memory',{rules:'Vänd två kort i taget och försök hitta paren. Hittar du ett par får du fortsätta. Flest par vinner!', bots:[1,3],
    extra:()=>`<label>Storlek</label><div class="seg" id="memSize">${sizeHTML()}</div>`,
    onClick:(a,b)=>{ if(a!=='msize') return false; mSize=+b.dataset.n; lsSet('kit_memory_size',String(mSize)); document.getElementById('memSize').innerHTML=sizeHTML(); sfx.bubble(); return true; },
    onStart:()=>{} });
  // returmatch och start online: behåll storleken från förra spelet
  const origInit=KIND.memory.init; KIND.memory.init=function(){ const o=origInit(); if(G&&G.kind==='memory'&&G.cards&&SIZES[G.cards.length]&&!memFresh) o.size=G.cards.length; memFresh=false; return o; };
  let memFresh=false; const origMenu=GINFO.memory.menu; GINFO.memory.menu=()=>{ memFresh=true; origMenu(); };
})();
