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
      if(d.last.type==='roll'){ startRoll(); if(d.last.pass) setTimeout(()=>toast(`${pname(d.last.seat)} kunde inte flytta`,1400),720); else if(d.last.die===6) setTimeout(()=>sparkles(10),720); }
      else { sfx.pop(); if(d.last.knocked!=null){ sfx.poke(); toast(`💥 ${pname(d.last.seat)} knuffade hem ${pname(d.last.knocked)}!`,2200); } if(d.last.to===44) sparkles(20); } },
    html(){
      const g=G, me=meSeat(), my=!g.over&&g.cur===me&&canActG(me), n=g.names.length;
      const rolling=rollingNow(); const L = my&&g.phase==='move'&&!rolling ? legal(g,me,g.die) : [];
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
      let sub; if(g.over) sub=''; else if(rolling) sub=`🎲 ${g.cur===me?'Du':esc(bare(pname(g.cur)))} slår…`; else if(my) sub = g.phase==='roll' ? `<b style="color:var(--gold)">Din tur</b> – slå tärningen${g.tries?` (försök ${g.tries+1} av 3)`:''}` : L.length>1 ? `Du slog ${g.die} – tryck på pjäsen som ska flytta` : `Du slog ${g.die}`;
      else sub=`${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> (${FNAME[slotOf(g,g.cur)]}) ${g.phase==='roll'?'ska slå':`slog ${g.die}`}`;
      return gHeadHTML(sub) + `<div class="fb">${cells}</div>
        ${g.over?gOverHTML('Alla fyra i mål!'):`<div class="fctl"><button class="die fia-die ${my&&g.phase==='roll'&&!rolling?'go':''} ${!g.die&&!(my&&g.phase==='roll')?'idle':''} ${rolling?'roll':''}" data-fia="roll" ${my&&g.phase==='roll'&&!rolling?'':'disabled'} style="--pc:${FCOL[slotOf(g,g.cur)]}" aria-label="Tärning"><span class="face">${pips(rolling?1+Math.floor(Math.random()*6):(g.die||6))}</span></button>
          <div class="fturn" style="--pc:${FCOL[slotOf(g,g.cur)]}">${my&&g.phase==='roll'&&!rolling?'Tryck på tärningen!':esc(bare(pname(g.cur)))}</div></div>
        <div class="ghint">Ut med 1 eller 6 · sexa ger ett slag till · landar du på någon åker den hem · exakt slag in i mål. ${KIT.resignHTML()}</div>`}`; },
    mounted(){ // bara ett möjligt drag: gör det åt spelaren
      const g=G, me=meSeat(); clearTimeout(fiaAuto);
      if(rollingNow()) return;
      if(!g.over&&g.cur===me&&canActG(me)&&g.phase==='move'){ const L=legal(g,me,g.die); if(L.length===1){ const key=g.seq; fiaAuto=setTimeout(()=>{ if(G&&G.kind==='fia'&&G.seq===key) doAct({type:'move',p:L[0]}); },900); } } }
  };
  // tärningen ser ut, rullar och låter precis som i Yatzy
  const fiaRoll={until:0, iv:0};
  const rollingNow=()=>performance.now()<fiaRoll.until;
  const pips=v=>{ let p=''; for(let k=0;k<9;k++) p+=`<i class="${PIPS[v].includes(k)?'on':''}"></i>`; return p; };
  function startRoll(){
    clearInterval(fiaRoll.iv); fiaRoll.until=performance.now()+700; sfx.roll(); buzz([10,30,10]);
    fiaRoll.iv=setInterval(()=>{ const d=document.querySelector('.fia-die'); if(d){ d.classList.add('roll'); d.querySelector('.face').innerHTML=pips(1+Math.floor(Math.random()*6)); } },75);
    setTimeout(()=>{ clearInterval(fiaRoll.iv); fiaRoll.until=0; if(G&&G.kind==='fia'&&view==='game') render(); },710);
  }
  function nextAlive(g,s){ let c=s; do{ c=nextSeat(g,c); }while((g.out||[]).includes(c) && c!==s); return c; }
  let fiaAuto=0;
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-fia]'); if(!b||!G||G.kind!=='fia') return; const me=meSeat(); if(G.over||G.cur!==me||!canActG(me)) return;
    const v=b.dataset.fia; if(rollingNow()) return; if(v==='roll'){ if(G.phase==='roll'){ unlockAudio(); doAct({type:'roll'}); } return; } if(v===''||G.phase!=='move') return; const p=+v; if(legal(G,me,G.die).includes(p)){ clearTimeout(fiaAuto); doAct({type:'move',p}); } });
  css(`.fb{display:grid;grid-template-columns:repeat(11,1fr);gap:3px;max-width:min(460px,100%,max(260px,calc(100vh - 370px)));max-width:min(460px,100%,max(260px,calc(100dvh - 370px)));margin:8px auto;padding:8px;border-radius:18px;background:#f8f1dc;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.fc{aspect-ratio:1;border-radius:50%;background:#fff;border:2px solid #cbd5e1;display:grid;place-items:center;position:relative}
.fc.start.s0,.fc.lane.s0,.fc.nest.s0{background:#fecaca;border-color:#ef4444}.fc.start.s1,.fc.lane.s1,.fc.nest.s1{background:#bfdbfe;border-color:#3b82f6}
.fc.start.s2,.fc.lane.s2,.fc.nest.s2{background:#fef08a;border-color:#eab308}.fc.start.s3,.fc.lane.s3,.fc.nest.s3{background:#bbf7d0;border-color:#22c55e}
.fc.goal{border-radius:12px;background:conic-gradient(#3b82f6 0 25%,#eab308 0 50%,#22c55e 0 75%,#ef4444 0);border:0}
.fgoal{font-size:7px;line-height:1;text-align:center;display:flex;flex-direction:column;filter:drop-shadow(0 0 1px #fff)}
.fp{position:absolute;top:10%;right:10%;bottom:10%;left:10%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9,transparent 50%),var(--pc);box-shadow:0 2px 4px rgba(0,0,0,.5);border:1.5px solid rgba(0,0,0,.35)}
.fp.can{animation:fpc .7s ease-in-out infinite alternate;cursor:pointer;outline:3px solid #fff;outline-offset:1px}@keyframes fpc{to{transform:scale(1.18)}}
@media (max-height:720px){.fctl{margin:2px 0}}
.fp.moved{box-shadow:0 0 0 3px #facc15,0 2px 4px rgba(0,0,0,.5)}
.fctl{display:flex;flex-direction:column;align-items:center;gap:8px;margin:8px 0 4px}
.fctl .fia-die{width:78px;border-radius:20px;outline:3px solid var(--pc);outline-offset:4px}
.fctl .fia-die.go{animation:fiago 1s ease-in-out infinite}@keyframes fiago{50%{transform:translateY(-6px) rotate(-4deg)}}
.fctl .fia-die.roll{animation:tumble .14s linear infinite}
.fctl .fia-die:disabled{cursor:default}.fctl .fia-die:disabled:not(.roll):not(.idle){opacity:1}
.fturn{font-size:13px;font-weight:700;color:var(--pc);text-shadow:0 1px 2px rgba(0,0,0,.6)}
.fdot{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle}`);
  GINFO.fia.menu=()=>KIT.menu('fia',{rules:'Slå tärningen och flytta dina fyra pjäser ett varv runt brädet och in i mål. Du kommer ut med en etta eller sexa, och sexa ger ett slag till. Landar du på någon annan åker den hem!', bots:[1,3]});

  /* =================================================================
     2) MEMORY – hitta paren; den som hittar ett par får fortsätta
     ================================================================= */
  const E=s=>[...s.matchAll(/\p{Extended_Pictographic}️?/gu)].map(m=>m[0]);
  const OLD=['🐬','🐳','🐙','🦀','🐠','🦈','🐢','🪼','🌟','🪐','🚀','🌙','☄️','👽','🛸','🌈','🐆','🦄'];   // äldre sparade spel
  // teman: 24 symboler var (räcker till Jätte, 48 kort). Bara emoji upp till Unicode 12, så att äldre iPad/iPhone kan visa dem.
  const THEMES=[
    {id:'havrymd',name:'Hav & rymd',    cost:0, t:['#e0f2fe','#c7d2fe'], sym:E('🐬🐳🐙🦀🐠🦈🐢🌟🪐🚀🌙☄️👽🛸🌈🦄🐡🦑🐚⭐🌍🔭🦞🌊')},
    {id:'djur',   name:'Djur',          cost:0, t:['#fef3c7','#fde68a'], sym:E('🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐧🐴🦄🐝🐢🦒🦓🐘🦔')},
    {id:'frukt',  name:'Frukt & godis', cost:3, t:['#ffe4e6','#fecdd3'], sym:E('🍎🍐🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥥🥝🥑🥕🌽🍕🍔🍟🍩🍪🍭🍦')},
    {id:'fjall',  name:'Fjäll & vinter',cost:6, t:['#f0f9ff','#bae6fd'], sym:E('⛷️🏂🎿⛸️🛷🥌🏔️🌲🎄❄️⛄🦌🐺🦉🐻🐇🎅🔥⛺🧤🧣🥾☕🍫')},
    {id:'sport',  name:'Sport',         cost:10,t:['#dcfce7','#bbf7d0'], sym:E('⚽🏀🏈⚾🎾🏐🏉🥏🎱🏓🏸🏒⛳🏹🥊🛹🚴🏇🤸🧗🏆🎯🥇🛶')},
    {id:'rymd',   name:'Rymden',        cost:14,t:['#ede9fe','#c4b5fd'], sym:E('🚀🛸🛰️👽🤖👾🔭☄️🌌🌠🌍🪐☀️🌙⭐🌈⚡🔮💎🧪🧲📡💡🌋')},
    {id:'fantasi',name:'Fantasi',       cost:18,t:['#fae8ff','#f5d0fe'], sym:E('🦄🐉🧚🧜🧞🧙🏰👑💎🔮🌈🍄🌟🗝️🦋🌸🎠🎪🎈🎁🧸🪁🎀🌙')},
    {id:'fordon', name:'Fordon',        cost:22,t:['#fef9c3','#fde047'], sym:E('🚗🚕🚙🚌🚎🏎️🚓🚑🚒🚐🚚🚜🏍️🛵🚲🛴🚂🚁✈️🚀⛵🚤🛳️🚠')}
  ];
  const BACKS=[{id:'delfin',name:'Delfin',cost:0},{id:'norrsken',name:'Norrsken',cost:0},{id:'stjarnor',name:'Stjärnnatt',cost:4},{id:'retro',name:'Retro',cost:8},{id:'vagor',name:'Vågor',cost:12},{id:'hjartan',name:'Hjärtan',cost:16},{id:'guld',name:'Guld',cost:24}];
  const ALL=new Set([...OLD,...THEMES.flatMap(t=>t.sym)]);
  const SIZES={16:[4,4],24:[4,6],36:[6,6],48:[8,6]};
  let mSize=+(lsGet('kit_memory_size')||16); if(!SIZES[mSize]) mSize=16;
  const mStars=()=>Math.max(0,+lsGet('mem_stars')||0);
  const pickU=(list,k,def)=>{ const it=list.find(x=>x.id===(lsGet(k)||def)); return it&&it.cost<=mStars()?it:list.find(x=>x.id===def); };
  const curTheme=()=>pickU(THEMES,'mem_theme','havrymd'), curBack=()=>pickU(BACKS,'mem_back','delfin');
  const seen={};   // datorns minne: speltid -> {index: symbol}
  let memIntro='', memFx='', memRow={id:'',seat:-1,n:0}, memAward=null;
  GINFO.memory={name:'Memory', icon:'🃏', ai:BOTS[0], bots:BOTS, max:4, desc:'Hitta paren · 1–4 spelare', grad:'linear-gradient(135deg,#a855f7,#22d3ee)'};
  KIND.memory={
    init(){ return {size:mSize, theme:curTheme().id, cards:[], open:[], owner:[], scores:[], hideNext:false}; },
    start(g){ const n=g.size||16, th=THEMES.find(t=>t.id===g.theme)||THEMES[0]; g.theme=th.id; const syms=KIT.shuffle(th.sym.slice()).slice(0,n/2);
      g.cards=KIT.shuffle([...syms.map((_,i)=>i),...syms.map((_,i)=>i)]); g.sym=syms; g.open=[]; g.owner=new Array(n).fill(-1); g.scores=g.names.map(()=>0); g.hideNext=false; g.cur=g.starter%g.names.length; g.flips=0; },
    redact(g){ g.cards=g.cards.map((c,i)=> g.owner[i]>=0 || g.open.includes(i) ? c : -1); },
    valid(g){ const n=g.names.length; if(n<1||n>4) return false; if(g.started===false) return true; const N=g.cards.length;
      return !!SIZES[N] && g.cards.every(x=>isInt(x,-1,N/2-1)) && Array.isArray(g.sym)&&g.sym.length===N/2&&g.sym.every(s=>ALL.has(s)) && (g.theme===undefined||THEMES.some(t=>t.id===g.theme))
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
        if(g.cards[x]===g.cards[y]){ g.owner[x]=g.owner[y]=seat; g.scores[seat]++; g.open=[]; g.last.pair=true; g.last.j=x;
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
      const by={}; for(const i of free) if(known(i)){ (by[mem[i]]=by[mem[i]]||[]).push(i); }
      for(const k in by) if(by[k].length>=2) return {type:'flip', i:by[k][0]};
      const unk=free.filter(i=>mem[i]===undefined); const pool=unk.length?unk:free; return {type:'flip', i:pool[rint(pool.length)]}; },
    effects(prev,d){
      const mem=seen[d.id]||(seen[d.id]={}); (d.open||[]).forEach(i=>{ if(d.cards[i]>=0) mem[i]=d.cards[i]; });
      if(d.over&&!prev.over) memReward(d);
      if(!d.last||(prev.last&&prev.last.t===d.last.t)) return;
      if(d.last.pair){ memRow = memRow.id===d.id&&memRow.seat===d.last.seat ? {id:d.id,seat:d.last.seat,n:memRow.n+1} : {id:d.id,seat:d.last.seat,n:1};
        const c=memRow.n; tone([659,784,988,1175,1319,1568][Math.min(5,c-1)],.2,'sine',.11); tone([988,1175,1319,1568,1760,2093][Math.min(5,c-1)],.28,'triangle',.05,.07);
        setTimeout(()=>{ const a=document.querySelector(`.mc[data-mem="${d.last.i}"]`), b=document.querySelector(`.mc[data-mem="${d.last.j}"]`);
          [a,b].forEach(el=>{ if(!el) return; const r=el.getBoundingClientRect(); memBurst(r.left+r.width/2,r.top+r.height/2); });
          if(c>=2&&a){ const r=a.getBoundingClientRect(); memFloat(r.left+r.width/2,r.top, `${c} i rad!`); } },380); }
      else if(d.last.miss){ memRow={id:d.id,seat:-1,n:0}; sfx.unbubble(); } else sfx.bubble(); },
    html(){
      const g=G, me=meSeat(), my=!g.over&&g.cur===me&&canActG(me), N=g.cards.length, [rows,cols]=SIZES[N]||[4,4], th=THEMES.find(t=>t.id===g.theme)||THEMES[0], bk=curBack();
      const intro=memIntro!==g.id&&!g.flips; if(!g.flips||g.over) memIntro=g.id;
      const fx=g.last?g.id+':'+g.last.t:'', fresh=fx!==memFx; memFx=fx;
      const popA=fresh&&g.last&&g.last.pair?[g.last.i,g.last.j]:[], miss=fresh&&g.last&&g.last.miss?g.open:[];
      let cells=''; for(let i=0;i<N;i++){ const up=g.owner[i]>=0||g.open.includes(i), c=g.cards[i];
        cells+=`<button class="mc ${up?'up':''} ${g.owner[i]>=0?'got o'+g.owner[i]:''} ${intro?'in':''} ${popA.includes(i)?'pop':''} ${miss.includes(i)?'miss':''}" data-mem="${i}" ${intro?`style="animation-delay:${Math.round(i*Math.min(28,700/N))}ms"`:''} ${my&&!up?'':'tabindex="-1"'}><span class="mb"></span><span class="mf"><i>${up&&c>=0?g.sym[c]:''}</i></span></button>`; }
      const sub = g.over ? '' : my ? `<b style="color:var(--gold)">Din tur</b> – vänd ${g.open.length===1&&!g.hideNext?'ett kort till':'två kort'}` : `${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> vänder…`;
      const solo=g.names.length===1, aw=memAward&&memAward.id===g.id?memAward:null;
      const res=solo?`${N/2} par på ${g.flips} vändningar`:g.scores.map((s,i)=>`${esc(bare(g.names[i]))} ${s}`).join(' · ');
      const award=aw?`<div class="mm-aw"><div class="mm-st">${[0,1,2].map(i=>`<span class="${i<aw.stars?'on':''}" style="animation-delay:${.3+i*.3}s">★</span>`).join('')}</div>${aw.why?`<small>${aw.why}</small>`:''}${aw.unl.map(u=>`<div class="mm-new">🔓 Nytt: <b>${u.name}</b> (${u.lab})</div>`).join('')}</div>`:'';
      return gHeadHTML(solo&&!g.over?`${sub} · ${g.flips} vändningar`:sub) + `<div class="mg th-${th.id} bk-${bk.id}" style="--cols:${cols};--rows:${rows};--t1:${th.t[0]};--t2:${th.t[1]}">${cells}</div>`
        + (g.over ? gOverHTML(res+award) : `<div class="ghint">Hittar du ett par får du fortsätta. ${KIT.resignHTML()}</div>`); }
  };
  // stjärnor: ensam efter hur få vändningar, mot datorn efter hur svår den var, online för vinst. Inga stjärnor på samma enhet (flera spelare delar telefonen).
  function memReward(d){ const key=d.id+':'+d.flips; if(lsGet('mem_last')===key) return; lsSet('mem_last',key);
    if(d.hot) return; const me=meSeat(), N=d.cards.length; let s=0, why='';
    if(d.names.length===1){ s=d.flips<=N*1.75?3:d.flips<=N*2.4?2:1; why=s<3?`3 ★ = högst ${Math.floor(N*1.75)} vändningar`:''; }
    else if(mode==='online'){ s=d.winner===me?2:d.winner===-1?1:0; }
    else if(d.winner===me){ const lv=d.ai[1]; s={easy:1,medium:2,hard:3}[lv]||2; why=s<3?'Slå en svårare dator för fler stjärnor':''; }
    else if(d.winner===-1) s=1;
    const before=mStars(), after=before+s; lsSet('mem_stars',String(after));
    const unl=[...THEMES.map(x=>({x,lab:'tema'})),...BACKS.map(x=>({x,lab:'kortbaksida'}))].filter(u=>u.x.cost>before&&u.x.cost<=after).map(u=>({name:u.x.name,lab:u.lab}));
    memAward={id:d.id,stars:s,why,unl}; setTimeout(()=>{ if(G&&G.id===d.id&&view==='game') render(); },60); }
  function memBurst(x,y){ for(let i=0;i<10;i++){ const s=document.createElement('i'), a=Math.random()*6.283, r=24+Math.random()*40; s.className='mm-sp'; s.textContent=Math.random()<.5?'✦':'•';
      s.style.cssText=`left:${x}px;top:${y}px;color:${['#fde047','#fff','#f472b6','#67e8f9'][i%4]};font-size:${9+Math.random()*11}px`; document.body.appendChild(s);
      if(!s.animate){ setTimeout(()=>s.remove(),500); continue; }
      s.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*r}px),calc(-50% + ${Math.sin(a)*r}px))`,opacity:0}],{duration:520+Math.random()*240,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>s.remove(); } }
  function memFloat(x,y,t){ const s=document.createElement('div'); s.className='mm-fl'; s.textContent=t; s.style.left=x+'px'; s.style.top=y+'px'; document.body.appendChild(s); setTimeout(()=>s.remove(),1100); }
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-mem]'); if(!b||!G||G.kind!=='memory') return; const me=meSeat(); if(G.over||G.cur!==me||!canActG(me)) return;
    const i=+b.dataset.mem; if(G.owner[i]>=0||(!G.hideNext&&G.open.includes(i))) return; doAct({type:'flip',i}); });
  css(`.mg{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:7px;max-width:min(520px,100%,max(300px,calc((100vh - 290px)*var(--cols)/var(--rows))));max-width:min(520px,100%,max(300px,calc((100dvh - 290px)*var(--cols)/var(--rows))));margin:10px auto;padding:9px;border-radius:22px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 10px 30px rgba(0,0,0,.25);perspective:900px}
.mc{aspect-ratio:1;position:relative;border:0;padding:0;background:none;transform-style:preserve-3d;transition:transform .42s cubic-bezier(.3,1.3,.5,1);cursor:pointer;container-type:size;-webkit-tap-highlight-color:transparent}
.mc.up{transform:rotateY(180deg)}.mc:not(.up):active{transform:scale(.94)}
.mb,.mf{position:absolute;top:0;right:0;bottom:0;left:0;border-radius:14px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:grid;place-items:center;overflow:hidden}
.mb{background:linear-gradient(135deg,#6366f1,#22d3ee);box-shadow:inset 0 0 0 3px rgba(255,255,255,.28),0 5px 12px rgba(0,0,0,.4)}
.mb::before{content:'';position:absolute;top:9%;right:9%;bottom:9%;left:9%;border-radius:9px;border:1.5px dashed rgba(255,255,255,.35)}
.mb::after{content:var(--em,'🐬');font-size:clamp(14px,5vw,28px);font-size:34cqmin;opacity:.55;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.bk-norrsken .mb{background:radial-gradient(70% 45% at 30% 25%,rgba(52,211,153,.75),transparent 70%),radial-gradient(60% 40% at 80% 20%,rgba(167,139,250,.7),transparent 70%),radial-gradient(1px 1px at 20% 75%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 65%,#fff,transparent),linear-gradient(180deg,#0b1a3a,#132a52)}.bk-norrsken{--em:'✦'}
.bk-stjarnor .mb{background:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 65% 20%,#fff,transparent),radial-gradient(1.5px 1.5px at 80% 70%,#fde047,transparent),radial-gradient(1px 1px at 35% 80%,#fff,transparent),radial-gradient(circle at 50% 120%,#7c3aed,transparent 60%),#1e1b4b}.bk-stjarnor{--em:'🌙'}
.bk-retro .mb{background:conic-gradient(#ef4444 25%,#fff7ed 0 50%,#ef4444 0 75%,#fff7ed 0) 0 0/22% 22%}.bk-retro .mb::before{border:3px solid #fff7ed;background:radial-gradient(circle,#ef4444 30%,transparent 31%)}.bk-retro{--em:''}
.bk-vagor .mb{background:radial-gradient(circle at 50% 100%,transparent 18%,rgba(255,255,255,.25) 19% 22%,transparent 23%) 0 0/34% 25%,linear-gradient(180deg,#0ea5e9,#0369a1)}.bk-vagor{--em:'🐚'}
.bk-hjartan .mb{background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.35),transparent 40%),linear-gradient(135deg,#f472b6,#db2777)}.bk-hjartan{--em:'💖'}
.bk-guld .mb{background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.55) 45%,transparent 55%),linear-gradient(135deg,#fde68a,#d97706 60%,#92400e)}.bk-guld{--em:'★'}.bk-guld .mb::after{color:#78350f;opacity:.7}
.mf{transform:rotateY(180deg);background:radial-gradient(110% 70% at 25% 10%,rgba(255,255,255,.95),transparent 55%),linear-gradient(160deg,var(--t1),var(--t2));box-shadow:inset 0 0 0 1px rgba(0,0,0,.08),0 5px 12px rgba(0,0,0,.35)}
.mf::before{content:'';position:absolute;top:6%;right:6%;bottom:6%;left:6%;border-radius:10px;border:2px solid rgba(255,255,255,.75)}
.mf i{font-style:normal;font-size:clamp(22px,9vw,46px);font-size:60cqmin;line-height:1;font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2))}
.mc.got .mf{box-shadow:0 0 0 3px var(--oc),0 0 14px var(--oc)}.mc.got .mf i{opacity:.9}
.mc.o0{--oc:#22d3ee}.mc.o1{--oc:#f472b6}.mc.o2{--oc:#facc15}.mc.o3{--oc:#22c55e}
.mc.in{animation:mdeal .5s cubic-bezier(.2,.9,.3,1.25) both}@keyframes mdeal{from{transform:translateY(-36px) scale(.5) rotate(-10deg);opacity:0}}
.mc.pop{animation:mpop .55s .25s ease-out}@keyframes mpop{45%{transform:rotateY(180deg) scale(1.16)}}
.mc.miss{animation:mmiss .45s .3s}@keyframes mmiss{20%{transform:rotateY(180deg) translateX(-6px) rotate(-3deg)}60%{transform:rotateY(180deg) translateX(6px) rotate(3deg)}}
.mm-sp{position:fixed;z-index:60;pointer-events:none;font-style:normal;text-shadow:0 0 8px currentColor}
.mm-fl{position:fixed;z-index:61;pointer-events:none;transform:translate(-50%,-50%);font:800 21px 'Fredoka',system-ui,sans-serif;color:#fde047;text-shadow:0 2px 0 #b45309,0 0 12px rgba(253,224,71,.8);white-space:nowrap;animation:mmfl 1.1s ease-out forwards}
@keyframes mmfl{0%{transform:translate(-50%,-30%) scale(.6);opacity:0}20%{transform:translate(-50%,-50%) scale(1.15);opacity:1}100%{transform:translate(-50%,-170%);opacity:0}}
.mm-aw{margin-top:6px}.mm-st{font-size:40px;letter-spacing:6px;line-height:1.1}.mm-st span{display:inline-block;color:rgba(255,255,255,.18);animation:mmst .5s cubic-bezier(.2,.9,.3,1.5) both}.mm-st span.on{color:#fde047;text-shadow:0 0 14px rgba(253,224,71,.8),0 3px 0 #b45309}
@keyframes mmst{from{transform:scale(0) rotate(-90deg);opacity:0}}
.mm-aw small{display:block;opacity:.8;font-size:12px}.mm-new{margin:8px auto 0;padding:7px 10px;border-radius:12px;background:linear-gradient(135deg,rgba(124,58,237,.5),rgba(15,118,110,.5));border:1px solid rgba(255,255,255,.25);font-size:14px}
.mm-pick{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:4px 0 6px}
.mm-pick button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px 5px;border-radius:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:inherit;font-size:11px;line-height:1.15}
.mm-pick button.sel{box-shadow:0 0 0 2px #fde047;background:rgba(253,224,71,.12)}.mm-pick button.lk{opacity:.55}.mm-pick small{font-size:10px;opacity:.85}
.mm-pick .pv{font-size:17px;white-space:nowrap;letter-spacing:-1px;padding:3px 6px;margin-bottom:2px;border-radius:8px;background:linear-gradient(160deg,var(--t1),var(--t2))}
.mm-pick .bv{position:relative;width:30px;height:30px;border-radius:7px;container-type:size}.mm-pick .bv .mb{border-radius:7px}.mm-pick .bv .mb::before{display:none}
.mm-sum{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:6px 0;font-size:14px}.mm-sum button{padding:8px 12px;border-radius:12px}`);
  const sizeHTML=()=>[[16,'Liten'],[24,'Mellan'],[36,'Stor'],[48,'Jätte']].map(([n,l])=>`<button data-km="msize" data-k="memory" data-n="${n}" class="${mSize===n?'sel':''}">${l}<br><small>${n/2} par</small></button>`).join('');
  const themeHTML=()=>{ const tot=mStars(), cur=curTheme(); return THEMES.map(t=>{ const lk=t.cost>tot; return `<button data-km="mtheme" data-k="memory" data-id="${t.id}" class="${t.id===cur.id?'sel':''} ${lk?'lk':''}" style="--t1:${t.t[0]};--t2:${t.t[1]}"><span class="pv">${t.sym.slice(0,2).join('')}</span>${t.name}<small>${lk?`🔒 ${t.cost} ⭐`:t.id===cur.id?'✓':''}</small></button>`; }).join(''); };
  const backHTML=()=>{ const tot=mStars(), cur=curBack(); return BACKS.map(b=>{ const lk=b.cost>tot; return `<button data-km="mback" data-k="memory" data-id="${b.id}" class="${b.id===cur.id?'sel':''} ${lk?'lk':''}"><span class="bv bk-${b.id}"><span class="mb"></span></span>${b.name}<small>${lk?`🔒 ${b.cost} ⭐`:b.id===cur.id?'✓':''}</small></button>`; }).join(''); };
  GINFO.memory.menu=()=>KIT.menu('memory',{rules:'Vänd två kort i taget och försök hitta paren. Hittar du ett par får du fortsätta. Flest par vinner!', bots:[1,3],
    extra:()=>`<div class="mm-sum"><span>⭐ <b>${mStars()}</b> Memory-stjärnor</span><button class="pri" data-km="msolo" data-k="memory">🧠 Träna ensam</button></div>
      <label>Storlek</label><div class="seg" id="memSize">${sizeHTML()}</div>
      <label>Tema</label><div class="mm-pick" id="memTheme">${themeHTML()}</div>
      <label>Kortbaksida</label><div class="mm-pick" id="memBack">${backHTML()}</div>`,
    onClick:(a,b)=>{
      if(a==='msize'){ mSize=+b.dataset.n; lsSet('kit_memory_size',String(mSize)); document.getElementById('memSize').innerHTML=sizeHTML(); sfx.bubble(); return true; }
      if(a==='mtheme'||a==='mback'){ const L=a==='mtheme'?THEMES:BACKS, it=L.find(x=>x.id===b.dataset.id); if(!it) return true;
        if(it.cost>mStars()){ toast(`Låses upp vid ${it.cost} ⭐ – du har ${mStars()}. Stjärnor får du när du tränar ensam eller vinner.`); buzz(20); return true; }
        lsSet(a==='mtheme'?'mem_theme':'mem_back',it.id); document.getElementById('memTheme').innerHTML=themeHTML(); document.getElementById('memBack').innerHTML=backHTML(); sfx.bubble(); return true; }
      if(a==='msolo'){ const nm=(document.getElementById('nm')?.value||'').trim()||'Du'; lsSet('ry_name',nm); unlockAudio(); KIT.startSolo('memory',nm); return true; }
      return false; },
    onStart:()=>{} });
  // returmatch och start online: behåll storleken från förra spelet
  const origInit=KIND.memory.init; KIND.memory.init=function(){ const o=origInit(); if(G&&G.kind==='memory'&&G.cards&&SIZES[G.cards.length]&&!memFresh) o.size=G.cards.length; memFresh=false; return o; };
  let memFresh=false; const origMenu=GINFO.memory.menu; GINFO.memory.menu=()=>{ memFresh=true; origMenu(); };
  window.MEM={THEMES,BACKS,stars:mStars};
})();
