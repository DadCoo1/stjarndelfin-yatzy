/* ---------- Bubbelvärldar: bakgrunder som låses upp med bubbelpoäng ----------
   Varje värld har en egen animerad scen bakom allt och egna "bubblor" i lobbyn
   (snökristaller, meteoriter, norrskensljus, körsbärsblommor, godis, drakägg).
   Hjärtat, leoparden, guld- och rosa-bubblan finns kvar i varje värld men klädda i världens stil.
   Kassan = alla bubbelpoäng som någonsin poppats minus det som lagts på världar –
   nollställning av räknaren (själv eller på måndagar) påverkar inte kassan.
   Allt är egna ritningar. */
const SCENES = (() => {
  const J = (k, d) => { try { const v = JSON.parse(lsGet(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const f1 = n => (+n).toFixed(1);
  const pick = (a, r) => a[Math.floor((r || Math.random)() * a.length)];

  /* ---------- världarna ---------- */
  const W = {
    vinter:   { name: 'Vinterfjäll', ic: '❄️', price: 1000, desc: 'Fjäll, snöfall och skidåkare. Bubblorna blir snökristaller.',
                bg: ['#081530', '#1a3361', '#4e74ad'], glow: ['rgba(255,176,214,.32)', 'rgba(125,200,255,.38)'], acc: '#7dd3fc', acc2: '#c4b5fd', txt: '#f0f8ff', dim: '#a9c3e0', glass: 'rgba(180,215,255,.11)', line: 'rgba(190,225,255,.27)' },
    kosmos:   { name: 'Rymdäventyr', ic: '🚀', price: 2500, desc: 'Raketer, astronauter, månar och planeter. Bubblorna blir meteoriter.',
                bg: ['#04020d', '#120a2b', '#26103f'], glow: ['rgba(236,72,153,.34)', 'rgba(56,189,248,.32)'], acc: '#f0abfc', acc2: '#67e8f9', txt: '#f5f3ff', dim: '#b4a9d6', glass: 'rgba(200,170,255,.10)', line: 'rgba(210,180,255,.25)' },
    norrsken: { name: 'Norrsken', ic: '🌌', price: 4000, desc: 'Dansande norrsken, stuga och renar. Bubblorna blir ljusklot.',
                bg: ['#020814', '#061a33', '#0b3445'], glow: ['rgba(52,211,153,.32)', 'rgba(139,92,246,.30)'], acc: '#6ee7b7', acc2: '#c4b5fd', txt: '#ecfdf5', dim: '#9cc8bd', glass: 'rgba(110,231,183,.09)', line: 'rgba(110,231,183,.24)' },
    sakura:   { name: 'Körsbärsträdgård', ic: '🌸', price: 6000, desc: 'Blommande träd, pagod och flytande lyktor. Bubblorna blir blommor.',
                bg: ['#1a0f2e', '#3b1d4d', '#7b3f6c'], glow: ['rgba(251,182,206,.42)', 'rgba(253,186,116,.24)'], acc: '#f9a8d4', acc2: '#fde68a', txt: '#fff1f7', dim: '#e0b8cc', glass: 'rgba(251,182,206,.10)', line: 'rgba(251,182,206,.26)' },
    godis:    { name: 'Godislandet', ic: '🍭', price: 8000, desc: 'Klubbträd, sockervaddsmoln och chokladflod. Bubblorna blir godis.',
                bg: ['#1c0a30', '#47185a', '#83296f'], glow: ['rgba(244,114,182,.42)', 'rgba(56,189,248,.32)'], acc: '#f9a8d4', acc2: '#7dd3fc', txt: '#fff0fa', dim: '#e2b4d6', glass: 'rgba(249,168,212,.10)', line: 'rgba(249,168,212,.27)' },
    drakar:   { name: 'Drakdalen', ic: '🐉', price: 12000, desc: 'Borg på klippan, vulkan och flygande drakar. Bubblorna blir drakägg.',
                bg: ['#0c0a1d', '#28123e', '#62263c'], glow: ['rgba(251,146,60,.38)', 'rgba(168,85,247,.34)'], acc: '#fdba74', acc2: '#c084fc', txt: '#fff7ed', dim: '#d9b6a6', glass: 'rgba(253,186,116,.10)', line: 'rgba(253,186,116,.26)' }
  };
  Object.values(W).forEach(w => { w.scene = 1; });
  const ORDER = Object.keys(W);

  /* ---------- kassa och ägande ---------- */
  const total = () => +(lsGet('ry_pops_all') || 0) || (typeof popCount !== 'undefined' ? popCount : 0);
  const spent = () => +(lsGet('ry_bg_spent') || 0);
  const kassa = () => Math.max(0, total() - spent());
  const owned = k => !W[k] || (W[k].season ? avail(k) : J('ry_bg_own', []).includes(k));
  const cur = () => { try { const k = STYLE.get().world; return W[k] && owned(k) ? k : null; } catch (e) { return null; } };
  function buy(k) {
    if (!W[k] || owned(k) || kassa() < W[k].price) return false;
    lsSet('ry_bg_spent', String(spent() + W[k].price)); lsSet('ry_bg_own', JSON.stringify(J('ry_bg_own', []).concat(k))); return true;
  }

  /* ================= ritverktyg ================= */
  // bergskedja: växlande topp/dal-punkter -> berg, skuggsida och snötäcke
  function range(pts, base, fill, shade, snow, capT, r) {
    let d = `M${pts[0][0]} ${base}`; pts.forEach(p => d += ` L${f1(p[0])} ${f1(p[1])}`); d += ` L${pts[pts.length - 1][0]} ${base}Z`;
    let o = `<path d="${d}" fill="${fill}"/>`;
    for (let i = 1; i < pts.length - 1; i += 2) {
      const P = pts[i], L = pts[i - 1], R = pts[i + 1];
      o += `<path d="M${f1(P[0])} ${f1(P[1])} L${f1(R[0])} ${f1(R[1])} L${f1((P[0] + R[0]) / 2 + 10)} ${base}Z" fill="${shade}"/>`;
      if (snow) {
        const t = capT * (0.8 + r() * 0.4), A = [P[0] + (L[0] - P[0]) * t, P[1] + (L[1] - P[1]) * t], B = [P[0] + (R[0] - P[0]) * t, P[1] + (R[1] - P[1]) * t];
        let s = `M${f1(P[0])} ${f1(P[1])} L${f1(B[0])} ${f1(B[1])}`; const n = 5;
        for (let j = 1; j < n; j++) { const x = B[0] + (A[0] - B[0]) * j / n, y = B[1] + (A[1] - B[1]) * j / n + (j % 2 ? -(6 + r() * 7) : 3 + r() * 5); s += ` L${f1(x)} ${f1(y)}`; }
        o += `<path d="${s} L${f1(A[0])} ${f1(A[1])}Z" fill="${snow}"/>`;
      }
    }
    return o;
  }
  // gran med snö på grenarna
  function fir(x, y, h, col, snow) {
    const T = [[0, .55, .22], [.22, .28, .3], [.5, .02, .38]];
    let o = `<rect x="${f1(x - h * .035)}" y="${f1(y - h * .06)}" width="${f1(h * .07)}" height="${f1(h * .08)}" fill="#2a1a12"/>`;
    T.forEach(([a, b, w]) => {
      const ty = y - h + a * h, by = y - b * h, dx = w * h;
      o += `<path d="M${f1(x)} ${f1(ty)} L${f1(x - dx)} ${f1(by)} Q${f1(x)} ${f1(by + h * .04)} ${f1(x + dx)} ${f1(by)}Z" fill="${col}"/>`;
      if (snow) { const dy = by - ty; o += `<path d="M${f1(x)} ${f1(ty)} L${f1(x - dx * .5)} ${f1(ty + dy * .5)} Q${f1(x - dx * .22)} ${f1(ty + dy * .38)} ${f1(x)} ${f1(ty + dy * .56)} Q${f1(x + dx * .22)} ${f1(ty + dy * .38)} ${f1(x + dx * .5)} ${f1(ty + dy * .5)}Z" fill="${snow}"/>`; }
    });
    return o;
  }
  const land = (p, inner, h) => `<svg class="scn-land" style="height:${h || 46}%" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${inner}</svg>`;
  const div = (cls, style, inner) => `<div class="${cls}" style="${style}">${inner || ''}</div>`;
  function stars(n, top, r) { let h = ''; for (let i = 0; i < n; i++) { const sz = r() < .85 ? 1.5 : 2.6; h += `<div class="star" style="left:${f1(r() * 100)}%;top:${f1(r() * top)}%;width:${sz}px;height:${sz}px;animation-delay:${(r() * 3).toFixed(2)}s;animation-duration:${(2 + r() * 3).toFixed(2)}s"></div>`; } return h; }
  // fallande/stigande partiklar (snö, kronblad, strössel, glöd)
  function parts(cls, n, R, fn) { let h = ''; for (let i = 0; i < n; i++) h += fn(i, R); return `<div class="scn-pt ${cls}">${h}</div>`; }

  /* ================= scenerna ================= */
  const BUILD = {};

  /* ---------- Vinterfjäll ---------- */
  BUILD.vinter = (p, o, R) => {
    const r = rng(11);
    let L = `<defs>
      <linearGradient id="${p}far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55679f"/><stop offset="1" stop-color="#2b3b6c"/></linearGradient>
      <linearGradient id="${p}mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34497e"/><stop offset="1" stop-color="#1c2b55"/></linearGradient>
      <linearGradient id="${p}near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9e5fa"/><stop offset=".45" stop-color="#a9bde2"/><stop offset="1" stop-color="#6f86b8"/></linearGradient>
      <linearGradient id="${p}glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3d1" stop-opacity="0"/><stop offset="1" stop-color="#ffb3d1" stop-opacity=".28"/></linearGradient>
      <radialGradient id="${p}win"><stop offset="0" stop-color="#ffe3a3"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>
      <rect x="0" y="40" width="1200" height="140" fill="url(#${p}glow)"/>`;
    L += range([[0, 175], [90, 95], [180, 150], [300, 60], [400, 140], [520, 70], [640, 150], [760, 52], [880, 140], [1000, 85], [1100, 150], [1150, 110], [1200, 160]], 400, `url(#${p}far)`, 'rgba(20,24,60,.28)', '#c9d5f2', .34, r);
    L += range([[0, 230], [140, 160], [260, 230], [420, 140], [560, 236], [700, 178], [820, 240], [980, 150], [1120, 232], [1160, 210], [1200, 240]], 400, `url(#${p}mid)`, 'rgba(10,16,44,.3)', '#e3ecfc', .3, r);
    // liften: stolpar, vajer och stolar som åker uppåt
    L += `<g stroke="#0f1b3d" stroke-width="2.4" stroke-linecap="round"><path d="M452 300V276M528 244V220M604 190V166"/></g><path d="M440 276 L616 166" stroke="#0f1b3d" stroke-width="1.3" opacity=".9"/>`;
    for (let i = 0; i < 4; i++) L += `<g ${o.still ? `transform="translate(${f1(440 + 176 * (i + .5) / 4)} ${f1(276 - 110 * (i + .5) / 4)})"` : `class="mv vt-chair" style="animation-delay:-${i * 6}s"`}><path d="M0 0V9" stroke="#0f1b3d" stroke-width="1.2"/><rect x="-6" y="9" width="12" height="3" rx="1.5" fill="#ef4444"/><circle cx="-2" cy="6.5" r="2.1" fill="#fde68a"/><circle cx="3" cy="6.5" r="2.1" fill="#93c5fd"/></g>`;
    // stugan
    L += `<g transform="translate(742 254)"><rect x="-22" y="-14" width="44" height="26" fill="#7f1d1d"/><path d="M-28 -12 L0 -34 L28 -12Z" fill="#3b1d2a"/><path d="M-30 -11 L0 -36 L30 -11 L26 -9 L0 -30 L-26 -9Z" fill="#eef4ff"/>
      <rect x="11" y="-38" width="6" height="12" fill="#3b1d2a"/><rect x="10" y="-40" width="8" height="3" fill="#eef4ff"/>
      <circle cx="-9" cy="-2" r="12" fill="url(#${p}win)" opacity=".8"/><rect x="-14" y="-7" width="9" height="9" fill="#ffd27a"/><rect x="4" y="-7" width="9" height="9" fill="#ffd27a"/><path d="M-9.5 -7v9M-14 -2.5h9M8.5 -7v9M4 -2.5h9" stroke="#7f1d1d" stroke-width="1.2"/></g>`;
    if (!o.still) for (let i = 0; i < 4; i++) L += `<circle class="mv vt-smoke" style="animation-delay:-${i * 1.6}s" cx="756" cy="214" r="5" fill="#dbe4f5"/>`;
    // backen med pistspår
    L += `<path d="M0 236 C220 226 430 252 650 312 C800 352 1000 380 1200 386 V400 H0Z" fill="url(#${p}near)"/>
      <path d="M0 236 C220 226 430 252 650 312 C800 352 1000 380 1200 386" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>
      <g fill="none" stroke="#8ea2cc" stroke-opacity=".45" stroke-width="1.4"><path d="M330 262 C480 280 600 320 760 356 S1000 392 1200 396"/><path d="M300 276 C460 296 580 336 740 372"/></g>`;
    // granar längs backen
    [[40, 250, 70], [92, 262, 54], [140, 246, 64], [196, 258, 46], [262, 266, 40], [968, 384, 60], [1030, 390, 74], [1092, 392, 56], [1150, 396, 66], [868, 376, 38], [905, 380, 30]].forEach(([x, y, h]) => L += fir(x, y, h, '#163246', '#eef4ff'));
    [[470, 218, 22], [492, 222, 18], [640, 232, 20], [662, 236, 16], [840, 240, 22], [355, 226, 18]].forEach(([x, y, h]) => L += fir(x, y, h, '#1a2c4e', '#d8e3f8'));
    // snögubbe
    L += `<g transform="translate(822 352)"><ellipse cx="0" cy="8" rx="16" ry="4" fill="#6f86b8" opacity=".5"/><circle r="13" fill="#f8fbff"/><circle cy="-18" r="9.5" fill="#f8fbff"/><circle cy="-31" r="7" fill="#f8fbff"/>
      <rect x="-6" y="-44" width="12" height="9" rx="1.5" fill="#1e293b"/><rect x="-9" y="-37" width="18" height="2.6" rx="1.3" fill="#1e293b"/><path d="M0 -31 l9 2 -9 1.6z" fill="#f97316"/>
      <circle cx="-2.5" cy="-33" r="1.1" fill="#1e293b"/><circle cx="2.5" cy="-33" r="1.1" fill="#1e293b"/><path d="M-7 -24 q7 4 14 0" stroke="#ef4444" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M5 -23 l3 9" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
      <circle cy="-17" r="1.4" fill="#1e293b"/><circle cy="-11" r="1.4" fill="#1e293b"/><path d="M-9 -18 l-12 -8 M12 -18 l11 -9" stroke="#5b3a29" stroke-width="1.8" stroke-linecap="round"/></g>`;
    // skidåkare i slalomsvängar nedför backen
    const skier = (jk, hel, pants) => `<g class="vt-lean"><path d="M-11 0 L13 3" stroke="#fbbf24" stroke-width="2.4" stroke-linecap="round"/><path d="M-9 2.6 L14 5.6" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" opacity=".85"/>
      <path d="M-1 -11 L4 -6 L1 0 M1 -11 L6 -5 L4 2" stroke="${pants}" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-2 -11 Q1 -19 6 -19 L8 -15 Q4 -12 1 -10Z" fill="${jk}"/><path d="M5 -17 L10 -12 L3 0" stroke="#e5e7eb" stroke-width="1.2" fill="none"/><path d="M5 -17 L10 -12" stroke="${jk}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="8" cy="-22" r="3.6" fill="${hel}"/><rect x="8" y="-23.4" width="4.4" height="2.4" rx="1.2" fill="#a5f3fc"/></g>
      <g class="vt-spray"><circle cx="-12" cy="-1" r="2.6" fill="#fff"/><circle cx="-17" cy="-4" r="1.8" fill="#fff"/><circle cx="-15" cy="1" r="1.4" fill="#fff"/></g>`;
    if (!o.still) {
      L += `<g class="mv vt-ski" style="animation-duration:15s">${skier('#ef4444', '#facc15', '#1e3a8a')}</g>`;
      L += `<g class="mv vt-ski vt-ski2" style="animation-duration:18s;animation-delay:-8s">${skier('#a855f7', '#f9a8d4', '#0f172a')}</g>`;
      L += `<g class="mv vt-ski vt-ski3" style="animation-duration:21s;animation-delay:-15s">${skier('#22d3ee', '#ffffff', '#831843')}</g>`;
    } else L += `<g transform="translate(560 300) rotate(16)">${skier('#ef4444', '#facc15', '#1e3a8a')}</g>`;
    let h = div('scn-moon vt-moon', '', '') + stars(o.few ? 24 : 50, 34, R);
    h += land(p, L, 48);
    if (!o.still) h += parts('vt-snow', o.few ? 34 : 70, R, (i, R) => { const s = 2 + R() * (R() < .2 ? 5 : 3); return `<i style="left:${f1(R() * 100)}%;width:${f1(s)}px;height:${f1(s)}px;opacity:${(.5 + R() * .5).toFixed(2)};--sx:${f1(R() * 60 - 30)}px;animation-duration:${f1(9 + R() * 10)}s;animation-delay:-${f1(R() * 20)}s"></i>`; });
    return h;
  };

  /* ---------- Rymdäventyr ---------- */
  const ROCKET = `<svg viewBox="0 0 60 120" aria-hidden="true"><defs><linearGradient id="rkb" x1="0" x2="1"><stop offset="0" stop-color="#cbd5e1"/><stop offset=".45" stop-color="#ffffff"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
    <radialGradient id="rkf" cx="50%" cy="10%" r="90%"><stop offset="0" stop-color="#fff7cc"/><stop offset=".35" stop-color="#fbbf24"/><stop offset=".7" stop-color="#f97316"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/></radialGradient></defs>
    <g class="rk-flame"><path d="M20 88 Q30 124 40 88Z" fill="url(#rkf)"/><path d="M25 88 Q30 108 35 88Z" fill="#fffbe6"/></g>
    <path d="M30 4 C44 18 46 44 44 72 L44 88 H16 L16 72 C14 44 16 18 30 4Z" fill="url(#rkb)" stroke="#64748b" stroke-width="1.4"/>
    <path d="M30 4 C37 11 41 19 43 28 H17 C19 19 23 11 30 4Z" fill="#ef4444"/>
    <circle cx="30" cy="46" r="9" fill="#1e3a8a" stroke="#94a3b8" stroke-width="3"/><circle cx="30" cy="46" r="5.5" fill="#fde68a"/><circle cx="28" cy="45" r=".9" fill="#1e293b"/><circle cx="32" cy="45" r=".9" fill="#1e293b"/><path d="M28 48 q2 1.6 4 0" stroke="#1e293b" stroke-width=".9" fill="none"/><path d="M24.5 42 a7 7 0 0 1 5 -3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M16 66 L4 86 L4 94 L16 86Z M44 66 L56 86 L56 94 L44 86Z" fill="#ef4444" stroke="#991b1b" stroke-width="1.2"/><rect x="27" y="68" width="6" height="22" rx="3" fill="#ef4444"/><rect x="17" y="86" width="26" height="5" rx="2" fill="#475569"/></svg>`;
  const ASTRO = `<svg viewBox="0 0 100 120" aria-hidden="true"><defs><radialGradient id="asv" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff7d6"/><stop offset=".35" stop-color="#fbbf24"/><stop offset=".8" stop-color="#7c2d12"/><stop offset="1" stop-color="#1c1917"/></radialGradient>
    <linearGradient id="ass" x1="0" x2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>
    <path d="M26 8 C10 30 8 60 22 76" stroke="#94a3b8" stroke-width="1.6" fill="none" stroke-dasharray="3 3" opacity=".6"/>
    <rect x="24" y="40" width="52" height="42" rx="10" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
    <path d="M30 52 C30 44 70 44 70 52 L72 86 C72 92 28 92 28 86Z" fill="url(#ass)" stroke="#94a3b8" stroke-width="1.5"/>
    <rect x="40" y="60" width="20" height="13" rx="3" fill="#cbd5e1" stroke="#64748b"/><circle cx="45" cy="66" r="2" fill="#ef4444"/><circle cx="51" cy="66" r="2" fill="#22c55e"/><circle cx="56" cy="66" r="1.6" fill="#38bdf8"/>
    <g class="as-wave"><path d="M68 56 C80 52 84 40 82 30" stroke="url(#ass)" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="82" cy="27" r="6.5" fill="#f8fafc" stroke="#94a3b8"/></g>
    <path d="M32 58 C22 64 20 76 24 84" stroke="url(#ass)" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="25" cy="87" r="6.5" fill="#f8fafc" stroke="#94a3b8"/>
    <path d="M38 88 L36 108 M62 88 L64 108" stroke="url(#ass)" stroke-width="13" stroke-linecap="round"/><rect x="28" y="104" width="16" height="9" rx="4" fill="#64748b"/><rect x="56" y="104" width="16" height="9" rx="4" fill="#64748b"/>
    <circle cx="50" cy="32" r="22" fill="url(#ass)" stroke="#94a3b8" stroke-width="1.5"/><ellipse cx="50" cy="33" rx="16" ry="13" fill="url(#asv)"/><path d="M40 27 C43 23 49 22 53 23" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".85"/><circle cx="60" cy="38" r="1.8" fill="#fff" opacity=".7"/>
    <rect x="44" y="50" width="12" height="4" rx="2" fill="#f472b6"/></svg>`;
  // flaggan på månen: Sverige, Norge eller Jämtland, slumpas varje gång
  const FLAG = () => {
    const x = 1, y = -46, w = 30, h = 18, rect = (x0, y0, ww, hh, c) => `<rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(ww)}" height="${f1(hh)}" fill="${c}"/>`, k = Math.floor(Math.random() * 3);
    if (k === 0) { const u = w / 16, v = h / 10; return rect(x, y, w, h, '#006aa7') + rect(x + 5 * u, y, 2 * u, h, '#fecc02') + rect(x, y + 4 * v, w, 2 * v, '#fecc02'); }   // Sverige
    if (k === 1) { const u = w / 22, v = h / 16; return rect(x, y, w, h, '#ba0c2f') + rect(x + 6 * u, y, 4 * u, h, '#fff') + rect(x, y + 6 * v, w, 4 * v, '#fff') + rect(x + 7 * u, y, 2 * u, h, '#00205b') + rect(x, y + 7 * v, w, 2 * v, '#00205b'); }   // Norge
    return rect(x, y, w, h / 3, '#1f5fae') + rect(x, y + h / 3, w, h / 3, '#fff') + rect(x, y + 2 * h / 3, w, h / 3, '#2e8b3a');   // Jämtland
  };
  BUILD.kosmos = (p, o, R) => {
    const r = rng(23);
    let L = `<defs><linearGradient id="${p}gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a7299"/><stop offset=".35" stop-color="#4a4468"/><stop offset="1" stop-color="#1d1a2e"/></linearGradient>
      <radialGradient id="${p}cr" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#2a2540"/><stop offset="1" stop-color="#3f3a5c"/></radialGradient>
      <radialGradient id="${p}dome" cx="40%" cy="30%" r="70%"><stop offset="0" stop-color="#e0f2fe" stop-opacity=".9"/><stop offset=".6" stop-color="#7dd3fc" stop-opacity=".45"/><stop offset="1" stop-color="#0ea5e9" stop-opacity=".35"/></radialGradient></defs>
      <path d="M0 300 C120 286 220 304 330 296 S520 280 640 292 S860 306 980 290 S1140 286 1200 294 V400 H0Z" fill="url(#${p}gr)"/>
      <path d="M0 300 C120 286 220 304 330 296 S520 280 640 292 S860 306 980 290 S1140 286 1200 294" fill="none" stroke="#c4b5fd" stroke-opacity=".55" stroke-width="1.6"/>`;
    [[160, 330, 46], [380, 352, 30], [560, 322, 22], [760, 360, 52], [930, 330, 28], [1080, 362, 40], [470, 380, 18], [660, 386, 14]].forEach(([x, y, w]) => {
      L += `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${f1(w * .28)}" fill="url(#${p}cr)"/><path d="M${x - w} ${y} A${w} ${f1(w * .28)} 0 0 0 ${x + w} ${y}" fill="none" stroke="#a5a0c8" stroke-opacity=".55" stroke-width="1.6"/>`; });
    for (let i = 0; i < 16; i++) { const x = r() * 1200, y = 310 + r() * 80, s = 3 + r() * 7; L += `<path d="M${f1(x - s)} ${f1(y)} Q${f1(x - s * .6)} ${f1(y - s)} ${f1(x)} ${f1(y - s * .9)} Q${f1(x + s)} ${f1(y - s * .7)} ${f1(x + s)} ${f1(y)}Z" fill="#5b5578"/>`; }
    // månbas
    L += `<g transform="translate(470 296)"><rect x="-70" y="-14" width="56" height="16" rx="8" fill="#cbd5e1" stroke="#64748b"/><circle cx="-56" cy="-6" r="3" fill="#fde68a"/><circle cx="-44" cy="-6" r="3" fill="#fde68a"/><circle cx="-32" cy="-6" r="3" fill="#fde68a"/>
      <path d="M-14 2 A30 30 0 0 1 46 2Z" fill="url(#${p}dome)" stroke="#e0f2fe" stroke-width="1.6"/><path d="M16 2 V-28 M-6 -4 Q16 -20 38 -4" stroke="#e0f2fe" stroke-opacity=".6" stroke-width="1" fill="none"/>
      <path d="M2 -6 q4 -10 10 -6 q2 -8 8 -3 l0 9z" fill="#22c55e" opacity=".85"/><path d="M58 2 V-34" stroke="#94a3b8" stroke-width="2"/><path d="M48 -40 A12 12 0 0 0 68 -28" fill="#e2e8f0" stroke="#94a3b8"/><circle class="mv kz-blink" cx="58" cy="-36" r="2.4" fill="#f43f5e"/></g>`;
    // flagga med egen stjärna
    L += `<g transform="translate(700 300)"><path d="M0 0 V-46" stroke="#e2e8f0" stroke-width="2"/><g class="mv kz-flag">${FLAG()}</g></g>`;
    // rover
    const rover = `<g><rect x="-22" y="-20" width="44" height="12" rx="4" fill="#e2e8f0" stroke="#64748b"/><rect x="-16" y="-27" width="18" height="8" rx="2" fill="#38bdf8" opacity=".85"/><path d="M14 -20 V-36" stroke="#94a3b8" stroke-width="1.5"/><circle class="kz-blink" cx="14" cy="-37" r="2.2" fill="#fbbf24"/>
      ${[-15, 0, 15].map(x => `<g class="kz-wheel" style="transform-origin:${x}px -4px"><circle cx="${x}" cy="-4" r="6" fill="#334155" stroke="#94a3b8" stroke-width="1.5"/><path d="M${x - 5} -4 h10 M${x} -9 v10" stroke="#94a3b8" stroke-width="1"/></g>`).join('')}</g>`;
    L += o.still ? `<g transform="translate(610 312)">${rover}</g>` : `<g class="mv kz-rover">${rover}</g>`;
    let h = div('kz-neb kz-neb1', '') + div('kz-neb kz-neb2', '') + stars(o.few ? 60 : 120, 70, R);
    h += div('kz-giant', '', `<svg viewBox="0 0 300 300" aria-hidden="true"><defs><radialGradient id="${p}gi" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fde68a"/><stop offset=".3" stop-color="#fb923c"/><stop offset=".65" stop-color="#be185d"/><stop offset="1" stop-color="#3b0764"/></radialGradient>
      <clipPath id="${p}gc"><circle cx="150" cy="150" r="104"/></clipPath></defs>
      <path d="M18 176 A140 34 -14 0 1 282 110" fill="none" stroke="#fcd34d" stroke-opacity=".45" stroke-width="10"/>
      <circle cx="150" cy="150" r="104" fill="url(#${p}gi)"/><g clip-path="url(#${p}gc)" opacity=".35"><path d="M30 110 Q150 90 270 120" stroke="#fff7ed" stroke-width="10" fill="none"/><path d="M30 150 Q150 135 270 160" stroke="#7c2d12" stroke-width="14" fill="none"/><path d="M30 190 Q150 178 270 200" stroke="#fde68a" stroke-width="8" fill="none"/><ellipse cx="190" cy="168" rx="22" ry="10" fill="#7f1d1d"/></g>
      <circle cx="150" cy="150" r="104" fill="none" stroke="#f9a8d4" stroke-opacity=".4" stroke-width="3"/>
      <path d="M18 176 A140 34 -14 0 0 282 110" fill="none" stroke="#fde68a" stroke-opacity=".75" stroke-width="10"/><path d="M26 182 A140 34 -14 0 0 276 118" fill="none" stroke="#fb923c" stroke-opacity=".4" stroke-width="4"/></svg>`);
    h += div('kz-moon', '', `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${p}mn" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="#f8fafc"/><stop offset=".6" stop-color="#cbd5e1"/><stop offset="1" stop-color="#64748b"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#${p}mn)"/>
      ${[[34, 36, 9], [62, 30, 6], [58, 62, 11], [30, 66, 5], [76, 52, 4]].map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}" fill="#94a3b8" opacity=".55"/><path d="M${x - s} ${y} a${s} ${s} 0 0 1 ${s * 2} 0" stroke="#fff" stroke-opacity=".5" fill="none"/>`).join('')}</svg>`);
    h += div('kz-blue', '');
    if (!o.still) {
      h += div('mv kz-rocket', '', ROCKET);
      h += div('mv kz-astro', '', ASTRO);
      h += div('mv kz-sat', '', `<svg viewBox="0 0 80 40" aria-hidden="true"><rect x="0" y="12" width="26" height="16" fill="#1d4ed8" stroke="#93c5fd"/><path d="M9 12v16M17 12v16M0 20h26" stroke="#93c5fd" stroke-width=".8"/><rect x="54" y="12" width="26" height="16" fill="#1d4ed8" stroke="#93c5fd"/><path d="M63 12v16M71 12v16M54 20h26" stroke="#93c5fd" stroke-width=".8"/><rect x="30" y="10" width="20" height="20" rx="3" fill="#fbbf24" stroke="#b45309"/><path d="M26 20h4M50 20h4" stroke="#e2e8f0" stroke-width="2"/><circle class="kz-blink" cx="40" cy="8" r="2" fill="#ef4444"/></svg>`);
      h += div('mv kz-ufo', '', `<svg viewBox="0 0 90 60" aria-hidden="true"><path d="M32 48 L20 60 M58 48 L70 60" stroke="#a7f3d0" stroke-opacity=".5" stroke-width="3"/><path d="M45 18 C30 18 26 28 26 30 H64 C64 28 60 18 45 18Z" fill="#a5f3fc" opacity=".85"/><circle cx="45" cy="26" r="5" fill="#86efac"/><circle cx="43" cy="25" r="1" fill="#14532d"/><circle cx="47" cy="25" r="1" fill="#14532d"/>
        <ellipse cx="45" cy="34" rx="38" ry="10" fill="#c084fc" stroke="#7c3aed" stroke-width="1.5"/><ellipse cx="45" cy="31" rx="30" ry="5" fill="#e9d5ff" opacity=".6"/>${[18, 32, 45, 58, 72].map((x, i) => `<circle class="kz-blink" style="animation-delay:${i * .2}s" cx="${x}" cy="36" r="2.4" fill="${['#fde047', '#f472b6', '#67e8f9'][i % 3]}"/>`).join('')}</svg>`);
      for (let i = 0; i < 2; i++) h += `<div class="shoot" style="top:${10 + i * 22}%;right:-${10 + i * 10}%;animation-delay:${i * 4.5}s"></div>`;
    }
    return h + land(p, L, 34);
  };

  /* ---------- Norrsken ---------- */
  BUILD.norrsken = (p, o, R) => {
    const r = rng(37);
    // norrsken: tusentals strålar längs en vågig nederkant – ljus nedtill, bleknar uppåt; tre grupper skimrar i otakt
    const curtain = (id, base, amp, hMin, hVar, ph, seed) => { const q = rng(seed); let g = ['', '', ''], edge = '';
      for (let x = -10, i = 0; x <= 410; x += 2.6, i++) {
        const y = base + amp * Math.sin(x / 46 + ph) + amp * .45 * Math.sin(x / 17 + ph * 2), h = hMin + hVar * Math.pow(Math.sin(x / 70 + ph), 2) + q() * 24;
        g[i % 3] += `<rect x="${f1(x)}" y="${f1(y - h)}" width="${f1(1.6 + q() * 1.8)}" height="${f1(h)}" fill="url(#${id})" opacity="${(.35 + q() * .65).toFixed(2)}"/>`;
        edge += (i ? ' L' : 'M') + f1(x) + ' ' + f1(y - 2); }
      return `<path d="${edge}" fill="none" stroke="url(#${id}e)" stroke-width="4" opacity=".22" stroke-linecap="round"/>` + g.map((r, k) => `<g class="nr-sh nr-sh${k}">${r}</g>`).join(''); };
    const aur = `<svg viewBox="0 0 400 220" preserveAspectRatio="none" aria-hidden="true"><defs>
      <linearGradient id="${p}a1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c084fc" stop-opacity="0"/><stop offset=".35" stop-color="#a78bfa" stop-opacity=".12"/><stop offset=".72" stop-color="#34d399" stop-opacity=".5"/><stop offset=".94" stop-color="#6ee7b7" stop-opacity=".95"/><stop offset="1" stop-color="#ecfdf5" stop-opacity=".9"/></linearGradient>
      <linearGradient id="${p}a1e" x1="0" x2="1"><stop offset="0" stop-color="#34d399"/><stop offset=".5" stop-color="#6ee7b7"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient>
      <linearGradient id="${p}a2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a855f7" stop-opacity="0"/><stop offset=".5" stop-color="#c084fc" stop-opacity=".22"/><stop offset=".9" stop-color="#f0abfc" stop-opacity=".6"/><stop offset="1" stop-color="#f9a8d4" stop-opacity=".55"/></linearGradient>
      <linearGradient id="${p}a2e" x1="0" x2="1"><stop offset="0" stop-color="#e879f9"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>
      <linearGradient id="${p}a3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity="0"/><stop offset=".7" stop-color="#2dd4bf" stop-opacity=".3"/><stop offset="1" stop-color="#a7f3d0" stop-opacity=".85"/></linearGradient>
      <linearGradient id="${p}a3e" x1="0" x2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#67e8f9"/></linearGradient></defs>
      <g class="nr-cur nr-c2">${curtain(p + 'a2', 96, 16, 40, 50, 2.2, 3)}</g>
      <g class="nr-cur nr-c1">${curtain(p + 'a1', 158, 22, 60, 80, 0, 5)}</g>
      <g class="nr-cur nr-c3">${curtain(p + 'a3', 192, 10, 30, 40, 4.1, 9)}</g></svg>`;
    let L = `<defs><linearGradient id="${p}h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3b63"/><stop offset="1" stop-color="#0d2142"/></linearGradient>
      <linearGradient id="${p}sn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9db7da"/><stop offset=".5" stop-color="#5f7ea9"/><stop offset="1" stop-color="#2b4670"/></linearGradient>
      <linearGradient id="${p}lk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c2a40"/><stop offset="1" stop-color="#06182a"/></linearGradient>
      <linearGradient id="${p}rf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ee7b7" stop-opacity=".55"/><stop offset="1" stop-color="#6ee7b7" stop-opacity="0"/></linearGradient>
      <radialGradient id="${p}win"><stop offset="0" stop-color="#ffe3a3" stop-opacity=".9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>`;
    L += range([[0, 230], [120, 190], [240, 226], [380, 176], [520, 222], [660, 186], [800, 226], [940, 180], [1080, 222], [1200, 196]], 400, `url(#${p}h1)`, 'rgba(0,0,0,.18)', '#7d97bd', .45, r);
    // skogsrand
    for (let x = -10; x < 1210; x += 13 + r() * 10) { const h = 24 + r() * 26, y = 262 + Math.sin(x / 90) * 6; L += fir(x, y, h, '#071426', null); }
    L += `<path d="M0 262 C200 252 380 270 600 262 S1000 254 1200 264 V400 H0Z" fill="url(#${p}sn)"/>`;
    // sjön med norrskensspegling
    L += `<ellipse cx="610" cy="352" rx="330" ry="34" fill="url(#${p}lk)"/><g class="nr-refl"><path d="M380 340 Q610 334 840 342 L800 356 Q610 352 420 356Z" fill="url(#${p}rf)"/></g><path d="M300 352 Q610 326 920 352" fill="none" stroke="#b6cbe6" stroke-opacity=".35" stroke-width="1.5"/>`;
    // stugan
    L += `<g transform="translate(500 262)"><circle cx="0" cy="-8" r="34" fill="url(#${p}win)" opacity=".45"/><rect x="-30" y="-26" width="60" height="30" fill="#8b2323"/><path d="M-30 -26h60M-30 -16h60M-30 -6h60" stroke="#6b1a1a" stroke-width="1"/>
      <rect x="-30" y="-26" width="4" height="30" fill="#f5f5f4"/><rect x="26" y="-26" width="4" height="30" fill="#f5f5f4"/><path d="M-38 -24 L0 -52 L38 -24Z" fill="#1f2937"/><path d="M-40 -23 L0 -54 L40 -23 L34 -21 L0 -46 L-34 -21Z" fill="#e7eef8"/>
      <rect x="16" y="-56" width="7" height="16" fill="#3f3f46"/><rect x="15" y="-58" width="9" height="3" fill="#e7eef8"/>
      <rect x="-20" y="-18" width="12" height="11" fill="#ffd27a" stroke="#f5f5f4" stroke-width="1.6"/><rect x="8" y="-18" width="12" height="11" fill="#ffd27a" stroke="#f5f5f4" stroke-width="1.6"/><path d="M-14 -18v11M-20 -12.5h12M14 -18v11M8 -12.5h12" stroke="#f5f5f4" stroke-width="1"/>
      <rect x="-5" y="-14" width="10" height="18" fill="#4a1d1d" stroke="#f5f5f4" stroke-width="1.4"/></g>`;
    if (!o.still) for (let i = 0; i < 4; i++) L += `<circle class="mv vt-smoke" style="animation-delay:-${i * 1.6}s" cx="520" cy="200" r="5" fill="#9fb3cf"/>`;
    // renar
    const ren = (s) => `<g transform="scale(${s})"><g class="nr-bob"><path d="M-18 -16 C-18 -24 12 -26 16 -18 L18 -10 C10 -6 -12 -6 -18 -10Z" fill="#1b1410"/><path d="M12 -20 L20 -34 L27 -33 L24 -26 L16 -16Z" fill="#1b1410"/><ellipse cx="25" cy="-32" rx="5" ry="3" fill="#1b1410"/>
      <path d="M21 -36 C18 -44 20 -50 15 -54 M19 -42 L13 -44 M24 -36 C26 -44 32 -48 31 -54 M28 -43 L34 -45" stroke="#1b1410" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M-18 -14 l-4 2" stroke="#1b1410" stroke-width="2.4" stroke-linecap="round"/></g>
      <g class="nr-legs" stroke="#1b1410" stroke-width="2.4" stroke-linecap="round"><path d="M-13 -10 L-15 4 M-7 -9 L-5 4 M8 -9 L6 4 M13 -10 L16 4"/></g></g>`;
    L += o.still ? `<g transform="translate(700 300)">${ren(1)}</g>` : `<g class="mv nr-walk">${ren(1)}</g><g class="mv nr-walk nr-walk2">${ren(.8)}</g>`;
    [[90, 392, 66], [150, 400, 80], [1060, 398, 74], [1130, 400, 60], [330, 392, 40], [880, 396, 44]].forEach(([x, y, h]) => L += fir(x, y, h, '#050d1a', '#5f7ea9'));
    let h = stars(o.few ? 60 : 130, 60, R) + div('nr-aur', '', aur) + land(p, L, 40);
    if (!o.still) for (let i = 0; i < 2; i++) h += `<div class="shoot" style="top:${8 + i * 18}%;right:-${10 + i * 8}%;animation-delay:${2 + i * 5}s"></div>`;
    return h;
  };

  /* ---------- Körsbärsträdgård ---------- */
  const blossom = (x, y, s, c, rot) => `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot | 0}) scale(${s})">${[0, 72, 144, 216, 288].map(a => `<path transform="rotate(${a})" d="M0 0 C-4 -3 -5 -9 -2 -11 L0 -10 L2 -11 C5 -9 4 -3 0 0Z" fill="${c}"/>`).join('')}<circle r="1.6" fill="#fde68a"/></g>`;
  function branch(p, r, flip) {
    let o = `<g ${flip ? 'transform="translate(240 0) scale(-1 1)"' : ''}><path d="M-10 18 C40 40 70 30 110 60 S170 120 230 126" stroke="#3a2230" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M60 36 C70 10 96 0 120 -6 M120 74 C140 74 160 90 176 84 M150 106 C150 132 160 150 150 172 M30 30 C30 60 40 80 30 100" stroke="#3a2230" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    const C = ['#fbcfe8', '#f9a8d4', '#fce7f3', '#f472b6', '#fff1f7'];
    [[60, 36], [120, -6], [110, 60], [176, 84], [150, 172], [230, 126], [30, 100], [90, 20], [160, 110], [200, 120], [140, 80], [40, 60]].forEach(([cx, cy]) => {
      for (let i = 0; i < 9; i++) o += blossom(cx + (r() - .5) * 34, cy + (r() - .5) * 26, .9 + r() * .7, C[Math.floor(r() * C.length)], r() * 72); });
    return o + '</g>';
  }
  BUILD.sakura = (p, o, R) => {
    const r = rng(53);
    let L = `<defs><linearGradient id="${p}fj" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e8ff"/><stop offset=".25" stop-color="#c7a6d6"/><stop offset="1" stop-color="#6b4a85"/></linearGradient>
      <linearGradient id="${p}hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2a5c"/><stop offset="1" stop-color="#2a1638"/></linearGradient>
      <linearGradient id="${p}pd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b3a78"/><stop offset="1" stop-color="#2a1a40"/></linearGradient>
      <radialGradient id="${p}lan"><stop offset="0" stop-color="#ffe9b3"/><stop offset="1" stop-color="#fb923c" stop-opacity="0"/></radialGradient></defs>
      <path d="M380 260 L560 96 Q600 84 640 96 L820 260Z" fill="url(#${p}fj)" opacity=".75"/><path d="M560 96 Q600 84 640 96 L668 122 L648 116 L630 128 L606 114 L584 126 L566 116 L534 124Z" fill="#fff" opacity=".85"/>
      <path d="M0 270 C150 230 300 260 420 248 S650 236 780 252 S1050 230 1200 246 V400 H0Z" fill="url(#${p}hl)"/>`;
    // pagod på kullen
    const roof = (y, w) => `<path d="M${-w - 8} ${y} Q0 ${y - 14} ${w + 8} ${y} L${w + 2} ${y + 4} Q0 ${y - 6} ${-w - 2} ${y + 4}Z" fill="#2a1030"/>`;
    L += `<g transform="translate(320 246)"><rect x="-14" y="-14" width="28" height="14" fill="#7f1d1d"/>${roof(-14, 24)}<rect x="-11" y="-32" width="22" height="16" fill="#7f1d1d"/>${roof(-32, 20)}<rect x="-8" y="-48" width="16" height="14" fill="#7f1d1d"/>${roof(-48, 16)}<rect x="-6" y="-62" width="12" height="12" fill="#7f1d1d"/>${roof(-62, 12)}<path d="M0 -66 V-84" stroke="#2a1030" stroke-width="2.4"/>
      ${[-6, 4].map(x => `<rect x="${x}" y="-10" width="3" height="6" fill="#ffd27a"/>`).join('')}<rect x="-1.5" y="-28" width="3" height="6" fill="#ffd27a"/></g>`;
    // dammen, bron och lyktor
    L += `<ellipse cx="640" cy="330" rx="300" ry="40" fill="url(#${p}pd)"/><ellipse cx="760" cy="324" rx="40" ry="5" fill="#ffe4f1" opacity=".35"/><path d="M380 330 Q640 300 900 330" fill="none" stroke="#f9a8d4" stroke-opacity=".25" stroke-width="2"/>
      <g transform="translate(600 318)"><path d="M-80 10 Q0 -56 80 10" fill="none" stroke="#b91c1c" stroke-width="9" stroke-linecap="round"/><path d="M-76 -2 Q0 -66 76 -2" fill="none" stroke="#dc2626" stroke-width="3"/>${[-56, -28, 0, 28, 56].map(x => `<path d="M${x} ${f1(-(56 - Math.abs(x) * .7) * .74 + 6)} v-13" stroke="#dc2626" stroke-width="3"/>`).join('')}
      <path d="M-80 10 Q0 30 80 10" fill="none" stroke="#7f1d1d" stroke-opacity=".35" stroke-width="6"/></g>`;
    [[470, 300], [800, 296]].forEach(([x, y]) => L += `<g transform="translate(${x} ${y})"><circle cy="-18" r="22" fill="url(#${p}lan)" opacity=".7"/><rect x="-3" y="-6" width="6" height="12" fill="#57534e"/><path d="M-12 -10 h24 l-4 -6 h-16z" fill="#78716c"/><rect x="-7" y="-24" width="14" height="10" fill="#ffd27a"/><path d="M-12 -24 Q0 -34 12 -24Z" fill="#78716c"/></g>`);
    // blommande träd vid kanterna
    const tree = (x, y, s) => { let t = `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C-4 -30 6 -50 -2 -80 M-2 -60 C-20 -72 -30 -86 -36 -96 M0 -70 C16 -82 30 -88 40 -100" stroke="#3a2230" stroke-width="7" fill="none" stroke-linecap="round"/>`;
      for (let i = 0; i < 34; i++) { const a = r() * Math.PI * 2, d = r() * 56; t += `<circle cx="${f1(Math.cos(a) * d * 1.2)}" cy="${f1(-100 + Math.sin(a) * d * .7)}" r="${f1(12 + r() * 14)}" fill="${pick(['#f9a8d4', '#fbcfe8', '#f472b6', '#fce7f3'], r)}" opacity="${(.55 + r() * .4).toFixed(2)}"/>`; }
      return t + '</g>'; };
    L += tree(120, 300, 1.2) + tree(1080, 296, 1.1) + tree(900, 262, .7) + tree(230, 270, .6);
    L += `<path d="M0 360 C200 346 420 372 640 366 S1000 352 1200 364 V400 H0Z" fill="#1d1028"/>`;
    let h = div('scn-moon sk-moon', '') + stars(o.few ? 20 : 40, 40, R) + land(p, L, 44);
    h += `<svg class="sk-branch" viewBox="-20 -20 260 220" aria-hidden="true">${branch(p, rng(59))}</svg>`;
    if (!o.still) {
      h += parts('sk-petals', o.few ? 18 : 40, R, (i, R) => `<i style="left:${f1(R() * 100)}%;--sx:${f1(R() * 160 - 40)}px;--rt:${f1(360 + R() * 540)}deg;animation-duration:${f1(9 + R() * 9)}s;animation-delay:-${f1(R() * 18)}s;transform:scale(${(.7 + R() * .7).toFixed(2)})"></i>`);
      h += parts('sk-lant', o.few ? 4 : 7, R, (i, R) => `<i style="left:${f1(8 + R() * 84)}%;animation-duration:${f1(22 + R() * 14)}s;animation-delay:-${f1(R() * 30)}s"></i>`);
    }
    return h;
  };

  /* ---------- Godislandet ---------- */
  BUILD.godis = (p, o, R) => {
    const r = rng(71);
    let L = `<defs><linearGradient id="${p}h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c065a8"/><stop offset="1" stop-color="#7a2e74"/></linearGradient>
      <linearGradient id="${p}h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fb3a5"/><stop offset="1" stop-color="#22625d"/></linearGradient>
      <linearGradient id="${p}h3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f74d9"/><stop offset="1" stop-color="#4a3290"/></linearGradient>
      <linearGradient id="${p}ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b5a3c"/><stop offset="1" stop-color="#4a2a1a"/></linearGradient>
      <radialGradient id="${p}gd" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <g opacity=".28" fill="none" stroke-width="10">${['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc'].map((c, i) => `<path d="M260 300 A340 ${250 - i * 10} 0 0 1 940 300" stroke="${c}" transform="translate(0 ${i * 10})"/>`).join('')}</g>`;
    L += `<path d="M0 236 C120 190 240 196 340 230 S520 260 600 232 S780 186 900 220 S1120 250 1200 222 V400 H0Z" fill="url(#${p}h3)"/>
      <path d="M0 270 C160 236 300 250 420 276 S640 300 760 262 S1000 236 1200 270 V400 H0Z" fill="url(#${p}h1)"/>`;
    const SP = ['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#fb923c', '#fff'];
    for (let i = 0; i < 70; i++) { const x = r() * 1200, y = 250 + r() * 140; L += `<rect x="${f1(x)}" y="${f1(y)}" width="7" height="2.6" rx="1.3" fill="${pick(SP, r)}" transform="rotate(${f1(r() * 180)} ${f1(x)} ${f1(y)})" opacity=".8"/>`; }
    // pepparkakshus
    L += `<g transform="translate(470 268)"><rect x="-40" y="-36" width="80" height="40" rx="3" fill="#b45309"/><path d="M-50 -34 L0 -76 L50 -34Z" fill="#92400e"/>
      <path d="M-52 -33 L0 -78 L52 -33" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${[-36, -24, -12, 0, 12, 24, 36].map(x => `<circle cx="${x}" cy="${f1(-33 - (36 - Math.abs(x)) * 1.18 + 4)}" r="3" fill="#fff"/>`).join('')}
      <rect x="-10" y="-20" width="20" height="24" rx="10" fill="#7c2d12" stroke="#fff" stroke-width="2"/><circle cx="5" cy="-8" r="1.6" fill="#fde047"/>
      ${[-27, 27].map(x => `<rect x="${x - 8}" y="-28" width="16" height="13" rx="2" fill="#fde68a" stroke="#fff" stroke-width="2"/><path d="M${x} -28 v13 M${x - 8} -21.5 h16" stroke="#f472b6" stroke-width="1.4"/>`).join('')}
      ${[-30, -16, 16, 30].map((x, i) => `<circle cx="${x}" cy="0" r="4" fill="#fff"/><path d="M${x - 4} 0 h8 M${x} -4 v8" stroke="${['#ef4444', '#22c55e'][i % 2]}" stroke-width="2.4"/>`).join('')}
      <rect x="22" y="-66" width="10" height="20" fill="#be185d"/><rect x="20" y="-68" width="14" height="5" rx="2" fill="#fff"/></g>`;
    if (!o.still) for (let i = 0; i < 4; i++) L += `<circle class="mv vt-smoke" style="animation-delay:-${i * 1.6}s" cx="497" cy="196" r="5" fill="#fbcfe8"/>`;
    // klubbträd och polkagrisstänger
    const lolly = (x, y, s, c1, c2) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 V-60" stroke="#fef3c7" stroke-width="4" stroke-linecap="round"/><circle cy="-76" r="20" fill="${c1}"/>
      <path d="M0 -76 m0 -3 a3 3 0 1 1 -3 3 a6 6 0 0 1 6 -6 a9 9 0 0 1 9 9 a12 12 0 0 1 -12 12 a15 15 0 0 1 -15 -15 a17 17 0 0 1 17 -17" fill="none" stroke="${c2}" stroke-width="3.4" stroke-linecap="round"/><circle cx="-8" cy="-86" r="5" fill="#fff" opacity=".45"/></g>`;
    L += lolly(330, 272, 1, '#f472b6', '#fff') + lolly(640, 262, .8, '#38bdf8', '#fde047') + lolly(1010, 262, 1.1, '#a3e635', '#fff') + lolly(150, 262, .9, '#fbbf24', '#ef4444') + lolly(760, 254, .6, '#c084fc', '#fff');
    const cane = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 V-50 a12 12 0 0 1 24 0 v4" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/><path d="M0 0 V-50 a12 12 0 0 1 24 0 v4" fill="none" stroke="#ef4444" stroke-width="8" stroke-dasharray="6 7" stroke-linecap="butt"/></g>`;
    L += cane(560, 282, .9) + cane(880, 258, 1) + cane(240, 276, .8);
    L += `<path d="M0 312 C180 300 300 330 470 322 S760 300 900 316 S1100 336 1200 322 V346 C1100 360 960 338 900 344 S640 354 470 350 S180 330 0 340Z" fill="url(#${p}ch)"/>
      <path d="M40 322 C120 316 200 330 280 326 M560 320 C640 314 720 318 790 312" stroke="#c08457" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linecap="round" class="gd-flow"/>`;
    L += `<path d="M0 352 C200 334 360 360 560 356 S900 340 1200 356 V400 H0Z" fill="url(#${p}h2)"/>`;
    [[100, 368, '#f87171'], [190, 374, '#fde047'], [620, 370, '#4ade80'], [700, 376, '#f472b6'], [1100, 366, '#60a5fa'], [1160, 374, '#fb923c'], [420, 372, '#c084fc']].forEach(([x, y, c]) => L += `<path d="M${x - 16} ${y} C${x - 16} ${y - 26} ${x + 16} ${y - 26} ${x + 16} ${y}Z" fill="${c}"/><path d="M${x - 16} ${y} C${x - 16} ${y - 26} ${x + 16} ${y - 26} ${x + 16} ${y}Z" fill="url(#${p}gd)"/>${[-8, 0, 8].map(dx => `<circle cx="${x + dx}" cy="${y - 10 + (dx ? 4 : 0)}" r="1.2" fill="#fff" opacity=".8"/>`).join('')}`);
    let h = stars(o.few ? 16 : 30, 30, R);
    const cloud = (cls, st, c1, c2) => div('gd-cloud ' + cls, st, `<svg viewBox="0 0 160 70" aria-hidden="true"><g fill="${c1}"><circle cx="40" cy="42" r="24"/><circle cx="70" cy="30" r="28"/><circle cx="104" cy="38" r="24"/><circle cx="128" cy="48" r="16"/><rect x="24" y="44" width="116" height="22" rx="11"/></g><g fill="${c2}" opacity=".6"><circle cx="62" cy="24" r="12"/><circle cx="96" cy="32" r="9"/></g></svg>`);
    h += cloud('gd-c1', 'top:12%', '#f9a8d4', '#fff') + cloud('gd-c2', 'top:26%', '#a5d8ff', '#fff') + cloud('gd-c3', 'top:6%', '#e9d5ff', '#fff');
    if (!o.still) {
      h += div('mv gd-ball', '', `<svg viewBox="0 0 80 110" aria-hidden="true"><path d="M40 4 C64 4 76 22 76 40 C76 60 56 70 50 80 H30 C24 70 4 60 4 40 C4 22 16 4 40 4Z" fill="#fde047"/><path d="M40 4 C50 4 56 22 56 40 C56 60 46 72 44 80 H36 C34 72 24 60 24 40 C24 22 30 4 40 4Z" fill="#f472b6"/><path d="M40 4 C44 4 46 22 46 40 C46 60 42 72 41 80 H39 C38 72 34 60 34 40 C34 22 36 4 40 4Z" fill="#60a5fa"/>
        <path d="M30 80 L33 92 M50 80 L47 92" stroke="#7c2d12" stroke-width="1.2"/><rect x="31" y="92" width="18" height="12" rx="3" fill="#b45309"/><path d="M14 22 C18 14 26 9 32 8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/></svg>`);
      h += parts('gd-spr', o.few ? 20 : 44, R, (i, R) => `<i style="left:${f1(R() * 100)}%;background:${pick(SP, R)};--sx:${f1(R() * 80 - 40)}px;--rt:${f1(R() * 720)}deg;animation-duration:${f1(10 + R() * 10)}s;animation-delay:-${f1(R() * 20)}s"></i>`);
    }
    return h + land(p, L, 44);
  };

  /* ---------- Drakdalen ---------- */
  const DRAGON = (c1, c2, id) => `<svg viewBox="0 0 200 110" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <g class="dr-wing dr-wb"><path d="M92 52 C84 26 70 10 52 4 C60 18 58 26 50 30 C58 34 60 40 54 46 C66 46 78 50 88 58Z" fill="${c2}" opacity=".85"/></g>
    <path d="M30 70 C10 70 2 60 4 52 C10 62 22 62 34 58" fill="none" stroke="url(#${id})" stroke-width="7" stroke-linecap="round"/><path d="M4 52 l-4 -9 9 3z" fill="${c1}"/>
    <path d="M30 66 C50 50 92 48 120 54 C140 58 150 48 160 40 L168 46 C158 60 146 70 122 72 C90 76 54 80 30 70Z" fill="url(#${id})"/>
    <path d="M50 64 C70 58 100 58 122 62" stroke="#fde68a" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="4 5"/>
    <path d="M160 40 C166 32 178 30 188 34 L196 40 C190 44 182 44 176 48 L168 50Z" fill="url(#${id})"/><path d="M168 34 l-6 -12 10 8z M176 32 l-2 -12 7 10z" fill="${c2}"/><circle cx="182" cy="38" r="2" fill="#fde047"/><circle cx="182.4" cy="38" r=".9" fill="#111"/><path d="M196 40 l3 1" stroke="${c2}" stroke-width="1.4"/>
    <path d="M80 62 l-6 18 6 -2 M110 64 l-2 18 6 -3" stroke="${c2}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M60 56 l4 -8 4 7 4 -8 4 7 4 -8 4 7 4 -8 4 7" fill="none" stroke="${c2}" stroke-width="2.6" stroke-linejoin="round"/>
    <g class="dr-wing dr-wf"><path d="M100 54 C96 24 84 4 64 -4 C76 12 74 22 64 28 C76 30 78 38 70 44 C84 42 92 46 98 56Z" fill="${c1}"/><path d="M100 54 C92 34 82 18 66 4 M98 52 C88 42 80 36 66 30" stroke="${c2}" stroke-width="1.6" fill="none"/></g>
    <g class="dr-fire"><path d="M196 42 C206 36 214 44 222 38 C216 48 208 46 200 46Z" fill="#fb923c"/><path d="M198 43 C204 40 210 44 214 41 C210 46 204 45 200 45Z" fill="#fde047"/></g></svg>`;
  BUILD.drakar = (p, o, R) => {
    const r = rng(89);
    let L = `<defs><linearGradient id="${p}m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2a63"/><stop offset="1" stop-color="#2a1640"/></linearGradient>
      <linearGradient id="${p}m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e1a45"/><stop offset="1" stop-color="#170c26"/></linearGradient>
      <linearGradient id="${p}cl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2450"/><stop offset="1" stop-color="#120a1e"/></linearGradient>
      <radialGradient id="${p}lv" cx="50%" cy="100%" r="80%"><stop offset="0" stop-color="#fde047"/><stop offset=".4" stop-color="#f97316"/><stop offset="1" stop-color="#f97316" stop-opacity="0"/></radialGradient>
      <radialGradient id="${p}win"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#fb923c" stop-opacity="0"/></radialGradient></defs>`;
    // vulkan långt bort
    L += `<path d="M820 240 L930 120 Q960 110 990 120 L1110 240Z" fill="#3a2050"/><ellipse cx="960" cy="118" rx="34" ry="26" fill="url(#${p}lv)" opacity=".9"/><path d="M944 122 C948 150 936 170 942 200 M972 124 C968 150 980 168 974 190" stroke="#f97316" stroke-width="3" fill="none" stroke-opacity=".7"/>`;
    if (!o.still) for (let i = 0; i < 5; i++) L += `<circle class="mv dr-ash" style="animation-delay:-${i * 2}s" cx="960" cy="110" r="10" fill="#4b3b5c"/>`;
    L += range([[0, 210], [80, 120], [150, 190], [240, 90], [330, 200], [420, 130], [470, 190], [760, 200], [840, 150], [900, 220], [1040, 160], [1120, 210], [1200, 150]], 400, `url(#${p}m1)`, 'rgba(0,0,0,.22)', null, 0, r);
    // klippan och borgen
    L += `<path d="M430 400 L470 300 L500 280 L520 240 L560 226 L640 224 L690 238 L716 270 L740 300 L780 400Z" fill="url(#${p}cl)"/><path d="M520 240 L540 300 L500 400 M690 238 L670 320 L700 400" stroke="#0b0614" stroke-opacity=".5" stroke-width="2" fill="none"/>`;
    const tower = (x, y, w, h, rh, flag) => `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" fill="#251634"/><path d="M${x - w / 2 - 4} ${y - h} L${x} ${y - h - rh} L${x + w / 2 + 4} ${y - h}Z" fill="#4c1d95"/>
      ${[...Array(Math.floor(h / 22))].map((_, i) => `<rect x="${x - 3}" y="${y - h + 10 + i * 22}" width="6" height="9" rx="3" fill="#ffd27a"/>`).join('')}
      ${flag ? `<path d="M${x} ${y - h - rh} v-16" stroke="#e5e7eb" stroke-width="1.6"/><path class="mv dr-flag" d="M${x} ${y - h - rh - 16} h16 l-4 5 4 5 h-16z" fill="${flag}"/>` : ''}`;
    L += `<g><circle cx="600" cy="180" r="70" fill="url(#${p}win)" opacity=".25"/><rect x="545" y="168" width="110" height="58" fill="#2b1a3c"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<rect x="${545 + i * 12.5}" y="160" width="8" height="10" fill="#2b1a3c"/>`).join('')}
      <path d="M588 226 V200 a12 12 0 0 1 24 0 V226Z" fill="#120a1e"/><path d="M588 204 h24" stroke="#6b4a2a" stroke-width="2"/>
      ${tower(545, 226, 26, 100, 34, '#f472b6')}${tower(655, 226, 26, 88, 30, '#38bdf8')}${tower(600, 168, 20, 40, 30, '#fde047')}${tower(518, 240, 16, 56, 22)}${tower(684, 238, 16, 50, 20)}</g>`;
    L += range([[0, 300], [90, 260], [180, 320], [300, 280], [420, 330], [430, 400], [780, 400], [800, 320], [900, 270], [1000, 320], [1100, 268], [1200, 300]], 400, `url(#${p}m2)`, 'rgba(0,0,0,.2)', null, 0, r);
    // träd-silhuetter
    for (let i = 0; i < 26; i++) { const x = i < 13 ? r() * 420 : 800 + r() * 400, y = 360 + r() * 40, h = 30 + r() * 40; L += fir(x, y, h, '#0c0616', null); }
    let h = div('scn-moon dr-moon', '') + stars(o.few ? 40 : 90, 55, R) + land(p, L, 50);
    if (!o.still) {
      h += div('mv dr-fly dr-fly1', '', `<div class="dr-bob">${DRAGON('#2dd4bf', '#0f766e', p + 'd1')}</div>`);
      h += div('mv dr-fly dr-fly2', '', `<div class="dr-bob">${DRAGON('#c084fc', '#6b21a8', p + 'd2')}</div>`);
      h += parts('dr-emb', o.few ? 18 : 40, R, (i, R) => { const s = 2 + R() * 3; return `<i style="left:${f1(R() * 100)}%;width:${f1(s)}px;height:${f1(s)}px;--sx:${f1(R() * 80 - 40)}px;animation-duration:${f1(7 + R() * 8)}s;animation-delay:-${f1(R() * 15)}s"></i>`; });
    }
    return h;
  };

  function build(k, o) {
    o = o || {}; const fn = BUILD[k]; if (!fn) return '';
    return `<div class="scn scn-${k}${o.thumb ? ' scn-th' : ''}">${fn(o.p || 'sc' + k, o, rng(o.seed || 7))}</div>`;
  }

  /* ================= bubblorna i varje värld ================= */
  let uid = 0; const U = () => 'b' + (++uid).toString(36);
  const HEART = 'M50 86 C47 83 6 56 6 29 C6 14 17 5 30 5 C39 5 46 10 50 17 C54 10 61 5 70 5 C83 5 94 14 94 29 C94 56 53 83 50 86 Z';
  function flake(c1, c2, centre) {
    const v = Math.floor(Math.random() * 3), arm = [0, 60, 120, 180, 240, 300];
    const br = v === 0 ? [[15, 11], [27, 9], [37, 6]] : v === 1 ? [[20, 14], [33, 8]] : [[12, 8], [22, 12], [31, 9], [39, 5]];
    const a1 = `<path d="M0 0 V-44 ${br.map(([y, l]) => `M0 -${y} l-${f1(l * .82)} -${f1(l * .58)} M0 -${y} l${f1(l * .82)} -${f1(l * .58)}`).join(' ')}"/>`;
    const tips = `<path d="M0 -48 l3 4 -3 4 -3 -4z" fill="${c1}" stroke="none"/>`;
    return `<svg viewBox="-50 -50 100 100" aria-hidden="true" class="sk-spin"><g stroke="${c2}" stroke-opacity=".55" stroke-width="7" stroke-linecap="round" fill="none">${arm.map(a => `<g transform="rotate(${a})">${a1}</g>`).join('')}</g>
      <g stroke="${c1}" stroke-width="3.2" stroke-linecap="round" fill="none">${arm.map(a => `<g transform="rotate(${a})">${a1}${tips}</g>`).join('')}</g>
      <path d="M0 -13 L11.3 -6.5 L11.3 6.5 L0 13 L-11.3 6.5 L-11.3 -6.5Z" fill="${c2}" fill-opacity=".35" stroke="${c1}" stroke-width="2"/>${centre || ''}</svg>`;
  }
  function meteor(c, gold) {
    const id = U(), n = 11, pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = 33 * (0.8 + Math.random() * 0.26); pts.push(`${f1(50 + Math.cos(a) * rr)} ${f1(40 + Math.sin(a) * rr)}`); }
    const cr = [[40, 32, 6.5], [60, 46, 5], [44, 54, 4], [62, 28, 3]];
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}r" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></radialGradient>
      <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gold ? '#fde68a' : '#fdba74'}" stop-opacity=".95"/><stop offset=".45" stop-color="${gold ? '#f59e0b' : '#f97316'}" stop-opacity=".6"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/></linearGradient></defs>
      <path class="sk-tail" d="M26 56 Q50 116 74 56 Q62 76 50 100 Q38 76 26 56Z" fill="url(#${id}t)"/><path d="M38 58 Q50 96 62 58" fill="#fff7cc" opacity=".55"/>
      <path d="M${pts.join(' L')}Z" fill="url(#${id}r)" stroke="${gold ? '#fde68a' : '#fb923c'}" stroke-opacity=".8" stroke-width="2.2"/>
      ${cr.map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}" fill="${c[2]}" opacity=".6"/><path d="M${x - s} ${y} a${s} ${s} 0 0 0 ${s * 2} 0" stroke="#fff" stroke-opacity=".35" fill="none"/>`).join('')}
      <path d="M28 26 Q36 14 50 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>${gold ? '<path d="M50 32 l2.4 6 6.4 .4 -5 4 1.7 6.3 -5.5 -3.6 -5.5 3.6 1.7 -6.3 -5 -4 6.4 -.4z" fill="#fff" opacity=".9"/>' : ''}</svg>`;
  }
  function orb(c1, c2, inner) {
    const id = U();
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${c1}" stop-opacity=".95"/><stop offset=".6" stop-color="${c2}" stop-opacity=".45"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient></defs>
      <circle cx="50" cy="50" r="49" fill="url(#${id})" class="sk-pulse"/><circle cx="50" cy="50" r="26" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/><path d="M34 40 Q42 30 54 30" stroke="#fff" stroke-opacity=".8" stroke-width="3" fill="none" stroke-linecap="round"/>${inner || ''}</svg>`;
  }
  function flower(cols, dbl, gold) {
    const id = U(), pet = `M0 0 C-14 -10 -17 -32 -7 -42 L0 -36 L7 -42 C17 -32 14 -10 0 0Z`;
    const layer = (rot, s, g) => [0, 72, 144, 216, 288].map(a => `<path transform="rotate(${a + rot}) scale(${s})" d="${pet}" fill="url(#${g})" stroke="${cols[2]}" stroke-opacity=".7" stroke-width="1.2"/>`).join('');
    return `<svg viewBox="-50 -50 100 100" aria-hidden="true" class="sk-spin"><defs><radialGradient id="${id}" cx="0" cy="0" r="46" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${cols[0]}"/><stop offset=".55" stop-color="${cols[1]}"/><stop offset="1" stop-color="${cols[2]}"/></radialGradient></defs>
      ${layer(0, 1, id)}${dbl ? layer(36, .7, id) : ''}<g stroke="${gold ? '#fff7cc' : '#be185d'}" stroke-width="1.2">${[0, 40, 80, 120, 160, 200, 240, 280, 320].map(a => `<path transform="rotate(${a})" d="M0 0 V-13"/>`).join('')}</g>
      ${[0, 40, 80, 120, 160, 200, 240, 280, 320].map(a => `<circle transform="rotate(${a})" cy="-14" r="2" fill="#fde047"/>`).join('')}<circle r="5" fill="${gold ? '#fff7cc' : '#fbbf24'}"/></svg>`;
  }
  function gum(c) {
    const id = U();
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".22" stop-color="${c[0]}"/><stop offset=".8" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></radialGradient></defs>
      <circle cx="50" cy="50" r="46" fill="url(#${id})"/><ellipse cx="36" cy="28" rx="13" ry="7" fill="#fff" opacity=".6" transform="rotate(-30 36 28)"/><circle cx="70" cy="72" r="4" fill="#fff" opacity=".35"/></svg>`;
  }
  function wrapped(c, gold) {
    const id = U();
    return `<svg viewBox="0 0 120 70" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".3" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
      <path d="M32 35 L4 12 L10 35 L4 58Z M88 35 L116 12 L110 35 L116 58Z" fill="${c[1]}" stroke="${c[0]}" stroke-width="1.5"/><path d="M14 20 L28 33 M14 50 L28 37 M106 20 L92 33 M106 50 L92 37" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/>
      <ellipse cx="60" cy="35" rx="32" ry="24" fill="url(#${id})"/><path d="M40 20 Q52 14 66 16" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>${gold ? '<path d="M60 26 l2.2 5 5.4 .4 -4.2 3.4 1.4 5.3 -4.8 -3 -4.8 3 1.4 -5.3 -4.2 -3.4 5.4 -.4z" fill="#fff"/>' : `<path d="M46 26 q6 9 0 18 M60 24 q6 11 0 22 M74 26 q6 9 0 18" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none"/>`}</svg>`;
  }
  function egg(c, extra) {
    const id = U();
    let sc = ''; for (let y = 22; y < 96; y += 9) for (let x = 14 + (y / 9 % 2) * 6; x < 90; x += 12) sc += `<path d="M${x - 6} ${y} q6 7 12 0" />`;
    return `<svg viewBox="0 0 100 110" aria-hidden="true"><defs><radialGradient id="${id}g" cx="36%" cy="30%" r="80%"><stop offset="0" stop-color="${c[0]}"/><stop offset=".5" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></radialGradient><clipPath id="${id}c"><path d="M50 4 C76 4 92 44 92 68 C92 92 74 106 50 106 C26 106 8 92 8 68 C8 44 24 4 50 4Z"/></clipPath></defs>
      <path d="M50 4 C76 4 92 44 92 68 C92 92 74 106 50 106 C26 106 8 92 8 68 C8 44 24 4 50 4Z" fill="url(#${id}g)" stroke="${c[3]}" stroke-width="2"/>
      <g clip-path="url(#${id}c)" fill="none" stroke="${c[3]}" stroke-opacity=".55" stroke-width="1.6">${sc}</g>${extra || ''}
      <ellipse cx="34" cy="32" rx="9" ry="15" fill="#fff" opacity=".45" transform="rotate(20 34 32)"/><circle cx="66" cy="80" r="3" fill="#fff" opacity=".3"/></svg>`;
  }
  const heartSVG = (grad, stroke, inner, cls) => { const id = U(); return `<svg viewBox="0 0 100 90" aria-hidden="true"${cls ? ` class="${cls}"` : ''}><defs>${grad(id)}</defs><path d="${HEART}" fill="url(#${id})" stroke="${stroke}" stroke-width="2.6" stroke-linejoin="round"/>${inner || ''}<path d="M22 18 C27 13 35 13 39 18" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="4" stroke-linecap="round"/></svg>`; };
  const rad = (stops) => id => `<radialGradient id="${id}" cx="35%" cy="30%" r="78%">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a == null ? 1 : a}"/>`).join('')}</radialGradient>`;
  const lin = (stops) => id => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a == null ? 1 : a}"/>`).join('')}</linearGradient>`;
  const leo = (map, extra) => typeof leoBubbleSVG === 'function' ? leoBubbleSVG(map, extra) : '';
  const MAP = {
    snow: { '#fff7e0': '#ffffff', '#fbbf24': '#bfe3ff', '#d97706': '#7aa7d9', '#92400e': '#4b6a93', '#fcd34d': '#e0f2ff', '#fde68a': '#f1f5f9', '#f59e0b': '#cbd5e1', '#b45309': '#64748b', '#3b2208': '#1e293b', '#d9f99d': '#e0f2fe', '#84cc16': '#38bdf8', '#3f6212': '#0c4a6e', '#fffbeb': '#ffffff' },
    aurora: { '#fff7e0': '#ecfdf5', '#fbbf24': '#34d399', '#d97706': '#0d9488', '#fcd34d': '#6ee7b7' },
    candy: { '#fff7e0': '#fff1f7', '#fbbf24': '#f9a8d4', '#d97706': '#ec4899', '#fcd34d': '#fbcfe8' },
    space: { '#fff7e0': '#e0e7ff', '#fbbf24': '#a5b4fc', '#d97706': '#6366f1', '#fcd34d': '#e2e8f0' },
    sakura: { '#fff7e0': '#fff1f7', '#fbbf24': '#fbcfe8', '#d97706': '#f472b6', '#fcd34d': '#fbcfe8' },
    dragon: { '#fff7e0': '#fff7ed', '#fbbf24': '#fb923c', '#d97706': '#c2410c', '#fcd34d': '#fdba74' }
  };
  const HELMET = `<circle cx="60" cy="60" r="56" fill="none" stroke="#e2e8f0" stroke-width="5"/><circle cx="60" cy="60" r="56" fill="none" stroke="#94a3b8" stroke-width="1.4"/><path d="M22 98 Q60 122 98 98 L94 110 Q60 128 26 110Z" fill="#cbd5e1" stroke="#64748b"/><path d="M96 26 L108 8" stroke="#94a3b8" stroke-width="2.4"/><circle class="kz-blink" cx="109" cy="7" r="4" fill="#f43f5e"/><path d="M30 26 Q44 12 62 10" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`;
  const CROWN = `<g transform="translate(60 20)"><path d="M-18 8 L-20 -10 L-10 -2 L0 -16 L10 -2 L20 -10 L18 8Z" fill="#fbbf24" stroke="#b45309" stroke-width="1.4" stroke-linejoin="round"/><rect x="-18" y="4" width="36" height="6" rx="2" fill="#f59e0b" stroke="#b45309"/><circle cy="-16" r="2.4" fill="#f43f5e"/><circle cx="-20" cy="-10" r="2" fill="#38bdf8"/><circle cx="20" cy="-10" r="2" fill="#38bdf8"/><circle cy="7" r="2" fill="#a855f7"/></g>`;
  const FCROWN = [[28, 34], [36, 24], [47, 18], [60, 16], [73, 18], [84, 24], [92, 34]].map(([x, y], i) => blossom(x, y, 1.1, ['#fbcfe8', '#f9a8d4', '#fff1f7'][i % 3], i * 20)).join('');
  const SPRINK = (() => { let s = ''; const r = rng(5), C = ['#fde047', '#38bdf8', '#4ade80', '#f472b6', '#fff', '#fb923c']; for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = 46 + r() * 8, x = 60 + Math.cos(a) * d, y = 60 + Math.sin(a) * d; s += `<rect x="${f1(x)}" y="${f1(y)}" width="7" height="2.6" rx="1.3" fill="${C[i % C.length]}" transform="rotate(${f1(r() * 180)} ${f1(x)} ${f1(y)})"/>`; } return s + `<g transform="translate(90 26) rotate(20)"><path d="M0 0 L-10 -7 L-10 7Z M0 0 L10 -7 L10 7Z" fill="#f472b6" stroke="#be185d"/><circle r="3" fill="#ec4899"/></g>`; })();

  const SKIN = {
    vinter: {
      lab: { gold: 'Guldkristall', pink: 'Rosa iskristall', heart: 'Ishjärta', leo: 'Snöleopard' },
      bub(k) {
        if (k === 'gold') return flake('#fef3c7', '#f59e0b', '<path d="M0 -8 l2.3 5.3 5.7 .5 -4.3 3.8 1.3 5.6 -5 -3 -5 3 1.3 -5.6 -4.3 -3.8 5.7 -.5z" fill="#fff7cc"/>');
        if (k === 'pink') return flake('#fce7f3', '#ec4899', '<path d="M0 6 C-1 5 -7 1 -7 -3 a3.5 3.5 0 0 1 7 -1 a3.5 3.5 0 0 1 7 1 c0 4 -6 8 -7 9z" fill="#fff"/>');
        if (k === 'heart') return heartSVG(rad([[0, '#ffffff', .85], [.35, '#bae6fd', .45], [.85, '#38bdf8', .28], [1, '#0ea5e9', .45]]), '#e0f2fe',
          `<g stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round" fill="none" transform="translate(50 42)">${[0, 60, 120].map(a => `<path transform="rotate(${a})" d="M0 -16 V16 M0 -9 l-5 -4 M0 -9 l5 -4 M0 9 l-5 4 M0 9 l5 4"/>`).join('')}</g>`);
        if (k === 'leo') return leo(MAP.snow, '<g fill="#fff" opacity=".85"><circle cx="20" cy="40" r="2"/><circle cx="100" cy="74" r="2.4"/><circle cx="96" cy="44" r="1.4"/></g>');
        return flake('#f0f9ff', '#7dd3fc');
      }, drop: 'snow'
    },
    kosmos: {
      lab: { gold: 'Guldasteroid', pink: 'Minplanet', heart: 'Nebulosahjärta', leo: 'Rymdleopard' },
      bub(k) {
        if (k === 'gold') return meteor(['#fef3c7', '#f59e0b', '#78350f'], 1);
        if (k === 'pink') { const id = U(); return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#fdf2f8"/><stop offset=".4" stop-color="#f472b6"/><stop offset="1" stop-color="#831843"/></radialGradient></defs>
          <path d="M8 58 A44 12 -18 0 1 92 40" fill="none" stroke="#fcd34d" stroke-opacity=".6" stroke-width="5"/><circle cx="50" cy="50" r="27" fill="url(#${id})"/><path d="M26 44 Q50 38 74 46 M25 56 Q50 52 75 58" stroke="#fff" stroke-opacity=".3" stroke-width="4" fill="none"/>
          <path d="M8 58 A44 12 -18 0 0 92 40" fill="none" stroke="#fde68a" stroke-width="5"/><circle cx="84" cy="22" r="5" fill="#e2e8f0"/><path d="M36 36 Q42 30 50 29" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/></svg>`; }
        if (k === 'heart') return heartSVG(rad([[0, '#fdf4ff', .9], [.35, '#f0abfc', .6], [.8, '#a855f7', .5], [1, '#4c1d95', .7]]), '#f5d0fe',
          [[34, 36, 1.6], [62, 30, 1.2], [50, 52, 2], [70, 46, 1], [40, 60, 1.2], [58, 66, 1]].map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}" fill="#fff"/>`).join(''));
        if (k === 'leo') return leo(MAP.space, HELMET);
        return meteor(pick([['#d6d3d1', '#78716c', '#292524'], ['#e7e5e4', '#a8a29e', '#44403c'], ['#c4b5fd', '#6d28d9', '#1e1b4b'], ['#fecaca', '#b45309', '#3b0764']]));
      }, drop: 'spark'
    },
    norrsken: {
      lab: { gold: 'Stjärnljus', pink: 'Renljus', heart: 'Norrskenshjärta', leo: 'Norrskensleopard' },
      bub(k) {
        if (k === 'gold') return orb('#fde68a', '#f59e0b', '<path d="M50 30 L54 46 L70 50 L54 54 L50 70 L46 54 L30 50 L46 46Z" fill="#fff"/>');
        if (k === 'pink') return orb('#f9a8d4', '#a855f7', '<text x="50" y="60" text-anchor="middle" font-size="30">🦌</text>');
        if (k === 'heart') return heartSVG(lin([[0, '#a7f3d0', .75], [.45, '#34d399', .45], [.8, '#8b5cf6', .45], [1, '#ec4899', .55]]), '#a7f3d0',
          `<g stroke="#fff" stroke-opacity=".28" stroke-width="2">${[24, 34, 44, 54, 64, 74].map(x => `<path d="M${x} 14 V70"/>`).join('')}</g>`);
        if (k === 'leo') return leo(MAP.aurora, '');
        const c = pick([['#6ee7b7', '#10b981'], ['#67e8f9', '#0891b2'], ['#c4b5fd', '#7c3aed'], ['#a7f3d0', '#14b8a6']]);
        return orb(c[0], c[1]);
      }, drop: 'aurora'
    },
    sakura: {
      lab: { gold: 'Guldblomma', pink: 'Dubbelblomma', heart: 'Blomsterhjärta', leo: 'Blomsterleopard' },
      bub(k) {
        if (k === 'gold') return flower(['#fffbeb', '#fde68a', '#d97706'], 0, 1);
        if (k === 'pink') return flower(['#fdf2f8', '#ec4899', '#9d174d'], 1);
        if (k === 'heart') return heartSVG(rad([[0, '#fff1f7', .9], [.4, '#f9a8d4', .6], [.85, '#ec4899', .5], [1, '#be185d', .6]]), '#fbcfe8',
          [[36, 34], [62, 30], [50, 52], [70, 46], [40, 60]].map(([x, y], i) => blossom(x, y, .9, ['#fff', '#fce7f3'][i % 2], i * 30)).join(''));
        if (k === 'leo') return leo(MAP.sakura, FCROWN);
        return flower(pick([['#fff1f7', '#fbcfe8', '#f472b6'], ['#ffffff', '#fce7f3', '#f9a8d4'], ['#fdf2f8', '#f9a8d4', '#db2777']]), Math.random() < .25);
      }, drop: 'petal'
    },
    godis: {
      lab: { gold: 'Guldkola', pink: 'Klubba', heart: 'Godishjärta', leo: 'Godisleopard' },
      bub(k) {
        if (k === 'gold') return wrapped(['#fde68a', '#d97706'], 1);
        if (k === 'pink') return `<svg viewBox="0 0 100 130" aria-hidden="true"><path d="M50 84 V128" stroke="#fef3c7" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="46" r="40" fill="#f472b6" stroke="#be185d" stroke-width="2"/>
          <path d="M50 46 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 0 1 8 -8 a12 12 0 0 1 12 12 a16 16 0 0 1 -16 16 a20 20 0 0 1 -20 -20 a24 24 0 0 1 24 -24 a28 28 0 0 1 28 28 a32 32 0 0 1 -32 32" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><ellipse cx="34" cy="26" rx="10" ry="6" fill="#fff" opacity=".5" transform="rotate(-30 34 26)"/>
          <path d="M42 84 h16 l-3 8 h-10z" fill="#a855f7"/></svg>`;
        if (k === 'heart') return heartSVG(rad([[0, '#fff1f7'], [.6, '#fbcfe8'], [1, '#f9a8d4']]), '#f472b6',
          `<text x="50" y="52" text-anchor="middle" font-size="20" font-weight="700" fill="#db2777" font-family="Fredoka,system-ui" letter-spacing="1">PUSS</text>`);
        if (k === 'leo') return leo(MAP.candy, SPRINK);
        const C = pick([['#fda4af', '#e11d48', '#881337'], ['#93c5fd', '#2563eb', '#1e3a8a'], ['#86efac', '#16a34a', '#14532d'], ['#fde68a', '#f59e0b', '#92400e'], ['#d8b4fe', '#9333ea', '#4c1d95'], ['#fdba74', '#ea580c', '#7c2d12']]);
        return Math.random() < .35 ? wrapped([C[0], C[1]]) : gum(C);
      }, drop: 'sprinkle'
    },
    drakar: {
      lab: { gold: 'Guldägg', pink: 'Kristallägg', heart: 'Eldhjärta', leo: 'Drottningleopard' },
      bub(k) {
        if (k === 'gold') return egg(['#fffbeb', '#fbbf24', '#b45309', '#fde68a'], '<g fill="#f43f5e"><circle cx="50" cy="50" r="3"/><circle cx="34" cy="72" r="2.4"/><circle cx="68" cy="70" r="2.4"/></g>');
        if (k === 'pink') return `<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M50 4 L82 36 L90 70 L70 102 L30 102 L10 70 L18 36Z" fill="#f9a8d4" fill-opacity=".75" stroke="#fce7f3" stroke-width="2"/>
          <path d="M50 4 L50 50 L18 36 M50 50 L82 36 M50 50 L10 70 M50 50 L90 70 M50 50 L30 102 M50 50 L70 102" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none"/><path d="M50 4 L18 36 L50 50Z" fill="#fff" opacity=".35"/><path d="M50 50 L90 70 L70 102Z" fill="#be185d" opacity=".3"/></svg>`;
        if (k === 'heart') return heartSVG(id => `<linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#dc2626" stop-opacity=".85"/><stop offset=".55" stop-color="#f97316" stop-opacity=".7"/><stop offset="1" stop-color="#fde047" stop-opacity=".75"/></linearGradient>`, '#fdba74',
          `<g class="sk-flick"><path d="M30 18 C26 6 34 2 34 -6 C40 4 42 10 38 18Z M66 16 C64 4 72 0 70 -8 C78 2 78 10 74 16Z M50 22 C46 10 52 4 50 -4 C58 6 58 14 56 22Z" fill="#fb923c"/><path d="M33 16 C31 10 35 6 35 2 C38 8 38 12 36 16Z M69 14 C68 8 71 5 71 1 C74 6 74 10 72 14Z" fill="#fde047"/></g>`, 'sk-ovf');
        if (k === 'leo') return leo(MAP.dragon, CROWN);
        return egg(pick([['#99f6e4', '#14b8a6', '#134e4a', '#ccfbf1'], ['#e9d5ff', '#a855f7', '#3b0764', '#f3e8ff'], ['#fecaca', '#ef4444', '#7f1d1d', '#fee2e2'], ['#bbf7d0', '#22c55e', '#14532d', '#dcfce7'], ['#bfdbfe', '#3b82f6', '#1e3a8a', '#dbeafe']]));
      }, drop: 'ember'
    }
  };


  /* ================= säsongsvärldar: jul och nyår ================= */
  // tillgängliga gratis under sin tid på året; byts in automatiskt en gång per säsong
  Object.assign(W, {
    jul:  { name: 'Julnatt', ic: '🎄', season: { from: [11, 15], to: [1, 6], auto: [[11, 15], [12, 26]] }, desc: 'Tomtens släde över ett snöigt land med tända fönster. Bubblorna blir julgranskulor.',
            bg: ['#040b1e', '#0b1d3f', '#22406f'], glow: ['rgba(255,200,120,.22)', 'rgba(120,170,255,.3)'], acc: '#fca5a5', acc2: '#fde68a', txt: '#fff8f0', dim: '#c9d2e6', glass: 'rgba(255,230,200,.09)', line: 'rgba(255,220,180,.24)', scene: 1 },
    nyar: { name: 'Nyårsnatt', ic: '🎆', season: { from: [12, 20], to: [1, 10], auto: [[12, 27], [1, 6]] }, desc: 'Fyrverkerier över en stad vid vattnet. Bubblorna blir champagnebubblor.',
            bg: ['#03030d', '#0d0b2a', '#22144c'], glow: ['rgba(250,204,21,.22)', 'rgba(236,72,153,.28)'], acc: '#fde047', acc2: '#f0abfc', txt: '#fffbeb', dim: '#cbbfe0', glass: 'rgba(253,224,71,.08)', line: 'rgba(253,224,71,.24)', scene: 1 }
  });
  const NOW = () => (typeof window !== 'undefined' && window.__NOW) ? new Date(window.__NOW) : new Date();
  const md = d => (d.getMonth() + 1) * 100 + d.getDate();
  const inWin = (d, a, b) => { const x = md(d), A = a[0] * 100 + a[1], B = b[0] * 100 + b[1]; return A <= B ? x >= A && x <= B : x >= A || x <= B; };
  const avail = k => !!W[k] && !!W[k].season && inWin(NOW(), W[k].season.from, W[k].season.to);
  const autoNow = () => ['nyar', 'jul'].find(k => inWin(NOW(), W[k].season.auto[0], W[k].season.auto[1])) || null;
  const sYear = d => d.getMonth() < 6 ? d.getFullYear() - 1 : d.getFullYear();
  const MON = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const seasonLabel = k => { const s = W[k].season; return avail(k) ? `Säsong · till ${s.to[1]} ${MON[s.to[0] - 1]}` : `Kommer ${s.from[1]} ${MON[s.from[0] - 1]}`; };
  function seasonCheck() {
    let st; try { st = STYLE.get(); } catch (e) { return; }
    const want = autoNow(), tag = want ? want + '-' + sYear(NOW()) : '';
    if (want && lsGet('ry_season_done') !== tag) {
      lsSet('ry_season_done', tag); if (!(W[st.world] && W[st.world].season)) lsSet('ry_season_prev', st.world);
      if (st.world !== want) { STYLE.set('world', want); try { if (typeof render === 'function' && typeof view !== 'undefined' && view === 'lobby') render(); } catch (e) {}
        setTimeout(() => { try { toast(`${W[want].ic} ${W[want].name} är här! Du kan byta värld i Inställningar → Utseende.`, 5000); } catch (e) {} }, 1800); }
      return;
    }
    if (W[st.world] && W[st.world].season && !avail(st.world)) { const pv = lsGet('ry_season_prev'); STYLE.set('world', pv && !(W[pv] && (W[pv].season || (W[pv].price && !owned(pv)))) ? pv : 'rymd'); }
  }

  /* ---------- Julnatt ---------- */
  const SLEIGH = `<svg viewBox="0 0 330 110" aria-hidden="true"><defs>
    <linearGradient id="jsl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient>
    <radialGradient id="jsk" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#d6a76a"/><stop offset="1" stop-color="#7c4a1e"/></radialGradient></defs>
    ${[[250, 52], [292, 40], [210, 62]].map(([x, y], i) => `<g class="jl-deer" style="animation-delay:-${i * .17}s" transform="translate(${x} ${y})"><path d="M-16 -2 C-16 -10 10 -12 14 -4 L16 2 C8 6 -10 6 -16 2Z" fill="#7c4a2a"/><path d="M10 -6 L18 -18 L25 -17 L22 -10 L14 -2Z" fill="#7c4a2a"/><ellipse cx="23" cy="-16" rx="4.5" ry="2.8" fill="#7c4a2a"/><circle cx="27" cy="-16" r="1.4" fill="#3b1d0e"/>
      <path d="M19 -20 C16 -27 18 -31 14 -34 M17 -26 L12 -27 M22 -20 C24 -27 29 -30 28 -35 M26 -26 L31 -28" stroke="#e7d3b0" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M-16 0 l-4 1" stroke="#7c4a2a" stroke-width="2.4" stroke-linecap="round"/>
      <g stroke="#7c4a2a" stroke-width="2.2" stroke-linecap="round"><path class="jl-leg1" d="M-11 3 L-17 11 M9 3 L4 11"/><path class="jl-leg2" d="M-6 3 L-2 12 M13 2 L19 9"/></g>
      <path d="M-8 -6 C0 -2 6 -3 12 -7" stroke="#b91c1c" stroke-width="2.6" fill="none"/><circle cx="2" cy="-3.6" r="1.6" fill="#fde047"/><circle cx="7" cy="-4.4" r="1.6" fill="#fde047"/></g>`).join('')}
    <path d="M150 64 C180 58 200 56 232 50 M150 64 C190 64 220 60 270 42" stroke="#fde68a" stroke-width="1.2" fill="none" opacity=".85"/>
    <g transform="translate(0 4)">
      <path d="M58 40 C50 18 74 6 92 18 L96 30Z" fill="url(#jsk)"/><path d="M60 30 C66 26 78 26 86 30" stroke="#5b3413" stroke-width="2" fill="none"/>
      <rect x="62" y="6" width="14" height="14" rx="2" fill="#22c55e" transform="rotate(-14 69 13)"/><path d="M69 5 v16 M61 13 h16" stroke="#fde047" stroke-width="2" transform="rotate(-14 69 13)"/>
      <rect x="78" y="2" width="12" height="16" rx="2" fill="#3b82f6" transform="rotate(10 84 10)"/><path d="M84 2 v16 M78 10 h12" stroke="#f9a8d4" stroke-width="2" transform="rotate(10 84 10)"/>
      <rect x="70" y="-4" width="10" height="10" rx="2" fill="#f472b6" transform="rotate(-4 75 1)"/><path d="M75 -4 v10 M70 1 h10" stroke="#fff" stroke-width="1.6"/>
      <circle cx="122" cy="22" r="10" fill="#ef4444"/><path d="M112 18 C112 6 126 2 134 10 L140 4 L138 14 C136 18 130 16 126 16Z" fill="#ef4444"/><circle cx="140" cy="4" r="3.6" fill="#fff"/><path d="M110 18 C116 15 128 15 134 18" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <circle cx="126" cy="24" r="6" fill="#fcd9b6"/><path d="M118 26 C118 38 132 40 134 28 C130 31 122 31 118 26Z" fill="#fff"/><circle cx="128" cy="22.5" r="1" fill="#1e293b"/><circle cx="131" cy="25.5" r="1.8" fill="#fca5a5"/>
      <path class="jl-wave" d="M134 32 C142 28 146 20 150 14" stroke="#ef4444" stroke-width="5.5" stroke-linecap="round" fill="none"/><circle class="jl-wave" cx="150" cy="13" r="3" fill="#fff"/>
      <path d="M44 34 L150 34 C156 34 158 40 156 46 L150 62 L58 62 C46 62 40 50 44 34Z" fill="url(#jsl)" stroke="#fbbf24" stroke-width="2"/><path d="M54 40 C70 46 120 46 146 40" stroke="#fbbf24" stroke-width="1.6" fill="none"/><path d="M60 54 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0 q6 -6 12 0" stroke="#fde68a" stroke-width="1.4" fill="none" opacity=".8"/>
      <path d="M38 72 L160 72 C170 72 174 64 168 58" stroke="#fbbf24" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M62 62 V72 M138 62 V72" stroke="#fbbf24" stroke-width="2.6"/><path d="M38 72 C30 72 28 64 34 62" stroke="#fbbf24" stroke-width="3.2" fill="none" stroke-linecap="round"/></g></svg>`;
  BUILD.jul = (p, o, R) => {
    const r = rng(101);
    let L = `<defs><linearGradient id="${p}hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd0ee"/><stop offset=".5" stop-color="#7f9cc9"/><stop offset="1" stop-color="#40598a"/></linearGradient>
      <linearGradient id="${p}fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3ecfb"/><stop offset=".6" stop-color="#a8bde0"/><stop offset="1" stop-color="#6f88b8"/></linearGradient>
      <radialGradient id="${p}win"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".85"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
      <radialGradient id="${p}st"><stop offset="0" stop-color="#fff7cc"/><stop offset=".4" stop-color="#fde047" stop-opacity=".7"/><stop offset="1" stop-color="#fde047" stop-opacity="0"/></radialGradient></defs>`;
    L += range([[0, 190], [120, 140], [260, 186], [420, 120], [560, 182], [720, 132], [860, 186], [1000, 128], [1200, 176]], 400, '#2a4372', 'rgba(10,20,50,.25)', '#c9d8f0', .4, r);
    for (let x = -10; x < 1210; x += 11 + r() * 9) { const h = 22 + r() * 22; L += fir(x, 232 + Math.sin(x / 70) * 8, h, '#10233d', '#b9cbe8'); }
    L += `<path d="M0 238 C180 226 360 244 600 236 S1000 226 1200 240 V400 H0Z" fill="url(#${p}hb)"/>`;
    const lit = (x, y, w, h) => `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w * 1.6}" fill="url(#${p}win)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffd27a" stroke="#fff" stroke-width="1.2"/><path d="M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}" stroke="#fff" stroke-width=".9"/>`;
    const house = (x, y, s, col, lights) => { let h = `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-26" y="-26" width="52" height="28" fill="${col}"/><rect x="-26" y="-26" width="3" height="28" fill="#f8fafc"/><rect x="23" y="-26" width="3" height="28" fill="#f8fafc"/>
      <path d="M-32 -24 L0 -48 L32 -24Z" fill="#334155"/><path d="M-34 -23 L0 -50 L34 -23 L29 -21 L0 -43 L-29 -21Z" fill="#eef4ff"/><rect x="12" y="-52" width="6" height="14" fill="#475569"/><rect x="11" y="-54" width="8" height="3" fill="#eef4ff"/>
      ${lit(-18, -18, 10, 10)}${lit(8, -18, 10, 10)}<rect x="-4" y="-14" width="8" height="16" fill="#3b1d1d"/><path d="M-30 2 Q0 -2 30 2" stroke="#eef4ff" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      if (lights) { const C = ['#ef4444', '#fde047', '#22c55e', '#60a5fa', '#f472b6']; for (let i = 0; i <= 10; i++) { const t = i / 10, px = -30 + 60 * t, py = -23 - (1 - Math.abs(t - .5) * 2) * 25 + 2; h += `<circle class="jl-b jl-b${i % 2}" cx="${f1(px)}" cy="${f1(py)}" r="1.9" fill="${C[i % 5]}"/>`; } }
      return h + '</g>'; };
    L += house(440, 268, 1, '#8b2323', 1) + house(520, 258, .78, '#b45309', 0) + house(820, 266, .95, '#8b2323', 1) + house(1000, 262, .8, '#e2d6b8', 0) + house(250, 262, .85, '#b45309', 1) + house(130, 270, .7, '#8b2323', 0);
    // kyrkan
    L += `<g transform="translate(626 262)"><rect x="-26" y="-34" width="52" height="36" fill="#eef1f6"/><path d="M-32 -32 L0 -56 L32 -32Z" fill="#334155"/><path d="M-34 -31 L0 -58 L34 -31 L29 -29 L0 -51 L-29 -29Z" fill="#eef4ff"/>
      <rect x="-12" y="-76" width="24" height="44" fill="#eef1f6"/><path d="M-15 -74 L0 -110 L15 -74Z" fill="#334155"/><path d="M0 -110 V-122 M-5 -117 H5" stroke="#fde68a" stroke-width="2"/>
      <circle cy="-62" r="10" fill="url(#${p}win)"/><path d="M-5 -56 V-66 a5 5 0 0 1 10 0 V-56Z" fill="#ffd27a"/>${[-17, -3, 11].map(x => `<path d="M${x} -6 V-20 a3 3 0 0 1 6 0 V-6Z" fill="#ffd27a"/><circle cx="${x + 3}" cy="-13" r="8" fill="url(#${p}win)"/>`).join('')}<rect x="-4" y="-10" width="8" height="12" fill="#5b3a29"/></g>`;
    // julgranen på torget med ljusslinga och stjärna
    L += `<g transform="translate(724 300)"><circle cy="-64" r="40" fill="url(#${p}win)" opacity=".55"/>${fir(0, 4, 92, '#0f3d2a', '#e8f0fb')}`;
    const C = ['#ef4444', '#fde047', '#60a5fa', '#f472b6', '#fff7cc'];
    for (let i = 0; i < 34; i++) { const t = i / 34, y = -82 + t * 80, w = 4 + t * 32, x = Math.sin(t * 19) * w; L += `<circle class="jl-b jl-b${i % 3}" cx="${f1(x)}" cy="${f1(y)}" r="2.1" fill="${C[i % 5]}"/>`; }
    L += `<circle cy="-92" r="16" fill="url(#${p}st)" class="jl-star"/><path d="M0 -102 l3 7 7.4 .6 -5.6 4.8 1.8 7.2 -6.6 -4 -6.6 4 1.8 -7.2 -5.6 -4.8 7.4 -.6z" fill="#fde047" stroke="#fff7cc" stroke-width=".8"/></g>`;
    // ljusslinga mellan stolparna
    const sx = [330, 380, 560, 590], C2 = ['#ef4444', '#fde047', '#22c55e', '#60a5fa', '#f472b6'];
    [[330, 382], [560, 596]].forEach(([a, b], k) => { L += `<path d="M${a} 284 V250 M${b} 284 V250" stroke="#1e293b" stroke-width="2.4"/>`; for (let i = 0; i <= 9; i++) { const t = i / 9, x = a + (b - a) * t, y = 250 + Math.sin(Math.PI * t) * 9; L += `<circle class="jl-b jl-b${(i + k) % 2}" cx="${f1(x)}" cy="${f1(y)}" r="2" fill="${C2[i % 5]}"/>`; } });
    // lyktstolpe och upplysta granar
    L += `<g transform="translate(900 300)"><circle cy="-52" r="22" fill="url(#${p}win)"/><path d="M0 0 V-48" stroke="#1e293b" stroke-width="3"/><path d="M-6 -48 h12 l-2 -10 h-8z" fill="#ffd27a" stroke="#1e293b" stroke-width="1.5"/><path d="M-8 -58 h16 l-8 -6z" fill="#1e293b"/></g>`;
    [[360, 300, 46], [1080, 300, 50], [180, 296, 40]].forEach(([x, y, h]) => { L += fir(x, y, h, '#123a2b', '#e3ecfb'); for (let i = 0; i < 12; i++) { const t = i / 12; L += `<circle class="jl-b jl-b${i % 2}" cx="${f1(x + Math.sin(t * 14) * (2 + t * h * .3))}" cy="${f1(y - h * .9 + t * h * .82)}" r="1.5" fill="#fff3c4"/>`; } });
    if (!o.still) for (const [cx, cy] of [[452, 210], [530, 216], [832, 209], [262, 214]]) for (let i = 0; i < 3; i++) L += `<circle class="mv vt-smoke" style="animation-delay:-${i * 2.1}s" cx="${cx}" cy="${cy}" r="4" fill="#c7d3e8"/>`;
    L += `<path d="M0 330 C200 316 420 340 640 332 S1000 316 1200 334 V400 H0Z" fill="url(#${p}fg)"/><path d="M500 400 C560 360 640 346 700 334" stroke="#91a8d2" stroke-width="10" fill="none" opacity=".45"/>`;
    [[40, 392, 70], [100, 398, 56], [1120, 396, 74], [1170, 400, 60], [980, 392, 40]].forEach(([x, y, h]) => L += fir(x, y, h, '#0f2a24', '#f1f5fb'));
    let h = div('scn-moon jl-moon', '') + stars(o.few ? 40 : 80, 50, R) + land(p, L, 46);
    if (!o.still) {
      h += div('mv jl-sleigh', '', `<div class="jl-bob">${SLEIGH}</div><div class="jl-trail">${[...Array(10)].map((_, i) => `<i style="left:${-i * 15}px;top:${f1(Math.sin(i * .9) * 5 + i * 1.5)}px;animation-delay:-${(i * .13).toFixed(2)}s;opacity:${(1 - i / 11).toFixed(2)}"></i>`).join('')}</div>`);
      h += parts('vt-snow', o.few ? 34 : 70, R, (i, R) => { const s = 2 + R() * (R() < .2 ? 5 : 3); return `<i style="left:${f1(R() * 100)}%;width:${f1(s)}px;height:${f1(s)}px;opacity:${(.5 + R() * .5).toFixed(2)};--sx:${f1(R() * 60 - 30)}px;animation-duration:${f1(9 + R() * 10)}s;animation-delay:-${f1(R() * 20)}s"></i>`; });
    } else h += div('jl-sleigh jl-still', '', SLEIGH);
    return h;
  };

  /* ---------- Nyårsnatt ---------- */
  BUILD.nyar = (p, o, R) => {
    const r = rng(131);
    let L = `<defs><linearGradient id="${p}wt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1440"/><stop offset="1" stop-color="#05040f"/></linearGradient>
      <linearGradient id="${p}bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#211b45"/><stop offset="1" stop-color="#110d26"/></linearGradient>
      <radialGradient id="${p}cl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fffbeb"/><stop offset=".85" stop-color="#fde68a"/><stop offset="1" stop-color="#b45309"/></radialGradient></defs>`;
    // stadssiluett med tända fönster
    let x = 0; while (x < 1200) { const w = 30 + r() * 50, h = 50 + r() * (Math.abs(x - 600) < 200 ? 60 : 110), y = 300 - h;
      if (!(x > 560 && x < 650)) { L += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="url(#${p}bd)"/>`;
        for (let wy = y + 8; wy < 292; wy += 11) for (let wx = x + 5; wx < x + w - 6; wx += 9) if (r() < .32) L += `<rect x="${f1(wx)}" y="${f1(wy)}" width="4" height="5" fill="${r() < .75 ? '#ffd27a' : '#dbeafe'}" opacity="${(.5 + r() * .5).toFixed(2)}"/>`;
        if (r() < .25) L += `<path d="M${f1(x + w / 2)} ${f1(y)} v-14" stroke="#211b45" stroke-width="2"/><circle class="kz-blink" cx="${f1(x + w / 2)}" cy="${f1(y - 14)}" r="1.8" fill="#ef4444"/>`; }
      x += w + 2; }
    // klocktornet: visarna står på tolv
    L += `<g transform="translate(605 300)"><rect x="-22" y="-150" width="44" height="150" fill="url(#${p}bd)"/><path d="M-26 -150 L0 -196 L26 -150Z" fill="#1a1538"/><path d="M0 -196 v-12" stroke="#fde68a" stroke-width="2"/>
      <circle cy="-122" r="24" fill="#fde68a" opacity=".25"/><circle cy="-122" r="17" fill="url(#${p}cl)" stroke="#78350f" stroke-width="1.6"/>${[...Array(12)].map((_, i) => `<path transform="rotate(${i * 30} 0 -122)" d="M0 -137 v3" stroke="#78350f" stroke-width="1.4"/>`).join('')}
      <path d="M0 -122 V-136" stroke="#1e1b4b" stroke-width="2.4" stroke-linecap="round"/><path d="M0 -122 V-132" stroke="#1e1b4b" stroke-width="3.4" stroke-linecap="round"/><circle cy="-122" r="1.8" fill="#1e1b4b"/>
      ${[-70, -40, -10].map(y => `<rect x="-6" y="${y - 12}" width="12" height="16" rx="6" fill="#ffd27a" opacity=".85"/>`).join('')}</g>`;
    // pariserhjul med lampor som snurrar
    const wh = `<g class="ny-wheel">${[...Array(16)].map((_, i) => { const a = i / 16 * Math.PI * 2; return `<path d="M0 0 L${f1(Math.cos(a) * 52)} ${f1(Math.sin(a) * 52)}" stroke="#c4b5fd" stroke-width=".8" opacity=".6"/><circle class="jl-b jl-b${i % 2}" cx="${f1(Math.cos(a) * 52)}" cy="${f1(Math.sin(a) * 52)}" r="3" fill="${['#fde047', '#f472b6', '#67e8f9', '#a3e635'][i % 4]}"/>`; }).join('')}<circle r="52" fill="none" stroke="#c4b5fd" stroke-width="1.6" opacity=".7"/><circle r="5" fill="#c4b5fd"/></g>`;
    L += `<g transform="translate(790 230)">${wh}<path d="M0 0 L-24 70 M0 0 L24 70" stroke="#c4b5fd" stroke-width="2.4" opacity=".8"/></g>`;
    // vattnet med speglingar
    L += `<rect x="0" y="300" width="1200" height="100" fill="url(#${p}wt)"/><path d="M0 300 H1200" stroke="#fde68a" stroke-opacity=".25"/>`;
    for (let i = 0; i < 70; i++) { const xx = r() * 1200, w = 6 + r() * 24; L += `<rect class="ny-ref ny-ref${i % 3}" x="${f1(xx)}" y="${f1(304 + r() * 90)}" width="${f1(w)}" height="1.6" rx=".8" fill="${pick(['#ffd27a', '#fde68a', '#f9a8d4', '#a5f3fc'], r)}" opacity="${(.25 + r() * .5).toFixed(2)}"/>`; }
    let h = stars(o.few ? 30 : 60, 45, R);
    // fyrverkerier: raketer som stiger och slår ut i gnistregn, i otakt
    const FW = [['#fde047', '#fb923c'], ['#f472b6', '#c084fc'], ['#67e8f9', '#a5f3fc'], ['#a3e635', '#fde047'], ['#f87171', '#fde68a'], ['#c084fc', '#f0abfc'], ['#ffffff', '#fde68a']];
    const nfw = o.still ? 3 : o.few ? 5 : 7;
    for (let i = 0; i < nfw; i++) { const c = FW[i % FW.length], n = 34 + Math.floor(R() * 14), rad = 55 + R() * 55, d = 4.6 + R() * 3.2, x0 = 8 + R() * 84, y0 = 8 + R() * 30;
      let b = ''; for (let k = 0; k < n; k++) { const col = k % 3 ? c[0] : c[1], rr = rad * (k % 4 === 0 ? R(.35, .6) : R(.78, 1.08)); b += `<i style="transform:rotate(${f1(k / n * 360 + R() * 8)}deg)"><b style="--r:${f1(rr)}px;width:${f1(8 + R() * 10)}px;background:linear-gradient(90deg,rgba(255,255,255,0),${col} 60%,#fff);box-shadow:0 0 6px ${col}"></b></i>`; }
      h += `<div class="ny-fw ${o.still ? 'still' : ''}" style="left:${f1(x0)}%;top:${f1(y0)}%;--d:${f1(d)}s;--dl:-${f1(R() * d)}s;--c:${c[0]}"><span class="ny-tr"></span><span class="ny-fl"></span><div class="ny-bu">${b}</div></div>`; }
    h += land(p, L, 40);
    if (!o.still) h += parts('ny-gl', o.few ? 14 : 30, R, (i, R) => `<i style="left:${f1(R() * 100)}%;--sx:${f1(R() * 40 - 20)}px;animation-duration:${f1(10 + R() * 10)}s;animation-delay:-${f1(R() * 20)}s"></i>`);
    return h;
  };

  /* ---------- bubblorna ---------- */
  function bauble(c, pat) {
    const id = U();
    const deco = pat === 0 ? `<path d="M10 56 Q50 66 90 56" stroke="${c[3]}" stroke-width="7" fill="none"/>${[22, 36, 50, 64, 78].map(x => `<circle cx="${x}" cy="${f1(59 + Math.sin((x - 10) / 80 * Math.PI) * 3)}" r="2.2" fill="#fff"/>`).join('')}`
      : pat === 1 ? `<g stroke="#fff" stroke-opacity=".8" stroke-width="1.8" stroke-linecap="round" transform="translate(50 58)">${[0, 60, 120].map(a => `<path transform="rotate(${a})" d="M0 -13 V13 M0 -8 l-4 -3 M0 -8 l4 -3 M0 8 l-4 3 M0 8 l4 3"/>`).join('')}</g>`
      : `${[...Array(16)].map((_, i) => `<circle cx="${f1(22 + (i * 37) % 58)}" cy="${f1(36 + (i * 23) % 44)}" r="${(1 + (i % 3) * .6).toFixed(1)}" fill="#fff" opacity=".7"/>`).join('')}`;
    return `<svg viewBox="0 0 100 112" aria-hidden="true"><defs><radialGradient id="${id}" cx="36%" cy="34%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".2" stop-color="${c[0]}"/><stop offset=".75" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></radialGradient>
      <clipPath id="${id}c"><circle cx="50" cy="60" r="40"/></clipPath></defs>
      <path d="M50 2 a5 5 0 1 1 0.01 0" fill="none" stroke="#cbd5e1" stroke-width="2"/><rect x="40" y="10" width="20" height="12" rx="3" fill="#e5c770" stroke="#a16207"/><path d="M43 12 v8 M47 12 v8 M51 12 v8 M55 12 v8" stroke="#a16207" stroke-width=".8"/>
      <circle cx="50" cy="60" r="40" fill="url(#${id})"/><g clip-path="url(#${id}c)">${deco}</g>
      <ellipse cx="36" cy="44" rx="10" ry="6" fill="#fff" opacity=".55" transform="rotate(-35 36 44)"/><circle cx="70" cy="80" r="3" fill="#fff" opacity=".3"/></svg>`;
  }
  const STAR5 = (fill, stroke) => `<svg viewBox="0 0 100 100" aria-hidden="true" class="sk-spin"><defs><radialGradient id="st5" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fffbeb"/><stop offset=".5" stop-color="${fill}"/><stop offset="1" stop-color="${stroke}"/></radialGradient></defs>
    <path d="M50 4 L62 36 L96 37 L69 58 L79 92 L50 72 L21 92 L31 58 L4 37 L38 36Z" fill="url(#st5)" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/><path d="M50 4 L50 72 M4 37 L69 58 M96 37 L31 58" stroke="#fff" stroke-opacity=".35" stroke-width="1.4"/><circle cx="40" cy="34" r="4" fill="#fff" opacity=".7"/></svg>`;
  const CANE = `<svg viewBox="0 0 70 120" aria-hidden="true"><defs><clipPath id="cnc"><path d="M22 116 V40 a22 22 0 0 1 44 0 v8 h-12 v-8 a10 10 0 0 0 -20 0 v76Z"/></clipPath></defs><path d="M22 116 V40 a22 22 0 0 1 44 0 v8 h-12 v-8 a10 10 0 0 0 -20 0 v76Z" fill="#fff" stroke="#e2e8f0"/>
    <g clip-path="url(#cnc)">${[...Array(14)].map((_, i) => `<path d="M-10 ${i * 12 - 20} L80 ${i * 12 - 50}" stroke="#ef4444" stroke-width="5"/>`).join('')}</g><path d="M28 112 V42" stroke="#fff" stroke-width="2" opacity=".6"/></svg>`;
  const HAT = `<g transform="translate(60 18) rotate(-12)"><path d="M-28 12 C-24 -14 10 -26 30 -18 C20 -12 14 -2 14 12Z" fill="#ef4444" stroke="#991b1b" stroke-width="1.4"/><path d="M-30 12 Q-8 4 18 12 L18 20 Q-8 12 -30 20Z" fill="#fff"/><circle cx="31" cy="-18" r="6" fill="#fff"/></g>`;
  const PHAT = `<g transform="translate(60 18) rotate(8)"><path d="M-14 12 L2 -30 L18 12Z" fill="#a855f7"/><path d="M-9 0 L13 0 M-5 -12 L9 -12 M-1 -22 L5 -22" stroke="#fde047" stroke-width="3"/><circle cx="2" cy="-31" r="4.5" fill="#f472b6"/></g>${[[18, 30, '#fde047'], [100, 40, '#67e8f9'], [16, 90, '#f472b6'], [104, 86, '#a3e635'], [92, 18, '#fb923c']].map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="7" height="3" rx="1.5" fill="${c}" transform="rotate(${i * 40} ${x} ${y})"/>`).join('')}`;
  const yearNext = () => { const d = NOW(); return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear(); };
  Object.assign(SKIN, {
    jul: {
      lab: { gold: 'Julstjärna', pink: 'Polkagris', heart: 'Pepparkakshjärta', leo: 'Tomteleopard' },
      bub(k) {
        if (k === 'gold') return STAR5('#fbbf24', '#b45309');
        if (k === 'pink') return CANE;
        if (k === 'heart') { const id = U(); return `<svg viewBox="0 0 100 90" aria-hidden="true"><defs><radialGradient id="${id}" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#d9a066"/><stop offset=".7" stop-color="#a0612c"/><stop offset="1" stop-color="#6b3a16"/></radialGradient></defs>
          <path d="${HEART}" fill="url(#${id})" stroke="#5b2e10" stroke-width="2"/><path d="M50 76 C47 73 14 52 14 30 C14 19 22 12 31 12 C39 12 45 17 50 24 C55 17 61 12 69 12 C78 12 86 19 86 30 C86 52 53 73 50 76Z" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="1 6" stroke-linecap="round"/>
          <text x="50" y="47" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Fredoka,system-ui">God Jul</text><path d="M30 56 q4 4 8 0 q4 -4 8 0 q4 4 8 0 q4 -4 8 0 q4 4 8 0" stroke="#fff" stroke-width="2" fill="none"/></svg>`; }
        if (k === 'leo') return leo({ '#fcd34d': '#fca5a5' }, HAT);
        return bauble(pick([['#fca5a5', '#dc2626', '#7f1d1d', '#fde68a'], ['#fde68a', '#d4a017', '#7c5a03', '#fff'], ['#86efac', '#16a34a', '#14532d', '#fde68a'], ['#93c5fd', '#2563eb', '#1e3a8a', '#e0f2fe'], ['#f1f5f9', '#94a3b8', '#334155', '#fca5a5'], ['#e9d5ff', '#9333ea', '#4c1d95', '#fde68a']]), Math.floor(Math.random() * 3));
      }, drop: 'snow'
    },
    nyar: {
      lab: { gold: 'Nyårsmynt', pink: 'Smällkaramell', heart: 'Glitterhjärta', leo: 'Festleopard' },
      bub(k) {
        if (k === 'gold') { const id = U(); return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fffbeb"/><stop offset=".45" stop-color="#fbbf24"/><stop offset="1" stop-color="#92400e"/></radialGradient></defs>
          <circle cx="50" cy="50" r="46" fill="url(#${id})" stroke="#b45309" stroke-width="2.4"/><circle cx="50" cy="50" r="37" fill="none" stroke="#fde68a" stroke-width="1.6" stroke-dasharray="2 3"/><text x="50" y="58" text-anchor="middle" font-size="22" font-weight="700" fill="#78350f" font-family="Fredoka,system-ui">${yearNext()}</text><ellipse cx="34" cy="28" rx="10" ry="5" fill="#fff" opacity=".5" transform="rotate(-30 34 28)"/></svg>`; }
        if (k === 'pink') return `<svg viewBox="0 0 130 60" aria-hidden="true"><path d="M36 30 L6 8 L12 30 L6 52Z M94 30 L124 8 L118 30 L124 52Z" fill="#f472b6" stroke="#be185d" stroke-width="1.5"/><rect x="34" y="14" width="62" height="32" rx="10" fill="#ec4899" stroke="#be185d" stroke-width="1.5"/>
          ${[44, 56, 68, 80].map(x => `<path d="M${x} 14 l8 32" stroke="#fde047" stroke-width="3"/>`).join('')}<path d="M40 20 Q60 16 84 20" stroke="#fff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/><g fill="#fde047"><circle cx="20" cy="12" r="2"/><circle cx="112" cy="50" r="2"/></g></svg>`;
        if (k === 'heart') { const id = U(); return `<svg viewBox="0 0 100 90" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#f472b6"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs><path d="${HEART}" fill="url(#${id})" fill-opacity=".8" stroke="#fef3c7" stroke-width="2.4"/>
          ${[...Array(26)].map((_, i) => `<circle cx="${f1(18 + (i * 29) % 64)}" cy="${f1(14 + (i * 17) % 50)}" r="${(1 + (i % 3) * .7).toFixed(1)}" fill="#fff" opacity="${(.4 + (i % 4) * .15).toFixed(2)}"/>`).join('')}<path d="M22 18 C27 13 35 13 39 18" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round"/></svg>`; }
        if (k === 'leo') return leo({ '#fcd34d': '#fde047' }, PHAT);
        if (Math.random() < .2) return `<svg viewBox="0 0 100 100" aria-hidden="true" class="sk-spin"><g stroke="#fde68a" stroke-linecap="round">${[...Array(12)].map((_, i) => `<path transform="rotate(${i * 30} 50 50)" d="M50 ${i % 2 ? 22 : 10} V40" stroke-width="${i % 2 ? 2 : 3}"/>`).join('')}</g><circle cx="50" cy="50" r="10" fill="#fff7cc"/><circle cx="50" cy="50" r="18" fill="#fde047" opacity=".3"/></svg>`;
        const id = U(); return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#fffbeb" stop-opacity=".9"/><stop offset=".35" stop-color="#fde68a" stop-opacity=".35"/><stop offset=".85" stop-color="#f59e0b" stop-opacity=".2"/><stop offset="1" stop-color="#d97706" stop-opacity=".5"/></radialGradient></defs>
          <circle cx="50" cy="50" r="46" fill="url(#${id})" stroke="#fde68a" stroke-opacity=".9" stroke-width="2"/>${[[62, 66, 5], [44, 74, 3.5], [70, 46, 3], [56, 82, 2.4], [34, 60, 2]].map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}" fill="none" stroke="#fef3c7" stroke-opacity=".8" stroke-width="1.2"/>`).join('')}
          <path d="M26 34 Q34 20 50 18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/></svg>`;
      }, drop: 'fw'
    }
  });

  function bubble(kind) {
    const w = cur(); if (!w || !SKIN[w]) return null;
    try { return { w, html: SKIN[w].bub(kind || ''), drop: SKIN[w].drop }; } catch (e) { return null; }
  }
  const label = kind => { const w = cur(); return w && SKIN[w] && SKIN[w].lab[kind] || null; };
  const dropCls = () => { const w = cur(); return w && SKIN[w] ? 'dk-' + SKIN[w].drop : ''; };

  /* ================= butiken ================= */
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function thumb(k) { return `<div class="bgw-th" style="background:radial-gradient(110% 70% at 85% -10%,${W[k].glow[0]},transparent 55%),radial-gradient(120% 60% at 0% 110%,${W[k].glow[1]},transparent 60%),linear-gradient(180deg,${W[k].bg[0]},${W[k].bg[1]} 50%,${W[k].bg[2]})"><div class="bgw-in">${build(k, { thumb: 1, p: 'th' + k, still: 1, few: 1 })}</div><div class="bgw-bub">${(SKIN[k].bub('') || '')}</div></div>`; }
  function shop(focus) {
    const kv = kassa(), now = (() => { try { return STYLE.get().world; } catch (e) { return ''; } })();
    const cards = ORDER.map(k => {
      const w = W[k], own = owned(k), on = own && now === k, can = kv >= w.price, pct = Math.min(100, Math.round(kv / w.price * 100));
      return `<div class="bgw ${on ? 'on' : ''} ${own ? 'own' : 'lock'} ${focus === k ? 'focus' : ''}" data-k="${k}">${thumb(k)}
        <div class="bgw-t"><b>${w.ic} ${w.name}</b><small>${w.desc}</small></div>
        ${on ? `<div class="bgw-st">✓ Används</div>` : own ? `<button class="bgw-b" data-act="bguse" data-k="${k}">Använd</button>`
          : can ? `<button class="bgw-b buy" data-act="bgbuy" data-k="${k}">🔓 Lås upp ${fmt(w.price)}</button>`
          : `<div class="bgw-pr"><i style="width:${pct}%"></i><span>🔒 ${fmt(kv)} / ${fmt(w.price)} 🫧</span></div>`}</div>`;
    }).join('');
    const seas = ['jul', 'nyar'].map(k => { const w = W[k], av = avail(k), on = now === k;
      return `<div class="bgw ${on ? 'on' : ''} ${av ? 'own' : 'lock'} seas" data-k="${k}">${thumb(k)}<div class="bgw-t"><b>${w.ic} ${w.name}</b><small>${w.desc}</small></div>
        ${on ? `<div class="bgw-st">✓ Används</div>` : av ? `<button class="bgw-b" data-act="bguse" data-k="${k}">Använd · gratis</button>` : `<div class="bgw-pr"><span>📅 ${seasonLabel(k)}</span></div>`}</div>`; }).join('');
    const special = W[now] && owned(now);
    openModal(`<h3>✨ Bubbelvärldar</h3>
      <div class="bgw-kassa"><b>${fmt(kv)} 🫧</b><small>i din bubbelkassa – allt du har poppat. Att nollställa räknaren påverkar inte kassan.</small></div>
      <div class="bgw-scroll"><div class="bgw-h">🎁 Säsong – gratis just nu</div><div class="bgw-grid">${seas}</div>
      <div class="bgw-h">🫧 Lås upp med bubblor</div><div class="bgw-grid">${cards}</div></div>
      <div class="btns">${special ? '<button class="ghost" data-act="bgoff">Tillbaka till vanlig värld</button>' : ''}<button class="pri" data-act="close">Klar</button></div>`, 'bgshop');
    if (focus) setTimeout(() => { const el = document.querySelector(`.bgw[data-k="${focus}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
  }
  function use(k) {
    const s = STYLE.get(); if (!W[s.world]) lsSet('ry_bg_prev', s.world);
    STYLE.set('world', k); try { if (typeof render === 'function') render(); } catch (e) {}
  }
  function act(a, b) {
    if (a === 'bgshop') { shop(b && b.dataset.k); return true; }
    if (a === 'bgbuy') {
      const k = b.dataset.k; if (!buy(k)) { toast('Inte tillräckligt med bubbelpoäng än 🫧'); return true; }
      closeModal(); use(k);
      try { sparkles(40); buzz([20, 40, 20, 40, 60]); [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .28, i % 2 ? 'triangle' : 'sine', .09, .05 + i * .08)); } catch (e) {}
      setTimeout(() => openModal(`<div class="bgw-new">${thumb(k)}<h3>${W[k].ic} ${W[k].name} är upplåst!</h3><p>${W[k].desc}</p></div><div class="btns"><button class="pri" data-act="close">Härligt!</button></div>`, 'bgnew'), 500);
      return true;
    }
    if (a === 'bguse') { use(b.dataset.k); shop(); buzz(6); return true; }
    if (a === 'bgoff') { const pv = lsGet('ry_bg_prev'); STYLE.set('world', pv && !W[pv] ? pv : 'rymd'); try { render(); } catch (e) {} shop(); return true; }
    return false;
  }
  // säg till (en gång per värld) när kassan räcker till något nytt
  function check() {
    const kv = kassa(), told = J('ry_bg_told', []), k = ORDER.find(k => !owned(k) && kv >= W[k].price && !told.includes(k));
    if (!k) return; lsSet('ry_bg_told', JSON.stringify(told.concat(k)));
    setTimeout(() => toast(`✨ Du kan låsa upp ${W[k].ic} ${W[k].name}! Tryck på 🫧`, 4200), 900);
  }
  const affordable = () => ORDER.some(k => !owned(k) && kassa() >= W[k].price);
  return { seasonCheck, avail, seasonLabel, worlds: W, ORDER, build, bubble, label, dropCls, owned, kassa, buy, shop, act, check, affordable, cur };
})();
