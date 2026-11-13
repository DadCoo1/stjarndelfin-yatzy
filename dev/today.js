/* ---------- Idag: dagsform, hälsning, startsidans kort, dagens kod, akvariet och ljudlandskap ----------
   Dagsformen är ett val – aldrig ett krav. Den kan döljas helt under ⚙️, då blir startsidan neutral. */
const TODAY = (() => {
  const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const J = (k, d) => { try { const v = JSON.parse(lsGet(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const P = (k, v) => lsSet(k, JSON.stringify(v));
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const myName = () => { let n = ''; try { n = (typeof CHAT !== 'undefined' && CHAT.myName && CHAT.myName()) || ''; } catch (e) {} return (lsGet('ry_name') || n || '').trim().split(/\s+/)[0].slice(0, 16); };

  /* ---------- dagsform ---------- */
  const MOODS = {
    sofa: { ic: '🛋️', lab: 'Lugn dag' },
    ok:   { ic: '🙂', lab: 'Helt okej' },
    go:   { ic: '⚡', lab: 'Full fart' }
  };
  const showMood = () => lsGet('mood_show') !== '0';
  const sofaAuto = () => lsGet('mood_sofa') !== '0';
  const mood = () => { const m = J('mood', null); return m && m.d === day() && MOODS[m.m] ? m.m : null; };
  function setMood(m) {
    P('mood', { m, d: day() }); lsSet('greet_n', '0');
    const hist = J('mood_hist', {}); hist[day()] = m; const ks = Object.keys(hist).sort(); while (ks.length > 60) delete hist[ks.shift()]; P('mood_hist', hist);
    applySofa(); repaint(true);
    if (m === 'sofa') toast('🛋️ Lugnt läge: dämpat, tyst och inga måsten', 3200);
    if (m === 'go') { try { celebrate && celebrate('⚡ FULL FART!'); } catch (e) {} }
  }
  function applySofa() {
    const on = showMood() && sofaAuto() && mood() === 'sofa';
    document.body.classList.toggle('sofa', on);
    try { SND.duck(on); } catch (e) {}
  }

  /* ---------- hälsningar: omtanke, pepp, coachning och lite ironi ---------- */
  const TOD = () => { const h = new Date().getHours(); return h < 5 ? 'natt' : h < 10 ? 'morgon' : h < 17 ? 'dag' : h < 22 ? 'kväll' : 'sent'; };
  const HI = { natt: 'Hej nattuggla', morgon: 'God morgon', dag: 'Hej', kväll: 'God kväll', sent: 'Hej' };
  const G = {
    ask: [
      'Hur är formen idag, {n}?', 'Vad säger kroppen idag, {n}?', 'Vilket läge kör vi idag?', 'Dagens energinivå, {n}?'
    ],
    sofa: [ // omtanke
      'Soffdag. Filten är din bästa lagkamrat idag 🛋️', 'Idag får allt gå i slowmotion. Delfinen håller dig sällskap 🐬',
      'Inget måste idag. Allt får. Te i handen? 🍵', 'Vila är också träning – fråga vilken proffsatlet som helst.',
      'Lugnt och skönt. Akvariet är öppet hela dagen 🐠', 'Du behöver inte vinna något idag. Bara mysa.',
      // ironi
      'Officiell soffpotatislicens: beviljad ✅', 'Rekordförsök i att ligga still pågår. Det går strålande.',
      'Soffan har ringt. Den säger att den saknat dig.'
    ],
    ok: [ // coachning
      'Lagom pigg – perfekt läge för en snabb runda Yatzy 🎲', 'Ett spel, en kompis, en kopp. Bra plan.',
      'Dagens uppdrag: knäck dagens kod på färre försök än igår 🔐', 'Lite energi? Kör ett lugnt varv i Sommarvägen och slå ditt spöke 👻',
      'Kolla vem som är online – någon kanske vill spela.', 'Små steg. Ett parti i taget.',
      'Tips från coachen: drick vatten, sen schack.'
    ],
    go: [ // pepp och utmaning
      'FULL FART! Någon måste ju slå rekordet idag 🚀', 'Energin är tillbaka – dags att bli lite farlig 😎',
      'Vem vågar utmana dig idag? Skicka en inbjudan och visa.', 'Idag är en bra dag att vinna. Typ allt.',
      'Topplistan darrar redan.', 'Spöket i Sommarvägen har inte en chans.',
      'Försiktigt, du kan råka vinna allt.'
    ],
    plain: [ // när dagsformen är dold
      'Vad blir det idag?', 'Spelsugen? 🎲', 'Dags för något roligt.', 'Delfinen har väntat på dig 🐬', 'Välkommen tillbaka!',
      'Vem utmanar du idag?', 'Ett parti bara. Kanske två.'
    ]
  };
  function greeting() {
    const n = myName(), m = mood(), pool = !showMood() ? G.plain : m ? G[m] : G.ask;
    const k = +(lsGet('greet_n') || 0), R = rnd(hash(day() + (m || 'x') + 'g') + k);
    const line = pool[Math.floor(R() * pool.length)].replace('{n}', n || 'kompis').replace(', kompis?', '?');
    const hi = `${HI[TOD()]}${n ? ' ' + n : ''}!`;
    return { hi, line };
  }
  function heroHTML() {
    const g = greeting(), m = mood();
    const chips = showMood() ? `<div class="mood-row">${Object.entries(MOODS).map(([k, v]) => `<button class="mood-chip ${m === k ? 'on' : ''}" data-act="mood" data-m="${k}" aria-pressed="${m === k}"><i>${v.ic}</i>${v.lab}</button>`).join('')}</div>` : '';
    return `<div class="today-hero"><button class="greet" data-act="greet" title="Tryck för en ny hälsning"><b>${esc(g.hi)}</b><span>${esc(g.line)}</span></button>${chips}</div>`;
  }

  /* ---------- startsidans kort ---------- */
  function cardsHTML() {
    const m = showMood() ? mood() : null, cards = [];
    const c = (act, ic, t, s, cls, extra) => `<button class="tcard ${cls || ''}" data-act="${act}" ${extra || ''}><i>${ic}</i><b>${t}</b><small>${s}</small></button>`;
    let unread = 0, online = 0; try { unread = CHAT.unread(); online = CHAT.onlineCount(); } catch (e) {}
    const sg = typeof sgCount === 'function' ? sgCount() : 0;
    const d = DAILY.status(), aq = AQ.status(), snd = SND.playing();
    const calm = [
      c('aqopen', '🐬', esc(aq.name), aq.line, 'calm'),
      c('sndopen', snd ? SND.icon(snd) : '🌧️', snd ? SND.active().map(SND.label).join(' + ') : 'Ljudlandskap', snd ? 'Spelar · tryck för att ändra' : 'Regn, åska, vågor, bäck, vind, brasa…', 'calm' + (snd ? ' live' : ''))
    ];
    const social = [];
    if (sg) social.push(c('sgopen', '🎲', `${sg} pågående`, 'Fortsätt där du var', 'hot'));
    if (unread) social.push(c('openchat', '💬', `${unread} nya`, unread === 1 ? 'meddelande' : 'meddelanden', 'hot'));
    if (online) social.push(c('openchat', '🟢', `${online} online`, online === 1 ? 'kompis vill kanske spela' : 'kompisar – vill någon spela?'));
    try { const pi = PINS.cardInfo(); if (pi) social.push(c('pinsopen', pi.ic, `${pi.n} ${pi.word}`, esc(pi.line), 'pins')); } catch (e) {}
    social.push(c('dailyopen', d.done ? (d.ok ? '✅' : '🔐') : '🔐', 'Dagens kod', d.line, d.done ? '' : 'new'));
    if (m === 'sofa') cards.push(...calm, ...social); else cards.push(...social, ...calm);
    try { if (!BK.last() && ((typeof CHAT !== 'undefined' && CHAT.call.myId()) || sg)) cards.push(c('bkopen', '💾', 'Säkra dina saker', 'Kopia om telefonen försvinner', 'tip')); } catch (e) {}
    return cards.join('');
  }
  function todayHTML() { return `<h2 class="sec"><span class="leopill"><i>☀️</i>Idag</span></h2><div class="trow" id="todayRow">${cardsHTML()}</div>`; }
  function repaint(hero) {
    const r = document.getElementById('todayRow'); if (r) r.innerHTML = cardsHTML();
    if (hero) { const h = document.querySelector('.today-hero'); if (h) h.outerHTML = heroHTML(); }
  }
  setInterval(() => { if (!document.hidden) repaint(false); }, 15000);
  window.addEventListener('fl-share', () => repaint(false));

  /* ---------- dagens kod: samma kod för alla, varje dag ---------- */
  const DAILY = (() => {
    const COLS = [['#ef4444', 'röd'], ['#f59e0b', 'orange'], ['#facc15', 'gul'], ['#22c55e', 'grön'], ['#3b82f6', 'blå'], ['#a855f7', 'lila']];
    const LEN = 4, MAX = 8;
    const code = d => { const R = rnd(hash('fl-dagens-kod|' + d)); return Array.from({ length: LEN }, () => Math.floor(R() * COLS.length)); };
    const load = d => J('daily_' + d, { g: [], done: false, ok: false, t0: 0, ms: 0 });
    const save = (d, s) => { P('daily_' + d, s); };
    let cur = [];
    function score(g, c) { let b = 0, w = 0; const cc = {}, gc = {}; g.forEach((x, i) => { if (x === c[i]) b++; else { cc[c[i]] = (cc[c[i]] || 0) + 1; gc[x] = (gc[x] || 0) + 1; } }); for (const k in gc) w += Math.min(gc[k], cc[k] || 0); return [b, w]; }
    function status() {
      const d = day(), s = load(d), fr = friends(d);
      const done7 = Array.from({ length: 7 }, (_, i) => { const t = new Date(); t.setDate(t.getDate() - i); return load(day(t)).ok ? 1 : 0; }).reduce((a, b) => a + b, 0);
      const line = s.done ? (s.ok ? `Löst på ${s.g.length}${fr.length ? ` · ${fr.length} kompis${fr.length > 1 ? 'ar' : ''} med` : ''}` : 'Klurig idag! Ny kod imorgon') : (s.g.length ? `${s.g.length} av ${MAX} försök` : fr.length ? `${fr.length} kompis${fr.length > 1 ? 'ar har' : ' har'} redan spelat` : 'Ny kod idag – klarar du den?');
      return { done: s.done, ok: s.ok, line, done7 };
    }
    function friends(d) { try { return CHAT.daily(d) || []; } catch (e) { return []; } }
    const peg = (i, sz) => `<span class="dk-peg" style="--c:${COLS[i][0]};${sz ? `width:${sz}px;height:${sz}px` : ''}" aria-label="${COLS[i][1]}"></span>`;
    const fmtMs = ms => { const s = Math.round(ms / 1000); return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s'; };
    function board() {
      const d = day(), s = load(d), c = code(d);
      const rows = s.g.map(g => { const [b, w] = score(g, c); return `<div class="dk-row"><div class="dk-g">${g.map(x => peg(x)).join('')}</div><div class="dk-fb" aria-label="${b} rätt plats, ${w} rätt färg">${'<i class="b"></i>'.repeat(b)}${'<i class="w"></i>'.repeat(w)}${'<i></i>'.repeat(LEN - b - w)}</div></div>`; }).join('');
      const left = MAX - s.g.length;
      const input = s.done ? '' : `<div class="dk-row cur"><div class="dk-g">${Array.from({ length: LEN }, (_, i) => cur[i] != null ? `<button class="dk-slot" data-act="dkdel" data-i="${i}">${peg(cur[i])}</button>` : `<span class="dk-slot empty"></span>`).join('')}</div><div class="dk-fb"></div></div>
        <div class="dk-pick">${COLS.map((_, i) => `<button data-act="dkpick" data-i="${i}" aria-label="${COLS[i][1]}">${peg(i, 40)}</button>`).join('')}</div>
        <div class="btns"><button class="ghost" data-act="dkclr">Rensa</button><button data-act="dkgo" ${cur.filter(x => x != null).length < LEN ? 'disabled' : ''}>Gissa (${left} kvar)</button></div>`;
      const fr = friends(d).concat(s.done ? [{ name: 'Du', emoji: '⭐', tries: s.g.length, ok: s.ok, ms: s.ms, me: true }] : [])
        .sort((a, b) => (b.ok - a.ok) || (a.tries - b.tries) || (a.ms - b.ms));
      const lb = fr.length ? `<div class="dk-lb"><div class="dk-lbh">🏆 Dagens topplista bland kompisar</div>${fr.map((r, i) => `<div class="${r.me ? 'me' : ''}"><span>${i + 1}.</span><b>${esc(r.emoji || '')} ${esc(r.name)}</b><em>${r.ok ? r.tries + ' försök' : '–'}</em><i>${r.ok ? fmtMs(r.ms) : ''}</i></div>`).join('')}</div>`
        : `<div class="setnote" style="text-align:center">När dina kompisar spelar dagens kod syns de här.</div>`;
      const st = status();
      const res = s.done ? `<div class="dk-res">${s.ok ? `🎉 <b>Knäckt på ${s.g.length} försök</b> (${fmtMs(s.ms)})` : `Koden var ${c.map(x => peg(x, 22)).join('')} – ny chans imorgon!`}<small>Löst ${st.done7} av de senaste 7 dagarna · vilodagar räknas inte bort</small></div>` : '';
      return `<h3>🔐 Dagens kod</h3><div class="setnote" style="margin:-6px 0 10px">Samma hemliga kod för alla idag. ⚫ = rätt färg på rätt plats · ⚪ = rätt färg, fel plats. Färger kan finnas flera gånger.</div>
        <div class="dk">${rows}${input}</div>${res}${lb}${s.done ? `<div class="btns"><button data-act="close">Klar</button></div>` : ''}`;
    }
    function open() { cur = []; const s = load(day()); if (!s.t0 && !s.done) { s.t0 = Date.now(); save(day(), s); } openModal(board(), 'daily'); }
    function redraw() { const m = document.getElementById('modal'); if (m && m.classList.contains('show')) { openModal(board(), 'daily'); } }
    function act(a, b) {
      const d = day(), s = load(d);
      if (a === 'dailyopen') { open(); return true; }
      if (s.done && a !== 'dailyopen') return false;
      if (a === 'dkpick') { const i = cur.findIndex(x => x == null); if (cur.length < LEN || i >= 0) { if (i >= 0) cur[i] = +b.dataset.i; else cur.push(+b.dataset.i); } buzz(8); redraw(); return true; }
      if (a === 'dkdel') { cur[+b.dataset.i] = null; redraw(); return true; }
      if (a === 'dkclr') { cur = []; redraw(); return true; }
      if (a === 'dkgo') {
        if (cur.filter(x => x != null).length < LEN) return true;
        s.g.push(cur.slice(0, LEN)); cur = [];
        const [bk] = score(s.g[s.g.length - 1], code(d));
        if (bk === LEN || s.g.length >= MAX) {
          s.done = true; s.ok = bk === LEN; s.ms = Date.now() - (s.t0 || Date.now());
          if (s.ok) { try { celebrate('KNÄCKT! 🔓'); } catch (e) {} buzz([30, 40, 80]); }
          try { CHAT.share('daily', { day: d, tries: s.g.length, ok: s.ok, ms: s.ms }); } catch (e) {}
        } else buzz(15);
        save(d, s); redraw(); repaint(false); return true;
      }
      return false;
    }
    return { status, act, open, code, score, _load: load };
  })();

  /* ---------- ljudlandskap (skapas i telefonen, inga ljudfiler) ---------- */
  const SND = (() => {
    /* Ljudlandskapen byggs i enheten, i lager som i naturen (inga inspelningar – inget laddas ned):
       • rosa och brunt brus i långa stereoslingor som skarvas osynligt
       • tusentals små ljudkorn som räknas ut i förväg: regndroppar, gnistor i brasan, bubblor som stiger i ton
       • händelser som kommer oregelbundet: vågor som byggs upp, bryter och drar sig tillbaka med fräsande skum,
         åskknallar på olika avstånd med långt muller, vindbyar som tjuter, vedträn som smäller
       • ett rum (efterklang) och långsam, slumpad rörelse så att inget låter som en kort slinga */
    const KINDS = { rain: ['🌧️', 'Regn'], thunder: ['🌩️', 'Åska'], shore: ['🏖️', 'Vågor'], sea: ['🌊', 'Hav'], brook: ['🏞️', 'Bäck'], wind: ['🌬️', 'Vind'], fjall: ['🏔️', 'Fjällvind'], fire: ['🔥', 'Brasa'], bub: ['🫧', 'Bubblor'] };
    let ac = null, out = null, conv = null, an = null, live = {}, cur = null, stopAt = 0, watchT = 0, vol = +(lsGet('snd_vol') || .6), ducked = false;
    const BUF = {}, R = (a, b) => a + Math.random() * (b - a);
    function ctx() {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .012; comp.release.value = .35;
        out = ac.createGain(); out.gain.value = 0; out.connect(comp); comp.connect(ac.destination);
        an = ac.createAnalyser(); an.fftSize = 2048; comp.connect(an);
        conv = ac.createConvolver(); conv.buffer = impulse(3.4); conv.connect(out);
      }
      ac.resume && ac.resume(); return ac;
    }
    // efterklang: brus som klingar av och blir mörkare
    function impulse(sec) { const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n, k = .5 - .42 * t; lp += ((Math.random() * 2 - 1) - lp) * k; d[i] = lp * Math.pow(1 - t, 2.6) * (i < 400 ? i / 400 : 1); } }
      return b; }
    // brus i stereo som går runt utan hörbar skarv
    function noise(color, sec) {
      const key = color + sec; if (BUF[key]) return BUF[key];
      const sr = ac.sampleRate, n = Math.floor(sr * sec), fade = Math.floor(sr * .6), b = ac.createBuffer(2, n, sr), tmp = new Float32Array(n + fade);
      for (let ch = 0; ch < 2; ch++) {
        let b0 = 0, b1 = 0, b2 = 0, last = 0;
        for (let i = 0; i < n + fade; i++) { const w = Math.random() * 2 - 1;
          if (color === 'pink') { b0 = .99765 * b0 + w * .0990460; b1 = .96300 * b1 + w * .2965164; b2 = .57000 * b2 + w * 1.0526913; tmp[i] = (b0 + b1 + b2 + w * .1848) * .22; }
          else if (color === 'brown') { last = (last + .02 * w) / 1.02; tmp[i] = last * 3.5; } else tmp[i] = w * .6; }
        const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = tmp[i];
        for (let i = 0; i < fade; i++) { const t = i / fade; d[i] = tmp[i] * Math.sqrt(t) + tmp[n + i] * Math.sqrt(1 - t); }
      }
      return BUF[key] = b;
    }
    // en slinga av små ljudkorn; add(sample, pos, pan) lägger ett korn runt skarven så att slingan blir sömlös
    function grains(key, sec, make) {
      if (BUF[key]) return BUF[key];
      const sr = ac.sampleRate, n = Math.floor(sr * sec), b = ac.createBuffer(2, n, sr), L = b.getChannelData(0), Rr = b.getChannelData(1);
      make((pos, len, pan, fn) => { const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4); let p = Math.floor(pos * sr) % n; for (let k = 0; k < len; k++) { const v = fn(k); L[p] += v * gl; Rr[p] += v * gr; if (++p >= n) p = 0; } }, sr, sec);
      return BUF[key] = b;
    }
    const rainBuf = () => grains('rain', 9, (add, sr, sec) => {
      for (let i = 0; i < sec * 520; i++) { const a = Math.pow(Math.random(), 3) * .34 + .012, f = R(1800, 7500), tau = sr * R(.0006, .003), len = Math.floor(tau * 6), w = 2 * Math.PI * f / sr, ph = Math.random() * 6;
        add(Math.random() * sec, len, R(-1, 1), k => (Math.sin(ph + w * k) * .55 + (Math.random() * 2 - 1) * .6) * Math.exp(-k / tau) * a); }
      // större droppar som slår mot något: lägre, med en kort ton
      for (let i = 0; i < sec * 14; i++) { const a = R(.08, .3), f = R(500, 1500), tau = sr * R(.004, .012), len = Math.floor(tau * 6), w = 2 * Math.PI * f / sr;
        add(Math.random() * sec, len, R(-.9, .9), k => (Math.sin(w * k * (1 - k / len * .25)) * .8 + (k < 40 ? (Math.random() * 2 - 1) : 0)) * Math.exp(-k / tau) * a); } });
    const crackBuf = () => grains('crack', 11, (add, sr, sec) => {
      for (let i = 0; i < sec * 9; i++) { const t = Math.random() * sec, m = Math.random() < .3 ? 1 + Math.floor(Math.random() * 4) : 1, a0 = Math.pow(Math.random(), 3) * .8 + .04, pan = R(-.7, .7);
        for (let j = 0; j < m; j++) { const tau = sr * R(.0004, .0028), len = Math.floor(tau * 7) + 8, a = a0 * (j ? R(.3, .8) : 1); let lp = 0, kk = R(.15, .6);
          add(t + j * R(.006, .05), len, pan, k => { lp += ((Math.random() * 2 - 1) - lp) * kk; return lp * Math.exp(-k / tau) * a; }); } } });
    const bubBuf = () => grains('bub', 13, (add, sr, sec) => {
      const one = (t, f0, a, pan) => { const dur = Math.min(.16, 40 / f0 + .02), len = Math.floor(sr * dur), rise = R(1.15, 1.55), tau = len / 4; let ph = 0;
        add(t, len, pan, k => { ph += 2 * Math.PI * f0 * (1 + (rise - 1) * k / len) / sr; return Math.sin(ph) * Math.min(1, k / (sr * .003)) * Math.exp(-k / tau) * a; }); };
      for (let i = 0; i < sec * 1.3; i++) { let t = Math.random() * sec, f = R(350, 1100); const m = 2 + Math.floor(Math.random() * 9), pan = R(-.8, .8);
        for (let j = 0; j < m; j++) { one(t, f, R(.06, .2) * (700 / (f + 300)), pan + R(-.15, .15)); t += R(.03, .11); f *= R(1.02, 1.22); } }
      for (let i = 0; i < sec * 3; i++) one(Math.random() * sec, R(900, 2600), R(.01, .05), R(-1, 1)); });
    const brookBuf = () => grains('brook', 12, (add, sr, sec) => {
      for (let i = 0; i < sec * 46; i++) { const f0 = R(450, 2600), up = Math.random() < .6 ? R(1.1, 1.7) : R(.7, .95), dur = R(.018, .075), len = Math.floor(sr * dur), a = Math.pow(Math.random(), 2) * .11 + .012, tau = len / 3.2; let ph = 0;
        add(Math.random() * sec, len, R(-.9, .9), k => { ph += 2 * Math.PI * f0 * (1 + (up - 1) * k / len) / sr; return Math.sin(ph) * Math.min(1, k / (sr * .002)) * Math.exp(-k / tau) * a; }); }
      for (let i = 0; i < sec * 2.2; i++) { let t = Math.random() * sec, f = R(380, 900); const m = 3 + Math.floor(Math.random() * 6), pan = R(-.7, .7);      // kluck-kluck-kluck
        for (let j = 0; j < m; j++) { const len = Math.floor(sr * R(.03, .06)), f0 = f, tau = len / 3; let ph = 0; add(t, len, pan, k => { ph += 2 * Math.PI * f0 * (1 + .5 * k / len) / sr; return Math.sin(ph) * Math.min(1, k / 90) * Math.exp(-k / tau) * .1; }); t += R(.04, .09); f *= R(.95, 1.15); } } });
    const fizzBuf = () => grains('fizz', 7, (add, sr, sec) => { for (let i = 0; i < sec * 1500; i++) { const a = Math.pow(Math.random(), 2) * .2, len = 6 + Math.floor(Math.random() * 20); add(Math.random() * sec, len, R(-1, 1), k => (Math.random() * 2 - 1) * (1 - k / len) * a); } });

    /* ---------- byggstenar ---------- */
    // flera landskap kan spela samtidigt: "cur" är det landskap som just nu bygger eller schemalägger ljud
    const later = (fn, ms) => { const S = cur; if (!S) return; S.timers.push(setTimeout(() => { if (!S.alive) return; cur = S; try { fn(); } catch (e) {} }, ms)); };
    // inspelade ljud (snd/*.m4a), hämtas en gång och sparas i minnet; misslyckas hämtningen används det syntetiska ljudet
    const SAMP = {};
    const sample = name => SAMP[name] || (SAMP[name] = fetch(location.pathname.replace(/[^/]*$/, '') + 'snd/' + name + '.m4a').then(r => { if (!r.ok) throw new Error('ljud ' + r.status); return r.arrayBuffer(); })
      .then(a => new Promise((res, rej) => ac.decodeAudioData(a, res, rej))).catch(e => { delete SAMP[name]; throw e; }));
    function loopSample(S, name, g, fallback) { sample(name).then(buf => { if (!S.alive) return;
        // hoppa över eventuell tystnad som avkodaren lagt till i början och slutet, så att loopen blir sömlös
        const d = buf.getChannelData(0), n = d.length; let a = 0, b = n - 1; while (a < Math.min(n, 8192) && Math.abs(d[a]) < 1e-4) a++; while (b > n - 8192 && Math.abs(d[b]) < 1e-4) b--;
        const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = a / buf.sampleRate; s.loopEnd = (b + 1) / buf.sampleRate; s.start(0, s.loopStart + Math.random() * (s.loopEnd - s.loopStart) * .9); S.srcs.push(s); s.connect(g);
      }).catch(e => { if (S.alive && fallback) { console.warn('inspelat ljud saknas, syntetiskt används', e); const c = cur; cur = S; try { fallback(); } finally { cur = c; } } }); }
    function src(buf, loop, S) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = loop !== false; s.start(0, Math.random() * buf.duration); (S || cur).srcs.push(s); return s; }
    function filt(type, f, q) { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q) x.Q.value = q; return x; }
    function gain(v) { const g = ac.createGain(); g.gain.value = v; return g; }
    function pan(v) { if (!ac.createStereoPanner) return gain(1); const p = ac.createStereoPanner(); p.pan.value = v; return p; }
    const link = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
    // långsam slumpad rörelse hos ett värde (styrka, klang)
    function wander(param, lo, hi, t0, t1) { const go = () => { const d = R(t0, t1); param.setTargetAtTime(R(lo, hi), ac.currentTime, d / 3); later(go, d * 1000); }; go(); }

    /* ---------- landskapen ---------- */
    function rainLayers(S, k) {
      const mix = gain(k); mix.connect(S.dry); mix.connect(S.wet);
      link(src(noise('pink', 10)), filt('highpass', 1200), filt('lowpass', 7000), gain(.2), mix);       // det jämna suset
      link(src(rainBuf()), filt('highpass', 1100), gain(1.15), mix);                                      // tusentals droppar
      link(src(noise('brown', 8)), filt('lowpass', 190), gain(.07), mix);                               // dovt mot tak och mark
      wander(mix.gain, k * .8, k * 1.15, 3, 7);
      const drip = () => { const t = ac.currentTime, o = ac.createOscillator(), g = gain(0), f = R(700, 1700); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .55, t + .06);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(R(.015, .05) * k, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + R(.05, .12)); link(o, g, pan(R(-.8, .8)), mix); o.start(t); o.stop(t + .2); later(drip, R(180, 1300)); };
      later(drip, 600);
    }
    function strike(S, near) {
      S = S || cur; if (!S) return; cur = S; const t = ac.currentTime + .05, dist = near != null ? near : Math.pow(Math.random(), .7), dur = R(5, 8) + dist * 4, pk = .95 - dist * .6;
      // mullret: brunt brus som rullar i flera omgångar och blir allt dovare
      const f = filt('lowpass', 1000 - dist * 780), g = gain(0), s = src(noise('brown', 8), true, S), sub = filt('lowpass', 85), gs = gain(0);
      f.frequency.setValueAtTime(1000 - dist * 780, t); f.frequency.exponentialRampToValueAtTime(70, t + dur);
      g.gain.setValueAtTime(0, t); gs.gain.setValueAtTime(0, t);
      let tt = t + (dist < .5 ? .02 : .5), lvl = pk; const rolls = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < rolls; i++) { g.gain.linearRampToValueAtTime(lvl * R(.75, 1), tt + R(.04, .25)); gs.gain.linearRampToValueAtTime(lvl * 1.3, tt + .2); tt += R(.35, 1.1); g.gain.linearRampToValueAtTime(lvl * R(.25, .5), tt); lvl *= R(.55, .85); }
      g.gain.linearRampToValueAtTime(0, t + dur); gs.gain.linearRampToValueAtTime(0, t + dur);
      link(s, f, g); g.connect(S.dry); const wg = gain(1.4); g.connect(wg); wg.connect(conv); link(s, sub, gs, S.dry);
      // knallen (bara när åskan är nära): några snabba, skarpa smällar
      if (dist < .55) { const c = src(noise('white', 2), true, S), bp = filt('bandpass', R(1200, 2800), .6), cg = gain(0), a = (1 - dist / .55) * .8; let ct = t;
        cg.gain.setValueAtTime(0, t); for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) { cg.gain.linearRampToValueAtTime(a * R(.5, 1), ct + .004); ct += R(.05, .14); cg.gain.exponentialRampToValueAtTime(.004, ct); }
        cg.gain.linearRampToValueAtTime(0, ct + .3); link(c, bp, cg); cg.connect(S.dry); cg.connect(conv); later(() => { try { c.stop(); } catch (e) {} }, 3000); }
      later(() => { try { s.stop(); } catch (e) {} }, dur * 1000 + 500);
    }
    function wave(S, big) {
      S = S || cur; if (!S) return; cur = S; const t = ac.currentTime + .05, B = R(1.6, 3), W = R(4.5, 7), P = (big || R(.5, 1)) * .62, p0 = R(-.6, .6), pn = pan(p0); pn.connect(S.dry); pn.connect(S.wet);
      if (pn.pan) pn.pan.linearRampToValueAtTime(clampP(p0 + R(-.7, .7)), t + B + W);
      // vågen reser sig (dovt, allt ljusare), bryter och rinner ut
      const s = src(noise('pink', 10), true, S), f = filt('lowpass', 220), g = gain(0);
      f.frequency.setValueAtTime(220, t); f.frequency.exponentialRampToValueAtTime(R(2600, 5200), t + B); f.frequency.exponentialRampToValueAtTime(500, t + B + W);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(P * .12, t + B * .75); g.gain.linearRampToValueAtTime(P * 1.25, t + B); g.gain.exponentialRampToValueAtTime(P * .3, t + B + 1.1); g.gain.linearRampToValueAtTime(0, t + B + W);
      link(s, f, g, pn);
      // dunsen när den slår i
      const th = src(noise('brown', 8), true, S), tf = filt('lowpass', 130), tg = gain(0); tg.gain.setValueAtTime(0, t + B - .15); tg.gain.linearRampToValueAtTime(P * 2.2, t + B + .04); tg.gain.exponentialRampToValueAtTime(.001, t + B + 1.5);
      // själva brottet: ett brett, kort dån när vågen slår i stranden
      const cb = src(noise('white', 2), true, S), cf = filt('lowpass', 5200), cg = gain(0); cg.gain.setValueAtTime(0, t + B - .08); cg.gain.linearRampToValueAtTime(P * .75, t + B + .03); cg.gain.exponentialRampToValueAtTime(.001, t + B + .9); link(cb, cf, cg, pn); later(() => { try { cb.stop(); } catch (e) {} }, (B + 2) * 1000); link(th, tf, tg, pn);
      // skummet: ljust fräs som dröjer kvar och drar sig tillbaka över sanden
      const fz = src(fizzBuf(), true, S), w2 = src(noise('white', 2), true, S), hf = filt('highpass', 3200), fg = gain(0);
      fg.gain.setValueAtTime(0, t + B - .4); fg.gain.linearRampToValueAtTime(P * .5, t + B + .5); fg.gain.exponentialRampToValueAtTime(P * .12, t + B + W * .55); fg.gain.linearRampToValueAtTime(0, t + B + W);
      hf.frequency.setValueAtTime(2600, t + B); hf.frequency.linearRampToValueAtTime(6000, t + B + W);
      fz.connect(hf); link(w2, gain(.18), hf); link(hf, fg, pn);
      later(() => { for (const x of [s, th, fz, w2]) try { x.stop(); } catch (e) {} try { pn.disconnect(); } catch (e) {} }, (B + W) * 1000 + 600);
    }
    const clampP = v => Math.max(-1, Math.min(1, v));
    function whistle(S, f0, f1, q, g1) { const f = filt('bandpass', f0, q), g = gain(0), p = pan(R(-.6, .6)); link(src(noise('pink', 10)), f, g, p, S.dry); p.connect(S.wet); return { f, g, f0, f1, g1 }; }
    const SCENES = {
      rain(S) { rainLayers(S, .5); },
      // bara åskan: knallar och muller på olika avstånd, ibland två tätt efter varandra, ibland bara ett långt rullande långt borta
      thunder(S) { const loop = () => { const k = Math.random(); if (k < .3) strike(S, R(.75, 1)); else if (k < .5) { strike(S, R(0, .3)); later(() => strike(S, R(.4, .9)), R(900, 2600)); } else strike(S);
          later(loop, R(7000, 22000)); }; later(loop, R(800, 2500)); },
      shore(S) { const loop = () => { wave(S); later(loop, R(5500, 9500)); }; later(loop, 200); later(() => wave(S, .45), 3200); },
      sea(S) { const a = gain(.2), fa = filt('lowpass', 480);
        link(src(noise('brown', 8)), fa, a, S.dry); wander(a.gain, .08, .3, 4, 8); wander(fa.frequency, 260, 800, 4, 8);
        const swell = () => { const t = ac.currentTime, g = gain(0), f = filt('bandpass', R(300, 650), .7), s = src(noise('pink', 10), true, S), d = R(5, 9); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(R(.12, .28), t + d * .45); g.gain.linearRampToValueAtTime(0, t + d);
          const p = pan(R(-.5, .5)); link(s, f, g, p, S.dry); p.connect(S.wet); later(() => { try { s.stop(); } catch (e) {} }, d * 1000 + 300); later(swell, R(4000, 8000)); }; later(swell, 800); },
      // porlande bäck: vatten som kluckar i toner (små luftfickor) över ett lätt brus som rör sig mellan stenarna
      // porlande bäck: riktig inspelning (CC0, se snd/LJUD-LICENS.txt); syntetisk bäck som reserv utan nät första gången
      brook(S) { const g = gain(.95), w = gain(.35); g.connect(S.dry); g.connect(w); w.connect(S.wet);
        loopSample(S, 'brook', g, () => { const b = gain(1.4); link(src(brookBuf(), true, S), filt('lowpass', 5200), b, S.dry); b.connect(S.wet); wander(b.gain, 1.1, 1.7, 3, 7);
          [[700, 1500, .035], [1500, 3200, .03]].forEach(([lo, hi, v]) => { const f = filt('bandpass', (lo + hi) / 2, 3.5), gg = gain(v), p = pan(R(-.6, .6)); link(src(noise('pink', 10), true, S), f, gg, p, S.dry); wander(f.frequency, lo, hi, .4, 1.6); wander(gg.gain, v * .5, v * 1.4, .5, 2); }); }); },
      wind(S) {
        const mk = (q, f0, f1, g0, g1, pv) => { const f = filt('bandpass', f0, q), g = gain(g0), p = pan(pv); link(src(noise('pink', 10)), f, g, p, S.dry); p.connect(S.wet); return { f, g, f0, f1, g0, g1 }; };
        const Ls = [mk(1.1, 190, 700, .06, .7, -.25), mk(2.4, 420, 1300, .01, .28, .35)];
        // vindbyar: styrka och ton följs åt, med stilla stunder emellan
        const gust = () => { const s = Math.pow(Math.random(), 1.4), d = R(1.6, 4.5), t = ac.currentTime;
          Ls.forEach(l => { l.f.frequency.setTargetAtTime(l.f0 + (l.f1 - l.f0) * Math.min(1, s * R(.8, 1.15)), t, d / 3); l.g.gain.setTargetAtTime(l.g0 + (l.g1 - l.g0) * Math.min(1, s * R(.8, 1.1)), t, d / 3); });
          later(gust, d * R(700, 1300)); }; gust(); },
      // vinande fjällvind: smala, tjutande toner som stiger och faller med byarna, över kalfjället
      fjall(S) { const body = gain(.05), bf = filt('bandpass', 300, 1); link(src(noise('pink', 10)), bf, body, S.dry);
        const Ws = [whistle(S, 520, 1250, 22, .5), whistle(S, 760, 1900, 30, .34), whistle(S, 1100, 2600, 34, .2)];
        const gust = () => { const s = Math.pow(Math.random(), 1.1), d = R(1.2, 4), t = ac.currentTime;
          body.gain.setTargetAtTime(.03 + s * .3, t, d / 3); bf.frequency.setTargetAtTime(240 + s * 520, t, d / 3);
          Ws.forEach((w, i) => { const k = Math.max(0, s - .15 - i * .18) / (.85 - i * .18) * R(.6, 1.1); w.f.frequency.setTargetAtTime(w.f0 + (w.f1 - w.f0) * Math.min(1, s * R(.7, 1.2)), t, d / 2.5); w.g.gain.setTargetAtTime(w.g1 * Math.min(1, k), t, d / 3); });
          later(gust, d * R(600, 1200)); }; gust(); },
      // lägereld i skogen: mjukt, varmt sprak i lugn takt, lågornas dova fladder och ett vedträ som knäpper till ibland
      fire(S) {
        const roar = gain(.1), fl = gain(.22); link(src(noise('brown', 8)), filt('lowpass', 260), roar, S.dry); link(src(noise('brown', 8)), filt('lowpass', 7), fl); fl.connect(roar.gain); wander(roar.gain, .07, .13, 3, 7);
        const cr = gain(1.4); link(src(crackBuf()), filt('highpass', 350), filt('lowpass', 5200), cr, S.dry); cr.connect(S.wet); wander(cr.gain, .9, 1.7, 2, 6);
        const pop = () => { const t = ac.currentTime, a = R(.1, .32), p = pan(R(-.5, .5)); p.connect(S.dry); p.connect(S.wet);
          const n = src(noise('white', 2), true, S), bp = filt('bandpass', R(350, 950), 2.5), g = gain(0); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(.0005, t + R(.03, .08)); link(n, bp, g, p);
          const o = ac.createOscillator(), og = gain(0); o.frequency.setValueAtTime(R(100, 150), t); o.frequency.exponentialRampToValueAtTime(55, t + .08); og.gain.setValueAtTime(a * .6, t); og.gain.exponentialRampToValueAtTime(.0005, t + .1); link(o, og, p); o.start(t); o.stop(t + .15);
          later(() => { try { n.stop(); } catch (e) {} try { p.disconnect(); } catch (e) {} }, 400); later(pop, R(1500, 7000)); }; later(pop, 1800); },
      bub(S) {
        const bed = gain(.07), fb = filt('lowpass', 220); link(src(noise('brown', 8)), fb, bed, S.dry); wander(bed.gain, .04, .09, 4, 8);
        const b = gain(1.2), lp = filt('lowpass', 3600); link(src(bubBuf()), lp, b, S.dry); const bw = gain(.5); b.connect(bw); bw.connect(conv); wander(b.gain, .8, 1.4, 3, 7);
        const glug = () => { const t = ac.currentTime, o = ac.createOscillator(), g = gain(0), f = R(140, 320), d = R(.12, .22); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * R(1.5, 2.2), t + d);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(R(.06, .14), t + .01); g.gain.exponentialRampToValueAtTime(.0005, t + d); link(o, g, pan(R(-.6, .6)), S.dry); g.connect(conv); o.start(t); o.stop(t + d + .05); later(glug, R(1500, 7000)); }; later(glug, 2000); }
    };
    const WET = { rain: .1, thunder: .25, shore: .14, sea: .18, brook: .05, wind: .1, fjall: .16, fire: .1, bub: .3 };
    const active = () => Object.keys(live);
    function play(kind, mins) {      // slår på ett landskap (flera kan vara på samtidigt)
      if (!SCENES[kind] || live[kind]) return; ctx();
      const S = live[kind] = { kind, dry: gain(0), wet: gain(WET[kind]), srcs: [], timers: [], alive: true }; S.dry.connect(out); S.wet.connect(conv);
      S.dry.gain.setValueAtTime(0, ac.currentTime); S.dry.gain.linearRampToValueAtTime(1, ac.currentTime + 2.5);
      out.gain.setTargetAtTime(level(), ac.currentTime, .1);
      cur = S; try { SCENES[kind](S); } catch (e) { console.warn('ljudlandskap', e); }
      if (mins != null) stopAt = mins ? Date.now() + mins * 60e3 : 0;
      clearInterval(watchT); watchT = setInterval(() => { if (stopAt && Date.now() > stopAt) { stop(); refreshBars(); } }, 1000);
      lsSet('snd_last', active().join(',')); repaint(false);
    }
    const level = () => vol * (ducked ? .6 : 1) / (1 + .18 * Math.max(0, active().length - 1));
    function stop(kind, quick) {       // utan namn: alla
      if (kind === true) { quick = true; kind = null; }
      const ks = kind ? [kind] : active();
      for (const k of ks) { const S = live[k]; if (!S) continue; delete live[k]; S.alive = false; S.timers.forEach(clearTimeout); if (cur === S) cur = null;
        const t = ac.currentTime, d = quick ? .2 : 2; S.dry.gain.cancelScheduledValues(t); S.dry.gain.setTargetAtTime(0, t, d / 4); S.wet.gain.setTargetAtTime(0, t, d / 4);
        setTimeout(() => { S.srcs.forEach(n => { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }); try { S.dry.disconnect(); S.wet.disconnect(); } catch (e) {} }, d * 1000 + 300); }
      if (!active().length) { clearInterval(watchT); stopAt = 0; } else if (ac) out.gain.setTargetAtTime(level(), ac.currentTime, .3);
      if (!quick) repaint(false);
    }
    function setVol(v) { vol = v; lsSet('snd_vol', String(v)); if (ac && active().length) out.gain.setTargetAtTime(level(), ac.currentTime, .2); }
    function duck(on) { ducked = on; if (ac && active().length) out.gain.setTargetAtTime(level(), ac.currentTime, .3); }
    const barHTML = () => `<div class="snd-bar">${Object.entries(KINDS).map(([k, [ic, lab]]) => `<button class="${live[k] ? 'on' : ''}" data-act="sndplay" data-k="${k}"><i>${ic}</i>${lab}</button>`).join('')}
      ${active().length ? `<button data-act="sndstop"><i>⏹️</i>Tyst</button>` : ''}</div>
      <div class="snd-opts"><label>🔈 <input type="range" min="0" max="1" step=".05" value="${vol}" data-snd="vol"></label>
      <span>Stäng av efter: ${[0, 15, 30, 60].map(m => `<button class="${(stopAt ? Math.round((stopAt - Date.now()) / 60e3) : 0) === m || (!stopAt && !m) ? 'on' : ''}" data-act="sndtimer" data-m="${m}">${m ? m + ' min' : '∞'}</button>`).join('')}</span></div>`;
    function show() { openModal(`<h3>🎧 Ljudlandskap</h3><div class="setnote" style="margin:-6px 0 10px">Välj ett eller flera ljud – till exempel brasa och bäck, eller åska och regn. Tryck igen för att stänga av ett ljud. Bäst i hörlurar.</div>${barHTML()}<div class="btns"><button data-act="close">Klar</button></div>`); bindVol(); }
    function bindVol() { document.querySelectorAll('[data-snd="vol"]').forEach(r => r.addEventListener('input', () => setVol(+r.value))); }
    function act(a, b) {
      if (a === 'sndopen') { show(); return true; }
      if (a === 'sndplay') { const k = b.dataset.k; if (live[k]) stop(k); else play(k); refreshBars(); return true; }
      if (a === 'sndstop') { stop(); refreshBars(); return true; }
      if (a === 'sndtimer') { const m = +b.dataset.m; stopAt = m ? Date.now() + m * 60e3 : 0; refreshBars(); return true; }
      return false;
    }
    function refreshBars() { document.querySelectorAll('.snd-host').forEach(h => { h.innerHTML = barHTML(); }); const m = document.querySelector('#modal .snd-bar'); if (m && !m.closest('.snd-host')) { show(); } bindVol(); }
    return { play, stop, act, duck, barHTML, bindVol, playing: () => active()[0] || null, active, icon: k => (KINDS[k] || KINDS.rain)[0], label: k => (KINDS[k] || KINDS.rain)[1], KINDS,
      _t: { strike: d => strike(live.thunder, d), wave: () => wave(live.shore, 1), an: () => an, ac: () => ac } };
  })();

  /* ---------- akvariet: stjärndelfinen som följeslagare ----------
     Den växer av omsorg (dagar du tittar in), blir aldrig sjuk och dör aldrig. Hungrig = den slumrar och drömmer. */
  const AQ = (() => {
    const DECOR = [
      [1, '⭐', 'en sjöstjärna'], [2, '🪸', 'en korall'], [3, '🐟', 'ett fiskstim'], [5, '🪼', 'lysmaneter'], [7, '🐚', 'en pärlsnäcka'], [10, '🌈', 'regnbågskorallen'], [14, '👑', 'en krona till delfinen']
    ];
    const get = () => { const a = J('aq', null); if (a) return a; const n = { name: 'Stella', born: Date.now(), fed: 0, food: .6, joy: .5, days: [], lvl: 0 }; P('aq', n); return n; };
    const put = a => P('aq', a);
    const careDays = a => (a.days || []).length;
    const food = a => Math.max(0, Math.min(1, (a.food || 0) - (Date.now() - (a.fedAt || a.born)) / (30 * 3600e3)));
    function touch(a) { const d = day(); a.days = a.days || []; if (!a.days.includes(d)) { a.days.push(d); if (a.days.length > 400) a.days.shift(); const got = DECOR.find(x => x[0] === careDays(a)); if (got) setTimeout(() => toast(`${got[1]} Akvariet fick ${got[2]}!`, 3500), 600); } }
    function status() {
      const a = get(), f = food(a), m = showMood() ? mood() : null;
      const line = f < .2 ? 'slumrar och drömmer om räkor 💤' : f < .5 ? 'tittar efter mat 🦐' : m === 'sofa' ? 'vilar med dig idag 💙' : a.joy > .7 ? 'är på strålande humör ✨' : 'simmar runt och väntar på dig';
      return { name: a.name, line, lvl: careDays(a) };
    }
    const LINES = {
      sofa: ['Vi tar det lugnt idag, du och jag.', 'Jag simmar lite långsammare idag. Du får gärna vila.', 'Ingen brådska. Havet väntar.'],
      ok: ['Hej igen! Har du fiskat upp några poäng idag?', 'Jag såg en kompis till dig simma förbi i chatten…', 'Mat? Bara en liten räka?'],
      go: ['Du ser pigg ut! Ska vi göra en volt? 🐬', 'Idag slår vi rekord. Jag hejar!', 'Jag hörde att spöket i Sommarvägen är nervöst.'],
      none: ['Hej! Jag har väntat på dig 🐬', 'Klappa mig så gör jag en volt!', 'Tryck i vattnet så släpper du ner mat.']
    };
    let rings = [], cv, g, raf = 0, W = 0, H = 0, DPR = 1, t0 = 0, D, food2 = [], hearts = [], bubbles = [], fish = [], jelly = [], said = '', saidT = 0, holdT = 0, holdXY = null, flip = 0, plants = [];
    function seedScene() {
      const R = rnd(hash('aq|' + (get().born || 1)));
      plants = Array.from({ length: 11 }, (_, i) => ({ x: (i + .2 + R() * .6) / 11, h: .1 + R() * .16, w: 9 + R() * 10, c: R() < .5 ? ['#0f766e', '#2dd4bf'] : ['#15803d', '#4ade80'], ph: R() * 6, n: 1 + Math.floor(R() * 3) }));
      fish = Array.from({ length: 9 }, () => ({ x: R(), y: .25 + R() * .4, v: (.02 + R() * .025) * (R() < .5 ? -1 : 1), s: .6 + R() * .5, c: ['#fbbf24', '#fb7185', '#38bdf8'][Math.floor(R() * 3)], ph: R() * 6 }));
      jelly = Array.from({ length: 3 }, () => ({ x: .15 + R() * .7, y: .2 + R() * .3, ph: R() * 6, s: .7 + R() * .5 }));
      bubbles = [];
    }
    function size() { DPR = Math.min(3, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
    function open() {
      const a = get(); touch(a); a.visits = (a.visits || 0) + 1; put(a);
      const w = document.createElement('div'); w.id = 'aqWrap';
      w.innerHTML = `<canvas id="aqC"></canvas><div class="aq-top"><button class="aq-x" data-act="aqclose" aria-label="Stäng">✕</button><button class="aq-name" data-act="aqname">🐬 <b>${esc(a.name)}</b><small>${careDays(a)} ${careDays(a) === 1 ? 'dag' : 'dagar'} tillsammans</small></button><div class="aq-meter" title="Mätt"><i style="width:${Math.round(food(a) * 100)}%"></i></div></div>
        <div class="aq-say" id="aqSay"></div><div class="aq-help">Tryck i vattnet = mat · Håll på ${esc(a.name)} = klappa · Tryck på ${esc(a.name)} = volt</div><div class="snd-host">${SND.barHTML()}</div>`;
      document.body.appendChild(w); cv = w.querySelector('#aqC'); g = cv.getContext('2d'); size(); seedScene(); SND.bindVol();
      const m = showMood() ? mood() : null, f = food(a);
      D = { x: W * .5, y: H * .42, h: 0, v: 40, face: 1, vx: 40, vy: 0, tx: W * .7, ty: H * .38, sz: Math.min(W, H) * (.16 + Math.min(careDays(a), 20) * .004), calm: m === 'sofa' || f < .2, sleep: f < .2,
        th: 0, thd: 0, psi: 0, psiD: 0, turn: null, cool: 1, Z: 0, scale: 1, A: .05, ph: 0, gl: 3, gliding: false, bend: 0, lat: 0, roll: 0, trick: null, tk: 0, flap: 0, nose: null };
      rings = [];
      say(f < .2 ? `${a.name} har somnat. Släpp ner lite mat så vaknar hen 🦐` : (LINES[m || 'none'])[Math.floor(Math.random() * 3)]);
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      window.addEventListener('resize', size); t0 = performance.now(); raf = requestAnimationFrame(loop);
      history.pushState({ aq: 1 }, ''); window.addEventListener('popstate', close, { once: true });
    }
    function close() { cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', size); const w = document.getElementById('aqWrap'); if (w) w.remove(); repaint(false); }
    function say(t) { said = t; saidT = 5.5; const el = document.getElementById('aqSay'); if (el) { el.textContent = t; el.classList.add('on'); } }
    function onDolphin(x, y) { return Math.hypot(x - D.x, y - D.y) < D.sz * .85 || (D.nose && Math.hypot(x - D.nose[0], y - D.nose[1]) < D.sz * .4); }
    function down(e) { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; holdXY = { x, y, t: performance.now(), on: onDolphin(x, y) }; }
    function up(e) {
      if (!holdXY) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, dt = performance.now() - holdXY.t, was = holdXY; holdXY = null;
      const a = get();
      if (was.on && dt < 350) { startTrick(); a.joy = Math.min(1, (a.joy || .5) + .05); put(a); buzz(20); say(['Hihi! 🐬', 'Wiii!', 'En till?', 'Såg du? Perfekt tia!'][Math.floor(Math.random() * 4)]); return; }
      if (!was.on && dt < 500) { for (let i = 0; i < 3; i++) food2.push({ x: x + (Math.random() - .5) * 18, y: Math.max(y, H * .08), vy: 14 + Math.random() * 10, ph: Math.random() * 6 }); D.sleep = false; buzz(8); }
    }
    function startTrick() { if (!D || D.trick) return; D.tk++; D.trick = { kind: (D.tk % 2 && D.y > H * .17 + D.sz * 1.1 && !D.turn) ? 'loop' : 'roll', t: 0, dur: 0 }; D.trick.dur = D.trick.kind === 'loop' ? 1.9 : 1.25; }
    function eat() {
      const a = get(); a.food = Math.min(1, food(a) + .12); a.fedAt = Date.now(); a.joy = Math.min(1, (a.joy || .5) + .02); put(a);
      const m = document.querySelector('.aq-meter i'); if (m) m.style.width = Math.round(food(a) * 100) + '%';
      if (Math.random() < .3) say(['Mums! 🦐', 'Godaste räkan i hela havet.', 'Tack! Nu orkar jag simma ett varv till.'][Math.floor(Math.random() * 3)]);
    }
    function loop(now) {
      const dt = Math.min(.05, (now - t0) / 1000); t0 = now; const T = now / 1000;
      if (holdXY && holdXY.on && now - holdXY.t > 450) { holdT += dt; if (Math.random() < .25) hearts.push({ x: D.x + (Math.random() - .5) * D.sz * .5, y: D.y - D.sz * .3, v: 30 + Math.random() * 20, life: 1.6 }); if (holdT > 1.2) { holdT = 0; const a = get(); a.joy = Math.min(1, (a.joy || .5) + .06); put(a); if (Math.random() < .5) say(['Mmm… mysigt 💙', 'Mer klapp!', 'Du är min favoritmänniska.'][Math.floor(Math.random() * 3)]); } }
      // Simning som en riktig delfin: stjärtfenan slår upp och ner (vågen går bakåt längs kroppen), slag varvas med glid,
      // lutningen ändras i mjuka bågar och en vändning är en riktig sväng i djupled (kroppen böjer sig åt sidan och syns
      // framifrån mitt i svängen) – aldrig en snabb spegelvändning.
      const sand = H * .76, top = H * .17, bot = sand - D.sz * .36, mx = D.sz * .85, kL = D.sz * 1.9;
      for (const f of food2) { f.age = (f.age || 0) + dt; if (f.y < sand - 3) { f.y += f.vy * dt; f.x += Math.sin(T * 2 + f.ph) * 6 * dt; } }
      food2 = food2.filter(f => f.age < 16);                                   // mat som ingen äter löses upp
      const tgt = D.sleep ? null : food2.reduce((b, f) => f.skip ? b : !b || Math.hypot(f.x - D.x, f.y - D.y) < Math.hypot(b.x - D.x, b.y - D.y) ? f : b, null);
      // mat den inte kommer åt (inklämd i ett hörn) ger den upp efter en stund i stället för att stå och trycka mot kanten
      if (tgt && Math.hypot(D.x - (D.px || 0), D.y - (D.py || 0)) < 12 * dt) { D.stuck = (D.stuck || 0) + dt; if (D.stuck > 1.3) { tgt.skip = true; D.stuck = 0; D.cool = 0; } } else D.stuck = 0;
      D.px = D.x; D.py = D.y;
      const cruise = D.sleep ? 12 : D.calm ? 44 : 70;
      let tx, ty;
      if (tgt) { tx = tgt.x; ty = Math.min(tgt.y, bot); }
      else {
        if (D.sleep) { D.tx = W * .5 + Math.sin(T * .12) * W * .22; D.ty = H * .42 + Math.sin(T * .21) * H * .03; }
        else if (Math.hypot(D.tx - D.x, D.ty - D.y) < D.sz * .8 || Math.random() < .0015) { D.tx = W * (.14 + Math.random() * .72); D.ty = H * (.24 + Math.random() * .32); }
        tx = D.tx; ty = D.ty;
      }
      const dx = tx - D.x, dy = ty - D.y, face = Math.cos(D.psi) >= 0 ? 1 : -1;
      D.cool -= dt;
      // vändning: bara när målet verkligen ligger bakom eller väggen närmar sig – och inte igen direkt efter
      if (!D.turn && !D.trick && D.cool <= 0) {
        const behind = dx * face < -(tgt ? D.sz * .3 : D.sz * .7), wall = !tgt && (face > 0 ? D.x > W - mx - D.sz * .5 : D.x < mx + D.sz * .5);   // när den hämtar mat får den gå ända fram till kanten
        if (behind || wall) {
          const dir = Math.random() < .6 ? 1 : -1, a1 = D.psi + Math.PI, a2 = D.psi - Math.PI, mid1 = Math.sin(D.psi + Math.PI / 2);
          D.turn = { from: D.psi, to: (mid1 > 0) === (dir > 0) ? a1 : a2, t: 0, dur: (D.sleep ? 3.4 : D.calm ? 2.3 : 1.6) * (tgt ? .8 : 1) };
        }
      }
      let psiPrev = D.psi;
      if (D.turn) { const tr = D.turn; tr.t += dt; const u = Math.min(1, tr.t / tr.dur), e = u * u * u * (u * (u * 6 - 15) + 10);
        D.psi = tr.from + (tr.to - tr.from) * e;
        if (u >= 1) { D.psi = Math.atan2(Math.sin(tr.to), Math.cos(tr.to)); psiPrev = D.psi; D.turn = null; D.cool = 1.4 + Math.random() * 1.5; } }
      D.psiD = dt > 0 ? (D.psi - psiPrev) / dt : 0;
      // lutning: en dämpad fjäder mot önskad vinkel ger mjuka bågar
      let thd = Math.max(-.65, Math.min(.65, Math.atan2(dy, Math.abs(dx) + D.sz * .9)));
      if (D.y < top + D.sz * .35) thd = Math.max(thd, .3);
      if (D.y > bot - D.sz * .25 && !tgt) thd = Math.min(thd, -.32);
      if (D.turn) thd *= .5;
      D.thd += ((thd - D.th) * 3.2 - D.thd * 3.1) * dt; D.thd = Math.max(-.9, Math.min(.9, D.thd)); D.th += D.thd * dt;
      // trick: volt (loop) eller rollning
      let thR = D.th, boost = 1;
      if (D.trick) { const k = D.trick; k.t += dt; const u = Math.min(1, k.t / k.dur), e = u * u * (3 - 2 * u);
        if (k.kind === 'loop') thR = D.th - Math.PI * 2 * e; else D.roll = Math.PI * 2 * e;
        boost = 1.35; if (u >= 1) { D.trick = null; D.roll = 0; D.cool = Math.max(D.cool, .6); } }
      // fart: slag när den behöver fart, glid däremellan
      const vT = (tgt ? cruise * 1.55 : cruise * (.9 + .1 * Math.sin(T * .5))) * (D.turn ? .72 : 1) * boost;
      D.gl -= dt;
      if (D.gl <= 0) { D.gliding = !D.gliding && !tgt && !D.turn; D.gl = D.gliding ? .9 + Math.random() * 1.2 : (D.sleep ? 2 : 2.4) + Math.random() * 2.6; }
      const Atg = D.gliding ? .012 : Math.max(D.sleep ? .02 : .035, Math.min(.13, .035 + (vT - D.v) / Math.max(vT, 1) * .14 + vT / 1500));
      D.A += (Atg - D.A) * Math.min(1, dt * 2.4);
      D.ph += Math.PI * 2 * (D.sleep ? .4 : .7 + D.v / 115) * dt;
      D.v += ((D.gliding ? vT * .3 : vT) - D.v) * dt * (D.gliding ? .22 : .9);
      // rörelse i bilden (och lite i djupled under svängar – den kommer närmare och blir lite större)
      D.vx = D.v * Math.cos(thR) * Math.cos(D.psi); D.vy = D.v * Math.sin(thR);
      D.x += D.vx * dt; D.y += D.vy * dt;
      D.Z += D.v * Math.cos(thR) * Math.sin(D.psi) * dt * .6; if (!D.turn) D.Z *= 1 - Math.min(1, dt * .3);
      D.scale = 1 + Math.max(-.18, Math.min(.18, D.Z / (H * 1.1)));
      D.x = Math.max(mx, Math.min(W - mx, D.x)); D.y = Math.max(top, Math.min(bot, D.y));
      D.h = Math.atan2(D.vy, D.vx); D.face = Math.cos(D.psi);
      // kroppen böjer sig i bågar och åt sidan i svängar
      const bT = Math.max(-.5, Math.min(.5, -D.thd * kL / Math.max(D.v, 25) * .32)), lT = Math.max(-.6, Math.min(.6, D.psiD * kL / Math.max(D.v, 25) * .12));
      D.bend += (bT - D.bend) * Math.min(1, dt * 4); D.lat += (lT - D.lat) * Math.min(1, dt * 4);
      D.flap = D.turn ? .7 * Math.sin(Math.PI * D.turn.t / D.turn.dur) : Math.sin(D.ph * .5) * .25 * Math.min(1, D.v / 60);
      const nose = D.nose || [D.x + Math.cos(D.h) * D.sz * .8, D.y + Math.sin(D.h) * D.sz * .8];
      food2 = food2.filter(f => { if (Math.hypot(f.x - nose[0], f.y - nose[1]) < D.sz * .4 || Math.hypot(f.x - D.x, f.y - D.y) < D.sz * .32) { eat(); return false; } return true; });
      // ibland blåser delfinen en bubbelring ur andningshålet
      if (!D.sleep && Math.random() < dt / 11 && D.nose) { const bx = D.nose[0] + (D.x - D.nose[0]) * .35, by = D.nose[1] + (D.y - D.nose[1]) * .35 - D.sz * .14; rings.push({ x: bx, y: by, r: D.sz * .05, life: 3.2 }); }
      for (const r of rings) { r.y -= 22 * dt; r.r += D.sz * .045 * dt; r.life -= dt; r.x += Math.sin(T + r.y * .03) * 4 * dt; } rings = rings.filter(r => r.life > 0 && r.y > -20);
      if (Math.random() < (D.sleep ? .05 : .025) && D.nose) bubbles.push({ x: D.nose[0] + (D.x - D.nose[0]) * .35, y: D.nose[1] + (D.y - D.nose[1]) * .35 - D.sz * .12, r: 1.5 + Math.random() * 2.5, v: 25 + Math.random() * 25, z: D.sleep });
      if (Math.random() < .06) bubbles.push({ x: W * .82, y: H * .78, r: 1.5 + Math.random() * 3.5, v: 35 + Math.random() * 30 });
      for (const b of bubbles) { b.y -= b.v * dt; b.x += Math.sin(T * 3 + b.y * .05) * 10 * dt; } bubbles = bubbles.filter(b => b.y > -10);
      for (const h of hearts) { h.y -= h.v * dt; h.life -= dt; } hearts = hearts.filter(h => h.life > 0);
      if (saidT > 0) { saidT -= dt; if (saidT <= 0) { const el = document.getElementById('aqSay'); el && el.classList.remove('on'); } }
      draw(T); raf = requestAnimationFrame(loop);
    }
    function draw(T) {
      const a = get(), lvl = careDays(a);
      // vatten
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0e7490'); bg.addColorStop(.45, '#0c4a6e'); bg.addColorStop(1, '#0b1f3f'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // ljusstrålar
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const x = W * (.1 + i * .17) + Math.sin(T * .2 + i) * 30, w = 40 + 30 * Math.sin(T * .3 + i * 2); const lg = g.createLinearGradient(0, 0, 0, H * .8); lg.addColorStop(0, 'rgba(186,230,253,.16)'); lg.addColorStop(1, 'rgba(186,230,253,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(x - w * .3, 0); g.lineTo(x + w * .3, 0); g.lineTo(x + w * 1.6, H * .8); g.lineTo(x - w * .6, H * .8); g.closePath(); g.fill(); }
      g.restore();
      // ytans skimmer
      g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 14; i++) { const x = (i / 14 * W + T * 12) % W; g.beginPath(); g.ellipse(x, 6 + Math.sin(T + i) * 3, 30, 3, 0, 0, 7); g.fill(); }
      // sandbotten
      const sy = H * .76; const sg = g.createLinearGradient(0, sy, 0, H); sg.addColorStop(0, '#d6b98c'); sg.addColorStop(1, '#a3825a'); g.fillStyle = sg; g.beginPath(); g.moveTo(0, sy);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, sy + Math.sin(x * .02) * 6 + Math.sin(x * .007 + 1) * 8); g.lineTo(W, H); g.lineTo(0, H); g.fill();
      // växter
      for (const p of plants) for (let j = 0; j < p.n; j++) {          // tångblad: avsmalnande band som vajar
        const bx = p.x * W + (j - (p.n - 1) / 2) * p.w * .9, h = p.h * H * (1 - j * .18), L = [], Rt = [];
        for (let k = 0; k <= 10; k++) { const f = k / 10, yy = sy + 8 - h * f, sw = Math.sin(T * .8 + p.ph + j + f * 3) * f * f * 18, wd = p.w * (1 - f * .85) * (.7 + .3 * Math.sin(f * 9 + p.ph)); L.push([bx + sw - wd / 2, yy]); Rt.push([bx + sw + wd / 2, yy]); }
        const lg = g.createLinearGradient(0, sy, 0, sy - h); lg.addColorStop(0, p.c[0]); lg.addColorStop(1, p.c[1]); g.fillStyle = lg; g.globalAlpha = .92;
        g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const q of L) g.lineTo(q[0], q[1]); for (let k = Rt.length - 1; k >= 0; k--) g.lineTo(Rt[k][0], Rt[k][1]); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); for (let k = 0; k < L.length; k++) { const mx = (L[k][0] + Rt[k][0]) / 2; k ? g.lineTo(mx, L[k][1]) : g.moveTo(mx, L[k][1]); } g.stroke(); g.globalAlpha = 1; }
      // småstenar
      for (let i = 0; i < 14; i++) { const x = ((i * 97) % 100) / 100 * W, y = sy + 18 + ((i * 53) % 30); g.fillStyle = i % 3 ? 'rgba(120,96,70,.55)' : 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(x, y, 4 + (i % 4), 2.5 + (i % 3), 0, 0, 7); g.fill(); }
      // dekor som låses upp
      if (lvl >= 2) coral(W * .14, sy + 4, 1, '#fb7185');
      if (lvl >= 10) { coral(W * .72, sy + 6, 1.2, '#f472b6'); coral(W * .78, sy + 8, .9, '#a78bfa'); coral(W * .68, sy + 8, .8, '#fbbf24'); }
      if (lvl >= 1) star(W * .32, sy + 14, 13, '#f59e0b', T);
      if (lvl >= 7) shell(W * .86, sy + 10, T);
      if (lvl >= 3) for (const f of fish) { f.x += f.v * .016; if (f.x > 1.1) f.x = -.1; if (f.x < -.1) f.x = 1.1; fishDraw(f.x * W, f.y * H + Math.sin(T * 2 + f.ph) * 6, 7 * f.s, f.c, f.v > 0); }
      if (lvl >= 5) for (const j of jelly) jellyDraw(j.x * W + Math.sin(T * .3 + j.ph) * 20, j.y * H + Math.sin(T * .5 + j.ph) * 14, 16 * j.s, T + j.ph);
      // mat
      for (const f of food2) { g.fillStyle = '#fda4af'; g.beginPath(); g.ellipse(f.x, f.y, 4, 2.6, Math.sin(T * 3 + f.ph), 0, 7); g.fill(); }
      // bubblor
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; for (const b of bubbles) { g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.stroke(); if (b.z) { g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `${10 + b.r * 2}px Fredoka, system-ui`; g.fillText('z', b.x + 4, b.y); } }
      dolphin(T, lvl);
      for (const h of hearts) { g.globalAlpha = Math.min(1, h.life); g.font = '18px system-ui'; g.fillText('💙', h.x, h.y); } g.globalAlpha = 1;
    }
    function coral(x, y, s, c) { g.strokeStyle = c; g.lineCap = 'round'; const br = (x0, y0, a, l, w, n) => { if (n <= 0 || l < 4) return; const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); br(x1, y1, a - .45, l * .72, w * .72, n - 1); br(x1, y1, a + .4, l * .7, w * .72, n - 1); }; br(x, y, -Math.PI / 2, 26 * s, 7 * s, 5); }
    function star(x, y, r, c, T) { g.save(); g.translate(x, y); g.rotate(Math.sin(T * .2) * .05); g.fillStyle = c; g.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .42 : r, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(-r * .15, -r * .2, r * .18, 0, 7); g.fill(); g.restore(); }
    function shell(x, y, T) { g.save(); g.translate(x, y); const o = .25 + .15 * Math.sin(T * .6); g.fillStyle = '#fde2e4'; g.beginPath(); g.ellipse(0, 0, 18, 12, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 12; g.beginPath(); g.arc(0, -4 - o * 6, 4, 0, 7); g.fill(); g.shadowBlur = 0; g.fillStyle = '#f9a8d4'; g.beginPath(); g.ellipse(0, -8 - o * 18, 18, 10, 0, Math.PI, 0); g.fill(); g.restore(); }
    function fishDraw(x, y, s, c, right) { g.save(); g.translate(x, y); if (!right) g.scale(-1, 1); g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, s * 1.6, s, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-s * 1.4, 0); g.lineTo(-s * 2.4, -s * .8); g.lineTo(-s * 2.4, s * .8); g.fill(); g.fillStyle = '#0b1220'; g.beginPath(); g.arc(s * .8, -s * .2, s * .22, 0, 7); g.fill(); g.restore(); }
    function jellyDraw(x, y, s, T) { g.save(); g.translate(x, y); g.globalCompositeOperation = 'lighter'; const p = 1 + Math.sin(T * 2) * .08; g.fillStyle = 'rgba(196,181,253,.35)'; g.beginPath(); g.ellipse(0, 0, s * p, s * .7 / p, 0, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(196,181,253,.35)'; g.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * s * .3, 0); for (let k = 1; k < 6; k++) g.lineTo(i * s * .3 + Math.sin(T * 2 + k + i) * 3, k * s * .35); g.stroke(); } g.restore(); }
    function dolphin(T, lvl) {
      const k = D.sz * 1.9 * D.scale, sand = H * .76;
      // skugga på sanden – mörkare ju närmare botten
      const hgt = Math.max(0, sand - D.y), sa = Math.max(0, .3 - hgt / (H * 2.2)), rx = k * (.18 + .3 * Math.abs(Math.cos(D.psi)));
      if (sa > .01) { const sg = g.createRadialGradient(D.x, sand + 10, 0, D.x, sand + 10, rx); sg.addColorStop(0, `rgba(30,40,60,${sa})`); sg.addColorStop(1, 'rgba(30,40,60,0)'); g.save(); g.translate(D.x, sand + 10); g.scale(1, .16); g.translate(-D.x, -(sand + 10)); g.fillStyle = sg; g.beginPath(); g.arc(D.x, sand + 10, rx, 0, 7); g.fill(); g.restore(); }
      // bubbelringar
      for (const r of rings) { g.strokeStyle = `rgba(230,250,255,${Math.min(.6, r.life * .3)})`; g.lineWidth = Math.max(1.2, r.r * .18); g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * .32, 0, 0, 7); g.stroke(); }
      let thR = D.th; if (D.trick && D.trick.kind === 'loop') { const u = Math.min(1, D.trick.t / D.trick.dur); thR -= Math.PI * 2 * u * u * (3 - 2 * u); }
      const heave = -D.A * Math.sin(D.ph) * k * .05;
      const P = { bend: D.bend, lat: D.lat, A: D.A, ph: D.ph, fluke: Math.max(-.6, Math.min(.6, -D.A * 3 * Math.cos(D.ph - 2.4))), roll: D.roll, pitch: thR, yaw: D.psi, elev: .26, flap: D.flap };
      const r = DOLPH.draw(g, P, { x: D.x, y: D.y + heave, k, eyes: D.sleep ? 'closed' : 'open', T, stars: true });
      D.nose = r.nose;
      if (lvl >= 14) { const hx = r.nose[0] + (D.x - r.nose[0]) * .38, hy = r.nose[1] + (D.y - r.nose[1]) * .38 - k * .13; g.font = `${k * .12}px system-ui`; g.textAlign = 'center'; g.fillText('👑', hx, hy); g.textAlign = 'start'; }
    }
    function act(a, b) {
      if (a === 'aqopen') { open(); return true; }
      if (a === 'aqclose') { if (history.state && history.state.aq) history.back(); else close(); return true; }
      if (a === 'aqname') {
        openModal(`<h3>🐬 Vad heter din delfin?</h3><input id="aqN" maxlength="16" value="${esc(get().name)}" style="width:100%;font-size:18px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:inherit;box-sizing:border-box"><div class="btns"><button class="ghost" data-act="close">Avbryt</button><button data-act="aqnameok">Spara</button></div>`);
        setTimeout(() => { const i = document.getElementById('aqN'); i && i.select(); }, 60); return true;
      }
      if (a === 'aqnameok') { const v = ((document.getElementById('aqN') || {}).value || '').trim().slice(0, 16); if (v) { const x = get(); x.name = v; put(x); const n = document.querySelector('.aq-name b'); if (n) n.textContent = v; } closeModal(); return true; }
      return false;
    }
    return { open, close, act, status, _get: get, _d: () => D && { x: D.x, y: D.y, h: D.h, psi: D.psi, th: D.th, sz: D.sz, turn: !!D.turn, trick: D.trick && D.trick.kind }, _trick: () => startTrick() };
  })();

  /* ---------- inställningar ---------- */
  function settingsHTML() {
    const on = showMood(), sa = sofaAuto();
    return `<div class="setrow"><div class="lbl">☀️ Dagsform på startsidan</div><div class="seg"><button data-act="moodshow" data-v="1" class="${on ? 'sel' : ''}">Visa</button><button data-act="moodshow" data-v="0" class="${on ? '' : 'sel'}">Dölj</button></div>
      <div class="setnote">Visa: välj 🛋️ / 🙂 / ⚡ varje dag och få en hälsning som passar. Dölj: startsidan är neutral.</div></div>
      ${on ? `<div class="setrow"><div class="lbl">🛋️ Lugnt läge vid "Lugn dag"</div><div class="seg"><button data-act="moodsofa" data-v="1" class="${sa ? 'sel' : ''}">På</button><button data-act="moodsofa" data-v="0" class="${sa ? '' : 'sel'}">Av</button></div><div class="setnote">Dämpade färger, tystare ljud, större knappar och mindre rörelse.</div></div>` : ''}`;
  }
  function act(a, b) {
    if (a === 'mood') { setMood(b.dataset.m); return true; }
    if (a === 'greet') { lsSet('greet_n', String(+(lsGet('greet_n') || 0) + 1)); repaint(true); buzz(6); return true; }
    if (a === 'moodshow') { lsSet('mood_show', b.dataset.v); applySofa(); if (typeof render === 'function') render(); if (typeof showSettings === 'function') showSettings(); return true; }
    if (a === 'moodsofa') { lsSet('mood_sofa', b.dataset.v); applySofa(); if (typeof showSettings === 'function') showSettings(); return true; }
    if (a === 'bkopen') { BK.show(); return true; }
    return DAILY.act(a, b) || SND.act(a, b) || AQ.act(a, b);
  }
  setTimeout(applySofa, 0);
  return { heroHTML, todayHTML, cardsHTML, repaint, act, settingsHTML, mood, setMood, greeting, applySofa, DAILY, SND, AQ };
})();
