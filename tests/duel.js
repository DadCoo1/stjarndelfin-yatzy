// Turas om på samma enhet i ensamspelen: knapp i menyn, samma bana/ord/pussel/giv för alla, rätt tur och vinnare
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; };
(async()=>{ const b=await chromium.launch(); const c=await b.newContext({viewport:{width:390,height:800}});
  await c.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:sfx','0')");
  const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(/turas om/.test(m.text())) console.log('  KONSOL',m.text().slice(0,300)); }); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200);
  const names=async()=>{ await p.fill('#modal [data-dueln="0"]','Tindra'); await p.fill('#modal [data-dueln="1"]','Pappa'); await p.click('#modal [data-duel=start]'); await sleep(300); };
  const turn=async who=>{ const t=await p.evaluate(()=>document.querySelector('#modal .duelc h2')?.textContent||''); ok(t.includes(who), `  tur: ${t.replace(/\s+/g,' ')}`); await p.click('#modal [data-duel=go]'); await sleep(900); };
  const final=async(name)=>{ await sleep(3000); const t=await p.evaluate(()=>({h:document.querySelector('#modal .duelc h2')?.textContent||'', rows:[...document.querySelectorAll('#modal .duell div')].map(d=>d.textContent).join(' | ')})); ok(t.h.includes(name), `${name} vinner: ${t.rows}`); await p.click('#modal [data-duel=quit]'); await sleep(500); };
  const goLobby=async()=>{ await p.evaluate(()=>{ closeModal(); if(typeof RACE!=='undefined') RACE.stop(); if(typeof INV!=='undefined') INV.stop(); view='lobby'; G=null; mode=null; render(); }); await sleep(300); };

  // Wordle: samma ord för båda
  await p.evaluate(()=>showGameMenu('wordle')); await sleep(300); ok(await p.$('#modal [data-duel=names][data-k=wordle]'), 'wordle: knappen finns'); await p.click('#modal [data-duel=names]'); await sleep(200); await names();
  await turn('Tindra'); const w1=await p.evaluate(()=>G.ans); await p.evaluate(()=>{ doAct({type:'guess',w:G.ans}); });
  await sleep(2200); await turn('Pappa'); const w2=await p.evaluate(()=>G.ans); ok(w1===w2, `wordle: samma ord (${w1})`);
  await p.evaluate(()=>doAct({type:'resign'})); await final('Tindra'); await goLobby();

  // Sudoku: samma pussel, den snabbaste vinner
  await p.evaluate(()=>showGameMenu('sudoku')); await sleep(300); ok(await p.$('#modal [data-duel=names][data-k=sudoku]'), 'sudoku: knappen finns'); await p.click('#modal [data-duel=names]'); await sleep(200); await names();
  const solve=()=>p.evaluate(()=>{ for(let i=0;i<81;i++) if(!G.puz[i]) doAct({type:'set',i,v:G.sol[i]}); });
  await turn('Tindra'); const s1=await p.evaluate(()=>G.puz.join('')); await sleep(1500); await solve();
  await sleep(2200); await turn('Pappa'); const s2=await p.evaluate(()=>G.puz.join('')); ok(s1===s2, 'sudoku: samma pussel'); await sleep(3500); await solve(); await final('Tindra'); await goLobby();

  // Slalom: samma bana; resultat via spelets slut
  await p.evaluate(()=>showGameMenu('slalom')); await sleep(300); ok(await p.$('#modal [data-duel=names][data-k=slalom]'), 'slalom: knappen finns'); await p.click('#modal [data-duel=names]'); await sleep(200); await names();
  await turn('Tindra'); const b1=await p.evaluate(()=>JSON.stringify([G.seeds,G.disc,G.venue,G.duel]));
  await p.evaluate(()=>{ const d=JSON.parse(JSON.stringify(G)); d.over=true; d.res=[[52300,53100]]; gFinish(d); });
  await sleep(2200); await turn('Pappa'); const b2=await p.evaluate(()=>JSON.stringify([G.seeds,G.disc,G.venue,G.duel])); ok(b1===b2 && JSON.parse(b1)[3]===1, `slalom: samma bana för båda (${b1})`);
  await p.evaluate(()=>{ const d=JSON.parse(JSON.stringify(G)); d.over=true; d.res=[[51000,52000]]; gFinish(d); }); await final('Pappa'); await goLobby();

  // Skidskytte
  await p.evaluate(()=>showGameMenu('skidskytte')); await sleep(300); ok(await p.$('#modal [data-duel=names][data-k=skidskytte]'), 'skidskytte: knappen finns'); await p.click('#modal [data-duel=names]'); await sleep(200); await names();
  await turn('Tindra'); const k1=await p.evaluate(()=>G.seed); await p.evaluate(()=>{ const d=JSON.parse(JSON.stringify(G)); d.over=true; d.res=[{ms:301000,sh:[1,0]}]; gFinish(d); });
  await sleep(2200); await turn('Pappa'); const k2=await p.evaluate(()=>G.seed); ok(k1===k2, 'skidskytte: samma lopp och vind'); await p.evaluate(()=>{ const d=JSON.parse(JSON.stringify(G)); d.over=true; d.res=[{ms:null,sh:[]}]; gFinish(d); }); await final('Tindra'); await goLobby();

  // Sommarvägen: tiden tar slut
  await p.evaluate(()=>RACE.open()); await sleep(1200); ok(await p.$('[data-duel=names][data-k=race]'), 'Sommarvägen: knappen finns'); await p.click('[data-duel=names][data-k=race]'); await sleep(200); await names();
  const endRace=async sc=>{ await sleep(1500); await p.evaluate(sc=>{ const st=RACE.__test.state(); st.cd=0; st.score=sc; st.time=0.01; for(let i=0;i<80&&!/TIDEN|MÅL|poäng/i.test(document.querySelector('#rcOv')?.textContent||'')||i<2;i++) RACE.__test.sim(.1); },sc); };
  await turn('Tindra'); await endRace(4000); await sleep(2200); await turn('Pappa'); await endRace(6500); await final('Pappa'); await goLobby();

  // Space Attack
  await p.evaluate(()=>INV.open()); await sleep(800); ok(await p.$('[data-duel=names][data-k=inv]'), 'Space Attack: knappen finns'); await p.click('[data-duel=names][data-k=inv]'); await sleep(200); await names();
  await turn('Tindra'); ok(await p.evaluate(()=>DUEL.active('inv')), 'Space Attack: turen pågår');
  await p.evaluate(()=>DUEL.report('inv',{v:900,hi:true,txt:'900 poäng'})); await sleep(2200); await turn('Pappa'); await p.evaluate(()=>DUEL.report('inv',{v:300,hi:true,txt:'300 poäng'})); await final('Tindra'); await goLobby();

  // Patiens: samma giv, ✋ Klar
  await p.evaluate(()=>showSolNew(true)); await sleep(300); ok(await p.$('#modal [data-duel=names][data-k=sol]'), 'Patiens: knappen finns'); await p.click('#modal [data-duel=names]'); await sleep(200); await names();
  await turn('Tindra'); const d1=await p.evaluate(()=>JSON.stringify(S.tab)); ok(await p.$('[data-act=solduel]'), 'Patiens: knappen ✋ Klar finns under turen');
  await p.evaluate(()=>{ S.found[0]=[0,1,2]; }); await p.click('[data-act=solduel]'); await sleep(3000); await turn('Pappa'); const d2=await p.evaluate(()=>JSON.stringify(S.tab)); ok(d1===d2, 'Patiens: samma giv för båda');
  await p.click('[data-act=solduel]'); await final('Tindra');

  ok(!errs.length, 'inga fel: '+errs.slice(0,3).join(' | ')); await b.close(); process.exit(fail?1:0); })();
