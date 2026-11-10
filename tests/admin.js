// Admin-sidan: inloggning (bara admin), översikt, användare, inbjudningar, händelser.
const {chromium}=require('playwright'); const {execFileSync}=require('child_process'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fs=require('fs'); const sec=u=>fs.readFileSync('/tmp/srvtest/sec_'+u,'utf8').trim();
const code=(s,d=0)=>execFileSync('python3',['/tmp/srvtest/totp2.py',s,String(d)]).toString().trim();
(async()=>{ const b=await chromium.launch(); const errs=[]; let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; };
  const p=await b.newPage({viewport:{width:1200,height:900}}); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  p.on('dialog',d=>d.accept());
  await p.goto('http://127.0.0.1:9000/admin'); await sleep(600);
  await p.fill('#lu','elsa'); await p.fill('#lc',code(sec('elsa'),1)); await sleep(900);
  ok(/inte admin/.test(await p.textContent('#le')), 'vanlig användare kommer inte in: '+await p.textContent('#le'));
  await p.fill('#lu','pappa'); await p.fill('#lc',code(sec('pappa'),1)); await sleep(1500);
  ok(await p.$('nav'), 'admin är inloggad'); await p.screenshot({path:'/tmp/adm_overview.png', fullPage:true});
  await p.click('[data-tab=users]'); await sleep(800); await p.screenshot({path:'/tmp/adm_users.png', fullPage:true});
  ok((await p.textContent('#main')).includes('kompis'), 'användarlistan visar alla konton');
  await p.click('[data-u=kompis][data-a=disable]'); await sleep(700);
  ok(/avstängd/.test(await p.textContent('#main')), 'kompis kan stängas av');
  const t=fs.readFileSync('/tmp/srvtest/tok_kompis','utf8').trim();
  ok((await (await fetch('http://127.0.0.1:9000/auth/me',{headers:{Authorization:'Bearer '+t}})).status)===401, 'avstängd användare kan inte använda servern');
  await p.click('[data-u=kompis][data-a=enable]'); await sleep(700);
  await p.click('[data-tab=invites]'); await sleep(600); await p.fill('#in','mormor'); await p.click('#ig'); await sleep(900);
  const link=await p.textContent('#lnk'); ok(/#invite=/.test(link), 'inbjudningslänk skapad: '+link.slice(0,50)+'…');
  await p.screenshot({path:'/tmp/adm_invites.png', fullPage:true});
  // serveruppdatering: status från uppdateraren, godkänn rätt version, fel version nekas
  fs.writeFileSync('/tmp/srvtest/data/update.json', JSON.stringify({state:'available', installed:'2026.11.09.9', available:'2026.11.10.1', changes:['Testrad om något nytt'], message:'Ny serverversion finns', log:'', at:Date.now()}));
  try{ fs.unlinkSync('/tmp/srvtest/data/update-request.json'); }catch(e){}
  await p.click('[data-tab=update]'); await sleep(700); const up=await p.textContent('#main');
  ok(/Ny version finns/.test(up) && /Testrad om något nytt/.test(up) && await p.$('#updGo'), 'uppdateringsfliken visar ny version och ändringar');
  await p.screenshot({path:'/tmp/adm_update.png', fullPage:true});
  await p.click('#updGo'); await sleep(800);
  const rq=JSON.parse(fs.readFileSync('/tmp/srvtest/data/update-request.json','utf8')); ok(rq.version==='2026.11.10.1' && rq.by==='pappa', 'godkännande skriver bara versionsnumret');
  const tokA=await p.evaluate(()=>sessionStorage.getItem('adm'));
  const bad=await fetch('http://127.0.0.1:9000/admin/api/update',{method:'POST',headers:{'Authorization':'Bearer '+tokA,'Content-Type':'application/json'},body:JSON.stringify({version:'2026.11.10.7'})});
  ok(bad.status===409, 'en annan version än den som finns kan inte godkännas ('+bad.status+')');
  const t2=fs.readFileSync('/tmp/srvtest/tok_kompis','utf8').trim();
  const nope=await fetch('http://127.0.0.1:9000/admin/api/update',{headers:{Authorization:'Bearer '+t2}}); ok(nope.status===401||nope.status===403, 'vanlig användare når inte uppdateringen');
  await p.click('[data-tab=audit]'); await sleep(600); const au=await p.textContent('#main');
  ok(/godkände serveruppdatering/.test(au) && /bjöd in mormor/.test(au) && /stängde av kompis/.test(au) && /misslyckad admininloggning/.test(au), 'händelseloggen visar vad som hänt');
  await p.screenshot({path:'/tmp/adm_audit.png'});
  console.log('errs',errs); console.log(fails?fails+' FEL':'alla admintester ok'); await b.close(); process.exit(fails?1:0); })();
