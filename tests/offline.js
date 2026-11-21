// Leveransgaranti i chatten: meddelanden till den som är offline kommer fram när hen går online igen.
// Kör med lokal server på 9000 och TA/UA, TB/UB från /tmp/mktok.sh. SRVCMD = kommando som startar om servern.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const {execSync}=require('child_process');
const {TA,UA,TB,UB}=process.env;
(async()=>{ const b=await chromium.launch(); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  async function ctx(tok,u,name){ const c=await b.newContext({viewport:{width:390,height:844}});
    await c.addInitScript(`window.__NET_SERVER='127.0.0.1:9000'; try{ if(!localStorage.getItem('dev:srv_tok')){ localStorage.setItem('dev:srv_tok','${tok}'); localStorage.setItem('dev:srv_user','${u}'); localStorage.setItem('dev:ry_name','${name}'); localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:pins_init','1'); } }catch(e){}`); return {c,name}; }
  async function open(x){ x.p=await x.c.newPage(); x.p.on('pageerror',e=>errs.push(x.name+': '+e.message)); await x.p.goto('http://127.0.0.1:8811/dev/'); await sleep(3000); await x.p.evaluate(()=>CHAT.reconnect()); await sleep(2000); return x; }
  const A=await open(await ctx(TA,UA,'Alva')), B=await open(await ctx(TB,UB,'Bert'));
  for(let i=0;i<2;i++){ for(const x of [A,B]) await x.p.evaluate(()=>CHAT.reconnect()); await sleep(2500); }
  // Alva hittar Bert i användarlistan
  await A.p.evaluate(()=>CHAT.open()); await sleep(300); await A.p.click('[data-c=tab][data-t=contacts]'); await sleep(1500);
  await A.p.evaluate(u=>[...document.querySelectorAll('[data-c=diradd]')].find(b=>b.closest('.wa-row').innerText.includes('@'+u)).click(), UB); await sleep(800);
  const bid=await B.p.evaluate(()=>CHAT.call.myId()), pid=await A.p.evaluate(id=>CHAT.primaryOf(id), bid);
  const send=async(x,cid,t)=>{ await x.p.evaluate(c=>{ CHAT.open(); CHAT.openChat(c); },cid); await sleep(400); await x.p.fill('#waText',t); await x.p.click('[data-c=send]'); };
  const st=async(x,t)=>x.p.evaluate(t=>{ for(const c of Object.values(CHAT.__test.convs())){ const m=c.msgs.find(m=>m.out&&m.text===t); if(m) return Object.values(m.st||{}).sort().pop()||'queued'; } return 'saknas'; },t);
  const got=async(x,t)=>x.p.evaluate(t=>Object.values(CHAT.__test.convs()).some(c=>c.msgs.some(m=>!m.out&&m.text===t)),t);
  const waitFor=async(f,ms)=>{ const t0=Date.now(); while(Date.now()-t0<ms){ if(await f()) return true; await sleep(1000); } return false; };

  // 1) Bert är offline (appen stängd) redan när Alva skriver första meddelandet
  await B.p.close(); await sleep(1500);
  await send(A,'d:'+pid,'första meddelandet medan du var borta');
  ok(await waitFor(async()=>(await st(A,'första meddelandet medan du var borta'))==='sent',15000), 'Bert offline: meddelandet sparas i brevlådan (✓)');
  // 2) servern startas om medan meddelandet väntar – det ska ligga kvar
  await sleep(3000); execSync(process.env.SRVCMD||'true'); await sleep(2500);
  // 3) Bert öppnar appen igen
  await open(B);
  ok(await waitFor(()=>got(B,'första meddelandet medan du var borta'),30000), 'Bert öppnar appen: meddelandet kommer fram (även efter omstart av servern)');
  await A.p.evaluate(()=>CHAT.reconnect());
  ok(await waitFor(async()=>['delivered','read'].includes(await st(A,'första meddelandet medan du var borta')),30000), 'Alva ser ✓✓ (levererat)');
  // 4) servern nere när Alva skriver (Bert offline), och Alva stänger appen innan det hunnit iväg
  await B.p.close(); execSync('/tmp/srvstop.sh');
  await send(A,'d:'+pid,'skrivet utan kontakt');
  await sleep(3000); ok((await st(A,'skrivet utan kontakt'))==='queued', 'ingen kontakt: meddelandet väntar i telefonen (🕓)');
  ok(await A.p.evaluate(()=>/Väntar på nät/.test(document.getElementById('waMsgs').innerText)), 'chatten förklarar att det skickas automatiskt så fort det finns kontakt');
  await A.p.close(); execSync(process.env.SRVCMD||'true'); await sleep(1500);
  await open(A);
  ok(await waitFor(async()=>(await st(A,'skrivet utan kontakt'))==='sent',30000), 'Alva öppnar appen igen: meddelandet läggs i brevlådan (✓)');
  await A.p.evaluate(c=>{ CHAT.open(); CHAT.openChat(c); },'d:'+pid); await sleep(500);
  ok(await A.p.evaluate(()=>/Sparat krypterat i brevlådan/.test(document.getElementById('waMsgs').innerText)), 'chatten förklarar att Bert får det när han är online igen');
  await A.p.screenshot({path:'/tmp/off1.png'});
  await A.p.close();
  await open(B);
  ok(await waitFor(()=>got(B,'skrivet utan kontakt'),30000), 'Bert öppnar appen (Alva offline): meddelandet kommer fram via brevlådan');
  // 5) brevlådan töms (som efter 30 dygn) medan Bert är borta: Alvas telefon lägger tillbaka det efter 7 dygn utan leverans
  await B.p.close(); await open(A);
  await send(A,'d:'+pid,'ligger länge i brevlådan');
  ok(await waitFor(async()=>(await st(A,'ligger länge i brevlådan'))==='sent',15000), 'nytt meddelande i brevlådan');
  await sleep(2500); execSync(process.env.SRVWIPE||'true'); await sleep(1500);
  await A.p.evaluate(()=>{ for(const o of CHAT.__test.outbox()) if(o.mbox>0) o.mbox=Date.now()-8*864e5; CHAT.__test.flushAll(); });
  await sleep(5000); await A.p.close();
  await open(B);
  ok(await waitFor(()=>got(B,'ligger länge i brevlådan'),30000), 'brevlådan tömd: Alvas telefon lade tillbaka meddelandet och Bert får det (Alva offline)');
  ok(!errs.length, 'inga fel: '+errs.slice(0,3).join(' | '));
  await b.close(); process.exit(fails?1:0); })();
