// Sommarvägen: går att lämna till lobbyn från menyn (‹) och under spel (paus → 🏠 Lobby), i både dev och vanliga appen
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); let fail=0;
  for(const [base,pre] of [['/dev/','dev:'],['/','']]){ const c=await b.newContext({viewport:{width:390,height:760},hasTouch:true});
    await c.addInitScript(`window.__NET_SERVER=''; localStorage.setItem('${pre}onboarded','1'); localStorage.setItem('${pre}sfx','0')`);
    const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811'+base); await sleep(1200);
    await p.evaluate(()=>openRace()); await sleep(1000);
    // från menyn: ‹ uppe till vänster måste gå att trycka på
    await p.tap('.rc-top [data-act=lobby]',{timeout:3000}).catch(e=>{ fail++; console.log('✗',base,'‹ i menyn går inte att trycka på'); }); await sleep(800);
    const a=await p.evaluate(()=>!document.getElementById('raceRoot')); console.log(a?'✓':'✗',base,'‹ från menyn leder till lobbyn'); if(!a) fail++;
    await p.evaluate(()=>openRace()); await sleep(800); await p.tap('[data-rc=go]'); await sleep(2500);
    await p.tap('.rc-top [data-rc=pause]'); await sleep(500); await p.tap('.rc-card [data-act=lobby]',{timeout:3000}).catch(()=>{}); await sleep(800);
    const r=await p.evaluate(()=>({gone:!document.getElementById('raceRoot'), lobby:!!document.querySelector('.gamecard,.lobby,[data-act]')}));
    console.log(r.gone?'✓':'✗',base,'under spel: paus → 🏠 Lobby leder till lobbyn'); if(!r.gone) fail++;
    if(errs.length){ console.log('✗ fel',errs.slice(0,2)); fail++; } await c.close(); }
  await b.close(); process.exit(fail?1:0); })();
