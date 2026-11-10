// Samma konto på två enheter: kompisen ser en person, meddelanden når båda enheterna, svar hamnar i samma konversation,
// det jag skriver på en enhet syns på den andra, och samtal går till enheten som är online.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const {TA,UA,TB,UB}=process.env;
(async()=>{ const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  async function dev(tok,u,name){ const c=await b.newContext({viewport:{width:390,height:844}, permissions:['camera','microphone']});
    await c.addInitScript(`window.__NET_SERVER='127.0.0.1:9000'; try{ if(!localStorage.getItem('dev:srv_tok')){ localStorage.setItem('dev:srv_tok','${tok}'); localStorage.setItem('dev:srv_user','${u}'); localStorage.setItem('dev:ry_name','${name}'); localStorage.setItem('dev:onboarded','1'); } }catch(e){}`);
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(name+': '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(3000); return {c,p}; }
  const A=await dev(TA,UA,'Alva'), B1=await dev(TB,UB,'Bert'), B2=await dev(TB,UB,'Bert');
  const sync=async()=>{ for(const x of [A,B1,B2]) await x.p.evaluate(()=>CHAT.reconnect()); await sleep(2500); };
  await sync(); await sync();
  const b1=await B1.p.evaluate(()=>CHAT.call.myId()), b2=await B2.p.evaluate(()=>CHAT.call.myId());
  ok(b1 && b2 && b1!==b2, 'Berts två enheter har var sin nyckel');
  ok(await B1.p.evaluate(id=>CHAT.myDevices().includes(id), b2), 'Berts enheter känner till varandra');
  await A.p.evaluate(()=>CHAT.open()); await sleep(300); await A.p.click('[data-c=tab][data-t=contacts]'); await sleep(1500);
  const rows=await A.p.$$eval('[data-c=diradd]', bs=>bs.map(b=>b.closest('.wa-row').innerText)).then(r=>r.filter(t=>t.includes('@'+process.env.UB)));
  ok(rows.length===1, 'Alva ser Bert som en person, inte två ('+rows.length+')');
  await A.p.evaluate(u=>[...document.querySelectorAll('[data-c=diradd]')].find(b=>b.closest('.wa-row').innerText.includes('@'+u)).click(), UB); await sleep(800);
  const ac=await A.p.evaluate(()=>{ const c=CHAT.__test.contacts(); return Object.keys(c).length; }); 
  const shown=await A.p.evaluate(()=>{ CHAT.open(); return 1; }).then(()=>A.p.$$eval('[data-c=open]', xs=>xs.map(x=>x.innerText).filter(t=>/Bert/.test(t)).length));
  ok(ac>=2 && shown<=1, 'båda enheterna är kopplade, men Bert syns en gång i kontakterna');
  const pid=await A.p.evaluate(id=>CHAT.primaryOf(id), b1);
  await A.p.evaluate(id=>CHAT.openChat('d:'+id), pid); await sleep(500); await A.p.fill('#waText','hej Bert!'); await A.p.click('[data-c=send]'); await sleep(6000);
  const got=async x=>x.p.evaluate(()=>Object.values(CHAT.__test.convs()).filter(c=>c.type==='dm').map(c=>c.msgs.map(m=>(m.out?'>':'<')+m.text).join('|')));
  await sleep(8000);
  const g1=await got(B1), g2=await got(B2);
  ok(g1.join().includes('<hej Bert!') && g2.join().includes('<hej Bert!'), 'meddelandet når båda Berts enheter '+JSON.stringify({g1,g2, rec:await A.p.evaluate(id=>CHAT.devices(id), pid)}));
  // B2 svarar
  const aid=await A.p.evaluate(()=>CHAT.call.myId());
  await B2.p.evaluate(id=>CHAT.openChat('d:'+CHAT.primaryOf(id)), aid); await sleep(500); await B2.p.fill('#waText','hej från surfplattan'); await B2.p.click('[data-c=send]'); await sleep(6000);
  const ga=await got(A); ok(ga.length===1 && ga[0].includes('>hej Bert!') && ga[0].includes('<hej från surfplattan'), 'svaret hamnar i samma konversation hos Alva: '+JSON.stringify(ga));
  const s1=await got(B1); ok(s1.join().includes('>hej från surfplattan'), 'det Bert skrev på surfplattan syns även på telefonen');
  // B1 stänger – Alva ringer Bert och det ringer på surfplattan
  await B1.c.close(); await sleep(1500); await A.p.evaluate(()=>CHAT.reconnect()); await sleep(2500);
  await A.p.evaluate(id=>CALL.start(id,false), pid); await sleep(6000);
  const st=await B2.p.evaluate(()=>CALL.__state()); ok(st && st.state==='incoming', 'samtalet går till enheten som är online ('+(st&&st.state)+')');
  console.log('errs',errs.filter(e=>!/ERR_|Failed to load/.test(e))); console.log(fails?fails+' FEL':'alla flerenhetstester ok'); await b.close(); process.exit(fails?1:0); })();
