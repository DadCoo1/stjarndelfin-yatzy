/* =====================================================================
   duel.js – turas om på samma enhet i spelen man annars spelar ensam
   (Sommarvägen, Space Attack, Slalom, Skidskytte, Wordle, Sudoku, Patiens).
   Alla får samma bana, ord, pussel eller giv. Efter varje tur lämnas enheten över;
   till sist visas en resultatlista med vinnaren.
   ===================================================================== */
'use strict';
const DUEL = (()=>{
  let D=null;          // {kind, names, i, res:[], keep, playing}
  const sec=s=>`${Math.floor(s/60)}:${String(Math.round(s)%60).padStart(2,'0')}`;
  const AD={
    race:{name:'Sommarvägen', icon:'🏎️', how:'Kör så långt du hinner – flest poäng vinner.', start(){ RACE.open(); setTimeout(()=>RACE.go(),60); }},
    inv:{name:'Space Attack', icon:'🚀', how:'Alla börjar på nivå 1 – flest poäng vinner.', start(){ INV.open(); setTimeout(()=>INV.go(1),60); }},
    slalom:{name:'Slalom', icon:'⛷️', how:'Samma bana för alla – snabbast totaltid vinner.', start(n){ GINFO.slalom.duel(n); }, keys:['seeds','std','disc','venue','pen']},
    skidskytte:{name:'Skidskytte', icon:'🎯', how:'Samma lopp och samma vind för alla – snabbast vinner.', start(n){ GINFO.skidskytte.duel(n); }, keys:['seed','fmt','wind']},
    wordle:{name:'Wordle', icon:'🟩', how:'Samma hemliga ord för alla – färst gissningar vinner.', start(n){ GINFO.wordle.duel(n); }, keys:['ans','lang']},
    sudoku:{name:'Sudoku', icon:'🔢', how:'Samma pussel för alla – snabbast vinner (ledtrådar och fel ger tillägg).', start(n){ GINFO.sudoku.duel(n); }, keys:['puz','sol','level']},
    sol:{name:'Patiens', icon:'🃏', how:'Samma giv för alla. Flest kort upplagda vinner, sedan snabbast. Tryck ✋ Klar när du inte kommer längre.', start(){ solDuelStart(); }}
  };
  const where=()=>(typeof isDesk==='function'&&isDesk())?'skärm':'enhet';
  const btn=kind=>`<button class="pri" data-duel="names" data-k="${kind}" style="background:linear-gradient(135deg,#34d399,#0ea5e9)">👥 Turas om på samma ${where()}</button>`;
  const active=k=>!!(D && D.playing && (!k || D.kind===k));
  const who=()=>D&&D.playing ? D.names[D.i] : null;

  /* ---------- namn ---------- */
  let pend=null;
  function namesHTML(){ const a=AD[pend.kind]; return `<h3>${a.icon} ${a.name} · turas om</h3><p>${a.how}</p>
    ${pend.list.map((n,i)=>`<label>Spelare ${i+1}</label><input data-dueln="${i}" maxlength="14" value="${esc(n)}" placeholder="Namn">`).join('')}
    <div class="btns">${pend.list.length<4?'<button data-duel="add">＋ Spelare</button>':''}${pend.list.length>2?'<button data-duel="rem">－ Spelare</button>':''}</div>
    <div class="btns" style="flex-direction:column"><button class="pri" data-duel="start">▶️ Starta</button><button data-act="close">Avbryt</button></div>`; }
  function names(kind){ const last=(()=>{ try{ return JSON.parse(lsGet('hot_names'))||[]; }catch(e){ return []; } })(), me=lsGet('ry_name')||'';
    pend={kind, list:[me, last.find(x=>x&&x!==me)||'']}; openModal(namesHTML(),'duelnames'); }

  /* ---------- turerna ---------- */
  function begin(kind, list){ D={kind, names:list, i:0, res:[], keep:null, playing:false}; lsSet('hot_names',JSON.stringify(list.slice(1))); ask(); }
  function resLine(r){ return r ? esc(r.txt) : '–'; }
  function ask(){ D.wait='ask'; const a=AD[D.kind], n=D.names[D.i], p=D.i>0 ? D.names[D.i-1] : null;
    openModal(`<div class="duelc"><div class="duelc-i">${a.icon}</div>
      ${p?`<p class="duelc-r"><b>${esc(p)}</b>: ${resLine(D.res[D.i-1])}</p>`:''}
      <h2>${p?'Nu är det':'Först ut'}<b>${esc(n)}s tur</b></h2>${p?`<p>Lämna över enheten 📱 – titta inte, ${esc(p)} 🙈</p>`:`<p>${a.how}</p>`}
      <div class="btns" style="flex-direction:column"><button class="pri" data-duel="go">▶️ ${esc(n)} kör!</button><button data-duel="quit">Avbryt turas om</button></div></div>`,'duelturn'); }
  function go(){ closeModal(); D.wait=null; D.playing=true; try{ AD[D.kind].start(D.names[D.i]); }catch(e){ console.warn('turas om',e); D.playing=false; toast('Det gick inte att starta spelet 😕'); } }
  // spelet säger ifrån hur det gick: {v, hi, txt}
  function report(kind, r){ if(!active(kind)) return false; D.playing=false; D.res[D.i]=r; D.i++;
    D.wait=D.i<D.names.length?'ask':'end'; D.shown=false; setTimeout(()=>{ if(D) show(); }, kind==='sol'?2600:1900); return true; }
  // visa nästa steg när spelets egen resultatruta är stängd, och visa det igen om spelet råkar lägga en ruta ovanpå
  const ours=()=>!!document.querySelector('#modal.show .duelc'), other=()=>{ const m=document.getElementById('modal'); return !!(m&&m.classList.contains('show'))&&!ours(); };
  function show(){ if(!D||!D.wait) return; if(other()) return; D.shown=true; D.wait==='ask'?ask():finish(); }
  setInterval(()=>{ if(D&&D.wait&&!ours()&&!other()&&D.shown!==null) show(); }, 700);
  function finish(){ D.wait='end'; const a=AD[D.kind], idx=D.names.map((_,i)=>i).filter(i=>D.res[i]);
    const val=i=>{ const r=D.res[i]; return r.v==null||!isFinite(r.v) ? (r.hi?-Infinity:Infinity) : r.v; };
    idx.sort((x,y)=> D.res[x].hi ? val(y)-val(x) : val(x)-val(y));
    const best=idx.length?val(idx[0]):null, top=idx.filter(i=>val(i)===best), solo=top.length===1;
    const medal=k=>['🥇','🥈','🥉'][k]||'';
    openModal(`<div class="duelc"><div class="duelc-i">🏆</div><h2>${solo?`<b>${esc(D.names[top[0]])}</b> vann!`:'<b>Delad seger!</b>'}</h2>
      <div class="duell">${idx.map((i,k)=>`<div class="${top.includes(i)?'w':''}"><span>${top.includes(i)?'🥇':medal(k)}</span><b>${esc(D.names[i])}</b><em>${resLine(D.res[i])}</em></div>`).join('')}</div>
      <div class="btns" style="flex-direction:column"><button class="pri" data-duel="again">🔄 En gång till – ny ${D.kind==='race'||D.kind==='inv'?'omgång':D.kind==='wordle'?'ord':D.kind==='sol'?'giv':'bana'}</button><button data-duel="quit">🏠 Klar</button></div></div>`,'duelend');
    setTimeout(()=>{ try{ celebrate(solo?`${D.names[top[0]]} vann!`:'Delad seger!'); sfx.win(); sparkles(50); }catch(e){} },300); }
  // ett ensamspel startar: samma bana, ord eller pussel för alla
  function prep(g){ if(!active(g.kind)) return; g.duel=1; const ks=AD[g.kind].keys||[];
    if(!D.keep){ D.keep={}; for(const k of ks) if(g[k]!==undefined) D.keep[k]=JSON.parse(JSON.stringify(g[k])); }
    else { for(const k of ks) if(D.keep[k]!==undefined) g[k]=JSON.parse(JSON.stringify(D.keep[k])); if(g.kind==='sudoku'){ g.val=g.puz.slice(); g.notes=new Array(81).fill(0); g.mist=0; g.hints=0; g.t0=(typeof now==='function'?now():Date.now()); g.time=0; } } }
  // resultat från spelen som går via spelmotorn
  function over(g){ if(!g||!g.duel||!active(g.kind)) return; const k=g.kind; let r=null;
    if(k==='slalom'){ const x=(g.res&&g.res[0])||[], ok=x.length&&x.every(t=>Number.isFinite(t)&&t>0), t=ok?x.reduce((s,v)=>s+v,0):Infinity; r={v:t, hi:false, txt:ok?`${(t/1000).toFixed(2).replace('.',',')} s`:'körde ur'}; }
    else if(k==='skidskytte'){ const x=g.res&&g.res[0]; if(g.fmt==='tr'){ const h=x?x.sh.length*5-x.sh.reduce((s,v)=>s+v,0):0; r={v:h, hi:true, txt:`${h} träffar`}; } else { const ok=x&&Number.isFinite(x.ms)&&x.ms>0; r={v:ok?x.ms:Infinity, hi:false, txt:ok?`${sec(x.ms/1000)} · ${x.sh.reduce((s,v)=>s+v,0)} bom`:'bröt'}; } }
    else if(k==='wordle'){ const won=g.winner===0; r={v:won?g.guesses.length:7, hi:false, txt:won?`${g.guesses.length} gissningar`:`inte hittat (${String(g.ans).toUpperCase()})`}; }
    else if(k==='sudoku'){ const t=(g.time||0)+(g.hints||0)*30+(g.mist||0)*10, ok=g.winner===0; r={v:ok?t:Infinity, hi:false, txt:ok?`${sec(t)}${g.hints||g.mist?` (med tillägg)`:''}`:'inte klart'}; }
    if(r) report(k,r); }
  function quit(){ if(D) D.wait=null; D=null; closeModal(); if(typeof backToLobby==='function') backToLobby(); else { view='lobby'; render(); } }
  const read=()=>document.querySelectorAll('#modal [data-dueln]').forEach(i=>{ pend.list[+i.dataset.dueln]=i.value.trim(); });
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-duel]'); if(!b) return; const a=b.dataset.duel;
    if(a==='names'){ names(b.dataset.k); return; }
    if(a==='go'){ if(D) go(); return; }
    if(a==='quit'){ quit(); return; }
    if(a==='again'){ if(D){ const k=D.kind, n=D.names; begin(k,n); } return; }
    if(!pend) return; read();
    if(a==='add'&&pend.list.length<4){ pend.list.push(''); openModal(namesHTML(),'duelnames'); return; }
    if(a==='rem'&&pend.list.length>2){ pend.list.pop(); openModal(namesHTML(),'duelnames'); return; }
    if(a==='start'){ const ns=pend.list.map((n,i)=>n||`Spelare ${i+1}`), seen={}; for(let i=0;i<ns.length;i++){ let n=ns[i]; while(seen[n]) n+='²'; seen[n]=1; ns[i]=n; }
      if(pend.list[0]) lsSet('ry_name',pend.list[0]); unlockAudio(); const k=pend.kind; pend=null; closeModal(); begin(k,ns); } });
  const st=document.createElement('style'); st.textContent=`
.duelc{text-align:center}.duelc-i{font-size:50px}.duelc h2{font-size:19px;font-weight:600;margin:6px 0}.duelc h2 b{display:block;font-size:28px;color:var(--gold)}
.duelc-r{margin:4px 0;padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.08)}
.duell{display:flex;flex-direction:column;gap:6px;margin:12px 0}.duell div{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:14px;background:rgba(255,255,255,.07);text-align:left}
.duell div.w{background:linear-gradient(135deg,rgba(255,211,110,.28),rgba(168,85,247,.2));border:1px solid rgba(255,211,110,.6)}.duell span{font-size:22px;width:28px}.duell b{flex:1}.duell em{font-style:normal;color:var(--dim)}`;
  document.head.appendChild(st);
  return {btn, names, active, who, report, prep, over, AD, turn:()=>D?D.i:-1};
})();
