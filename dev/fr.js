/* =====================================================================
   fr.js – Önskelistan (feature requests)
   Varje önskan blir ett unikt ärende (#ABC12) med status, prioritet och
   en dialog. Allt är signerade händelser som synkas mellan enheterna
   (via chatten och via onlinespel) – ingen server behövs.
     • Vem som helst kan önska, kommentera och gilla (👍)
     • Utvecklare (FR_ROOT + de som de utsett) sätter status och prioritet
     • Den som önskat kan redigera sin text och återkalla sin önskan
   ===================================================================== */
'use strict';
const FR = (()=>{
  // Utvecklare som får sätta status. Lägg till ditt önske-ID här (visas under "Om önskelistan").
  const FR_ROOT = ['359be5b3204e039d'];   // Everest
  const REPO = 'https://github.com/DadCoo1/stjarndelfin-yatzy';

  const te=new TextEncoder();
  const b64=u=>{ u=new Uint8Array(u); let s=''; for(let i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s); };
  const ub64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const hex=u=>Array.from(new Uint8Array(u),x=>x.toString(16).padStart(2,'0')).join('');
  const sha=async s=>hex(await crypto.subtle.digest('SHA-256', typeof s==='string'?te.encode(s):s));
  const ECDSA={name:'ECDSA', namedCurve:'P-256'}, SIGN={name:'ECDSA', hash:'SHA-256'};
  const ld=(k,d)=>{ try{ const v=JSON.parse(lsGet('fr:'+k)); return v==null?d:v; }catch(e){ return d; } };
  const sv=(k,v)=>lsSet('fr:'+k, JSON.stringify(v));
  const clean=(x,max)=>String(x??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g,'').slice(0,max);
  const cleanLine=(x,max)=>clean(x,400).replace(/[\r\n\t]+/g,' ').trim().slice(0,max);
  const isHex=(x,n)=>typeof x==='string' && x.length===n && /^[0-9a-f]+$/.test(x);

  /* ---------- begrepp ---------- */
  const TYPES={feature:['✨','Ny funktion'], bug:['🐞','Bugg'], improve:['💡','Förbättring'], question:['❓','Fråga']};
  const AREAS=['Allmänt','Yatzy','Patiens','Sänka skepp','Mastermind','Hänga gubbe','Space Invaders','Chatt','Musik','Utseende'];
  // statusflöde (som i GitHub/Jira, på svenska)
  const STATUS={
    new:['🆕','Ny','Inkommen, ingen har tittat än','#38bdf8'],
    triage:['🔎','Granskas','Utvecklaren tittar på önskan och kan ställa frågor','#a78bfa'],
    needinfo:['💬','Behöver svar','Utvecklaren väntar på svar från den som önskat','#f472b6'],
    planned:['📋','Planerad','Godkänd och lagd i kön','#60a5fa'],
    progress:['🛠️','Pågår','Byggs just nu','#f59e0b'],
    testing:['🧪','Testas','Finns i testversionen (dev) – testa gärna!','#2dd4bf'],
    done:['✅','Klar','Släppt i appen','#22c55e'],
    paused:['⏸️','Pausad','Vilar en tid – kan tas upp igen','#94a3b8'],
    rejected:['❌','Avvisad','Blir inte av (med en förklaring)','#ef4444'],
    duplicate:['🔁','Dubblett','Samma som en annan önskan','#94a3b8'],
    withdrawn:['↩️','Återkallad','Den som önskade drog tillbaka den','#94a3b8']
  };
  const OPEN=['new','triage','needinfo','planned','progress','testing','paused'];
  const PRIO={low:['🐢','Låg'], normal:['➖','Normal'], high:['🔥','Hög']};
  const keyOf = id => '#'+parseInt(id.slice(0,8),16).toString(36).toUpperCase().padStart(6,'0').slice(-6);

  /* ---------- min identitet (signeringsnyckel) ---------- */
  let ME=ld('me',null), privKey=null;
  async function me(){
    if(ME && privKey) return ME;
    if(!ME){
      const kp=await crypto.subtle.generateKey(ECDSA,true,['sign','verify']);
      const pub=b64(await crypto.subtle.exportKey('raw',kp.publicKey));
      ME={id:(await sha(ub64(pub))).slice(0,16), pub, priv:b64(await crypto.subtle.exportKey('pkcs8',kp.privateKey)), name:''};
      sv('me',ME);
    }
    privKey=await crypto.subtle.importKey('pkcs8',ub64(ME.priv),ECDSA,false,['sign']);
    return ME;
  }
  const myName = () => (ME && ME.name) || lsGet('ry_name') || (typeof CHAT!=='undefined' && CHAT.card() && CHAT.card().name) || '';

  /* ---------- händelser ---------- */
  // bara kända fält i fast ordning – samma text att signera hos alla
  function normData(kind, d){
    d = d && typeof d==='object' ? d : {};
    switch(kind){
      case 'req':  return {title:cleanLine(d.title,90), desc:clean(d.desc,2000).trim(), type:TYPES[d.type]?d.type:'feature', area:AREAS.includes(d.area)?d.area:'Allmänt'};
      case 'cmt':  return {text:clean(d.text,1000).trim()};
      case 'st':   return {status:STATUS[d.status]?d.status:'triage', note:clean(d.note,500).trim(), prio:PRIO[d.prio]?d.prio:'', dup:isHex(d.dup,20)?d.dup:''};
      case 'edit': return {title:cleanLine(d.title,90), desc:clean(d.desc,2000).trim()};
      case 'vote': return {on:!!d.on};
      case 'role': return {target:isHex(d.target,16)?d.target:'', add:!!d.add};
    }
    return null;
  }
  const canon = e => JSON.stringify([e.v, e.kind, e.rid, e.author, e.apub, e.name, e.ts, e.data]);
  async function makeEvent(kind, rid, data){
    const m=await me();
    const e={v:1, kind, rid:rid||null, author:m.id, apub:m.pub, name:cleanLine(myName(),20)||'Någon', ts:Date.now(), data:normData(kind,data)};
    const str=canon(e);
    e.sig=b64(await crypto.subtle.sign(SIGN, privKey, te.encode(str)));
    e.id=(await sha(str+'|'+e.sig)).slice(0,20);
    return e;
  }
  const vkeys=new Map();
  async function verify(e){
    try{
      if(!e || typeof e!=='object' || e.v!==1 || !normData(e.kind,{}) || !isHex(e.id,20) || !isHex(e.author,16)) return false;
      if(typeof e.apub!=='string' || e.apub.length>120 || typeof e.sig!=='string' || e.sig.length>200 || typeof e.name!=='string' || e.name.length>20) return false;
      if(!Number.isFinite(e.ts) || e.ts>Date.now()+864e5) return false;
      if(e.kind==='req' || e.kind==='role' ? e.rid!==null : !isHex(e.rid,20)) return false;
      if(JSON.stringify(normData(e.kind,e.data))!==JSON.stringify(e.data)) return false;     // inga extra eller ostädade fält
      if(e.kind==='req' && (!e.data.title || e.data.title.length<3)) return false;
      if(e.kind==='cmt' && !e.data.text) return false;
      if((await sha(ub64(e.apub))).slice(0,16)!==e.author) return false;
      const str=canon(e); if((await sha(str+'|'+e.sig)).slice(0,20)!==e.id) return false;
      let k=vkeys.get(e.apub); if(!k){ k=await crypto.subtle.importKey('raw',ub64(e.apub),ECDSA,false,['verify']); vkeys.set(e.apub,k); }
      return await crypto.subtle.verify(SIGN, k, ub64(e.sig), te.encode(str));
    }catch(err){ return false; }
  }

  /* ---------- lagring + tillstånd ---------- */
  let EV=ld('ev',[]); const IDX=new Map(EV.map(e=>[e.id,e]));
  let STATE={reqs:{}, maint:new Set(FR_ROOT)};
  function save(){ if(EV.length>3000) EV=EV.slice(-3000); sv('ev',EV); }
  function rebuild(){
    const evs=[...EV].sort((a,b)=>a.ts-b.ts || (a.id<b.id?-1:1));
    const maint=new Set(FR_ROOT);
    for(const e of evs) if(e.kind==='role' && maint.has(e.author) && e.data.target){ e.data.add ? maint.add(e.data.target) : (FR_ROOT.includes(e.data.target) || maint.delete(e.data.target)); }
    const reqs={};
    for(const e of evs) if(e.kind==='req') reqs[e.id]={id:e.id, key:keyOf(e.id), ...e.data, author:e.author, name:e.name, ts:e.ts, last:e.ts,
      status:'new', prio:'normal', dup:'', votes:new Set(), people:new Set([e.author]), timeline:[{t:'created', e}], comments:0};
    for(const e of evs){
      if(e.kind==='req' || e.kind==='role') continue;
      const r=reqs[e.rid]; if(!r) continue;
      const isM=maint.has(e.author), isOwner=e.author===r.author;
      if(e.kind==='cmt'){ r.timeline.push({t:'cmt', e, m:isM}); r.comments++; r.last=Math.max(r.last,e.ts); r.people.add(e.author); }
      else if(e.kind==='vote'){ e.data.on ? r.votes.add(e.author) : r.votes.delete(e.author); }
      else if(e.kind==='edit' && isOwner){ r.title=e.data.title||r.title; r.desc=e.data.desc; r.timeline.push({t:'edit', e}); r.last=Math.max(r.last,e.ts); }
      else if(e.kind==='st'){
        const s=e.data.status;
        const ok = isM || (isOwner && (s==='withdrawn' || (s==='new' && r.status==='withdrawn')));
        if(!ok) continue;
        const from=r.status; r.status=s; if(isM && e.data.prio) r.prio=e.data.prio; r.dup = s==='duplicate' ? e.data.dup : '';
        r.timeline.push({t:'st', e, from, m:isM}); r.last=Math.max(r.last,e.ts);
      }
    }
    STATE={reqs, maint};
  }
  rebuild();
  const isMaint = id => STATE.maint.has(id);
  async function publish(kind, rid, data){
    const e=await makeEvent(kind, rid, data);
    EV.push(e); IDX.set(e.id,e); save(); rebuild(); markSeen(kind==='req'?e.id:rid);
    broadcast({t:'frev', evs:[e]});
    return e;
  }

  /* ---------- synk (gossip) ---------- */
  function sumHash(){ let h=2166136261>>>0; for(const id of [...IDX.keys()].sort()){ for(let i=0;i<id.length;i++){ h^=id.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } } return h.toString(16)+':'+IDX.size; }
  const chunks=(arr,n)=>{ const o=[]; for(let i=0;i<arr.length;i+=n) o.push(arr.slice(i,i+n)); return o; };
  function sendEvents(reply, evs){ for(const c of chunks(evs,30)) reply({t:'frev', evs:c}); }
  function onConnect(reply){ try{ reply({t:'frsum', h:sumHash()}); }catch(e){} }
  async function onMsg(m, reply){
    if(!m || typeof m.t!=='string') return;
    if(m.t==='frsum'){ if(typeof m.h==='string' && m.h!==sumHash()) reply({t:'frids', ids:[...IDX.keys()].slice(-3000)}); return; }
    if(m.t==='frids'){
      if(!Array.isArray(m.ids)) return;
      const theirs=new Set(m.ids.slice(0,3000).filter(x=>isHex(x,20)));
      const want=[...theirs].filter(id=>!IDX.has(id)).slice(0,600);
      if(want.length) reply({t:'frwant', ids:want});
      const give=EV.filter(e=>!theirs.has(e.id)); if(give.length) sendEvents(reply, give.slice(-600));
      return;
    }
    if(m.t==='frwant'){ if(!Array.isArray(m.ids)) return; sendEvents(reply, m.ids.slice(0,600).map(id=>IDX.get(id)).filter(Boolean)); return; }
    if(m.t==='frev'){ if(Array.isArray(m.evs)) await ingest(m.evs.slice(0,60)); return; }
  }
  let ingestQ=Promise.resolve();
  function ingest(evs){ return ingestQ=ingestQ.then(async()=>{
    const fresh=[];
    for(const e of evs){ if(!e || IDX.has(e.id)) continue; if(await verify(e)){ const c={v:1,id:e.id,kind:e.kind,rid:e.rid,author:e.author,apub:e.apub,name:e.name,ts:e.ts,data:e.data,sig:e.sig}; EV.push(c); IDX.set(c.id,c); fresh.push(c); } }
    if(!fresh.length) return;
    save(); rebuild(); broadcast({t:'frev', evs:fresh}); notifyAbout(fresh); refresh();
  }).catch(()=>{}); }
  function broadcast(m){
    try{ if(typeof CHAT!=='undefined' && CHAT.frBroadcast) CHAT.frBroadcast(m); }catch(e){}
    try{ if(typeof gameFrBroadcast==='function') gameFrBroadcast(m); }catch(e){}
  }

  /* ---------- lästa / olästa ---------- */
  let SEEN=ld('seen',{});
  function markSeen(rid){ if(!rid) return; SEEN[rid]=Date.now(); sv('seen',SEEN); }
  const concernsMe = r => ME && (r.author===ME.id || r.people.has(ME.id) || r.votes.has(ME.id));
  const unreadOf = r => r.last > (SEEN[r.id]||0) && (concernsMe(r) || !SEEN[r.id]) && !(ME && r.timeline[r.timeline.length-1].e.author===ME.id);
  function unreadCount(){ return Object.values(STATE.reqs).filter(unreadOf).length; }
  function notifyAbout(evs){
    if(!ME) return;
    for(const e of evs){
      if(e.author===ME.id) continue;
      const r=STATE.reqs[e.kind==='req'?e.id:e.rid]; if(!r) continue;
      if(view==='fr' && openId===r.id) { markSeen(r.id); continue; }
      let text=null;
      if(e.kind==='st' && r.author===ME.id) text=`${STATUS[e.data.status][0]} ${r.title}: ${STATUS[e.data.status][1]}`;
      else if(e.kind==='cmt' && concernsMe(r)) text=`${e.name}: ${e.data.text.slice(0,70)}`;
      else if(e.kind==='req' && isMaint(ME.id)) text=`Ny önskan från ${e.name}: ${r.title}`;
      if(text) notice({icon:'💡', title:'Önskelistan '+r.key, text, actions:[{label:'Visa', run:()=>open(r.id)}], ms:9000});
    }
  }

  /* =====================================================================
     UTSEENDE
     ===================================================================== */
  let openId=null, filter='open', mode=null, draft={type:'feature', area:'Allmänt', title:'', desc:''};
  const fmt = t => new Date(t).toLocaleString('sv-SE',{day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
  const ago = t => { const s=(Date.now()-t)/1000; return s<60?'nyss':s<3600?Math.floor(s/60)+' min sedan':s<86400?Math.floor(s/3600)+' tim sedan':Math.floor(s/86400)+' d sedan'; };
  const chip = s => `<span class="fr-st" style="--c:${STATUS[s][3]}">${STATUS[s][0]} ${STATUS[s][1]}</span>`;
  const who = (id,name) => `${esc(name)}${isMaint(id)?' <span class="fr-dev">utvecklare</span>':''}`;
  const para = t => esc(t).replace(/\n/g,'<br>');

  function html(){
    return `<div id="frRoot" class="fr">${topHTML()}<div class="fr-body">${openId && STATE.reqs[openId] ? detailHTML(STATE.reqs[openId]) : mode==='new' ? formHTML() : mode==='about' ? aboutHTML() : listHTML()}</div></div>`;
  }
  function topHTML(){
    const back = openId||mode ? `<button class="iconbtn" data-fr="back" aria-label="Tillbaka">‹</button>` : `<button class="iconbtn" data-act="lobby" aria-label="Lobby">‹</button>`;
    return `<div class="topbar">${back}<div class="tb-title">💡 <b>Önskelistan</b></div><button class="iconbtn" data-fr="about" aria-label="Om önskelistan">ℹ️</button></div>`;
  }
  function listHTML(){
    const all=Object.values(STATE.reqs).sort((a,b)=>b.last-a.last);
    const F={open:['Öppna', r=>OPEN.includes(r.status)], mine:['Mina', r=>ME && r.author===ME.id], done:['Klara', r=>r.status==='done'], closed:['Stängda', r=>['rejected','duplicate','withdrawn'].includes(r.status)], all:['Alla', ()=>true]};
    const list=all.filter(F[filter][1]);
    const counts={}; Object.keys(STATUS).forEach(s=>counts[s]=all.filter(r=>r.status===s).length);
    return `<button class="bigbtn fr-new" data-fr="new">＋ Ny önskan</button>
      <div class="fr-filters">${Object.entries(F).map(([k,[l,f]])=>`<button class="${filter===k?'on':''}" data-fr="filter" data-f="${k}">${l} <i>${all.filter(f).length}</i></button>`).join('')}</div>
      ${list.length ? list.map(r=>`<button class="fr-card ${unreadOf(r)?'unread':''}" data-fr="open" data-id="${r.id}">
          <div class="fr-c1"><span class="fr-key">${r.key}</span>${chip(r.status)}${r.prio==='high'?'<span class="fr-prio">🔥</span>':''}<span class="fr-ago">${ago(r.last)}</span></div>
          <div class="fr-title">${TYPES[r.type][0]} ${esc(r.title)}</div>
          <div class="fr-c3"><span>${esc(r.area)}</span><span>av ${esc(r.name)}</span><span>👍 ${r.votes.size}</span><span>💬 ${r.comments}</span></div></button>`).join('')
        : `<div class="fr-empty">${filter==='open'?'Inga öppna önskningar just nu.<br>Har du en idé? Tryck på <b>＋ Ny önskan</b>!':'Inget här än.'}</div>`}
      <div class="fr-foot">Önskelistan delas med dem du spelar och chattar med. <button class="fr-link" data-fr="about">Hur funkar det?</button></div>`;
  }
  function formHTML(){
    return `<div class="fr-form"><h2>💡 Ny önskan</h2>
      <label>Vad gäller det?</label><div class="fr-chips">${Object.entries(TYPES).map(([k,[i,l]])=>`<button data-fr="type" data-t="${k}" class="${draft.type===k?'sel':''}">${i} ${l}</button>`).join('')}</div>
      <label>Vilken del av appen?</label><div class="fr-chips">${AREAS.map(a=>`<button data-fr="area" data-a="${esc(a)}" class="${draft.area===a?'sel':''}">${esc(a)}</button>`).join('')}</div>
      <label for="frTitle">Rubrik</label><input id="frTitle" maxlength="90" value="${esc(draft.title)}" placeholder="${draft.type==='bug'?'t.ex. Tärningarna fastnar ibland':'t.ex. Ett kortspel till – Finns i sjön'}">
      <label for="frDesc">Beskriv – vad vill du ska hända, och varför?</label><textarea id="frDesc" maxlength="2000" rows="6" placeholder="${draft.type==='bug'?'Vad gjorde du? Vad hände? Vad borde ha hänt?':'Berätta så mycket du vill 🙂'}">${esc(draft.desc)}</textarea>
      <label for="frName">Ditt namn</label><input id="frName" maxlength="20" value="${esc(myName())}" placeholder="Ditt namn">
      <div class="btns"><button data-fr="back">Avbryt</button><button class="pri" data-fr="submit">Skicka önskan 🚀</button></div></div>`;
  }
  function detailHTML(r){
    markSeen(r.id);
    const mine = ME && r.author===ME.id, m = ME && isMaint(ME.id), voted = ME && r.votes.has(ME.id);
    const dupR = r.dup && STATE.reqs[r.dup];
    const tl=r.timeline.map(x=>{
      const e=x.e;
      if(x.t==='created') return `<div class="fr-ev"><span class="fr-dot">🌱</span><div><b>${who(e.author,e.name)}</b> önskade detta <span class="fr-when">${fmt(e.ts)}</span></div></div>`;
      if(x.t==='edit') return `<div class="fr-ev"><span class="fr-dot">✏️</span><div><b>${who(e.author,e.name)}</b> ändrade texten <span class="fr-when">${fmt(e.ts)}</span></div></div>`;
      if(x.t==='st') return `<div class="fr-ev"><span class="fr-dot">${STATUS[e.data.status][0]}</span><div><b>${who(e.author,e.name)}</b> ändrade status ${chip(x.from)} → ${chip(e.data.status)}${e.data.prio?` · prioritet ${PRIO[e.data.prio][0]} ${PRIO[e.data.prio][1]}`:''} <span class="fr-when">${fmt(e.ts)}</span>${e.data.note?`<div class="fr-note">${para(e.data.note)}</div>`:''}</div></div>`;
      return `<div class="fr-cmt ${x.m?'dev':''} ${ME&&e.author===ME.id?'me':''}"><div class="fr-cmh"><b>${who(e.author,e.name)}</b><span class="fr-when">${fmt(e.ts)}</span></div><div>${para(e.data.text)}</div></div>`;
    }).join('');
    return `<div class="fr-detail">
      <div class="fr-c1"><span class="fr-key big">${r.key}</span>${chip(r.status)}<span class="fr-prio">${PRIO[r.prio][0]} ${PRIO[r.prio][1]}</span></div>
      <h2>${TYPES[r.type][0]} ${esc(r.title)}</h2>
      <div class="fr-meta">${TYPES[r.type][1]} · ${esc(r.area)} · önskad av <b>${who(r.author,r.name)}</b> ${ago(r.ts)}</div>
      <div class="fr-stx">${STATUS[r.status][2]}${dupR?` – se <button class="fr-link" data-fr="open" data-id="${dupR.id}">${dupR.key} ${esc(dupR.title)}</button>`:''}</div>
      ${r.desc?`<div class="fr-desc">${para(r.desc)}</div>`:''}
      <div class="fr-acts"><button class="${voted?'on':''}" data-fr="vote">👍 ${voted?'Du vill också':'Jag vill också'} · ${r.votes.size}</button>
        ${mine && r.status!=='withdrawn' ? '<button data-fr="edit">✏️ Ändra</button><button data-fr="withdraw">↩️ Återkalla</button>' : ''}
        ${mine && r.status==='withdrawn' ? '<button data-fr="reopen">🔓 Öppna igen</button>' : ''}</div>
      ${m ? manageHTML(r) : ''}
      <h3>Historik och dialog</h3><div class="fr-tl">${tl}</div>
      <div class="fr-reply"><textarea id="frCmt" rows="2" maxlength="1000" placeholder="${mine?'Svara eller lägg till något…':'Skriv en kommentar eller fråga…'}"></textarea><button class="pri" data-fr="comment">Skicka</button></div></div>`;
  }
  function manageHTML(r){
    const issue=`${REPO}/issues/new?`+new URLSearchParams({title:`[${r.key}] ${r.title}`, body:`${TYPES[r.type][1]} · ${r.area}\nÖnskad av: ${r.name} (${fmt(r.ts)})\n\n${r.desc}\n\n---\nFrån Önskelistan i appen, ärende ${r.key} (${r.id}).`}).toString();
    const others=Object.values(STATE.reqs).filter(x=>x.id!==r.id).sort((a,b)=>b.ts-a.ts).slice(0,40);
    return `<div class="fr-manage"><div class="fr-mh">🛠️ Utvecklare</div>
      <label>Ny status</label><div class="fr-chips">${Object.entries(STATUS).filter(([k])=>k!=='withdrawn').map(([k,[i,l]])=>`<button data-fr="pick" data-s="${k}" class="${r.status===k?'sel':''}">${i} ${l}</button>`).join('')}</div>
      <label>Prioritet</label><div class="fr-chips">${Object.entries(PRIO).map(([k,[i,l]])=>`<button data-fr="prio" data-p="${k}" class="${(pend.prio||r.prio)===k?'sel':''}">${i} ${l}</button>`).join('')}</div>
      <div id="frDupBox" style="${pend.status==='duplicate'?'':'display:none'}"><label>Dubblett av</label><select id="frDup">${others.map(o=>`<option value="${o.id}">${o.key} ${esc(o.title.slice(0,40))}</option>`).join('')}</select></div>
      <label for="frNote">Motivering / meddelande (syns för alla)</label><textarea id="frNote" rows="2" maxlength="500" placeholder="${pend.status==='rejected'?'Varför blir det inte av?':'Valfritt'}"></textarea>
      <div class="btns"><a class="fr-gh" href="${esc(issue)}" target="_blank" rel="noopener">Skapa GitHub-issue ↗</a><button class="pri" data-fr="setstatus">Spara status</button></div></div>`;
  }
  let pend={};
  function aboutHTML(){
    return `<div class="fr-about"><h2>Om önskelistan</h2>
      <p>Här kan alla som använder appen önska nya funktioner, rapportera buggar och följa vad som händer. Varje önskan blir ett eget ärende med ett unikt nummer.</p>
      <h3>Statusar</h3><div class="fr-legend">${Object.entries(STATUS).map(([k,v])=>`<div>${chip(k)}<span>${v[2]}</span></div>`).join('')}</div>
      <h3>Vem gör vad?</h3><p>Alla kan önska, kommentera och trycka 👍. Den som önskat kan ändra sin text eller återkalla önskan. Utvecklaren sätter status och prioritet och svarar i dialogen.</p>
      <h3>Hur delas listan?</h3><p>Det finns ingen server. Önskningarna sparas på varje mobil och skickas vidare – signerade så att ingen kan ändra någon annans text – när ni chattar eller spelar online med varandra.</p>
      <h3>Ditt önske-ID</h3><div class="fr-id">${ME?ME.id.match(/.{4}/g).join(' '):'skapas när du skickar något'}</div>${ME?'<div class="btns" style="margin-top:8px"><button data-fr="copyid">📋 Kopiera ID</button></div>':''}
      <p class="setnote">Ska du vara utvecklare? Skicka ditt önske-ID, så läggs det in i appen.</p>
      ${ME && isMaint(ME.id) ? `<h3>Utvecklare</h3><div class="fr-legend">${[...STATE.maint].map(id=>`<div><code>${id}</code></div>`).join('')}</div>
        <label for="frRole">Lägg till utvecklare (önske-ID)</label><div class="fr-row"><input id="frRole" maxlength="19" placeholder="xxxx xxxx xxxx xxxx"><button data-fr="addmaint">Lägg till</button></div>`:''}
      ${ME?'':'<div class="btns"><button class="pri" data-fr="mkid">Skapa mitt önske-ID</button></div>'}</div>`;
  }

  /* ---------- rita om ---------- */
  function refresh(){
    if(typeof updateFrBadge==='function') updateFrBadge();
    if(view!=='fr') return;
    const root=document.getElementById('frRoot'); if(!root){ render(); return; }
    // skriv inte över det användaren håller på att skriva
    const a=document.activeElement; if(a && /^(frCmt|frTitle|frDesc|frNote|frName|frRole)$/.test(a.id) && a.value) { const tl=root.querySelector('.fr-tl'); if(tl && openId && STATE.reqs[openId]){ const tmp=document.createElement('div'); tmp.innerHTML=detailHTML(STATE.reqs[openId]); const ntl=tmp.querySelector('.fr-tl'); if(ntl) tl.innerHTML=ntl.innerHTML; } return; }
    const st=window.scrollY; root.outerHTML=html(); window.scrollTo(0,st);
  }
  function open(id){ if(typeof closeModal==='function') closeModal(); if(typeof CHAT!=='undefined' && CHAT.isOpen && CHAT.isOpen() && !CHAT.docked()) CHAT.close(); openId=id||null; mode=null; pend={}; view='fr'; render(); window.scrollTo(0,0); }

  /* ---------- klick ---------- */
  document.addEventListener('click', async e=>{
    const b=e.target.closest('[data-fr]'); if(!b) return;
    const a=b.dataset.fr;
    try{
      switch(a){
        case 'open': openId=b.dataset.id; mode=null; pend={}; refresh(); window.scrollTo(0,0); break;
        case 'back': if(mode==='new'){ draft.title=document.getElementById('frTitle')?.value||draft.title; draft.desc=document.getElementById('frDesc')?.value||draft.desc; } openId=null; mode=null; refresh(); break;
        case 'filter': filter=b.dataset.f; refresh(); break;
        case 'new': openId=null; mode='new'; refresh(); window.scrollTo(0,0); break;
        case 'about': openId=null; mode='about'; refresh(); window.scrollTo(0,0); break;
        case 'type': draft.type=b.dataset.t; keepForm(); refresh(); break;
        case 'area': draft.area=b.dataset.a; keepForm(); refresh(); break;
        case 'mkid': await me(); refresh(); break;
        case 'submit': {
          keepForm(); const name=cleanLine(document.getElementById('frName')?.value,20);
          if(draft.title.trim().length<3){ toast('Skriv en rubrik (minst 3 tecken) ✏️'); return; }
          await me(); if(name){ ME.name=name; sv('me',ME); lsSet('ry_name', lsGet('ry_name')||name); }
          const ev=await publish('req', null, draft);
          draft={type:'feature', area:'Allmänt', title:'', desc:''}; mode=null; openId=ev.id; refresh(); window.scrollTo(0,0);
          toast(`Tack! Din önskan har fått nummer ${keyOf(ev.id)} 🎉`,3500); if(typeof sparkles==='function') sparkles(20);
          break; }
        case 'comment': { const t=document.getElementById('frCmt')?.value||''; if(!t.trim()) return; await publish('cmt', openId, {text:t}); refresh(); break; }
        case 'vote': { await me(); const r=STATE.reqs[openId]; await publish('vote', openId, {on:!r.votes.has(ME.id)}); refresh(); break; }
        case 'withdraw': if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Säker? Tryck igen'; return; } await publish('st', openId, {status:'withdrawn'}); refresh(); break;
        case 'reopen': await publish('st', openId, {status:'new'}); refresh(); break;
        case 'edit': { const r=STATE.reqs[openId];
          openModal(`<h3>✏️ Ändra önskan ${r.key}</h3><label>Rubrik</label><input id="frEt" maxlength="90" value="${esc(r.title)}"><label>Beskrivning</label><textarea id="frEd" rows="6" maxlength="2000" style="width:100%">${esc(r.desc)}</textarea>
            <div class="btns"><button data-act="close">Avbryt</button><button class="pri" data-fr="saveedit">Spara</button></div>`,'fredit'); break; }
        case 'saveedit': { const t=document.getElementById('frEt')?.value||'', d=document.getElementById('frEd')?.value||''; if(cleanLine(t,90).length<3){ toast('Rubriken behövs'); return; } closeModal(); await publish('edit', openId, {title:t, desc:d}); refresh(); break; }
        case 'pick': pend.status=b.dataset.s; b.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('sel',x===b)); const box=document.getElementById('frDupBox'); if(box) box.style.display=pend.status==='duplicate'?'':'none'; break;
        case 'prio': pend.prio=b.dataset.p; b.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('sel',x===b)); break;
        case 'setstatus': { const r=STATE.reqs[openId]; const s=pend.status||r.status; const note=document.getElementById('frNote')?.value||'';
          if(s===r.status && !pend.prio && !note.trim()){ toast('Välj en ny status, prioritet eller skriv ett meddelande'); return; }
          if(s==='rejected' && !note.trim()){ toast('Skriv varför den avvisas – det är snällt att förklara 💙',3500); return; }
          await publish('st', openId, {status:s, note, prio:pend.prio||'', dup: s==='duplicate' ? document.getElementById('frDup')?.value : ''}); pend={}; refresh(); toast('Status sparad'); break; }
        case 'copyid': { const id=ME&&ME.id.match(/.{4}/g).join(' '); try{ await navigator.clipboard.writeText(id); toast('ID kopierat 📋'); }catch(e){ toast('Kunde inte kopiera – håll fingret på ID:t och välj Kopiera'); } break; }
        case 'addmaint': { const id=(document.getElementById('frRole')?.value||'').replace(/\s/g,'').toLowerCase(); if(!isHex(id,16)){ toast('Ett önske-ID är 16 tecken (0–9, a–f)'); return; } await publish('role', null, {target:id, add:true}); refresh(); toast('Utvecklare tillagd'); break; }
      }
    }catch(err){ console.error('fr',err); toast('Något gick fel – försök igen'); }
  });
  function keepForm(){ const t=document.getElementById('frTitle'), d=document.getElementById('frDesc'); if(t) draft.title=t.value; if(d) draft.desc=d.value; }

  /* ---------- stil ---------- */
  const st=document.createElement('style'); st.textContent=`
.fr .fr-body{padding:4px 2px 40px}
.fr .btns{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
.fr .btns > *, .fr-reply button, .fr-row button{flex:1;min-width:120px;padding:14px;border-radius:16px;font-weight:600;font-size:16px;text-align:center;background:rgba(255,255,255,.1);border:1px solid var(--line);color:var(--txt)}
.fr .btns .pri, .fr-reply .pri{background:linear-gradient(135deg,#22d3ee,#6366f1 60%,#a855f7);border:0;box-shadow:0 6px 18px rgba(99,102,241,.35)}
.fr-reply button{flex:none;min-width:90px}
.fr-new{background:linear-gradient(135deg,#f59e0b,#ec4899)!important}
.fr-filters{display:flex;gap:6px;overflow-x:auto;margin:6px 0 12px;padding-bottom:2px}
.fr-filters button{flex:none;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:rgba(0,0,0,.2);font-size:14px}
.fr-filters button.on{background:rgba(62,230,255,.18);border-color:var(--aqua)}
.fr-filters i{font-style:normal;opacity:.7;margin-left:3px}
.fr-card{display:block;width:100%;text-align:left;margin:0 0 10px;padding:12px 14px;border-radius:18px;background:rgba(8,20,60,.6);border:1px solid var(--line);position:relative}
.fr-card.unread::before{content:'';position:absolute;left:-4px;top:16px;width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444}
.fr-c1{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fr-key{font:700 12px/1 ui-monospace,monospace;letter-spacing:.5px;padding:4px 7px;border-radius:7px;background:rgba(255,255,255,.1)}
.fr-key.big{font-size:14px}
.fr-st{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:12.5px;font-weight:600;color:#fff;background:color-mix(in srgb,var(--c) 30%,transparent);border:1px solid var(--c)}
.fr-ago{margin-left:auto;font-size:12px;opacity:.7}
.fr-prio{font-size:13px;opacity:.9}
.fr-title{margin:8px 0 6px;font-size:17px;font-weight:600;line-height:1.3}
.fr-c3{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;opacity:.8}
.fr-empty{text-align:center;padding:30px 10px;opacity:.85;line-height:1.6}
.fr-foot{margin-top:18px;text-align:center;font-size:13px;opacity:.75}
.fr-link{color:var(--aqua);text-decoration:underline;font-size:inherit;padding:0}
.fr-form h2,.fr-detail h2,.fr-about h2{margin:8px 0 6px}
.fr-form label,.fr-manage label,.fr-about label{display:block;margin:14px 2px 6px;font-size:14px;color:var(--dim)}
.fr-form input,.fr-form textarea,.fr-reply textarea,.fr-manage textarea,.fr-manage select,.fr-about input,#frEt,#frEd{width:100%;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:rgba(0,0,0,.28);color:var(--txt);font:inherit;font-size:16px;outline:none;resize:vertical}
.fr-chips{display:flex;flex-wrap:wrap;gap:6px}
.fr-chips button{padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:rgba(0,0,0,.22);font-size:14px}
.fr-chips button.sel{background:rgba(62,230,255,.2);border-color:var(--aqua);box-shadow:0 0 0 1px var(--aqua)}
.fr-meta{font-size:14px;opacity:.85}
.fr-stx{margin:8px 0;font-size:14px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.06)}
.fr-desc{margin:12px 0;padding:14px;border-radius:16px;background:rgba(0,0,0,.25);line-height:1.5;overflow-wrap:anywhere}
.fr-acts{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.fr-acts button{padding:9px 14px;border-radius:999px;border:1px solid var(--line);background:rgba(0,0,0,.22);font-size:14px}
.fr-acts button.on{background:rgba(250,204,21,.2);border-color:#facc15}
.fr-manage{margin:14px 0;padding:14px;border-radius:18px;border:1px dashed #f59e0b;background:rgba(245,158,11,.08)}
.fr-mh{font-weight:700}
.fr-gh{display:inline-flex;align-items:center;padding:10px 14px;border-radius:14px;border:1px solid var(--line);font-size:14px;color:var(--txt);text-decoration:none}
.fr-tl{display:flex;flex-direction:column;gap:8px;margin:8px 0 14px;border-left:2px solid var(--line);padding-left:12px}
.fr-ev{display:flex;gap:8px;font-size:14px;line-height:1.5}
.fr-dot{flex:none;width:22px;text-align:center}
.fr-when{font-size:12px;opacity:.65;margin-left:4px}
.fr-note{margin-top:4px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.07)}
.fr-cmt{padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.07);line-height:1.45;overflow-wrap:anywhere}
.fr-cmt.dev{background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4)}
.fr-cmt.me{background:rgba(62,230,255,.1)}
.fr-cmh{display:flex;justify-content:space-between;gap:8px;margin-bottom:3px;font-size:13.5px}
.fr-dev{font-size:11px;padding:1px 6px;border-radius:999px;background:#f59e0b;color:#1e1b4b;font-weight:700}
.fr-reply{display:flex;gap:8px;align-items:flex-end}
.fr-reply button{padding:12px 16px;border-radius:14px;flex:none}
.fr-legend{display:flex;flex-direction:column;gap:6px}.fr-legend div{display:flex;gap:10px;align-items:center;font-size:14px}.fr-legend .fr-st{flex:none;min-width:118px}
.fr-id{user-select:text;-webkit-user-select:text;font:700 18px/1.5 ui-monospace,monospace;letter-spacing:1px;text-align:center;padding:10px;border-radius:12px;background:rgba(0,0,0,.3)}
.fr-row{display:flex;gap:8px}.fr-row button{padding:10px 14px;border-radius:14px;border:1px solid var(--line)}
.lob-foot{margin:26px 0 6px;text-align:center;font-size:13.5px;opacity:.75;display:flex;justify-content:center;gap:14px;flex-wrap:wrap}
.lob-foot button{color:var(--txt);text-decoration:underline;text-underline-offset:3px;font-size:inherit;position:relative}
.lob-foot .frb{display:none;margin-left:5px;padding:0 6px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;text-decoration:none}.lob-foot .frb.on{display:inline-block}
body.desk .fr .fr-body{max-width:760px;margin:0 auto}
`; document.head.appendChild(st);

  return { html, open, onMsg, onConnect, unread:unreadCount, refresh, myId:()=>ME&&ME.id,
    __test: (typeof DEV!=='undefined' && DEV) ? {publish, state:()=>STATE, events:()=>EV, me, addRoot:id=>{ FR_ROOT.push(id); rebuild(); refresh(); }} : undefined };
})();
