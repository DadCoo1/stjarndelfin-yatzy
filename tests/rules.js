const {chromium}=require('playwright'); const fs=require('fs'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext()).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8811/dev/'); await sleep(900);
  const r=await p.evaluate(fs.readFileSync(__dirname+'/rules_page.js','utf8'));
  console.log(`${r.n} regeltester, ${r.F.length} fel`); r.F.forEach(f=>console.log(' ✘',f)); console.log('errs',errs); await b.close(); })();
