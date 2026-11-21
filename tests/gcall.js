// Gruppsamtal i ett onlinespel: tre spelare via den lokala servern (TA/UA, TB/UB, TC/UC i miljön)
// A ringer upp, B går med direkt, C låter 15 s gå ut och går med senare. Ljud ska komma fram mellan alla.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const {TA,UA,TB,UB,TC,UC}=process.env;
(async()=>{ const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']}); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  async function dev(tok,u,name){ const c=await b.newContext({viewport:{width:390,height:844}, permissions:['microphone']});
    await c.addInitScript(`window.__NET_SERVER='127.0.0.1:9000'; try{ if(!localStorage.getItem('dev:srv_tok')){ localStorage.setItem('dev:srv_tok','${tok}'); localStorage.setItem('dev:srv_user','${u}'); localStorage.setItem('dev:ry_name','${name}'); localStorage.setItem('dev:onboarded','1'); localStorage.setItem('dev:pins_init','1'); } }catch(e){}`);
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(name+': '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(2500); return {c,p,name}; }
  const A=await dev(TA,UA,'Alva'), B=await dev(TB,UB,'Bert'), C=await dev(TC,UC,'Cleo');
  await A.p.evaluate(()=>hostGame('Alva','free')); await sleep(2500); const code=await A.p.evaluate(()=>gameId);
  for(const x of [B,C]){ await x.p.evaluate(c=>joinGame(c,document.title&&localStorage.getItem('dev:ry_name')),code); await sleep(3000); }
  // starta spelet om det väntar på spelare
  await A.p.evaluate(()=>{ const s=document.querySelector('[data-act=start],[data-act=startgame]'); s&&s.click(); }); await sleep(2000);
  const seats=await Promise.all([A,B,C].map(x=>x.p.evaluate(()=>({seat:mySeat, n:G&&G.names.length, btn:!!document.getElementById('gcBtn')}))));
  ok(seats.every(s=>s.n===3&&s.seat!=null), `tre spelare i spelet (${JSON.stringify(seats.map(s=>s.seat))})`);
  ok(seats.every(s=>s.btn), '📞-knappen syns hos alla');
  await A.p.screenshot({path:'/tmp/gc0.png'});
  // A ringer upp
  await A.p.click('#gcBtn'); await sleep(1500);
  const inv=await Promise.all([B,C].map(x=>x.p.evaluate(()=>({inv:!!document.getElementById('gcInv'), txt:(document.querySelector('#gcInv b')||{}).textContent, st:GCALL.state()}))));
  ok(inv.every(i=>i.inv&&/Alva startar ett gruppsamtal/.test(i.txt)), 'B och C får inbjudan: "Alva startar ett gruppsamtal"');
  await B.p.screenshot({path:'/tmp/gc1.png'});
  ok(await A.p.evaluate(()=>{ const s=GCALL.state(), bar=document.getElementById('gcBar'); return s.in&&s.members.length===1&&!!bar&&bar.previousElementSibling===document.querySelector('.gtop'); }), 'A är med direkt och ser samtalslisten under toppfältet');
  // listen ska finnas kvar när spelet ritas om
  ok(await A.p.evaluate(async()=>{ render(); await new Promise(r=>setTimeout(r,50)); return !!document.getElementById('gcBar')&&!!document.querySelector('.gtop #gcBtn'); }), 'knappen och listen finns kvar när spelet ritas om');
  // B går med
  await B.p.click('#gcInv .gci-yes'); await sleep(7000);
  const ab=await Promise.all([A,B].map(x=>x.p.evaluate(()=>GCALL.state())));
  ok(ab.every(s=>s.in&&s.members.length===2&&s.peers.length===1&&s.peers[0].live), `A och B är uppkopplade (${JSON.stringify(ab.map(s=>s.peers))})`);
  // C väntar ut 15 s
  await sleep(9000);
  const c15=await C.p.evaluate(()=>{ const b=document.getElementById('gcBtn'); return {inv:!!document.getElementById('gcInv'), live:!!b&&b.classList.contains('live'), inTop:!!b&&!!b.closest('.gtop'), n:(b&&b.querySelector('.cbadge')||{}).textContent, label:b&&b.getAttribute('aria-label'), st:GCALL.state()}; });
  ok(!c15.inv && c15.live && c15.inTop && c15.n==='2' && !c15.st.in, `efter 15 s: inbjudan borta hos C, grön 📞 i toppfältet med "2" finns kvar (${c15.label})`);
  await C.p.screenshot({path:'/tmp/gc2.png'});
  // C går med senare
  await C.p.click('#gcBtn'); await sleep(8000);
  const all=await Promise.all([A,B,C].map(x=>x.p.evaluate(()=>GCALL.state())));
  ok(all.every(s=>s.in&&s.members.length===3&&s.peers.length===2&&s.peers.every(p=>p.live)), `alla tre uppkopplade med varandra (${JSON.stringify(all.map(s=>s.peers.map(p=>p.seat+':'+p.live)))})`);
  // kommer ljudet fram? (inkommande RTP-byte på varje förbindelse)
  const bytes=await Promise.all([A,B,C].map(x=>x.p.evaluate(async()=>({el:document.querySelectorAll('#gcAudio audio').length, rx:await GCALL.rx()}))));
  ok(bytes.every(x=>x.el===2&&Object.values(x.rx).length===2&&Object.values(x.rx).every(n=>n>2000)), `ljud tas emot från båda de andra hos var och en (byte: ${JSON.stringify(bytes.map(x=>x.rx))})`);
  await A.p.screenshot({path:'/tmp/gc3.png'});
  // mikrofon av hos B syns hos A
  await B.p.click('#gcBar [data-gc=mute]'); await sleep(1200);
  const mu=await A.p.evaluate(()=>!!document.querySelector('#gcBar [data-gs] i'));
  ok(mu, 'B stänger av mikrofonen – A ser 🔇 på B');
  // B lägger på
  await B.p.click('#gcBar [data-gc=leave]'); await sleep(2000);
  const left=await Promise.all([A,B,C].map(x=>x.p.evaluate(()=>GCALL.state())));
  ok(left[0].members.length===2&&left[2].members.length===2&&!left[1].in&&left[1].id, 'B lägger på: A och C fortsätter, B kan gå med igen');
  // C lämnar spelet – lämnar då samtalet
  await C.p.evaluate(()=>{ stopNet(); }); await sleep(3000);
  const cl=await A.p.evaluate(()=>GCALL.state());
  ok(cl.members.length===1, `C lämnar spelet och därmed samtalet (kvar: ${cl.members.length})`);
  ok(!errs.length, 'inga fel: '+errs.slice(0,3).join(' | '));
  await b.close(); process.exit(fails?1:0); })();
