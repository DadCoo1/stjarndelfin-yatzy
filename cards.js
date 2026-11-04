/* =====================================================================
   cards.js – kortspel: Vändtia, Finns i sjön och Hjärter
   Kort: id 0–51, färg = floor(id/13) (♠ ♥ ♦ ♣), valör = id%13 + 2 (2–14, ess = 14)
   Online: motståndarnas händer, högen och dolda kort plockas bort (redact).
   ===================================================================== */
'use strict';
(function(){
  const now=()=>Date.now();
  const isInt=(x,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi;
  const S=['♠','♥','♦','♣'], SN=['spader','hjärter','ruter','klöver'];
  const rk=id=>id%13+2, su=id=>Math.floor(id/13)%4;
  const RN=r=>({11:'J',12:'Q',13:'K',14:'A'})[r]||String(r);
  const RNAME=r=>({2:'tvåor',3:'treor',4:'fyror',5:'femmor',6:'sexor',7:'sjuor',8:'åttor',9:'nior',10:'tior',11:'knektar',12:'damer',13:'kungar',14:'ess'})[r];
  const deck=()=>KIT.shuffle([...Array(52).keys()]);
  const okCards=(a,max)=>Array.isArray(a)&&a.length<=max&&a.every(x=>isInt(x,-1,51));
  const sortHand=h=>h.slice().sort((a,b)=>rk(a)-rk(b)||su(a)-su(b));
  const BOTS=['Blixt 🤖','Stjärna 🤖','Komet 🤖'];
  const st=document.createElement('style'); document.head.appendChild(st); const css=s=>{ st.textContent+=s; };
  function card(id,o={}){
    if(id<0||id==null) return `<div class="pc back ${o.cls||''}" ${o.attr||''}></div>`;
    const r=rk(id), s=su(id); return `<div class="pc ${s===1||s===2?'red':''} ${o.cls||''}" ${o.attr||''}><b>${RN(r)}</b><i>${S[s]}</i><em>${S[s]}</em></div>`;
  }
  css(`.pc{--w:var(--cw,54px);width:var(--w);height:calc(var(--w)*1.42);border-radius:calc(var(--w)*.12);background:linear-gradient(160deg,#fff,#eef4ff);color:#16213e;position:relative;flex:none;box-shadow:0 3px 8px rgba(0,0,0,.35);border:1px solid #cbd5e1;user-select:none;-webkit-user-select:none}
.pc.red{color:#dc2626}
.pc b{position:absolute;left:8%;top:4%;font-size:calc(var(--w)*.34);font-weight:800;line-height:1}
.pc i{position:absolute;left:9%;top:30%;font-style:normal;font-size:calc(var(--w)*.26);line-height:1}
.pc em{position:absolute;right:8%;bottom:6%;font-style:normal;font-size:calc(var(--w)*.62);line-height:1;opacity:.9}
.pc.back{background:repeating-linear-gradient(45deg,#4f46e5 0 6px,#6366f1 6px 12px);border:3px solid #fff}
.pc.back::after{content:'🐬';position:absolute;inset:0;display:grid;place-items:center;font-size:calc(var(--w)*.42);opacity:.8}
.hand{display:flex;justify-content:center;padding:14px 6px 6px;--cw:min(58px,15vw,8.6dvh)}
.hand .pc{margin-left:calc(var(--cw)*var(--ov,-.45));transition:transform .15s}.hand .pc:first-child{margin-left:0}
.hand .pc.can{cursor:pointer}.hand .pc.sel{transform:translateY(-14px);box-shadow:0 0 0 3px #22d3ee,0 6px 14px rgba(0,0,0,.4)}
.hand .pc.no{filter:brightness(.62)}
.opps{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:4px 0}.opps .opp{flex:1 1 98px;max-width:180px}
.opp{background:var(--glass);border:1px solid var(--line);border-radius:14px;padding:6px 10px;min-width:96px;text-align:center;font-size:13px}
.opp.on{border-color:var(--gold);box-shadow:0 0 0 2px rgba(250,204,21,.35)}
.opp .mini{display:flex;justify-content:center;margin-top:4px;--cw:22px}.opp .mini .pc{margin-left:-14px}.opp .mini .pc:first-child{margin-left:0}
.table{display:flex;justify-content:center;align-items:center;gap:14px;min-height:min(120px,16dvh);margin:6px 0;--cw:min(64px,9.5dvh)}
@media (max-height:760px){.opp .mini{display:none}.opp{padding:4px 6px;min-width:0;font-size:12px}.opp small{display:block;font-size:11px;line-height:1.25}.gsub{margin:2px 0 6px}}
.cbtns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:6px 0}
.cbtns button{padding:11px 16px;border-radius:14px;background:var(--glass2);border:1px solid var(--line);font-weight:700}
.cbtns button.pri{background:linear-gradient(135deg,#22c55e,#0ea5e9);border:0}
.cbtns button:disabled{opacity:.35}`);
  // överlapp så att hela handen får plats i bredd
  const handOv=n=>{ if(n<=1) return -.3; const app=document.getElementById('app'), W=Math.min((app&&app.clientWidth||innerWidth)-28,620), w=Math.min(58,innerWidth*.15,innerHeight*.086); return Math.max(-.8,Math.min(-.3,(W-w)/((n-1)*w)-1)).toFixed(3); };
  const opps=(g,me,extra)=>`<div class="opps">${g.names.map((n,i)=>i===me?'':`<div class="opp ${!g.over&&KIND[g.kind].waitingFor(g)===i?'on':''}"><b>${isAI(i)?'🤖 ':''}${esc(bare(n))}</b>${extra(i)}</div>`).join('')}</div>`;
  const nextIdx=(g,s)=>{ let c=s; do{ c=(c+1)%g.names.length; }while((g.out||[]).includes(c)&&c!==s); return c; };

  /* =================================================================
     1) VÄNDTIA – regler enligt Svenska Bridgeförbundets beskrivning
     • 2–8 spelare (två kortlekar från 6 spelare)
     • tre dolda bordskort, tre uppvända ovanpå, tre på hand
     • före start: byt handkort mot egna uppvända, lägg sedan handkort på
       valfri spelares uppvända kort med samma valör
     • den som har lägst kort (trea, 2 och 10 är specialkort) börjar
     • lika eller högre; flera av samma valör på en gång
     • 2 går på allt och börjar om, 10 bränner högen, fyra lika i rad bränner
     • efter bränning lägger samma spelare igen; fyll på till tre från talongen
     • kan man inte lägga: chansa från talongen eller ta upp högen
     • tom hand och talong: uppvända kort, sist de dolda (blint)
     ================================================================= */
  const VT={
    cp(r,pile){ if(r===2||r===10||!pile.length) return true; return r>=rk(pile[pile.length-1]); },
    zone(g,s){ return g.hands[s].length ? 'hand' : g.up[s].some(st=>st.length) ? 'up' : g.down[s].some(c=>c!==null) ? 'down' : null; },
    // kort som får spelas nu (hand eller uppvända), grupperade per valör
    groups(g,s){ const z=VT.zone(g,s); let src=[]; if(z==='hand') src=g.hands[s]; else if(z==='up') src=g.up[s].flat(); else return [];
      const by={}; for(const c of src) (by[rk(c)]=by[rk(c)]||[]).push(c);
      let gs=Object.entries(by).map(([r,cs])=>({r:+r,cs})).filter(x=>VT.cp(x.r,g.pile));
      if(g.first!=null) gs=gs.filter(x=>x.r===g.first);            // första draget: den lägsta valören
      return gs; },
    low(c){ const r=rk(c); return r===2||r===10 ? 99 : r; },          // 3 lägst, 2 och 10 räknas inte
    out(g,s){ return !g.hands[s].length && !g.up[s].some(st=>st.length) && !g.down[s].some(c=>c!==null); },
    refill(g,s){ while(g.hands[s].length<3 && g.deck.length) g.hands[s].push(g.deck.pop()); g.deckN=g.deck.length; },
    burnCheck(g){ const top=g.pile.slice(-4), r=g.pile.length?rk(g.pile[g.pile.length-1]):0; return r===10 || (top.length===4 && top.every(c=>rk(c)===rk(top[0]))); },
    allReady(g){ return g.ready.every((r,s)=>r||(g.out||[]).includes(s)); },
    startPlay(g){ g.phase='play'; let best=99, who=g.names.findIndex((_,s)=>!(g.out||[]).includes(s)); for(let s=0;s<g.names.length;s++){ if((g.out||[]).includes(s)) continue; for(const c of g.hands[s]){ const v=VT.low(c); if(v<best){ best=v; who=s; } } }
      g.cur=who; g.first = best<99 ? best : null; g.last={t:now(),type:'start',seat:who,rank:best<99?best:null}; }
  };
  const okIds=(a,max)=>Array.isArray(a)&&a.length<=max&&a.every(x=>isInt(x,-1,103));
  GINFO.vandtia={name:'Vändtia', icon:'🔟', ai:BOTS[0], bots:[...BOTS,'Nova 🤖','Luna 🤖','Orion 🤖','Vega 🤖'], max:8, desc:'Bli av med korten först · 2–8 spelare', grad:'linear-gradient(135deg,#dc2626,#7c3aed)'};
  KIND.vandtia={
    init(){ return {phase:'setup',hands:[],up:[],down:[],pile:[],deck:[],ready:[],burnt:0}; },
    start(g){ const n=g.names.length, ids=[...Array(n>5?104:52).keys()], d=KIT.shuffle(ids); g.hands=[]; g.up=[]; g.down=[];
      for(let s=0;s<n;s++){ g.down.push(d.splice(0,3)); g.up.push(d.splice(0,3).map(c=>[c])); g.hands.push(d.splice(0,3)); }
      g.deck=d; g.deckN=d.length; g.pile=[]; g.burnt=0; g.out=[]; g.phase='setup'; g.ready=g.names.map(()=>false); g.first=null; g.cur=0; },
    redact(g,seat){ g.hands=g.hands.map((h,s)=>s===seat?h:h.map(()=>-1)); g.down=g.down.map(h=>h.map(c=>c===null?null:-1)); g.deckN=g.deck.length; g.deck=[];
      if(g.last&&g.last.drew!=null&&g.last.seat!==seat&&!g.last.ok) delete g.last.drew; },
    valid(g){ const n=g.names.length; if(n<1||n>8) return false; if(g.started===false) return true;
      return n>=2 && (g.phase==='setup'||g.phase==='play') && Array.isArray(g.hands)&&g.hands.length===n&&g.hands.every(h=>okIds(h,104))
        && Array.isArray(g.up)&&g.up.length===n&&g.up.every(u=>Array.isArray(u)&&u.length===3&&u.every(st=>okIds(st,8)))
        && Array.isArray(g.down)&&g.down.length===n&&g.down.every(d=>Array.isArray(d)&&d.length===3&&d.every(c=>c===null||isInt(c,-1,103)))
        && okIds(g.pile,104) && okIds(g.deck,104) && Array.isArray(g.ready); },
    waitingFor(g){ if(g.phase==='setup'){ const me=meSeat(); if(g.ready[me]===false&&!(g.out||[]).includes(me)) return me; return g.ready.findIndex((r,s)=>!r&&!(g.out||[]).includes(s)); } return g.cur; },
    scoreOf(g,i){ const n=g.hands[i].length+g.up[i].flat().length+g.down[i].filter(c=>c!==null).length; return g.phase==='setup'?(g.ready[i]?'✅ klar':'🔄 byter'):`${n} kort`; },
    apply(g,a,seat){
      if(a.type==='resign'){ const ok=KIT.resign(g,seat); if(ok&&!g.over&&g.phase==='setup'&&VT.allReady(g)) VT.startPlay(g); return ok; }
      if(g.over||(g.out||[]).includes(seat)) return false;
      // ---------- förberedelse (alla samtidigt)
      if(g.phase==='setup'){
        if(g.ready[seat]) return false;
        if(a.type==='swap'){ if(!isInt(a.u,0,2)) return false; const h=g.hands[seat], st=g.up[seat][a.u]; if(!h.includes(a.c)||st.length!==1) return false;
          h[h.indexOf(a.c)]=st[0]; g.up[seat][a.u]=[a.c]; g.last={t:now(),type:'swap',seat}; return true; }
        if(a.type==='stack'){ if(!isInt(a.to,0,g.names.length-1)||!isInt(a.u,0,2)) return false; const h=g.hands[seat], st=g.up[a.to][a.u];
          if(!h.includes(a.c)||!st.length||rk(st[0])!==rk(a.c)) return false;
          h.splice(h.indexOf(a.c),1); st.push(a.c); VT.refill(g,seat); g.last={t:now(),type:'stack',seat,to:a.to,c:a.c}; return true; }
        if(a.type==='ready'){ g.ready[seat]=true; g.last={t:now(),type:'ready',seat}; if(VT.allReady(g)) VT.startPlay(g); return true; }
        return false; }
      // ---------- spelet
      if(seat!==g.cur) return false;
      const z=VT.zone(g,seat); let played=null;
      if(a.type==='take'){ if(!g.pile.length) return false; g.hands[seat].push(...g.pile); g.pile=[]; g.first=null; g.last={seat,t:now(),type:'take'}; g.cur=nextIdx(g,seat); return true; }
      if(a.type==='chance'){ if(!g.deck.length||VT.groups(g,seat).length||z==='down') return false;
        const c=g.deck.pop(); g.deckN=g.deck.length;
        if(VT.cp(rk(c),g.pile)){ g.pile.push(c); const burn=VT.burnCheck(g); if(burn){ g.burnt+=g.pile.length; g.pile=[]; } g.first=null; g.last={seat,t:now(),type:'chance',drew:c,ok:true,burn}; }
        else { g.hands[seat].push(...g.pile,c); g.pile=[]; g.first=null; g.last={seat,t:now(),type:'chance',drew:c,ok:false}; }
        g.cur=nextIdx(g,seat); return true; }
      if(a.type==='play'){ if(z!=='hand'&&z!=='up') return false;
        if(!Array.isArray(a.cards)||!a.cards.length||a.cards.length>8||new Set(a.cards).size!==a.cards.length) return false;
        const r=rk(a.cards[0]); if(!a.cards.every(c=>rk(c)===r)||!VT.cp(r,g.pile)) return false;
        if(g.first!=null && r!==g.first) return false;
        if(z==='hand'){ if(!a.cards.every(c=>g.hands[seat].includes(c))) return false; a.cards.forEach(c=>g.hands[seat].splice(g.hands[seat].indexOf(c),1)); }
        else { const all=g.up[seat].flat(); if(!a.cards.every(c=>all.includes(c))) return false; g.up[seat]=g.up[seat].map(st=>st.filter(c=>!a.cards.includes(c))); }
        g.pile.push(...a.cards); played=a.cards; }
      else if(a.type==='blind'){ if(z!=='down'||!isInt(a.i,0,2)||g.down[seat][a.i]===null) return false;
        const c=g.down[seat][a.i]; g.down[seat][a.i]=null;
        if(!VT.cp(rk(c),g.pile)){ g.hands[seat].push(...g.pile,c); g.pile=[]; g.first=null; g.last={seat,t:now(),type:'blindfail',c}; g.cur=nextIdx(g,seat); return true; }
        g.pile.push(c); played=[c]; }
      else return false;
      g.first=null; VT.refill(g,seat);
      const burn=VT.burnCheck(g);
      g.last={seat,t:now(),type:a.type,cards:played,burn};
      if(burn){ g.burnt+=g.pile.length; g.pile=[]; }
      if(VT.out(g,seat)){ g.over=true; g.winner=seat; return true; }
      if(!burn) g.cur=nextIdx(g,seat);
      return true; },
    aiSeat(g){ if(g.over) return null; if(g.phase==='setup'){ const i=g.ready.findIndex((r,s)=>!r&&isAI(s)&&!(g.out||[]).includes(s)); return i>=0?i:null; } return isAI(g.cur)?g.cur:null; },
    aiDelay(g){ return g.phase==='setup'?350:900; },
    ai(g,seat){ const lv=g.ai[seat];
      const str=c=>{ const r=rk(c); return r===10?20: r===2?19: r; };       // hur stark ett kort är
      if(g.phase==='setup'){ const h=g.hands[seat];
        if(lv!=='easy'){ // starka kort upp på bordet, svaga på hand
          for(let u=0;u<3;u++){ const st=g.up[seat][u]; if(st.length!==1) continue; const best=h.slice().sort((a,b)=>str(b)-str(a))[0]; if(best!=null&&str(best)>str(st[0])) return {type:'swap',c:best,u}; }
          // svaga kort på motståndarnas uppvända, starka på egna
          for(const c of h){ for(let s=0;s<g.names.length;s++){ if(s!==seat && str(c)<=7) for(let u=0;u<3;u++){ const st=g.up[s][u]; if(st.length&&rk(st[0])===rk(c)) return {type:'stack',c,to:s,u}; } }
            if(str(c)>=11) for(let u=0;u<3;u++){ const st=g.up[seat][u]; if(st.length&&rk(st[0])===rk(c)) return {type:'stack',c,to:seat,u}; } } }
        return {type:'ready'}; }
      const z=VT.zone(g,seat);
      if(z==='down'){ const free=[0,1,2].filter(i=>g.down[seat][i]!==null); return {type:'blind', i:free[rint(free.length)]}; }
      const gs=VT.groups(g,seat);
      if(!gs.length){ if(g.deck.length && (lv!=='easy' || Math.random()<.5)) return {type:'chance'}; return {type:'take'}; }
      if(lv==='easy'){ const p=gs[rint(gs.length)]; return {type:'play', cards:Math.random()<.5?p.cs:[p.cs[0]]}; }
      const normal=gs.filter(x=>x.r!==2&&x.r!==10).sort((a,b)=>a.r-b.r);
      let p = normal[0];
      if(lv==='hard'){ const nx=nextIdx(g,seat), left=g.hands[nx].length+g.up[nx].flat().length+g.down[nx].filter(c=>c!==null).length;
        if(left<=3 && normal.length) p=normal[normal.length-1];
        if(!p && g.pile.length>=6) p=gs.find(x=>x.r===10); }
      if(!p) p=gs.find(x=>x.r===2)||gs.find(x=>x.r===10)||gs[0];
      return {type:'play', cards:p.cs}; },
    effects(prev,d){ if(!d.last||(prev.last&&prev.last.t===d.last.t)) return; const L=d.last, who=L.seat===meSeat()?'Du':bare(pname(L.seat));
      if(L.type==='start'){ toast(L.rank?`${who} har lägst kort och börjar`:`${who} börjar`,2200); sfx.turn(); return; }
      if(L.type==='stack'){ sfx.pick(); if(L.to===meSeat()&&L.seat!==meSeat()) toast(`${who} lade ett kort på dina uppvända 😈`,1800); return; }
      if(L.type==='swap'||L.type==='ready'){ sfx.bubble(); return; }
      if(L.burn){ sfx.yatzy(); sparkles(18); toast(`🔥 ${who} brände högen!`,1600); return; }
      if(L.type==='chance'){ L.ok ? (sfx.pick(), toast(`🍀 ${who} chansade – och det gick!`,1700)) : (sfx.unbubble(), toast(`${who} chansade fel och tar upp högen`,1700)); return; }
      if(L.type==='take'||L.type==='blindfail'){ sfx.unbubble(); toast(`${who} tog upp högen`,1500); return; }
      sfx.pick(); },
    html(){
      const g=G, me=meSeat(), sel=vtSel.get();
      const top=g.pile.slice(-3), deckN=g.deckN??g.deck.length;
      const stackHTML=(s,u,o={})=>{ const st=g.up[s][u], dn=g.down[s][u];
        return `<div class="vt-slot ${o.cls||''}" ${o.attr||''}>${dn!==null&&dn!==undefined?card(-1,{cls: o.blind?'can':'', attr:o.blind?`data-vt="blind" data-i="${u}"`:''}):'<div class="pc empty"></div>'}
          ${st.length?`<div class="vt-st">${card(st[st.length-1],{cls:`upc ${o.upcls?o.upcls(st):''}`,attr:o.upattr?o.upattr(st):''})}${st.length>1?`<b class="vt-n">×${st.length}</b>`:''}</div>`:''}</div>`; };
      // ---------- förberedelsen
      if(g.phase==='setup'){
        const mine=g.ready[me]===false && canActG(me), pick=vtPick.get();
        const hc=pick!=null?rk(pick):null;
        const opp=g.names.map((n,s)=>s===me?'':`<div class="opp ${g.ready[s]?'':'on'}"><b>${isAI(s)?'🤖 ':''}${esc(bare(n))}</b> ${g.ready[s]?'✅':'🔄'}<div class="vt-ups">${[0,1,2].map(u=>{ const st=g.up[s][u]; const ok=mine&&hc!=null&&st.length&&rk(st[0])===hc;
            return `<div class="vt-mini ${ok?'tgt':''}" ${ok?`data-vt="stack" data-to="${s}" data-u="${u}"`:''}>${st.length?card(st[st.length-1]):''}${st.length>1?`<b class="vt-n">×${st.length}</b>`:''}</div>`; }).join('')}</div></div>`).join('');
        const myUp=`<div class="vt-mine">${[0,1,2].map(u=>stackHTML(me,u,{upcls:st=>mine&&hc!=null&&(st.length===1||rk(st[0])===hc)?'can':'', upattr:()=>mine?`data-vt="mine" data-u="${u}"`:''})).join('')}</div>`;
        const hand=`<div class="hand" style="--ov:${handOv(g.hands[me].length)}">${sortHand(g.hands[me]).map(c=>card(c,{cls:`${mine?'can':''} ${pick===c?'sel':''}`,attr:`data-vt="pick" data-c="${c}"`})).join('')}</div>`;
        const sub = !mine ? (g.ready[me]?'Väntar på att de andra blir klara…':'') : pick==null ? '<b style="color:var(--gold)">Förbered</b> – tryck på ett handkort' : 'Tryck på ett eget uppvänt kort för att <b>byta</b> – eller på ett kort med samma valör (även andras) för att <b>lägga på</b>';
        return `<div class="gsub">${sub}</div><div class="opps">${opp}</div><div class="vt-lbl">Dina bordskort</div>${myUp}<div class="vt-lbl">Din hand</div>${hand}
          <div class="cbtns">${mine?`<button class="pri" data-vt="ready">✅ Klar – börja spela</button>`:''}</div>
          <div class="ghint">Lägg gärna starka kort (10, 2, ess) bland dina uppvända och svaga kort på motspelarnas. ${KIT.resignHTML()}</div>`; }
      // ---------- spelet
      const my=!g.over&&g.cur===me&&canActG(me), z=VT.zone(g,me);
      const groups = my ? VT.groups(g,me) : [], ok=new Set(groups.flatMap(x=>x.cs));
      const table=`<div class="table"><div class="vt-deck">${deckN?card(-1):'<div class="pc empty"></div>'}<small>${deckN} i talongen</small></div>
        <div class="vt-pile">${top.length?top.map((c,i)=>card(c,{cls:'pl',attr:`style="--i:${i}"`})).join(''):'<div class="pc empty"></div>'}<small>${g.pile.length?`${g.pile.length} i högen`:g.burnt?'🔥 bränd':'tom hög'}</small></div></div>`;
      const myUp=`<div class="vt-mine">${[0,1,2].map(u=>stackHTML(me,u,{blind: my&&z==='down', upcls:st=>z==='up'&&my?(ok.has(st[0])?'can':'no'):'', upattr:st=>`data-vt="c" data-c="${st[0]}"`, cls: z==='up'&&my&&g.up[me][u].some(c=>sel.includes(c))?'selst':''})).join('')}</div>`;
      const hand=`<div class="hand" style="--ov:${handOv(g.hands[me].length)}">${sortHand(g.hands[me]).map(c=>card(c,{cls:`${my&&z==='hand'?(ok.has(c)?'can':'no'):''} ${sel.includes(c)?'sel':''}`,attr:`data-vt="c" data-c="${c}"`})).join('')}</div>`;
      const canPlay = my && sel.length && (z==='hand'||z==='up');
      const canChance = my && !groups.length && deckN>0 && z!=='down';
      let sub; if(g.over) sub=''; else if(my) sub = z==='down' ? 'Dina sista kort ligger dolda – vänd ett och hoppas!' : g.first!=null ? `Du har lägst kort – börja med ${RNAME(g.first)}` : groups.length ? 'Välj kort (samma valör) och tryck Lägg' : deckN ? 'Inget passar – chansa från talongen eller ta upp högen' : 'Inget passar – du måste ta upp högen';
      else sub=`${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> funderar…`;
      return gHeadHTML(sub).replace('class="ghead','class="vt-head ghead') + opps(g,me,i=>`<small>${g.hands[i].length} på hand · ${g.up[i].map(st=>st.length?RN(rk(st[0]))+(st.length>1?'×'+st.length:''):'').filter(Boolean).join(' ')||'–'} · ${g.down[i].filter(c=>c!==null).length} dolda</small>`)
        + table + myUp + hand + (g.over?gOverHTML('Först av med alla kort!'):`<div class="cbtns"><button class="pri" data-vt="play" ${canPlay?'':'disabled'}>Lägg</button>${canChance?`<button data-vt="chance">🍀 Chansa</button>`:''}<button data-vt="take" ${my&&g.pile.length?'':'disabled'}>Ta upp högen</button></div>
        <div class="ghint">Lika eller högre · 2 går på allt och börjar om · 10 bränner högen · fyra lika i rad bränner · efter bränning lägger du igen. ${KIT.resignHTML()}</div>`); }
  };
  const vtSel={ ids:[], gid:null, get(){ if(this.gid!==G.id+':'+G.seq){ this.ids=[]; this.gid=G.id+':'+G.seq; } return this.ids; } };
  const vtPick={ c:null, gid:null, get(){ const k=G.id+':'+(G.hands[meSeat()]||[]).join(); if(this.gid!==k){ this.c=null; this.gid=k; } return this.c; } };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-vt]'); if(!b||!G||G.kind!=='vandtia') return; const me=meSeat(); if(G.over||!canActG(me)) return;
    const a=b.dataset.vt;
    if(G.phase==='setup'){ if(G.ready[me]) return;
      if(a==='pick'){ const c=+b.dataset.c; vtPick.get(); vtPick.c = vtPick.c===c ? null : c; sfx.bubble(); render(); return; }
      if(a==='ready'){ vtPick.c=null; doAct({type:'ready'}); return; }
      const c=vtPick.get(); if(c==null){ toast('Välj ett handkort först'); return; }
      if(a==='stack'){ doAct({type:'stack',c,to:+b.dataset.to,u:+b.dataset.u}); vtPick.c=null; return; }
      if(a==='mine'){ const u=+b.dataset.u, st=G.up[me][u]; if(st.length&&rk(st[0])===rk(c)) doAct({type:'stack',c,to:me,u}); else if(st.length===1) doAct({type:'swap',c,u}); else toast('Högar med flera kort kan inte bytas'); vtPick.c=null; return; }
      return; }
    if(G.cur!==me) return;
    const sel=vtSel.get(), z=VT.zone(G,me);
    if(a==='c'){ const c=+b.dataset.c; const src=z==='hand'?G.hands[me]:z==='up'?G.up[me].flat():[]; if(!src.includes(c)) return;
      // uppvända högar väljs hela på en gång
      const pick = z==='up' ? (G.up[me].find(st=>st.includes(c))||[c]) : [c];
      if(pick.every(x=>sel.includes(x))) pick.forEach(x=>sel.splice(sel.indexOf(x),1));
      else { if(sel.length && rk(sel[0])!==rk(c)) sel.length=0; if(!VT.cp(rk(c),G.pile)){ toast('Den passar inte – lägg lika eller högre'); return; } if(G.first!=null&&rk(c)!==G.first){ toast(`Börja med ${RNAME(G.first)}`); return; } pick.forEach(x=>{ if(!sel.includes(x)) sel.push(x); }); }
      sfx.bubble(); render(); return; }
    if(a==='play'&&sel.length){ doAct({type:'play',cards:sel.slice()}); return; }
    if(a==='take'){ doAct({type:'take'}); return; }
    if(a==='chance'){ doAct({type:'chance'}); return; }
    if(a==='blind'&&z==='down'){ doAct({type:'blind',i:+b.dataset.i}); return; } });
  css(`.vt-deck,.vt-pile{display:flex;flex-direction:column;align-items:center;gap:4px}.vt-deck small,.vt-pile small{font-size:12px;opacity:.7}
.vt-pile{position:relative;min-width:100px}.vt-pile .pc.pl{position:absolute;top:0;left:50%;margin-left:calc(var(--cw)*-.5 + var(--i)*14px - 14px);transform:rotate(calc(var(--i)*6deg - 6deg))}.vt-pile .pc.pl:last-of-type{position:relative;left:auto;margin-left:calc(var(--i)*14px - 14px)}
.pc.empty{background:transparent;border:2px dashed rgba(148,163,184,.35);box-shadow:none}
.vt-mine{display:flex;justify-content:center;gap:18px;--cw:min(52px,13vw,7.5dvh);margin:12px 0 6px}.vt-slot{position:relative}.vt-st{position:absolute;top:-14px;left:12px}
.vt-slot .pc.can{cursor:pointer;outline:3px solid #22d3ee}.vt-slot.selst .upc{transform:translateY(-12px);box-shadow:0 0 0 3px #22d3ee}.vt-slot .pc.no{filter:brightness(.62)}
.vt-n{position:absolute;right:-8px;top:-8px;background:#7c3aed;color:#fff;font-size:11px;border-radius:999px;padding:1px 6px;box-shadow:0 2px 4px rgba(0,0,0,.4)}
.vt-lbl{text-align:center;font-size:12px;opacity:.7;margin-top:4px}
.vt-ups{display:flex;gap:4px;justify-content:center;margin-top:4px;--cw:26px}.vt-mini{position:relative;min-width:26px;min-height:37px;border-radius:5px}.vt-mini.tgt{outline:3px solid #f472b6;outline-offset:2px;cursor:pointer;animation:fpc .7s ease-in-out infinite alternate}
@keyframes fpc{to{transform:scale(1.12)}}`);
  GINFO.vandtia.menu=()=>KIT.menu('vandtia',{rules:'Alla får tre dolda kort, tre uppvända ovanpå och tre på hand. Före start får du byta handkort mot dina uppvända och lägga handkort på vems uppvända kort som helst med samma valör. Lägg lika eller högre – 2 går på allt, 10 bränner högen, fyra lika bränner. Kan du inte lägga chansar du från talongen eller tar upp högen. Först av med alla kort vinner! (Från 6 spelare används två kortlekar.)', bots:[1,7]});

  /* =================================================================
     2) FINNS I SJÖN
     ================================================================= */
  GINFO.fisk={name:'Finns i sjön', icon:'🐟', ai:BOTS[0], bots:BOTS, max:4, desc:'Samla fyrtal · 2–4 spelare', grad:'linear-gradient(135deg,#0ea5e9,#14b8a6)'};
  const FK={ books(g,s){ const by={}; g.hands[s].forEach(c=>(by[rk(c)]=by[rk(c)]||[]).push(c)); let got=[];
      for(const r in by) if(by[r].length===4){ g.hands[s]=g.hands[s].filter(c=>rk(c)!==+r); g.books[s].push(+r); got.push(+r); } return got; },
    refill(g,s){ if(!g.hands[s].length && g.deck.length) g.hands[s].push(g.deck.pop()); g.deckN=g.deck.length; },
    canPlay(g,s){ return g.hands[s].length>0; },
    done(g){ return g.books.reduce((a,b)=>a+b.length,0)===13; },
    advance(g,s){ let c=s; for(let k=0;k<g.names.length;k++){ c=(c+1)%g.names.length; if((g.out||[]).includes(c)) continue; FK.refill(g,c); if(g.hands[c].length) return c; } return -1; } };
  KIND.fisk={
    init(){ return {hands:[],books:[],deck:[],asks:[]}; },
    start(g){ const d=deck(), n=g.names.length, k=n===2?7:5; g.hands=[]; for(let s=0;s<n;s++) g.hands.push(d.splice(0,k)); g.deck=d; g.deckN=d.length; g.books=g.names.map(()=>[]); g.asks=[]; g.cur=g.starter%n; g.out=[];
      g.names.forEach((_,s)=>FK.books(g,s)); },
    redact(g,seat){ g.hands=g.hands.map((h,s)=>s===seat?h:h.map(()=>-1)); g.deckN=g.deck.length; g.deck=[]; if(g.last&&g.last.seat!==seat) delete g.last.drew; },
    valid(g){ const n=g.names.length; if(n<1||n>4) return false; if(g.started===false) return true;
      return n>=2 && Array.isArray(g.hands)&&g.hands.length===n&&g.hands.every(h=>okCards(h,52)) && okCards(g.deck,52) && Array.isArray(g.books)&&g.books.every(b=>Array.isArray(b)&&b.every(r=>isInt(r,2,14))) && Array.isArray(g.asks)&&g.asks.length<=80; },
    waitingFor(g){ return g.cur; },
    scoreOf(g,i){ return `${g.books[i].length} fyrtal`; },
    apply(g,a,seat){
      if(a.type==='resign') return KIT.resign(g,seat);
      if(g.over||seat!==g.cur||a.type!=='ask'||!isInt(a.to,0,g.names.length-1)||a.to===seat||!isInt(a.rank,2,14)) return false;
      if(!g.hands[seat].some(c=>rk(c)===a.rank)||!g.hands[a.to].length||(g.out||[]).includes(a.to)) return false;
      const got=g.hands[a.to].filter(c=>rk(c)===a.rank);
      const L={seat,t:now(),to:a.to,rank:a.rank,got:got.length}; g.asks.push({a:seat,to:a.to,r:a.rank,got:got.length}); if(g.asks.length>80) g.asks.shift();
      let again=false;
      if(got.length){ g.hands[a.to]=g.hands[a.to].filter(c=>rk(c)!==a.rank); g.hands[seat].push(...got); again=true; }
      else if(g.deck.length){ const c=g.deck.pop(); g.hands[seat].push(c); L.drew=c; L.fish=true; if(rk(c)===a.rank){ again=true; L.lucky=true; } }
      else L.fish=true;
      L.books=FK.books(g,seat);
      g.names.forEach((_,s2)=>{ if(!(g.out||[]).includes(s2)) FK.refill(g,s2); });   // den som blivit utan kort drar ett ur sjön direkt
      g.deckN=g.deck.length; g.last=L;
      if(FK.done(g)){ g.over=true; const b=g.books.map(x=>x.length), mx=Math.max(...b); g.winner=b.filter(x=>x===mx).length>1?-1:b.indexOf(mx); return true; }
      if(again){ FK.refill(g,seat); if(g.hands[seat].length) return true; }
      const nx=FK.advance(g,seat); if(nx<0){ g.over=true; const b=g.books.map(x=>x.length), mx=Math.max(...b); g.winner=b.filter(x=>x===mx).length>1?-1:b.indexOf(mx); } else g.cur=nx;
      return true; },
    aiSeat(g){ return !g.over&&isAI(g.cur)?g.cur:null; },
    aiDelay(){ return 1100; },
    ai(g,seat){ const lv=g.ai[seat], mine=[...new Set(g.hands[seat].map(rk))], opp=g.names.map((_,i)=>i).filter(i=>i!==seat&&g.hands[i].length&&!(g.out||[]).includes(i));
      if(!mine.length||!opp.length) return null;
      // vem har frågat efter vad (och inte blivit av med det sedan)?
      const knows = lv==='hard'?1: lv==='medium'?.6:.15; const hint=[];
      for(let k=g.asks.length-1;k>=0;k--){ const q=g.asks[k]; if(q.a===seat||!mine.includes(q.r)||!opp.includes(q.a)) continue;
        const later=g.asks.slice(k+1).some(x=>x.to===q.a&&x.r===q.r&&x.got) || g.books.some(b=>b.includes(q.r)); if(!later) hint.push(q); }
      if(hint.length && Math.random()<knows){ const q=hint[0]; return {type:'ask', to:q.a, rank:q.r}; }
      const cnt={}; g.hands[seat].forEach(c=>cnt[rk(c)]=(cnt[rk(c)]||0)+1);
      const r = lv==='easy' ? mine[rint(mine.length)] : mine.sort((a,b)=>cnt[b]-cnt[a])[0];
      return {type:'ask', to:opp[rint(opp.length)], rank:r}; },
    effects(prev,d){ if(!d.last||(prev.last&&prev.last.t===d.last.t)) return; const L=d.last, me=meSeat();
      const who=L.seat===me?'Du':bare(pname(L.seat)), whom=L.to===me?'dig':bare(pname(L.to));
      if(L.got) { sfx.pick(); toast(`${who} fick ${L.got} ${RNAME(L.rank)} av ${whom}`,2000); }
      else { sfx.bubble(); toast(`${who} frågade ${whom} efter ${RNAME(L.rank)} – finns i sjön! 🐟${L.lucky?' Och drog rätt!':''}`,2200); }
      if(L.books&&L.books.length){ sparkles(20); sfx.yatzy(); } },
    html(){
      const g=G, me=meSeat(), my=!g.over&&g.cur===me&&canActG(me), sel=fkSel;
      if(sel.gid!==g.id) { sel.gid=g.id; sel.r=null; sel.to=null; }
      const mineR=[...new Set(g.hands[me].map(rk))]; if(!mineR.includes(sel.r)) sel.r=null;
      const targets=g.names.map((_,i)=>i).filter(i=>i!==me&&g.hands[i].length&&!(g.out||[]).includes(i)); if(!targets.includes(sel.to)) sel.to=targets.length===1?targets[0]:null;
      const hand=`<div class="hand" style="--ov:${handOv(g.hands[me].length)}">${sortHand(g.hands[me]).map(c=>card(c,{cls:`${my?'can':''} ${sel.r===rk(c)?'sel':''}`,attr:`data-fk="r" data-r="${rk(c)}"`})).join('')}</div>`;
      const books=`<div class="fk-books">${g.books.map((b,i)=>b.length?`<div><b>${i===me?'Du':esc(bare(g.names[i]))}:</b> ${b.map(r=>RN(r)).join(' ')}</div>`:'').join('')}</div>`;
      const L=g.last; const lastTxt = L ? `${L.seat===me?'Du':esc(bare(pname(L.seat)))} frågade ${L.to===me?'dig':esc(bare(pname(L.to)))} efter ${RNAME(L.rank)}: ${L.got?`fick ${L.got} st 🎉`:'finns i sjön 🐟'}${L.drew!=null&&L.seat===me?` – du drog ${RN(rk(L.drew))}${S[su(L.drew)]}`:''}` : '';
      let sub; if(g.over) sub=''; else if(my) sub = sel.r ? `Fråga ${targets.length>1&&sel.to==null?'någon':esc(bare(pname(sel.to)))} efter ${RNAME(sel.r)}` : '<b style="color:var(--gold)">Din tur</b> – välj ett kort du vill ha fler av';
      else sub=`${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> funderar…`;
      return gHeadHTML(sub) + opps(g,me,i=>`<div class="mini">${g.hands[i].slice(0,7).map(()=>card(-1)).join('')}</div><small>${g.hands[i].length} kort${my&&sel.r&&targets.includes(i)?'':''}</small>${my&&targets.length>1&&targets.includes(i)?`<div><button class="fk-to ${sel.to===i?'sel':''}" data-fk="to" data-to="${i}">${sel.to===i?'✅':'👉'} Fråga</button></div>`:''}`)
        + `<div class="table"><div class="vt-deck">${(g.deckN??g.deck.length)?card(-1):'<div class="pc empty"></div>'}<small>🌊 ${g.deckN??g.deck.length} i sjön</small></div><div class="fk-last">${lastTxt}</div></div>`
        + books + hand + (g.over?gOverHTML(g.books.map((b,i)=>`${esc(bare(g.names[i]))} ${b.length}`).join(' · ')):`<div class="cbtns"><button class="pri" data-fk="ask" ${my&&sel.r&&sel.to!=null?'':'disabled'}>Har du några ${sel.r?RNAME(sel.r):'…'}?</button></div>
        <div class="ghint">Fråga efter en valör du själv har. Får du kort fortsätter du, annars drar du ur sjön. Fyra lika blir ett fyrtal – flest fyrtal vinner. ${KIT.resignHTML()}</div>`); }
  };
  const fkSel={gid:null,r:null,to:null};
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-fk]'); if(!b||!G||G.kind!=='fisk') return; const me=meSeat(); if(G.over||G.cur!==me||!canActG(me)) return;
    const a=b.dataset.fk; if(a==='r'){ fkSel.r=+b.dataset.r; sfx.bubble(); render(); return; } if(a==='to'){ fkSel.to=+b.dataset.to; sfx.bubble(); render(); return; }
    if(a==='ask'&&fkSel.r&&fkSel.to!=null){ doAct({type:'ask',to:fkSel.to,rank:fkSel.r}); } });
  css(`.fk-last{max-width:200px;font-size:13.5px;line-height:1.4;opacity:.9}.fk-books{display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:center;font-size:13px;margin:4px 0}
.fk-to{margin-top:4px;padding:5px 10px;border-radius:10px;border:1px solid var(--line);font-size:12.5px}.fk-to.sel{border-color:#22c55e;background:rgba(34,197,94,.18)}`);
  GINFO.fisk.menu=()=>KIT.menu('fisk',{rules:'Fråga en motspelare efter en valör du själv har, t.ex. ”Har du några åttor?”. Får du dem fortsätter du – annars säger de ”finns i sjön!” och du drar ett kort. Samla fyra lika – flest fyrtal vinner!', bots:[1,3]});

  /* =================================================================
     3) HJÄRTER – fyra spelare (tomma platser fylls med datorspelare)
     ================================================================= */
  const QS=10, C2=39, TARGET=50;     // spader dam, klöver 2
  const pts=c=>su(c)===1?1:c===QS?13:0;
  const PASSDIR=[1,3,2,0], PASSNAME=['till vänster','till höger','rakt över','– ingen byter den här rundan'];
  function hLegal(g,s){ const h=g.hands[s]; if(g.phase!=='play') return [];
    const first=g.tricksDone===0;
    if(!g.trick.length){ if(first) return h.includes(C2)?[C2]:[];
      const nonH=h.filter(c=>su(c)!==1); return g.broken||!nonH.length ? h.slice() : nonH; }
    const ls=su(g.trick[0].c), f=h.filter(c=>su(c)===ls); if(f.length) return f;
    if(first){ const safe=h.filter(c=>!pts(c)); if(safe.length) return safe; }
    return h.slice(); }
  function deal(g){ const d=deck(); g.hands=[0,1,2,3].map(s=>sortHand(d.slice(s*13,s*13+13))); g.trick=[]; g.taken=[0,0,0,0]; g.tricksDone=0; g.broken=false;
    g.phase = PASSDIR[g.round%4] ? 'pass' : 'play'; g.passes=[null,null,null,null]; if(g.phase==='play') g.cur=g.hands.findIndex(h=>h.includes(C2)); }
  GINFO.hjarter={name:'Hjärter', icon:'♥️', ai:BOTS[0], bots:BOTS, max:4, desc:'Undvik hjärter och spaderdam · 4 spelare', grad:'linear-gradient(135deg,#be123c,#1e293b)'};
  KIND.hjarter={
    init(){ return {hands:[],trick:[],taken:[0,0,0,0],scores:[0,0,0,0],round:0,phase:'pass',passes:[null,null,null,null],tricksDone:0,broken:false}; },
    start(g){ if(g.names.length<4){ const used=new Set(g.names); const add=BOTS.filter(b=>!used.has(b)); g.ai=g.ai||g.names.map(()=>false);
        while(g.names.length<4){ g.names.push(add.shift()||('Robot '+g.names.length+' 🤖')); g.ai.push('medium'); } }
      g.scores=[0,0,0,0]; g.round=0; deal(g); },
    redact(g,seat){ g.hands=g.hands.map((h,s)=>s===seat?h:h.map(()=>-1)); g.passes=g.passes.map((p,s)=>s===seat||!p?p:p.map(()=>-1)); if(Array.isArray(g.got)) g.got=g.got.map((x,s)=>s===seat?x:null); },
    valid(g){ const n=g.names.length; if(n<1||n>4) return false; if(g.started===false) return true;
      return n===4 && Array.isArray(g.hands)&&g.hands.length===4&&g.hands.every(h=>okCards(h,13)) && Array.isArray(g.trick)&&g.trick.length<=4&&g.trick.every(t=>t&&isInt(t.s,0,3)&&isInt(t.c,0,51))
        && Array.isArray(g.scores)&&g.scores.every(x=>Number.isInteger(x)) && (g.phase==='pass'||g.phase==='play'); },
    waitingFor(g){ if(g.phase==='pass'){ const me=meSeat(); if(g.passes[me]===null) return me; const i=g.passes.findIndex(p=>p===null); return i; } return g.cur; },
    scoreOf(g,i){ return `${g.scores[i]} p`; },
    apply(g,a,seat){
      if(a.type==='resign'){ if(g.over) return false; g.over=true; const others=[0,1,2,3].filter(s=>s!==seat), mn=Math.min(...others.map(s=>g.scores[s]));
        const w=others.filter(s=>g.scores[s]===mn); g.winner=w.length>1?-1:w[0]; g.last={seat,t:now(),type:'resign'}; return true; }
      if(g.over) return false;
      if(a.type==='pass'){ if(g.phase!=='pass'||g.passes[seat]!==null||!Array.isArray(a.cards)||a.cards.length!==3||new Set(a.cards).size!==3||!a.cards.every(c=>g.hands[seat].includes(c))) return false;
        g.passes[seat]=a.cards.slice(); g.last={seat,t:now(),type:'pass'};
        if(g.passes.every(p=>p)){ const dir=PASSDIR[g.round%4];
          for(let s=0;s<4;s++) g.hands[s]=g.hands[s].filter(c=>!g.passes[s].includes(c));
          for(let s=0;s<4;s++) g.hands[(s+dir)%4].push(...g.passes[s]);
          g.hands=g.hands.map(sortHand); g.got=g.passes.map((_,s)=>g.passes[(s-dir+4)%4]); g.passes=[null,null,null,null]; g.phase='play'; g.cur=g.hands.findIndex(h=>h.includes(C2)); g.last={t:now(),type:'passed'}; }
        return true; }
      if(a.type!=='card'||g.phase!=='play'||seat!==g.cur||!hLegal(g,seat).includes(a.c)) return false;
      g.hands[seat].splice(g.hands[seat].indexOf(a.c),1); g.trick.push({s:seat,c:a.c}); if(su(a.c)===1) g.broken=true; g.got=null;
      g.last={seat,t:now(),type:'card',c:a.c};
      if(g.trick.length<4){ g.cur=(seat+1)%4; return true; }
      const ls=su(g.trick[0].c); let w=g.trick[0]; for(const t of g.trick) if(su(t.c)===ls&&rk(t.c)>rk(w.c)) w=t;
      const p=g.trick.reduce((a,t)=>a+pts(t.c),0); g.taken[w.s]+=p; g.lastTrick={cards:g.trick.slice(),w:w.s,p}; g.trick=[]; g.tricksDone++; g.cur=w.s; g.last.trick=w.s;
      if(g.tricksDone===13){ const moon=g.taken.findIndex(x=>x===26);
        if(moon>=0) for(let s=0;s<4;s++) g.scores[s]+= s===moon?0:26; else for(let s=0;s<4;s++) g.scores[s]+=g.taken[s];
        g.lastRound={taken:g.taken.slice(),moon}; g.round++;
        if(Math.max(...g.scores)>=TARGET){ g.over=true; const mn=Math.min(...g.scores); g.winner=g.scores.filter(x=>x===mn).length>1?-1:g.scores.indexOf(mn); }
        else deal(g); }
      return true; },
    aiSeat(g){ if(g.over) return null; if(g.phase==='pass'){ const i=g.passes.findIndex((p,s)=>p===null&&isAI(s)); return i>=0?i:null; } return isAI(g.cur)?g.cur:null; },
    aiDelay(g){ return g.phase==='pass'?500: g.trick.length===0&&g.lastTrick&&g.tricksDone>0 ? 1500 : 800; },
    ai(g,s){ const lv=g.ai[s], h=g.hands[s];
      if(g.phase==='pass'){ const v=c=>c===QS?100: c===QS+2?60: c===QS+1?55: su(c)===1?rk(c)+20: rk(c); return {type:'pass', cards:h.slice().sort((a,b)=>v(b)-v(a)).slice(0,3)}; }
      const L=hLegal(g,s); if(!L.length) return null; if(lv==='easy') return {type:'card', c:L[rint(L.length)]};
      if(!g.trick.length){ // spela ut lågt, helst inte hjärter; hard undviker att spela ut spader när damen är kvar
        const sorted=L.slice().sort((a,b)=>rk(a)-rk(b)); const safe=sorted.filter(c=>su(c)!==1 && !(lv==='hard'&&su(c)===0&&rk(c)>=12)); return {type:'card', c:(safe[0]??sorted[0])}; }
      const ls=su(g.trick[0].c), win=Math.max(...g.trick.filter(t=>su(t.c)===ls).map(t=>rk(t.c))), trickPts=g.trick.reduce((a,t)=>a+pts(t.c),0);
      const follow=L.filter(c=>su(c)===ls);
      if(follow.length){ const under=follow.filter(c=>rk(c)<win).sort((a,b)=>rk(b)-rk(a));
        if(under.length) return {type:'card', c:under[0]};
        if(g.trick.length===3 && !trickPts) return {type:'card', c:follow.sort((a,b)=>rk(b)-rk(a)).filter(c=>c!==QS)[0]??follow[0]};
        return {type:'card', c:follow.sort((a,b)=>rk(a)-rk(b))[0]}; }
      // kan inte följa: släng spader dam, höga hjärter, höga kort
      const v=c=>c===QS?100: su(c)===1?40+rk(c): rk(c); return {type:'card', c:L.slice().sort((a,b)=>v(b)-v(a))[0]}; },
    effects(prev,d){ if(!d.last||(prev.last&&prev.last.t===d.last.t)) return;
      if(d.last.type==='passed'){ sfx.pick(); toast('Korten är bytta 🔄',1500); return; }
      if(d.last.type==='card'){ sfx.pick(); if(d.last.trick!=null && d.lastTrick && d.lastTrick.p) toast(`${bare(pname(d.last.trick))} tog ${d.lastTrick.p} ${d.lastTrick.p===1?'poäng':'poäng'}`,1400); }
      if(d.round!==prev.round && d.lastRound){ const r=d.lastRound; toast(r.moon>=0?`🌙 ${bare(pname(r.moon))} tog ALLA poäng – de andra får 26!`:`Rundan klar: ${r.taken.map((t,i)=>bare(d.names[i])+' '+t).join(', ')}`,3200); } },
    html(){
      const g=G, me=meSeat(), my=canActG(me)&&!g.over, myTurn=my&&g.phase==='play'&&g.cur===me, L=new Set(myTurn?hLegal(g,me):[]), sel=hSel.get();
      const pos=s=>['me','left','top','right'][(s-me+4)%4];
      const shown = g.trick.length ? g.trick : (g.lastTrick && g.last && g.last.trick!=null ? g.lastTrick.cards : []);
      const tbl=`<div class="ht-table">${shown.map(t=>`<div class="ht-c ${pos(t.s)} ${g.trick.length?'':'gone'}">${card(t.c)}</div>`).join('')}
        ${[1,2,3].map(k=>{ const s=(me+k)%4; return `<div class="ht-n ${pos(s)} ${!g.over&&KIND.hjarter.waitingFor(g)===s?'on':''}">${isAI(s)?'🤖 ':''}${esc(bare(g.names[s]))}<small>${g.scores[s]} p · ${g.taken[s]} denna runda</small></div>`; }).join('')}</div>`;
      const passing = g.phase==='pass' && g.passes[me]===null && my;
      const hand=`<div class="hand" style="--ov:${handOv(g.hands[me].length)}">${g.hands[me].map(c=>card(c,{cls:`${passing||myTurn?(passing||L.has(c)?'can':'no'):''} ${sel.includes(c)?'sel':''} ${(g.got&&g.got[me]||[]).includes(c)?'got':''}`,attr:`data-ht="${c}"`})).join('')}</div>`;
      let sub; if(g.over) sub='';
      else if(g.phase==='pass') sub = g.passes[me]===null ? `Välj tre kort att ge bort ${PASSNAME[g.round%4]}` : 'Väntar på att de andra väljer kort…';
      else sub = myTurn ? (g.trick.length? `<b style="color:var(--gold)">Din tur</b> – följ färg om du kan` : g.tricksDone===0 ? '<b style="color:var(--gold)">Din tur</b> – spela ut klöver 2' : '<b style="color:var(--gold)">Din tur</b> – spela ut') : `${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> funderar…`;
      return `<div class="gsub">${sub}</div>` + tbl + `<div class="ht-me">Du: <b>${g.scores[me]} p</b> · ${g.taken[me]} denna runda · runda ${g.round+1}</div>` + hand
        + (g.over? gOverHTML(`Lägst poäng vinner: ${g.scores.map((s,i)=>esc(bare(g.names[i]))+' '+s).join(' · ')}`) : `<div class="cbtns">${passing?`<button class="pri" data-ht="pass" ${sel.length===3?'':'disabled'}>Ge bort 3 kort</button>`:''}</div>
        <div class="ghint">Varje hjärter = 1 poäng, spader dam = 13. Undvik dem! Tar någon alla får de andra 26. Lägst poäng när någon når ${TARGET} vinner. ${KIT.resignHTML()}</div>`); }
  };
  const hSel={ ids:[], gid:null, get(){ const k=G.id+':'+G.round+':'+G.phase; if(this.gid!==k){ this.ids=[]; this.gid=k; } return this.ids; } };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-ht]'); if(!b||!G||G.kind!=='hjarter') return; const me=meSeat(); if(G.over||!canActG(me)) return;
    const v=b.dataset.ht, sel=hSel.get();
    if(v==='pass'){ if(sel.length===3) doAct({type:'pass',cards:sel.slice()}); return; }
    const c=+v; if(G.phase==='pass'){ if(G.passes[me]!==null) return; if(sel.includes(c)) sel.splice(sel.indexOf(c),1); else if(sel.length<3) sel.push(c); sfx.bubble(); render(); return; }
    if(G.cur!==me) return; if(!hLegal(G,me).includes(c)){ toast(G.trick.length?'Du måste följa färg':'Det kortet får du inte spela ut än',1600); return; } doAct({type:'card',c}); });
  css(`.ht-table{position:relative;height:min(300px,40dvh);max-width:440px;margin:6px auto;border-radius:50%/40%;background:radial-gradient(ellipse at center,#166534,#14532d 70%);box-shadow:inset 0 0 30px rgba(0,0,0,.5),0 8px 24px rgba(0,0,0,.4);--cw:min(54px,13vw)}
.ht-c{position:absolute;transition:opacity .4s}.ht-c.me{left:50%;bottom:14%;transform:translateX(-50%)}.ht-c.top{left:50%;top:22%;transform:translateX(-50%)}
.ht-c.left{left:16%;top:50%;transform:translateY(-50%) rotate(-8deg)}.ht-c.right{right:16%;top:50%;transform:translateY(-50%) rotate(8deg)}.ht-c.gone{opacity:.55}
.ht-n{position:absolute;font-size:12.5px;text-align:center;background:rgba(0,0,0,.35);padding:3px 8px;border-radius:10px;line-height:1.25}.ht-n small{display:block;opacity:.75;font-size:11px}
.ht-n.on{box-shadow:0 0 0 2px var(--gold)}.ht-n.top{left:50%;top:6px;transform:translateX(-50%)}.ht-n.left{left:2px;top:12%}.ht-n.right{right:2px;top:12%}
.ht-me{text-align:center;font-size:13.5px;opacity:.85}.hand .pc.got{box-shadow:0 0 0 3px #a855f7}`);
  GINFO.hjarter.menu=()=>KIT.menu('hjarter',{rules:'Fyra spelare. Följ färg om du kan och försök slippa sticken med hjärter (1 poäng) och spader dam (13). Varje runda ger ni bort tre kort först. Lägst poäng när någon når 50 vinner. Online fylls tomma platser med datorspelare.', bots:[3,3]});

  window.__cardsTest=(typeof DEV!=='undefined'&&DEV)?{hLegal,VT,FK,rk,su}:undefined;
})();
