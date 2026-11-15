// 3D-spelen lämnar tillbaka grafikminnet när man går till lobbyn, och 3D fungerar igen nästa gång. Patiens: platta kort, 3D bara under vändning.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; };
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const only=process.argv[2];   // node tests/glfree.js dev | rel
  for(const [base,pre] of [['/dev/','dev:'],['/','']]){ if(only&&(only==='dev')!==(base==='/dev/')) continue; const c=await b.newContext({viewport:{width:390,height:780}});
    await c.addInitScript(`window.__NET_SERVER=''; localStorage.setItem('${pre}onboarded','1'); localStorage.setItem('${pre}sfx','0'); Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8})`);
    const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811'+base); await sleep(1200); const v=base==='/'?'release':'dev';
    const glCount=()=>p.evaluate(()=>[...document.querySelectorAll('canvas')].filter(c=>{ try{ const g=c.getContext('webgl',{failIfMajorPerformanceCaveat:false}); return false; }catch(e){ return false; } }).length);
    const live=()=>p.evaluate(()=>({slalom:SLGL.ok(), sl:!!document.querySelector('.sl-glc'), bs:!!document.querySelector('.bs-glc'), car:typeof CARS3D!=='undefined'&&CARS3D.ok()}));
    const waitT=f=>p.evaluate(async f=>{ for(let i=0;i<40;i++){ const n=eval(f)(); if(n>0) return n; await new Promise(r=>setTimeout(r,1500)); } return 0; },f);
    // patiens
    await p.evaluate(()=>{ const t=[...document.querySelectorAll('[data-act]')].find(e=>/patiens/i.test(e.textContent)); t&&t.click(); }); await sleep(1200); await p.evaluate(()=>{ const s=document.querySelector('#modal [data-act=solstart]'); s&&s.click(); }); await sleep(3500);
    const s=await p.evaluate(()=>{ const cs=[...document.querySelectorAll('.scard')]; const st=e=>getComputedStyle(e); return {n:cs.length, three:cs.filter(e=>st(e).perspective!=='none'||st(e.querySelector('.in')).transformStyle==='preserve-3d').length, down:cs.filter(e=>e.classList.contains('down')).length,
      badDown:cs.filter(e=>e.classList.contains('down')&&st(e.querySelector('.f')).visibility!=='hidden').length, badUp:cs.filter(e=>!e.classList.contains('down')&&st(e.querySelector('.b')).visibility!=='hidden').length}; });
    ok(s.n===52 && s.three===0, `${v} patiens: 52 kort, inget i 3D när inget vänds (${s.three})`);
    ok(s.down>0 && !s.badDown && !s.badUp, `${v} patiens: nedvända kort visar baksidan, uppvända framsidan (${s.down} nedvända)`);
    const r0=await p.evaluate(()=>{ const r=document.getElementById('slotStock').getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2, document.querySelectorAll('.scard:not(.down)').length]; });
    await p.mouse.click(r0[0],r0[1]); await sleep(100); const mid=await p.evaluate(()=>document.querySelectorAll('.scard.flip3').length); await sleep(800);
    const f=await p.evaluate(n=>({after:document.querySelectorAll('.scard.flip3').length, up:document.querySelectorAll('.scard:not(.down)').length-n}), r0[2]); f.mid=mid;
    ok(f.mid>0 && f.after===0 && f.up>0, `${v} patiens: ett kort från högen vänds med 3D-animation, som stängs av efteråt (under: ${f.mid}, efter: ${f.after}, nya uppvända: ${f.up})`);
    for(let round=1;round<=2;round++){
      await p.evaluate(()=>GINFO.slalom.menu()); await sleep(400); await p.fill('#nm','Test'); await p.click('[data-sl=solo]'); const n1=await waitT('()=>SLGL.stats().tris||0');
      ok(n1>40000, `${v} slalom (gång ${round}): 3D ritar (${n1} trianglar)`);
      await p.evaluate(()=>goLobby()); await sleep(1800); const L=await live(); ok(!L.slalom && !L.sl, `${v} slalom: grafikminnet lämnas tillbaka i lobbyn`);
      if(round===2) continue;
      await p.evaluate(()=>KIT.startSolo('skidskytte','Test')); const n2=await waitT('()=>BIATHLON.__test?BIATHLON.__test.gl().tris:(document.querySelector(".bs-glc")?.style.display==="block"?1:0)');
      ok(n2>0, `${v} skidskytte (gång ${round}): 3D ritar`); await p.evaluate(()=>goLobby()); await sleep(1800); ok(!(await live()).bs, `${v} skidskytte: grafikminnet lämnas tillbaka i lobbyn`);
      await p.evaluate(()=>RACE.open()); await sleep(1500); await p.evaluate(()=>document.querySelector('[data-rc=go]').click()); await sleep(3000); ok(await p.evaluate(()=>CARS3D.ok()), `${v} Sommarvägen (gång ${round}): 3D-bilen ritas`);
      await p.evaluate(()=>goLobby()); await sleep(800); ok(!(await live()).car, `${v} Sommarvägen: grafikminnet lämnas tillbaka i lobbyn`); }
    ok(!errs.length, `${v} inga fel ${errs.slice(0,2).join(' | ')}`); await c.close(); }
  await b.close(); process.exit(fail?1:0); })();
