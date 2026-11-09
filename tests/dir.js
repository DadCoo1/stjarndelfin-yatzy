// Användarlistan: alla vanliga användare hittar varandra (inte admin), chattar och ringer utan att ha bytt QR-kod.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [TA,TB,TC]=[process.env.TA,process.env.TB,process.env.TC];
(async()=>{ const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}); const errs=[]; let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; };
  async function user(tok,u,name){
    const c=await b.newContext({viewport:{width:390,height:844}, permissions:['camera','microphone']});
    await c.addInitScript(`window.__NET_SERVER='127.0.0.1:9000'; try{ if(!localStorage.getItem('dev:srv_tok')){ localStorage.setItem('dev:srv_tok','${tok}'); localStorage.setItem('dev:srv_user','${u}'); } }catch(e){}`);
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(u+': '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200);
    await p.evaluate(()=>CHAT.open()); await sleep(400); await p.fill('#waName',name); await p.click('[data-c=create]'); await sleep(2500);
    await p.evaluate(()=>closeModal()); return p;
  }
  const A=await user(TA,process.env.UA,'Alva'), B=await user(TB,process.env.UB,'Bert'), C=await user(TC,process.env.UC,'Admin');
  await sleep(2000);
  for(const p of [A,B,C]) await p.evaluate(()=>CHAT.__dir && 0);
  for(const p of [A,B,C]){ await p.evaluate(()=>CHAT.reconnect()); } await sleep(2500);
  await A.evaluate(()=>CHAT.open()); await sleep(300); await A.click('[data-c=tab][data-t=contacts]'); await sleep(1500);
  const rows=await A.$$eval('[data-c=diradd]', bs=>bs.map(b=>b.closest('.wa-row').innerText));
  ok(rows.some(t=>t.includes('@'+process.env.UB)), 'Alva ser Bert i listan: '+JSON.stringify(rows));
  ok(!rows.some(t=>/Admin/.test(t)), 'adminkontot syns inte');
  await A.evaluate(u=>[...document.querySelectorAll('[data-c=diradd]')].find(b=>b.closest('.wa-row').innerText.includes('@'+u)).click(), process.env.UB); await sleep(800);
  await A.fill('#waText','hej Bert!'); await A.click('[data-c=send]'); await sleep(5000);
  const bs=await B.evaluate(()=>{ const cv=Object.values(CHAT.__test.convs()).find(c=>c.type==='dm'); return cv ? {req:!!cv.request, txt:cv.msgs.map(m=>m.text).join('|')} : null; });
  ok(bs && /hej Bert/.test(bs.txt) && !bs.req, 'Bert fick meddelandet direkt, utan kontaktförfrågan: '+JSON.stringify(bs));
  // Bert ringer Alva (Bert har inte lagt till Alva själv)
  const aid=await A.evaluate(()=>CHAT.call.myId());
  await B.evaluate(id=>CALL.start(id,false),aid); await sleep(5000);
  const st=await A.evaluate(()=>CALL.__state()); ok(st && st.state==='incoming', 'Alva får samtalet från Bert ('+(st&&st.state)+')');
  // Admin kan också se och nå vanliga användare
  await C.evaluate(()=>CHAT.open()); await sleep(300); await C.click('[data-c=tab][data-t=contacts]'); await sleep(1500);
  const crow=await C.$$eval('[data-c=diradd]', bs=>bs.map(b=>b.closest('.wa-row').innerText)); ok(crow.length>=2, 'admin ser vanliga användare: '+crow.length);
  console.log('errs',errs); console.log(fails?fails+' FEL':'alla katalogtester ok'); await b.close(); process.exit(fails?1:0); })();
