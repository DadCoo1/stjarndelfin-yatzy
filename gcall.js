/* ================= Gruppsamtal i ett onlinespel (2–4 spelare) =================
   - 📞 i spelet ringer upp alla som är med i spelet. Den som ringer är med direkt.
   - De andra får en inbjudan med 15 sekunders nedräkning: Gå med eller Nej tack. Efter 15 s blir den en
     liten "Gå med"-knapp, så man kan ansluta senare så länge samtalet pågår under spelet.
   - Uppringningen går genom spelets egen förbindelse (krypterad mellan telefonerna, via värden).
     Ljudet går direkt mellan deltagarna (DTLS-SRTP), eller via vår egen TURN-server om de inte når varandra.
     Inget går via tredje part. Bara ljud – lagom för spel och snålt med batteri och data.
   - Den som redan är med ringer upp den som ansluter (inga krockar). Lämnar man spelet lämnar man samtalet. */
'use strict';
const GCALL=(function(){
  const INVITE_MS=15000, MAX=4;
  const hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>x.toString(16).padStart(2,'0')).join('');
  const okId=x=>typeof x==='string'&&/^[0-9a-f]{16}$/.test(x), okSeat=x=>Number.isInteger(x)&&x>=0&&x<8;
  const okSdp=s=>typeof s==='string'&&s.length<40000&&/^v=0\r?\n/.test(s);
  let st={id:null, members:new Set(), from:-1}, me={in:false, stream:null, muted:false}, pcs=new Map(), inv=null, joining=false;
  let ac=null, meters=new Map(), talkT=0, gid='';
  const nm=s=>{ try{ return pname(s); }catch(e){ return 'Spelare '+(s+1); } };
  const say=(t,ms)=>{ try{ toast(t,ms||3000); }catch(e){} };
  const humans=()=>{ if(!G||!Array.isArray(G.names)) return []; return G.names.map((_,i)=>i).filter(i=>{ try{ return !isAI(i); }catch(e){ return true; } }); };
  const where=()=>typeof mode!=='undefined'&&mode==='online'&&view==='game'&&G&&mySeat!=null&&humans().length>=2;

  /* ---------- meddelanden genom spelet ---------- */
  function out(m){ m.t='gc'; m.from=mySeat; m.g=gameId;
    if(role==='host'){ if(m.to!=null){ for(const c of hostConns) if(c._seat===m.to){ sendTo(c,m); break; } } else hostBroadcast(m); }
    else sendTo(conn,m); }
  // värden: släpp igenom, men med rätt avsändare och utan spam
  function route(m,c){ if(!m||c._seat==null) return; const now=Date.now(); c._gcN=(now-(c._gcT||0)>10000)?1:(c._gcN||0)+1; if(c._gcN===1) c._gcT=now; if(c._gcN>80) return;
    m={...m, from:c._seat};
    if(m.to!=null){ if(!okSeat(m.to)) return; if(m.to===mySeat) return onMsg(m); for(const o of hostConns) if(o!==c&&o._seat===m.to){ sendTo(o,m); break; } return; }
    hostBroadcast(m,c); onMsg(m); }
  // värden berättar för en (åter)ansluten spelare om ett pågående samtal
  function hello(c){ if(st.id&&c&&c._seat!=null) sendTo(c,{t:'gc',k:'info',id:st.id,members:[...st.members],from:mySeat,to:c._seat}); }
  // en spelare tappade kontakten med värden – räknas som att den lämnade samtalet
  function gone(seat){ if(role!=='host'||!st.members.has(seat)) return; const m={t:'gc',k:'leave',id:st.id,from:seat}; hostBroadcast(m); onMsg(m); }

  function onMsg(m){ if(!m||typeof m.k!=='string'||!okSeat(m.from)) return; if(m.from===mySeat&&m.k!=='info') return;
    if(m.k==='start'){ if(!okId(m.id)) return;
      if(st.id&&st.id!==m.id){ if(m.id>st.id) return; if(me.in) leave(true); }   // samtidiga uppringningar: lägst id vinner
      if(st.id!==m.id){ st={id:m.id, members:new Set([m.from]), from:m.from}; if(!me.in) invite(m.from); }
      ui(); return; }
    if(m.k==='info'){ if(!okId(m.id)||!Array.isArray(m.members)) return; st={id:m.id, members:new Set(m.members.filter(okSeat).filter(s=>s!==mySeat||me.in)), from:st.from}; if(!st.members.size) st.id=null; ui(); return; }
    if(!st.id||m.id!==st.id) return;
    if(m.k==='join'){ st.members.add(m.from); if(me.in) { blip(1); connect(m.from); } ui(); return; }
    if(m.k==='leave'){ st.members.delete(m.from); drop(m.from); if(me.in) blip(0); if(!st.members.size){ st.id=null; closeInvite(); } ui(); return; }
    if(m.k==='mute'){ const p=pcs.get(m.from); if(p){ p.muted=!!m.m; ui(); } return; }
    if(m.to!==mySeat||!me.in) return;
    if(m.k==='offer'&&okSdp(m.sdp)) answer(m.from,m.sdp);
    else if(m.k==='answer'&&okSdp(m.sdp)){ const p=pcs.get(m.from); if(p&&p.pc.signalingState==='have-local-offer') p.pc.setRemoteDescription({type:'answer',sdp:m.sdp}).catch(()=>{}); } }

  /* ---------- ljudförbindelser (en per annan deltagare) ---------- */
  const cfg=()=>{ try{ const o=peerOpts(); return o.config||{iceServers:[]}; }catch(e){ return {iceServers:[]}; } };
  function gathered(pc){ return new Promise(r=>{ if(pc.iceGatheringState==='complete') return r(); const t=setTimeout(r,3500); pc.addEventListener('icegatheringstatechange',()=>{ if(pc.iceGatheringState==='complete'){ clearTimeout(t); r(); } }); }); }
  function mkPC(seat){ drop(seat); const pc=new RTCPeerConnection(cfg()), p={pc, seat, audio:null, muted:false, live:false};
    me.stream.getTracks().forEach(t=>pc.addTrack(t,me.stream));
    pc.ontrack=e=>{ const s=e.streams[0]||new MediaStream([e.track]); if(!p.audio){ p.audio=new Audio(); p.audio.autoplay=true; p.audio.playsInline=true; p.audio.setAttribute('playsinline',''); host().appendChild(p.audio); }
      p.audio.srcObject=s; p.audio.play().catch(()=>{}); meter(seat,s); };
    pc.onconnectionstatechange=()=>{ const s=pc.connectionState; p.live=s==='connected'; if(s==='failed') { drop(seat); if(me.in&&st.members.has(seat)&&mySeat<seat) setTimeout(()=>{ if(me.in&&st.members.has(seat)&&!pcs.has(seat)) connect(seat); },1500); } ui(); };
    pcs.set(seat,p); return p; }
  async function connect(seat){ if(seat===mySeat||!me.stream) return; const p=mkPC(seat);
    try{ await p.pc.setLocalDescription(await p.pc.createOffer()); await gathered(p.pc); if(pcs.get(seat)!==p) return; out({k:'offer',id:st.id,to:seat,sdp:p.pc.localDescription.sdp}); }catch(e){ drop(seat); } }
  async function answer(seat,sdp){ const p=mkPC(seat);
    try{ await p.pc.setRemoteDescription({type:'offer',sdp}); await p.pc.setLocalDescription(await p.pc.createAnswer()); await gathered(p.pc); if(pcs.get(seat)!==p) return; out({k:'answer',id:st.id,to:seat,sdp:p.pc.localDescription.sdp}); }catch(e){ drop(seat); } }
  function drop(seat){ const p=pcs.get(seat); if(!p) return; pcs.delete(seat); try{ p.pc.close(); }catch(e){} if(p.audio){ try{ p.audio.srcObject=null; p.audio.remove(); }catch(e){} } meters.delete(seat); }
  function host(){ let h=document.getElementById('gcAudio'); if(!h){ h=document.createElement('div'); h.id='gcAudio'; h.style.display='none'; document.body.appendChild(h); } return h; }

  /* ---------- vem pratar? ---------- */
  function meter(seat,stream){ try{ ac=ac||new (window.AudioContext||window.webkitAudioContext)(); const src=ac.createMediaStreamSource(stream), an=ac.createAnalyser(); an.fftSize=512; src.connect(an); meters.set(seat,{an,buf:new Uint8Array(an.fftSize),lvl:0}); }catch(e){} }
  function talking(){ for(const [seat,m] of meters){ m.an.getByteTimeDomainData(m.buf); let s=0; for(const v of m.buf){ const d=(v-128)/128; s+=d*d; } const rms=Math.sqrt(s/m.buf.length); m.lvl=m.lvl*.6+rms*.4;
      const el=document.querySelector(`#gcBar [data-gs="${seat}"]`); if(el) el.classList.toggle('talk', m.lvl>.035 && !(seat===mySeat&&me.muted)); } }

  /* ---------- gå med, lämna, starta ---------- */
  async function getMic(){ if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) throw new Error('nomedia');
    return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}); }
  async function join(){ if(me.in||joining||!st.id) return; if(typeof CALL!=='undefined'&&CALL.active&&CALL.active()){ say('Du är redan i ett samtal 📞'); return; }
    if(st.members.size>=MAX){ say('Samtalet är fullt'); return; }
    joining=true; closeInvite(); try{ unlockAudio(); }catch(e){}
    try{ me.stream=await getMic(); }catch(e){ joining=false; say(e&&(e.name==='NotAllowedError'||e.name==='SecurityError')?'Appen fick inte använda mikrofonen 🎤 Tillåt mikrofon i inställningarna och försök igen.':'Mikrofonen gick inte att starta 🎤',4500); ui(); return; }
    joining=false; if(!st.id){ stopMic(); return; }
    me.in=true; me.muted=false; gid=gameId; st.members.add(mySeat); meter(mySeat,me.stream); clearInterval(talkT); talkT=setInterval(talking,180);
    try{ if(navigator.wakeLock) me.wake=await navigator.wakeLock.request('screen'); }catch(e){}
    out({k:'join',id:st.id}); blip(1); ui(); }
  async function start(){ if(!where()) return; if(st.id){ return join(); }
    if(typeof CALL!=='undefined'&&CALL.active&&CALL.active()){ say('Du är redan i ett samtal 📞'); return; }
    try{ unlockAudio(); }catch(e){}
    try{ me.stream=await getMic(); }catch(e){ say(e&&(e.name==='NotAllowedError'||e.name==='SecurityError')?'Appen fick inte använda mikrofonen 🎤 Tillåt mikrofon i inställningarna och försök igen.':'Mikrofonen gick inte att starta 🎤',4500); return; }
    st={id:hex(), members:new Set(), from:mySeat}; out({k:'start',id:st.id});
    me.in=true; me.muted=false; gid=gameId; st.members.add(mySeat); meter(mySeat,me.stream); clearInterval(talkT); talkT=setInterval(talking,180);
    try{ if(navigator.wakeLock) me.wake=await navigator.wakeLock.request('screen'); }catch(e){}
    out({k:'join',id:st.id}); say('Ringer upp alla i spelet 📞 De har 15 sekunder på sig att svara – och kan gå med senare.',3500); blip(1); ui(); }
  function stopMic(){ if(me.stream){ me.stream.getTracks().forEach(t=>{ try{ t.stop(); }catch(e){} }); } me.stream=null; }
  function leave(quiet){ if(!me.in) return; const id=st.id; if(id) out({k:'leave',id});
    for(const s of [...pcs.keys()]) drop(s); stopMic(); meters.clear(); clearInterval(talkT); try{ me.wake&&me.wake.release(); }catch(e){} me.wake=null;
    me.in=false; st.members.delete(mySeat); if(!st.members.size) st.id=null; if(!quiet) blip(0); ui(); }
  function mute(){ if(!me.in||!me.stream) return; me.muted=!me.muted; me.stream.getAudioTracks().forEach(t=>t.enabled=!me.muted); out({k:'mute',id:st.id,m:me.muted}); ui(); }
  // spelet tar slut eller man går därifrån: lämna samtalet och glöm det
  function reset(){ if(me.in) leave(true); closeInvite(); st={id:null,members:new Set(),from:-1}; ui(); }

  /* ---------- ljud ---------- */
  function blip(up){ try{ up?(tone(660,.09,'sine',.07),tone(990,.12,'sine',.07,.09)):(tone(660,.09,'sine',.07),tone(440,.14,'sine',.07,.09)); }catch(e){} }
  function ringIn(){ try{ [0,.45].forEach(d=>{ tone(784,.16,'sine',.1,d); tone(988,.2,'sine',.1,d+.17); }); buzz([200,120,200]); }catch(e){} }

  /* ---------- inbjudan med 15 sekunder ---------- */
  function invite(from){ closeInvite(); const t0=Date.now(); inv={from,t0};
    const el=document.createElement('div'); el.id='gcInv'; el.setAttribute('role','alertdialog');
    el.innerHTML=`<div class="gci-ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><circle class="p" cx="20" cy="20" r="17"/></svg><span>📞</span></div>
      <div class="gci-t"><b>${esc(nm(from))} startar ett gruppsamtal</b><small>Frivilligt · <span id="gcSec">15</span> s</small></div>
      <button class="gci-yes" data-gc="join">Gå med</button><button class="gci-no" data-gc="no" aria-label="Nej tack">✕</button>`;
    document.body.appendChild(el); ringIn();
    inv.timer=setInterval(()=>{ const left=Math.max(0,INVITE_MS-(Date.now()-t0)), s=document.getElementById('gcSec'); if(s) s.textContent=Math.ceil(left/1000);
      const c=el.querySelector('.p'); if(c) c.style.strokeDashoffset=String(106.8*(1-left/INVITE_MS)); if(!left) closeInvite(); },200);
    ui(); }
  function closeInvite(){ if(inv){ clearInterval(inv.timer); inv=null; } const el=document.getElementById('gcInv'); if(el) el.remove(); ui(); }

  /* ---------- knappar och samtalslist ----------
     I spel med toppfält ligger 📞 bland ikonerna och listen direkt under toppfältet. Annars flytande. */
  let shown='', busyUI=false;
  function barHTML(){ const seats=[...st.members].sort((a,b)=>a-b);
    return `<span class="gcb-i">📞</span><div class="gcb-p">${seats.map(s=>{ const p=pcs.get(s), mu=s===mySeat?me.muted:p&&p.muted, live=s===mySeat||(p&&p.live);
        return `<span class="gcb-m ${live?'':'wait'}" data-gs="${s}" title="${esc(nm(s))}">${esc(String(nm(s)).replace(/^[^\p{L}\p{N}]+/u,'').slice(0,1).toUpperCase()||'?')}${mu?'<i>🔇</i>':''}</span>`; }).join('')}</div>
      <button class="gcb-mic ${me.muted?'off':''}" data-gc="mute" aria-label="${me.muted?'Slå på mikrofonen':'Stäng av mikrofonen'}">${me.muted?'🔇':'🎤'}</button><button class="gcb-end" data-gc="leave" aria-label="Lämna samtalet">Lägg på</button>`; }
  function ui(){ if(busyUI) return; busyUI=true; try{ ui2(); } finally { busyUI=false; } }
  function ui2(){ const here=where();
    if(gid&&typeof gameId!=='undefined'&&gameId!==gid&&me.in) reset();
    if(!here&&me.in&&(typeof mode==='undefined'||mode!=='online')) reset();
    const top=here?document.querySelector('.gtop'):null;
    // 📞-knappen
    let b=document.getElementById('gcBtn');
    if(!here||inv&&!top){ if(b) b.remove(); b=null; }
    else { const n=st.id?st.members.size:0, live=!!st.id;
      if(top){ if(!b||b.parentNode!==top){ if(b) b.remove(); b=document.createElement('button'); b.id='gcBtn'; b.className='iconbtn gcic'; b.dataset.gc='btn'; const ref=top.querySelector('.sgbtn'); top.insertBefore(b,ref||null); }
        const html=`📞${live&&!me.in?`<i class="cbadge on">${n}</i>`:''}`; if(b.innerHTML!==html) b.innerHTML=html; }
      else { if(!b||b.parentNode!==document.body){ if(b) b.remove(); b=document.createElement('button'); b.id='gcBtn'; b.className='gcfloat'; b.dataset.gc='btn'; document.body.appendChild(b); }
        const html=me.in?'📞':live?`📞 <span>Gå med i samtalet${n?` (${n})`:''}</span>`:'📞'; if(b.innerHTML!==html) b.innerHTML=html; if(me.in) b.style.display='none'; else b.style.display=''; }
      b.classList.toggle('live',live&&!me.in); b.classList.toggle('in',me.in);
      b.setAttribute('aria-label',me.in?'I gruppsamtal':live?`Gå med i gruppsamtalet (${n} med)`:'Starta gruppsamtal med alla i spelet'); }
    // samtalslisten
    let bar=document.getElementById('gcBar');
    if(me.in&&here){ const want=top?'gcinline':'gcfloat';
      if(!bar||!bar.classList.contains(want)||(top&&bar.previousElementSibling!==top)){ if(bar) bar.remove(); bar=document.createElement('div'); bar.id='gcBar'; bar.className=want; if(top) top.after(bar); else document.body.appendChild(bar); shown=''; }
      const key=[...st.members].map(s=>s+':'+(s===mySeat?me.muted:(pcs.get(s)||{}).muted)+':'+(s===mySeat||(pcs.get(s)||{}).live)).join(',')+me.muted;
      if(key!==shown){ shown=key; bar.innerHTML=barHTML(); } }
    else if(bar){ bar.remove(); shown=''; } }
  // när appen ritar om spelet: sätt tillbaka knappen och listen direkt (ingen blinkning)
  try{ new MutationObserver(()=>{ if(where()&&document.querySelector('.gtop')&&(!document.querySelector('.gtop #gcBtn')||(me.in&&!document.getElementById('gcBar')))) ui(); }).observe(document.body,{childList:true,subtree:true}); }catch(e){}
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-gc]'); if(!b) return; const a=b.dataset.gc;
    if(a==='btn') return st.id?join():start();
    if(a==='join') return join();
    if(a==='no'){ closeInvite(); say('Du kan gå med senare med 📞-knappen',2500); return; }
    if(a==='leave') return leave();
    if(a==='mute') return mute(); });
  setInterval(ui,800);
  addEventListener('pagehide',()=>{ if(me.in) leave(true); });

  const css=document.createElement('style'); css.textContent=`
#gcBtn.gcic{position:relative}#gcBtn.gcic.live{background:linear-gradient(135deg,#16a34a,#0ea5e9);animation:gcpulse 1.8s ease-in-out infinite}#gcBtn.gcic.in{background:rgba(34,197,94,.35)}
#gcBtn.gcfloat{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);z-index:60;display:flex;align-items:center;gap:6px;height:44px;min-width:44px;padding:0 12px;border-radius:22px;border:1px solid rgba(255,255,255,.25);background:rgba(15,23,42,.72);color:#fff;font:600 20px 'Fredoka',system-ui,sans-serif;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 6px 18px rgba(0,0,0,.35)}
#gcBtn.gcfloat span{font-size:14px}#gcBtn.gcfloat.live{background:linear-gradient(135deg,#16a34a,#0ea5e9);animation:gcpulse 1.8s ease-in-out infinite}
@keyframes gcpulse{50%{box-shadow:0 0 0 6px rgba(34,197,94,.25),0 6px 18px rgba(0,0,0,.35)}}
#gcInv{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);transform:translateX(-50%);z-index:70;display:flex;align-items:center;gap:10px;width:min(440px,calc(100% - 20px));padding:10px 10px 10px 12px;border-radius:20px;background:rgba(15,23,42,.92);border:1px solid rgba(34,197,94,.6);box-shadow:0 12px 30px rgba(0,0,0,.45);color:#fff;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);animation:gcin .35s cubic-bezier(.2,.9,.3,1.2)}
@keyframes gcin{from{transform:translate(-50%,-30px);opacity:0}}
.gci-ring{position:relative;width:40px;height:40px;flex:none}.gci-ring svg{width:40px;height:40px;transform:rotate(-90deg)}.gci-ring circle{fill:none;stroke:rgba(255,255,255,.15);stroke-width:3.5}.gci-ring .p{stroke:#22c55e;stroke-dasharray:106.8;stroke-dashoffset:0;stroke-linecap:round;transition:stroke-dashoffset .2s linear}
.gci-ring span{position:absolute;inset:0;display:grid;place-items:center;font-size:18px;animation:gcwig 1s ease-in-out infinite}@keyframes gcwig{25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}
.gci-t{flex:1;min-width:0;line-height:1.25}.gci-t b{display:block;font-size:14px}.gci-t small{font-size:12px;opacity:.8}
.gci-yes{padding:10px 16px;border-radius:14px;border:0;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font:700 15px 'Fredoka',system-ui,sans-serif}
.gci-no{width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:15px}
#gcBar{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border-radius:24px;background:rgba(6,78,59,.88);border:1px solid rgba(52,211,153,.55);box-shadow:0 8px 22px rgba(0,0,0,.35);color:#fff;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
#gcBar.gcinline{width:max-content;max-width:100%;margin:-2px auto 10px;animation:gcin2 .3s ease-out}@keyframes gcin2{from{opacity:0;transform:translateY(-8px)}}
#gcBar.gcfloat{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);transform:translateX(-50%);z-index:65}
.gcb-i{font-size:16px}.gcb-p{display:flex;gap:4px}
.gcb-m{position:relative;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:700 14px 'Fredoka',system-ui,sans-serif;background:rgba(255,255,255,.18);transition:box-shadow .15s}
.gcb-m.wait{opacity:.5}.gcb-m.talk{box-shadow:0 0 0 2.5px #4ade80,0 0 12px rgba(74,222,128,.8)}.gcb-m i{position:absolute;right:-4px;bottom:-4px;font-size:11px;font-style:normal}
.gcb-mic{width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.16);font-size:16px}.gcb-mic.off{background:#f59e0b}
.gcb-end{padding:7px 12px;border-radius:16px;border:0;background:#ef4444;color:#fff;font:700 13px 'Fredoka',system-ui,sans-serif}`;
  document.head.appendChild(css);
  async function rx(){ const o={}; for(const [seat,p] of pcs){ let n=0; try{ (await p.pc.getStats()).forEach(r=>{ if(r.type==='inbound-rtp'&&r.kind==='audio') n+=r.bytesReceived||0; }); }catch(e){} o[seat]=n; } return o; }
  return {rx, start, join, leave, mute, reset, route, onMsg, hello, gone, state:()=>({id:st.id, members:[...st.members], in:me.in, muted:me.muted, invite:!!inv, peers:[...pcs.values()].map(p=>({seat:p.seat,live:p.live}))})};
})();
