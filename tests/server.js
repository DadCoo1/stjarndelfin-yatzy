// Spelservern: inloggning med TOTP, brevlåda för offline-meddelanden, närvaro och autosvar (ping).
// Kräver lokal server: DATA_DIR=/tmp/srvtest/data TURN_SECRET=... node server/app.js (testet skapar inbjudningar med spel-user).
const {chromium}=require('playwright'); const {execFileSync}=require('child_process'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const code=(u,d=0)=>execFileSync('python3',['/tmp/srvtest/totp.py',u,String(d)]).toString().trim();
const codeS=(sec,d=0)=>execFileSync('python3',['/tmp/srvtest/totp2.py',sec,String(d)]).toString().trim();
const ENV={...process.env, DATA_DIR:'/tmp/srvtest/data', APP_URL:'http://127.0.0.1:8811/'};
const invite=u=>execFileSync('node',['server/spel-user','invite',u,'--dev'],{env:ENV}).toString().match(/http\S+#invite=\S+/)[0];
const OPTS="window.__NET_SERVER='127.0.0.1:9000';";
(async()=>{ const b=await chromium.launch(); const errs=[]; let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; };
  async function page(ctx,name){ const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(name+' '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200); return p; }
  async function login(p,u,d){ await p.waitForSelector('#srvU',{timeout:8000}); await p.fill('#srvU',u); await p.fill('#srvC',code(u,d)); await sleep(1200); }
  const cA=await b.newContext({viewport:{width:390,height:844}}), cB=await b.newContext({viewport:{width:390,height:844}});
  for(const c of [cA,cB]) await c.addInitScript(OPTS);
  // konto kan bara skapas via inbjudan
  const invA=invite('alva'), invB=invite('bea');
  let A=await page(cA,'A');
  await A.evaluate(()=>CHAT.open()); await sleep(400); await A.fill('#waName','Alva'); await A.click('[data-c=create]'); await sleep(800);
  ok(await A.$('#srvU'), 'inloggningsrutan visas när appen behöver servern');
  ok(/inbjudningslänk/.test(await A.textContent('#modal')), 'rutan säger att konton bara skapas via inbjudan');
  await A.fill('#srvU','alva'); await A.fill('#srvC','000000'); await sleep(800);
  ok(/Fel/.test(await A.textContent('#srvErr')), 'utan konto går det inte att logga in: '+await A.textContent('#srvErr'));
  await A.goto(invA); await sleep(2500);
  ok(await A.$('#invC'), 'inbjudningslänken visar QR-kod och kodruta');
  ok(!/invite=/.test(A.url()), 'inbjudningen tas bort ur adressfältet');
  const secA=await A.evaluate(()=>document.querySelector('#modal code').textContent.replace(/\s/g,''));
  await A.fill('#invC','123456'); await sleep(900); ok(/stämmer inte/.test(await A.textContent('#invErr')), 'fel kod skapar inget konto');
  await A.fill('#invC',codeS(secA)); await sleep(1500);
  ok(await A.evaluate(()=>SRV_USER==='alva' && !!SRV_TOK), 'Alva skapade kontot via inbjudan och är inloggad');
  const again=await A.evaluate(async l=>{ const t=l.split('#invite=')[1]; const r=await fetch('http://127.0.0.1:9000/invite/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t})}); return r.status; },invA);
  ok(again===404, 'inbjudningslänken fungerar bara en gång');
  let B=await page(cB,'B'); await B.evaluate(()=>CHAT.open()); await sleep(400); await B.fill('#waName','Bea'); await B.click('[data-c=create]'); await sleep(800);
  await B.goto(invB); await sleep(2500); const secB=await B.evaluate(()=>document.querySelector('#modal code').textContent.replace(/\s/g,''));
  await B.fill('#invC',codeS(secB)); await sleep(1500);
  ok(await B.evaluate(()=>SRV_USER==='bea'), 'Bea skapade kontot via inbjudan');
  await sleep(2500);
  const link=p=>p.evaluate(()=>{ const c=CHAT.card(); return location.origin+location.pathname+'#k='+btoa(unescape(encodeURIComponent(JSON.stringify(c)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); });
  const la=await link(A), lb=await link(B); await A.evaluate(l=>CHAT.__test.scan(l),lb); await B.evaluate(l=>CHAT.__test.scan(l),la); await sleep(500);
  for(const p of [A,B]) await p.evaluate(()=>closeModal());
  const ida=await A.evaluate(()=>CHAT.myId()), idb=await B.evaluate(()=>CHAT.myId());
  for(let i=0;i<20;i++){ if(await A.evaluate(id=>CHAT.__test.conns().includes(id),idb)) break; await sleep(500); }
  ok(await A.evaluate(id=>CHAT.__test.conns().includes(id),idb), 'Alva och Bea är uppkopplade via den egna kopplingsservern');
  // närvaro och autosvar
  await A.evaluate(()=>CHAT.__test.presPull()); await sleep(500);
  ok(await A.evaluate(id=>CHAT.__test.srvPres()[id]===0,idb), 'servern säger att Bea är online');
  await A.evaluate(id=>CHAT.__test.ping(id),idb); await sleep(2500);
  const ps=await A.evaluate(id=>CHAT.__test.pingSt()[id],idb); ok(ps && ps.s==='ok', 'Beas telefon svarade automatiskt på ping ('+(ps&&ps.ms)+' ms)');
  // Bea stänger appen – Alva skriver
  await B.close(); await sleep(2500);
  await A.evaluate(()=>CHAT.__test.presPull()); await sleep(400);
  ok(await A.evaluate(id=>CHAT.__test.srvPres()[id]!==0,idb), 'servern ser att Bea har gått offline');
  await A.evaluate(id=>{ CHAT.openChat('d:'+id); },idb); await sleep(600);
  await A.fill('#waText','Hej Bea, är du där? 🐬'); await A.click('[data-c=send]'); await sleep(3500);
  const st1=await A.evaluate(id=>{ const c=CHAT.__test.convs()['d:'+id]; const m=c.msgs.filter(m=>m.out).pop(); return m && m.st && m.st[id]; },idb);
  ok(st1==='sent', 'meddelandet ligger i serverns brevlåda (status '+st1+')');
  await sleep(2000); const mb=JSON.parse(require('fs').readFileSync('/tmp/srvtest/data/mbox.json','utf8')); const items=Object.values(mb.box).flat();
  ok(items.length && items.every(m=>m.env.t==='sealed' && Object.keys(m.env).sort().join()==='c,e,t,to'), 'servern ser bara förseglade kuvert (mottagare + utfylld storlek)');
  ok(!JSON.stringify(items).includes(ida) && !JSON.stringify(mb).includes('alva'), 'brevlådan innehåller varken avsändarens ID eller användarnamn');
  ok(items.every(m=>[1024,2048,4096,8192,16384].some(n=>Math.abs(atob(m.env.c.split('.')[1]).length-16-n)<1)), 'kuvertens storlek är utfylld till fasta steg');
  const bad=await A.evaluate(async()=>{ const r=await srvFetch('/mbox/send',{items:[{to:'0123456789abcdef', env:{t:'env', from:'aaaaaaaaaaaaaaaa', to:'0123456789abcdef', ct:'x'}}]}); return r && r.stored; });
  ok(bad===0, 'servern vägrar ta emot oförseglade kuvert');
  const steal=await A.evaluate(async id=>{ const c=await (await fetch(srvUrl('/mbox/challenge'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})).json(); const r=await fetch(srvUrl('/mbox/fetch'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id, n:c.n, proof:btoa('x'.repeat(32))})}); return r.status; },idb);
  ok(steal===403, 'ingen annan kan hämta Beas brevlåda utan Beas nyckel');
  await A.evaluate(id=>CHAT.__test.ping(id),idb); await sleep(11000);
  const ps2=await A.evaluate(id=>CHAT.__test.pingSt()[id],idb); ok(ps2 && ps2.s==='none', 'ping utan svar när Bea är offline');
  // Alva stänger också – Bea öppnar igen och får meddelandet
  await A.close(); await sleep(1500);
  B=await page(cB,'B2'); B.on('console',m=>{ if(m.type()==='warning'||m.type()==='error') console.log('   B:',m.text()); }); let got=null;
  for(let i=0;i<12 && !(got && got.length);i++){ await sleep(1000); await B.evaluate(()=>CHAT.__test.mbPull()); got=await B.evaluate(id=>{ const c=CHAT.__test.convs()['d:'+id]; return c && c.msgs.filter(m=>!m.out && !m.sys).map(m=>m.text); },ida); }
  if(!(got&&got.length)) console.log('   Beas chattar:', JSON.stringify(await B.evaluate(()=>Object.fromEntries(Object.entries(CHAT.__test.convs()).map(([k,c])=>[k,c.msgs.map(m=>m.text||m.sys||'')])))));
  ok(got && got.includes('Hej Bea, är du där? 🐬'), 'Bea fick meddelandet fast båda aldrig var online samtidigt');
  // Alva öppnar igen och ser leveranskvittot
  A=await page(cA,'A2'); await sleep(4000); await A.evaluate(()=>CHAT.__test.mbPull()); await sleep(1500);
  const st2=await A.evaluate(id=>{ const c=CHAT.__test.convs()['d:'+id]; const m=c.msgs.filter(m=>m.out).pop(); return m && m.st && m.st[id]; },idb);
  ok(st2==='delivered'||st2==='read', 'Alva ser att meddelandet är levererat ('+st2+')');
  // utloggning
  await A.evaluate(()=>srvLogout()); ok(await A.evaluate(async()=>(await srvFetch('/turn'))===null), 'utloggad session fungerar inte längre');
  console.log('errs',errs); console.log(fails?fails+' FEL':'alla servertester ok'); await b.close(); process.exit(fails?1:0); })();
