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
  const ld=(k,d)=>{ try{ const v=JSON.parse(lsGet(NS+k)); return v===null||v===undefined?d:v; }catch(e){ return d; } };
  const sv=(k,v)=>lsSet(NS+k, JSON.stringify(v));
  const te=new TextEncoder(), td=new TextDecoder();
  const b64=u=>{ u=new Uint8Array(u); let s=''; for(let i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s); };
  const ub64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const cat=(...a)=>{ const n=a.reduce((x,y)=>x+y.length,0), o=new Uint8Array(n); let p=0; a.forEach(x=>{ o.set(x,p); p+=x.length; }); return o; };
  const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>x.toString(16).padStart(2,'0')).join('');

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
  async function okCard(c){ try{ return !!(c && c.v===1 && typeof c.ik==='string' && ['X25519','P-256'].includes(c.curve) && (await idFromPub(c.ik))===c.id); }catch(e){ return false; } }
  let contacts=ld('contacts',{}), known=ld('known',{}), friends=ld('friends',{}), blocked=ld('blocked',[]);
  const saveC=()=>{ sv('contacts',contacts); sv('known',known); sv('friends',friends); sv('blocked',blocked); };
  const cardOf = id => contacts[id] || known[id] || (friends[id]&&friends[id].card) || null;
  const nameOf = id => id===ME?.id ? 'Du' : (contacts[id]?.nick || cardOf(id)?.name || 'Okänd');
  const emoOf = id => cardOf(id)?.emoji || '👤';
  async function remember(card){ if(!(await okCard(card)) || card.id===ME?.id) return false; known[card.id]={...card}; if(contacts[card.id]){ contacts[card.id]={...contacts[card.id], name:card.name, emoji:card.emoji}; } saveC(); return true; }
  async function seenCards(cards, where){ if(!ME) return; let added=0; for(const c of (cards||[])){ if(c && c.id!==ME.id && await remember(c) && !contacts[c.id]){ friends[c.id]={card:c, where:where||'spel', seen:Date.now()}; added++; } } saveC(); if(added && view==='chat') refresh(); }
  function addContact(id){ const c=cardOf(id); if(!c) return; contacts[id]={...c, added:Date.now()}; delete friends[id]; blocked=blocked.filter(x=>x!==id); const cv=convs['d:'+id]; if(cv) cv.request=false; saveC(); saveConvs(); refresh(); connectTo(id); }
  function block(id){ if(!blocked.includes(id)) blocked.push(id); delete contacts[id]; delete convs['d:'+id]; saveC(); saveConvs(); refresh(); }
  async function safetyNumber(id){ const c=cardOf(id); if(!c) return '–'; const ks=[ME.ik.pub,c.ik].sort();
    const h=new Uint8Array(await crypto.subtle.digest('SHA-512',cat(ub64(ks[0]),ub64(ks[1]),te.encode('FL-Safety-v1'))));
    let out=[]; for(let i=0;i<12;i++){ const v=((h[i*3]<<16)|(h[i*3+1]<<8)|h[i*3+2])%100000; out.push(String(v).padStart(5,'0')); } return out.join(' '); }

  /* ---------- Double Ratchet (enskilda chattar) ---------- */
  let SESS=ld('sess',{});
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
  function decryptFrom(peer, hdr, ct){ return lock(peer, async()=>{
    let st=SESS[peer] ? JSON.parse(JSON.stringify(SESS[peer])) : null, reset=false;
    const ad=te.encode(JSON.stringify(hdr)+peer+'>'+ME.id);
    if(hdr.ek){
      const need = !st || (st.role==='B' && st.ek!==hdr.ek) || (st.role==='A' && !st.confirmed && ME.id>peer);
      if(need){
        if(hdr.cv!==ME.curve) throw new Error('olika krypteringskurvor');
        const sk=await hkdf(cat(await dh(ME.curve,ME.ik,hdr.ek), await dh(ME.curve,ME.ik,hdr.ik)), new Uint8Array(32), 'FL-X3DH-v1', 32);
        st={role:'B', ek:hdr.ek, confirmed:true, DHs:ME.ik, DHr:null, RK:b64(sk), CKs:null, CKr:null, Ns:0, Nr:0, PN:0, skipped:{}};
        reset=!!SESS[peer];
      }
    }
    if(!st) throw new Error('ingen session');
    const key=hdr.dh+':'+hdr.n;
    let mk;
    if(st.skipped[key]){ mk=ub64(st.skipped[key]); delete st.skipped[key]; }
    else {
      if(hdr.dh!==st.DHr){ await skipKeys(st,hdr.pn); await dhRatchet(st,hdr); }
      await skipKeys(st,hdr.n);
      const [ck,m]=await kdfCK(ub64(st.CKr)); st.CKr=b64(ck); st.Nr++; mk=m;
    }
    const pt=await aesDec(mk, ct, ad);   // kastar fel om något inte stämmer – då sparas inget
    if(st.role==='A') st.confirmed=true;
    SESS[peer]=st; saveS();
    if(reset) requeueFor(peer);
    return JSON.parse(td.decode(pt));
  }); }

  /* ---------- Sender Keys (grupper) ---------- */
  let GROUPS=ld('groups',{}), SKEYS=ld('skeys',{});
  const saveG=()=>{ sv('groups',GROUPS); sv('skeys',SKEYS); };
  function mySK(gid){ const s=SKEYS[gid]||(SKEYS[gid]={mine:null,recv:{}}); if(!s.mine){ s.mine={ck:b64(crypto.getRandomValues(new Uint8Array(32))), iter:0}; saveG(); } return s.mine; }
  async function gEncrypt(gid, payload){ const m=mySK(gid); const [nck,mk]=await kdfCK(ub64(m.ck)); const iter=m.iter; m.ck=b64(nck); m.iter++; saveG();
    return {iter, ct: await aesEnc(mk, te.encode(JSON.stringify(payload)), te.encode(gid+':'+ME.id+':'+iter))}; }
  async function gDecrypt(gid, from, iter, ct){ const s=SKEYS[gid]; const r=s && s.recv[from]; if(!r) throw new Error('saknar avsändarnyckel');
    const st=JSON.parse(JSON.stringify(r)); let mk;
    if(st.skipped[iter]){ mk=ub64(st.skipped[iter]); delete st.skipped[iter]; }
    else { if(iter<st.iter) throw new Error('gammalt'); if(iter-st.iter>2000) throw new Error('för långt fram');
      while(st.iter<iter){ const [ck,m]=await kdfCK(ub64(st.ck)); st.skipped[st.iter]=b64(m); st.ck=b64(ck); st.iter++; }
      const [ck,m]=await kdfCK(ub64(st.ck)); st.ck=b64(ck); st.iter++; mk=m; }
    const pt=await aesDec(mk, ct, te.encode(gid+':'+from+':'+iter));
    s.recv[from]=st; saveG(); return JSON.parse(td.decode(pt)); }
  function sendSKD(gid, to){ const m=mySK(gid); queueDirect(to, {type:'skd', gid, ck:m.ck, iter:m.iter}, true); }
  function rotateMySK(gid){ const s=SKEYS[gid]||(SKEYS[gid]={mine:null,recv:{}}); s.mine=null; mySK(gid); (GROUPS[gid]?.members||[]).forEach(id=>{ if(id!==ME.id) sendSKD(gid,id); }); }

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
  function markStatus(cid, mid, who, st){
    const c=convs[cid]; if(!c) return; const m=c.msgs.find(x=>x.mid===mid); if(!m || !m.out) return;
    m.st=m.st||{}; const rank={queued:0,sent:1,relayed:1,delivered:2,read:3};
    if((rank[st]||0) >= (rank[m.st[who]]||0)) m.st[who]=st; saveConvs(); if(view==='chat') refreshMsgs(cid);
  }
  function aggStatus(m, cid){ const r=recipients(cid); if(!r.length) return 'read'; const vals=r.map(id=>(m.st||{})[id]||'queued'); const rank={queued:0,sent:1,relayed:1,delivered:2,read:3};
    const min=Math.min(...vals.map(v=>rank[v])); return ['queued','sent','delivered','read'][min]; }
  async function makeEnv(o){
    if(o.kind==='g') return {...o.genv, to:o.to};
    const {hdr,ct}=await encryptFor(o.to, o.payload); return {t:'env', mid:o.mid, from:ME.id, to:o.to, k:'d', hdr, ct, ts:o.ts};
  }
  async function flushTo(id){
    const c=conns.get(id);
    const items=outbox.filter(o=>o.to===id);
    if(!items.length) return;
    if(c && c.open){
      for(const o of items){ if(o.acked || Date.now()-(o.lastSend||0)<25000) continue; try{ const env=await makeEnv(o); sendRaw(c, env); o.lastSend=Date.now(); if(o.status==='queued'){ o.status='sent'; if(!o.ctl) markStatus(o.cid||'', o.mid, id, 'sent'); } }catch(e){ if(!/väntar/.test(e.message)) console.warn('chatt: kunde inte kryptera', e.message); } }
      saveConvs();
    } else {
      connectTo(id);
      // lämna till en kompis som reläar
      const relays=[...conns.keys()].filter(x=>x!==id).sort((a,b)=>sharesGroup(b,id)-sharesGroup(a,id)).slice(0,2);
      for(const o of items){ if(o.status!=='queued' || !relays.length || Date.now()-(o.relayTry||0)<5*60e3) continue; o.relayTry=Date.now();
        try{ const env=await makeEnv(o); relays.forEach(r=>sendRaw(conns.get(r), {t:'relay', to:id, env})); }catch(e){} }
      saveConvs();
    }
  }
  const sharesGroup=(a,b)=>Object.values(GROUPS).some(g=>g.members.includes(a)&&g.members.includes(b))?1:0;
  function flushAll(){ new Set(outbox.map(o=>o.to)).forEach(flushTo); relayQ=relayQ.filter(r=>r.until>Date.now()); new Set(relayQ.map(r=>r.to)).forEach(id=>{ const c=conns.get(id); if(c&&c.open){ relayQ.filter(r=>r.to===id).forEach(r=>sendRaw(c,r.env)); relayQ=relayQ.filter(r=>r.to!==id); saveConvs(); } else connectTo(id); }); }
  function sendReceipt(to, mids, kind, gid){ if(!mids.length || !to) return; queueDirect(to, {type:'receipt', mids, kind, gid}, true); }

  /* ---------- transport (PeerJS, direkt mellan enheter) ---------- */
  const CPREFIX='fl-chat-v1-'+(DEV?'dev-':'');
  let cpeer=null; const conns=new Map(), connecting=new Map(), lastSeen=ld('lastseen',{}), typing={};
  function startTransport(){
    if(cpeer || !ME || typeof Peer==='undefined') return;
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
    if(!cpeer || !cpeer.open || !id || id===ME.id || conns.has(id) || blocked.includes(id)) return;
    const t=connecting.get(id); if(t && Date.now()-t<15000) return;
    connecting.set(id,Date.now());
    const c=cpeer.connect(CPREFIX+id,{reliable:true}); c._out=true; attach(c,id);
    setTimeout(()=>{ if(!c.open){ try{ c.close() }catch(_){} } connecting.delete(id); },12000);
  }
  const sendRaw=(c,m)=>{ try{ if(c && c.open) c.send(JSON.stringify(m)); }catch(e){} };
  function attach(c, id){
    c.on('open',()=>sendRaw(c,{t:'hi', card:myCard()}));
    c.on('data',d=>{ let m; try{ m=typeof d==='string'?JSON.parse(d):d; }catch(e){ return; } onData(c,m); });
    c.on('close',()=>{ if(c._id && conns.get(c._id)===c){ conns.delete(c._id); lastSeen[c._id]=Date.now(); sv('lastseen',lastSeen); if(view==='chat') refreshHead(); } });
    c.on('error',()=>{});
  }
  async function onData(c,m){
    if(!m || !m.t) return;
    if(m.t==='hi'){
      if(!(await okCard(m.card)) || blocked.includes(m.card.id)) { try{ c.close() }catch(_){} return; }
      c._id=m.card.id; await remember(m.card);
      const old=conns.get(c._id);
      if(old && old!==c && old.open){
        // båda ringde samtidigt: behåll anslutningen som det lägsta ID:t startade, på båda sidor
        const initiator = x => x._out ? ME.id : c._id;
        const keep = initiator(c) < initiator(old) ? c : (initiator(old) < initiator(c) ? old : c);
        const drop = keep===c ? old : c;
        setTimeout(()=>{ try{ drop.close() }catch(_){} },1500);
        if(keep===old){ return; }
      }
      conns.set(c._id,c); connecting.delete(c._id); lastSeen[c._id]=Date.now(); outbox.forEach(o=>{ if(o.to===c._id && !o.acked) o.lastSend=0; });
      flushTo(c._id);
      relayQ.filter(r=>r.to===c._id).forEach(r=>sendRaw(c,r.env)); relayQ=relayQ.filter(r=>r.to!==c._id); saveConvs();
      if(view==='chat') refresh();
      return;
    }
    if(!c._id) return;
    if(m.t==='env'){ if(m.to===ME.id) receiveEnv(m, c); return; }
    if(m.t==='ack'){ let ch=false; outbox=outbox.filter(o=>{ if(o.mid!==m.mid || o.to!==c._id) return true; ch=true; if(o.ctl) return false; o.acked=true; if(!o.ctl) markStatus(o.cid||'',o.mid,o.to,'sent'); return true; }); if(ch) saveConvs(); return; }
    if(m.t==='relay'){ if(!contacts[c._id] && !sharesGroup(c._id,m.to)) return; if(m.to===ME.id){ receiveEnv(m.env,null); return; }
      if(!relayQ.some(r=>r.env.mid===m.env.mid && r.to===m.to)){ relayQ.push({to:m.to, env:m.env, until:Date.now()+7*864e5}); if(relayQ.length>300) relayQ=relayQ.slice(-300); saveConvs(); }
      sendRaw(c,{t:'rack', mid:m.env.mid, to:m.to}); connectTo(m.to); return; }
    if(m.t==='rack'){ const o=outbox.find(x=>x.mid===m.mid && x.to===m.to); if(o && o.status==='queued'){ o.status='relayed'; if(!o.ctl) markStatus(o.cid||'',o.mid,o.to,'relayed'); saveConvs(); } return; }
    if(m.t==='typing'){ typing[m.conv==='dm'?'d:'+c._id:m.conv]={who:c._id, until:Date.now()+4000}; if(view==='chat') refreshHead(); setTimeout(()=>{ if(view==='chat') refreshHead(); },4100); return; }
  }
  async function receiveEnv(env, c){
    if(!env || !env.mid || !env.from || blocked.includes(env.from)) return;
    const dkey=env.from+':'+env.mid+':'+(env.k==='g'?'g':'d');
    if(seen.has(dkey)){ if(c) sendRaw(c,{t:'ack', mid:env.mid}); return; }
    try{
      let p;
      if(env.k==='d'){
        if(!cardOf(env.from)){ if(!env.hdr||!env.hdr.ik) throw new Error('okänd'); const card={v:1,id:await idFromPub(env.hdr.ik),ik:env.hdr.ik,curve:env.hdr.cv,name:'Okänd',emoji:'👤'}; if(card.id!==env.from) throw new Error('fel id'); known[card.id]=card; saveC(); }
        p=await decryptFrom(env.from, env.hdr, env.ct);
      } else if(env.k==='g'){
        try{ p=await gDecrypt(env.gid, env.from, env.iter, env.ct); }
        catch(e){ if(/saknar/.test(e.message)){ pendingG.push(env); if(pendingG.length>200) pendingG.shift(); return; } throw e; }
      } else return;
      seen.add(dkey); saveConvs(); if(c) sendRaw(c,{t:'ack', mid:env.mid});
      await handlePayload(env.from, p, env);
    }catch(e){ console.warn('chatt: kunde inte läsa meddelande', e.name, e.message, env.k, JSON.stringify(env.hdr||{iter:env.iter})); }
  }
  async function handlePayload(from, p, env){
    switch(p.type){
      case 'msg': {
        const cid = env.k==='g' ? 'g:'+env.gid : 'd:'+from;
        if(env.k==='g' && !GROUPS[env.gid]) return;
        const isNew=!contacts[from] && env.k==='d';
        if(isNew && p.fromName && known[from]){ known[from].name=p.fromName.slice(0,20); if(p.fromEmoji) known[from].emoji=p.fromEmoji; saveC(); }
        const c=conv(cid, isNew?{request:true}:{});
        const m={mid:p.mid, from, text:String(p.text||'').slice(0,4000), ts:p.ts||Date.now(), exp:p.exp||0, invite:p.invite||null, reactions:{}};
        if(m.exp) m.expireAt=m.ts+m.exp*1000;
        if(addMsg(cid,m)){
          const open = view==='chat' && openCid===cid && !document.hidden;
          if(!open){ c.unread=(c.unread||0)+1; notifyMsg(cid, from, m); }
          else sendReceipt(from,[m.mid],'read', env.gid);
          if(!open) sendReceipt(from,[m.mid],'delivered', env.gid);
          saveConvs(); if(view==='chat') refresh(); else if(view==='lobby') render();
        }
        break; }
      case 'receipt': {
        const cid = p.gid ? 'g:'+p.gid : 'd:'+from;
        (p.mids||[]).forEach(mid=>{ markStatus(cid, mid, from, p.kind==='read'?'read':'delivered'); outbox=outbox.filter(o=>!(o.mid===mid && o.to===from)); });
        saveConvs(); break; }
      case 'react': { const cid = p.gid ? 'g:'+p.gid : 'd:'+from; const m=convs[cid]?.msgs.find(x=>x.mid===p.target); if(m){ m.reactions=m.reactions||{}; if(p.emoji) m.reactions[from]=p.emoji; else delete m.reactions[from]; saveConvs(); if(view==='chat') refreshMsgs(cid); } break; }
      case 'timer': { const cid = p.gid ? 'g:'+p.gid : 'd:'+from; const c=conv(cid); c.timer=p.secs|0; sysMsg(cid, `${nameOf(from)} ändrade försvinnande meddelanden till: ${timerName(c.timer)}`); if(view==='chat') refresh(); break; }
      case 'profile': { if(known[from]){ known[from].name=String(p.name||'').slice(0,20)||known[from].name; known[from].emoji=p.emoji||known[from].emoji; } if(contacts[from]){ contacts[from].name=known[from].name; contacts[from].emoji=known[from].emoji; } saveC(); if(view==='chat') refresh(); break; }
      case 'ginfo': {
        const g=p.group; if(!g || !g.id || !Array.isArray(g.members)) return;
        const prev=GROUPS[g.id];
        if(prev && prev.admin!==from && !(p.leave && prev.members.includes(from))) return;
        if(p.leave){ if(prev){ prev.members=prev.members.filter(x=>x!==from); saveG(); sysMsg('g:'+g.id, `${nameOf(from)} lämnade gruppen`); rotateMySK(g.id); } break; }
        for(const card of Object.values(g.cards||{})) await remember(card);
        if(!g.members.includes(ME.id)){ if(prev){ sysMsg('g:'+g.id,'Du togs bort från gruppen'); delete GROUPS[g.id]; saveG(); } break; }
        GROUPS[g.id]={id:g.id, name:String(g.name).slice(0,40), emoji:g.emoji||'👥', members:g.members, admin:g.admin, created:g.created};
        saveG(); conv('g:'+g.id);
        if(!prev){ sysMsg('g:'+g.id, `${nameOf(from)} lade till dig i gruppen ”${GROUPS[g.id].name}”`); notifyMsg('g:'+g.id, from, {text:'Du lades till i gruppen'}); }
        else sysMsg('g:'+g.id, `${nameOf(from)} uppdaterade gruppen`);
        rotateMySK(g.id);
        if(view==='chat') refresh();
        break; }
      case 'skd': {
        if(!GROUPS[p.gid] || !GROUPS[p.gid].members.includes(from)) return;
        const s=SKEYS[p.gid]||(SKEYS[p.gid]={mine:null,recv:{}}); s.recv[from]={ck:p.ck, iter:p.iter|0, skipped:{}}; saveG();
        const waiting=pendingG.filter(e=>e.gid===p.gid && e.from===from); pendingG=pendingG.filter(e=>!(e.gid===p.gid && e.from===from));
        for(const e of waiting) await receiveEnv(e,null);
        break; }
    }
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
      gEncrypt(gid,payload).then(({iter,ct})=>{ const genv={t:'env', mid:m.mid, from:ME.id, k:'g', gid, iter, ct, ts:m.ts};
        rec.forEach(to=>outbox.push({mid:m.mid, cid, to, kind:'g', genv, status:'queued', ts:m.ts})); saveConvs(); rec.forEach(flushTo); });
    } else { const to=rec[0]; outbox.push({mid:m.mid, cid, to, kind:'d', payload, status:'queued', ts:m.ts}); saveConvs(); flushTo(to); }
    tone(880,.06,'sine',.05); refresh();
  }
  function ctlAll(cid, payload){ const gid=cid.startsWith('g:')?cid.slice(2):null; recipients(cid).forEach(id=>queueDirect(id,{...payload, gid},true)); }
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
  setInterval(()=>{ const now=Date.now(); let ch=false; Object.values(convs).forEach(c=>{ const n=c.msgs.length; c.msgs=c.msgs.filter(m=>!m.expireAt || m.expireAt>now); if(c.msgs.length!==n) ch=true; }); if(ch){ saveConvs(); if(view==='chat') refresh(); } },15000);
  // närvaro: koppla upp mot kontakter med jämna mellanrum
  function presenceSweep(){ if(!ME) return; Object.keys(contacts).slice(0,25).forEach(connectTo); Object.values(GROUPS).forEach(g=>g.members.forEach(connectTo)); }
  setInterval(()=>{ if(cpeer && cpeer.open && !document.hidden){ flushAll(); } },20000);
  setInterval(()=>{ if(cpeer && cpeer.open && !document.hidden) presenceSweep(); },60000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && ME){ startTransport(); if(cpeer && cpeer.disconnected){ try{ cpeer.reconnect() }catch(e){} } setTimeout(()=>{ flushAll(); presenceSweep(); },800); if(view==='chat' && openCid) markRead(openCid); } });

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
    const by={}; unreadMsgs.forEach(m=>{ m.readSent=true; (by[m.from]=by[m.from]||[]).push(m.mid); });
    Object.entries(by).forEach(([f,mids])=>sendReceipt(f,mids,'read', cid.startsWith('g:')?cid.slice(2):undefined));
    if(c.unread){ c.unread=0; } saveConvs(); }

  /* ---------- spelinbjudningar ---------- */
  const GAMES=[['yatzy','🎲','Yatzy'],['ships','🚢','Sänka skepp'],['mm','🔮','Mastermind'],['hang','🪢','Hänga gubbe']];
  function inviteToGame(cid, kind){
    closeModal(); const name=lsGet('ry_name')||ME.name; const g=GAMES.find(x=>x[0]===kind);
    hostGame(name,'free', kind==='yatzy'?undefined:kind);
    setTimeout(()=>{ sendMsg(cid,'',{game:kind, gname:g[2], icon:g[1], code:gameId}); toast(`Inbjudan skickad – väntar på spelare i ${g[2]} 🎮`,3500); },300);
  }

  /* =====================================================================
     UTSEENDE (WhatsApp-stil)
     ===================================================================== */
  let openCid=null, tab='chats', theme=lsGet('chat_theme')||'wa-dark', pickerOpen=false, menuFor=null, draft={};
  const THEMES={'wa-dark':'🌙 Klassisk mörk','wa-light':'☀️ Klassisk ljus','space':'🚀 Rymd','ocean':'🐬 Delfin & hav','leopard':'🐆 Leopard','pink':'💖 Rosa'};
  const EMOJI_SETS={
    '😀':'😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 😐 😏 😒 🙄 😬 😌 😴 🤒 🤧 🥵 🥶 🥳 😎 🤓 😕 😟 🙁 😮 😲 😳 🥺 😢 😭 😱 😤 😡 🤬 😈 💀 👻 👽 🤖 💩',
    '❤️':'❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💗 💓 💞 💕 💘 💝 💔 ❣️ 💯 ✨ ⭐ 🌟 💫 🔥 💥 🎉 🎊 🎈 🎁 🏆 🥇',
    '👍':'👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👋 👏 🙌 👐 🤲 🙏 💪 🤝 ✍️ 💅 👀 🫶 🫡 🤷 🙋 💁 🙆 🙅',
    '🐬':'🐬 🐳 🐋 🦈 🐙 🦑 🐠 🐟 🐡 🦀 🐚 🪼 🐆 🐅 🦁 🐯 🐶 🐱 🐰 🦊 🐻 🐼 🐨 🐸 🦄 🦋 🐝 🐞 🦩 🐧 🦉 🐢',
    '🍕':'🍕 🍔 🌮 🍝 🍣 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 🍿 🍓 🍉 🍌 🍎 🥝 🍦 🥤 🧃 ☕ 🧋',
    '⛷️':'⛷️ 🏂 🎿 ⛸️ 🏒 ⚽ 🏀 🎾 🏐 🏓 🎮 🕹️ 🎲 🧩 🃏 🎯 🎳 🏊 🚴 🤸 🧘 🎨 🎤 🎧 🎸 📚',
    '🚀':'🚀 🛸 🪐 🌍 🌙 ☀️ 🌈 ⭐ ☄️ 🌊 ❄️ ☃️ 🌸 🌺 🌻 🌲 🏔️ 🏖️ 🏝️ 🎄 🎃 🏠 🚗 ✈️ 🚂 ⛵'
  };
  const fmtT = ts => new Date(ts).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
  function dayLabel(ts){ const d=new Date(ts), n=new Date(); const k=x=>x.toDateString(); if(k(d)===k(n)) return 'Idag'; const y=new Date(n); y.setDate(n.getDate()-1); if(k(d)===k(y)) return 'Igår'; return d.toLocaleDateString('sv-SE',{weekday:'long', day:'numeric', month:'long'}); }
  const hue = id => parseInt(String(id).slice(0,6),16)%360;
  const avatar = (emoji, id, size, online) => `<span class="wa-av ${size||''}" style="--h:${hue(id||'0')}">${emoji}${online?'<i class="wa-on"></i>':''}</span>`;
  function convTitle(cid){ if(cid.startsWith('g:')){ const g=GROUPS[cid.slice(2)]; return g?`${g.emoji} ${g.name}`:'Grupp'; } return nameOf(cid.slice(2)); }
  function convAvatar(cid,size){ if(cid.startsWith('g:')){ const g=GROUPS[cid.slice(2)]; return avatar(g?g.emoji:'👥', cid, size); } const id=cid.slice(2); return avatar(emoOf(id), id, size, conns.has(id)); }
  function preview(c){ const m=[...c.msgs].reverse().find(x=>!x.hidden); if(!m) return c.type==='grp'?'Ny grupp':'Säg hej! 👋'; if(m.sys) return m.text;
    const who = c.type==='grp' && !m.out ? nameOf(m.from)+': ' : ''; const tick = m.out ? tickHTML(aggStatus(m,c.id))+' ' : '';
    return tick + esc(who + (m.invite ? `🎮 Inbjudan: ${m.invite.gname}` : m.text)); }
  function tickHTML(st){ return st==='queued' ? '<i class="tk q">🕓</i>' : st==='sent' ? '<i class="tk">✓</i>' : st==='delivered' ? '<i class="tk">✓✓</i>' : '<i class="tk rd">✓✓</i>'; }

  function html(){
    if(!ME) return `<div id="chatRoot" class="wa t-${theme}"><div class="wa-setup">${setupHTML()}</div></div>`;
    return `<div id="chatRoot" class="wa t-${theme} ${openCid?'has-open':''}"><aside class="wa-side" id="waSide">${sideHTML()}</aside><main class="wa-main" id="waMain">${mainHTML()}</main></div>`;
  }
  function setupHTML(){
    return `<div class="wa-card"><div style="font-size:54px">💬🔒</div><h2>Fröknarnas chatt</h2>
      <p>Allt du skriver krypteras på din enhet innan det skickas. Bara mottagaren kan läsa det – ingen server, ingen annan.</p>
      <label>Ditt namn i chatten</label><input id="waName" maxlength="20" value="${esc(lsGet('ry_name')||'')}" placeholder="Ditt namn">
      <label>Välj en profilbild</label><div class="wa-emos">${EMO.map((e,i)=>`<button data-c="emo" data-e="${e}" class="${i===0?'sel':''}">${e}</button>`).join('')}</div>
      <button class="wa-btn" data-c="create">Skapa mina krypteringsnycklar ✨</button>
      <button class="wa-link" data-act="lobby">Tillbaka till lobbyn</button></div>`;
  }
  function sideHTML(){
    const list = Object.values(convs).filter(c=>c.type==='dm' ? !blocked.includes(peerOfConv(c.id)) : !!GROUPS[c.id.slice(2)]).sort((a,b)=>(b.lastTs||0)-(a.lastTs||0));
    const fr=Object.entries(friends).filter(([id])=>!contacts[id]);
    let body='';
    if(tab==='chats'){
      body = list.length ? list.map(c=>`<button class="wa-row ${c.id===openCid?'on':''}" data-c="open" data-id="${c.id}">${convAvatar(c.id)}<span class="wa-rt"><span class="wa-r1"><b>${esc(convTitle(c.id))}</b><small>${c.lastTs?fmtT(c.lastTs):''}</small></span>
          <span class="wa-r2"><span class="wa-pv">${c.request?'<em>Ny kontaktförfrågan</em>':preview(c)}</span>${c.timer?'<i class="wa-tm">⏱</i>':''}${c.unread?`<i class="wa-badge">${c.unread}</i>`:''}</span></span></button>`).join('')
        : `<div class="wa-empty">Inga chattar än.<br>Tryck på <b>＋</b> för att börja chatta med en kontakt.</div>`;
    } else {
      const cs=Object.values(contacts).sort((a,b)=>nameOf(a.id).localeCompare(nameOf(b.id),'sv'));
      body = `<button class="wa-row act" data-c="newgroup"><span class="wa-av ic">👥</span><span class="wa-rt"><b>Ny grupp</b></span></button>
        <button class="wa-row act" data-c="sharecard"><span class="wa-av ic">🔗</span><span class="wa-rt"><b>Dela min kontakt</b><small class="wa-sub">Skicka en länk så kan någon lägga till dig</small></span></button>
        ${fr.length?`<div class="wa-sec">Spelkompisar – lägg till som kontakt</div>`+fr.map(([id,f])=>`<div class="wa-row">${avatar(f.card.emoji,id)}<span class="wa-rt"><b>${esc(f.card.name)}</b><small class="wa-sub">Från ${esc(f.where)}</small></span><button class="wa-add" data-c="addc" data-id="${id}">＋ Lägg till</button></div>`).join(''):''}
        <div class="wa-sec">Kontakter${cs.length?` (${cs.length})`:''}</div>
        ${cs.length?cs.map(c=>`<button class="wa-row" data-c="opendm" data-id="${c.id}">${avatar(c.emoji,c.id,'',conns.has(c.id))}<span class="wa-rt"><b>${esc(nameOf(c.id))}</b><small class="wa-sub">${conns.has(c.id)?'online':'🔒 krypterad'}</small></span></button>`).join(''):'<div class="wa-empty">Spela ett onlinespel med någon – då dyker de upp här som spelkompisar.</div>'}`;
    }
    return `<div class="wa-head"><button class="wa-ib" data-act="lobby" aria-label="Lobby">‹</button><b class="wa-title">Chattar</b>
        <button class="wa-ib" data-c="theme" aria-label="Tema">🎨</button><button class="wa-ib" data-c="profile" aria-label="Profil">${ME.emoji}</button></div>
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
        <button class="wa-ht" data-c="info"><b>${esc(convTitle(openCid))}</b><small id="waStatus">${headStatus(openCid)}</small></button>
        <button class="wa-ib" data-c="invite" aria-label="Bjud in till spel">🎮</button><button class="wa-ib" data-c="info" aria-label="Meny">⋮</button></div>
      ${c.request?`<div class="wa-req">${esc(nameOf(peerOfConv(openCid)))} finns inte bland dina kontakter. <button data-c="addc" data-id="${peerOfConv(openCid)}">Lägg till</button><button data-c="block" data-id="${peerOfConv(openCid)}">Blockera</button></div>`:''}
      <div class="wa-msgs" id="waMsgs">${msgsHTML(openCid)}</div>
      ${pickerOpen?emojiPickerHTML():''}
      <div class="wa-input"><button class="wa-ib" data-c="emoji" aria-label="Emojis">${pickerOpen?'⌨️':'😊'}</button>
        <textarea id="waText" rows="1" placeholder="Meddelande" maxlength="4000">${esc(draft[openCid]||'')}</textarea>
        <button class="wa-send" data-c="send" aria-label="Skicka">➤</button></div></div>`;
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
      const body = m.invite ? `<div class="wa-inv"><span class="gi">${m.invite.icon||'🎮'}</span><div><b>${esc(m.invite.gname)}</b><small>${m.out?'Du bjöd in till ett spel':'Inbjudan till ett spel'} · kod ${esc(m.invite.code)}</small></div>${m.out?'':`<button data-c="join" data-code="${esc(m.invite.code)}">Gå med</button>`}</div>${m.text?`<div class="wa-tx">${linkify(m.text)}</div>`:''}`
        : `<div class="wa-tx ${/^\p{Extended_Pictographic}{1,3}$/u.test(m.text)?'big':''}">${linkify(m.text)}</div>`;
      h+=`<div class="wa-msg ${m.out?'out':'in'} ${first?'first':''}" data-mid="${m.mid}">
        <div class="wa-bub">${!m.out && c.type==='grp' && first?`<span class="wa-from" style="--h:${hue(m.from)}">${esc(nameOf(m.from))}</span>`:''}${body}
          <span class="wa-meta">${m.exp?'<i>⏱</i>':''}${fmtT(m.ts)}${m.out?' '+tickHTML(aggStatus(m,cid)):''}</span></div>
        ${reacts.length?`<div class="wa-reacts">${Object.entries(rc).map(([e,n])=>e+(n>1?n:'')).join(' ')}</div>`:''}
        ${menuFor===m.mid?`<div class="wa-menu"><div class="wa-rbar">${['❤️','😂','😮','😭','🙏','👍'].map(e=>`<button data-c="react" data-mid="${m.mid}" data-e="${e}">${e}</button>`).join('')}</div><button data-c="copy" data-mid="${m.mid}">📋 Kopiera</button><button data-c="delme" data-mid="${m.mid}">🗑 Ta bort för mig</button></div>`:''}</div>`;
    });
    const t=typing[cid]; if(t && t.until>Date.now()) h+=`<div class="wa-msg in first"><div class="wa-bub typingdots"><i></i><i></i><i></i></div></div>`;
    return h;
  }
  const linkify = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br>');
  function emojiPickerHTML(){ const tabs=Object.keys(EMOJI_SETS); const cur=draft._et||tabs[0];
    return `<div class="wa-picker"><div class="wa-ptabs">${tabs.map(t=>`<button class="${t===cur?'on':''}" data-c="etab" data-t="${t}">${t}</button>`).join('')}</div><div class="wa-pgrid">${EMOJI_SETS[cur].split(' ').map(e=>`<button data-c="pick" data-e="${e}">${e}</button>`).join('')}</div></div>`; }

  /* ---------- uppdatering utan att tappa det man skriver ---------- */
  function refresh(){
    const root=document.getElementById('chatRoot'); if(!root || view!=='chat') return;
    if(!ME){ root.innerHTML=`<div class="wa-setup">${setupHTML()}</div>`; return; }
    if(!document.getElementById('waSide')){ root.outerHTML=html(); mount(); return; }
    root.className=`wa t-${theme} ${openCid?'has-open':''}`;
    const side=document.getElementById('waSide'), st=side.querySelector('.wa-list')?.scrollTop||0; side.innerHTML=sideHTML(); const nl=side.querySelector('.wa-list'); if(nl) nl.scrollTop=st;
    const main=document.getElementById('waMain'), ta=document.getElementById('waText');
    const sameConv = main.dataset.cid===String(openCid) && ta && !!pickerOpen===!!main.querySelector('.wa-picker') && !!convs[openCid]?.request===!!main.querySelector('.wa-req');
    if(sameConv){ refreshHead(); refreshMsgs(openCid); }
    else { main.innerHTML=mainHTML(); main.dataset.cid=openCid||''; scrollBottom(true); autoGrow(); }
  }
  function refreshHead(){ const s=document.getElementById('waStatus'); if(s && openCid) s.innerHTML=headStatus(openCid); }
  function refreshMsgs(cid){ if(cid!==openCid) return; const box=document.getElementById('waMsgs'); if(!box) return; const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80; box.innerHTML=msgsHTML(cid); if(atBottom) scrollBottom(); }
  function scrollBottom(instant){ const box=document.getElementById('waMsgs'); if(box) requestAnimationFrame(()=>{ box.scrollTop=box.scrollHeight; }); }
  function autoGrow(){ const ta=document.getElementById('waText'); if(!ta) return; ta.style.height='auto'; ta.style.height=Math.min(140,ta.scrollHeight)+'px'; }
  function mount(){ const main=document.getElementById('waMain'); if(main) main.dataset.cid=openCid||''; scrollBottom(true); autoGrow(); if(openCid) markRead(openCid); }
  function openConv(cid){ openCid=cid; pickerOpen=false; menuFor=null; const c=conv(cid); c.unread=0; saveConvs(); if(view==='chat'){ refresh(); markRead(cid); } }
  function openChat(cid){ closeModal(); if(typeof INV!=='undefined') INV.stop(); view='chat'; if(cid){ openCid=cid; conv(cid); pickerOpen=false; menuFor=null; } const r=document.getElementById('chatRoot'); if(r) r.remove(); render(); if(cid){ conv(cid).unread=0; markRead(cid); } }

  /* ---------- modaler ---------- */
  function showProfile(){
    openModal(`<h3>${ME.emoji} Din profil</h3><label>Namn</label><input id="pfName" maxlength="20" value="${esc(ME.name)}">
      <label>Profilbild</label><div class="wa-emos">${EMO.map(e=>`<button data-c="pfemo" data-e="${e}" class="${e===ME.emoji?'sel':''}">${e}</button>`).join('')}</div>
      <div class="setnote" style="margin-top:12px">Ditt chatt-ID: <b>${ME.id}</b> · kryptering ${ME.curve}</div>
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
      ${g?`<label>👥 Medlemmar</label><div class="wa-mem">${g.members.map(id=>`<span>${avatar(emoOf(id),id,'sm')} ${esc(nameOf(id))}${id===g.admin?' <em>admin</em>':''}</span>`).join('')}</div>
         ${g.admin===ME.id?`<div class="chips" style="margin-top:8px"><button data-c="editmembers" data-gid="${g.id}">✏️ Ändra medlemmar</button></div>`:''}`:''}
      ${peer?`<label>🔐 Säkerhetsnummer</label><div class="wa-safety">${safety}</div><div class="setnote">Jämför numret med ${esc(nameOf(peer))}s skärm när ni ses. Är de lika vet ni att ingen sitter emellan.</div>`:''}
      <div class="btns" style="flex-wrap:wrap"><button data-c="clear" data-cid="${cid}">🧹 Rensa chatten</button>${g?`<button data-c="leave" data-gid="${g.id}">🚪 Lämna gruppen</button>`:`<button data-c="block" data-id="${peer}">⛔ Blockera</button>`}<button class="pri" data-act="close">Klar</button></div>`,'chatinfo');
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
      <div class="wa-games">${GAMES.map(([k,i,n])=>`<button data-c="invitegame" data-k="${k}" data-cid="${cid}"><span>${i}</span>${n}${k==='yatzy'?'<small>2–4 spelare</small>':'<small>2 spelare</small>'}</button>`).join('')}</div>
      <div class="btns"><button data-act="close">Avbryt</button></div>`,'chatinv');
  }
  async function shareCard(){
    const link=location.origin+location.pathname+'#k='+btoa(unescape(encodeURIComponent(JSON.stringify(myCard())))).replace(/=+$/,'');
    const text=`Lägg till mig i Fröknarnas chatt! ${ME.emoji}`;
    try{ if(navigator.share){ await navigator.share({title:'Min chattkontakt', text, url:link}); return; } }catch(e){ if(e && e.name==='AbortError') return; }
    try{ await navigator.clipboard.writeText(text+' '+link); toast('Länken är kopierad – skicka den till din kompis 📋',3500); }catch(e){ toast(link,8000); }
  }
  async function handleHash(){
    const m=/#k=([A-Za-z0-9+/_-]+)/.exec(location.hash); if(!m) return;
    try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
    let card=null; try{ card=JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g,'+').replace(/_/g,'/'))))); }catch(e){}
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
  document.addEventListener('input',e=>{
    if(e.target.id!=='waText' || !openCid) return; draft[openCid]=e.target.value; autoGrow();
    if(Date.now()-typingT>2500){ typingT=Date.now(); const k=openCid.startsWith('g:')?openCid:'dm'; recipients(openCid).forEach(id=>sendRaw(conns.get(id),{t:'typing', conv:k})); }
  });
  document.addEventListener('keydown',e=>{
    if(e.target.id==='waText' && e.key==='Enter' && !e.shiftKey && FINE_PTR){ e.preventDefault(); doSend(); }
    if(view==='chat' && e.key==='Escape'){ if(menuFor){ menuFor=null; refreshMsgs(openCid); } else if(pickerOpen){ pickerOpen=false; refresh(); } }
  });
  function doSend(){ const ta=document.getElementById('waText'); if(!ta || !openCid) return; const t=ta.value; if(!t.trim()) return; ta.value=''; draft[openCid]=''; autoGrow(); sendMsg(openCid,t); ta.focus(); }
  // långt tryck på en bubbla öppnar reaktioner
  let pressT=0, pressMid=null;
  document.addEventListener('pointerdown',e=>{ const b=e.target.closest('.wa-msg .wa-bub'); if(!b || view!=='chat') return; pressMid=b.parentElement.dataset.mid; clearTimeout(pressT); pressT=setTimeout(()=>{ menuFor=pressMid; buzz(15); refreshMsgs(openCid); },450); });
  ['pointerup','pointercancel','pointermove'].forEach(t=>document.addEventListener(t,e=>{ if(t==='pointermove' && Math.abs(e.movementY)<4) return; clearTimeout(pressT); }));
  document.addEventListener('contextmenu',e=>{ const b=e.target.closest('.wa-msg .wa-bub'); if(!b) return; e.preventDefault(); menuFor=b.parentElement.dataset.mid; refreshMsgs(openCid); });
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-c]');
    if(view==='chat' && menuFor && !e.target.closest('.wa-menu')){ menuFor=null; refreshMsgs(openCid); if(!b) return; }
    if(!b) return; const a=b.dataset.c; unlockAudio();
    switch(a){
      case 'emo': case 'pfemo': case 'gemo': b.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); break;
      case 'create': { const n=(document.getElementById('waName')?.value||'').trim(); if(!n){ toast('Skriv ditt namn 💬'); return; } const em=document.querySelector('.wa-emos .sel')?.dataset.e;
        b.disabled=true; b.textContent='Skapar nycklar…'; try{ await createIdentity(n,em); lsSet('ry_name',n); startTransport(); refresh(); toast('Klart! Dina nycklar finns bara på den här enheten 🔐',3500); }catch(err){ toast('Kunde inte skapa nycklar: '+err.message,5000); b.disabled=false; } break; }
      case 'tab': tab=b.dataset.t; refresh(); break;
      case 'open': openConv(b.dataset.id); break;
      case 'opendm': openConv('d:'+b.dataset.id); break;
      case 'close': openCid=null; refresh(); break;
      case 'send': doSend(); break;
      case 'emoji': pickerOpen=!pickerOpen; refresh(); break;
      case 'etab': draft._et=b.dataset.t; refresh(); break;
      case 'pick': { const ta=document.getElementById('waText'); if(ta){ const s=ta.selectionStart??ta.value.length; ta.value=ta.value.slice(0,s)+b.dataset.e+ta.value.slice(ta.selectionEnd??s); draft[openCid]=ta.value; autoGrow(); } break; }
      case 'react': react(openCid, b.dataset.mid, b.dataset.e); menuFor=null; refreshMsgs(openCid); break;
      case 'copy': { const m=convs[openCid]?.msgs.find(x=>x.mid===b.dataset.mid); try{ await navigator.clipboard.writeText(m?.text||''); toast('Kopierat 📋'); }catch(_){} menuFor=null; refreshMsgs(openCid); break; }
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
      case 'join': { const name=lsGet('ry_name')||ME.name; joinGame(b.dataset.code, name); break; }
    }
  });

  /* ---------- start ---------- */
  function boot(){ if(ME){ startTransport(); } handleHash(); }
  setTimeout(boot, 300);
  return {
    html, mount, refresh, open:()=>openChat(null), openChat, seenCards, card:()=>myCard(), unread:totalUnread,
    hasIdentity:()=>!!ME
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
body.desk .wa .wa-side{display:flex;width:400px}body.desk .wa .wa-main{display:flex}
.wa-head{display:flex;align-items:center;gap:8px;padding:10px 10px calc(10px);background:var(--chead);min-height:58px;padding-top:max(10px,env(safe-area-inset-top))}
.wa-title{flex:1;font-size:21px}
.wa-ib{width:40px;height:40px;border-radius:50%;font-size:20px;display:grid;place-items:center;color:var(--ct);flex:none}
.wa-ib:hover{background:rgba(127,127,127,.15)}
body.desk .wa-ib.back{display:none}
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
.wa-games{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wa-games button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px;border-radius:16px;background:rgba(0,0,0,.25);border:1px solid var(--line);font-weight:600}
.wa-games span{font-size:34px}.wa-games small{font-size:11px;color:var(--dim);font-weight:400}
`; document.head.appendChild(st); })();
