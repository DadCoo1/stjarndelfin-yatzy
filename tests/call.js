// Samtal: två mobiler blir kontakter, ringer röst- och videosamtal, avvisar, missar och lägger på.
const {chromium}=require('playwright'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OPTS= process.env.OWN ? "window.__NET_SERVER='127.0.0.1:9000'; window.__FORCE_RELAY=true;" : "window.__PEER_OPTS={host:'127.0.0.1',port:9001,path:'/',secure:false,config:{iceServers:[]}};";
(async()=>{ const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
  const errs=[]; let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; };
  async function mk(name){ const c=await b.newContext({viewport:{width:390,height:844}, permissions:['camera','microphone']}); await c.addInitScript(OPTS);
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(name+' '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(1200);
    await p.evaluate(()=>CHAT.open()); await sleep(400); await p.fill('#waName',name); await p.click('[data-c=create]'); await sleep(2500); return p; }
  const A=await mk('Alva'), B=await mk('Bea');
  const link=p=>p.evaluate(()=>{ const c=CHAT.card(); return location.origin+location.pathname+'#k='+btoa(unescape(encodeURIComponent(JSON.stringify(c)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); });
  const la=await link(A), lb=await link(B);
  await A.evaluate(l=>CHAT.__test.scan(l),lb); await B.evaluate(l=>CHAT.__test.scan(l),la); await sleep(500);
  for(const p of [A,B]) await p.evaluate(()=>closeModal());
  const ida=await A.evaluate(()=>CHAT.myId()), idb=await B.evaluate(()=>CHAT.myId());
  for(let i=0;i<20;i++){ const on=await A.evaluate(id=>CHAT.__test.conns().includes(id),idb); if(on) break; await sleep(500); }
  const st=p=>p.evaluate(()=>CALL.__state());
  // 1. röstsamtal, besvaras, säkerhetskoden stämmer, läggs på
  await A.evaluate(id=>CHAT.openChat('d:'+id),idb); await sleep(500);
  ok(await A.$('[data-c=call]:not([data-v])'), 'ringknappar i chatthuvudet');
  await A.click('[data-c=call]:not([data-v])'); await sleep(5500);
  let sb=await st(B); ok(sb && sb.state==='incoming' && !sb.video, 'Bea ser inkommande röstsamtal ('+JSON.stringify(sb&&sb.state)+')');
  let sa=await st(A); ok(sa && sa.state==='ringing', 'Alva ser "det ringer" ('+(sa&&sa.state)+')');
  await B.screenshot({path:'tests/shots/call_incoming.png'});
  await B.click('#callUI [data-k=ans]'); await sleep(7000);
  sa=await st(A); sb=await st(B);
  ok(sa && sb && sa.state==='live' && sb.state==='live', 'samtalet är kopplat på båda ('+(sa&&sa.state)+'/'+(sb&&sb.state)+')');
  ok(sa && sb && sa.sas && sa.sas===sb.sas, 'samma säkerhetsemojis: '+(sa&&sa.sas)+' / '+(sb&&sb.sas));
  const flow=await B.evaluate(()=>{ const v=document.querySelector('#callUI .cl-rv'); return v && v.srcObject ? v.srcObject.getAudioTracks().length : 0; });
  ok(flow>0,'Bea tar emot ljud');
  // kamera på mitt i samtalet
  await A.click('#callUI [data-k=cam]'); await sleep(2500);
  sb=await st(B); ok(sb.rcam===true, 'Bea får veta att Alvas kamera är på');
  const vid=await B.evaluate(()=>{ const v=document.querySelector('#callUI .cl-rv'); return [v.videoWidth, document.getElementById('callUI').classList.contains('rvid')]; });
  ok(vid[0]>0 && vid[1], 'Bea ser Alvas video ('+vid+')');
  await B.screenshot({path:'tests/shots/call_live.png'});
  await A.click('#callUI [data-k=sas]'); await sleep(300); await A.screenshot({path:'tests/shots/call_sas.png'}); await A.click('#callUI [data-k=sas]');
  await A.click('#callUI [data-k=min]'); await sleep(300); await A.screenshot({path:'tests/shots/call_min.png'}); await A.click('#callUI [data-k=max]');
  await B.click('#callUI [data-k=end]'); await sleep(2000);
  ok(!(await st(A)) && !(await st(B)), 'samtalet avslutat hos båda');
  const logA=await A.evaluate(id=>CHAT.__test.convs()['d:'+id].msgs.filter(m=>m.sys).map(m=>m.text),idb);
  ok(logA.some(t=>/Utgående (röst|video)samtal · 0:\d\d/.test(t)), 'samtalslogg: '+logA.slice(-1));
  // 2. videosamtal som avvisas
  await B.evaluate(id=>CHAT.openChat('d:'+id),ida); await sleep(400);
  await B.click('[data-c=call][data-v]'); await sleep(5500);
  sa=await st(A); ok(sa && sa.state==='incoming' && sa.video, 'Alva ser inkommande videosamtal');
  await A.screenshot({path:'tests/shots/call_incoming_video.png'});
  await A.click('#callUI [data-k=rej]'); await sleep(2500);
  ok(!(await st(B)), 'Bea: samtalet avvisades och stängdes');
  const logB=await B.evaluate(id=>CHAT.__test.convs()['d:'+id].msgs.filter(m=>m.sys).map(m=>m.text),ida);
  ok(logB.some(t=>/avvisade/.test(t)), 'logg hos Bea: '+logB.slice(-1));
  // 3. ringer och lägger på innan svar -> missat samtal
  await A.evaluate(id=>CALL.start(id,false),idb); await sleep(5000);
  await A.click('#callUI [data-k=end]'); await sleep(2500);
  ok(!(await st(B)), 'Bea: inkommande samtal försvann när Alva lade på');
  const logB2=await B.evaluate(id=>CHAT.__test.convs()['d:'+id].msgs.filter(m=>m.sys).map(m=>m.text),ida);
  ok(/Missat röstsamtal/.test(logB2.slice(-1)[0]||''), 'missat samtal loggat: '+logB2.slice(-1));
  // 4. gammal uppringning ignoreras, okänd avsändare kan inte ringa
  await B.evaluate(id=>CALL.onSignal(id,{op:'offer',id:'0123456789abcdef',sdp:'v=0\r\nx',video:false,ts:Date.now()-5*60e3}),ida); await sleep(300);
  ok(!(await st(B)), 'gammal uppringning ignoreras');
  await B.evaluate(()=>CALL.onSignal('ffffffffffffffff',{op:'offer',id:'0123456789abcdef',sdp:'v=0\r\nx',video:false,ts:Date.now()}));
  ok(!(await st(B)), 'okänd avsändare kan inte ringa');
  // 5. båda ringer samtidigt
  await Promise.all([A.evaluate(id=>CALL.start(id,false),idb), B.evaluate(id=>CALL.start(id,false),ida)]); await sleep(9000);
  sa=await st(A); sb=await st(B); ok(sa && sb && sa.id===sb.id && sa.state==='live' && sb.state==='live', 'samtidig uppringning blir ett samtal ('+(sa&&sa.state)+'/'+(sb&&sb.state)+')');
  if(sa) await A.click('#callUI [data-k=end]'); await sleep(1500);
  console.log('errs',errs); console.log(fails?fails+' FEL':'alla samtalstester ok'); await b.close(); process.exit(fails?1:0);
})();
