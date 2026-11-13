// Knapparna ovanpå spelbilden (avtryckare, knäppning, drönare, slalomknappar) ska gå att trycka på – grafiken får inte ligga över dem
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; };
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  for(const [base,pre] of [['/dev/','dev:'],['/','']]){ const c=await b.newContext({viewport:{width:390,height:760},hasTouch:true,isMobile:true});
    await c.addInitScript(`window.__NET_SERVER=''; localStorage.setItem('${pre}onboarded','1'); localStorage.setItem('${pre}sfx','0')`);
    const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811'+base); await sleep(1200);
    const topOf=sel=>p.evaluate(sel=>[...document.querySelectorAll(sel)].filter(b=>b.offsetParent).map(b=>{ const r=b.getBoundingClientRect(), el=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return (b===el||b.contains(el))?1:0; }),sel);
    // skidskytte: fram till skjutvallen
    await p.evaluate(()=>{ KIT.startSolo('skidskytte','Test'); }); await sleep(1500); await p.evaluate(()=>{ const R=BIATHLON.__test?BIATHLON.__test.run():null; if(R) R.cd=.2; });
    const dr=await topOf('.dr-bar [data-dr]'); ok(dr.length&&dr.every(Boolean), `${base} skidskytte: drönarknapparna går att trycka på (${dr.join('')})`);
    if(await p.evaluate(()=>!!(BIATHLON.__test))){ for(let i=0;i<60;i++){ await p.evaluate(()=>{ const T=BIATHLON.__test, R=T.run(); const a=R.A[R.me]||R.A[0]; if(a.ph==='ski'){ a.z=Math.max(a.z, (T.TL?T.TL.N:a.z)); } }); await sleep(500); if(await p.evaluate(()=>!!document.querySelector('.bs-ctl.on'))) break; } }
    else { await p.evaluate(()=>{ document.getElementById('bsCtl').classList.add('on'); }); }
    await p.evaluate(()=>{ document.getElementById('bsCtl').classList.add('on'); const d=document.querySelector('.dr-bar[data-dk="bs_dr"]'); if(d) d.style.display='none'; }); await sleep(300);   // som när man kommer fram till vallen
    const f=await topOf('.bs-ctl button'); ok(f.length&&f.every(Boolean), `${base} skidskytte: avtryckaren${f.length>1?' och knäppknapparna':''} ligger överst och går att trycka på (${f.join('')})`);
    await p.tap('.bs-fire',{timeout:20000}).then(()=>ok(true,`${base} skidskytte: tryck på AVFYRA går igenom`)).catch(e=>ok(false,`${base} skidskytte: tryck på AVFYRA – ${e.message.split('\n')[0]}`));
    // slalom
    await p.evaluate(()=>{ view='lobby'; G=null; mode=null; render(); GINFO.slalom.menu(); }); await sleep(500); await p.fill('#nm','Test'); await p.click('[data-sl=solo]'); await sleep(2000);
    const s=await topOf('.dr-bar [data-dr], .sl-glb, [data-sl]'); ok(s.length&&s.every(Boolean), `${base} slalom: knapparna ovanpå bilden går att trycka på (${s.join('')})`);
    ok(!errs.length, `${base} inga fel ${errs.slice(0,2).join(' | ')}`); await c.close(); }
  await b.close(); process.exit(fail?1:0); })();
