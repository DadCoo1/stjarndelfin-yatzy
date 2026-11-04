const {chromium}=require('playwright'); const fs=require('fs'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const kinds=process.argv[2].split(',');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext()).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8811/dev/'); await sleep(900);
  const r=await p.evaluate(`(${fs.readFileSync(__dirname+'/fuzz_page.js','utf8')})(${JSON.stringify(kinds)})`);
  for(const [k,v] of Object.entries(r)){ const bad=v.throws.length+v.invalid.length+v.redactInvalid.length+v.stuck.length+v.badEnd.length;
    console.log(`${bad?'✘':'✔'} ${k}: ${v.games} partier, ${v.moves} drag, ${v.rejected} skräpdrag avvisade`); for(const key of ['throws','invalid','redactInvalid','stuck','badEnd']) v[key].forEach(x=>console.log('    '+key+': '+x)); }
  console.log('errs',errs.slice(0,5)); await b.close(); })();
