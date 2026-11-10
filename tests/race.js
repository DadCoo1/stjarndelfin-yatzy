// Sommarvägen: testpiloten kör hela banan på alla svårighetsgrader (lätt och normal ska gå i mål).
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript("localStorage.setItem('dev:onboarded','1')"); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1000); await p.evaluate(()=>openRace()); await sleep(500);
  for(const d of ['latt','normal','svar']){
    const r=await p.evaluate(d=>{ window.__raceAuto=true; RACE.__test.cfg().diff=d; RACE.__test.go(); const T=RACE.__test; const log=[]; let st=T.state(), last=0;
      for(let i=0;i<60*600 && !T.overlay();i++){ T.sim(1/60); st=T.state(); if(st.stage!==last){ log.push(`etapp${st.stage+1}:${Math.round(st.time)}s`); last=st.stage; } }
      return {d, fin:!!st.won, stage:st.stage+1, score:Math.round(st.score), time:Math.round(st.time), nm:st.nm, log:log.join(' '), crashes:0}; },d);
    console.log(JSON.stringify(r)); }
  console.log('errs',errs); await b.close(); })();
