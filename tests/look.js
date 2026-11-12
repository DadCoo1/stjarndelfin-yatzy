// Sommarvägen och skidskyttet: skarp upplösning, alla drönarvyer ritar utan fel, bilden är inte tom
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; };
(async()=>{ const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}); const c=await b.newContext({viewport:{width:430,height:860},deviceScaleFactor:3}); await c.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:sfx','0'); Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8})");
  const errs=[]; let p=await c.newPage(); p.on('pageerror',e=>errs.push('race '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200);
  await p.evaluate(()=>{ openRace(); }); await sleep(500); await p.evaluate(()=>{ window.__raceAuto=true; RACE.__test.go(); }); await sleep(4500);
  const r=await p.evaluate(()=>{ const cv=document.querySelector('canvas'), T=RACE.__test, out=[]; for(const s of [700,2600,4700,6800,8800]){ T.state().pos=s*200; T.draw(); const g=cv.getContext('2d'), d=g.getImageData(0,cv.height*.6|0,cv.width,1).data; let mn=255,mx=0; for(let i=0;i<d.length;i+=4){ mn=Math.min(mn,d[i]); mx=Math.max(mx,d[i]); } out.push(mx-mn); } return {w:cv.width,h:cv.height,cw:cv.clientWidth,out}; });
  ok(r.w>=r.cw*2 && r.w*r.h<=2.5e6, `bilspelet ritas skarpt men under 2,4 Mpx (${r.w}×${r.h})`); ok(r.out.every(v=>v>20), 'alla fem etapper ritar väg och mark');
  await p.close(); p=await c.newPage(); p.on('pageerror',e=>errs.push('bs '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200);
  await p.evaluate(()=>{ window.__bsAuto=true; KIT.startSolo('skidskytte','Test'); }); await sleep(1500); await p.evaluate(()=>{ BIATHLON.__test.run().cd=.2; }); await sleep(4000);
  const q=await p.evaluate(()=>{ const cv=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width-a.width)[0]; return {w:cv.width,h:cv.height,cw:cv.clientWidth}; });
  ok(q.w>=q.cw*2 && q.w*q.h<=2.9e6, `skidskyttet ritas skarpt men under 2,8 Mpx (${q.w}×${q.h})`);
  const t=await p.$('[data-dr=tg]'); if(t) await t.click(); await sleep(800); const n=await p.evaluate(()=>document.querySelectorAll('.dr-bar [data-dr^=v]').length||document.querySelectorAll('.dr-bar [data-dr]').length);
  const bs=await p.$$('.dr-bar [data-dr]'); for(const x of bs.slice(1,6)){ try{ await x.click(); }catch(e){} await sleep(700); }
  ok(n>=4, 'drönarvyerna finns och går att växla mellan');
  // 3D-grafiken (standard) i slalom och skidskytte: ritar med grafikkortet, fungerar i drönarläget, går att stänga av
  await p.close(); const c2=await b.newContext({viewport:{width:390,height:700},deviceScaleFactor:1}); await c2.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:sfx','0'); Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8})");   // mjukvaru-GL i testmiljön: liten bild
  const hasGL=await (await c2.newPage()).evaluate(()=>{ try{ return !!document.createElement('canvas').getContext('webgl'); }catch(e){ return false; } });
  const glCase=async(name,start,pref,sel,tris)=>{
    p=await c2.newPage(); p.on('pageerror',e=>errs.push(name+' '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200); await start();
    for(let i=0;i<40;i++){ await sleep(1500); if(await p.evaluate(tris)>0) break; }   // mjukvaru-GL i testmiljön är långsam i början
    const g=await p.evaluate(([c,b])=>({disp:document.querySelector(c).style.display, txt:(document.querySelector(b)||{}).textContent}),[`.${pref}-glc`,`.${pref}-glb`]); const n=await p.evaluate(tris);
    if(hasGL){ ok(g.disp==='block' && n>40000, `${name}: 3D-grafiken är standard och ritas av grafikkortet (${n} trianglar)`);
      await p.evaluate(()=>document.querySelector('[data-dr=tg]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))); await sleep(2500); ok(await p.evaluate(tris)>40000 && await p.evaluate(c=>document.querySelector(c).style.display,`.${pref}-glc`)==='block', `${name}: 3D-grafiken fungerar i drönarläget`); }
    else ok(g.disp==='none', `${name}: utan WebGL används enkel grafik`);
    await p.evaluate(s=>document.querySelector(s).click(),sel); await sleep(1500); ok(await p.evaluate(c=>document.querySelector(c).style.display==='none',`.${pref}-glc`), `${name}: går att byta till enkel grafik`);
    await p.close(); };
  await glCase('slalom', async()=>{ await p.evaluate(()=>GINFO.slalom.menu()); await sleep(500); await p.fill('#nm','Test'); await p.click('[data-sl=solo]'); await sleep(800); await p.evaluate(()=>{ window.__slAuto=true; }); }, 'sl', '[data-sl=gl]', ()=>SLGL.stats().tris||0);
  await glCase('skidskytte', async()=>{ await p.evaluate(()=>{ window.__bsAuto=true; KIT.startSolo('skidskytte','Test'); }); await sleep(1500); await p.evaluate(()=>{ BIATHLON.__test.run().cd=.2; }); }, 'bs', '[data-bsx=gl]', ()=>BIATHLON.__test.gl().tris||0);
  // Sommarvägen: garage med bilar som låses upp, och 3D-bilen i spelet
  const c3=await b.newContext({viewport:{width:390,height:700},deviceScaleFactor:1}); await c3.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:sfx','0'); localStorage.setItem('dev:race_stats',JSON.stringify({best:1,games:2,fin:0,hs:[],unl:1})); Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8})");
  p=await c3.newPage(); p.on('pageerror',e=>errs.push('gar '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200); await p.evaluate(()=>openRace()); await sleep(1500);
  const gar=await p.evaluate(()=>({n:document.querySelectorAll('.rc-car').length, lock:document.querySelectorAll('.rc-car.lock').length, names:[...document.querySelectorAll('.rc-car b')].map(x=>x.textContent).join(',')}));
  ok(gar.n===6 && gar.lock===5, `garaget visar sex bilar, fem låsta från början (${gar.names})`);
  ok(!/porsche|ferrari|lamborghini|koenigsegg|bentley/i.test(gar.names), 'bilarna har egna namn, inga bilmärken');
  await p.evaluate(()=>document.querySelector('.rc-car[data-v="3"]').click()); await sleep(300);
  ok(await p.evaluate(()=>RACE.__test.cfg().car===0 && !!document.querySelector('.rc-garmsg')), 'en låst bil går inte att välja; kravet visas');
  const U=await p.evaluate(()=>{ const u=RACE.__test.unlocked, f=s=>[1,2,3,4,5].map(i=>u(i,{best:0,games:0,fin:0,hs:[],...s})?1:0).join(''); return [f({}),f({games:3}),f({games:12}),f({fin:1}),f({fin:1,finD:{normal:1}}),f({fin:1,finD:{svar:1}}),f({games:45}),f({nmT:40})]; });
  ok(U.join(' ')==='00000 10000 11000 00100 00110 00111 11111 01000', 'upplåsningen följer kraven, och allt går att nå med antal lopp ('+U.join(' ')+')');
  await p.evaluate(()=>{ window.__raceAuto=true; RACE.__test.go(); RACE.__test.state().cd=0; }); await sleep(1500);
  const r3=await p.evaluate(()=>{ const T=RACE.__test, cv=document.querySelector('#rcc'), st=T.state(); T.sim(1); T.draw(); const o=CARS3D.ok(); const g=cv.getContext('2d'), d=g.getImageData(cv.width/2-60|0,cv.height*.86|0,120,1).data; let blue=0; for(let i=0;i<d.length;i+=4) if(d[i+2]>d[i]+40) blue++; st.time=0; st.over=false; return {o,blue}; });
  if(hasGL) ok(r3.o && r3.blue>40, `spelarens bil ritas i 3D med vald lack (${r3.blue} blå punkter)`); else ok(!r3.o, 'utan WebGL ritas bilen som förut');
  await p.evaluate(()=>{ const T=RACE.__test, st=T.state(); for(let i=0;i<4000&&!document.querySelector('.rc-unl')&&!/TIDEN|MÅL/.test(document.querySelector('#rcOv').textContent);i++) T.sim(.5); }); await sleep(500);
  ok(await p.evaluate(()=>/Pilen/.test((document.querySelector('.rc-unl')||{}).textContent||'')), 'tredje loppet låser upp Pilen, och det firas på resultatskärmen');
  ok(!errs.length, 'inga fel: '+errs.slice(0,3).join(' | ')); await b.close(); process.exit(fail?1:0); })();
