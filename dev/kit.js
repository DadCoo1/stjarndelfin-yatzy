/* =====================================================================
   kit.js – gemensamt för de nya spelen: meny, ensamstart, små hjälpare
   ===================================================================== */
'use strict';
const KIT = (()=>{
  const LV=[['easy','🐣 Lätt'],['medium','🙂 Medel'],['hard','🧠 Svår']];
  const OPT={};       // kind -> menyinställningar
  const get=(k,d)=>{ const v=lsGet('kit_'+k); return v==null?d:v; };
  function lvlHTML(kind){ const cur=get(kind+'_lvl','medium'); return LV.map(([k,l])=>`<button data-km="lvl" data-k="${kind}" data-l="${k}" class="${cur===k?'sel':''}">${l}</button>`).join(''); }
  function botsHTML(kind,o){ const cur=+get(kind+'_bots',o.bots[0]); return Array.from({length:o.bots[1]-o.bots[0]+1},(_,i)=>o.bots[0]+i).map(n=>`<button data-km="bots" data-k="${kind}" data-n="${n}" class="${cur===n?'sel':''}">${n}</button>`).join(''); }
  // o: {rules, bots:[min,max]|null, levels:true, online:true|false, solo:true|false, extra:()=>html, onStart:(how)=>void}
  function menu(kind,o){
    OPT[kind]=o; const gi=GINFO[kind];
    openModal(`<h3>${gi.icon} ${gi.name}</h3><p>${o.rules}</p>
      <label>Ditt namn</label><input id="nm" maxlength="14" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      ${o.extra?o.extra():''}
      ${o.bots?`<label>Hur många datorspelare?</label><div class="seg" id="kmBots">${botsHTML(kind,o)}</div>`:''}
      ${o.levels!==false && !o.solo?`<label>Hur bra är datorn?</label><div class="seg" id="kmLvl">${lvlHTML(kind)}</div>`:''}
      ${o.solo&&o.levels?`<label>Nivå</label><div class="seg" id="kmLvl">${lvlHTML(kind)}</div>`:''}
      <div class="btns" style="flex-direction:column">
        ${o.solo?`<button class="pri" data-km="solo" data-k="${kind}">▶️ Spela</button>`:`<button class="pri" data-km="ai" data-k="${kind}">🤖 Spela mot datorn</button>`}
        ${!o.solo&&o.local!==false?HOT.btn(`data-km="hot" data-k="${kind}"`):''}
        ${o.online!==false?`<button class="pri" data-km="host" data-k="${kind}" style="background:linear-gradient(135deg,#f472b6,#a855f7)">🚀 Bjud in ${gi.max>2?`kompisar (2–${gi.max} spelare)`:'en kompis (online)'}</button>`:''}
        <button data-act="close">Avbryt</button></div>`,'km_'+kind);
  }
  function startSolo(kind,name){
    stopNet(); clearTimeout(aiTimer); closeModal(); mode='local'; mySeat=0; gameId=null; role=null;
    G=gNewState(kind,[name],0,[false]); KIND[kind].start(G); if(typeof DUEL!=='undefined') DUEL.prep(G); lsSet('ry_local', JSON.stringify(G));
    view='game'; resetDrafts(); render(); gMaybeAI();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-km]'); if(!b) return;
    const kind=b.dataset.k, o=OPT[kind]||{}, a=b.dataset.km;
    if(a==='lvl'){ lsSet('kit_'+kind+'_lvl',b.dataset.l); document.getElementById('kmLvl').innerHTML=lvlHTML(kind); sfx.bubble(); return; }
    if(a==='bots'){ lsSet('kit_'+kind+'_bots',b.dataset.n); document.getElementById('kmBots').innerHTML=botsHTML(kind,o); sfx.bubble(); return; }
    if(o.onClick && o.onClick(a,b)) return;
    const n=(document.getElementById('nm')?.value||'').trim();
    if(a==='ai'||a==='solo'){ const nm=n||'Du'; lsSet('ry_name',nm); unlockAudio(); o.onStart&&o.onStart(a);
      if(a==='solo') startSolo(kind,nm); else startGameLocal(kind, nm, get(kind+'_lvl','medium'), o.bots?+get(kind+'_bots',o.bots[0]):1); return; }
    if(a==='host'){ if(!n){ toast('Skriv ditt namn 🐬'); return; } lsSet('ry_name',n); unlockAudio(); closeModal(); o.onStart&&o.onStart(a); hostGame(n,'free',kind); return; }
    if(a==='hot'){ HOT.names(kind, n, ()=>{ o.onStart&&o.onStart('hot'); }); return; }
  });
  // "Ge upp"-knapp som kräver två tryck
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-kit="resign"]'); if(!b) return;
    if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Säker? Tryck igen'; return; }
    doAct({type:'resign', seat:meSeat()});
  });
  const resignHTML = () => (!G||G.over) ? '' : `<button class="of-link" data-kit="resign">Ge upp</button>`;
  const lvlName = l => ({easy:'lätt',medium:'medel',hard:'svår'})[l]||'';
  const turnText = (g, verb) => { const me=meSeat(); if(g.over) return ''; if(g.hot) return `<b style="color:var(--gold)">${esc(gen(pname(g.cur)))} tur</b>${verb?' – '+verb:''}`; if(g.cur===me && canActG(me)) return `<b style="color:var(--gold)">Din tur</b>${verb?' – '+verb:''}`; return `${isAI(g.cur)?'🤖 ':''}<b>${esc(pname(g.cur))}</b> funderar…`; };
  // vanlig hantering av "ge upp": två spelare → den andra vinner; fler → spelaren åker ut
  function resign(g,seat,alive){
    if(g.over) return false;
    const n=g.names.length; g.out=g.out||[]; if(!g.out.includes(seat)) g.out.push(seat);
    const left=[...Array(n).keys()].filter(i=>!g.out.includes(i) && (!alive || alive(i)));
    if(left.length<=1){ g.over=true; g.winner= left.length ? left[0] : -1; }
    else if(g.cur===seat){ let c=seat; do{ c=(c+1)%n; }while(g.out.includes(c)); g.cur=c; }
    g.last={seat, t:Date.now(), type:'resign'}; return true;
  }
  const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=rint(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  return { menu, startSolo, resignHTML, lvlName, turnText, resign, shuffle };
})();
