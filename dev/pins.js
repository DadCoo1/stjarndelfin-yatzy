/* ================= Pins – samlingar och framsteg =================
   Egna emaljpins (inget lånat): räknas fram ur det som redan sparas, så
   gammal historik ger pins direkt. Brons → silver → guld per pin.
   Vilodagar tar aldrig bort något – allt räknas som "dagar totalt", inte i rad. */
const PINS = (() => {
  const J = (k, d) => { try { const v = JSON.parse(lsGet(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const P = (k, v) => lsSet(k, JSON.stringify(v));
  const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const E = s => (typeof esc === 'function' ? esc(s) : String(s));

  /* ---------- kategorier: egen form och emalj ---------- */
  const CATS = {
    start:  { name: 'Äventyret', shape: 'circle', c: ['#7dd3fc', '#1e3a8a'] },
    yatzy:  { name: 'Yatzy',     shape: 'square', c: ['#67e8f9', '#0e4a6e'] },
    games:  { name: 'Spelen',    shape: 'shield', c: ['#f9a8d4', '#831843'] },
    daily:  { name: 'Varje dag', shape: 'hex',    c: ['#fde047', '#b45309'] },
    calm:   { name: 'Lugnet',    shape: 'flower', c: ['#99f6e4', '#0f766e'] },
    social: { name: 'Kompisar',  shape: 'heart',  c: ['#c4b5fd', '#5b21b6'] },
    season: { name: 'Årstider',  shape: 'hex',    c: ['#bbf7d0', '#166534'] },
    me:     { name: 'Mitt eget', shape: 'circle', c: ['#fecaca', '#9f1239'] }
  };
  const TIER = ['', 'Brons', 'Silver', 'Guld'];

  /* ---------- pins: v(D) ger ett tal, t = gränser för brons/silver/guld (en gräns = specialpin) ---------- */
  const DEFS = [
    { id: 'first',   cat: 'start',  ic: '⭐', name: 'Första stjärnan', t: [1],            v: D => D.total, desc: 'Spela ditt allra första spel' },
    { id: 'played',  cat: 'start',  ic: '🎮', name: 'Spelglad',        t: [10, 50, 200],  v: D => D.total, desc: n => `Spela ${n} spel – vilket som helst` },
    { id: 'wins',    cat: 'start',  ic: '🏆', name: 'Vinnarskalle',    t: [5, 25, 100],   v: D => D.wins, desc: n => `Vinn ${n} matcher` },
    { id: 'explore', cat: 'start',  ic: '🧭', name: 'Upptäckaren',     t: [3, 6, 10],     v: D => D.kinds, desc: n => `Prova ${n} olika spel` },

    { id: 'yatzy',   cat: 'yatzy',  ic: '🎲', name: 'Yatzy!',          t: [1, 5, 20],     v: D => D.yYatzy, desc: n => n === 1 ? 'Få en Yatzy' : `Få ${n} Yatzy` },
    { id: 'bonus',   cat: 'yatzy',  ic: '🎁', name: 'Bonusjägaren',    t: [1, 10, 30],    v: D => D.yBonus, desc: n => n === 1 ? 'Ta bonusen i övre delen' : `Ta bonusen ${n} gånger` },
    { id: 'high',    cat: 'yatzy',  ic: '🚀', name: 'Högt flyg',       t: [200, 250, 300], v: D => D.yBest, unit: 'poäng', desc: n => `Få ${n} poäng i en match` },

    { id: 'race',    cat: 'games',  ic: '🏁', name: 'Sommarvägen',     t: [1, 10, 40],    v: D => D.raceFin, desc: n => n === 1 ? 'Kör i mål i Sommarvägen' : `Kör i mål ${n} gånger` },
    { id: 'ghost',   cat: 'games',  ic: '👻', name: 'Spökjägaren',     t: [1, 5, 20],     v: D => D.raceGhost, desc: n => n === 1 ? 'Slå en kompis spöke' : `Slå kompisars spöken ${n} gånger` },
    { id: 'space',   cat: 'games',  ic: '🛸', name: 'Rymdkadett',      t: [3, 6, 10],     v: D => D.invLvl, unit: 'nivå', desc: n => `Nå nivå ${n} i Space Attack` },
    { id: 'cards',   cat: 'games',  ic: '🃏', name: 'Kortkungen',      t: [1, 10, 40],    v: D => D.solWon, desc: n => n === 1 ? 'Gå ut i patiens' : `Gå ut ${n} gånger i patiens` },
    { id: 'words',   cat: 'games',  ic: '🔤', name: 'Ordsmeden',       t: [1, 3, 7],      v: D => D.wdBest, desc: n => n === 1 ? 'Lös dagens ord' : `Lös dagens ord ${n} dagar i följd` },

    { id: 'code',    cat: 'daily',  ic: '🔐', name: 'Kodknäckaren',    t: [1, 10, 50],    v: D => D.codes, desc: n => n === 1 ? 'Knäck dagens kod' : `Knäck dagens kod ${n} gånger` },
    { id: 'mind',    cat: 'daily',  ic: '🔮', name: 'Tankeläsaren',    t: [1],            v: D => D.codeFast, desc: 'Knäck dagens kod på högst tre försök' },
    { id: 'days',    cat: 'daily',  ic: '📅', name: 'Trogen vän',      t: [7, 30, 100],   v: D => D.active, unit: 'dagar', desc: n => `Var här ${n} olika dagar – vilodagar räknas aldrig bort` },

    { id: 'dolphin', cat: 'calm',   ic: '🐬', name: 'Delfinvän',       t: [3, 14, 60],    v: D => D.aqDays, unit: 'dagar', desc: n => `Ta hand om delfinen ${n} dagar` },
    { id: 'listen',  cat: 'calm',   ic: '🎧', name: 'Lyssnaren',       t: [1],            v: D => D.sound, desc: 'Starta ett ljudlandskap' },

    { id: 'friend',  cat: 'social', ic: '💜', name: 'Kompisgänget',    t: [1, 3, 8],      v: D => D.contacts, desc: n => n === 1 ? 'Lägg till en kompis i chatten' : `Ha ${n} kompisar i chatten` },
    { id: 'online',  cat: 'social', ic: '📡', name: 'Fjärrspelaren',   t: [1, 10, 40],    v: D => D.online, desc: n => n === 1 ? 'Spela en match på varsin enhet' : `Spela ${n} matcher på varsin enhet` },

    { id: 'winter',  cat: 'season', ic: '❄️', name: 'Vinterstjärna',   t: [1],            v: D => D.sea.w, c: ['#e0f2fe', '#1d4ed8'], desc: 'Spela under vintern (dec–feb)' },
    { id: 'spring',  cat: 'season', ic: '🌷', name: 'Vårknopp',        t: [1],            v: D => D.sea.v, c: ['#fbcfe8', '#be185d'], desc: 'Spela under våren (mar–maj)' },
    { id: 'summer',  cat: 'season', ic: '☀️', name: 'Sommarsol',       t: [1],            v: D => D.sea.s, c: ['#fef08a', '#c2410c'], desc: 'Spela under sommaren (jun–aug)' },
    { id: 'autumn',  cat: 'season', ic: '🍂', name: 'Höstlöv',         t: [1],            v: D => D.sea.h, c: ['#fed7aa', '#9a3412'], desc: 'Spela under hösten (sep–nov)' },
    { id: 'year',    cat: 'season', ic: '🌍', name: 'Fyra årstider',   t: [1],            v: D => +(D.sea.w && D.sea.v && D.sea.s && D.sea.h), c: ['#a7f3d0', '#047857'], desc: 'Samla alla fyra årstider' },
    { id: 'xmas',    cat: 'season', ic: '🎄', name: 'Julstjärnan',     t: [1],            v: D => D.xmas, c: ['#fecaca', '#166534'], desc: 'Var här på julafton' },
    { id: 'newyear', cat: 'season', ic: '🎆', name: 'Nyårsraketen',    t: [1],            v: D => D.ny, c: ['#ddd6fe', '#312e81'], desc: 'Var här på nyårsafton eller nyårsdagen' },

    { id: 'style',   cat: 'me',     ic: '🎨', name: 'Inredaren',       t: [1],            v: D => D.styled, desc: 'Gör spelet till ditt eget under Utseende' },
    { id: 'safe',    cat: 'me',     ic: '💾', name: 'Tryggt sparat',   t: [1],            v: D => D.backup, desc: 'Gör en säkerhetskopia' }
  ];
  const BY = Object.fromEntries(DEFS.map(d => [d.id, d]));
  const tierOf = (d, v) => d.t.filter(x => v >= x).length;            // 0 = inte än
  const maxTier = d => d.t.length;
  const tierName = (d, t) => d.t.length === 1 ? 'Special' : TIER[t];
  const descOf = (d, t) => typeof d.desc === 'function' ? d.desc(d.t[Math.max(0, t - 1)]) : d.desc;
  const MAXPTS = DEFS.reduce((a, d) => a + maxTier(d), 0);
  const LEVELS = [[0, 'Nybörjare', '🌱'], [5, 'Upptäckare', '🧭'], [15, 'Samlare', '📌'], [30, 'Mästersamlare', '💎'], [45, 'Legend', '🌟']];
  const levelOf = pts => { let i = 0; LEVELS.forEach((l, j) => { if (pts >= l[0]) i = j; }); return i; };

  /* ---------- läs ihop all statistik ---------- */
  function data() {
    const me = lsGet('ry_name') || '', days = new Set(), stamp = t => { if (t) days.add(day(new Date(t))); };
    const D = { total: 0, wins: 0, kinds: 0, yYatzy: 0, yBonus: 0, yBest: 0, raceFin: 0, raceGhost: 0, invLvl: 0, solWon: 0, wdBest: 0,
      codes: 0, codeFast: 0, active: 0, aqDays: 0, sound: 0, contacts: 0, online: 0, sea: { w: 0, v: 0, s: 0, h: 0 }, xmas: 0, ny: 0, styled: 0, backup: 0 };
    const kinds = new Set();
    // Yatzy
    const ys = J('ry_stats', { games: [] }).games || [];
    ys.forEach(g => {
      const hs = (g.players || []).filter(p => p.human), p = hs.length === 1 ? hs[0] : hs.find(x => x.n === me);
      if (!p) return;
      D.total++; kinds.add('yatzy'); stamp(g.d);
      if (g.type === 'online') D.online++;
      if (p.rows && p.rows.yatzy === 50) D.yYatzy++;
      if (p.bonus) D.yBonus++;
      D.yBest = Math.max(D.yBest, p.s || 0);
      const opp = g.players.filter(x => x !== p); if (opp.length && (p.s || 0) > Math.max(...opp.map(o => o.s || 0))) D.wins++;
    });
    // övriga brädspel
    (J('ry_stats2', { games: [] }).games || []).forEach(g => { D.total++; kinds.add(g.kind); stamp(g.d); if (g.res === 'W') D.wins++; if (g.mode === 'online') D.online++; });
    // Sommarvägen
    const r = J('race_stats', {}); D.total += r.games || 0; D.raceFin = r.fin || 0; D.raceGhost = r.fghost || 0; if (r.games) kinds.add('race'); (r.hs || []).forEach(h => stamp(h.d));
    // Space Attack
    const iv = J('ry_inv', {}); D.total += iv.games || 0; D.invLvl = iv.games ? (iv.maxLevel || 1) : 0; if (iv.games) kinds.add('inv');
    // patiens
    const so = J('ry_solstats', {}); Object.values(so).forEach(m => { if (!m) return; D.total += m.played || 0; D.solWon += m.won || 0; if (m.played) kinds.add('sol'); });
    // ordspel och sudoku
    const wd = J('wd_stats', {}); if (wd.played) { D.total += wd.played; kinds.add('words'); D.wdBest = Math.max(wd.best || 0, wd.won ? 1 : 0); }
    const sd = J('sd_best', {}); if (Object.keys(sd).length) { kinds.add('sudoku'); D.total += Object.keys(sd).length; }
    // dagens kod (finns bara som egna nycklar per dag)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i); if (!k || !k.startsWith(LSP + 'daily_')) continue;
        const dd = k.slice((LSP + 'daily_').length); if (!/^\d{4}-\d\d-\d\d$/.test(dd)) continue;
        const s = J('daily_' + dd, null); if (!s || !s.g || !s.g.length) continue;
        days.add(dd); if (s.ok) { D.codes++; if (s.g.length <= 3) D.codeFast = 1; }
      }
    } catch (e) {}
    // lugnet
    const aq = J('aq', null); if (aq && aq.days) { D.aqDays = aq.days.length; aq.days.forEach(x => days.add(x)); }
    D.sound = lsGet('snd_last') ? 1 : 0;
    Object.keys(J('mood_hist', {})).forEach(x => days.add(x));
    J('act_days', []).forEach(x => days.add(x));
    // kompisar
    try { D.contacts = CHAT.contactCount(); } catch (e) {}
    // eget
    D.styled = lsGet('style') ? 1 : 0; D.backup = lsGet('bk_last') ? 1 : 0;
    // dagar och årstider
    days.forEach(x => { const m = +x.slice(5, 7), dd = x.slice(5);
      if (m === 12 || m <= 2) D.sea.w = 1; else if (m <= 5) D.sea.v = 1; else if (m <= 8) D.sea.s = 1; else D.sea.h = 1;
      if (dd === '12-24') D.xmas = 1; if (dd === '12-31' || dd === '01-01') D.ny = 1; });
    D.active = days.size; D.kinds = kinds.size; D._days = days;
    return D;
  }

  /* ---------- emaljpin i SVG ---------- */
  let uid = 0;
  function shape(kind, r) {
    const c = 50;
    if (kind === 'circle') return `<circle cx="${c}" cy="${c}" r="${r}"/>`;
    if (kind === 'square') { const s = r * 1.8, o = c - s / 2; return `<rect x="${o}" y="${o}" width="${s}" height="${s}" rx="${r * .42}"/>`; }
    if (kind === 'hex') return `<polygon points="${[0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i - Math.PI / 2; return (c + Math.cos(a) * r * 1.06).toFixed(1) + ',' + (c + Math.sin(a) * r * 1.06).toFixed(1); }).join(' ')}" stroke-linejoin="round"/>`;
    if (kind === 'flower') { const pts = []; for (let i = 0; i < 80; i++) { const a = i / 80 * Math.PI * 2, rr = r * (.93 + .07 * Math.cos(a * 8)); pts.push((c + Math.cos(a) * rr).toFixed(1) + ',' + (c + Math.sin(a) * rr).toFixed(1)); } return `<polygon points="${pts.join(' ')}"/>`; }
    if (kind === 'shield') { const w = r * .92, t = c - r * .92, b = c + r; return `<path d="M${c} ${t} L${c + w} ${t + r * .3} Q${c + w} ${c + r * .45} ${c} ${b} Q${c - w} ${c + r * .45} ${c - w} ${t + r * .3} Z"/>`; }
    if (kind === 'heart') { const k = r / 46; return `<path transform="translate(${c} ${c}) scale(${k}) translate(-50 -50)" d="M50 90 C18 70 4 52 4 34 C4 18 16 8 29 8 C39 8 46 14 50 22 C54 14 61 8 71 8 C84 8 96 18 96 34 C96 52 82 70 50 90 Z"/>`; }
    return `<circle cx="${c}" cy="${c}" r="${r}"/>`;
  }
  const METAL = [['#ffe4f0', '#e79ab9', '#7c2d55'], ['#f6c99b', '#b8732f', '#5f3210'], ['#ffffff', '#c3ccd8', '#5f6d80'], ['#fff6c2', '#f2b51b', '#7a4f00']];
  function svg(id, tier, size = 64) {
    const d = BY[id]; if (!d) return '';
    const cat = CATS[d.cat], col = d.c || cat.c, n = ++uid, locked = !tier;
    const m = METAL[d.t.length === 1 ? 0 : Math.max(1, tier || 1)];
    const stars = d.t.length > 1 && tier ? Array.from({ length: tier }, (_, i) => `<text x="${50 + (i - (tier - 1) / 2) * 11}" y="97" font-size="11" text-anchor="middle">★</text>`).join('') : '';
    return `<svg class="pin-svg${locked ? ' locked' : ''}" viewBox="0 0 100 104" width="${size}" height="${size * 1.04}" aria-hidden="true">
      <defs><linearGradient id="pm${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset=".55" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></linearGradient>
      <radialGradient id="pe${n}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${col[0]}"/><stop offset="1" stop-color="${col[1]}"/></radialGradient>
      <clipPath id="pc${n}">${shape(cat.shape, 38)}</clipPath></defs>
      <ellipse cx="52" cy="96" rx="30" ry="5" fill="rgba(0,0,0,.28)"/>
      <g fill="url(#pm${n})">${shape(cat.shape, 46)}</g>
      <g fill="url(#pe${n})" stroke="${m[2]}" stroke-width="1.6">${shape(cat.shape, 38)}</g>
      <g clip-path="url(#pc${n})"><path d="M0 0 H100 V38 Q50 52 0 30 Z" fill="#fff" opacity=".16"/></g>
      <text x="50" y="51" font-size="34" text-anchor="middle" dominant-baseline="central">${locked ? '❔' : d.ic}</text>
      <ellipse cx="34" cy="26" rx="10" ry="4.5" fill="#fff" opacity=".55" transform="rotate(-28 34 26)"/>
      <g fill="${m[0]}" stroke="${m[2]}" stroke-width=".8">${stars}</g></svg>`;
  }

  /* ---------- förtjänade pins ---------- */
  const got = () => J('pins', {});
  const key = (id, t) => id + ':' + t;
  function evaluate(D) {
    D = D || data(); const out = {};
    DEFS.forEach(d => { const v = d.v(D) || 0; out[d.id] = { v, tier: tierOf(d, v) }; });
    return out;
  }
  function points(g) { return Object.keys(g || got()).length; }

  let queue = [], showing = false, lastSig = '', checkT = 0;
  const calmView = () => typeof view === 'undefined' || view === 'lobby' || view === 'stats' || (view === 'game' && typeof G !== 'undefined' && G && G.over);
  function check(quiet) {
    let D; try { D = data(); } catch (e) { return []; }
    // en aktiv dag läggs till när något nytt har hänt idag
    const sig = [D.total, D.codes, D.aqDays, D.wins].join('|'), today = day();
    if (lastSig && sig !== lastSig) { const ad = J('act_days', []); if (!ad.includes(today)) { ad.push(today); while (ad.length > 400) ad.shift(); P('act_days', ad); D._days.add(today); D.active = D._days.size; } }
    lastSig = sig;
    const ev = evaluate(D), g = got(), fresh = [], first = !lsGet('pins_init');
    DEFS.forEach(d => { for (let t = 1; t <= ev[d.id].tier; t++) if (!g[key(d.id, t)]) { g[key(d.id, t)] = Date.now(); fresh.push([d.id, t]); } });
    if (fresh.length) P('pins', g);
    if (first) { lsSet('pins_init', '1'); if (fresh.length && !quiet) setTimeout(() => { try { toast(`📌 Du har redan samlat ${fresh.length} pins! Titta under Idag.`, 4200); } catch (e) {} }, 1500); }
    else if (!quiet) { const best = {}; fresh.forEach(([id, t]) => { if (!best[id] || best[id] < t) best[id] = t; }); Object.entries(best).forEach(([id, t]) => queue.push([id, t])); pump(); }
    if (fresh.length) { try { TODAY.repaint(false); } catch (e) {} }
    if (fresh.length || lsGet('pins_shared') !== today) share();
    return fresh;
  }
  function soon() { clearTimeout(checkT); checkT = setTimeout(() => check(false), 900); }

  /* ---------- firande när en pin låses upp ---------- */
  function pump() {
    if (showing || !queue.length) return;
    if (!calmView() || document.hidden) { setTimeout(pump, 2500); return; }
    const [id, t] = queue.shift(), d = BY[id]; showing = true;
    const w = document.createElement('div'); w.className = 'pin-pop'; w.setAttribute('role', 'status');
    w.innerHTML = `<div class="pin-pop-in"><div class="pin-pop-rays"></div><div class="pin-pop-pin">${svg(id, t, 150)}</div><small>Ny pin!</small><b>${E(d.name)}</b><span>${E(tierName(d, t))} · ${E(descOf(d, t))}</span></div>`;
    document.body.appendChild(w);
    try { sparkles(34); } catch (e) {} try { buzz([30, 50, 90]); } catch (e) {}
    try { if (typeof sfx !== 'undefined' && sfx.win) sfx.win(); } catch (e) {}
    const done = () => { if (!w.parentNode) return; w.classList.add('out'); setTimeout(() => { w.remove(); showing = false; pump(); }, 350); };
    w.addEventListener('click', done); setTimeout(done, 3600);
  }

  /* ---------- dela med kompisar (öppen eller dold profil) ---------- */
  const vis = () => lsGet('pins_vis') !== 'hidden';
  function share(force) {
    try {
      if (typeof CHAT === 'undefined' || !CHAT.share || !CHAT.hasIdentity()) return;
      const g = got(), top = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
      const n = vis() ? CHAT.share('pins', { n: points(g), lvl: levelOf(points(g)), top }) : CHAT.share('pins', { n: 0, top: [], hide: 1 });
      if (n || force) lsSet('pins_shared', day());
    } catch (e) {}
  }

  /* ---------- vyer ---------- */
  let tab = 'pins';
  function header(g) {
    const pts = points(g), li = levelOf(pts), nx = LEVELS[li + 1], L = LEVELS[li];
    const pct = nx ? Math.round((pts - L[0]) / (nx[0] - L[0]) * 100) : 100;
    return `<div class="pin-head"><div class="pin-lvl"><i>${L[2]}</i><div><b>${L[1]}</b><small>${pts} av ${MAXPTS} pins${nx ? ` · ${nx[0] - pts} till ${nx[1]}` : ' · alla nivåer klara!'}</small></div></div>
      <div class="pin-bar"><i style="width:${pct}%"></i></div>
      <div class="chips pin-tabs">${[['pins', '📌 Samling'], ['stat', '📊 Siffror'], ['top', '🏆 Kompisar']].map(([k, l]) => `<button data-act="pintab" data-k="${k}" class="${tab === k ? 'sel' : ''}">${l}</button>`).join('')}</div></div>`;
  }
  function gridHTML(ev, g) {
    return Object.entries(CATS).map(([ck, c]) => {
      const ds = DEFS.filter(d => d.cat === ck);
      return `<h4 class="pin-cat">${E(c.name)}</h4><div class="pin-grid">${ds.map(d => {
        const t = ev[d.id].tier, nx = d.t[t], pr = nx ? Math.min(1, ev[d.id].v / nx) : 1;
        return `<button class="pin-cell${t ? '' : ' off'}" data-act="pinone" data-id="${d.id}" aria-label="${E(d.name)}${t ? ', ' + tierName(d, t) : ', inte än'}">${svg(d.id, t, 58)}<b>${E(d.name)}</b>${nx ? `<span class="pin-pr"><i style="width:${Math.round(pr * 100)}%"></i></span>` : `<small>${d.t.length > 1 ? 'Guld!' : 'Klar'}</small>`}</button>`;
      }).join('')}</div>`;
    }).join('');
  }
  function oneHTML(id, ev, g) {
    const d = BY[id], t = ev[id].tier, v = ev[id].v, nx = d.t[t];
    const steps = d.t.map((x, i) => { const at = g[key(id, i + 1)]; return `<div class="pin-step${at ? ' ok' : ''}">${svg(id, at ? i + 1 : 0, 40)}<div><b>${E(tierName(d, i + 1))}</b><small>${E(descOf(d, i + 1))}${at ? ' · ' + new Date(at).toLocaleDateString('sv-SE') : ''}</small></div></div>`; }).join('');
    return `<div class="pin-one"><div class="pin-big">${svg(id, t, 132)}</div><h3>${E(d.name)}</h3>
      <div class="setnote" style="text-align:center">${nx ? `Du har ${v}${d.unit ? ' ' + d.unit : ''} av ${nx} till ${E(tierName(d, t + 1).toLowerCase())}.` : 'Helt klar – snyggt!'}</div>${steps}
      <div class="btns"><button class="ghost" data-act="pintab" data-k="pins">‹ Tillbaka</button><button data-act="close">Klar</button></div></div>`;
  }
  function statHTML(D) {
    const k = (n, l) => `<div class="kpi"><b>${n}</b><span>${l}</span></div>`;
    return `<div class="kpis pin-kpis">${k(D.total, 'spel')}${k(D.wins, 'vinster')}${k(D.kinds, 'olika spel')}${k(D.active, 'dagar här')}${k(D.codes, 'knäckta koder')}${k(D.aqDays, 'dagar med delfinen')}${k(D.yYatzy, 'Yatzy')}${k(D.yBest || '–', 'bästa Yatzy')}${k(D.raceFin, 'i mål')}</div>
      <div class="setnote" style="text-align:center">Siffrorna räknar allt du gjort – ingenting försvinner för att du tar en paus. 💙</div>
      <div class="btns"><button class="ghost" data-act="stats">Mer statistik…</button></div>`;
  }
  function topHTML(g) {
    let rows = []; try { rows = CHAT.pinboard(); } catch (e) {}
    const meName = (() => { try { return CHAT.myName(); } catch (e) { return ''; } })() || lsGet('ry_name') || 'Du';
    rows = rows.concat([{ name: meName, emoji: '⭐', n: points(g), top: Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]), me: 1 }]).sort((a, b) => b.n - a.n);
    const mini = t => (t || []).slice(0, 4).map(x => { const [id, tt] = x.split(':'); return BY[id] ? svg(id, +tt, 22) : ''; }).join('');
    const list = rows.map((r, i) => `<div class="pin-lb${r.me ? ' me' : ''}"><span>${i + 1}.</span><b>${E(r.emoji || '')} ${E(r.name)}</b><em class="pin-mini">${mini(r.top)}</em><i>${r.n} 📌</i></div>`).join('');
    return `${rows.length > 1 ? list : list + '<div class="setnote" style="text-align:center">När dina chattkompisar samlar pins syns de här.</div>'}
      <div class="setrow" style="margin-top:12px"><div class="lbl">👀 Min samling syns för</div><div class="chips"><button data-act="pinvis" data-k="open" class="${vis() ? 'sel' : ''}">Mina chattkompisar</button><button data-act="pinvis" data-k="hidden" class="${vis() ? '' : 'sel'}">Bara mig</button></div>
      <div class="setnote">Bara antal pins och dina senaste pins delas – aldrig vad du spelat eller när.</div></div>`;
  }
  function sheet(sel) {
    const D = data(), ev = evaluate(D), g = got();
    if (sel) return oneHTML(sel, ev, g);
    return `<h3>📌 Mina pins</h3>${header(g)}${tab === 'stat' ? statHTML(D) : tab === 'top' ? topHTML(g) : gridHTML(ev, g)}${tab === 'pins' ? '<div class="btns"><button data-act="close">Klar</button></div>' : ''}`;
  }
  function open(sel) { check(true); openModal(sheet(sel), 'pins'); }
  function act(a, b) {
    if (a === 'pinsopen') { tab = 'pins'; open(); return true; }
    if (a === 'pintab') { tab = b.dataset.k || 'pins'; open(); return true; }
    if (a === 'pinone') { open(b.dataset.id); return true; }
    if (a === 'pinvis') { lsSet('pins_vis', b.dataset.k === 'hidden' ? 'hidden' : 'open'); share(true); open(); return true; }
    return false;
  }
  function cardInfo() {
    const g = got(), pts = points(g); if (!pts) return null;
    const ev = evaluate(); let best = null;
    DEFS.forEach(d => { const t = ev[d.id].tier, nx = d.t[t]; if (!nx) return; const pr = ev[d.id].v / nx; if (pr > 0 && (!best || pr > best.pr)) best = { d, pr }; });
    const last = Object.entries(g).sort((a, b) => b[1] - a[1])[0][0].split(':')[0];
    return { n: pts, ic: BY[last] ? BY[last].ic : '📌', line: best ? `Nästa: ${best.d.name} (${Math.round(best.pr * 100)} %)` : `${pts} av ${MAXPTS}` };
  }

  // kolla efter avslutade spel och när appen kommer tillbaka
  document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(); });
  window.addEventListener('fl-share', e => { if (e.detail && e.detail.k === 'pins') { const m = document.querySelector('#modal .sheet[data-kind="pins"]'); if (m && tab === 'top') open(); } });
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => check(false), 1200));

  return { check, soon, open, act, svg, cardInfo, DEFS, CATS, data, evaluate,
    __test: (typeof DEV !== 'undefined' && DEV) ? { queue: () => queue, reset: () => { lastSig = ''; queue = []; showing = false; } } : undefined };
})();
