/* ---------- Säkerhetskopia och flytt till ny enhet ----------
   Allt (chattnycklar, kontakter, meddelanden, sparade spel, rekord, inställningar) ligger bara på enheten.
   Här krypteras det med en lösenfras (PBKDF2-SHA256 + AES-GCM) innan det lämnar telefonen – som fil eller
   på servern. Servern ser bara chiffertext. Utan lösenfrasen går kopian inte att öppna, inte ens för oss. */
const BK = (() => {
  const IT = 310000, enc = new TextEncoder(), dec = new TextDecoder();
  const SKIP = new Set(['srv_tok', 'bk_auto', 'ntf_sync', 'dirpub', 'call_pill']);
  const b64 = a => { let s = ''; const u = new Uint8Array(a); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const r = atob(s), a = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; };
  const ENV = () => DEV ? 'dev' : 'prod';

  // vilka nycklar i localStorage som hör till just den här appen (dev och vanlig app hålls isär, ekokompisen tas inte med)
  function mine(k) {
    if (!k.startsWith(LSP)) return null;
    const rest = k.slice(LSP.length);
    if (!LSP && (rest.startsWith('dev:') || rest.startsWith('bot:'))) return null;
    if (LSP === 'dev:' && rest.startsWith('bot:')) return null;
    return SKIP.has(rest) ? null : rest;
  }
  function collect() {
    const keys = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), r = mine(k); if (r !== null) keys[r] = localStorage.getItem(k); }
    return keys;
  }
  async function derive(pass, salt, it) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: it }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  async function seal(key, salt, it) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const body = enc.encode(JSON.stringify({ v: 1, at: Date.now(), env: ENV(), ver: APP_VERSION, keys: collect() }));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, body);
    return { v: 1, app: 'fl', kdf: 'pbkdf2', it, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  async function open(box, pass) {
    if (!box || box.v !== 1 || box.app !== 'fl') throw new Error('Det här är inte en säkerhetskopia från spelet');
    const key = await derive(pass, unb64(box.salt), box.it);
    let pt; try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct)); }
    catch (e) { throw new Error('Fel lösenfras'); }
    return JSON.parse(dec.decode(pt));
  }
  // automatisk kopia: nyckeln (inte lösenfrasen) sparas på enheten
  const autoGet = () => { try { return JSON.parse(lsGet('bk_auto') || 'null'); } catch (e) { return null; } };
  async function autoKey() { const a = autoGet(); if (!a) return null; return { key: await crypto.subtle.importKey('raw', unb64(a.k), { name: 'AES-GCM' }, false, ['encrypt']), salt: unb64(a.s), it: a.it }; }
  async function upload(box) {
    const r = await fetch(srvUrl('/backup?env=' + ENV()), { method: 'PUT', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SRV_TOK }, body: JSON.stringify(box) });
    if (r.status === 404) throw new Error('Servern behöver uppdateras för säkerhetskopior');
    if (!r.ok) throw new Error('Servern tog inte emot kopian (' + r.status + ')');
    lsSet('bk_last', String(Date.now())); lsSet('bk_where', 'server'); return true;
  }
  async function backupWithPass(pass, remember) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), key = await derive(pass, salt, IT);
    if (remember) lsSet('bk_auto', JSON.stringify({ k: b64(await crypto.subtle.exportKey('raw', key)), s: b64(salt), it: IT }));
    return seal(key, salt, IT);
  }
  let autoBusy = false;
  async function autoRun(force) {
    if (autoBusy || BOT || !SRV_TOK || !netBase() || !autoGet()) return;
    if (!force && Date.now() - (+lsGet('bk_last') || 0) < 24 * 3600e3) return;
    autoBusy = true;
    try { const a = await autoKey(); await upload(await seal(a.key, a.salt, a.it)); } catch (e) { console.warn('säkerhetskopia', e); }
    autoBusy = false;
  }
  setTimeout(() => autoRun(false), 45000); setInterval(() => autoRun(false), 6 * 3600e3);

  async function restore(data) {
    if (!data || !data.keys) throw new Error('Kopian är tom');
    if (data.env && data.env !== ENV()) throw new Error(data.env === 'dev' ? 'Kopian kommer från testversionen – återställ den där' : 'Kopian kommer från den vanliga appen – återställ den där');
    const keep = { srv_tok: lsGet('srv_tok'), srv_user: lsGet('srv_user') };
    const drop = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (mine(k) !== null) drop.push(k); }
    drop.forEach(k => localStorage.removeItem(k));
    for (const [k, v] of Object.entries(data.keys)) { try { localStorage.setItem(LSP + k, v); } catch (e) { throw new Error('Det får inte plats på den här enheten'); } }
    for (const [k, v] of Object.entries(keep)) if (v) lsSet(k, v);
    lsSet('bk_restored', String(Date.now()));
  }
  function fileName() { const d = new Date(); return `game-board-kopia-${DEV ? 'test-' : ''}${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.flbk`; }
  function download(box) {
    const blob = new Blob([JSON.stringify(box)], { type: 'application/octet-stream' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName(); document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    lsSet('bk_last', String(Date.now())); lsSet('bk_where', 'fil');
  }
  const size = () => { let n = 0; const k = collect(); for (const x in k) n += x.length + (k[x] || '').length; return n; };
  const when = t => { if (!t) return 'aldrig'; const d = Math.round((Date.now() - t) / 864e5); return d <= 0 ? 'idag' : d === 1 ? 'igår' : d + ' dagar sedan'; };

  /* ---------- gränssnitt ---------- */
  let pending = null;   // vad lösenfrasrutan ska göra
  function show() {
    const last = +lsGet('bk_last') || 0, auto = !!autoGet(), srv = !!(SRV_TOK && netBase());
    const kb = Math.max(1, Math.round(size() / 1024));
    openModal(`<h3>💾 Säkerhetskopia</h3>
      <div class="setnote" style="margin:-4px 0 10px">Allt finns bara på den här enheten: chattnycklar, kontakter, meddelanden, sparade spel och rekord (${kb < 1024 ? kb + ' kB' : (kb / 1024).toFixed(1) + ' MB'}). Tappar du enheten är det borta – om du inte har en kopia.</div>
      <div class="setrow"><div class="lbl">Senaste kopian: <b>${when(last)}</b>${last ? ` (${esc(lsGet('bk_where') || '')})` : ''}${auto ? ' · ☁️ automatiskt varje dag' : ''}</div>
        <div class="chips">
          ${srv ? `<button data-act="bkdo" data-m="server">☁️ Kopiera till servern</button>` : ''}
          <button data-act="bkdo" data-m="file">📄 Spara som fil</button>
          ${auto ? `<button class="ghost" data-act="bkauto0">Sluta med automatisk kopia</button>` : ''}
        </div>
        <div class="setnote">Kopian låses med en lösenfras som bara du vet. ${srv ? 'Servern ser bara krypterad data.' : 'Logga in på servern för att kunna spara kopian där.'}</div></div>
      <div class="setrow"><div class="lbl">Ny telefon eller iPad?</div>
        <div class="chips">${srv ? `<button data-act="bkget" data-m="server">↩️ Återställ från servern</button>` : ''}<button data-act="bkget" data-m="file">📂 Återställ från fil</button></div>
        <div class="setnote">⚠️ Återställningen ersätter allt på den här enheten. Använd sedan bara den nya enheten för chatten – samma chattnyckel på två enheter samtidigt krånglar.</div></div>
      <input type="file" id="bkFile" accept=".flbk,application/json,application/octet-stream" style="display:none">
      <div class="btns"><button class="ghost" data-act="settings">Tillbaka</button><button data-act="close">Klar</button></div>`);
    const f = document.getElementById('bkFile');
    f.addEventListener('change', async () => {
      const file = f.files && f.files[0]; if (!file) return;
      try { const box = JSON.parse(await file.text()); askPass('restore', box); } catch (e) { toast('Filen gick inte att läsa', 3000); }
    });
  }
  function askPass(what, box) {
    pending = { what, box };
    const isNew = what === 'server' || what === 'file';
    openModal(`<h3>${isNew ? '🔐 Välj en lösenfras' : '🔓 Lösenfras för kopian'}</h3>
      <div class="setnote" style="margin-bottom:10px">${isNew ? 'Minst 8 tecken – gärna några ord, t.ex. <i>delfin hoppar över månen</i>. Skriv upp den! Utan den går kopian inte att öppna.' : 'Samma lösenfras som när kopian gjordes.'}</div>
      <input id="bkP1" type="password" autocomplete="new-password" placeholder="Lösenfras" style="width:100%;font-size:17px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:inherit;box-sizing:border-box">
      ${isNew ? `<input id="bkP2" type="password" autocomplete="new-password" placeholder="Samma igen" style="width:100%;font-size:17px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:inherit;box-sizing:border-box;margin-top:8px">` : ''}
      ${what === 'server' ? `<label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:14px"><input id="bkRem" type="checkbox" checked> Kopiera automatiskt varje dag (nyckeln sparas på den här enheten)</label>` : ''}
      <div id="bkMsg" class="setnote" style="min-height:1.4em;margin-top:8px"></div>
      <div class="btns"><button class="ghost" data-act="bk">Avbryt</button><button data-act="bkgo">${isNew ? 'Kryptera och spara' : 'Öppna kopian'}</button></div>`);
    setTimeout(() => { const i = document.getElementById('bkP1'); i && i.focus(); }, 60);
  }
  async function go() {
    if (!pending) return;
    const msg = document.getElementById('bkMsg'), say = t => { if (msg) msg.textContent = t; };
    const p1 = (document.getElementById('bkP1') || {}).value || '', p2 = (document.getElementById('bkP2') || {}).value;
    const btn = document.querySelector('[data-act="bkgo"]');
    try {
      if (pending.what === 'server' || pending.what === 'file') {
        if (p1.length < 8) return say('Minst 8 tecken');
        if (p1 !== p2) return say('Lösenfraserna är inte lika');
        btn && (btn.disabled = true); say('🔐 Krypterar…');
        const rem = pending.what === 'server' && document.getElementById('bkRem') && document.getElementById('bkRem').checked;
        const box = await backupWithPass(p1, rem);
        if (pending.what === 'server') { say('☁️ Skickar…'); try { await upload(box); } catch (e) { if (rem) try { localStorage.removeItem(LSP + 'bk_auto'); } catch (_) {} throw e; } toast('💾 Kopian finns nu på servern', 3500); }
        else { download(box); toast('📄 Kopian sparades som fil', 3500); }
        pending = null; show();
      } else {
        if (!p1) return say('Skriv lösenfrasen');
        btn && (btn.disabled = true); say('🔓 Öppnar…');
        const data = await open(pending.box, p1);
        const d = new Date(data.at), n = Object.keys(data.keys || {}).length;
        pending.data = data;
        openModal(`<h3>↩️ Återställ?</h3><p>Kopian är från <b>${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</b> (${n} sparade saker).</p>
          <p>Allt som finns på den här enheten nu ersätts.</p>
          <div class="btns"><button class="ghost" data-act="bk">Avbryt</button><button data-act="bkok">Återställ</button></div>`);
      }
    } catch (e) { btn && (btn.disabled = false); say('⚠️ ' + (e && e.message || e)); }
  }
  async function fromServer() {
    try {
      const r = await fetch(srvUrl('/backup?env=' + ENV()), { cache: 'no-store', headers: { 'Authorization': 'Bearer ' + SRV_TOK } });
      if (r.status === 404) { const t = await r.text(); return toast(/ingen kopia/.test(t) ? 'Det finns ingen kopia på servern för ditt konto' : 'Servern behöver uppdateras för säkerhetskopior', 4000); }
      if (!r.ok) return toast('Kunde inte hämta kopian', 3000);
      askPass('restore', await r.json());
    } catch (e) { toast('Når inte servern', 3000); }
  }
  async function act(a, b) {
    switch (a) {
      case 'bk': pending = null; show(); return true;
      case 'bkdo': askPass(b.dataset.m); return true;
      case 'bkgo': go(); return true;
      case 'bkauto0': lsSet('bk_auto', ''); try { localStorage.removeItem(LSP + 'bk_auto'); } catch (e) {} show(); return true;
      case 'bkget': if (b.dataset.m === 'server') fromServer(); else { const f = document.getElementById('bkFile'); f && f.click(); } return true;
      case 'bkok': try { await restore(pending.data); closeModal(); toast('✅ Återställt – startar om…', 2000); setTimeout(() => location.reload(), 900); } catch (e) { toast('⚠️ ' + e.message, 4000); } return true;
    }
    return false;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && pending && document.getElementById('bkP1')) { e.preventDefault(); go(); } });
  return { show, act, autoRun, collect, open, restore, seal: backupWithPass, last: () => +lsGet('bk_last') || 0, hasAuto: () => !!autoGet() };
})();
