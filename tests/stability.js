// Stabilitet: fel fångas och sparas, en trasig del tar inte ner startsidan, en trasig vy ger ett vänligt felkort,
// felrapporten visar version och fel utan personliga uppgifter, och svaga enheter får lugnare utseende från början.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; };
  const c=await b.newContext({viewport:{width:390,height:844}}); await c.addInitScript("window.__NET_SERVER=''; try{ localStorage.setItem('dev:onboarded','1'); }catch(e){} localStorage.setItem('dev:ry_name','Ida')");
  const p=await c.newPage(); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1500);
  await p.evaluate(()=>{ setTimeout(()=>{ throw new Error('testfel i bakgrunden'); },0); Promise.reject(new Error('testlöfte')); }); await sleep(300);
  const log=await p.evaluate(()=>JSON.parse(lsGet('errlog')||'[]').map(x=>x.m).join(' | ')); ok(/testfel i bakgrunden/.test(log) && /testlöfte/.test(log), 'oväntade fel fångas och sparas');
  await p.evaluate(()=>{ TODAY.heroHTML=()=>{ throw new Error('trasig hälsning'); }; render(); }); await sleep(300);
  ok(await p.evaluate(()=>document.querySelectorAll('.tile[data-g]').length>15 && !document.querySelector('.crash')), 'en trasig del av startsidan tar inte ner resten');
  await p.evaluate(()=>{ view='game'; G={kind:'nosuchgame'}; render(); }); await sleep(300);
  ok(await p.evaluate(()=>!!document.querySelector('.crash')), 'en vy som går sönder visar ett vänligt felkort');
  await p.click('[data-act=techinfo]'); await sleep(200);
  const ti=await p.evaluate(()=>document.getElementById('techTxt').value);
  ok(/2026\.\d+\.\d+\.\d+/.test(ti) && /Enhet:/.test(ti) && /testfel i bakgrunden/.test(ti) && !/Ida/.test(ti), 'felrapporten har version, enhet och fel – men inget namn');
  await p.evaluate(()=>closeModal()); await p.click('[data-act=crashhome]'); await sleep(400);
  ok(await p.evaluate(()=>view==='lobby' && !document.querySelector('.crash') && !!document.querySelector('.tile')), 'Startsidan-knappen tar en tillbaka');
  await c.close();
  // svag enhet (iPadOS 15): lugnare rörelser från början
  const c2=await b.newContext({viewport:{width:768,height:1024}, userAgent:'Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1'}); await c2.addInitScript("window.__NET_SERVER=''");
  const p2=await c2.newPage(); await p2.goto('http://127.0.0.1:8811/dev/'); await sleep(1500);
  ok(await p2.evaluate(()=>STYLE.get().motion==='lugn' && document.body.classList.contains('mo-lugn')), 'iPadOS 15 får lugnare rörelser från början');
  console.log(fails?fails+' FEL':'alla stabilitetstester ok'); await b.close(); process.exit(fails?1:0); })();
