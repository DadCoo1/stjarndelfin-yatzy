/* =====================================================================
   chat.js – Fröknarnas chatt
   End-to-end-krypterad med samma byggstenar som Signal:
     • identitetsnycklar (X25519, reserv P-256)
     • X3DH-liknande nyckelöverenskommelse utan server
     • Double Ratchet för enskilda chattar (framåtsekretess + självläkning)
     • Sender Keys för grupper
     • AES-256-GCM, HKDF-SHA256, HMAC-SHA256
   Ingen server: meddelanden går direkt mellan enheterna (PeerJS/WebRTC)
   eller lagras krypterat hos en kompis som är online tills mottagaren dyker upp.
   ===================================================================== */
'use strict';
const CHAT = (()=>{
  /* ---------- lagring ---------- */
  const NS='chat:';
  const BOTMODE = typeof BOT!=='undefined' && BOT;     // den här sidan ÄR testkompisen (osynlig ram)
  const CHATWIN = !BOTMODE && /[?&]chat=1/.test(location.search);   // chatten i eget fönster/flik
  let panelOpen=false, owner=true;
  const vis = () => (CHATWIN || panelOpen);
  const ld=(k,d)=>{ try{ const v=JSON.parse(lsGet(NS+k)); return v===null||v===undefined?d:v; }catch(e){ return d; } };
  const sv=(k,v)=>{ if(owner) lsSet(NS+k, JSON.stringify(v)); };   // bara fliken som äger chatten skriver
  const te=new TextEncoder(), td=new TextDecoder();
  const b64=u=>{ u=new Uint8Array(u); let s=''; for(let i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s); };
  const ub64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const cat=(...a)=>{ const n=a.reduce((x,y)=>x+y.length,0), o=new Uint8Array(n); let p=0; a.forEach(x=>{ o.set(x,p); p+=x.length; }); return o; };
  const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>x.toString(16).padStart(2,'0')).join('');

  /* ---------- validering av allt som kommer utifrån ---------- */
  const H16=/^[0-9a-f]{16}$/, isH=x=>typeof x==='string' && H16.test(x);
  const isB64=(x,max)=>typeof x==='string' && x.length>0 && x.length<=(max||100) && /^[A-Za-z0-9+/]+={0,2}$/.test(x);
  const isN=(x,max)=>Number.isInteger(x) && x>=0 && x<=(max||1e7);
  const cleanText=(x,max)=>String(x??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,max);
  const cleanName=(x,max)=>cleanText(x,200).replace(/[\n\r\t]/g,' ').trim().slice(0,max);
  const cleanEmoji=(x,def)=>{ x=String(x??''); return x.length && x.length<=16 && /^[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f\u20e3]+$/u.test(x) ? x : (def||'👤'); };
  const REACTS=['❤️','😂','😮','😭','🙏','👍'];

  /* ---------- kryptografi ---------- */
  const alg = c => c==='X25519' ? {name:'X25519'} : {name:'ECDH', namedCurve:'P-256'};
  const dalg = c => c==='X25519' ? {name:'X25519'} : {name:'ECDH'};
  async function pickCurve(){ try{ await crypto.subtle.generateKey({name:'X25519'},true,['deriveBits']); return 'X25519'; }catch(e){ return 'P-256'; } }
  async function genKP(c){ const kp=await crypto.subtle.generateKey(alg(c),true,['deriveBits']); return {pub:b64(await crypto.subtle.exportKey('raw',kp.publicKey)), priv:b64(await crypto.subtle.exportKey('pkcs8',kp.privateKey))}; }
  const kc=new Map();
  async function privK(c,p){ const k=c+'s'+p; if(!kc.has(k)) kc.set(k, await crypto.subtle.importKey('pkcs8',ub64(p),alg(c),false,['deriveBits'])); return kc.get(k); }
  async function pubK(c,p){ const k=c+'p'+p; if(!kc.has(k)) kc.set(k, await crypto.subtle.importKey('raw',ub64(p),alg(c),true,[])); return kc.get(k); }
  async function dh(c,kp,pub){ return new Uint8Array(await crypto.subtle.deriveBits({...dalg(c), public: await pubK(c,pub)}, await privK(c,kp.priv), 256)); }
  async function hkdf(ikm,salt,info,len){ const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']); return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info:te.encode(info)},k,len*8)); }
  async function hmac(key,data){ const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC',k,data)); }
  async function kdfRK(rk,dhOut){ const o=await hkdf(dhOut,rk,'FL-Ratchet-v1',64); return [o.slice(0,32),o.slice(32)]; }
  async function kdfCK(ck){ return [await hmac(ck,new Uint8Array([2])), await hmac(ck,new Uint8Array([1]))]; }   // [nästa kedjenyckel, meddelandenyckel]
  async function aesEnc(key,pt,ad){ const k=await crypto.subtle.importKey('raw',key,'AES-GCM',false,['encrypt']); const iv=crypto.getRandomValues(new Uint8Array(12));
    return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:ad},k,pt)); }
  async function aesDec(key,s,ad){ const [iv,ct]=s.split('.'); const k=await crypto.subtle.importKey('raw',key,'AES-GCM',false,['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(iv),additionalData:ad},k,ub64(ct))); }
  async function idFromPub(pub){ const h=new Uint8Array(await crypto.subtle.digest('SHA-256',ub64(pub))); return Array.from(h.slice(0,8),x=>x.toString(16).padStart(2,'0')).join(''); }

  /* ---------- identitet & kontakter ---------- */
  let ME=ld('me',null);
  const EMO=['🐬','🦄','🐆','🚀','🌸','🐼','🦊','🐙','⭐','🌈','🦋','🐳','🪐','🍓','🐨','🦩'];
  async function createIdentity(name,emoji){
    const curve=await pickCurve(), ik=await genKP(curve);
    ME={id:await idFromPub(ik.pub), name:(name||'Jag').slice(0,20), emoji:emoji||EMO[rint(EMO.length)], curve, ik, created:Date.now()};
    sv('me',ME); return ME;
  }
  const myCard = () => ME && ({v:1, id:ME.id, name:ME.name, emoji:ME.emoji, curve:ME.curve, ik:ME.ik.pub});
  async function okCard(c){ try{ return !!(c && typeof c==='object' && c.v===1 && isH(c.id) && isB64(c.ik,100) && ['X25519','P-256'].includes(c.curve) && (await idFromPub(c.ik))===c.id); }catch(e){ return false; } }
  // bara kända fält, städade – aldrig något extra som en avsändare hittat på
  const normCard = c => ({v:1, id:c.id, name:cleanName(c.name,20)||'Okänd', emoji:cleanEmoji(c.emoji), curve:c.curve, ik:c.ik});
  let contacts=ld('contacts',{}), known=ld('known',{}), friends=ld('friends',{}), blocked=ld('blocked',[]);
  const saveC=()=>{ sv('contacts',contacts); sv('known',known); sv('friends',friends); sv('blocked',blocked); };
  const cardOf = id => contacts[id] || known[id] || (friends[id]&&friends[id].card) || null;
  const nameOf = id => id===ME?.id ? 'Du' : (contacts[id]?.nick || cardOf(id)?.name || 'Okänd');
  const emoOf = id => cardOf(id)?.emoji || '👤';
  async function remember(card){ if(!(await okCard(card)) || card.id===ME?.id) return false; card=normCard(card);
    const ks=Object.keys(known); if(!known[card.id] && ks.length>800){ const drop=ks.find(k=>!contacts[k] && !friends[k]); if(drop) delete known[drop]; }
    known[card.id]={...card, bot:known[card.id]?.bot}; if(contacts[card.id]){ contacts[card.id]={...contacts[card.id], name:card.name, emoji:card.emoji}; } saveC(); return true; }
  async function seenCards(cards, where){ if(!ME || !Array.isArray(cards)) return; let added=0; for(const c of cards.slice(0,8)){ if(c && c.id!==ME.id && await remember(c) && !contacts[c.id]){ friends[c.id]={card:normCard(c), where:where||'spel', seen:Date.now()}; added++; } } saveC(); if(added && vis()) refresh(); }
  function addContact(id, vl){ const c=cardOf(id); if(!c) return; const was=contacts[id]; contacts[id]={...normCard(c), added:was?.added||Date.now(), vl:Math.max(was?.vl||0, vl || (friends[id]?2:1)), vAt:was?.vAt, bot:was?.bot}; delete friends[id]; blocked=blocked.filter(x=>x!==id); const cv=convs['d:'+id]; if(cv) cv.request=false; saveC(); saveConvs(); refresh(); connectTo(id); }
  function block(id){ if(!blocked.includes(id)) blocked.push(id); delete contacts[id]; delete convs['d:'+id]; saveC(); saveConvs(); refresh(); }
  async function safetyNumber(id){ const c=cardOf(id); if(!c) return '–'; const ks=[ME.ik.pub,c.ik].sort();
    const h=new Uint8Array(await crypto.subtle.digest('SHA-512',cat(ub64(ks[0]),ub64(ks[1]),te.encode('FL-Safety-v1'))));
    let out=[]; for(let i=0;i<12;i++){ const v=((h[i*3]<<16)|(h[i*3+1]<<8)|h[i*3+2])%100000; out.push(String(v).padStart(5,'0')); } return out.join(' '); }

  /* ---------- Double Ratchet (enskilda chattar) ---------- */
  let SESS=ld('sess',{});
  const resetAt={};      // när sessionen med en kontakt senast startades om (spärr)
  const saveS=()=>sv('sess',SESS);
  const locks=new Map();
  function lock(id,fn){ const p=(locks.get(id)||Promise.resolve()).then(fn,fn); locks.set(id,p.catch(()=>{})); return p; }
  function encryptFor(peer, payload){ return lock(peer, async()=>{
    const c=cardOf(peer); if(!c) throw new Error('okänd mottagare'); if(c.curve!==ME.curve) throw new Error('olika krypteringskurvor');
    let st=SESS[peer];
    if(!st){ // X3DH-liknande start: vi blir "Alice"
      const ek=await genKP(ME.curve);
      const sk=await hkdf(cat(await dh(ME.curve,ek,c.ik), await dh(ME.curve,ME.ik,c.ik)), new Uint8Array(32), 'FL-X3DH-v1', 32);
      const DHs=await genKP(ME.curve); const [rk,cks]=await kdfRK(sk, await dh(ME.curve,DHs,c.ik));
      st={role:'A', ek:ek.pub, confirmed:false, DHs, DHr:c.ik, RK:b64(rk), CKs:b64(cks), CKr:null, Ns:0, Nr:0, PN:0, skipped:{}};
    }
    if(!st.CKs){ throw new Error('väntar på första meddelandet'); }
    const [nck,mk]=await kdfCK(ub64(st.CKs)); st.CKs=b64(nck);
    const hdr={dh:st.DHs.pub, pn:st.PN, n:st.Ns}; if(!st.confirmed){ hdr.ek=st.ek; hdr.ik=ME.ik.pub; hdr.cv=ME.curve; }
    st.Ns++;
    const ct=await aesEnc(mk, te.encode(JSON.stringify(payload)), te.encode(JSON.stringify(hdr)+ME.id+'>'+peer));
    SESS[peer]=st; saveS(); return {hdr,ct};
  }); }
  async function skipKeys(st,until){ if(!st.CKr) return; if(until-st.Nr>800) throw new Error('för många hoppade meddelanden');
    while(st.Nr<until){ const [ck,mk]=await kdfCK(ub64(st.CKr)); st.skipped[st.DHr+':'+st.Nr]=b64(mk); st.CKr=b64(ck); st.Nr++; }
    const ks=Object.keys(st.skipped); if(ks.length>1000) ks.slice(0,ks.length-1000).forEach(k=>delete st.skipped[k]); }
  async function dhRatchet(st,hdr){ st.PN=st.Ns; st.Ns=0; st.Nr=0; st.DHr=hdr.dh;
    const [rk,ckr]=await kdfRK(ub64(st.RK), await dh(ME.curve,st.DHs,st.DHr)); st.DHs=await genKP(ME.curve);
    const [rk2,cks]=await kdfRK(rk, await dh(ME.curve,st.DHs,st.DHr)); st.RK=b64(rk2); st.CKr=b64(ckr); st.CKs=b64(cks); }
  // Ett försök att dekryptera med en given (kopierad) sessionsstatus – ändrar bara kopian
  async function ratchetDecrypt(st, hdr, ct, ad){
    const key=hdr.dh+':'+hdr.n;
    let mk;
    if(st.skipped[key]){ mk=ub64(st.skipped[key]); delete st.skipped[key]; }
    else {
      if(hdr.dh!==st.DHr){ await skipKeys(st,hdr.pn); await dhRatchet(st,hdr); }
      await skipKeys(st,hdr.n);
      const [ck,m]=await kdfCK(ub64(st.CKr)); st.CKr=b64(ck); st.Nr++; mk=m;
    }
    return aesDec(mk, ct, ad);   // kastar fel om något inte stämmer
  }
  async function freshB(hdr){
    if(hdr.cv!==ME.curve) throw new Error('olika krypteringskurvor');
    const sk=await hkdf(cat(await dh(ME.curve,ME.ik,hdr.ek), await dh(ME.curve,ME.ik,hdr.ik)), new Uint8Array(32), 'FL-X3DH-v1', 32);
    return {role:'B', ek:hdr.ek, confirmed:true, DHs:ME.ik, DHr:null, RK:b64(sk), CKs:null, CKr:null, Ns:0, Nr:0, PN:0, skipped:{}};
  }
  function decryptFrom(peer, hdr, ct){ return lock(peer, async()=>{
    const ad=te.encode(JSON.stringify(hdr)+peer+'>'+ME.id);
    const cur=SESS[peer] ? JSON.parse(JSON.stringify(SESS[peer])) : null;
    // vilka sessioner ska provas, i ordning? [status|null=ny, är det en återstart?]
    const tries=[];
    if(hdr.ek){
      const need = !cur || (cur.role==='B' && cur.ek!==hdr.ek) || (cur.role==='A' && !cur.confirmed && ME.id>peer);
      tries.push(need ? [null, !!cur] : [cur,false]);
    } else { if(!cur) throw new Error('ingen session'); tries.push([cur,false]); }
    let err;
    for(const [st0,reset] of tries){
      try{
        const st = st0 || await freshB(hdr);
        const pt=await ratchetDecrypt(st, hdr, ct, ad);
        if(st.role==='A') st.confirmed=true;
        SESS[peer]=st; saveS();
        if(reset) requeueFor(peer);
        return JSON.parse(td.decode(pt));
      }catch(e){ err=e; }
    }
    throw err;
  }); }

  /* ---------- Sender Keys (grupper) ---------- */
  let GROUPS=ld('groups',{}), SKEYS=ld('skeys',{});
  const saveG=()=>{ sv('groups',GROUPS); sv('skeys',SKEYS); };
  // Varje avsändare har en kedjenyckel + en signeringsnyckel (ECDSA P-256), så att ingen gruppmedlem kan låtsas vara en annan.
  const ECDSA={name:'ECDSA', namedCurve:'P-256'}, SIGN={name:'ECDSA', hash:'SHA-256'};
  const skLock=new Map();
  function mySK(gid){ const p=(skLock.get(gid)||Promise.resolve()).then(()=>mySK0(gid)); skLock.set(gid,p.catch(()=>{})); return p; }
  async function mySK0(gid){ const s=SKEYS[gid]||(SKEYS[gid]={mine:null,recv:{}});
    if(!s.mine || !s.mine.spriv){ const kp=await crypto.subtle.generateKey(ECDSA,true,['sign','verify']);
      s.mine={ck:b64(crypto.getRandomValues(new Uint8Array(32))), iter:0, spub:b64(await crypto.subtle.exportKey('raw',kp.publicKey)), spriv:b64(await crypto.subtle.exportKey('pkcs8',kp.privateKey))}; saveG(); }
    return s.mine; }
  const sigData=(gid,from,iter,ct)=>te.encode('FL-gs-v1|'+gid+'|'+from+'|'+iter+'|'+ct);
  function gEncrypt(gid, payload){ const p=(skLock.get(gid)||Promise.resolve()).then(()=>gEncrypt0(gid,payload)); skLock.set(gid,p.catch(()=>{})); return p; }
  async function gEncrypt0(gid, payload){ const m=await mySK0(gid); const [nck,mk]=await kdfCK(ub64(m.ck)); const iter=m.iter; m.ck=b64(nck); m.iter++; saveG();
    const ct=await aesEnc(mk, te.encode(JSON.stringify(payload)), te.encode(gid+':'+ME.id+':'+iter));
    const sk=await crypto.subtle.importKey('pkcs8',ub64(m.spriv),ECDSA,false,['sign']);
    return {iter, ct, sig:b64(await crypto.subtle.sign(SIGN, sk, sigData(gid,ME.id,iter,ct)))}; }
  async function gDecrypt(gid, from, iter, ct, sig){ const s=SKEYS[gid]; const r=s && s.recv[from]; if(!r) throw new Error('saknar avsändarnyckel');
    if(!r.spub || !sig) throw new Error('osignerat');
    const vk=await crypto.subtle.importKey('raw',ub64(r.spub),ECDSA,false,['verify']);
    if(!(await crypto.subtle.verify(SIGN, vk, ub64(sig), sigData(gid,from,iter,ct)))) throw new Error('fel signatur');
    const st=JSON.parse(JSON.stringify(r)); let mk;
    if(st.skipped[iter]){ mk=ub64(st.skipped[iter]); delete st.skipped[iter]; }
    else { if(iter<st.iter) throw new Error('gammalt'); if(iter-st.iter>2000) throw new Error('för långt fram');
      while(st.iter<iter){ const [ck,m]=await kdfCK(ub64(st.ck)); st.skipped[st.iter]=b64(m); st.ck=b64(ck); st.iter++; }
      const [ck,m]=await kdfCK(ub64(st.ck)); st.ck=b64(ck); st.iter++; mk=m; }
    const pt=await aesDec(mk, ct, te.encode(gid+':'+from+':'+iter));
    s.recv[from]=st; saveG(); return JSON.parse(td.decode(pt)); }
  async function sendSKD(gid, to){ const m=await mySK(gid); queueDirect(to, {type:'skd', gid, ck:m.ck, iter:m.iter, spub:m.spub}, true); }
  async function rotateMySK(gid){ await (skLock.get(gid)||Promise.resolve()); const s=SKEYS[gid]||(SKEYS[gid]={mine:null,recv:{}}); s.mine=null; await mySK(gid); for(const id of (GROUPS[gid]?.members||[])) if(id!==ME.id) await sendSKD(gid,id); }

  /* ---------- konversationer ---------- */
  let convs=ld('convs',{}), outbox=ld('outbox',[]), relayQ=ld('relay',[]), seen=new Set(ld('seen',[])), pendingG=[];
  let saveT=0; function saveConvs(){ clearTimeout(saveT); saveT=setTimeout(()=>{ sv('convs',convs); sv('outbox',outbox); sv('relay',relayQ); sv('seen',[...seen].slice(-3000)); },150); }
  function conv(id, init){ if(!convs[id]){ convs[id]={id, type:id.startsWith('g:')?'grp':'dm', msgs:[], unread:0, timer:0, theme:null, lastTs:0, ...(init||{})}; } return convs[id]; }
  const peerOfConv = cid => cid.startsWith('d:') ? cid.slice(2) : null;
  const recipients = cid => cid.startsWith('g:') ? (GROUPS[cid.slice(2)]?.members||[]).filter(x=>x!==ME.id) : [peerOfConv(cid)];
  function addMsg(cid, m){ const c=conv(cid); if(c.msgs.some(x=>x.mid===m.mid)) return false; c.msgs.push(m); c.msgs.sort((a,b)=>a.ts-b.ts); if(c.msgs.length>600) c.msgs=c.msgs.slice(-600); c.lastTs=Math.max(c.lastTs,m.ts); saveConvs(); return true; }
  function sysMsg(cid,text){ addMsg(cid,{mid:uid(), sys:true, text, ts:Date.now()}); }
  const TIMERS=[[0,'Av'],[300,'5 minuter'],[3600,'1 timme'],[86400,'24 timmar'],[604800,'7 dagar']];
  const timerName = s => (TIMERS.find(t=>t[0]===s)||[0,`${s} s`])[1];

  /* ---------- utkorg, kvitton & relä ---------- */
  // outbox-post: {mid, to, kind:'d'|'g', payload|genv, status:'queued'|'sent'|'relayed', ts, ctl}
  function queueDirect(to, payload, ctl){ outbox.push({mid: payload.mid || uid(), to, kind:'d', payload, status:'queued', ts:Date.now(), ctl:!!ctl}); saveConvs(); flushTo(to); }
  function requeueFor(peer){ outbox.forEach(o=>{ if(o.to===peer && o.kind==='d'){ o.status='queued'; o.acked=false; o.lastSend=0; } }); saveConvs(); flushTo(peer); }
  function markStatus(cid, mid, who, st, at){
    const c=convs[cid]; if(!c) return; const m=c.msgs.find(x=>x.mid===mid); if(!m || !m.out) return;
    m.st=m.st||{}; const rank={queued:0,sent:1,relayed:1,delivered:2,read:3};
    if((rank[st]||0) >= (rank[m.st[who]]||0)) m.st[who]=st;
    m.stT=m.stT||{}; const T=m.stT[who]=m.stT[who]||{}, t=Math.min(at||Date.now(), Date.now()), k= st==='relayed'?'sent':st;
    if(k!=='queued' && !T[k]) T[k]=t;
    if((k==='delivered'||k==='read') && !T.sent) T.sent=t;
    if(k==='read' && !T.delivered) T.delivered=t;
    saveConvs(); if(vis()) refreshMsgs(cid); infoLive(cid,mid);
  }
  function aggStatus(m, cid){ const r=recipients(cid); if(!r.length) return 'read'; const vals=r.map(id=>(m.st||{})[id]||'queued'); const rank={queued:0,sent:1,relayed:1,delivered:2,read:3};
    const min=Math.min(...vals.map(v=>rank[v])); return ['queued','sent','delivered','read'][min]; }
  async function makeEnv(o){
    if(o.kind==='g') return {...o.genv, to:o.to};
    const {hdr,ct}=await encryptFor(o.to, o.payload); return {t:'env', mid:o.mid, from:ME.id, to:o.to, k:'d', hdr, ct, ts:o.ts};
  }
  // reservväg: om kontakten är med i samma onlinespel går meddelandet genom spelets anslutning
  const bridgeOK = id => typeof gameBridgeHas==='function' && gameBridgeHas(id);
  async function viaBridge(o){
    if(!bridgeOK(o.to) || Date.now()-(o.bridgeAt||0)<12000) return false;
    try{ const env=await makeEnv(o); if(gameBridge(o.to, env)){ o.bridgeAt=Date.now(); if(o.status==='queued'){ o.status='sent'; if(!o.ctl) markStatus(o.cid||'', o.mid, o.to, 'sent'); } return true; } }catch(e){}
    return false;
  }
  async function flushTo(id){
    const c=conns.get(id);
    const items=outbox.filter(o=>o.to===id);
    if(!items.length) return;
    // inte kvitterat på länge via chattanslutningen? prova spelets anslutning också
    for(const o of items) if(!o.acked && (!(c && c.open) || (o.lastSend && Date.now()-o.lastSend>8000))) await viaBridge(o);
    if(c && c.open){
      for(const o of items){ if(o.acked || Date.now()-(o.lastSend||0)<15000) continue; try{ const env=await makeEnv(o); sendRaw(c, env); o.lastSend=Date.now(); if(o.status==='queued'){ o.status='sent'; if(!o.ctl) markStatus(o.cid||'', o.mid, id, 'sent'); } }catch(e){ if(!/väntar/.test(e.message)) console.warn('chatt: kunde inte kryptera', e.message); } }
      saveConvs();
    } else {
      connectTo(id);
      // lämna till en kompis som reläar
      const relays=[...conns.keys()].filter(x=>x!==id && (BOTMODE || !conns.get(x)._local)).sort((a,b)=>sharesGroup(b,id)-sharesGroup(a,id)).slice(0,2);
      for(const o of items){ if(o.status!=='queued' || !relays.length || Date.now()-(o.relayTry||0)<5*60e3) continue; o.relayTry=Date.now();
        try{ const env=await makeEnv(o); relays.forEach(r=>sendRaw(conns.get(r), {t:'relay', to:id, env})); }catch(e){} }
      saveConvs();
    }
  }
  const sharesGroup=(a,b)=>Object.values(GROUPS).some(g=>g.members.includes(a)&&g.members.includes(b))?1:0;
  function flushAll(){ new Set(outbox.map(o=>o.to)).forEach(flushTo); relayQ=relayQ.filter(r=>r.until>Date.now()); new Set(relayQ.map(r=>r.to)).forEach(id=>{ const c=conns.get(id); if(c&&c.open){ relayQ.filter(r=>r.to===id).forEach(r=>sendRaw(c,r.env)); relayQ=relayQ.filter(r=>r.to!==id); saveConvs(); } else connectTo(id); }); }
  function sendReceipt(to, mids, kind, gid){ if(!mids.length || !to) return; queueDirect(to, {type:'receipt', mids, kind, gid, at:Date.now()}, true); }

  /* ---------- transport (PeerJS, direkt mellan enheter) ---------- */
  const CPREFIX='fl-chat-v1-'+(DEV?'dev-':'');
  let cpeer=null; const conns=new Map(), connecting=new Map(), lastSeen=ld('lastseen',{}), typing={};
  let testNoNet=false;
  function startTransport(){
    if(testNoNet) return;
    if(!owner || BOTMODE || cpeer || !ME || typeof Peer==='undefined') return;
    const p=cpeer=new Peer(CPREFIX+ME.id, peerOpts());
    p.on('open',()=>{ flushAll(); presenceSweep(); });
    p.on('connection',c=>attach(c,null));
    p.on('disconnected',()=>{ if(cpeer===p && !p.destroyed) setTimeout(()=>{ try{ p.reconnect() }catch(e){} },2000); });
    p.on('error',e=>{
      if(e.type==='unavailable-id'){ try{ p.destroy() }catch(_){} if(cpeer===p){ cpeer=null; setTimeout(startTransport,10000); } }
      else if(e.type==='peer-unavailable'){ const m=/fl-chat-v1-(?:dev-)?([0-9a-f]{16})/.exec(e.message||''); if(m){ connecting.delete(m[1]); } }
      else if(['network','server-error','socket-error','socket-closed'].includes(e.type)){ if(cpeer===p){ try{ p.destroy() }catch(_){} cpeer=null; setTimeout(startTransport,6000); } }
    });
  }
  function connectTo(id){
    if(!cpeer || !cpeer.open || !id || id===ME.id || conns.has(id) || blocked.includes(id) || id===ld('botid',null)) return;
    const t=connecting.get(id); if(t && Date.now()-t<15000) return;
    connecting.set(id,Date.now());
    const c=cpeer.connect(CPREFIX+id,{reliable:true}); c._out=true; attach(c,id);
    setTimeout(()=>{ if(!c.open){ try{ c.close() }catch(_){} } connecting.delete(id); },12000);
  }
  const sendRaw=(c,m)=>{ try{ if(c && c.open) c.send(JSON.stringify(m)); }catch(e){} };
  function attach(c, id){
    c.on('open',()=>{ c._n=uid()+uid(); sendRaw(c,{t:'hi', card:myCard(), n:c._n}); });
    c.on('data',d=>{ c._heard=Date.now(); if(typeof d!=='string' || d.length>300000) return; let m; try{ m=JSON.parse(d); }catch(e){ return; } if(!m || typeof m!=='object' || Array.isArray(m)) return; onData(c,m).catch(()=>{}); });
    c.on('close',()=>{ if(c._id && conns.get(c._id)===c){ conns.delete(c._id); lastSeen[c._id]=Date.now(); sv('lastseen',lastSeen); if(vis()) refreshHead(); } });
    c.on('error',()=>{});
  }
  // Bevis på att motparten äger sin identitetsnyckel: HMAC med den gemensamma DH-hemligheten över vår slumpade utmaning.
  async function proofFor(card, nonce, prover){ const sh=await dh(ME.curve, ME.ik, card.ik); return b64(await hmac(sh, te.encode('FL-hi-v1|'+nonce+'|'+prover))); }
  async function onData(c,m){
    if(!m || typeof m.t!=='string') return;
    if(m.t==='hi'){
      if(!(await okCard(m.card)) || blocked.includes(m.card.id) || m.card.id===ME.id || (c._card && c._card.id!==m.card.id)) { try{ c.close() }catch(_){} return; }
      c._card=normCard(m.card);
      if(!c._local){
        if(typeof m.n!=='string' || m.n.length>64 || m.card.curve!==ME.curve){ try{ c.close() }catch(_){} return; }
        try{ sendRaw(c,{t:'proof', p: await proofFor(m.card, m.n, ME.id)}); }catch(e){ try{ c.close() }catch(_){} return; }
        if(!c._authed) return;                               // väntar på motpartens bevis
      }
      return establish(c);
    }
    if(m.t==='proof'){
      if(c._local || c._authed || !c._card || typeof m.p!=='string') return;
      let ok=false; try{ ok = m.p === await proofFor(c._card, c._n, c._card.id); }catch(e){}
      if(!ok){ try{ c.close() }catch(_){} return; }
      c._authed=true; return establish(c);
    }
    return onData2(c,m);
  }
  async function establish(c){
    const card=c._card;
    {
      c._id=card.id; await remember(card);
      if(BOTMODE && !contacts[c._id]){ contacts[c._id]={...normCard(card), added:Date.now()}; saveC(); setTimeout(()=>botSay('d:'+c._id,'Hej! Jag är din testkompis 🤖 Skriv hjälp så ser du vad vi kan testa.',600),400); }
      const old=conns.get(c._id);
      if(old && old!==c && old.open){
        // båda ringde samtidigt: behåll anslutningen som det lägsta ID:t startade, på båda sidor
        const initiator = x => x._out ? ME.id : c._id;
        const oldStale = Date.now()-(old._heard||0) > 5000;                       // gammal tyst anslutning = död: den nya vinner
        const keep = oldStale ? c : initiator(c) < initiator(old) ? c : (initiator(old) < initiator(c) ? old : c);
        const drop = keep===c ? old : c;
        setTimeout(()=>{ try{ drop.close() }catch(_){} },1500);
        if(keep===old){ return; }
      }
      conns.set(c._id,c); connecting.delete(c._id); if(typeof FR!=='undefined' && !BOTMODE) FR.onConnect(x=>sendRaw(c,x)); lastSeen[c._id]=Date.now(); outbox.forEach(o=>{ if(o.to===c._id && !o.acked) o.lastSend=0; });
      flushTo(c._id);
      relayQ.filter(r=>r.to===c._id).forEach(r=>sendRaw(c,r.env)); relayQ=relayQ.filter(r=>r.to!==c._id); saveConvs();
      if(vis()) refresh();
      return;
    }
  }
  async function onData2(c,m){
    if(!c._id) return;                                       // inget annat än hi/proof före verifiering
    if(m.t==='ping'){ sendRaw(c,{t:'pong'}); return; }
    if(m.t.startsWith('fr') && typeof FR!=='undefined'){ FR.onMsg(m, x=>sendRaw(c,x)); return; }   // önskelistan
    if(m.t==='pong'){ c._pong=true; c._pongAt=Date.now(); return; }
    if(m.t==='resync'){                                      // motparten kunde inte läsa oss och har börjat om: gör samma sak
      const now=Date.now(); if(now-(resetAt[c._id]||0)<30000) return; resetAt[c._id]=now;
      lock(c._id, async()=>{ delete SESS[c._id]; saveS(); }).then(()=>requeueFor(c._id)); return; }
    if(m.t==='env'){ if(m.to===ME.id) receiveEnv(m, c); return; }
    if(m.t==='ack'){ if(!isH(m.mid)) return; let ch=false; outbox=outbox.filter(o=>{ if(o.mid!==m.mid || o.to!==c._id) return true; ch=true; if(o.ctl) return false; o.acked=true; if(!o.ctl) markStatus(o.cid||'',o.mid,o.to,'sent'); return true; }); if(ch) saveConvs(); return; }
    if(m.t==='relay'){ if(!isH(m.to) || !m.env || typeof m.env!=='object' || !isH(m.env.mid) || m.env.to!==m.to) return; if(!contacts[c._id] && !sharesGroup(c._id,m.to)) return; if(m.to===ME.id){ receiveEnv(m.env,null); return; }
      if(!relayQ.some(r=>r.env.mid===m.env.mid && r.to===m.to)){ relayQ.push({to:m.to, env:m.env, until:Date.now()+7*864e5}); if(relayQ.length>300) relayQ=relayQ.slice(-300); saveConvs(); }
      sendRaw(c,{t:'rack', mid:m.env.mid, to:m.to}); connectTo(m.to); return; }
    if(m.t==='rack'){ if(!isH(m.mid) || !isH(m.to)) return; const o=outbox.find(x=>x.mid===m.mid && x.to===m.to); if(o && o.status==='queued'){ o.status='relayed'; if(!o.ctl) markStatus(o.cid||'',o.mid,o.to,'relayed'); saveConvs(); } return; }
    if(m.t==='typing'){ if(!(m.conv==='dm' || (typeof m.conv==='string' && /^g:[0-9a-f]{16}$/.test(m.conv) && GROUPS[m.conv.slice(2)]?.members.includes(c._id)))) return;
      typing[m.conv==='dm'?'d:'+c._id:m.conv]={who:c._id, until:Date.now()+4000}; if(vis()) refreshHead(); setTimeout(()=>{ if(vis()) refreshHead(); },4100); return; }
  }
  async function receiveEnv(env, c){
    if(!env || typeof env!=='object' || !isH(env.mid) || !isH(env.from) || env.from===ME.id || blocked.includes(env.from) || typeof env.ct!=='string' || env.ct.length>250000) return;
    if(env.k==='d'){ const h=env.hdr; if(!h || typeof h!=='object' || !isB64(h.dh,100) || !isN(h.n,1e6) || !isN(h.pn,1e6) || (h.ek!==undefined && !(isB64(h.ek,100) && isB64(h.ik,100) && ['X25519','P-256'].includes(h.cv)))) return; }
    else if(env.k==='g'){ if(!isH(env.gid) || !isN(env.iter,1e7) || !isB64(env.sig,200)) return; }
    else return;
    const dkey=env.from+':'+env.mid+':'+(env.k==='g'?'g':'d');
    if(seen.has(dkey)){ if(c) sendRaw(c,{t:'ack', mid:env.mid}); return; }
    try{
      let p;
      if(env.k==='d'){
        if(!cardOf(env.from)){ if(!env.hdr.ik) throw new Error('okänd'); const card={v:1,id:await idFromPub(env.hdr.ik),ik:env.hdr.ik,curve:env.hdr.cv,name:'Okänd',emoji:'👤'}; if(card.id!==env.from) throw new Error('fel id'); known[card.id]=card; saveC(); }
        else if(env.hdr.ik && env.hdr.ik!==cardOf(env.from).ik) throw new Error('fel nyckel');
        p=await decryptFrom(env.from, env.hdr, env.ct);
      } else if(env.k==='g'){
        try{ p=await gDecrypt(env.gid, env.from, env.iter, env.ct, env.sig); }
        catch(e){ if(/saknar/.test(e.message)){ pendingG.push(env); if(pendingG.length>200) pendingG.shift(); return; } throw e; }
      } else return;
      seen.add(dkey); saveConvs(); if(c) sendRaw(c,{t:'ack', mid:env.mid});
      if(!p || typeof p!=='object' || Array.isArray(p) || typeof p.type!=='string') return;
      await handlePayload(env.from, p, env);
    }catch(e){
      // Riktig otakt? Börja om sessionen på båda sidor (bara över en verifierad anslutning, med spärr mot upprepning).
      // Meddelanden från en samtidig start där vi "vann" är väntade fel och räknas inte.
      if(c && c._id===env.from && env.k==='d'){
        const st=SESS[env.from], now=Date.now();
        const raceLeftover = env.hdr.ek && st && st.role==='A' && !st.confirmed && ME.id<env.from;
        if(!raceLeftover && now-(resetAt[env.from]||0)>30000){
          resetAt[env.from]=now;
          lock(env.from, async()=>{ delete SESS[env.from]; saveS(); }).then(()=>{ sendRaw(c,{t:'resync'}); requeueFor(env.from); });
        }
      }
      console.warn('chatt: kunde inte läsa meddelande', e.name, e.message, env.k, JSON.stringify(env.hdr||{iter:env.iter})); }
  }
  const normInvite = v => { if(!v || typeof v!=='object' || typeof v.code!=='string' || !/^[A-Z0-9]{4}$/.test(v.code)) return null; const g=GAMES.find(x=>x[0]===v.game); return g ? {game:g[0], icon:g[1], gname:g[2], code:v.code} : null; };
  async function handlePayload(from, p, env){
    if(p.gid===null) delete p.gid;
    if(p.gid!==undefined && !isH(p.gid)) return;
    if(env.k==='g' && p.gid!==undefined && p.gid!==env.gid) return;
    if(p.gid!==undefined && !GROUPS[p.gid]?.members.includes(from)) return;     // bara medlemmar påverkar en grupp
    if(env.k==='g' && p.gid===undefined && ['receipt','react','edit','revoke','timer'].includes(p.type)) return;
    switch(p.type){
      case 'msg': {
        if(!isH(p.mid) || p.mid!==env.mid) return;
        const cid = env.k==='g' ? 'g:'+env.gid : 'd:'+from;
        if(env.k==='g' && (!GROUPS[env.gid] || !GROUPS[env.gid].members.includes(from))) return;
        if(env.k==='d' && p.gid!==undefined) return;
        const isNew=!contacts[from] && env.k==='d';
        if(isNew && p.fromName && known[from]){ known[from].name=cleanName(p.fromName,20)||'Okänd'; known[from].emoji=cleanEmoji(p.fromEmoji); saveC(); }
        const c=conv(cid, isNew?{request:true}:{});
        const now=Date.now(), ts = Number.isFinite(p.ts) ? Math.min(p.ts, now+60e3) : now;
        const m={mid:p.mid, from, text:cleanText(p.text,4000), ts, rcv:now, exp:TIMERS.some(t=>t[0]===p.exp)?p.exp:0, invite:normInvite(p.invite), reactions:{}};
        if(!m.text && !m.invite) return;
        if(m.exp) m.expireAt=Math.max(m.ts,Date.now()-60e3)+m.exp*1000;
        if(typing[cid] && typing[cid].who===from) delete typing[cid];
        if(addMsg(cid,m)){
          const orph=orphans[m.mid]; if(orph && orph.from===from){ delete orphans[m.mid]; sv('orph',orphans); applyChange(cid,m,orph.p,true); }
          const open = !BOTMODE && vis() && openCid===cid && !document.hidden;
          if(!open){ c.unread=(c.unread||0)+1; if(!BOTMODE) notifyMsg(cid, from, m); }
          else { m.readAt=Date.now(); m.readSent=true; sendReceipt(from,[m.mid],'read', env.gid); }
          if(BOTMODE) botOnMsg(cid, from, m, env.gid);
          if(!open) sendReceipt(from,[m.mid],'delivered', env.gid);
          saveConvs(); if(vis()) refresh(); else if(view==='lobby') render();
        }
        break; }
      case 'receipt': {
        const cid = p.gid ? 'g:'+p.gid : 'd:'+from;
        if(!Array.isArray(p.mids)) return;
        p.mids.slice(0,500).filter(isH).forEach(mid=>{ markStatus(cid, mid, from, p.kind==='read'?'read':'delivered', +p.at||0); outbox=outbox.filter(o=>!(o.mid===mid && o.to===from)); });
        saveConvs(); break; }
      case 'react': { if(!isH(p.target) || !(p.emoji===null || REACTS.includes(p.emoji))) return; const cid = p.gid ? 'g:'+p.gid : 'd:'+from; const m=convs[cid]?.msgs.find(x=>x.mid===p.target); if(m){ m.reactions=m.reactions||{}; if(p.emoji) m.reactions[from]=p.emoji; else delete m.reactions[from]; saveConvs(); if(vis()) refreshMsgs(cid); } break; }
      case 'edit': case 'revoke': {
        if(!isH(p.target)) return; if(p.type==='edit'){ p.text=cleanText(p.text,4000); if(!p.text) return; }
        const cid = p.gid ? 'g:'+p.gid : 'd:'+from; const m=convs[cid]?.msgs.find(x=>x.mid===p.target);
        if(!m){ orphans[p.target]={from,p:{type:p.type, text:p.text, at:p.at, gid:p.gid}}; const ks=Object.keys(orphans); if(ks.length>200) delete orphans[ks[0]]; sv('orph',orphans); break; }
        if(m.from!==from || m.out) break;
        applyChange(cid,m,p,false); break; }
      case 'timer': { if(!TIMERS.some(t=>t[0]===p.secs)) return; const cid = p.gid ? 'g:'+p.gid : 'd:'+from; if(p.gid && !GROUPS[p.gid]?.members.includes(from)) return; const c=conv(cid); c.timer=p.secs; sysMsg(cid, `${nameOf(from)} ändrade försvinnande meddelanden till: ${timerName(c.timer)}`); if(vis()) refresh(); break; }
      case 'profile': { if(known[from]){ known[from].name=cleanName(p.name,20)||known[from].name; known[from].emoji=cleanEmoji(p.emoji, known[from].emoji); } if(contacts[from]){ contacts[from].name=known[from].name; contacts[from].emoji=known[from].emoji; } saveC(); if(vis()) refresh(); break; }
      case 'ginfo': {
        const g=p.group; if(!g || typeof g!=='object' || !isH(g.id) || !Array.isArray(g.members) || g.members.length>64 || !g.members.every(isH)) return;
        const prev=GROUPS[g.id];
        if(!prev && !p.leave && (g.admin!==from || !g.members.includes(from))) return;   // en ny grupp skapas bara av sin admin
        if(!p.leave && !isH(g.admin)) return;
        if(prev && prev.admin!==from && !(p.leave && prev.members.includes(from))) return;
        if(p.leave){ if(prev){ prev.members=prev.members.filter(x=>x!==from); saveG(); sysMsg('g:'+g.id, `${nameOf(from)} lämnade gruppen`); rotateMySK(g.id); } break; }
        if(g.cards && typeof g.cards==='object') for(const card of Object.values(g.cards).slice(0,64)) await remember(card);
        if(!g.members.includes(ME.id)){ if(prev){ sysMsg('g:'+g.id,'Du togs bort från gruppen'); delete GROUPS[g.id]; saveG(); } break; }
        GROUPS[g.id]={id:g.id, name:cleanName(g.name,40)||'Grupp', emoji:cleanEmoji(g.emoji,'👥'), members:[...new Set(g.members)], admin:prev?prev.admin:g.admin, created:Number.isFinite(g.created)?g.created:Date.now()};
        saveG(); conv('g:'+g.id);
        if(!prev){ sysMsg('g:'+g.id, `${nameOf(from)} lade till dig i gruppen ”${GROUPS[g.id].name}”`); notifyMsg('g:'+g.id, from, {text:'Du lades till i gruppen'}); }
        else sysMsg('g:'+g.id, `${nameOf(from)} uppdaterade gruppen`);
        rotateMySK(g.id);
        if(vis()) refresh();
        break; }
      case 'skd': {
        if(!isH(p.gid) || !GROUPS[p.gid] || !GROUPS[p.gid].members.includes(from) || !isB64(p.ck,60) || !isN(p.iter,1e7) || !isB64(p.spub,120)) return;
        const s=SKEYS[p.gid]||(SKEYS[p.gid]={mine:null,recv:{}}); s.recv[from]={ck:p.ck, iter:p.iter, spub:p.spub, skipped:{}}; saveG();
        const waiting=pendingG.filter(e=>e.gid===p.gid && e.from===from); pendingG=pendingG.filter(e=>!(e.gid===p.gid && e.from===from));
        for(const e of waiting) await receiveEnv(e,null);
        break; }
    }
  }

  let orphans=ld('orph',{});
  function applyChange(cid,m,p,quiet){
    if(p.type==='edit'){ if(m.revoked) return; m.text=String(p.text||'').slice(0,4000); m.edited=Math.min(+p.at||Date.now(),Date.now()); }
    else { m.revoked=true; m.revokedAt=Date.now(); m.text=''; m.invite=null; m.reactions={}; m.edited=0; }
    saveConvs(); if(vis()) refresh(); infoLive(cid,m.mid);
    if(BOTMODE && !quiet) botOnChange(cid,m,p);
  }

  /* ---------- skicka ---------- */
  function sendMsg(cid, text, invite){
    text=String(text||'').trim(); if(!text && !invite) return;
    const c=conv(cid), rec=recipients(cid); if(!rec.length && cid.startsWith('g:')){ toast('Gruppen har inga andra medlemmar'); return; }
    const m={mid:uid(), from:ME.id, text, ts:Date.now(), exp:c.timer||0, invite:invite||null, out:true, st:{}, reactions:{}};
    if(m.exp) m.expireAt=m.ts+m.exp*1000;
    addMsg(cid,m); rec.forEach(id=>m.st[id]='queued');
    const payload={type:'msg', mid:m.mid, text:m.text, ts:m.ts, exp:m.exp, invite:m.invite, fromName:ME.name, fromEmoji:ME.emoji};
    if(cid.startsWith('g:')){
      const gid=cid.slice(2);
      gEncrypt(gid,payload).then(({iter,ct,sig})=>{ const genv={t:'env', mid:m.mid, from:ME.id, k:'g', gid, iter, ct, sig, ts:m.ts};
        rec.forEach(to=>outbox.push({mid:m.mid, cid, to, kind:'g', genv, status:'queued', ts:m.ts})); saveConvs(); rec.forEach(flushTo); });
    } else { const to=rec[0]; outbox.push({mid:m.mid, cid, to, kind:'d', payload, status:'queued', ts:m.ts}); saveConvs(); flushTo(to); }
    tone(880,.06,'sine',.05); refresh();
  }
  function ctlAll(cid, payload){ const gid=cid.startsWith('g:')?cid.slice(2):null; recipients(cid).forEach(id=>queueDirect(id,{...payload, gid},true)); }
  function editMsg(cid, mid, text){
    const m=convs[cid]?.msgs.find(x=>x.mid===mid); text=String(text||'').trim();
    if(!m || !m.out || m.revoked || m.invite || !text || text===m.text) return;
    m.text=text; m.edited=Date.now(); saveConvs();
    ctlAll(cid,{type:'edit', target:mid, text, at:m.edited}); refresh(); infoLive(cid,mid);
  }
  function revokeMsg(cid, mid){
    const m=convs[cid]?.msgs.find(x=>x.mid===mid); if(!m || !m.out || m.revoked) return;
    m.revoked=true; m.revokedAt=Date.now(); m.text=''; m.invite=null; m.reactions={}; m.edited=0; saveConvs();
    ctlAll(cid,{type:'revoke', target:mid}); refresh(); infoLive(cid,mid);
  }
  function setTimer(cid,secs){ const c=conv(cid); c.timer=secs; sysMsg(cid,`Du ändrade försvinnande meddelanden till: ${timerName(secs)}`); ctlAll(cid,{type:'timer', secs}); saveConvs(); refresh(); }
  function react(cid, mid, emoji){ const m=convs[cid]?.msgs.find(x=>x.mid===mid); if(!m) return; m.reactions=m.reactions||{}; const same=m.reactions[ME.id]===emoji;
    if(same) delete m.reactions[ME.id]; else m.reactions[ME.id]=emoji; saveConvs(); ctlAll(cid,{type:'react', target:mid, emoji: same?null:emoji}); refreshMsgs(cid); }
  function createGroup(name, emoji, members){
    const gid=uid(); const ids=[ME.id, ...members.filter(id=>id!==ME.id)];
    const cards={}; ids.forEach(id=>{ cards[id]= id===ME.id ? myCard() : cardOf(id); });
    GROUPS[gid]={id:gid, name:name.slice(0,40), emoji, members:ids, admin:ME.id, created:Date.now()}; saveG();
    conv('g:'+gid); sysMsg('g:'+gid,`Du skapade gruppen ”${GROUPS[gid].name}”`);
    const ginfo={type:'ginfo', group:{...GROUPS[gid], cards}};
    ids.forEach(id=>{ if(id!==ME.id){ queueDirect(id,ginfo,true); sendSKD(gid,id); } });
    openConv('g:'+gid);
  }
  function updateGroupMembers(gid, members){
    const g=GROUPS[gid]; if(!g || g.admin!==ME.id) return; const before=g.members.slice();
    g.members=[ME.id, ...members.filter(id=>id!==ME.id)]; saveG();
    const cards={}; g.members.forEach(id=>{ cards[id]= id===ME.id ? myCard() : cardOf(id); });
    const ginfo={type:'ginfo', group:{...g, cards}};
    new Set([...before,...g.members]).forEach(id=>{ if(id!==ME.id) queueDirect(id,ginfo,true); });
    sysMsg('g:'+gid,'Du uppdaterade medlemmarna'); rotateMySK(gid); refresh();
  }
  function leaveGroup(gid){ const g=GROUPS[gid]; if(!g) return; g.members.forEach(id=>{ if(id!==ME.id) queueDirect(id,{type:'ginfo', leave:true, group:{id:gid, members:g.members}},true); });
    delete GROUPS[gid]; delete SKEYS[gid]; delete convs['g:'+gid]; saveG(); saveConvs(); openCid=null; refresh(); }

  /* ---------- försvinnande meddelanden ---------- */
  setInterval(()=>{ if(!owner) return; const now=Date.now(); let ch=false; Object.values(convs).forEach(c=>{ const n=c.msgs.length; c.msgs=c.msgs.filter(m=>!m.expireAt || m.expireAt>now); if(c.msgs.length!==n) ch=true; }); if(ch){ saveConvs(); if(vis()) refresh(); } },15000);
  // närvaro: koppla upp mot kontakter med jämna mellanrum
  function presenceSweep(){ if(!ME) return; Object.keys(contacts).slice(0,25).forEach(connectTo); Object.values(GROUPS).forEach(g=>g.members.forEach(connectTo)); }
  // Hjärtslag: upptäck döda anslutningar (skärmen släckt, appbyte, tappat nät) och koppla upp igen
  function dropConn(c){
    try{ c.close() }catch(_){}
    if(c._id && conns.get(c._id)===c){ conns.delete(c._id); lastSeen[c._id]=Date.now(); }
    connecting.delete(c._id);
    outbox.forEach(o=>{ if(o.to===c._id && !o.acked) o.lastSend=0; });   // skickas om när vi är uppkopplade igen
    if(vis()) refreshHead();
    setTimeout(()=>connectTo(c._id),300);
  }
  setInterval(()=>{
    if(!owner || BOTMODE) return;
    const now=Date.now();
    for(const c of [...conns.values()]){
      if(c._local) continue;
      if(c._pong && now-(c._heard||0)>25000){ dropConn(c); continue; }       // (äldre versioner svarar inte på ping)
      // skickat men inte kvitterat på 10 s, och inget hört sedan dess? då är anslutningen död
      if(outbox.some(o=>o.to===c._id && o.lastSend && !o.acked && now-o.lastSend>10000 && (c._pong ? (c._pongAt||0) : (c._heard||0))<o.lastSend)){ dropConn(c); continue; }
      sendRaw(c,{t:'ping'});
    }
    if(cpeer && cpeer.disconnected && !cpeer.destroyed){ try{ cpeer.reconnect() }catch(e){} }
    if(cpeer && cpeer.open) flushAll(); else if(outbox.length) new Set(outbox.map(o=>o.to)).forEach(id=>flushTo(id));
  },8000);
  // När appen visas igen / får nät: pinga alla och koppla om dem som inte svarar
  function probe(){
    if(!owner || BOTMODE || !ME) return;
    if(!cpeer || cpeer.destroyed){ cpeer=null; startTransport(); }
    else if(cpeer.disconnected){ try{ cpeer.reconnect() }catch(e){} }
    const t0=Date.now(); for(const c of conns.values()) if(!c._local) sendRaw(c,{t:'ping'});
    setTimeout(()=>{ for(const c of [...conns.values()]) if(!c._local && c._pong && (c._heard||0)<t0) dropConn(c); flushAll(); presenceSweep(); },3500);
  }
  window.addEventListener('online',()=>setTimeout(probe,600));
  setInterval(()=>{ if(cpeer && cpeer.open && !document.hidden) presenceSweep(); },60000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && ME && owner){ probe(); if(vis() && openCid) markRead(openCid); } });

  /* ---------- aviseringar ---------- */
  function notifyMsg(cid, from, m){
    const g=cid.startsWith('g:')?GROUPS[cid.slice(2)]:null;
    const title = g ? `${g.emoji} ${g.name}` : `${emoOf(from)} ${nameOf(from)}`;
    const text = (g?nameOf(from)+': ':'') + (m.invite ? `🎮 Bjuder in till ${m.invite.gname}` : (m.text||'').slice(0,80));
    notice({icon:'💬', title, text, actions:[{label:'Öppna', run:()=>openChat(cid)}], ms:9000});
    if(typeof render==='function' && view==='lobby') render();
  }
  const totalUnread = () => Object.values(convs).reduce((a,c)=>a+(c.unread||0),0);
  function markRead(cid){ const c=convs[cid]; if(!c) return; const unreadMsgs=c.msgs.filter(m=>!m.out && !m.sys && !m.readSent);
    const by={}, now=Date.now(); unreadMsgs.forEach(m=>{ m.readSent=true; if(!m.readAt) m.readAt=now; (by[m.from]=by[m.from]||[]).push(m.mid); });
    Object.entries(by).forEach(([f,mids])=>sendReceipt(f,mids,'read', cid.startsWith('g:')?cid.slice(2):undefined));
    if(c.unread){ c.unread=0; } saveConvs(); }

  /* ---------- spelinbjudningar ---------- */
  const GAMES=[['yatzy','🎲','Yatzy'],['ships','🚢','Sänka skepp'],['mm','🔮','Mastermind'],['hang','🪢','Hänga gubbe'],['kina','⭐','Kinaschack'],['ordfajt','🔤','Ordfajt'],['pong','🏓','Pong']];
  function inviteToGame(cid, kind){
    closeModal(); const name=lsGet('ry_name')||ME.name; const g=GAMES.find(x=>x[0]===kind);
    hostGame(name,'free', kind==='yatzy'?undefined:kind);
    setTimeout(()=>{ sendMsg(cid,'',{game:kind, gname:g[2], icon:g[1], code:gameId}); toast(`Inbjudan skickad – väntar på spelare i ${g[2]} 🎮`,3500); },300);
  }

  /* =====================================================================
     UTSEENDE (WhatsApp-stil)
     ===================================================================== */
  let editing=null, infoFor=null;
  let openCid=null, tab='chats', theme=lsGet('chat_theme')||'wa-dark', pickerOpen=false, menuFor=null, draft={};
  const THEMES={'wa-dark':'🌙 Klassisk mörk','wa-light':'☀️ Klassisk ljus','space':'🚀 Rymd','ocean':'🐬 Delfin & hav','leopard':'🐆 Leopard','pink':'💖 Rosa'};
  const EMOJI_SETS={
    '😀':'😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 😐 😏 😒 🙄 😬 😌 😴 🤒 🤧 🥵 🥶 🥳 😎 🤓 😕 😟 🙁 😮 😲 😳 🥺 😢 😭 😱 😤 😡 🤬 😈 💀 👻 👽 🤖 💩',
    '❤️':'❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💗 💓 💞 💕 💘 💝 💔 ❣️ 💯 ✨ ⭐ 🌟 💫 🔥 💥 🎉 🎊 🎈 🎁 🏆 🥇',
    '👍':'👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👋 👏 🙌 👐 🤲 🙏 💪 🤝 ✍️ 💅 👀 🤷 🙋 💁 🙆 🙅',
    '🐬':'🐬 🐳 🐋 🦈 🐙 🦑 🐠 🐟 🐡 🦀 🐚 🐆 🐅 🦁 🐯 🐶 🐱 🐰 🦊 🐻 🐼 🐨 🐸 🦄 🦋 🐝 🐞 🦩 🐧 🦉 🐢',
    '🍕':'🍕 🍔 🌮 🍝 🍣 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 🍿 🍓 🍉 🍌 🍎 🥝 🍦 🥤 🧃 ☕ 🧋',
    '⛷️':'⛷️ 🏂 🎿 ⛸️ 🏒 ⚽ 🏀 🎾 🏐 🏓 🎮 🕹️ 🎲 🧩 🃏 🎯 🎳 🏊 🚴 🤸 🧘 🎨 🎤 🎧 🎸 📚',
    '🚀':'🚀 🛸 🪐 🌍 🌙 ☀️ 🌈 ⭐ ☄️ 🌊 ❄️ ☃️ 🌸 🌺 🌻 🌲 🏔️ 🏖️ 🏝️ 🎄 🎃 🏠 🚗 ✈️ 🚂 ⛵'
  };
  const fmtT = ts => new Date(ts).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
  function dayLabel(ts){ const d=new Date(ts), n=new Date(); const k=x=>x.toDateString(); if(k(d)===k(n)) return 'Idag'; const y=new Date(n); y.setDate(n.getDate()-1); if(k(d)===k(y)) return 'Igår'; return d.toLocaleDateString('sv-SE',{weekday:'long', day:'numeric', month:'long'}); }
  const hue = id => (parseInt(String(id).replace(/[^0-9a-f]/g,'').slice(0,6),16)||0)%360;
  const avatar = (emoji, id, size, online) => `<span class="wa-av ${size||''}" style="--h:${hue(id||'0')}">${esc(emoji)}${online?'<i class="wa-on"></i>':''}</span>`;
  function convTitle(cid){ if(cid.startsWith('g:')){ const g=GROUPS[cid.slice(2)]; return g?`${g.emoji} ${g.name}`:'Grupp'; } return nameOf(cid.slice(2)); }
  function convAvatar(cid,size){ if(cid.startsWith('g:')){ const g=GROUPS[cid.slice(2)]; return avatar(g?g.emoji:'👥', cid, size); } const id=cid.slice(2); return avatar(emoOf(id), id, size, conns.has(id)); }
  function preview(c){ const m=[...c.msgs].reverse().find(x=>!x.hidden); if(!m) return c.type==='grp'?'Ny grupp':'Säg hej! 👋'; if(m.sys) return esc(m.text);
    if(m.revoked) return '🚫 <i>'+(m.out?'Du tog bort ett meddelande':'Meddelandet togs bort')+'</i>';
    const who = c.type==='grp' && !m.out ? nameOf(m.from)+': ' : ''; const tick = m.out ? tickHTML(aggStatus(m,c.id))+' ' : '';
    return tick + esc(who + (m.invite ? `🎮 Inbjudan: ${m.invite.gname}` : m.text)); }
  function tickHTML(st){ return st==='queued' ? '<i class="tk q">🕓</i>' : st==='sent' ? '<i class="tk">✓</i>' : st==='delivered' ? '<i class="tk">✓✓</i>' : '<i class="tk rd">✓✓</i>'; }

  function html(){
    if(!owner) return `<div id="chatRoot" class="wa t-${theme}"><div class="wa-setup"><div class="wa-card"><div style="font-size:54px">💬↗️</div><h2>Chatten är öppen på annat håll</h2>
      <p>Chatten används just nu i ett annat fönster eller en annan flik. Bara en i taget kan vara aktiv – annars kan krypteringsnycklarna komma i otakt.</p>
      ${popupWin && !popupWin.closed ? '<button class="wa-btn" data-c="focuspop">Visa chattfönstret</button>':''}
      <button class="wa-btn" data-c="steal" style="background:#475569">Använd chatten här i stället</button>${CHATWIN?'':'<button class="wa-link" data-c="hide">Tillbaka</button>'}</div></div></div>`;
    if(!ME) return `<div id="chatRoot" class="wa t-${theme}"><div class="wa-setup">${setupHTML()}</div></div>`;
    return `<div id="chatRoot" class="wa t-${theme} ${openCid?'has-open':''} ${wide()?'wide':''}"><aside class="wa-side" id="waSide">${sideHTML()}</aside><main class="wa-main" id="waMain">${mainHTML()}</main></div>`;
  }
  function setupHTML(){
    return `<div class="wa-card"><div style="font-size:54px">💬🔒</div><h2>Fröknarnas chatt</h2>
      <p>Allt du skriver krypteras på din enhet innan det skickas. Bara mottagaren kan läsa det – ingen server, ingen annan.</p>
      <label>Ditt namn i chatten</label><input id="waName" maxlength="20" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      <label>Välj en profilbild</label><div class="wa-emos">${EMO.map((e,i)=>`<button data-c="emo" data-e="${e}" class="${i===0?'sel':''}">${e}</button>`).join('')}</div>
      <button class="wa-btn" data-c="create">Skapa mina krypteringsnycklar ✨</button>
      ${CHATWIN?'':'<button class="wa-link" data-c="hide">Tillbaka</button>'}</div>`;
  }
  function sideHTML(){
    const list = Object.values(convs).filter(c=>c.type==='dm' ? !blocked.includes(peerOfConv(c.id)) : !!GROUPS[c.id.slice(2)]).sort((a,b)=>(b.lastTs||0)-(a.lastTs||0));
    const fr=Object.entries(friends).filter(([id])=>!contacts[id]);
    let body='';
    if(tab==='chats'){
      body = list.length ? list.map(c=>`<button class="wa-row ${c.id===openCid?'on':''}" data-c="open" data-id="${c.id}">${convAvatar(c.id)}<span class="wa-rt"><span class="wa-r1"><b>${esc(convTitle(c.id))}${c.type==='dm'?vdots(peerOfConv(c.id)):''}</b><small>${c.lastTs?fmtT(c.lastTs):''}</small></span>
          <span class="wa-r2"><span class="wa-pv">${c.request?'<em>Ny kontaktförfrågan</em>':preview(c)}</span>${c.timer?'<i class="wa-tm">⏱</i>':''}${c.unread?`<i class="wa-badge">${c.unread}</i>`:''}</span></span></button>`).join('')
        : `<div class="wa-empty">Inga chattar än.<br>Tryck på <b>＋</b> för att börja chatta med en kontakt.</div>`;
    } else {
      const cs=Object.values(contacts).sort((a,b)=>nameOf(a.id).localeCompare(nameOf(b.id),'sv'));
      body = `<button class="wa-row act" data-c="newgroup"><span class="wa-av ic">👥</span><span class="wa-rt"><b>Ny grupp</b></span></button>
        <button class="wa-row act" data-c="scanqr"><span class="wa-av ic">📷</span><span class="wa-rt"><b>Skanna QR-kod</b><small class="wa-sub">Lägg till eller verifiera någon öga mot öga</small></span></button>
        <button class="wa-row act" data-c="myqr"><span class="wa-av ic">🔳</span><span class="wa-rt"><b>Min QR-kod</b><small class="wa-sub">Visa för en kompis som står bredvid</small></span></button>
        <button class="wa-row act" data-c="sharecard"><span class="wa-av ic">🔗</span><span class="wa-rt"><b>Dela min kontakt</b><small class="wa-sub">Skicka en länk så kan någon lägga till dig</small></span></button>
        ${fr.length?`<div class="wa-sec">Spelkompisar – lägg till som kontakt</div>`+fr.map(([id,f])=>`<div class="wa-row">${avatar(f.card.emoji,id)}<span class="wa-rt"><b>${esc(f.card.name)}</b><small class="wa-sub">Från ${esc(f.where)}</small></span><button class="wa-add" data-c="addc" data-id="${id}">＋ Lägg till</button></div>`).join(''):''}
        ${DEV && !BOTMODE && !ld('botid',null) ? `<button class="wa-row act" data-c="mkbot"><span class="wa-av ic" style="background:#b45309">🤖</span><span class="wa-rt"><b>Skapa testkompis</b><small class="wa-sub">Bara i testversionen – svarar, läser, ändrar och tar bort</small></span></button>`:''}
        <div class="wa-sec">Kontakter${cs.length?` (${cs.length})`:''}</div>
        ${cs.length?cs.map(c=>`<button class="wa-row" data-c="opendm" data-id="${c.id}">${avatar(c.emoji,c.id,'',conns.has(c.id))}<span class="wa-rt"><b>${esc(nameOf(c.id))}${vdots(c.id)}</b><small class="wa-sub">${c.bot?'🤖 testkompis · ':''}${conns.has(c.id)?'online':'🔒 krypterad'}</small></span></button>`).join(''):'<div class="wa-empty">Spela ett onlinespel med någon – då dyker de upp här som spelkompisar.</div>'}`;
    }
    return `<div class="wa-head">${CHATWIN?'':`<button class="wa-back" data-c="hide" aria-label="Tillbaka till ${view==='lobby'?'lobbyn':'spelet'}">‹ <span>${view==='lobby'?'Lobby':'Spelet'}</span></button>`}<b class="wa-title">Chattar</b>
        ${!CHATWIN && navigator.locks ? '<button class="wa-ib" data-c="popout" aria-label="Öppna i eget fönster" title="Öppna chatten i eget fönster">⧉</button>':''}
        <button class="wa-ib" data-c="theme" aria-label="Tema">🎨</button><button class="wa-ib" data-c="profile" aria-label="Profil">${esc(ME.emoji)}</button></div>
      <div class="wa-tabs"><button class="${tab==='chats'?'on':''}" data-c="tab" data-t="chats">Chattar${totalUnread()?` <i class="wa-badge">${totalUnread()}</i>`:''}</button><button class="${tab==='contacts'?'on':''}" data-c="tab" data-t="contacts">Kontakter</button></div>
      <div class="wa-list">${body}</div>
      ${tab==='chats'?'<button class="wa-fab" data-c="tab" data-t="contacts" aria-label="Ny chatt">＋</button>':''}`;
  }
  function headStatus(cid){
    const t=typing[cid]; if(t && t.until>Date.now()) return `<span class="wa-typing">${cid.startsWith('g:')?esc(nameOf(t.who))+' ':''}skriver…</span>`;
    if(cid.startsWith('g:')){ const g=GROUPS[cid.slice(2)]; return g? esc(g.members.map(nameOf).join(', ')) : ''; }
    const id=cid.slice(2); if(conns.has(id)) return 'online';
    return lastSeen[id] ? `senast online ${dayLabel(lastSeen[id]).toLowerCase()} ${fmtT(lastSeen[id])}` : '🔒 end-to-end-krypterad';
  }
  function mainHTML(){
    if(!openCid || !convs[openCid]) return `<div class="wa-welcome"><div style="font-size:64px">💬</div><h2>Fröknarnas chatt</h2><p>Välj en chatt till vänster eller starta en ny.</p><p class="wa-lock">🔒 End-to-end-krypterad</p></div>`;
    const c=convs[openCid], th=c.theme||theme;
    return `<div class="wa-convwrap t-${th}">
      <div class="wa-head conv"><button class="wa-ib back" data-c="close" aria-label="Tillbaka">‹</button>${convAvatar(openCid,'sm')}
        <button class="wa-ht" data-c="info"><b>${esc(convTitle(openCid))}${openCid.startsWith('d:')?vdots(peerOfConv(openCid)):''}</b><small id="waStatus">${headStatus(openCid)}</small></button>
        <button class="wa-ib" data-c="invite" aria-label="Bjud in till spel">🎮</button>${!CHATWIN && navigator.locks && window.innerWidth>=700 ? '<button class="wa-ib" data-c="popout" aria-label="Öppna i eget fönster" title="Öppna chatten i eget fönster">⧉</button>':''}<button class="wa-ib" data-c="info" aria-label="Meny">⋮</button></div>
      ${c.request?`<div class="wa-req">${esc(nameOf(peerOfConv(openCid)))} finns inte bland dina kontakter. <button data-c="addc" data-id="${peerOfConv(openCid)}">Lägg till</button><button data-c="block" data-id="${peerOfConv(openCid)}">Blockera</button></div>`:''}
      <div class="wa-msgs" id="waMsgs">${msgsHTML(openCid)}</div>
      ${pickerOpen?emojiPickerHTML():''}
      ${editing && editing.cid===openCid ? `<div class="wa-edit"><span>✏️</span><div><b>Redigerar meddelande</b><small>${esc((convs[openCid].msgs.find(x=>x.mid===editing.mid)||{}).text||'').slice(0,90)}</small></div><button class="wa-ib" data-c="canceledit" aria-label="Avbryt">✕</button></div>`:''}
      <div class="wa-input"><button class="wa-ib" data-c="emoji" aria-label="Emojis">${pickerOpen?'⌨️':'😊'}</button>
        <textarea id="waText" rows="1" placeholder="Meddelande" maxlength="4000">${esc(draft[openCid]||'')}</textarea>
        <button class="wa-send" data-c="send" aria-label="${editing?'Spara':'Skicka'}">${editing && editing.cid===openCid?'✓':'➤'}</button></div></div>`;
  }
  function msgsHTML(cid){
    const c=convs[cid]; let h=`<div class="wa-sys lock" data-c="safety">🔒 Meddelanden och samtal är end-to-end-krypterade. Ingen utanför den här chatten kan läsa dem. Tryck för att se säkerhetsnumret.</div>`;
    if(c.timer) h+=`<div class="wa-sys">⏱ Försvinnande meddelanden är på: ${timerName(c.timer)}</div>`;
    let lastDay='', lastFrom='';
    c.msgs.forEach(m=>{
      const dl=dayLabel(m.ts); if(dl!==lastDay){ h+=`<div class="wa-day"><span>${dl}</span></div>`; lastDay=dl; lastFrom=''; }
      if(m.sys){ h+=`<div class="wa-sys">${esc(m.text)}</div>`; lastFrom=''; return; }
      const first = lastFrom!==(m.out?'me':m.from); lastFrom=m.out?'me':m.from;
      const reacts=Object.values(m.reactions||{}); const rc={}; reacts.forEach(e=>rc[e]=(rc[e]||0)+1);
      const body = m.revoked ? `<div class="wa-tx wa-rev">🚫 ${m.out?'Du tog bort det här meddelandet':'Det här meddelandet togs bort'}</div>` : m.invite ? `<div class="wa-inv"><span class="gi">${m.invite.icon||'🎮'}</span><div><b>${esc(m.invite.gname)}</b><small>${m.out?'Du bjöd in till ett spel':'Inbjudan till ett spel'} · kod ${esc(m.invite.code)}</small></div>${m.out?'':`<button data-c="join" data-code="${esc(m.invite.code)}">Gå med</button>`}</div>${m.text?`<div class="wa-tx">${linkify(m.text)}</div>`:''}`
        : `<div class="wa-tx ${/^\p{Extended_Pictographic}{1,3}$/u.test(m.text)?'big':''}">${linkify(m.text)}</div>`;
      h+=`<div class="wa-msg ${m.out?'out':'in'} ${first?'first':''}" data-mid="${m.mid}">
        <div class="wa-bub">${!m.out && c.type==='grp' && first?`<span class="wa-from" style="--h:${hue(m.from)}">${esc(nameOf(m.from))}</span>`:''}${body}
          <span class="wa-meta">${m.exp?'<i>⏱</i>':''}${m.edited?'<i class="wa-ed">redigerat</i>':''}${fmtT(m.ts)}${m.out?' '+tickHTML(aggStatus(m,cid)):''}</span></div>
        ${reacts.length?`<div class="wa-reacts">${esc(Object.entries(rc).map(([e,n])=>e+(n>1?n:'')).join(' '))}</div>`:''}
        ${menuFor===m.mid?`<div class="wa-menu">${m.revoked?'':`<div class="wa-rbar">${['❤️','😂','😮','😭','🙏','👍'].map(e=>`<button data-c="react" data-mid="${m.mid}" data-e="${e}">${e}</button>`).join('')}</div>`}
          <button data-c="minfo" data-mid="${m.mid}">ℹ️ Info</button>
          ${m.out && !m.revoked && !m.invite && m.text ? `<button data-c="edit" data-mid="${m.mid}">✏️ Redigera</button>`:''}
          ${!m.revoked && m.text ? `<button data-c="copy" data-mid="${m.mid}">📋 Kopiera</button>`:''}
          ${m.out && !m.revoked ? `<button data-c="revoke" data-mid="${m.mid}">🚫 Ta bort för alla</button>`:''}
          <button data-c="delme" data-mid="${m.mid}">🗑 Ta bort för mig</button></div>`:''}</div>`;
    });
    const t=typing[cid]; if(t && t.until>Date.now()) h+=`<div class="wa-msg in first"><div class="wa-bub typingdots"><i></i><i></i><i></i></div></div>`;
    return h;
  }
  const linkify = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br>');
  // tecken som ☀ ❤ ⭐ ritas annars ibland som gråa textsymboler – tvinga färgemoji (VS16)
  const asEmoji = e => /^[\u2190-\u2BFF\u3030\u303D\u3297\u3299]$/.test(e) ? e+'\uFE0F' : e;
  function emojiPickerHTML(){ const tabs=Object.keys(EMOJI_SETS); const cur=draft._et||tabs[0];
    return `<div class="wa-picker"><div class="wa-ptabs">${tabs.map(t=>`<button class="${t===cur?'on':''}" data-c="etab" data-t="${t}">${t}</button>`).join('')}</div><div class="wa-pgrid">${EMOJI_SETS[cur].split(' ').map(asEmoji).map(e=>`<button data-c="pick" data-e="${e}">${e}</button>`).join('')}</div></div>`; }

  /* ---------- uppdatering utan att tappa det man skriver ---------- */
  function refresh(){
    updateBadges();
    if(!vis()) return;
    const root=document.getElementById('chatRoot');
    if(!root){ const pn=document.getElementById('chatPanel'); if(pn){ pn.innerHTML=html(); mount(); } return; }
    if(!owner || (root.querySelector('.wa-setup') && ME)){ root.outerHTML=html(); mount(); return; }
    if(!ME){ root.innerHTML=`<div class="wa-setup">${setupHTML()}</div>`; return; }
    if(!document.getElementById('waSide')){ root.outerHTML=html(); mount(); return; }
    root.className=`wa t-${theme} ${openCid?'has-open':''} ${wide()?'wide':''}`;
    const side=document.getElementById('waSide'), st=side.querySelector('.wa-list')?.scrollTop||0; side.innerHTML=sideHTML(); const nl=side.querySelector('.wa-list'); if(nl) nl.scrollTop=st;
    const main=document.getElementById('waMain'), ta=document.getElementById('waText');
    const sameConv = main.dataset.cid===String(openCid) && ta && !!pickerOpen===!!main.querySelector('.wa-picker') && !!convs[openCid]?.request===!!main.querySelector('.wa-req') && !!(editing&&editing.cid===openCid)===!!main.querySelector('.wa-edit');
    if(sameConv){ refreshHead(); refreshMsgs(openCid); }
    else { main.innerHTML=mainHTML(); main.dataset.cid=openCid||''; scrollBottom(true); autoGrow(); }
  }
  function refreshHead(){ const s=document.getElementById('waStatus'); if(s && openCid) s.innerHTML=headStatus(openCid); }
  function refreshMsgs(cid){ if(cid!==openCid) return; const box=document.getElementById('waMsgs'); if(!box) return; const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80; box.innerHTML=msgsHTML(cid); if(atBottom) scrollBottom(); }
  function scrollBottom(instant){ const box=document.getElementById('waMsgs'); if(box) requestAnimationFrame(()=>{ box.scrollTop=box.scrollHeight; }); }
  function autoGrow(){ const ta=document.getElementById('waText'); if(!ta) return; ta.style.height='auto'; ta.style.height=Math.min(140,ta.scrollHeight)+'px'; }
  function mount(){ const main=document.getElementById('waMain'); if(main) main.dataset.cid=openCid||''; scrollBottom(true); autoGrow(); if(openCid) markRead(openCid); }
  function openConv(cid){ openCid=cid; pickerOpen=false; menuFor=null; editing=null; const c=conv(cid); c.unread=0; saveConvs(); if(vis()){ refresh(); markRead(cid); } }
  function openChat(cid){ closeModal(); openPanel(cid); }

  /* ---------- QR-verifiering (som i Threema: tre prickar) ---------- */
  const VL={1:{t:'Okänd nyckel',d:'Lades till via länk eller meddelande. Ingen har kontrollerat att nyckeln verkligen tillhör personen.'},
            2:{t:'Träffad i spel',d:'Ni har spelat online samtidigt. Bättre än en länk, men inte kontrollerat öga mot öga.'},
            3:{t:'Verifierad',d:'Du har skannat personens QR-kod öga mot öga. Nyckeln är garanterat rätt – ingen kan sitta emellan.'}};
  const vlOf = id => contacts[id]?.vl || (friends[id]?2:1);
  const vdots = id => { const l=vlOf(id); return `<span class="vdots v${l}" title="${VL[l].t}" aria-label="Verifiering: ${VL[l].t}"><i></i><i></i><i></i></span>`; };
  let qrLoading=null, scanStream=null, scanT=0;
  function loadQR(){ if(window.qrcode && window.jsQR) return Promise.resolve();
    if(!qrLoading) qrLoading=new Promise((res,rej)=>{ const sc=document.createElement('script'); sc.src='qr.js'; sc.onload=res; sc.onerror=()=>{ qrLoading=null; rej(new Error('qr')); }; document.head.appendChild(sc); });
    return qrLoading; }
  async function showMyQR(){
    try{ await loadQR(); }catch(e){ toast('QR-koden kunde inte laddas – har du internet? 📡',3500); return; }
    const q=qrcode(0,'M'); q.addData(cardLink(myCard()),'Byte'); q.make();
    openModal(`<h3>🔳 Min QR-kod</h3><p>Låt kompisen skanna koden med <b>📷 Skanna QR-kod</b> i sin chatt. Skanna sedan kompisens kod – då blir ni gröna hos varandra.</p>
      <div class="wa-qr">${q.createSvgTag({cellSize:5, margin:3, scalable:true})}</div>
      <div class="wa-qrname">${avatar(ME.emoji,ME.id,'sm')} <b>${esc(ME.name)}</b></div><div class="setnote" style="text-align:center">Chatt-ID ${ME.id.match(/.{4}/g).join(' ')}</div>
      <div class="btns"><button data-c="scanqr">📷 Skanna kompisens kod</button><button class="pri" data-c="scanstop">Klar</button></div>`,'myqr');
  }
  function stopScan(){ clearTimeout(scanT); if(scanStream){ scanStream.getTracks().forEach(t=>t.stop()); scanStream=null; } }
  async function showScanner(){
    stopScan();
    const bot=DEV && ld('botid',null);
    openModal(`<h3>📷 Skanna QR-kod</h3><p>Rikta kameran mot kompisens kod. Kompisen hittar sin kod under ⋮ i er chatt eller i sin profil.</p>
      <div class="wa-scan"><video id="qrVid" playsinline muted></video><div class="wa-scanbox"></div></div><p id="qrMsg" class="setnote" style="text-align:center">Startar kameran…</p>
      <div class="btns">${bot?'<button data-c="simbot">🤖 Låtsas skanna testkompisen</button>':''}<button data-c="scanstop">Avbryt</button></div>`,'scan');
    const say=t=>{ const el=document.getElementById('qrMsg'); if(el) el.textContent=t; };
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ say('Den här webbläsaren kan inte använda kameran här.'); return; }
    let det=null; try{ if('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) det=new BarcodeDetector({formats:['qr_code']}); }catch(e){}
    if(!det){ try{ await loadQR(); }catch(e){ say('Skannern kunde inte laddas – har du internet? 📡'); return; } }
    try{ scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false}); }
    catch(e){ say('Kameran gick inte att starta. Tillåt kameran för sidan i webbläsarens inställningar och försök igen.'); return; }
    const v=document.getElementById('qrVid'); if(!v){ stopScan(); return; }
    v.srcObject=scanStream; try{ await v.play(); }catch(e){}
    say('Letar efter en QR-kod…');
    const cv=document.createElement('canvas'), cx=cv.getContext('2d',{willReadFrequently:true});
    const tick=async()=>{
      const vv=document.getElementById('qrVid'); if(!vv || !scanStream){ stopScan(); return; }
      if(vv.readyState>=2 && vv.videoWidth){ let txt=null;
        try{ if(det){ const r=await det.detect(vv); if(r && r[0]) txt=r[0].rawValue; }
             else { const w=Math.min(720,vv.videoWidth), h=Math.round(vv.videoHeight*w/vv.videoWidth); cv.width=w; cv.height=h; cx.drawImage(vv,0,0,w,h); const r=jsQR(cx.getImageData(0,0,w,h).data,w,h,{inversionAttempts:'attemptBoth'}); if(r) txt=r.data; } }
        catch(e){ det=null; try{ await loadQR(); }catch(_){} }
        if(txt){ stopScan(); onScanText(txt); return; } }
      scanT=setTimeout(tick,160);
    };
    tick();
  }
  async function onScanText(txt){
    stopScan();
    const card=parseCardLink(txt);
    if(!card || !(await okCard(card))){ closeModal(); toast('Det där är ingen chattkod från Fröknarnas game board 🤔',3500); return; }
    if(card.id===ME.id){ closeModal(); toast('Det där är din egen kod 😄'); return; }
    await remember(card);
    addContact(card.id,3); contacts[card.id].vl=3; contacts[card.id].vAt=Date.now(); saveC();
    tone(660,.08,'sine',.08); tone(990,.12,'sine',.08,.09); buzz(30);
    const n=esc(nameOf(card.id));
    openModal(`<div style="text-align:center"><div class="vbig">${vdots(card.id)}</div><h3>✅ ${n} är verifierad</h3>
      <p>Nyckeln i koden stämmer med ${n}s chatt. Ingen kan sitta emellan er.</p><p class="setnote">Be ${n} skanna din kod också, så blir du grön hos ${n}.</p></div>
      <div class="btns"><button data-c="myqr">🔳 Visa min kod</button><button class="pri" data-c="openafter" data-id="${card.id}">Chatta</button></div>`,'verified');
    refresh();
  }

  /* ---------- meddelandeinfo ---------- */
  const fmtFull = t => t ? new Date(t).toLocaleString('sv-SE',{weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '–';
  const infoRow = (ic,label,t,note) => `<div class="wa-irow"><span class="ic">${ic}</span><span class="lb">${label}${note?`<small>${note}</small>`:''}</span><span class="tm">${t?fmtFull(t):'<em>inte än</em>'}</span></div>`;
  function showMsgInfo(cid, mid){
    const c=convs[cid], m=c && c.msgs.find(x=>x.mid===mid); if(!m) return; infoFor={cid,mid};
    let rows='';
    if(m.out){
      rows += infoRow('📝','Skrivet',m.ts);
      recipients(cid).forEach(id=>{
        const T=(m.stT||{})[id]||{}, st=(m.st||{})[id]||'queued';
        if(cid.startsWith('g:')) rows += `<div class="wa-isec">${avatar(emoOf(id),id,'sm')} ${esc(nameOf(id))}</div>`;
        rows += infoRow('<i class="tk">✓</i>','Skickat',T.sent, !T.sent && st==='queued' ? 'väntar på att mottagaren blir nåbar' : '');
        rows += infoRow('<i class="tk">✓✓</i>','Levererat',T.delivered);
        rows += infoRow('<i class="tk rd">✓✓</i>','Läst',T.read);
      });
    } else {
      rows += infoRow('📤',`Skickat av ${esc(nameOf(m.from))}`,m.ts,'enligt avsändarens klocka');
      rows += infoRow('📥','Mottaget',m.rcv);
      rows += infoRow('👀','Läst av dig',m.readAt);
    }
    if(m.edited) rows += infoRow('✏️','Redigerat',m.edited);
    if(m.revoked) rows += infoRow('🚫','Borttaget för alla',m.revokedAt);
    if(m.expireAt) rows += infoRow('⏱','Försvinner',m.expireAt);
    const body = m.revoked ? `<i>🚫 ${m.out?'Du tog bort det här meddelandet':'Det här meddelandet togs bort'}</i>` : m.invite ? `${m.invite.icon||'🎮'} Inbjudan: ${esc(m.invite.gname)}` : linkify(m.text);
    openModal(`<h3>ℹ️ Meddelandeinfo</h3><div class="wa-ibub ${m.out?'out':''}">${body}</div><div class="wa-irows">${rows}</div>
      <div class="setnote">Tiderna uppdateras medan rutan är öppen. Tider från andra enheter följer deras klocka.</div>
      <div class="btns"><button class="pri" data-act="close">Klar</button></div>`,'msginfo');
  }
  function infoLive(cid,mid){ if(!infoFor || infoFor.cid!==cid || infoFor.mid!==mid) return; const md=document.getElementById('modal'); if(md && md.classList.contains('show') && md.querySelector('.wa-irows')) showMsgInfo(cid,mid); else infoFor=null; }

  /* =====================================================================
     TESTKOMPIS (bara i dev): en riktig andra chattklient i en osynlig ram,
     med egna nycklar. Allt går genom samma kryptering som mellan två mobiler,
     men transporten är postMessage i stället för internet.
     ===================================================================== */
  let botFrame=null, botLink=null;
  const parentLink = BOTMODE ? {open:true,_local:true,send:s=>{ if(botDown) return; window.parent.postMessage({fl:'link',d:s},location.origin); },close(){}} : null;
  function spawnBot(first){
    if(BOTMODE || !DEV || !ME || botFrame) return;
    sv('bot',true);
    botLink={open:false,_local:true,send:s=>{ try{ botFrame.contentWindow.postMessage({fl:'link',d:s},location.origin); }catch(e){} },close(){}};
    botFrame=document.createElement('iframe'); botFrame.src=location.pathname+'?bot=1'; botFrame.setAttribute('aria-hidden','true'); botFrame.tabIndex=-1;
    botFrame.style.cssText='position:fixed;left:-20px;top:-20px;width:1px;height:1px;opacity:0;pointer-events:none;border:0';
    document.body.appendChild(botFrame);
    if(first){ botFirst=true; toast('Testkompisen startar… 🤖',2500); }
  }
  let botFirst=false;
  function removeBot(){
    const id=ld('botid',null); closeModal();
    if(botFrame){ botFrame.remove(); botFrame=null; } if(id){ conns.delete(id); delete contacts[id]; delete known[id]; delete friends[id]; delete convs['d:'+id]; delete SESS[id]; outbox=outbox.filter(o=>o.to!==id);
      Object.values(GROUPS).forEach(g=>{ if(g.members.includes(id) && g.admin===ME.id) updateGroupMembers(g.id, g.members.filter(x=>x!==id)); }); }
    try{ Object.keys(localStorage).filter(k=>k.startsWith('dev:bot:')).forEach(k=>localStorage.removeItem(k)); }catch(e){}
    sv('bot',false); sv('botid',null); saveC(); saveS(); saveConvs(); openCid=null; refresh(); toast('Testkompisen är borttagen');
  }
  window.addEventListener('message',async e=>{
    if(e.origin!==location.origin || !e.data || !e.data.fl) return;
    if(BOTMODE){ if(e.source!==window.parent || botDown) return; if(e.data.fl==='link'){ try{ onData(parentLink, JSON.parse(e.data.d)); }catch(_){} } return; }
    if(!botFrame || e.source!==botFrame.contentWindow) return;
    if(e.data.fl==='ready'){
      const card=e.data.card; if(!(await okCard(card))) return;
      await remember(card); sv('botid',card.id); known[card.id].bot=true;
      if(!contacts[card.id]){ contacts[card.id]={...normCard(card), added:Date.now(), bot:true, vl:1}; delete friends[card.id]; }
      saveC(); botLink.open=true;
      sendRaw(botLink,{t:'hi',card:myCard(),n:'lokal'});
      await onData(botLink,{t:'hi',card});
      if(botFirst){ botFirst=false; openChat('d:'+card.id); }
    } else if(e.data.fl==='link'){ try{ onData(botLink, JSON.parse(e.data.d)); }catch(_){} }
    else if(e.data.fl==='down'){ botLink.open=false; const id=botLink._id; if(id && conns.get(id)===botLink){ conns.delete(id); lastSeen[id]=Date.now(); sv('lastseen',lastSeen); if(vis()) refresh(); } }
  });
  // ---- testkompisens eget beteende (körs inne i ramen) ----
  let botDown=false, botQuiet=ld('botquiet',false);
  const pick = a => a[rint(a.length)];
  const BOT_HELP = `Jag är din testkompis 🤖 Skriv:
• ändra – jag skickar ett meddelande och ändrar det
• ångra – jag skickar ett meddelande och tar bort det för alla
• hjärta – jag reagerar på ditt meddelande
• offline – jag är borta i 20 sekunder (då ser du 🕓 och ✓)
• läs inte – jag läser inte ditt nästa meddelande på 15 sek
• fem – jag skickar fem meddelanden i rad
• tyst / prata – jag slutar eller börjar svara
Ändrar eller tar du bort ett av dina meddelanden så märker jag det 👀`;
  function botReady(){ window.parent.postMessage({fl:'ready', card:myCard()}, location.origin); }
  async function botBoot(){ if(!ME) await createIdentity('Testkompis','🤖'); botReady(); }
  function botSay(cid, text, delay){ return new Promise(res=>{
    const k=cid.startsWith('g:')?cid:'dm';
    setTimeout(()=>{ if(botDown) return res(null); recipients(cid).forEach(id=>sendRaw(conns.get(id),{t:'typing', conv:k}));
      setTimeout(()=>{ if(botDown) return res(null); sendMsg(cid,text); const c=convs[cid]; res(c.msgs[c.msgs.length-1]); }, 700+Math.min(2200,text.length*35)); }, delay||400);
  }); }
  let botNoRead=0;
  function botOnMsg(cid, from, m, gid){
    // läskvitto efter en liten stund, som en människa
    const readIn = Date.now()<botNoRead ? 15000 : 900+rint(900);
    setTimeout(()=>{ if(botDown) return; m.readAt=Date.now(); m.readSent=true; const c=convs[cid]; if(c) c.unread=0; saveConvs(); sendReceipt(from,[m.mid],'read',gid); }, readIn);
    const t=(m.text||'').trim().toLowerCase();
    if(t==='prata'){ botQuiet=false; sv('botquiet',false); botSay(cid,'Nu pratar jag igen! 😄',readIn); return; }
    if(botQuiet) return;
    if(m.invite){ botSay(cid,`Jag kan tyvärr inte spela ${m.invite.gname} – jag är bara en testbot 🤖🎮 Bjud in en riktig kompis!`,readIn); return; }
    if(/^(hjälp|help|\?)$/.test(t)){ botSay(cid,BOT_HELP,readIn); return; }
    if(t==='tyst'){ botSay(cid,'Okej, jag är tyst nu 🤐 Skriv prata när du vill höra av mig igen.',readIn).then(()=>{ botQuiet=true; sv('botquiet',true); }); return; }
    if(t==='ändra'){ botSay(cid,'Det här meddelandet kommer att ändras om en stund… ⏳',readIn).then(bm=>{ if(bm) setTimeout(()=>editMsg(cid,bm.mid,'✏️ Tadaa, nu är jag ändrat! Tryck länge och välj Info för att se när.'),3000); }); return; }
    if(t==='ångra' || t==='angra'){ botSay(cid,'Hemligt meddelande som snart försvinner 👻',readIn).then(bm=>{ if(bm) setTimeout(()=>revokeMsg(cid,bm.mid),3500); }); return; }
    if(t==='hjärta' || t==='hjarta'){ setTimeout(()=>react(cid,m.mid,'❤️'),readIn+300); return; }
    if(t==='fem'){ (async()=>{ for(let i=1;i<=5;i++) await botSay(cid,['Ett 🐬','Två 🐬🐬','Tre 🐬🐬🐬','Fyra 🐬🐬🐬🐬','Fem! 🐬🐬🐬🐬🐬'][i-1], i===1?readIn:150); })(); return; }
    if(t==='läs inte' || t==='las inte'){ botNoRead=Date.now()+20000; botSay(cid,'Okej, jag blundar för ditt nästa meddelande en stund 🙈 (du ser grå bockar ✓✓ i 15 sek innan de blir blå)',readIn); return; }
    if(t==='offline'){ botSay(cid,'Hejdå! Jag är tillbaka om 20 sekunder 👋',readIn).then(()=>setTimeout(()=>{
        botDown=true; window.parent.postMessage({fl:'down'},location.origin); for(const [k,v] of conns) if(v===parentLink) conns.delete(k);
        setTimeout(()=>{ botDown=false; botReady(); setTimeout(()=>{ botSay(cid,'Jag är tillbaka! 🙌 Kolla bockarna på det du skrev medan jag var borta.',200); },800); },20000);
      },600)); return; }
    if(rint(5)===0 && !gid) setTimeout(()=>react(cid,m.mid,pick(['❤️','😂','👍','😮'])),readIn+200);
    botSay(cid, botAnswer(t, m.text||''), readIn);
  }
  function botAnswer(t, raw){
    if(/^\p{Extended_Pictographic}/u.test(raw) && raw.length<=12) return raw+raw.slice(0,2);
    if(/^(hej|hallå|halla|tja|tjena|hejsan|hejhej|god morgon|godmorgon|yo)/.test(t)) return pick(['Hej hej! 👋 Skriv hjälp så ser du vad jag kan testa.','Hallå där! 🐬','Tjenare! 😎']);
    if(/mår|hur är det/.test(t)) return pick(['Jag mår toppen, jag är ju en robot 🤖 Hur mår du?','Prima! Batteriet är fullt 🔋 Och du?']);
    if(/delfin/.test(t)) return 'Delfiner är världens bästa djur 🐬💙';
    if(/tack/.test(t)) return pick(['Varsågod! 😊','Ingen orsak 🤖💙']);
    if(/\?$/.test(t)) return pick(['Bra fråga! 🤔','Hmm… jag tror ja! 👍','Kanske? 🙃','Det får du fråga en människa 😄']);
    return pick(['Coolt! 😎','Haha 😂','Berätta mer! 👀','Jag förstår 🤖','Oj! 😮','Vad kul! 🎉','Mm 🐬']);
  }
  function botOnChange(cid,m,p){
    if(botQuiet) return;
    if(p.type==='edit') botSay(cid,`✏️ Jag såg att du ändrade till: ”${m.text.slice(0,80)}”`,900);
    else botSay(cid,'👀 Där försvann ett meddelande!',900);
  }

  /* =====================================================================
     SIDOPANEL + EGET FÖNSTER
     ===================================================================== */
  const wide = () => CHATWIN && window.innerWidth>=820;
  const dockable = () => !CHATWIN && window.innerWidth>=1100 && window.innerHeight>=520;
  let popupWin=null, chatHist=false;
  function buildChrome(){
    if(BOTMODE || document.getElementById('chatPanel')) return;
    const tab=document.createElement('button'); tab.id='chatTab'; tab.className='chat-tab'; tab.dataset.c='toggle'; tab.setAttribute('aria-label','Chatt');
    tab.innerHTML='💬<i class="cbadge" data-cbadge></i>';
    const pn=document.createElement('aside'); pn.id='chatPanel'; pn.className='chat-panel'; pn.setAttribute('aria-label','Chatt');
    document.body.append(tab,pn);
    if(CHATWIN){ document.body.classList.add('chatwin'); document.title='💬 Chatt · Fröknarna Leins'; panelOpen=true; pn.classList.add('open'); pn.innerHTML=html(); mount(); }
    updateBadges();
  }
  function setDock(){
    const was=document.body.classList.contains('chatdock'), now=panelOpen && dockable();
    document.body.classList.toggle('chatdock', now); document.body.classList.toggle('chatopen', panelOpen && !CHATWIN);
    if(was!==now) window.dispatchEvent(new Event('resize'));          // spelet räknar om sin layout
  }
  function openPanel(cid){
    buildChrome();
    if(cid){ openCid=cid; conv(cid); pickerOpen=false; menuFor=null; editing=null; }
    const pn=document.getElementById('chatPanel');
    if(!panelOpen){
      panelOpen=true;
      if(typeof spOpen!=='undefined' && spOpen && typeof spToggle==='function') spToggle(false);
      if(!dockable() && !CHATWIN){ try{ history.pushState({flchat:1},''); chatHist=true; }catch(e){} }   // mobilens bakåtknapp stänger chatten
    }
    pn.classList.add('open'); setDock(); fitViewport();
    pn.innerHTML=html(); mount();
    if(openCid && convs[openCid]){ convs[openCid].unread=0; markRead(openCid); }
    updateBadges();
  }
  function closePanel(fromPop){
    if(CHATWIN || !panelOpen) return;
    panelOpen=false; stopScan(); if(document.getElementById('modal')?.classList.contains('show')) closeModal();
    const pn=document.getElementById('chatPanel'); if(pn){ pn.classList.remove('open'); setTimeout(()=>{ if(!panelOpen) pn.innerHTML=''; },380); }
    setDock();
    if(chatHist && !fromPop){ chatHist=false; try{ if(history.state && history.state.flchat) history.back(); }catch(e){} } else chatHist=false;
    if(typeof render==='function' && view==='lobby') render();
  }
  window.addEventListener('popstate',()=>{ if(panelOpen && !CHATWIN){ chatHist=false; closePanel(true); } });
  window.addEventListener('resize',()=>{ if(BOTMODE) return; if(panelOpen) setDock(); const r=document.getElementById('chatRoot'); if(r && CHATWIN) r.classList.toggle('wide', wide()); });
  // Mobilens tangentbord: håll inmatningsrutan ovanför tangentbordet (VisualViewport)
  function fitViewport(){
    const vv=window.visualViewport, pn=document.getElementById('chatPanel'); if(!vv || !pn) return;
    if(window.innerWidth>=700 && !CHATWIN){ pn.style.height=''; pn.style.top=''; return; }
    pn.style.top=vv.offsetTop+'px'; pn.style.height=vv.height+'px'; pn.style.bottom='auto';
    if(document.activeElement && document.activeElement.id==='waText') scrollBottom();
  }
  if(window.visualViewport){ visualViewport.addEventListener('resize',fitViewport); visualViewport.addEventListener('scroll',fitViewport); }
  function updateBadges(){ if(BOTMODE) return; const n=totalUnread(); document.querySelectorAll('[data-cbadge]').forEach(el=>{ el.textContent=n?String(n>99?'99+':n):''; el.classList.toggle('on',n>0); }); }
  setInterval(updateBadges,1500);
  function popout(){
    const w=window.open(location.pathname+'?chat=1','flchat','popup=yes,width=460,height=820');
    if(!w){ toast('Webbläsaren stoppade fönstret – tillåt popup-fönster för sidan 🙏',4000); return; }
    popupWin=w; closePanel(); toast('Chatten öppnas i ett eget fönster 💬',2500);
  }

  // ---- bara EN flik i taget driver chatten (Web Locks) ----
  const LOCK='fl-chat-engine:'+(typeof LSP!=='undefined'?LSP:'');
  let waiting=false;
  function setOwner(o){
    if(o===owner) return;
    owner=o;
    if(!o){
      try{ if(cpeer) cpeer.destroy(); }catch(e){} cpeer=null; conns.clear(); connecting.clear();
      if(botFrame){ botFrame.remove(); botFrame=null; }
    } else {
      reloadAll(); if(ME){ startTransport(); if(DEV && ld('bot',false)) spawnBot(false); }
    }
    if(vis()){ const pn=document.getElementById('chatPanel'); if(pn){ pn.innerHTML=html(); mount(); } }
    updateBadges();
  }
  function reloadAll(){
    ME=ld('me',null); contacts=ld('contacts',{}); known=ld('known',{}); friends=ld('friends',{}); blocked=ld('blocked',[]);
    SESS=ld('sess',{}); GROUPS=ld('groups',{}); SKEYS=ld('skeys',{}); convs=ld('convs',{}); outbox=ld('outbox',[]); relayQ=ld('relay',[]);
    seen=new Set(ld('seen',[])); orphans=ld('orph',{}); kc.clear(); locks.clear(); skLock.clear();
  }
  const hold = () => new Promise(()=>{});                       // låset hålls tills fliken stängs eller någon tar över
  function waitTurn(){ if(waiting) return; waiting=true;
    navigator.locks.request(LOCK, ()=>{ waiting=false; setOwner(true); return hold(); }).catch(()=>{ waiting=false; setOwner(false); waitTurn(); }); }
  function claim(steal){
    if(BOTMODE || !navigator.locks){ owner=true; return; }
    navigator.locks.request(LOCK, steal?{steal:true}:{ifAvailable:true}, lock=>{
      if(!lock){ setOwner(false); waitTurn(); return; }
      setOwner(true); return hold();
    }).catch(()=>{ setOwner(false); waitTurn(); });      // någon annan tog över (AbortError)
  }
  // passiv flik: håll olästa-märket aktuellt och säg till om nya meddelanden
  window.addEventListener('storage',e=>{
    if(owner || BOTMODE || e.key!==LSP+NS+'convs') return;
    const before=totalUnread(); try{ convs=JSON.parse(e.newValue)||{}; }catch(_){ return; }
    const after=totalUnread(); updateBadges();
    if(after>before) notice({icon:'💬', title:'Nytt chattmeddelande', text:'Det finns i chattfönstret', actions:[{label:'Visa', run:()=>{ if(popupWin && !popupWin.closed) popupWin.focus(); else openPanel(); }}], ms:7000});
  });

  /* ---------- modaler ---------- */
  function showProfile(){
    openModal(`<h3>${esc(ME.emoji)} Din profil</h3><label>Namn</label><input id="pfName" maxlength="20" value="${esc(ME.name)}">
      <label>Profilbild</label><div class="wa-emos">${EMO.map(e=>`<button data-c="pfemo" data-e="${e}" class="${e===ME.emoji?'sel':''}">${e}</button>`).join('')}</div>
      <div class="setnote" style="margin-top:12px">Ditt chatt-ID: <b>${ME.id}</b> · kryptering ${ME.curve}</div>
      <div class="chips" style="margin-top:10px"><button data-c="myqr">🔳 Visa min QR-kod</button></div>
      <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-c="pfsave">Spara</button></div>`,'chatprof');
  }
  function showThemes(cid){
    const cur = cid ? (convs[cid].theme||'') : theme;
    openModal(`<h3>🎨 ${cid?'Tema för den här chatten':'Chattema'}</h3><div class="wa-themes">${cid?`<button data-c="settheme" data-t="" data-cid="${cid}" class="${!cur?'sel':''}"><span class="sw t-${theme}"></span>Samma som alla</button>`:''}
      ${Object.entries(THEMES).map(([k,l])=>`<button data-c="settheme" data-t="${k}" data-cid="${cid||''}" class="${cur===k?'sel':''}"><span class="sw t-${k}"><i></i><i></i></span>${l}</button>`).join('')}</div>
      <div class="btns"><button class="pri" data-act="close">Klar</button></div>`,'chattheme');
  }
  async function showInfo(cid){
    const c=convs[cid], g=cid.startsWith('g:')?GROUPS[cid.slice(2)]:null, peer=peerOfConv(cid);
    const safety = peer ? await safetyNumber(peer) : '';
    openModal(`<div style="text-align:center">${convAvatar(cid,'xl')}<h3 style="margin:8px 0 2px">${esc(convTitle(cid))}</h3><p>${g?`Grupp · ${g.members.length} medlemmar`:conns.has(peer)?'online':'🔒 krypterad'}</p></div>
      <label>⏱ Försvinnande meddelanden</label><div class="chips">${TIMERS.map(([s,l])=>`<button data-c="timer" data-s="${s}" data-cid="${cid}" class="${(c.timer||0)===s?'sel':''}">${l}</button>`).join('')}</div>
      <label>🎨 Tema</label><div class="chips"><button data-c="themefor" data-cid="${cid}">Välj tema för chatten</button></div>
      ${g?`<label>👥 Medlemmar</label><div class="wa-mem">${g.members.map(id=>`<span>${avatar(emoOf(id),id,'sm')} ${esc(nameOf(id))}${id!==ME.id?vdots(id):''}${id===g.admin?' <em>admin</em>':''}</span>`).join('')}</div>
         ${g.admin===ME.id?`<div class="chips" style="margin-top:8px"><button data-c="editmembers" data-gid="${g.id}">✏️ Ändra medlemmar</button></div>`:''}`:''}
      ${peer?`<label>🔐 Verifiering</label><div class="wa-ver"><div class="vbig">${vdots(peer)}</div><div><b>${VL[vlOf(peer)].t}</b><small>${VL[vlOf(peer)].d}${contacts[peer]?.vAt?` Verifierad ${fmtFull(contacts[peer].vAt)}.`:''}</small></div></div>
        <div class="chips">${vlOf(peer)<3?'<button data-c="scanqr">📷 Skanna kompisens kod</button>':''}<button data-c="myqr">🔳 Visa min kod</button></div>`:''}
      ${peer?`<label>🔐 Säkerhetsnummer</label><div class="wa-safety">${safety}</div><div class="setnote">Jämför numret med ${esc(nameOf(peer))}s skärm när ni ses. Är de lika vet ni att ingen sitter emellan.</div>`:''}
      <div class="btns" style="flex-wrap:wrap"><button data-c="clear" data-cid="${cid}">🧹 Rensa chatten</button>${g?`<button data-c="leave" data-gid="${g.id}">🚪 Lämna gruppen</button>`: peer===ld('botid',null) ? `<button data-c="rmbot">🗑 Ta bort testkompisen</button>` : `<button data-c="block" data-id="${peer}">⛔ Blockera</button>`}<button class="pri" data-act="close">Klar</button></div>`,'chatinfo');
  }
  function showNewGroup(gid){
    const g=gid?GROUPS[gid]:null, sel=new Set(g?g.members:[]);
    const cs=Object.values(contacts);
    if(!cs.length){ toast('Lägg till kontakter först – spela med någon eller dela din kontaktlänk 👥',4000); return; }
    openModal(`<h3>👥 ${g?'Ändra medlemmar':'Ny grupp'}</h3>${g?'':`<label>Gruppnamn</label><input id="gName" maxlength="40" placeholder="t.ex. Fröknarna 💖">
      <label>Gruppbild</label><div class="wa-emos" id="gEmos">${['👥','💖','🐬','🐆','⛷️','🎮','🌈','🚀','🦄','⭐'].map((e,i)=>`<button data-c="gemo" data-e="${e}" class="${i===0?'sel':''}">${e}</button>`).join('')}</div>`}
      <label>Välj medlemmar</label><div class="wa-pick">${cs.map(c=>`<label class="wa-chk"><input type="checkbox" value="${c.id}" ${sel.has(c.id)?'checked':''}>${avatar(c.emoji,c.id,'sm')} ${esc(nameOf(c.id))}</label>`).join('')}</div>
      <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-c="${g?'savemembers':'mkgroup'}" data-gid="${gid||''}">${g?'Spara':'Skapa grupp'}</button></div>`,'chatgroup');
  }
  function showInvite(cid){
    openModal(`<h3>🎮 Bjud in till spel</h3><p>Ett onlinespel skapas och ${cid.startsWith('g:')?'gruppen':esc(nameOf(peerOfConv(cid)))} får en inbjudan med en knapp för att gå med.</p>
      <div class="wa-games">${GAMES.map(([k,i,n])=>`<button data-c="invitegame" data-k="${k}" data-cid="${cid}"><span>${i}</span>${n}${k==='yatzy'?'<small>2–4 spelare</small>':k==='kina'?'<small>2–6 spelare</small>':'<small>2 spelare</small>'}</button>`).join('')}</div>
      <div class="btns"><button data-act="close">Avbryt</button></div>`,'chatinv');
  }
  const cardLink = card => location.origin+location.pathname+'#k='+btoa(unescape(encodeURIComponent(JSON.stringify(normCard(card))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  function parseCardLink(t){ const m=/#k=([A-Za-z0-9+/_-]{20,800})$/.exec(String(t||'').trim()); if(!m) return null;
    try{ const j=JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g,'+').replace(/_/g,'/'))))); return j && typeof j==='object' ? j : null; }catch(e){ return null; } }
  async function shareCard(){
    const link=cardLink(myCard());
    const text=`Lägg till mig i Fröknarnas chatt! ${ME.emoji}`;
    try{ if(navigator.share){ await navigator.share({title:'Min chattkontakt', text, url:link}); return; } }catch(e){ if(e && e.name==='AbortError') return; }
    try{ await navigator.clipboard.writeText(text+' '+link); toast('Länken är kopierad – skicka den till din kompis 📋',3500); }catch(e){ toast(link,8000); }
  }
  async function handleHash(){
    if(!/#k=/.test(location.hash)) return;
    const card=parseCardLink(location.hash);
    try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
    if(!(await okCard(card))){ toast('Kontaktlänken verkar trasig 😕'); return; }
    if(!ME){ toast('Starta chatten först – sedan kan du öppna länken igen 💬',4000); return; }
    if(card.id===ME.id){ toast('Det där är din egen kontakt 😄'); return; }
    await remember(card);
    openModal(`<div style="text-align:center">${avatar(card.emoji,card.id,'xl')}<h3>Lägg till ${esc(card.name)}?</h3><p>Du får en krypterad chatt med ${esc(card.name)}.</p></div>
      <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-c="addc" data-id="${card.id}" data-open="1">Lägg till och chatta</button></div>`,'chatadd');
  }
  window.addEventListener('hashchange',handleHash);

  /* ---------- händelser ---------- */
  let typingT=0;
  // trycker man i textrutan stängs emojiväljaren (tangentbordet tar dess plats)
  document.addEventListener('focusin',e=>{ if(e.target.id==='waText' && pickerOpen && !FINE_PTR){ pickerOpen=false; refresh(); setTimeout(()=>{ document.getElementById('waText')?.focus(); scrollBottom(); },30); } });
  document.addEventListener('input',e=>{
    if(e.target.id!=='waText' || !openCid) return; draft[openCid]=e.target.value; autoGrow();
    if(Date.now()-typingT>2500){ typingT=Date.now(); const k=openCid.startsWith('g:')?openCid:'dm'; recipients(openCid).forEach(id=>sendRaw(conns.get(id),{t:'typing', conv:k})); }
  });
  document.addEventListener('keydown',e=>{
    if(e.target.id==='waText' && e.key==='Enter' && !e.shiftKey && FINE_PTR){ e.preventDefault(); doSend(); }
    if(vis() && e.key==='Escape' && !document.getElementById('modal')?.classList.contains('show') && !editing && !menuFor && !pickerOpen && !CHATWIN && !(e.target.closest && e.target.closest('input,textarea'))){ closePanel(); return; }
    if(vis() && e.key==='Escape'){ if(editing){ cancelEdit(); } else if(menuFor){ menuFor=null; refreshMsgs(openCid); } else if(pickerOpen){ pickerOpen=false; refresh(); } }
  });
  function doSend(){ const ta=document.getElementById('waText'); if(!ta || !openCid) return; const t=ta.value; if(!t.trim()) return;
    ta.value=''; draft[openCid]=''; autoGrow();
    if(editing && editing.cid===openCid){ const e=editing; editing=null; editMsg(e.cid,e.mid,t); refresh(); }
    else sendMsg(openCid,t);
    document.getElementById('waText')?.focus(); }
  function startEdit(mid){ const m=convs[openCid]?.msgs.find(x=>x.mid===mid); if(!m) return; editing={cid:openCid, mid}; menuFor=null; draft[openCid]=m.text; pickerOpen=false;
    const main=document.getElementById('waMain'); if(main) main.dataset.cid='x'; refresh();
    const ta=document.getElementById('waText'); if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); } }
  function cancelEdit(){ if(!editing) return; draft[editing.cid]=''; editing=null; const main=document.getElementById('waMain'); if(main) main.dataset.cid='x'; refresh(); }
  // långt tryck på en bubbla öppnar reaktioner
  let pressT=0, pressMid=null;
  document.addEventListener('pointerdown',e=>{ const b=e.target.closest('.wa-msg .wa-bub'); if(!b || !vis()) return; pressMid=b.parentElement.dataset.mid; clearTimeout(pressT); pressT=setTimeout(()=>{ menuFor=pressMid; buzz(15); refreshMsgs(openCid); },450); });
  ['pointerup','pointercancel','pointermove'].forEach(t=>document.addEventListener(t,e=>{ if(t==='pointermove' && Math.abs(e.movementY)<4) return; clearTimeout(pressT); }));
  document.addEventListener('contextmenu',e=>{ const b=e.target.closest('.wa-msg .wa-bub'); if(!b) return; e.preventDefault(); menuFor=b.parentElement.dataset.mid; refreshMsgs(openCid); });
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-c]');
    if(vis() && menuFor && !e.target.closest('.wa-menu')){ menuFor=null; refreshMsgs(openCid); if(!b) return; }
    if(!b) return; const a=b.dataset.c; unlockAudio();
    switch(a){
      case 'emo': case 'pfemo': case 'gemo': b.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); break;
      case 'create': { if(!owner){ toast('Chatten är aktiv i ett annat fönster'); break; } const n=(document.getElementById('waName')?.value||'').trim(); if(!n){ toast('Skriv ditt namn 💬'); return; } const em=document.querySelector('.wa-emos .sel')?.dataset.e;
        b.disabled=true; b.textContent='Skapar nycklar…'; try{ await createIdentity(n,em); lsSet('ry_name',n); startTransport(); refresh(); toast('Klart! Dina nycklar finns bara på den här enheten 🔐',3500); }catch(err){ toast('Kunde inte skapa nycklar: '+err.message,5000); b.disabled=false; } break; }
      case 'tab': tab=b.dataset.t; refresh(); break;
      case 'open': openConv(b.dataset.id); break;
      case 'opendm': openConv('d:'+b.dataset.id); break;
      case 'close': openCid=null; editing=null; refresh(); break;
      case 'send': doSend(); break;
      case 'emoji': { pickerOpen=!pickerOpen; const ta=document.getElementById('waText');
        if(pickerOpen){ ta && ta.blur(); refresh(); } else { refresh(); document.getElementById('waText')?.focus(); }
        setTimeout(()=>scrollBottom(),60); break; }
      case 'etab': { draft._et=b.dataset.t; const pk=document.querySelector('#chatPanel .wa-picker'); if(pk) pk.outerHTML=emojiPickerHTML(); else refresh(); break; }
      case 'pick': { const ta=document.getElementById('waText'); if(ta){ const s=ta.selectionStart??ta.value.length; ta.value=ta.value.slice(0,s)+b.dataset.e+ta.value.slice(ta.selectionEnd??s); draft[openCid]=ta.value; autoGrow(); } break; }
      case 'react': react(openCid, b.dataset.mid, b.dataset.e); menuFor=null; refreshMsgs(openCid); break;
      case 'copy': { const m=convs[openCid]?.msgs.find(x=>x.mid===b.dataset.mid); try{ await navigator.clipboard.writeText(m?.text||''); toast('Kopierat 📋'); }catch(_){} menuFor=null; refreshMsgs(openCid); break; }
      case 'toggle': panelOpen ? closePanel() : openPanel(); break;
      case 'hide': closePanel(); break;
      case 'popout': popout(); break;
      case 'steal': claim(true); break;
      case 'focuspop': if(popupWin && !popupWin.closed) popupWin.focus(); break;
      case 'myqr': stopScan(); showMyQR(); break;
      case 'scanqr': showScanner(); break;
      case 'scanstop': stopScan(); closeModal(); break;
      case 'simbot': { const c=cardOf(ld('botid',null)); if(c) onScanText(cardLink(c)); break; }
      case 'openafter': closeModal(); openChat('d:'+b.dataset.id); break;
      case 'edit': startEdit(b.dataset.mid); break;
      case 'canceledit': cancelEdit(); break;
      case 'revoke': revokeMsg(openCid, b.dataset.mid); menuFor=null; refreshMsgs(openCid); toast('Meddelandet togs bort för alla 🚫'); break;
      case 'minfo': menuFor=null; refreshMsgs(openCid); showMsgInfo(openCid, b.dataset.mid); break;
      case 'mkbot': spawnBot(true); break;
      case 'rmbot': removeBot(); break;
      case 'delme': { const c=convs[openCid]; if(c){ c.msgs=c.msgs.filter(x=>x.mid!==b.dataset.mid); saveConvs(); } menuFor=null; refreshMsgs(openCid); break; }
      case 'theme': showThemes(null); break;
      case 'themefor': showThemes(b.dataset.cid); break;
      case 'settheme': { const cid=b.dataset.cid; if(cid){ convs[cid].theme=b.dataset.t||null; saveConvs(); } else { theme=b.dataset.t; lsSet('chat_theme',theme); } showThemes(cid||null); const r=document.getElementById('waMain'); if(r) r.dataset.cid='x'; refresh(); break; }
      case 'profile': showProfile(); break;
      case 'pfsave': { const n=(document.getElementById('pfName')?.value||'').trim()||ME.name, em=document.querySelector('.wa-emos .sel')?.dataset.e||ME.emoji; ME.name=n; ME.emoji=em; sv('me',ME);
        Object.keys(contacts).forEach(id=>queueDirect(id,{type:'profile', name:n, emoji:em},true)); closeModal(); refresh(); toast('Profilen är sparad'); break; }
      case 'info': showInfo(openCid); break;
      case 'safety': { const p=peerOfConv(openCid); if(p) showInfo(openCid); break; }
      case 'timer': setTimer(b.dataset.cid, +b.dataset.s); showInfo(b.dataset.cid); break;
      case 'clear': { const c=convs[b.dataset.cid]; if(c){ c.msgs=[]; saveConvs(); } closeModal(); refresh(); break; }
      case 'addc': { addContact(b.dataset.id); toast(`${nameOf(b.dataset.id)} är nu en kontakt 💚`); if(b.dataset.open){ closeModal(); openChat('d:'+b.dataset.id); } break; }
      case 'block': { block(b.dataset.id); closeModal(); openCid=null; refresh(); toast('Blockerad ⛔'); break; }
      case 'newgroup': showNewGroup(null); break;
      case 'editmembers': showNewGroup(b.dataset.gid); break;
      case 'mkgroup': { const n=(document.getElementById('gName')?.value||'').trim(); const em=document.querySelector('#gEmos .sel')?.dataset.e||'👥'; const ids=[...document.querySelectorAll('.wa-pick input:checked')].map(x=>x.value);
        if(!n){ toast('Ge gruppen ett namn ✏️'); return; } if(!ids.length){ toast('Välj minst en medlem 👥'); return; } closeModal(); createGroup(n,em,ids); break; }
      case 'savemembers': { const ids=[...document.querySelectorAll('.wa-pick input:checked')].map(x=>x.value); closeModal(); updateGroupMembers(b.dataset.gid, ids); break; }
      case 'leave': closeModal(); leaveGroup(b.dataset.gid); toast('Du lämnade gruppen'); break;
      case 'sharecard': shareCard(); break;
      case 'invite': showInvite(openCid); break;
      case 'invitegame': inviteToGame(b.dataset.cid, b.dataset.k); break;
      case 'join': { const code=String(b.dataset.code||''); if(!/^[A-Z0-9]{4}$/.test(code)) break; const name=lsGet('ry_name')||ME.name; joinGame(code, name); break; }
    }
  });

  /* ---------- start ---------- */
  function boot(){
    if(BOTMODE){ botBoot(); return; }
    buildChrome();
    if(navigator.locks){ owner=false; claim(CHATWIN); }          // låset avgör vem som startar nätverket
    else if(ME){ startTransport(); if(DEV && ld('bot',false)) spawnBot(false); }
    handleHash();
  }
  setTimeout(boot, 300);
  return {
    frBroadcast:m=>{ if(!owner) return; for(const c of conns.values()) if(!c._local) sendRaw(c,m); },
    bridgeIn:env=>{ if(owner && ME && env && typeof env==='object' && env.to===ME.id) receiveEnv(env,null); },
    myId:()=>ME && ME.id,
    html, mount, refresh, open:()=>openPanel(), openChat, close:()=>closePanel(), isOpen:()=>panelOpen, docked:()=>panelOpen && dockable(), seenCards, card:()=>myCard(), unread:totalUnread,
    hasIdentity:()=>!!ME,
    // bara i testversionen: krokar för automatiska säkerhetstester
    __test: DEV ? {queueDirect, conns:()=>[...conns.keys()], typing:()=>({...typing}), groups:()=>GROUPS, convs:()=>convs, contacts:()=>contacts, scan:t=>onScanText(t),
      zombie:id=>{ const c=conns.get(id); if(c){ c.removeAllListeners('data'); c.on('data',()=>{}); } },   // anslutningen ser öppen ut men tar inte emot
      noNet:()=>{ testNoNet=true; try{ cpeer && cpeer.destroy() }catch(e){} cpeer=null; conns.clear(); }} : undefined
  };
})();
function openChatView(){ CHAT.open(); }

/* ---------- stil ---------- */
(function(){ const doodle=(c)=>`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><g fill='none' stroke='${c}' stroke-width='1.4' stroke-linecap='round'><path d='M14 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z'/><path d='M60 30c8-10 22-10 30 0-8 6-22 6-30 0z M84 26l8-6v12'/><circle cx='120' cy='22' r='6'/><path d='M112 22h16'/><path d='M30 82c0-6 8-6 8 0 0-6 8-6 8 0 0 6-8 10-8 12 0-2-8-6-8-12z'/><path d='M80 70l16 0l-8 14z'/><circle cx='130' cy='80' r='9'/><path d='M120 82q10 6 20-2'/><path d='M14 130q10-10 20 0t20 0'/><path d='M70 120h20v14H70z M74 120v-4h12v4'/><path d='M118 120l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z'/></g></svg>`)}")`;
  const st=document.createElement('style'); st.textContent=`
.wa{position:fixed;inset:0;z-index:6;display:flex;font-family:'Fredoka',system-ui,sans-serif;color:var(--ct);background:var(--cbg)}
.wa.t-wa-dark,.t-wa-dark{--cbg:#0b141a;--chead:#202c33;--cside:#111b21;--cout:#005c4b;--cin:#202c33;--ct:#e9edef;--cs:#8696a0;--ca:#00a884;--cline:#222d34;--cin2:#2a3942;--wall:${doodle('rgba(255,255,255,.045)')};--cstxt:#e9edef}
.wa.t-wa-light,.t-wa-light{--cbg:#efeae2;--chead:#f0f2f5;--cside:#ffffff;--cout:#d9fdd3;--cin:#ffffff;--ct:#111b21;--cs:#667781;--ca:#008069;--cline:#e9edef;--cin2:#ffffff;--wall:${doodle('rgba(0,0,0,.07)')};--cstxt:#111b21}
.wa.t-space,.t-space{--cbg:#070b24;--chead:#151a45;--cside:#0b0f2e;--cout:#5b21b6;--cin:#1e2456;--ct:#eef0ff;--cs:#a5b4fc;--ca:#a78bfa;--cline:#1f2554;--cin2:#1e2456;--wall:${doodle('rgba(167,139,250,.10)')};--cstxt:#eef0ff}
.wa.t-ocean,.t-ocean{--cbg:#052a40;--chead:#0b3d5c;--cside:#04202f;--cout:#0e7490;--cin:#0f3a55;--ct:#e0f7ff;--cs:#7dd3fc;--ca:#22d3ee;--cline:#0f3a55;--cin2:#0f3a55;--wall:${doodle('rgba(125,211,252,.10)')};--cstxt:#e0f7ff}
.wa.t-leopard,.t-leopard{--cbg:#2a1a0e;--chead:#3a2312;--cside:#24160b;--cout:#b45309;--cin:#41301f;--ct:#fff7ed;--cs:#fcd9a8;--ca:#f9a8d4;--cline:#3a2a1a;--cin2:#41301f;--wall:linear-gradient(rgba(42,26,14,.88),rgba(42,26,14,.88)),var(--leo);--cstxt:#fff7ed}
.wa.t-pink,.t-pink{--cbg:#fdf2f8;--chead:#fbcfe8;--cside:#ffffff;--cout:#f9a8d4;--cin:#ffffff;--ct:#500724;--cs:#9d174d;--ca:#db2777;--cline:#fce7f3;--cin2:#ffffff;--wall:${doodle('rgba(219,39,119,.12)')};--cstxt:#500724}
.wa-side{width:100%;max-width:420px;display:flex;flex-direction:column;background:var(--cside);border-right:1px solid var(--cline);position:relative;min-width:0}
.wa-main{flex:1;display:none;min-width:0}
.wa.has-open .wa-side{display:none}.wa.has-open .wa-main{display:flex}
.wa.wide .wa-side{display:flex;width:400px}.wa.wide .wa-main{display:flex}
.wa-head{display:flex;align-items:center;gap:8px;padding:10px 10px calc(10px);background:var(--chead);min-height:58px;padding-top:max(10px,env(safe-area-inset-top))}
.wa-title{flex:1;font-size:21px}
.wa-ib{width:40px;height:40px;border-radius:50%;font-size:20px;display:grid;place-items:center;color:var(--ct);flex:none}
.wa-ib:hover{background:rgba(127,127,127,.15)}
.wa.wide .wa-ib.back{display:none}
.wa-tabs{display:flex;background:var(--chead);border-bottom:1px solid var(--cline)}
.wa-tabs button{flex:1;padding:11px 0 9px;font-size:15px;font-weight:600;color:var(--cs);border-bottom:3px solid transparent}
.wa-tabs button.on{color:var(--ca);border-bottom-color:var(--ca)}
.wa-list{flex:1;overflow-y:auto}
.wa-row{display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;text-align:left;color:var(--ct);border-bottom:1px solid var(--cline)}
.wa-row:hover,.wa-row.on{background:rgba(127,127,127,.1)}
.wa-rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.wa-r1,.wa-r2{display:flex;align-items:center;gap:6px}
.wa-r1 b{flex:1;font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-r1 small{font-size:12px;color:var(--cs)}
.wa-pv{flex:1;font-size:14px;color:var(--cs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-pv em{color:var(--ca);font-style:normal}
.wa-sub{font-size:13px;color:var(--cs)}
.wa-badge{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--ca);color:#fff;font-style:normal;font-size:12px;font-weight:700}
.wa-tm{font-style:normal;font-size:12px;opacity:.7}
.wa-av{position:relative;width:48px;height:48px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:26px;background:hsl(var(--h) 55% 45%/.35);box-shadow:inset 0 0 0 1px hsl(var(--h) 60% 60%/.4)}
.wa-av.sm{width:38px;height:38px;font-size:21px}.wa-av.xl{width:96px;height:96px;font-size:52px;margin:0 auto}.wa-av.ic{background:var(--ca);font-size:22px}
.wa-on{position:absolute;right:1px;bottom:1px;width:12px;height:12px;border-radius:50%;background:#25d366;border:2px solid var(--cside)}
.wa-sec{padding:14px 16px 6px;font-size:13px;font-weight:600;color:var(--ca);text-transform:uppercase;letter-spacing:.5px}
.wa-empty{padding:30px 24px;text-align:center;color:var(--cs);line-height:1.6}
.wa-add{padding:7px 12px;border-radius:999px;background:var(--ca);color:#fff;font-weight:600;font-size:13px;flex:none}
.wa-fab{position:absolute;right:18px;bottom:calc(18px + env(safe-area-inset-bottom));width:56px;height:56px;border-radius:18px;background:var(--ca);color:#fff;font-size:28px;box-shadow:0 6px 16px rgba(0,0,0,.35)}
.wa-convwrap{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--cbg);color:var(--ct)}
.wa-head.conv{gap:6px}
.wa-ht{flex:1;min-width:0;display:flex;flex-direction:column;text-align:left;color:var(--ct)}
.wa-ht b{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wa-ht small{font-size:12.5px;color:var(--cs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-typing{color:var(--ca)}
.wa-req{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;font-size:13px;background:var(--chead);border-top:1px solid var(--cline)}
.wa-req button{padding:6px 12px;border-radius:999px;background:var(--ca);color:#fff;font-weight:600}.wa-req button:last-child{background:#ef4444}
.wa-msgs{flex:1;overflow-y:auto;padding:12px 4% 14px;background:var(--wall);background-size:auto,90px;background-color:var(--cbg)}
.wa-day{text-align:center;margin:10px 0}.wa-day span{display:inline-block;padding:5px 12px;border-radius:8px;font-size:12.5px;background:var(--chead);color:var(--cs);box-shadow:0 1px 1px rgba(0,0,0,.15)}
.wa-sys{max-width:90%;margin:8px auto;text-align:center;font-size:12.5px;padding:6px 12px;border-radius:8px;background:var(--chead);color:var(--cs)}
.wa-sys.lock{background:rgba(255,213,79,.18);color:var(--cstxt);cursor:pointer}
.wa-msg{display:flex;flex-direction:column;margin:2px 0;position:relative}
.wa-msg.first{margin-top:8px}
.wa-msg.out{align-items:flex-end}.wa-msg.in{align-items:flex-start}
.wa-bub{position:relative;max-width:min(78%,560px);padding:6px 9px 7px;border-radius:8px;font-size:15.5px;line-height:1.35;box-shadow:0 1px .5px rgba(0,0,0,.18);word-wrap:break-word;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}
.wa-msg.out .wa-bub{background:var(--cout);color:var(--cstxt)}.wa-msg.in .wa-bub{background:var(--cin);color:var(--cstxt)}
.wa-msg.first.out .wa-bub{border-top-right-radius:0}.wa-msg.first.in .wa-bub{border-top-left-radius:0}
.wa-msg.first.out .wa-bub::after{content:'';position:absolute;top:0;right:-8px;border:8px solid transparent;border-top-color:var(--cout);border-left-color:var(--cout);border-width:8px 8px 8px 0;border-right:0}
.wa-msg.first.in .wa-bub::after{content:'';position:absolute;top:0;left:-8px;border-top:8px solid var(--cin);border-left:8px solid transparent}
.wa-msg.first.out .wa-bub::after{right:-8px;left:auto;border:none;border-top:8px solid var(--cout);border-right:8px solid transparent}
.wa-tx{display:inline}.wa-tx.big{font-size:40px;line-height:1.15}
.wa-tx a{color:#53bdeb}
.wa-meta{float:right;margin:6px 0 -4px 10px;font-size:11px;color:var(--cs);white-space:nowrap}
.wa-meta i{font-style:normal}
.tk{font-style:normal;letter-spacing:-3px;margin-left:2px;color:var(--cs)}.tk.rd{color:#53bdeb}.tk.q{letter-spacing:0;font-size:10px}
.wa-from{display:block;font-size:13px;font-weight:600;color:hsl(var(--h) 75% 62%);margin-bottom:2px}
.t-wa-light .wa-from,.t-pink .wa-from{color:hsl(var(--h) 65% 40%)}
.wa-reacts{margin:-6px 8px 0;padding:1px 6px;border-radius:999px;background:var(--chead);font-size:14px;box-shadow:0 1px 3px rgba(0,0,0,.25);z-index:1}
.wa-menu{position:relative;z-index:5;margin:6px 0 4px;padding:6px;border-radius:14px;background:var(--chead);box-shadow:0 6px 20px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:2px;min-width:200px}
.wa-menu>button{text-align:left;padding:8px 10px;border-radius:8px;color:var(--ct)}.wa-menu>button:hover{background:rgba(127,127,127,.15)}
.wa-rbar{display:flex;gap:2px;padding-bottom:4px;border-bottom:1px solid var(--cline);margin-bottom:2px}.wa-rbar button{font-size:24px;padding:4px;border-radius:50%}.wa-rbar button:hover{transform:scale(1.25)}
.wa-inv{display:flex;align-items:center;gap:10px;padding:8px;margin:2px 0 4px;border-radius:10px;background:rgba(0,0,0,.18);min-width:220px}
.wa-inv .gi{font-size:34px}.wa-inv div{flex:1;display:flex;flex-direction:column}.wa-inv small{font-size:12px;color:var(--cs)}
.wa-inv button{padding:8px 12px;border-radius:999px;background:var(--ca);color:#fff;font-weight:700}
.typingdots{display:flex;gap:4px;padding:12px 14px}.typingdots i{width:7px;height:7px;border-radius:50%;background:var(--cs);animation:tdot 1.2s infinite}
.typingdots i:nth-child(2){animation-delay:.2s}.typingdots i:nth-child(3){animation-delay:.4s}
@keyframes tdot{0%,60%,100%{transform:none;opacity:.5}30%{transform:translateY(-4px);opacity:1}}
.wa-input{display:flex;align-items:flex-end;gap:6px;padding:6px 8px calc(8px + env(safe-area-inset-bottom));background:var(--chead)}
.wa-input textarea{flex:1;resize:none;border:0;outline:0;border-radius:22px;padding:11px 16px;font:inherit;font-size:16px;line-height:1.3;max-height:140px;background:var(--cin2);color:var(--ct)}
.wa-send{width:46px;height:46px;flex:none;border-radius:50%;background:var(--ca);color:#fff;font-size:20px;display:grid;place-items:center}
.wa-picker{background:var(--chead);border-top:1px solid var(--cline)}
.wa-ptabs{display:flex;overflow-x:auto;gap:2px;padding:4px 6px}.wa-ptabs button{font-size:20px;padding:6px 10px;border-radius:10px;opacity:.6}.wa-ptabs button.on{opacity:1;background:rgba(127,127,127,.18)}
.wa-pgrid, .wa-rbar, .wa-reacts, .wa-tx.big, .wa-emos, .wa-av{font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Fredoka",sans-serif}
.wa-pgrid{touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.wa-pgrid button{color:inherit;opacity:1;filter:none;-webkit-tap-highlight-color:transparent}
.wa-msgs{overscroll-behavior:contain}
.wa-pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));max-height:210px;overflow-y:auto;padding:4px 6px 8px}.wa-pgrid button{font-size:26px;padding:5px 0;border-radius:10px}.wa-pgrid button:hover{background:rgba(127,127,127,.18)}
.wa-welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--cs);background:var(--cbg);padding:20px}
.wa-welcome h2{color:var(--ct);margin:8px 0}.wa-lock{margin-top:30px;font-size:13px}
.wa-setup{flex:1;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--cbg);overflow:auto}
.wa-card{width:min(420px,100%);padding:24px;border-radius:24px;background:var(--cside);text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.wa-card h2{margin:6px 0}.wa-card p{color:var(--cs);font-size:14px;line-height:1.5}
.wa-card label,.sheet label{display:block;text-align:left;font-size:13px;color:var(--cs,var(--dim));margin:12px 2px 6px}
.wa-card input{width:100%;padding:13px 14px;border-radius:14px;border:1px solid var(--cline);background:var(--cin2);color:var(--ct);font:inherit;font-size:17px;outline:none}
.wa-emos{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.wa-emos button{font-size:24px;width:44px;height:44px;border-radius:12px;background:rgba(127,127,127,.12)}.wa-emos button.sel{background:rgba(0,168,132,.3);box-shadow:0 0 0 2px var(--ca,#00a884)}
.wa-btn{width:100%;margin-top:18px;padding:14px;border-radius:999px;background:var(--ca);color:#fff;font-size:17px;font-weight:700}
.wa-link{margin-top:12px;color:var(--cs);font-size:14px}
.wa-themes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wa-themes button{display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;background:rgba(0,0,0,.22);border:1.5px solid var(--line);font-size:14px;text-align:left}
.wa-themes button.sel{border-color:var(--aqua);background:rgba(62,230,255,.14)}
.wa-themes .sw{width:40px;height:48px;border-radius:8px;flex:none;background:var(--wall);background-color:var(--cbg);background-size:auto,60px;display:flex;flex-direction:column;justify-content:center;gap:5px;padding:4px;box-shadow:0 0 0 1px rgba(255,255,255,.2)}
.wa-themes .sw i{height:9px;border-radius:3px;background:var(--cin);width:70%}.wa-themes .sw i:nth-child(2){background:var(--cout);align-self:flex-end}
.wa-safety{font-family:ui-monospace,monospace;font-size:15px;letter-spacing:1px;text-align:center;line-height:1.8;padding:10px;border-radius:12px;background:rgba(0,0,0,.25)}
.wa-mem{display:flex;flex-direction:column;gap:6px}.wa-mem span{display:flex;align-items:center;gap:8px}.wa-mem em{font-style:normal;font-size:11px;padding:1px 6px;border-radius:999px;background:rgba(0,168,132,.3)}
.wa-pick{display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto}
.wa-chk{display:flex!important;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;background:rgba(0,0,0,.2);margin:0!important;color:var(--txt)!important;font-size:15px!important}
.wa-chk input{width:20px;height:20px;accent-color:#00a884}
.wa-rev{font-style:italic;color:var(--cs)}
/* --- sidopanel, flik, eget fönster --- */
.chat-tab{position:fixed;right:0;top:calc(42% + 70px);z-index:24;width:42px;height:58px;border-radius:18px 0 0 18px;font-size:22px;display:grid;place-items:center;color:#fff;
  background:linear-gradient(135deg,#00a884,#0e7490);box-shadow:0 6px 20px rgba(0,0,0,.4),0 0 18px rgba(0,168,132,.35)}
.chat-tab:hover{width:48px}
.ingame .chat-tab{display:none} body.desk.ingame .chat-tab{display:grid}
body.chatopen .chat-tab, body.chatwin .chat-tab{display:none}
.cbadge{position:absolute;top:-7px;left:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font:700 11px/20px system-ui,sans-serif;font-style:normal;text-align:center;display:none;box-shadow:0 0 0 2px rgba(0,0,0,.35)}
.cbadge.on{display:block}
.iconbtn.chatic{position:relative}.iconbtn.chatic .cbadge{top:-5px;left:auto;right:-5px}
.chat-panel{position:fixed;top:0;right:0;bottom:0;z-index:27;width:100vw;background:#0b141a;box-shadow:-14px 0 40px rgba(0,0,0,.5);
  transform:translateX(102%);visibility:hidden;transition:transform .32s cubic-bezier(.2,.8,.2,1),visibility 0s .32s}
.chat-panel.open{transform:none;visibility:visible;transition:transform .32s cubic-bezier(.2,.8,.2,1),visibility 0s}
@media (min-width:700px){ .chat-panel{width:420px;border-left:1px solid rgba(255,255,255,.08)} }
.chat-panel .wa{position:absolute;inset:0}
body.chatwin .chat-panel{width:100vw;transition:none}
body.chatwin #app, body.chatwin #dockRoot, body.chatwin .sp-tab, body.chatwin #sky, body.chatwin #bubbles, body.chatwin .devribbon{display:none!important}
body.chatdock{padding-right:420px}
body.chatdock .dock, body.chatdock .sol-actions, body.chatdock #toasts, body.chatdock #notices{right:420px}
body.chatdock .sp-tab{display:none}
body.chatopen .devribbon{z-index:20}
.wa-back{display:flex;align-items:center;gap:2px;flex:none;padding:7px 12px 7px 8px;border-radius:999px;font-size:22px;line-height:1;color:var(--ct);background:rgba(127,127,127,.14)}
.wa-back span{font-size:14px;font-weight:600}
.wa-back:hover{background:rgba(127,127,127,.25)}
.vdots{display:inline-flex;gap:3px;vertical-align:middle;margin-left:7px;flex:none}
.vdots i{width:7px;height:7px;border-radius:50%;background:rgba(140,150,160,.35)}
.vdots.v1 i:nth-child(1){background:#ef4444}.vdots.v2 i:nth-child(-n+2){background:#f59e0b}.vdots.v3 i{background:#22c55e}
.vbig .vdots{gap:7px;margin:0}.vbig .vdots i{width:16px;height:16px}
.wa-ver{display:flex;align-items:center;gap:14px;padding:10px 12px;border-radius:14px;background:rgba(0,0,0,.22)}.wa-ver div:last-child{display:flex;flex-direction:column;gap:3px}.wa-ver small{font-size:12.5px;color:var(--dim);line-height:1.4}
.wa-qr{width:min(280px,72vw);margin:8px auto;padding:10px;background:#fff;border-radius:16px}.wa-qr svg{display:block;width:100%;height:auto}
.wa-qrname{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px}
.wa-scan{position:relative;width:min(300px,76vw);aspect-ratio:1;margin:8px auto;border-radius:18px;overflow:hidden;background:#000}
.wa-scan video{width:100%;height:100%;object-fit:cover}
.wa-scanbox{position:absolute;inset:16%;border:3px solid #22c55e;border-radius:14px;box-shadow:0 0 0 999px rgba(0,0,0,.35);animation:scanp 1.6s ease-in-out infinite}
@keyframes scanp{50%{border-color:#a7f3d0}}
.wa-ed{font-style:italic!important;margin-right:5px;opacity:.85}
.wa-edit{display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;background:var(--chead);border-top:1px solid var(--cline);border-left:4px solid var(--ca)}
.wa-edit>span{font-size:18px}.wa-edit div{flex:1;min-width:0;display:flex;flex-direction:column}.wa-edit b{font-size:13px;color:var(--ca)}.wa-edit small{font-size:13px;color:var(--cs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-ibub{margin:4px 0 12px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.08);font-size:15px;line-height:1.4;max-height:140px;overflow:auto;overflow-wrap:anywhere}.wa-ibub.out{background:rgba(0,168,132,.25)}
.wa-irows{display:flex;flex-direction:column;gap:2px}
.wa-irow{display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.08)}
.wa-irow .ic{width:30px;text-align:center;flex:none}.wa-irow .ic .tk{letter-spacing:-3px;color:#8696a0}.wa-irow .ic .tk.rd{color:#53bdeb}
.wa-irow .lb{flex:1;display:flex;flex-direction:column;font-weight:600}.wa-irow .lb small{font-weight:400;font-size:11.5px;color:var(--dim)}
.wa-irow .tm{font-size:13px;text-align:right;color:var(--dim)}.wa-irow .tm em{font-style:normal;opacity:.6}
.wa-isec{display:flex;align-items:center;gap:8px;margin:12px 0 2px;font-weight:700}
.wa-games{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wa-games button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px;border-radius:16px;background:rgba(0,0,0,.25);border:1px solid var(--line);font-weight:600}
.wa-games span{font-size:34px}.wa-games small{font-size:11px;color:var(--dim);font-weight:400}
`; document.head.appendChild(st); })();
