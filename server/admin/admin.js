/* Admingränssnitt för spelservern: användare, inbjudningar, statistik och händelselogg. */
'use strict';
(function(){
  const $=s=>document.querySelector(s), app=$('#app');
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const fmtN=n=>Math.round(n||0).toLocaleString('sv-SE');
  const fmtT=t=>t?new Date(t).toLocaleString('sv-SE',{dateStyle:'short',timeStyle:'short'}):'–';
  const fmtD=t=>t?new Date(t).toLocaleDateString('sv-SE'):'–';
  const dur=ms=>{ const m=Math.floor(ms/60000), h=Math.floor(m/60), d=Math.floor(h/24); return d?`${d} d ${h%24} h`:h?`${h} h ${m%60} min`:`${m} min`; };
  const mins=s=>s>=3600?`${(s/3600).toFixed(1).replace('.',',')} h`:`${Math.round(s/60)} min`;
  const COLORS=['#38bdf8','#f472b6','#a3e635','#f59e0b','#a78bfa','#34d399','#fb7185','#facc15','#60a5fa','#f97316','#2dd4bf','#e879f9'];
  let TOK=sessionStorage.getItem('adm')||'', ME=sessionStorage.getItem('admu')||'', tab='overview', lastLink=null;

  function toast(t){ const el=$('#toast'); el.textContent=t; el.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>el.style.display='none',3500); }
  async function api(p, body){
    const r=await fetch('/admin/api/'+p,{method:body?'POST':'GET', headers:{'Authorization':'Bearer '+TOK, ...(body?{'Content-Type':'application/json'}:{})}, body:body?JSON.stringify(body):undefined, cache:'no-store'});
    if(r.status===401||r.status===403){ TOK=''; sessionStorage.removeItem('adm'); login(); throw new Error('utloggad'); }
    const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Något gick fel'); return j;
  }

  /* ---------- inloggning ---------- */
  function login(msg){
    app.innerHTML=`<div class="login card"><h1 style="font-size:22px">🛡️ Spelservern</h1><p class="muted">Administration – logga in med ditt användarnamn och koden från din TOTP-app. Kontot måste vara admin.</p>
      <input id="lu" placeholder="Användarnamn" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(ME)}">
      <input id="lc" class="code" placeholder="000000" inputmode="numeric" autocomplete="one-time-code" maxlength="6">
      <div class="err" id="le">${esc(msg||'')}</div><button class="b pri" id="lg" style="width:100%;padding:11px">Logga in</button></div>`;
    const u=$('#lu'), c=$('#lc'), go=$('#lg'); (ME?c:u).focus();
    const run=async()=>{ if(go.disabled) return; go.disabled=true; $('#le').textContent='Loggar in…';
      try{ const r=await fetch('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:u.value.trim(),code:c.value.trim()})}); const j=await r.json().catch(()=>({}));
        if(!r.ok){ $('#le').textContent=j.error||'Det gick inte'; go.disabled=false; c.value=''; c.focus(); return; }
        TOK=j.token; ME=j.user; sessionStorage.setItem('adm',TOK); sessionStorage.setItem('admu',ME); shell(); }
      catch(e){ $('#le').textContent='Når inte servern'; go.disabled=false; } };
    c.addEventListener('input',()=>{ c.value=c.value.replace(/\D/g,'').slice(0,6); if(c.value.length===6 && u.value.trim()) run(); });
    go.addEventListener('click',run); [u,c].forEach(x=>x.addEventListener('keydown',e=>{ if(e.key==='Enter') run(); }));
  }

  /* ---------- ram ---------- */
  const TABS=[['overview','📊 Översikt'],['users','👥 Användare'],['invites','✉️ Inbjudningar'],['audit','📜 Händelser']];
  function shell(){
    app.innerHTML=`<header><h1>🛡️ Spelservern <span>· admin</span></h1><span class="muted">${esc(ME)}</span><button class="b" id="out">Logga ut</button></header>
      <nav>${TABS.map(([k,l])=>`<button data-tab="${k}" class="${tab===k?'on':''}">${l}</button>`).join('')}</nav><main id="main"><p class="muted">Laddar…</p></main>`;
    $('#out').onclick=async()=>{ try{ await api('logout',{}); }catch(e){} TOK=''; sessionStorage.removeItem('adm'); login(); };
    app.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; lastLink=null; shell(); });
    ({overview,users,invites,audit})[tab]().catch(e=>{ if(e.message!=='utloggad') $('#main').innerHTML=`<p class="err">${esc(e.message)}</p>`; });
  }

  /* ---------- översikt ---------- */
  async function overview(){
    const o=await api('overview'), days=o.days, names=o.names||{};
    const totals={}; let games=0, logins=0, msgs=0, calls=0, csec=0;
    for(const d of days){ logins+=d.logins; msgs+=d.mbox; calls+=d.calls.n; csec+=d.calls.sec; for(const [g,m] of Object.entries(d.games)){ const n=Object.values(m).reduce((a,b)=>a+b,0); totals[g]=(totals[g]||0)+n; games+=n; } }
    const top=Object.entries(totals).sort((a,b)=>b[1]-a[1]), keys=top.map(([k])=>k), col=k=>COLORS[keys.indexOf(k)%COLORS.length], title=k=>names[k]||k;
    const today=days[days.length-1];
    const modes={solo:0,ai:0,online:0}; for(const d of days) for(const m of Object.values(d.games)) for(const [k,v] of Object.entries(m)) modes[k]=(modes[k]||0)+v;
    $('#main').innerHTML=`
      <div class="grid">
        ${kpi(o.onlineUsers.length,'online just nu',o.onlineUsers.map(esc).join(', ')||'ingen')}
        ${kpi(o.users,'användare',`${o.admins} admin · ${o.sessions} inloggade enheter`)}
        ${kpi(Object.values(today.games).reduce((a,m)=>a+Object.values(m).reduce((x,y)=>x+y,0),0),'spelomgångar i dag',`${fmtN(games)} senaste 30 dagarna`)}
        ${kpi(o.peers.game,'aktiva spelanslutningar',`${o.peers.chat} chattanslutningar`)}
        ${kpi(o.pending,'meddelanden väntar',`${fmtN(msgs)} via brevlådan på 30 dagar`)}
        ${kpi(calls,'samtal (30 dagar)',`${mins(csec)} totalt`)}
        ${kpi(o.invites,'öppna inbjudningar','')}
        ${kpi(dur(o.uptime),'upptid',`${Math.round(o.mem/1048576)} MB minne`)}
      </div>
      <div class="row2">
        <div class="card"><h2>Spelomgångar per dag (30 dagar)</h2>${stacked(days,keys,col)}<div class="legend">${keys.slice(0,12).map(k=>`<span><i style="background:${col(k)}"></i>${esc(title(k))}</span>`).join('')}</div></div>
        <div class="card"><h2>Populäraste spelen</h2><div class="bars">${top.length?top.slice(0,12).map(([k,n])=>`<div class="bar"><span title="${esc(title(k))}">${esc(title(k))}</span><div style="width:${Math.max(4,n/top[0][1]*100)}%;background:${col(k)}"></div><b>${n}</b></div>`).join(''):'<p class="muted">Inga spel ännu.</p>'}</div>
          <h2 style="margin-top:16px">Hur man spelar</h2><div class="bars">${[['online','Online med andra'],['ai','Mot datorn'],['solo','Ensam']].map(([k,l])=>`<div class="bar"><span>${l}</span><div style="width:${games?Math.max(4,(modes[k]||0)/games*100):4}%"></div><b>${modes[k]||0}</b></div>`).join('')}</div></div>
      </div>
      <div class="row2">
        <div class="card"><h2>Inloggningar och meddelanden per dag</h2>${lines(days)}<div class="legend"><span><i style="background:#38bdf8"></i>inloggningar</span><span><i style="background:#f472b6"></i>meddelanden via brevlådan</span><span><i style="background:#a3e635"></i>samtal</span></div></div>
        <div class="card"><h2>Aktivast i dag</h2>${Object.keys(today.users).length?`<table><tr><th>Användare</th><th class="n">Spel</th><th class="n">Samtal</th></tr>${Object.entries(today.users).sort((a,b)=>b[1].games-a[1].games).map(([u,x])=>`<tr><td>${esc(u)}</td><td class="n">${x.games}</td><td class="n">${x.calls}</td></tr>`).join('')}</table>`:'<p class="muted">Ingen aktivitet ännu i dag.</p>'}</div>
      </div>`;
  }
  const kpi=(v,l,sub)=>`<div class="card kpi"><b>${typeof v==='number'?fmtN(v):esc(v)}</b><div>${esc(l)}</div><small>${sub}</small></div>`;
  function stacked(days,keys,col){
    const W=640,H=200,P=24, bw=(W-P)/days.length; let max=1; const vals=days.map(d=>{ const r={}; let t=0; for(const [g,m] of Object.entries(d.games)){ const n=Object.values(m).reduce((a,b)=>a+b,0); r[g]=n; t+=n; } max=Math.max(max,t); return r; });
    let svg=`<svg viewBox="0 0 ${W} ${H+18}" style="width:100%;height:auto">`;
    for(let i=0;i<=4;i++){ const y=H-(H-10)*i/4; svg+=`<line x1="${P}" x2="${W}" y1="${y}" y2="${y}" stroke="#25304f"/><text x="${P-4}" y="${y+4}" fill="#94a0c0" font-size="10" text-anchor="end">${Math.round(max*i/4)}</text>`; }
    vals.forEach((r,i)=>{ let y=H; for(const k of keys){ const n=r[k]||0; if(!n) continue; const h=(H-10)*n/max; y-=h; svg+=`<rect x="${P+i*bw+1}" y="${y}" width="${Math.max(1,bw-2)}" height="${h}" fill="${col(k)}" rx="2"><title>${esc(days[i].day)}: ${n}</title></rect>`; }
      if(i%5===0||i===days.length-1) svg+=`<text x="${P+i*bw+bw/2}" y="${H+14}" fill="#94a0c0" font-size="10" text-anchor="middle">${days[i].day.slice(5)}</text>`; });
    return svg+'</svg>';
  }
  function lines(days){
    const W=640,H=160,P=24, series=[[d=>d.logins,'#38bdf8'],[d=>d.mbox,'#f472b6'],[d=>d.calls.n,'#a3e635']];
    let max=1; for(const [f] of series) for(const d of days) max=Math.max(max,f(d));
    const x=i=>P+(W-P)*i/(days.length-1), y=v=>H-(H-10)*v/max;
    let svg=`<svg viewBox="0 0 ${W} ${H+18}" style="width:100%;height:auto">`;
    for(let i=0;i<=4;i++){ const yy=H-(H-10)*i/4; svg+=`<line x1="${P}" x2="${W}" y1="${yy}" y2="${yy}" stroke="#25304f"/><text x="${P-4}" y="${yy+4}" fill="#94a0c0" font-size="10" text-anchor="end">${Math.round(max*i/4)}</text>`; }
    for(const [f,c] of series) svg+=`<polyline fill="none" stroke="${c}" stroke-width="2" points="${days.map((d,i)=>x(i)+','+y(f(d))).join(' ')}"/>`;
    days.forEach((d,i)=>{ if(i%5===0||i===days.length-1) svg+=`<text x="${x(i)}" y="${H+14}" fill="#94a0c0" font-size="10" text-anchor="middle">${d.day.slice(5)}</text>`; });
    return svg+'</svg>';
  }

  /* ---------- användare ---------- */
  async function users(){
    const {users:list}=await api('users');
    $('#main').innerHTML=`${linkBox()}<div class="card scroll"><h2>Användare (${list.length})</h2>
      ${list.length?`<table><tr><th>Namn</th><th>Status</th><th>Senast inloggad</th><th class="n">Enheter</th><th class="n">Spel 30 d</th><th class="n">Samtal 30 d</th><th class="n">Väntande</th><th>Åtgärder</th></tr>
      ${list.map(u=>`<tr><td><span class="dot ${u.online?'on':''}" title="${u.online?'online':'offline'}"></span><b>${esc(u.name)}</b>${u.admin?'<span class="tag acc">admin</span>':''}</td>
        <td>${u.disabled?'<span class="tag bad">avstängd</span>':'<span class="tag ok">aktiv</span>'}</td><td>${fmtT(u.lastLogin)}</td><td class="n">${u.sessions}</td>
        <td class="n">${u.last30.games}</td><td class="n">${u.last30.calls}${u.last30.sec?` <span class="muted">(${mins(u.last30.sec)})</span>`:''}</td><td class="n">${u.pending}</td>
        <td>${u.name===ME?'<span class="muted">du</span>':`
          <button class="b" data-u="${esc(u.name)}" data-a="logout" title="Logga ut på alla enheter">⏏ Logga ut</button>
          <button class="b" data-u="${esc(u.name)}" data-a="reset" title="Ny inbjudningslänk med ny TOTP-nyckel">🔑 Ny nyckel</button>
          <button class="b" data-u="${esc(u.name)}" data-a="${u.disabled?'enable':'disable'}">${u.disabled?'▶ Slå på':'⏸ Stäng av'}</button>
          <button class="b" data-u="${esc(u.name)}" data-a="${u.admin?'unadmin':'admin'}">${u.admin?'Ta bort admin':'Gör till admin'}</button>
          <button class="b red" data-u="${esc(u.name)}" data-a="remove">🗑 Ta bort</button>`}</td></tr>`).join('')}</table>`:'<p class="muted">Inga användare ännu. Skapa en inbjudan under Inbjudningar.</p>'}
      <p class="muted" style="font-size:13px">Grön prick = uppkopplad just nu. "Väntande" = krypterade meddelanden i brevlådan som användaren inte har hämtat än.</p></div>`;
    $('#main').querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{
      const u=b.dataset.u, a=b.dataset.a, Q={remove:`Ta bort ${u}? Kontot och väntande meddelanden raderas.`, disable:`Stänga av ${u}? Personen loggas ut och kan inte logga in.`, reset:`Skapa en ny nyckel för ${u}? Alla enheter loggas ut och personen behöver öppna en ny inbjudningslänk.`, logout:`Logga ut ${u} på alla enheter?`, admin:`Göra ${u} till admin?`, unadmin:`Ta bort admin från ${u}?`};
      if(Q[a] && !confirm(Q[a])) return;
      try{ const dev=a==='reset' && confirm('Gäller länken testversionen (dev)? OK = testversionen, Avbryt = vanliga versionen.');
        const r=await api(`users/${encodeURIComponent(u)}/${a}`,{dev}); if(r.link) lastLink={user:u, link:r.link}; toast('Klart'); users(); }
      catch(e){ if(e.message!=='utloggad') toast(e.message); }
    });
  }

  /* ---------- inbjudningar ---------- */
  function linkBox(){ if(!lastLink) return ''; let qr=''; try{ const q=qrcode(0,'M'); q.addData(lastLink.link,'Byte'); q.make(); qr=q.createSvgTag({cellSize:4,margin:2,scalable:true}); }catch(e){}
    return `<div class="card linkbox"><b>Inbjudningslänk till ${esc(lastLink.user)}</b> <span class="muted">(gäller 7 dagar, en gång)</span><div style="margin:8px 0"><code id="lnk">${esc(lastLink.link)}</code></div>
      <button class="b pri" id="cp">📋 Kopiera länken</button> <span class="muted">Skicka den i ett krypterat meddelande, eller låt personen skanna QR-koden med telefonen.</span>${qr?`<div class="qr">${qr}</div>`:''}</div>`; }
  function bindLink(){ const b=$('#cp'); if(b) b.onclick=async()=>{ try{ await navigator.clipboard.writeText(lastLink.link); toast('Kopierad'); }catch(e){ const r=document.createRange(); r.selectNodeContents($('#lnk')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Markerad – kopiera med Ctrl/Cmd+C'); } }; }
  async function invites(){
    const {invites:list}=await api('invites');
    $('#main').innerHTML=`<div class="card"><h2>Ny inbjudan</h2><p class="muted">Konton kan bara skapas via inbjudningslänkar. Den som öppnar länken lägger in en egen nyckel i sin TOTP-app och bekräftar med en kod.</p>
        <input id="in" placeholder="Användarnamn, t.ex. elsa" autocapitalize="none" spellcheck="false" maxlength="32">
        <label class="chk"><input type="checkbox" id="idev"> testversionen (dev)</label><label class="chk"><input type="checkbox" id="iadm"> admin</label>
        <button class="b pri" id="ig">Skapa länk</button><div class="err" id="ie"></div></div>
      ${linkBox()}
      <div class="card" style="margin-top:12px"><h2>Öppna inbjudningar (${list.length})</h2>${list.length?`<table><tr><th>Namn</th><th>Typ</th><th>Skapad</th><th>Går ut</th><th>Status</th><th></th></tr>
        ${list.map(x=>`<tr><td><b>${esc(x.user)}</b>${x.admin?'<span class="tag acc">admin</span>':''}</td><td>${x.reset?'ny nyckel':'nytt konto'}${x.dev?' · dev':''}</td><td>${fmtD(x.created)}</td><td>${fmtT(x.exp)}</td>
          <td>${x.started?'<span class="tag warn">öppnad, ej klar</span>':'<span class="tag">ej öppnad</span>'}</td><td><button class="b red" data-r="${esc(x.user)}">Dra tillbaka</button></td></tr>`).join('')}</table>`:'<p class="muted">Inga öppna inbjudningar.</p>'}
        <p class="muted" style="font-size:13px">Länken visas bara när den skapas. Har den kommit bort: dra tillbaka och skapa en ny.</p></div>`;
    bindLink();
    const go=async()=>{ $('#ie').textContent=''; const name=$('#in').value.trim().toLowerCase(); if(!name) return;
      try{ const r=await api('invites',{name, dev:$('#idev').checked, admin:$('#iadm').checked}); lastLink={user:name, link:r.link}; invites(); }
      catch(e){ if(e.message!=='utloggad') $('#ie').textContent=e.message; } };
    $('#ig').onclick=go; $('#in').addEventListener('keydown',e=>{ if(e.key==='Enter') go(); });
    $('#main').querySelectorAll('[data-r]').forEach(b=>b.onclick=async()=>{ if(!confirm(`Dra tillbaka inbjudan till ${b.dataset.r}?`)) return; try{ await api('invites/revoke',{name:b.dataset.r}); lastLink=null; invites(); }catch(e){ toast(e.message); } });
  }

  /* ---------- händelser ---------- */
  async function audit(){
    const {audit:list}=await api('audit');
    $('#main').innerHTML=`<div class="card"><h2>Händelser</h2><p class="muted">Inloggningar i admin, ändringar av konton och nya konton. De senaste 200.</p>
      <ul class="audit">${list.map(x=>`<li><span class="muted">${fmtT(x.at)}</span> · <b>${esc(x.who)}</b> ${esc(x.what)}</li>`).join('')||'<li class="muted">Inget ännu.</li>'}</ul></div>`;
  }

  setInterval(()=>{ if(TOK && tab==='overview' && !document.hidden) overview().catch(()=>{}); }, 30000);
  TOK ? shell() : login();
})();
