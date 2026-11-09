/* ================= Samtal (röst och video), end-to-end-krypterade =================
   Som i Signal:
   - Uppringningen (SDP med DTLS-fingeravtryck) skickas krypterad genom chattens dubbla ratchet,
     så ingen server kan läsa den eller byta ut nycklarna och sitta emellan.
   - Ljud och bild går direkt mellan telefonerna med DTLS-SRTP. Om de inte når varandra direkt
     går trafiken via en reservserver (TURN), som bara ser krypterade paket.
   - Bara kontakter kan ringa. Fyra emojis visar att båda har samma nycklar. */
const CALL=(function(){
  const API=()=> (typeof CHAT!=='undefined' && CHAT.call) || null;
  const RING_MS=45000, FRESH=60000, CONNECT_MS=25000;
  const OPS=['offer','ringing','answer','reject','busy','cancel','end'];
  let cur=null, el=null;

  const hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>x.toString(16).padStart(2,'0')).join('');
  const isId=x=>typeof x==='string' && /^[0-9a-f]{16}$/.test(x);
  const okSdp=s=>typeof s==='string' && s.length<40000 && /^v=0\r?\n/.test(s);
  const mmss=ms=>{ const t=Math.max(0,Math.round(ms/1000)); const h=Math.floor(t/3600), m=Math.floor(t/60)%60, s=t%60; return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0'); };
  const kind=c=>c.video?'videosamtal':'röstsamtal';
  const say=(t,ms)=>{ try{ toast(t,ms||3500); }catch(e){} };

  /* ---------- ljud: ringsignal och signal hos den som ringer ---------- */
  let ringT=null;
  function ring(type){
    stopRing(); try{ unlockAudio(); }catch(e){}
    const once = type==='in'
      ? ()=>{ tone(880,.18,'sine',.12); tone(660,.18,'sine',.12,.22); tone(880,.18,'sine',.12,.9); tone(660,.18,'sine',.12,1.12); buzz([300,200,300]); }
      : ()=>{ tone(425,1,'sine',.06); };                     // svensk ringsignal: 425 Hz, 1 s ton, 4 s paus
    once(); ringT=setInterval(once, type==='in'?3000:5000);
  }
  function stopRing(){ clearInterval(ringT); ringT=null; }
  let wake=null;
  async function keepOn(){ try{ if(navigator.wakeLock && !wake) wake=await navigator.wakeLock.request('screen'); }catch(e){} }
  function letOff(){ try{ wake && wake.release(); }catch(e){} wake=null; }

  /* ---------- kamera och mikrofon ---------- */
  const AUD={echoCancellation:true, noiseSuppression:true, autoGainControl:true};
  const VID=f=>({facingMode:f||'user', width:{ideal:640}, height:{ideal:480}, frameRate:{ideal:24}});
  async function media(video){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nomedia');
    try{ return await navigator.mediaDevices.getUserMedia({audio:AUD, video: video?VID('user'):false}); }
    catch(e){
      if(video){ try{ const s=await navigator.mediaDevices.getUserMedia({audio:AUD}); say('Kameran gick inte att starta – samtalet blir bara ljud 🎤'); return s; }catch(e2){} }
      throw e;
    }
  }
  const mediaErr=e=> e && (e.name==='NotAllowedError' || e.name==='SecurityError')
    ? 'Appen fick inte använda mikrofonen 🎤 Tillåt mikrofon (och kamera) i inställningarna och försök igen.'
    : 'Mikrofonen gick inte att starta 🎤';

  /* ---------- uppkopplingen ---------- */
  function gathered(pc,ms){ return new Promise(r=>{
    if(pc.iceGatheringState==='complete') return r();
    const t=setTimeout(r,ms||4000);
    pc.addEventListener('icegatheringstatechange',()=>{ if(pc.iceGatheringState==='complete'){ clearTimeout(t); r(); } });
  }); }
  function mkPC(c){
    const pc=new RTCPeerConnection(API().ice());
    c.pc=pc; c.remote=new MediaStream();
    pc.ontrack=e=>{ if(cur!==c) return; if(!c.remote.getTracks().includes(e.track)) c.remote.addTrack(e.track); bind(); e.track.onunmute=()=>ui(); };
    const chk=()=>{
      if(cur!==c) return;
      const s=pc.connectionState || ({connected:'connected',completed:'connected',failed:'failed',disconnected:'disconnected',closed:'closed'})[pc.iceConnectionState] || 'new';
      if(s==='connected'){
        clearTimeout(c.discT); clearTimeout(c.connT);
        if(!c.t0){ c.t0=Date.now(); sas(c); keepOn(); c.tick=setInterval(()=>{ if(cur===c) top(); },1000);
          const A=API(); if(A && A.isBot && A.isBot(c.peer)){ c.bot=true; setTimeout(()=>{ if(cur===c){ c.quote=A.quote(); ui(); } },800); botDiag(c); } }
        c.state='live'; ui();
      } else if(s==='disconnected'){
        if(c.state==='live'){ c.state='reconnect'; ui(); }
        clearTimeout(c.discT); c.discT=setTimeout(()=>{ if(cur===c && c.state==='reconnect') finish('lost'); },12000);
      } else if(s==='failed'){ finish(c.t0?'lost':'failed'); }
    };
    pc.onconnectionstatechange=chk; pc.oniceconnectionstatechange=chk;
    // egen kontrollkanal i samma krypterade förbindelse: kamera av/på, mikrofon av/på, lägg på
    const dc=c.dc=pc.createDataChannel('ctl',{negotiated:true, id:0});
    dc.onopen=()=>tell(c);
    dc.onmessage=e=>{ if(cur!==c) return; let m; try{ m=JSON.parse(e.data); }catch(_){ return; } if(!m || typeof m!=='object') return;
      if(typeof m.cam==='boolean') c.rcam=m.cam;
      if(typeof m.mic==='boolean') c.rmic=m.mic;
      if(m.end) return finish('ended',true);
      ui(); };
    return pc;
  }
  function tell(c){ try{ if(c.dc && c.dc.readyState==='open') c.dc.send(JSON.stringify({cam:!!c.cam && !!c.local && c.local.getVideoTracks().some(t=>t.readyState==='live'), mic:!!c.mic})); }catch(e){} }

  /* ---------- ringa upp ---------- */
  async function start(peer, video){
    const A=API();
    if(!A || !A.owner()){ say('Chatten är öppen i ett annat fönster – ring därifrån'); return; }
    if(cur){ say('Du är redan i ett samtal 📞'); open(); return; }
    if(!A.ok(peer)){ say('Du kan bara ringa dina kontakter'); return; }
    if(A.isBot && A.isBot(peer)) A.unlock();   // låser upp talsyntesen medan knapptrycket fortfarande gäller (iOS)
    if(typeof RTCPeerConnection==='undefined'){ say('Den här webbläsaren kan inte ringa 😕'); return; }
    const c=cur={id:hex(), peer, dir:'out', video:!!video, cam:!!video, mic:true, facing:'user', state:'media', rcam:false, rmic:true};
    try{ unlockAudio(); }catch(e){}
    ui();
    try{ c.local=await media(video); }catch(e){ if(cur===c){ cur=null; close(); } say(mediaErr(e),5000); return; }
    if(cur!==c){ c.local.getTracks().forEach(t=>t.stop()); return; }
    c.video = c.cam = c.local.getVideoTracks().length>0; bind();
    try{
      const pc=mkPC(c);
      const at=c.local.getAudioTracks()[0], vt=c.local.getVideoTracks()[0];
      c.ta=pc.addTransceiver(at||'audio',{direction:'sendrecv', streams:[c.local]});
      c.tv=pc.addTransceiver(vt||'video',{direction:'sendrecv', streams:[c.local]});   // alltid med, så kameran kan slås på mitt i samtalet
      await pc.setLocalDescription(await pc.createOffer());
      c.state='prep'; ui();
      await gathered(pc);
      if(cur!==c) return;
      A.send(peer,{op:'offer', id:c.id, sdp:pc.localDescription.sdp, video:c.video, ts:Date.now()});
    }catch(e){ console.warn('samtal: kunde inte starta', e); if(cur===c) finish('failed'); return; }
    if(A.online(peer)) c.state='calling'; else { c.state='reach'; A.connect(peer); }
    ring('out'); ui();
    // autosvar: kontaktens telefon svarar "det ringer" direkt om den är nåbar – annars säger vi det
    c.reachT=setTimeout(()=>{ if(cur===c && !c.answered && (c.state==='reach'||c.state==='calling')){ c.state='unreach'; ui(); } },10000);
    c.ringT=setTimeout(()=>{ if(cur===c && !c.answered){ A.send(c.peer,{op:'cancel', id:c.id}); finish('noanswer'); } }, RING_MS);
  }

  /* ---------- signaler från motparten (redan dekrypterade och avsändarverifierade) ---------- */
  async function onSignal(from, p){
    const A=API(); if(!A || !A.owner() || !p || !OPS.includes(p.op) || !isId(p.id)) return;
    if(p.op==='offer'){
      if(!okSdp(p.sdp) || !Number.isFinite(p.ts) || Math.abs(Date.now()-p.ts)>FRESH) return;   // gammal uppringning som legat i kö: ignorera
      if(!A.ok(from)) return;                                                             // bara kontakter kan ringa
      if(cur){
        if(cur.id===p.id) return;
        if(cur.peer===from && cur.dir==='out' && !cur.answered){                           // båda ringde samtidigt: lägsta ID:t vinner
          if(A.myId() < from) return;                                                     // vår uppringning gäller – de svarar på den
          const v=cur.video; drop(cur); return incoming(from,p,v);                        // deras gäller – svara direkt
        }
        A.send(from,{op:'busy', id:p.id}); A.log(from,`📞 Missat ${p.video?'videosamtal':'röstsamtal'} (du var upptagen)`); A.unread(from); return;
      }
      return incoming(from,p,null);
    }
    const c=cur; if(!c || c.id!==p.id || c.peer!==from) return;
    if(p.op==='ringing'){ if(c.dir==='out' && !c.answered && c.state!=='ringing'){ c.state='ringing'; ui(); } return; }
    if(p.op==='answer'){
      if(c.dir!=='out' || c.answered || !okSdp(p.sdp)) return;
      c.answered=true; clearTimeout(c.ringT); stopRing(); c.state='connecting'; ui();
      try{ await c.pc.setRemoteDescription({type:'answer', sdp:p.sdp}); }catch(e){ console.warn('samtal: fel svar', e); return finish('failed'); }
      c.connT=setTimeout(()=>{ if(cur===c && !c.t0) finish('failed'); }, CONNECT_MS);
      return;
    }
    if(p.op==='reject') return finish('rejected',true);
    if(p.op==='busy') return finish('busy',true);
    if(p.op==='cancel') return finish(c.dir==='in' && !c.t0 ? 'missed' : 'ended', true);
    if(p.op==='end') return finish('ended',true);
  }

  function incoming(from, p, autoVideo){
    const A=API();
    const c=cur={id:p.id, peer:from, dir:'in', video:!!p.video, offer:p.sdp, state:'incoming', cam:false, mic:true, facing:'user', rcam:!!p.video, rmic:true};
    A.send(from,{op:'ringing', id:p.id});
    c.ringT=setTimeout(()=>{ if(cur===c && c.state==='incoming') finish('missed'); }, RING_MS+5000);
    if(autoVideo!==null){ accept(autoVideo); return; }
    ring('in'); ui();
    if(document.hidden){ try{ systemNotify(`${A.name(from)} ringer dig ${p.video?'📹':'📞'}`); startBlink && startBlink('📞 '+A.name(from)); }catch(e){} }
  }

  async function accept(video){
    const c=cur; if(!c || c.dir!=='in' || c.state!=='incoming') return;
    const A=API(); stopRing(); clearTimeout(c.ringT); c.state='connecting'; c.answered=true; ui();
    try{ c.local=await media(video); }catch(e){ say(mediaErr(e),5000); return finish('reject'); }
    if(cur!==c){ c.local.getTracks().forEach(t=>t.stop()); return; }
    c.cam=c.local.getVideoTracks().length>0; bind();
    try{
      const pc=mkPC(c);
      await pc.setRemoteDescription({type:'offer', sdp:c.offer});
      for(const t of pc.getTransceivers()){
        const k=t.receiver && t.receiver.track && t.receiver.track.kind; if(!k) continue;
        const tr = k==='audio' ? c.local.getAudioTracks()[0] : c.local.getVideoTracks()[0];
        t.direction='sendrecv'; if(tr) await t.sender.replaceTrack(tr);
        if(k==='audio') c.ta=t; else c.tv=t;
      }
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      if(cur!==c) return;
      A.send(c.peer,{op:'answer', id:c.id, sdp:pc.localDescription.sdp});
      c.connT=setTimeout(()=>{ if(cur===c && !c.t0) finish('failed'); }, CONNECT_MS);
    }catch(e){ console.warn('samtal: kunde inte svara', e); finish('failed'); }
  }

  /* ---------- under samtalet ---------- */
  function toggleMic(){ const c=cur; if(!c || !c.local) return; c.mic=!c.mic; c.local.getAudioTracks().forEach(t=>t.enabled=c.mic); tell(c); ui(); }
  async function toggleCam(){
    const c=cur; if(!c || !c.local) return;
    if(c.cam){
      c.cam=false; c.local.getVideoTracks().forEach(t=>{ t.stop(); c.local.removeTrack(t); });
      try{ c.tv && await c.tv.sender.replaceTrack(null); }catch(e){}
    } else {
      try{
        const s=await navigator.mediaDevices.getUserMedia({video:VID(c.facing)}); if(cur!==c){ s.getTracks().forEach(t=>t.stop()); return; }
        const t=s.getVideoTracks()[0]; c.local.addTrack(t); if(c.tv) await c.tv.sender.replaceTrack(t); c.cam=true; c.video=true;
      }catch(e){ say('Kameran gick inte att starta 📷'); }
    }
    bind(); tell(c); ui();
  }
  async function flip(){
    const c=cur; if(!c || !c.local || !c.cam) return;
    const f = c.facing==='user' ? 'environment' : 'user';
    try{
      const old=c.local.getVideoTracks()[0]; if(old){ old.stop(); c.local.removeTrack(old); }   // vissa telefoner klarar bara en kamera åt gången
      const s=await navigator.mediaDevices.getUserMedia({video:VID(f)}); const t=s.getVideoTracks()[0];
      c.local.addTrack(t); if(c.tv) await c.tv.sender.replaceTrack(t); c.facing=f; bind(); ui();
    }catch(e){ say('Kunde inte byta kamera 📷'); }
  }
  function hangup(){
    const c=cur; if(!c) return;
    if(c.dir==='in' && c.state==='incoming') return finish('reject');
    finish(c.t0 ? 'ended' : (c.dir==='out' ? 'cancel' : 'ended'));
  }
  function drop(c){                                           // tyst nedläggning (samtidig uppringning)
    clearTimeout(c.ringT); clearTimeout(c.connT); clearTimeout(c.reachT); clearTimeout(c.discT); clearInterval(c.tick); stopRing();
    try{ c.pc && c.pc.close(); }catch(e){} try{ c.local && c.local.getTracks().forEach(t=>t.stop()); }catch(e){}
    if(cur===c) cur=null;
  }

  function finish(reason, remote){
    const c=cur; if(!c) return; const A=API();
    if(A && A.hush && A.isBot && A.isBot(c.peer)) A.hush();
    if(!remote && A){
      if(reason==='reject' && c.dir==='in') A.send(c.peer,{op:'reject', id:c.id});
      else if(reason==='cancel') A.send(c.peer,{op:'cancel', id:c.id});
      else if(reason==='ended' || reason==='lost' || reason==='failed'){ try{ c.dc && c.dc.readyState==='open' && c.dc.send(JSON.stringify({end:1})); }catch(e){} A.send(c.peer,{op:'end', id:c.id}); }
    }
    const dur = c.t0 ? Date.now()-c.t0 : 0;
    if(c.t0 && c.dir==='out' && typeof srvStat==='function') srvStat('call',{video:!!c.video, sec:Math.round(dur/1000)});
    drop(c); letOff(); close();
    if(!A) return;
    const k=kind(c), n=A.name(c.peer);
    let log, msg=null;
    if(c.t0) log = `${c.dir==='out'?'📞 Utgående':'📞 Inkommande'} ${k} · ${mmss(dur)}`;
    else if(c.dir==='out') log = ({noanswer:`📞 ${n} svarade inte`, rejected:`📞 ${n} avvisade samtalet`, busy:`📞 ${n} är upptagen i ett annat samtal`, failed:'📞 Samtalet kom inte fram', cancel:`📞 Inställt ${k}`})[reason] || `📞 Inställt ${k}`;
    else log = reason==='reject' ? `📞 Du avvisade ett ${k}` : reason==='failed' ? '📞 Samtalet kom inte fram' : `📞 Missat ${k}`;
    A.log(c.peer, log);
    if(reason==='failed') msg='Samtalet kom inte fram 📶 Telefonerna når inte varandra – vanligt på mobilnät eller med VPN. Prova att båda kör på wifi.';
    else if(reason==='lost') msg='Samtalet bröts – kontakten försvann 📶';
    else if(reason==='noanswer' && c.state==='unreach') msg=`${n} är inte nåbar just nu – telefonen är offline eller appen stängd`;
    else if(reason==='busy') msg=`${n} är upptagen i ett annat samtal`;
    else if(reason==='rejected') msg=`${n} kan inte svara just nu`;
    else if(reason==='noanswer') msg=`${n} svarade inte`;
    else if(reason==='ended' && c.t0) msg=`Samtalet avslutades · ${mmss(dur)}`;
    if(msg) say(msg, reason==='failed'?7000:3500);
    if(c.dir==='in' && !c.t0 && reason==='missed'){
      A.unread(c.peer);
      try{ notice({icon:'📞', title:`Missat samtal från ${n}`, text:'Ring tillbaka?', actions:[{label:'Ring upp', run:()=>start(c.peer,c.video)},{label:'Öppna chatten', run:()=>A.openChat(c.peer)}], ms:15000}); }catch(e){}
    }
    try{ tone(480,.12,'sine',.08); tone(360,.2,'sine',.08,.14); }catch(e){}
  }

  /* ---------- säkerhetskod: fyra emojis från båda sidornas DTLS-fingeravtryck ---------- */
  const EMO='🐶🐱🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦆🦉🐴🦄🐝🐞🦋🐢🐍🐙🦀🐠🐬🐳🦈🌵🌲🌻🌹🍄🌙⭐🔥🌈⛄🍎🍋🍉🍇🍓🍒🥕🌽🍕🍩🎈🎁🎸🎺🚲🚀⛵🏠⚽🏀🎯🔑🔔💎'.match(/\p{Extended_Pictographic}/gu) || [];
  async function sas(c){
    try{
      const fp=s=>((s||'').match(/a=fingerprint:\S+\s+([0-9A-Fa-f:]+)/)||[])[1]||'';
      const a=fp(c.pc.localDescription && c.pc.localDescription.sdp).toUpperCase(), b=fp(c.pc.remoteDescription && c.pc.remoteDescription.sdp).toUpperCase();
      if(!a || !b) return;
      const h=new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('FL-call-v1|'+[a,b].sort().join('|'))));
      c.sas=[0,1,2,3].map(i=>EMO[h[i]%EMO.length]).join(' '); ui();
    }catch(e){}
  }

  /* ---------- skärmen ---------- */
  function close(){ if(el){ el.remove(); el=null; } }
  function open(){ if(!el) return; el.classList.remove('min'); el.style.left=el.style.top=''; }
  // minimerat: en liten knapp som går att dra dit den inte är i vägen (sparas till nästa samtal)
  let dragged=false;
  function minimize(){
    if(!el) return; el.classList.add('min'); top();
    let p=null; try{ p=JSON.parse(lsGet('call_pill')||'null'); }catch(e){}
    place(p ? p.x*innerWidth : 8, p ? p.y*innerHeight : innerHeight*.42);
  }
  function place(x,y){ if(!el) return; const w=el.offsetWidth||150, h=el.offsetHeight||48;
    el.style.left=Math.max(4,Math.min(innerWidth-w-4,x))+'px'; el.style.top=Math.max(4,Math.min(innerHeight-h-4,y))+'px'; }
  function dragSetup(){
    let sx=0, sy=0, ox=0, oy=0, on=false;
    el.addEventListener('pointerdown',e=>{ if(!el.classList.contains('min')) return; on=true; dragged=false; sx=e.clientX; sy=e.clientY; ox=el.offsetLeft; oy=el.offsetTop; });
    window.addEventListener('pointermove',e=>{ if(!on || !el) return; const dx=e.clientX-sx, dy=e.clientY-sy; if(!dragged && Math.hypot(dx,dy)<8) return; dragged=true; place(ox+dx, oy+dy); e.preventDefault(); },{passive:false});
    window.addEventListener('pointerup',()=>{ if(!on || !el) return; on=false; if(dragged){ lsSet('call_pill',JSON.stringify({x:el.offsetLeft/innerWidth, y:el.offsetTop/innerHeight})); setTimeout(()=>{ dragged=false; },50); } });
  }
  function build(){
    if(el) return el;
    el=document.createElement('div'); el.id='callUI'; el.className='cl';
    el.innerHTML=`<video class="cl-rv" playsinline autoplay></video>
      <div class="cl-who"><div class="cl-av"></div><b class="cl-nm"></b><span class="cl-st"></span></div>
      <video class="cl-lv" playsinline autoplay muted></video>
      <div class="cl-top"><button class="cl-min" data-k="min" aria-label="Minimera">⌄</button><span class="cl-lock" data-k="sas">🔒 End-to-end-krypterat</span></div>
      <div class="cl-sas"></div>
      <div class="cl-cap"></div>
      <button class="cl-tap" data-k="tap">🔊 Tryck här för att höra ljudet</button>
      <div class="cl-bar"></div>
      <div class="cl-pill"><button class="pm" data-k="mic" aria-label="Mikrofon"></button><button class="pt" data-k="max"></button></div>`;
    el.addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(!b) return; e.stopPropagation();
      if(dragged){ dragged=false; return; }
      ({min:minimize, max:open, sas:()=>el.classList.toggle('showsas'), mic:toggleMic, cam:toggleCam, tap:tapSound, flip, end:hangup, rej:()=>finish('reject'), ans:()=>accept(false), ansv:()=>accept(true)})[b.dataset.k]?.(); });
    document.body.appendChild(el); dragSetup();
    return el;
  }
  // webbläsaren stoppade ljudet (inget knapptryck än) – ett tryck startar det
  function tapSound(){
    const c=cur; if(!c || !el) return; c.needTap=false;
    try{ const p=el.querySelector('.cl-rv').play(); p && p.catch(()=>{}); }catch(e){}
    try{ window.__ekoAC && window.__ekoAC.resume(); }catch(e){}
    if(c.bot){ const A=API(); try{ A.unlock(); }catch(e){} c.quote=A.quote(); }
    ui();
  }
  // ekotest: visa om din mikrofon skickas och om ekot kommer tillbaka – så syns var det tar stopp
  function botDiag(c){
    let last={out:0,inn:0};
    const tick=async()=>{
      if(cur!==c || !c.pc) return;
      let out=0, inn=0, lvl=0;
      try{ (await c.pc.getStats()).forEach(r=>{ if(r.kind==='audio' || r.mediaType==='audio'){ if(r.type==='outbound-rtp') out+=r.bytesSent||0; if(r.type==='inbound-rtp'){ inn+=r.bytesReceived||0; if(typeof r.audioLevel==='number') lvl=Math.max(lvl,r.audioLevel); } } }); }catch(e){}
      const mic=c.local && c.local.getAudioTracks().some(t=>t.readyState==='live' && t.enabled);
      c.diag = `🎙️ Din mikrofon: ${!mic?'❌ av':out>last.out?'✅ skickar':'⏳ väntar'} · 🔊 Ekot: ${inn>last.inn?'✅ kommer tillbaka'+(lvl>.01?' 🔉':''):'❌ inget ljud tillbaka än'}`;
      last={out,inn}; capPaint(); setTimeout(tick,1500);
    };
    setTimeout(tick,1500);
  }
  function capPaint(){
    const c=cur; if(!c || !el) return;
    const cap=el.querySelector('.cl-cap');
    cap.innerHTML = c.bot && c.state==='live' ? (c.quote?`<div class="q">“${esc(c.quote)}”<small>– Donald Trump</small></div>`:'')+(c.diag?`<div class="d">${esc(c.diag)}</div>`:'') : '';
    el.classList.toggle('needtap', !!c.needTap);
  }
  function bind(){
    const c=cur; if(!c || !el) return;
    const rv=el.querySelector('.cl-rv'), lv=el.querySelector('.cl-lv');
    if(c.remote && rv.srcObject!==c.remote){ rv.srcObject=c.remote; const p=rv.play(); p && p.catch(()=>{ if(cur===c){ c.needTap=true; ui(); } }); }
    if(c.local && lv.srcObject!==c.local){ lv.srcObject=c.local; const p=lv.play(); p && p.catch(()=>{}); }
    lv.classList.toggle('back', c.facing==='environment');
    ui();
  }
  const STATE={media:'Startar mikrofonen…', prep:'Krypterar…', reach:'Söker {n}…', unreach:'{n} svarar inte – telefonen verkar vara offline…', calling:'Ringer…', ringing:'Det ringer hos {n}…', incoming:'ringer dig…', connecting:'Kopplar upp…', reconnect:'Återansluter…'};
  function top(){
    const c=cur; if(!c || !el) return;
    const n=API().name(c.peer);
    const st = c.state==='live' ? mmss(Date.now()-c.t0) + (c.rmic===false?' · 🔇 '+n+' har stängt av mikrofonen':'') : (c.state==='incoming' ? (c.video?'📹 Videosamtal – ':'📞 Röstsamtal – ')+STATE.incoming : (STATE[c.state]||'')).replace('{n}',n);
    el.querySelector('.cl-st').textContent=st;
    el.querySelector('.cl-pill .pt').textContent='📞 '+(c.state==='live'?mmss(Date.now()-c.t0):n);
    el.querySelector('.cl-pill .pm').textContent=c.mic?'🎤':'🔇'; el.querySelector('.cl-pill .pm').classList.toggle('off',!c.mic);
    // när ett spel startar under samtalet: krymp samtalet så att spelplanen syns
    const v=typeof view!=='undefined'?view:null; if(v!==c.lastView){ const was=c.lastView; c.lastView=v; if(v==='game' && was!==undefined && !el.classList.contains('min') && c.state==='live') minimize(); }
  }
  function ui(){
    const c=cur; if(!c){ close(); return; }
    build(); const A=API(); const n=A.name(c.peer);
    el.querySelector('.cl-av').textContent=A.emoji(c.peer);
    el.querySelector('.cl-nm').textContent=n;
    const remoteVid = c.state==='live' || c.state==='reconnect' ? c.rcam && c.remote && c.remote.getVideoTracks().some(t=>t.readyState==='live' && !t.muted) : false;
    el.classList.toggle('rvid', !!remoteVid);
    el.classList.toggle('lvid', !!(c.local && c.cam && c.local.getVideoTracks().length));
    el.classList.toggle('inc', c.state==='incoming');
    el.querySelector('.cl-sas').innerHTML = c.sas ? `<b>${c.sas}</b><small>Säg emojierna högt för varandra. Ser ni samma fyra är samtalet krypterat hela vägen och ingen sitter emellan.</small>` : '<small>Säkerhetskoden visas när samtalet är kopplat.</small>';
    const B=(k,ic,lb,cls)=>`<button data-k="${k}" class="${cls||''}" aria-label="${lb}"><span>${ic}</span><small>${lb}</small></button>`;
    el.querySelector('.cl-bar').innerHTML = c.state==='incoming'
      ? B('rej','📞','Avvisa','red')+(c.video?B('ansv','📹','Video','green'):'')+B('ans','📞','Svara','green')
      : B('mic',c.mic?'🎤':'🔇',c.mic?'Ljud på':'Ljud av',c.mic?'':'off')+B('cam',c.cam?'📹':'📷',c.cam?'Kamera på':'Kamera av',c.cam?'':'off')+(c.cam?B('flip','🔄','Vänd'):'')+B('end','📞','Lägg på','red');
    top(); capPaint();
  }

  /* ---------- stil ---------- */
  const css=document.createElement('style'); css.textContent=`
.cl{position:fixed;top:0;right:0;bottom:0;left:0;z-index:9000;background:radial-gradient(120% 80% at 50% 20%,#1e3a5f,#0b1220 70%);color:#fff;font-family:'Fredoka',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;overflow:hidden;-webkit-user-select:none;user-select:none}
.cl-cap{position:absolute;left:12px;right:12px;bottom:130px;text-align:center;pointer-events:none;text-shadow:0 1px 4px #000}
.cl-cap .q{font-size:17px;line-height:1.35;margin-bottom:10px}.cl-cap .q small{display:block;opacity:.75;font-size:13px;margin-top:4px}
.cl-cap .d{display:inline-block;font-size:12.5px;background:rgba(0,0,0,.45);border-radius:12px;padding:6px 10px}
.cl-tap{display:none;position:absolute;left:50%;top:42%;transform:translateX(-50%);z-index:3;font:600 17px 'Fredoka',system-ui,sans-serif;color:#0b1220;background:#facc15;border:0;border-radius:999px;padding:14px 22px;box-shadow:0 6px 20px rgba(0,0,0,.4)}
.cl.needtap .cl-tap{display:block}.cl.min .cl-cap,.cl.min .cl-tap{display:none}
.cl-rv{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;opacity:0;background:#000;pointer-events:none}
.cl.rvid .cl-rv{opacity:1}
.cl-who{position:relative;margin-top:max(90px,calc(env(safe-area-inset-top) + 70px));display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:0 20px}
.cl.rvid .cl-who{margin-top:max(56px,calc(env(safe-area-inset-top) + 44px));text-shadow:0 1px 6px rgba(0,0,0,.8)}
.cl-av{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;font-size:66px;background:rgba(255,255,255,.12);box-shadow:0 0 0 10px rgba(255,255,255,.05)}
.cl.inc .cl-av{animation:clp 1.6s ease-in-out infinite}
@keyframes clp{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.45)}50%{box-shadow:0 0 0 22px rgba(74,222,128,0)}}
.cl.rvid .cl-av{display:none}
.cl-nm{font-size:28px;font-weight:600}
.cl-st{font-size:16px;opacity:.85}
.cl-lv{position:absolute;right:14px;top:max(70px,calc(env(safe-area-inset-top) + 56px));width:min(30vw,130px);aspect-ratio:3/4;object-fit:cover;border-radius:14px;background:#111;box-shadow:0 6px 20px rgba(0,0,0,.5);display:none;transform:scaleX(-1)}
.cl-lv.back{transform:none}
.cl.lvid .cl-lv{display:block}
.cl-top{position:absolute;left:0;right:0;top:0;padding:max(10px,env(safe-area-inset-top)) 12px 0;display:flex;align-items:center;gap:8px}
.cl-min{width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.3);color:#fff;font-size:22px;line-height:1}
.cl-lock{font-size:13px;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.3);cursor:pointer}
.cl-sas{display:none;position:absolute;left:16px;right:16px;top:max(60px,calc(env(safe-area-inset-top) + 50px));z-index:2;background:rgba(15,23,42,.92);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-radius:16px;padding:14px;text-align:center}
.cl.showsas .cl-sas{display:block}
.cl-sas b{display:block;font-size:34px;letter-spacing:6px;margin-bottom:6px}
.cl-sas small{font-size:14px;opacity:.85;line-height:1.35;display:block}
.cl-bar{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:clamp(12px,5vw,28px);padding:18px 12px max(26px,calc(env(safe-area-inset-bottom) + 16px));background:linear-gradient(transparent,rgba(0,0,0,.55))}
.cl-bar button{display:flex;flex-direction:column;align-items:center;gap:6px;color:#fff;min-width:64px}
.cl-bar button span{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;font-size:27px;background:rgba(255,255,255,.18)}
.cl-bar button.off span{background:#fff;color:#111}
.cl-bar button.red span{background:#ef4444;transform:rotate(135deg);font-size:30px}
.cl-bar button.green span{background:#22c55e}
.cl.inc .cl-bar button.green span{animation:clb 1s ease-in-out infinite alternate}
@keyframes clb{to{transform:scale(1.08)}}
.cl-bar small{font-size:12.5px;opacity:.9}
.cl-pill{display:none}
.cl.min{right:auto;bottom:auto;background:none;overflow:visible;touch-action:none}
.cl.min>*:not(.cl-pill){position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden}
.cl.min .cl-pill{display:flex;align-items:center;border-radius:999px;background:#16a34a;box-shadow:0 6px 18px rgba(0,0,0,.45);white-space:nowrap;cursor:grab}
.cl-pill button{color:#fff;font-weight:600;font-size:15px;padding:10px 12px 10px 6px}
.cl-pill .pm{width:38px;height:38px;margin:4px 0 4px 4px;padding:0;border-radius:50%;background:rgba(0,0,0,.22);font-size:18px}
.cl-pill .pm.off{background:#fff}
`; document.head.appendChild(css);

  window.addEventListener('pagehide',()=>{ if(cur) finish(cur.dir==='in'&&cur.state==='incoming'?'reject':(cur.t0?'ended':'cancel')); });

  return {start, onSignal, active:()=>!!cur, __state: (typeof DEV!=='undefined' && DEV) ? ()=>cur && {id:cur.id, dir:cur.dir, state:cur.state, video:cur.video, cam:cur.cam, mic:cur.mic, rcam:cur.rcam, sas:cur.sas||null, t0:cur.t0||0} : undefined};
})();
