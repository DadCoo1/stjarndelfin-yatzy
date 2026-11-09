// Notiser: B registrerar push hos servern (med falsk push-tjänst), stänger appen, A skriver/knuffar → servern skickar push.
// Kör med NODE_EXTRA_CA_CERTS för servern och en lokal https-mock på 9443 som loggar till /tmp/pushmock/got.log.
const {chromium}=require('playwright'); const fs=require('fs'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const LOG='/tmp/pushmock/got.log', got=()=>{ try{ return fs.readFileSync(LOG,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); }catch(e){ return []; } };
(async()=>{ const b=await chromium.launch(); const errs=[]; let fails=0; const ok=(c,m)=>{ console.log((c?'✓ ':'✗ ')+m); if(!c) fails++; };
  try{ fs.unlinkSync(LOG); }catch(e){}
  const FAKE=`try{ Object.defineProperty(Notification,'permission',{get:()=>'granted'}); }catch(e){} (()=>{ if(!window.crypto || !crypto.subtle) return; const keys=(async()=>{ const kp=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']); const raw=new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey)); const u=a=>btoa(String.fromCharCode(...a)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''); return {p256dh:u(raw), auth:u(crypto.getRandomValues(new Uint8Array(16)))}; })();
    let sub=null; const mk=async(o)=>({endpoint:'https://127.0.0.1:9443/sub-'+Math.random().toString(36).slice(2,8), options:o, toJSON(){ return {endpoint:this.endpoint, keys:this.k}; }, unsubscribe:async()=>{ sub=null; return true; }, k:await keys});
    if(window.PushManager) PushManager.prototype.subscribe=async function(o){ sub=await mk(o); return sub; }, PushManager.prototype.getSubscription=async function(){ return sub; }; })();`;
  async function user(tok,u){
    const c=await b.newContext({viewport:{width:390,height:844}}); await c.grantPermissions(['notifications'],{origin:'http://127.0.0.1:8811'});
    await c.addInitScript(`window.__NET_SERVER='127.0.0.1:9000'; try{ if(!localStorage.getItem('dev:srv_tok')){ localStorage.setItem('dev:srv_tok','${tok}'); localStorage.setItem('dev:srv_user','${u}'); } }catch(e){} `+FAKE);
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(u+': '+e.message)); await p.goto('http://127.0.0.1:8811/dev/'); await sleep(4000); return {c,p};
  }
  const A=await user(process.env.TA,process.env.UA), B=await user(process.env.TB,process.env.UB);
  const aid=await A.p.evaluate(()=>CHAT.call.myId()), bid=await B.p.evaluate(()=>CHAT.call.myId());
  ok(aid && bid, 'båda fick chattnycklar automatiskt');
  await B.p.evaluate(()=>{ showNotifySettings(); }); await sleep(300);
  const modal=await B.p.evaluate(()=>document.querySelector('#modal').innerText); ok(/Nya meddelanden/.test(modal) && /din tur/i.test(modal) && /Samtal/.test(modal), 'notisinställningar visas');
  await B.p.evaluate(()=>pushSync(true)); await sleep(1500);
  ok(await B.p.evaluate(()=>pushState)==='on', 'B registrerade notiser hos servern ('+await B.p.evaluate(()=>pushState)+')');
  // A och B blir kontakter via användarlistan
  for(const x of [A,B]) await x.p.evaluate(()=>CHAT.reconnect()); await sleep(2500);
  await A.p.evaluate(id=>{ CHAT.open(); }, bid); await sleep(300); await A.p.click('[data-c=tab][data-t=contacts]'); await sleep(1500);
  await A.p.evaluate(id=>document.querySelector(`[data-c=diradd][data-id="${id}"]`).click(), bid); await sleep(500);
  await B.c.close(); await sleep(1500);                          // B stänger appen
  await A.p.evaluate(id=>CHAT.openChat('d:'+id), bid); await sleep(600); await A.p.fill('#waText','är du där?'); await A.p.click('[data-c=send]'); const t0=Date.now();
  let g=[]; while(Date.now()-t0<30000 && !(g=got()).length) await sleep(250); console.log('  pushen kom efter', ((Date.now()-t0)/1000).toFixed(1), 's'); ok(g.length===1 && g[0].enc==='aes128gcm' && g[0].topic==='flm' && g[0].urg==='high', 'push för meddelande skickades (krypterad): '+JSON.stringify(g));
  await A.p.evaluate(id=>CHAT.nudge(id,'t','Yatzy'), bid); await sleep(8000);
  g=got(); ok(g.some(x=>x.topic==='flt'), 'push för "din tur" skickades');
  ok(g.every(x=>x.len>0 && x.len<200), 'pushen är liten – bara kategorin, inget innehåll ('+g.map(x=>x.len)+')');
  console.log('errs',errs); console.log(fails?fails+' FEL':'alla notistester ok'); await b.close(); process.exit(fails?1:0); })();
