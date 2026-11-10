// Spökbil i Sommarvägen: första åket sparas som spöke, andra åket kör mot det.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  const c=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2}); await c.addInitScript("window.__NET_SERVER=''; localStorage.setItem('dev:onboarded','1')");
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(2000);
  await p.evaluate(()=>{ window.__raceAuto=true; openRace(); }); await sleep(1200);
  const r1=await p.evaluate(()=>{ const T=RACE.__test; T.go(); T.sim(4); T.sim(40); T.end(false); const g=JSON.parse(lsGet('race_ghost_'+T.cfg().diff)||'null'); return g && {n:g.s.length, rt:g.rt, pos:g.pos}; });
  ok(r1 && r1.n>100, 'första åket sparades som spöke '+JSON.stringify(r1));
  const r2=await p.evaluate(()=>{ const T=RACE.__test; T.go(); T.sim(4); T.sim(12); const st=T.state(); return {gh:!!st.gh, name:st.gh&&st.gh.name, lead:st.ghLead}; });
  ok(r2.gh && r2.name==='Ditt bästa', 'andra åket kör mot spöket '+JSON.stringify(r2));
  await p.evaluate(()=>{ const T=RACE.__test; T.sim(1); T.draw(); }); await sleep(300); await p.screenshot({path:'/tmp/ghost.png'});
  const menu=await p.evaluate(()=>{ const T=RACE.__test; T.end(false); return document.getElementById('rcOv').innerText; });
  ok(/spöke/i.test(menu), 'resultatet nämner spöket: '+(menu.match(/👻[^\n]*/)||[''])[0]);
  console.log('errs',errs); console.log(fails?fails+' FEL':'alla spöktester ok'); await b.close(); process.exit(fails?1:0); })();
