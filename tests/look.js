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
  // 3D-provet i slalom: startar, ritar backen med grafikkortet, och går att stänga av igen
  await p.close(); const c2=await b.newContext({viewport:{width:390,height:700},deviceScaleFactor:1}); await c2.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:sfx','0'); Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8})");   // mjukvaru-GL i testmiljön: liten bild
  p=await c2.newPage(); p.on('pageerror',e=>errs.push('gl '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200);
  await p.evaluate(()=>GINFO.slalom.menu()); await sleep(500); await p.fill('#nm','Test'); await p.click('[data-sl=solo]'); await sleep(1500);
  const hasGL=await p.evaluate(()=>{ try{ return !!document.createElement('canvas').getContext('webgl'); }catch(e){ return false; } });
  await p.evaluate(()=>document.querySelector('[data-sl=gl]').click()); await p.evaluate(()=>{ window.__slAuto=true; }); for(let i=0;i<40;i++){ await sleep(1500); if(await p.evaluate(()=>SLGL.stats().tris>0)) break; }   // mjukvaru-GL i testmiljön är långsam i början
  const g=await p.evaluate(()=>({on:SLGL.ok(), st:SLGL.stats(), disp:document.querySelector('.sl-glc').style.display, txt:document.querySelector('.sl-glb').textContent}));
  if(hasGL){ ok(g.on && g.disp==='block' && g.st.tris>40000, `3D-provet ritar backen med grafikkortet (${g.st.tris} trianglar, skuggor ${g.st.shadows?'på':'av'})`);
    const bs2=await p.$('[data-dr=tg]'); if(bs2){ await p.evaluate(()=>document.querySelector('[data-dr=tg]').click()); await sleep(1500); } ok((await p.evaluate(()=>SLGL.stats().tris))>40000, '3D-provet fungerar även i drönarläget'); }
  else ok(g.disp==='none' && /3D-prov/.test(g.txt), 'utan WebGL faller spelet tillbaka på vanlig grafik');
  await p.evaluate(()=>document.querySelector('[data-sl=gl]').click()); await sleep(800); ok(await p.evaluate(()=>document.querySelector('.sl-glc').style.display==='none'), '3D-provet går att stänga av; vanlig grafik tar över');
  ok(!errs.length, 'inga fel: '+errs.slice(0,3).join(' | ')); await b.close(); process.exit(fail?1:0); })();
