/* ---------- Utseende: ett gemensamt formspråk, personliga val och varje spels egen karaktär ----------
   Världar (bakgrund och stämning), accentfärg, textstorlek, rörelse, mängd dekor och ikonstil väljs av spelaren.
   Varje spel behåller sin egen färg och får ett eget mönster och en egen ritad ikon i samma stil – igenkänning
   överallt, men aldrig likriktat. Less is more: dekoren går att skruva ner till ingenting. */
const STYLE = (() => {
  const J = (k, d) => { try { const v = JSON.parse(lsGet(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };

  /* ---------- världar ---------- */
  const WORLDS = {
    rymd:     { name: 'Rymd & hav', ic: '🪐', bg: ['#030a1f', '#071a45', '#0a3a6b'], glow: ['rgba(124,92,230,.55)', 'rgba(14,120,180,.75)'], acc: '#3ee6ff', acc2: '#a78bfa', txt: '#e8f6ff', dim: '#8fb4d8', glass: 'rgba(110,180,255,.10)', line: 'rgba(140,210,255,.22)', planet: 1, stars: 1, sea: 1 },
    hav:      { name: 'Djuphavet', ic: '🐠', bg: ['#021a24', '#053b4d', '#0b6070'], glow: ['rgba(45,212,191,.45)', 'rgba(14,165,233,.55)'], acc: '#5eead4', acc2: '#38bdf8', txt: '#e6fffb', dim: '#8ccfc8', glass: 'rgba(94,234,212,.10)', line: 'rgba(94,234,212,.24)', planet: 0, stars: 0, sea: 2 },
    sol:      { name: 'Solnedgång', ic: '🌅', bg: ['#1a0b2e', '#4a1e4f', '#b0485c'], glow: ['rgba(251,146,60,.55)', 'rgba(236,72,153,.5)'], acc: '#fdba74', acc2: '#f472b6', txt: '#fff4ec', dim: '#e2b3b8', glass: 'rgba(253,186,116,.10)', line: 'rgba(253,186,116,.26)', planet: 0, sun: 1, stars: 1, sea: 1 },
    skog:     { name: 'Skogsnatt', ic: '🌲', bg: ['#04140c', '#0b2a1a', '#14402a'], glow: ['rgba(74,222,128,.35)', 'rgba(250,204,21,.22)'], acc: '#86efac', acc2: '#fde047', txt: '#effff4', dim: '#9cc9a8', glass: 'rgba(134,239,172,.09)', line: 'rgba(134,239,172,.22)', planet: 0, stars: 1, flies: 1, sea: 0 },
    leopard:  { name: 'Leopard', ic: '🐆', bg: ['#1b120a', '#3a2614', '#5a3a1c'], glow: ['rgba(227,176,100,.45)', 'rgba(249,168,212,.30)'], acc: '#f5c27a', acc2: '#f9a8d4', txt: '#fff7ea', dim: '#d6b892', glass: 'rgba(245,194,122,.10)', line: 'rgba(245,194,122,.26)', planet: 0, stars: 0, leo: 1, sea: 0 },
    ljus:     { name: 'Molnljus', ic: '☁️', bg: ['#dbeafe', '#e9d5ff', '#fbcfe8'], glow: ['rgba(255,255,255,.7)', 'rgba(196,181,253,.5)'], acc: '#7c3aed', acc2: '#db2777', txt: '#1e1b4b', dim: '#5b5a86', glass: 'rgba(255,255,255,.55)', line: 'rgba(124,58,237,.22)', planet: 0, stars: 0, sea: 0, light: 1 },
    ren:      { name: 'Ren & enkel', ic: '◻️', bg: ['#0b0f1a', '#111827', '#111827'], glow: ['rgba(148,163,184,.12)', 'rgba(148,163,184,.08)'], acc: '#93c5fd', acc2: '#c4b5fd', txt: '#f1f5f9', dim: '#94a3b8', glass: 'rgba(148,163,184,.10)', line: 'rgba(148,163,184,.22)', planet: 0, stars: 0, sea: 0, plain: 1 }
  };
  const ACCENTS = { auto: null, rosa: ['#f9a8d4', '#f472b6'], lila: ['#c4b5fd', '#a855f7'], turkos: ['#5eead4', '#22d3ee'], guld: ['#fde68a', '#f59e0b'], korall: ['#fda4af', '#fb7185'], mint: ['#bbf7d0', '#34d399'] };
  const DEF = { world: 'rymd', acc: 'auto', size: 'normal', motion: 'auto', decor: 'lite', icons: 'ritade', dice: 'klassisk' };
  const DICE = { klassisk: 'Klassisk', parlemor: 'Pärlemor', hav: 'Havsglas', leopard: 'Leopard', neon: 'Neon', natt: 'Midnatt' };
  const get = () => Object.assign({}, DEF, J('style', {}));
  const set = (k, v) => { const s = get(); s[k] = v; lsSet('style', JSON.stringify(s)); apply(); };

  /* ---------- tillämpa ---------- */
  let skyKey = '';
  function apply() {
    const s = get(), w = WORLDS[s.world] || WORLDS.rymd, a = ACCENTS[s.acc], r = document.documentElement.style, b = document.body;
    r.setProperty('--deep', w.bg[0]); r.setProperty('--bg1', w.bg[0]); r.setProperty('--bg2', w.bg[1]); r.setProperty('--bg3', w.bg[2]);
    r.setProperty('--glow1', w.glow[0]); r.setProperty('--glow2', w.glow[1]);
    r.setProperty('--aqua', a ? a[1] : w.acc); r.setProperty('--acc', a ? a[1] : w.acc); r.setProperty('--acc2', a ? a[0] : w.acc2);
    r.setProperty('--txt', w.txt); r.setProperty('--dim', w.dim); r.setProperty('--glass', w.glass); r.setProperty('--glass2', w.glass.replace(/[\d.]+\)$/, m => (parseFloat(m) * 1.6).toFixed(2) + ')')); r.setProperty('--line', w.line);
    ['rymd', 'hav', 'sol', 'skog', 'leopard', 'ljus', 'ren'].forEach(k => b.classList.toggle('w-' + k, s.world === k));
    b.classList.toggle('w-light', !!w.light);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mo = s.motion === 'auto' ? (reduce ? 'lugn' : 'full') : s.motion;
    b.classList.toggle('mo-lugn', mo === 'lugn'); b.classList.toggle('mo-av', mo === 'av');
    b.classList.toggle('dec-ingen', s.decor === 'ingen' || !!w.plain); b.classList.toggle('dec-lite', s.decor === 'lite');
    b.classList.toggle('ic-emoji', s.icons === 'emoji');
    Object.keys(DICE).forEach(k => b.classList.toggle('dice-' + k, s.dice === k));
    try { if (typeof backSVG === 'function') r.setProperty('--cardback', backSVG(typeof solTheme !== 'undefined' ? solTheme : 'ocean')); } catch (e) {}
    const z = s.size === 'stor' ? 1.1 : s.size === 'xstor' ? 1.22 : 1; b.style.zoom = z === 1 ? '' : z;
    const mc = document.querySelector('meta[name=theme-color]'); if (mc) mc.setAttribute('content', w.bg[0]);
    const k = s.world + s.decor + mo; if (k !== skyKey) { skyKey = k; sky(w, s, mo); }
  }
  // himlen/havet bakom allt – byggs om bara när världen eller dekoren ändras
  function sky(w, s, mo) {
    const el = document.getElementById('sky'); if (!el) return;
    if (s.decor === 'ingen' || w.plain) { el.innerHTML = ''; return; }
    const few = s.decor === 'lite', R = Math.random; let h = '';
    if (w.planet) h += '<div class="planet"></div><div class="ring"></div><div class="moon"></div>';
    if (w.sun) h += '<div class="sundisc"></div>';
    if (w.leo) h += '<div class="leosky"></div>';
    const nStars = w.stars ? (few ? 40 : 110) : 0;
    for (let i = 0; i < nStars; i++) { const sz = R() < .85 ? 1.5 : 2.6; h += `<div class="star" style="left:${R() * 100}%;top:${R() * (w.sun ? 45 : 75)}%;width:${sz}px;height:${sz}px;animation-delay:${(R() * 3).toFixed(2)}s;animation-duration:${(2 + R() * 3).toFixed(2)}s"></div>`; }
    if (w.flies) for (let i = 0; i < (few ? 10 : 24); i++) h += `<div class="fly" style="left:${R() * 100}%;top:${30 + R() * 65}%;animation-delay:-${(R() * 8).toFixed(1)}s;animation-duration:${(6 + R() * 6).toFixed(1)}s"></div>`;
    if (w.stars && !few) h += `<div class="shoot" style="top:14%;right:-10%"></div><div class="shoot" style="top:34%;right:-20%;animation-delay:4.5s"></div>`;
    const nb = w.sea ? (few ? 6 : 16) * w.sea : 0;
    for (let i = 0; i < nb; i++) { const sz = 6 + R() * 16; h += `<div class="bubble" style="left:${R() * 100}%;width:${sz}px;height:${sz}px;animation-duration:${(9 + R() * 12).toFixed(1)}s;animation-delay:-${(R() * 20).toFixed(1)}s"></div>`; }
    if (w.sea && !few && typeof DOLPHIN === 'function') h += `<div class="swimmer" style="top:58%;animation-duration:26s">${DOLPHIN('s1')}</div><div class="swimmer" style="top:76%;width:80px;animation-duration:34s;animation-delay:-14s">${DOLPHIN('s2', '#f9a8d4', '#a78bfa')}</div>`;
    if (w.sea) h += `<svg class="waves" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 40 Q50 20 100 40 T200 40 T300 40 T400 40 V120 H0Z" fill="${w.sea > 1 ? 'rgba(94,234,212,.16)' : 'rgba(62,230,255,.14)'}"/><path d="M0 70 Q50 50 100 70 T200 70 T300 70 T400 70 V120 H0Z" fill="rgba(10,40,90,.35)"/></svg>`;
    el.innerHTML = h;
  }

  /* ---------- varje spels identitet: ritad ikon + eget mönster, samma formspråk ---------- */
  // Ikonerna ritas i en gemensam stil: mjuka former, ljus överkant, mörk skugga, vit kant ("klistermärke").
  const SH = '<defs><linearGradient id="hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>';
  const I = (body) => `<svg viewBox="0 0 64 64" class="gico" aria-hidden="true">${SH}<g stroke="rgba(15,10,40,.35)" stroke-width="1.6" stroke-linejoin="round">${body}</g></svg>`;
  const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c || '#1e1b4b'}" stroke="none"/>`;
  const card = (x, y, rot, face, c) => `<g transform="rotate(${rot} ${x + 13} ${y + 18})"><rect x="${x}" y="${y}" width="26" height="36" rx="5" fill="#fffdf7"/><rect x="${x}" y="${y}" width="26" height="18" rx="5" fill="url(#hl)" stroke="none"/>${face ? `<text x="${x + 13}" y="${y + 25}" font-size="16" font-weight="700" text-anchor="middle" fill="${c || '#e11d48'}" stroke="none" font-family="Fredoka,system-ui">${face}</text>` : ''}</g>`;
  const ICONS = {
    yatzy: I(`<g transform="rotate(-12 22 34)"><rect x="8" y="20" width="28" height="28" rx="7" fill="#fff"/>${dot(16, 28, 3)}${dot(28, 40, 3)}${dot(22, 34, 3)}<rect x="8" y="20" width="28" height="14" rx="7" fill="url(#hl)" stroke="none"/></g><g transform="rotate(14 42 26)"><rect x="28" y="12" width="28" height="28" rx="7" fill="#fff"/>${dot(36, 20, 3, '#e11d48')}${dot(48, 20, 3, '#e11d48')}${dot(36, 32, 3, '#e11d48')}${dot(48, 32, 3, '#e11d48')}<rect x="28" y="12" width="28" height="14" rx="7" fill="url(#hl)" stroke="none"/></g>`),
    fia: I(`<circle cx="32" cy="34" r="22" fill="#fef3c7"/><path d="M32 12v44M10 34h44" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>${dot(32, 34, 6, '#fff')}<path d="M26 44c0-6 2-10 6-12-3-1-4-3-4-6a4 4 0 0 1 8 0c0 3-1 5-4 6 4 2 6 6 6 12z" fill="#ef4444"/><path d="M28 26a4 4 0 0 1 8 0" fill="url(#hl)" stroke="none"/>`),
    sol: I(`${card(8, 18, -18, '♠', '#1e1b4b')}${card(19, 13, 0, '♥')}${card(30, 18, 18, '♦')}`),
    vandtia: I(`${card(12, 16, -10, '')}${card(24, 12, 8, '10', '#1e1b4b')}`),
    fisk: I(`<path d="M8 34c8-12 22-16 34-10l12-8-2 18 2 18-12-8c-12 6-26 2-34-10z" fill="#38bdf8"/><path d="M14 30c8-8 20-10 28-6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>${dot(20, 31, 3)}<path d="M28 40q6 4 12 0" fill="none" stroke="#0c4a6e" stroke-width="2" stroke-linecap="round"/>`),
    hjarter: I(`${card(18, 12, 6, '')}<path d="M32 50S14 38 14 27a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 11-18 23-18 23z" fill="#ef4444"/><path d="M18 26a7 7 0 0 1 12-3" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="3" stroke-linecap="round"/>`),
    kina: I(`<path d="M32 6l7 14h16l-9 12 9 12H39l-7 14-7-14H9l9-12-9-12h16z" fill="#fde68a"/>${[[32, 16, '#ef4444'], [32, 48, '#22c55e'], [16, 24, '#3b82f6'], [48, 40, '#f97316'], [48, 24, '#a855f7'], [16, 40, '#14b8a6']].map(([x, y, c]) => dot(x, y, 4, c)).join('')}${dot(32, 32, 4.5, '#fff')}`),
    othello: I(`<rect x="8" y="8" width="48" height="48" rx="10" fill="#16a34a"/><path d="M8 32h48M32 8v48M20 8v48M44 8v48M8 20h48M8 44h48" stroke="#14532d" stroke-width="1"/><circle cx="26" cy="38" r="10" fill="#111827"/><circle cx="40" cy="26" r="10" fill="#fff"/><circle cx="37" cy="23" r="4" fill="url(#hl)" stroke="none"/>`),
    c4: I(`<rect x="8" y="12" width="48" height="44" rx="9" fill="#2563eb"/>${[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => `<circle cx="${16 + c * 11}" cy="${21 + r * 10}" r="4" fill="${(r === 3 && c < 3) || (r === 2 && c === 1) ? (c % 2 ? '#facc15' : '#ef4444') : r === 3 ? '#facc15' : '#0b1f5c'}" stroke="none"/>`).join('')).join('')}<rect x="8" y="12" width="48" height="14" rx="9" fill="url(#hl)" stroke="none"/>`),
    gomoku: I(`<rect x="8" y="8" width="48" height="48" rx="10" fill="#fde68a"/><path d="M8 20h48M8 32h48M8 44h48M20 8v48M32 8v48M44 8v48" stroke="#b45309" stroke-opacity=".5" stroke-width="1.2"/><path d="M15 15l10 10M25 15L15 25M39 39l10 10M49 39L39 49" stroke="#1e1b4b" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="32" r="5.5" fill="none" stroke="#e11d48" stroke-width="3.5"/>`),
    ships: I(`<path d="M6 46c6 6 46 6 52 0" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/><path d="M10 38h44l-6 10H16z" fill="#e2e8f0"/><rect x="20" y="28" width="22" height="10" rx="2" fill="#94a3b8"/><rect x="26" y="18" width="6" height="10" fill="#64748b"/><path d="M29 18v-8" stroke="#1e293b" stroke-width="2"/><path d="M30 10l10 4-10 3z" fill="#ef4444"/>${dot(22, 33, 1.8, '#fff')}${dot(30, 33, 1.8, '#fff')}${dot(38, 33, 1.8, '#fff')}`),
    mm: I(`<rect x="8" y="10" width="48" height="44" rx="10" fill="#4c1d95"/>${[['#ef4444', '#facc15', '#22c55e', '#3b82f6'], ['#a855f7', '#ef4444', '#f97316', '#22c55e']].map((row, r) => row.map((c, i) => `<circle cx="${17 + i * 9}" cy="${23 + r * 15}" r="4" fill="${c}"/>`).join('')).join('')}${dot(50, 20, 2, '#fff')}${dot(50, 26, 2, '#111')}${dot(50, 35, 2, '#fff')}${dot(50, 41, 2, '#fff')}`),
    ordfajt: I(`${[['O', 8, 22, -8, '#fde68a'], ['R', 24, 14, 4, '#fbcfe8'], ['D', 40, 22, 10, '#bfdbfe']].map(([l, x, y, r, c]) => `<g transform="rotate(${r} ${x + 9} ${y + 9})"><rect x="${x}" y="${y}" width="18" height="20" rx="4" fill="${c}"/><text x="${x + 9}" y="${y + 15}" text-anchor="middle" font-size="13" font-weight="700" fill="#1e1b4b" stroke="none" font-family="Fredoka,system-ui">${l}</text></g>`).join('')}<path d="M14 50h36" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
    wordle: I(`${[['#64748b', 'O'], ['#eab308', 'R'], ['#22c55e', 'D']].map(([c, l], i) => `<rect x="${8 + i * 17}" y="22" width="15" height="18" rx="3" fill="${c}"/><text x="${15.5 + i * 17}" y="35.5" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" stroke="none" font-family="Fredoka,system-ui">${l}</text>`).join('')}<rect x="8" y="44" width="49" height="6" rx="3" fill="#fff" fill-opacity=".5" stroke="none"/>`),
    hang: I(`<path d="M14 54h28M20 54V10h22v8" fill="none" stroke="#fde68a" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="24" r="6" fill="#fff"/><path d="M42 30v12M42 34l-6 4M42 34l6 4M42 42l-5 8M42 42l5 8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
    sudoku: I(`<rect x="8" y="8" width="48" height="48" rx="9" fill="#fff"/><path d="M24 8v48M40 8v48M8 24h48M8 40h48" stroke="#6366f1" stroke-width="2"/>${[['5', 16, 20], ['3', 32, 36], ['9', 48, 52], ['1', 48, 20]].map(([n, x, y]) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" font-weight="700" fill="${n === '9' ? '#e11d48' : '#1e1b4b'}" stroke="none" font-family="Fredoka,system-ui">${n}</text>`).join('')}`),
    memory: I(`<g transform="rotate(-10 20 32)"><rect x="8" y="14" width="24" height="34" rx="5" fill="#a855f7"/><path d="M14 20l12 22M26 20L14 42" stroke="#fff" stroke-opacity=".35" stroke-width="2"/></g><g transform="rotate(10 44 32)"><rect x="32" y="14" width="24" height="34" rx="5" fill="#fff"/><path d="M44 38s-7-5-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4-7 9-7 9z" fill="#f472b6"/></g>`),
    race: I(`<path d="M8 40c2-8 8-12 14-13l6-7h12l6 7c6 1 10 5 10 13v6H8z" fill="#ef4444"/><path d="M28 20h10l5 7H23z" fill="#bae6fd"/><rect x="8" y="40" width="48" height="6" rx="3" fill="#b91c1c" stroke="none"/><circle cx="18" cy="47" r="6" fill="#1f2937"/><circle cx="46" cy="47" r="6" fill="#1f2937"/>${dot(18, 47, 2.4, '#e5e7eb')}${dot(46, 47, 2.4, '#e5e7eb')}<path d="M10 34h6" stroke="#fde68a" stroke-width="3" stroke-linecap="round"/><path d="M24 28c4-2 12-2 18 0" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>`),
    slalom: I(`<path d="M10 54L54 26" stroke="#e0f2fe" stroke-width="6" stroke-linecap="round"/><path d="M14 18v20M44 10v20" stroke="#fff" stroke-width="2"/><path d="M14 18l10 4-10 4z" fill="#ef4444"/><path d="M44 10l10 4-10 4z" fill="#3b82f6"/><circle cx="30" cy="30" r="5" fill="#fde68a"/><path d="M30 35l-4 10 8 2M30 35l6 6" stroke="#7c3aed" stroke-width="4" stroke-linecap="round"/><path d="M20 50l20-6" stroke="#1e1b4b" stroke-width="3" stroke-linecap="round"/>`),
    skidskytte: I(`<circle cx="32" cy="30" r="20" fill="#fff"/><circle cx="32" cy="30" r="14" fill="#1e1b4b"/><circle cx="32" cy="30" r="8" fill="#fff"/><circle cx="32" cy="30" r="3.5" fill="#ef4444"/><path d="M8 56l48-6" stroke="#60a5fa" stroke-width="4" stroke-linecap="round"/>`),
    pong: I(`<rect x="8" y="10" width="48" height="44" rx="8" fill="#0f172a"/><path d="M32 14v36" stroke="#fff" stroke-opacity=".35" stroke-dasharray="3 4" stroke-width="2"/><rect x="13" y="20" width="5" height="16" rx="2.5" fill="#22d3ee" stroke="none"/><rect x="46" y="30" width="5" height="16" rx="2.5" fill="#f472b6" stroke="none"/><circle cx="36" cy="26" r="3.5" fill="#fff" stroke="none"/>`),
    inv: I(`<path d="M32 6c9 7 13 18 12 30H20c-1-12 3-23 12-30z" fill="#e2e8f0"/><circle cx="32" cy="22" r="5" fill="#38bdf8"/><circle cx="30.5" cy="20.5" r="1.8" fill="#fff" stroke="none"/><path d="M20 30l-8 10 9-1M44 30l8 10-9-1" fill="#ef4444"/><path d="M26 40c2 8 4 12 6 16 2-4 4-8 6-16z" fill="#f97316"/><path d="M29 40c1 5 2 8 3 10 1-2 2-5 3-10z" fill="#fde68a" stroke="none"/>${dot(12, 14, 1.4, '#fff')}${dot(54, 18, 1.2, '#fff')}${dot(50, 50, 1.4, '#fff')}`)
  };
  // diskreta mönster per spel (ritas med låg opacitet ovanpå spelets egen färg)
  const svgUrl = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  const P = (inner, w = 48) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${w}' viewBox='0 0 ${w} ${w}' fill='white' stroke='white'>${inner}</svg>`);
  const MOTIFS = {
    dice: P(`<circle cx='8' cy='8' r='2.2'/><circle cx='24' cy='24' r='2.2'/><circle cx='40' cy='40' r='2.2'/><circle cx='40' cy='8' r='2.2'/><circle cx='8' cy='40' r='2.2'/>`),
    suits: P(`<text x='4' y='18' font-size='14'>♠</text><text x='28' y='42' font-size='14'>♥</text><text x='28' y='18' font-size='12'>♦</text><text x='4' y='42' font-size='12'>♣</text>`),
    waves: P(`<path d='M0 12q6-6 12 0t12 0 12 0 12 0M0 36q6-6 12 0t12 0 12 0 12 0' fill='none' stroke-width='2'/>`),
    stars: P(`<path d='M12 4l2 5 5 .5-4 3.5 1 5-4-2.5-4 2.5 1-5-4-3.5 5-.5z'/><circle cx='36' cy='34' r='1.6'/><circle cx='38' cy='10' r='1.2'/>`),
    grid: P(`<path d='M0 24h48M24 0v48' fill='none' stroke-width='1.2'/><circle cx='24' cy='24' r='3'/>`),
    letters: P(`<text x='4' y='20' font-size='15' font-family='Fredoka,system-ui' font-weight='700'>A</text><text x='26' y='44' font-size='15' font-family='Fredoka,system-ui' font-weight='700'>Ö</text>`),
    snow: P(`<path d='M12 4v16M4 12h16M6 6l12 12M18 6L6 18' fill='none' stroke-width='1.6'/><circle cx='36' cy='36' r='2'/>`),
    road: P(`<path d='M24 0v12M24 24v12' fill='none' stroke-width='3'/>`),
    pixels: P(`<rect x='6' y='6' width='5' height='5'/><rect x='30' y='20' width='5' height='5'/><rect x='14' y='34' width='5' height='5'/><rect x='38' y='40' width='3' height='3'/>`),
    hearts: P(`<path d='M12 20s-7-5-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4-7 9-7 9zM36 44s-6-4-6-8a3.5 3.5 0 0 1 6-2 3.5 3.5 0 0 1 6 2c0 4-6 8-6 8z'/>`),
    dots: P(`<circle cx='12' cy='12' r='4'/><circle cx='36' cy='36' r='4'/>`)
  };
  const GAME_MOTIF = { yatzy: 'dice', fia: 'dots', sol: 'suits', vandtia: 'suits', fisk: 'waves', hjarter: 'hearts', kina: 'stars', othello: 'dots', c4: 'dots', gomoku: 'grid', ships: 'waves', mm: 'dots', ordfajt: 'letters', wordle: 'letters', hang: 'letters', sudoku: 'grid', memory: 'hearts', race: 'road', slalom: 'snow', skidskytte: 'snow', pong: 'pixels', inv: 'pixels' };
  const icon = (k, fallback) => get().icons === 'emoji' || !ICONS[k] ? `<span class="ti">${fallback}</span>` : `<span class="ti ti-svg">${ICONS[k]}</span>`;
  const motif = k => MOTIFS[GAME_MOTIF[k]] || MOTIFS.dots;
  // gör om en lobby-ruta: ritad ikon + spelets mönster, utan att röra spelets färg
  function decorateTile(html, k) {
    if (!html) return html;
    const m = html.match(/<span class="ti">([\s\S]*?)<\/span>/); const fb = m ? m[1] : '';
    const mv = `--motif:${motif(k).replace(/"/g, '&quot;')};`;
    let out = html.replace(/<span class="ti">[\s\S]*?<\/span>/, icon(k, fb));
    out = /^<button class="tile[^"]*" style="/.test(out) ? out.replace(/^(<button class="tile[^"]*" style=")/, `$1${mv}`) : out.replace(/^<button class="tile/, `<button style="${mv}" class="tile`);
    return out.replace(/^<button /, `<button data-g="${k}" `);
  }

  /* ---------- inne i ett spel: spelets färg och mönster följer med ---------- */
  const GRAD = { yatzy: 'linear-gradient(135deg,#22d3ee,#6366f1 60%,#a855f7)', sol: 'linear-gradient(135deg,#e3b064,#9a6a2f)', race: 'linear-gradient(135deg,#f97316,#e11d48 45%,#4c1d95)', inv: 'linear-gradient(135deg,#16a34a,#0f172a 75%)' };
  const gradOf = k => GRAD[k] || (typeof GINFO !== 'undefined' && GINFO[k] && GINFO[k].grad) || 'linear-gradient(135deg,var(--acc),var(--acc2))';
  let ctxK = null;
  function gameCtx(k) {
    if (k === ctxK) return; ctxK = k; const b = document.body;
    if (!k) { delete b.dataset.game; b.style.removeProperty('--gacc'); b.style.removeProperty('--gmotif'); return; }
    b.dataset.game = k; b.style.setProperty('--gacc', gradOf(k)); b.style.setProperty('--gmotif', motif(k));
  }

  /* ---------- inställningsfönstret med förhandsvisning ---------- */
  function show() {
    const s = get(), seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="styset" data-k="${k}" data-v="${v}" class="${s[k] === v ? 'sel' : ''}">${l}</button>`).join('')}</div>`;
    const worlds = Object.entries(WORLDS).map(([k, w]) => `<button class="sty-w ${s.world === k ? 'on' : ''}" data-act="styset" data-k="world" data-v="${k}" style="--a:${w.bg[0]};--b:${w.bg[1]};--c:${w.bg[2]};--g:${w.glow[0]};--t:${w.txt}"><i>${w.ic}</i><b>${w.name}</b></button>`).join('');
    const accs = Object.entries(ACCENTS).map(([k, a]) => `<button class="sty-a ${s.acc === k ? 'on' : ''}" data-act="styset" data-k="acc" data-v="${k}" title="${k}" style="--c:${a ? `linear-gradient(135deg,${a[0]},${a[1]})` : 'conic-gradient(#f9a8d4,#c4b5fd,#5eead4,#fde68a,#f9a8d4)'}">${k === 'auto' ? '<span>auto</span>' : ''}</button>`).join('');
    const prev = ['yatzy', 'sol', 'race', 'kina'].map(k => { const gi = typeof GINFO !== 'undefined' && GINFO[k]; const grad = { yatzy: 'linear-gradient(135deg,#22d3ee,#6366f1 60%,#a855f7)', race: 'linear-gradient(135deg,#f97316,#e11d48 45%,#4c1d95)', sol: 'linear-gradient(135deg,#e3b064,#9a6a2f)' }[k] || (gi && gi.grad); return `<div class="tile mini" style="--tg:${grad};--motif:${motif(k).replace(/"/g, '&quot;')}">${icon(k, '🎲')}</div>`; }).join('');
    openModal(`<h3>🎨 Utseende</h3>
      <div class="sty-prev">${prev}</div>
      <div class="setrow"><div class="lbl">Värld</div><div class="sty-ws">${worlds}</div></div>
      <div class="setrow"><div class="lbl">Accentfärg</div><div class="sty-as">${accs}</div></div>
      <div class="setrow"><div class="lbl">Dekor</div>${seg('decor', [['mycket', 'Mycket'], ['lite', 'Lite'], ['ingen', 'Ingen']])}<div class="setnote">Stjärnor, bubblor och simmande delfiner i bakgrunden.</div></div>
      <div class="setrow"><div class="lbl">Rörelse</div>${seg('motion', [['auto', 'Auto'], ['full', 'Full'], ['lugn', 'Lugn'], ['av', 'Av']])}</div>
      <div class="setrow"><div class="lbl">Textstorlek</div>${seg('size', [['normal', 'Normal'], ['stor', 'Stor'], ['xstor', 'Extra stor']])}</div>
      <div class="setrow"><div class="lbl">Spelikoner</div>${seg('icons', [['ritade', 'Ritade'], ['emoji', 'Emoji']])}</div>
      <div class="setrow"><div class="lbl">🎲 Dina tärningar</div><div class="sty-dice">${Object.entries(DICE).map(([k, l]) => `<button class="dice-${k} ${s.dice === k ? 'on' : ''}" data-act="styset" data-k="dice" data-v="${k}"><span class="die idle"><span class="face">${[0, 2, 4, 6, 8].map(i => '<i class="on" style="grid-area:' + (1 + Math.floor(i / 3)) + '/' + (1 + i % 3) + '"></i>').join('')}</span></span><small>${l}</small></button>`).join('')}</div><div class="setnote">Yatzy och Fia.</div></div>
      ${typeof SOL_THEMES !== 'undefined' && typeof backSVG === 'function' ? `<div class="setrow"><div class="lbl">🃏 Din kortlek</div><div class="sty-deck">${Object.entries(SOL_THEMES).map(([k, t]) => `<button class="${(typeof solTheme !== 'undefined' && solTheme === k) ? 'on' : ''}" data-act="stydeck" data-v="${k}"><span class="mini-back" style="background-image:${backSVG(k)}"></span><small>${t.label}</small></button>`).join('')}</div><div class="setnote">Baksidan i alla kortspel – Patiens, Vändtia, Finns i sjön och Hjärter.</div></div>` : ''}
      <div class="btns"><button class="ghost" data-act="styrnd">🎲 Överraska mig</button><button class="ghost" data-act="settings">Tillbaka</button><button data-act="close">Klar</button></div>`);
  }
  function act(a, b) {
    if (a === 'styopen') { show(); return true; }
    if (a === 'styset') { set(b.dataset.k, b.dataset.v); if (typeof render === 'function') render(); show(); buzz(6); return true; }
    if (a === 'stydeck') { try { solTheme = b.dataset.v; lsSet('ry_soltheme', solTheme); if (typeof solRetheme === 'function' && typeof S !== 'undefined' && S) solRetheme(); } catch (e) {} apply(); show(); buzz(6); return true; }
    if (a === 'styrnd') { const ws = Object.keys(WORLDS), as = Object.keys(ACCENTS); const s = get(); s.world = ws[Math.floor(Math.random() * ws.length)]; s.acc = as[Math.floor(Math.random() * as.length)]; lsSet('style', JSON.stringify(s)); apply(); if (typeof render === 'function') render(); show(); return true; }
    return false;
  }
  apply(); setTimeout(() => { try { if (typeof render === 'function') render(); } catch (e) {} }, 0);
  return { apply, get, set, show, act, icon, motif, decorateTile, gameCtx, gradOf, ICONS, WORLDS };
})();
