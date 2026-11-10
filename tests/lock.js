// Bara inbjudna: utan inloggning syns bara låsskärmen; inbjudan eller inloggning låser upp; efter det fungerar appen utan nät.
// Kräver lokal server på 127.0.0.1:9000 med DATA_DIR=/tmp/srvtest/data (se server.js).
const {chromium}=require('playwright'); const {execFileSync}=require('child_process'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const BASE='http://127.0.0.1:8811/'+(process.env.MAIN?'':'dev/');
const ENV={...process.env, DATA_DIR:'/tmp/srvtest/data', APP_URL:''+BASE+''};
(async()=>{ const b=await chromium.launch(); let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; }; const errs=[];
  const c=await b.newContext({viewport:{width:1280,height:800}}); await c.addInitScript("window.__NET_SERVER='127.0.0.1:9000'");
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto(BASE); await sleep(2500);
  const st=async()=>p.evaluate(()=>({lock:!!document.querySelector('.lockcard'), games:document.querySelectorAll('[data-act^=new],[data-act=openrace],.gtile,.tcard').length, ob:!!document.getElementById('obWrap'), chatVis:[...document.body.children].filter(e=>!['app','modal','toasts','sky'].includes(e.id) && e.tagName!=='SCRIPT' && getComputedStyle(e).display!=='none' && e.offsetHeight>0).map(e=>e.id||e.className)}));
  let s=await st(); ok(s.lock && s.games===0 && !s.ob, 'utan inbjudan: bara låsskärmen, inga spel, ingen introduktion '+JSON.stringify(s));
  ok(!s.chatVis.length, 'chatt, musik och annat är dolt '+JSON.stringify(s.chatVis)); await p.screenshot({path:'/tmp/lock.png'});
  await p.evaluate(()=>{ try{ openRace(); }catch(e){} render(); }); await sleep(300); ok((await st()).lock, 'går inte att ta sig förbi genom att starta ett spel');
  // inbjudan skapar kontot och låser upp
  const u='lk'+Date.now()%100000; const link=execFileSync('node',['server/spel-user','invite',u,...(process.env.MAIN?[]:['--dev'])],{env:ENV}).toString().match(/http\S+#invite=\S+/)[0];
  await p.goto(link.replace(/^.*#/,''+BASE+'#')); await sleep(2500);
  const sec=await p.evaluate(()=>(document.querySelector('#modal code')?.textContent||'').replace(/\s/g,''));
  const code=execFileSync('python3',['-c',`import hmac,hashlib,struct,time,base64,sys\nk=base64.b32decode(sys.argv[1]+'='*(-len(sys.argv[1])%8))\nh=hmac.new(k,struct.pack('>Q',int(time.time())//30),hashlib.sha1).digest();o=h[-1]&15\nprint('%06d'%((struct.unpack('>I',h[o:o+4])[0]&0x7fffffff)%1000000))`,sec]).toString().trim();
  await p.fill('#invC',code); await sleep(2500);
  s=await st(); ok(!s.lock && s.games>0, 'efter inbjudan: appen är öppen');
  ok(s.ob, 'introduktionen visas efter att kontot skapats');
  // offline: fortfarande öppen
  await c.setOffline(true); await p.reload().catch(()=>{}); await sleep(2500); s=await st(); ok(!s.lock && s.games>0, 'fungerar utan nät efter första inloggningen'); await c.setOffline(false);
  // utloggad → låst igen
  await p.evaluate(()=>srvLogout()); await sleep(500); ok((await st()).lock, 'utloggning låser appen');
  // servern säger att kontot inte gäller → låst
  await p.evaluate(()=>{ SRV_TOK='ogiltig'; lsSet('srv_tok','ogiltig'); render(); }); await p.evaluate(()=>srvFetch('/auth/me')); await sleep(800); ok((await st()).lock, 'ogiltigt konto låses (servern svarar 401)');
  ok(!errs.length, 'inga fel '+JSON.stringify(errs));
  console.log(fails?fails+' FEL':'alla låstester ok'); await b.close(); process.exit(fails?1:0); })();
