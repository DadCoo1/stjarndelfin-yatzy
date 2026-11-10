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
      c('sndopen', snd ? SND.icon(snd) : '🌧️', snd ? SND.label(snd) + ' spelar' : 'Ljudlandskap', snd ? 'Tryck för att ändra' : 'Regn, hav, eld, bubblor', 'calm' + (snd ? ' live' : ''))
    ];
    const social = [];
    if (sg) social.push(c('sgopen', '🎲', `${sg} pågående`, 'Fortsätt där du var', 'hot'));
    if (unread) social.push(c('openchat', '💬', `${unread} nya`, unread === 1 ? 'meddelande' : 'meddelanden', 'hot'));
    if (online) social.push(c('openchat', '🟢', `${online} online`, online === 1 ? 'kompis vill kanske spela' : 'kompisar – vill någon spela?'));
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
    const KINDS = { rain: ['🌧️', 'Regn'], sea: ['🌊', 'Hav'], fire: ['🔥', 'Brasa'], bub: ['🫧', 'Bubblor'] };
    let ac = null, out = null, now = null, nodes = [], tick = 0, stopAt = 0, vol = +(lsGet('snd_vol') || .6), ducked = false;
    const ctx = () => { if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); out = ac.createGain(); out.connect(ac.destination); } ac.resume && ac.resume(); return ac; };
    function noise(kind, sec) {
      const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } }
      return b;
    }
    function loopSrc(buf) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); nodes.push(s); return s; }
    function filt(type, f, q) { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q) x.Q.value = q; nodes.push(x); return x; }
    function gain(v) { const g = ac.createGain(); g.gain.value = v; nodes.push(g); return g; }
    function blip(f0, f1, dur, v, type) { const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur + .02); }
    function crackle(v) { const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = CR || (CR = noise('white', .05)); f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 3500; f.Q.value = 2; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .03 + Math.random() * .05); s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + .1); }
    let CR = null;
    function play(kind, mins) {
      stop(true); ctx(); now = kind; out.gain.cancelScheduledValues(ac.currentTime); out.gain.setValueAtTime(0, ac.currentTime); out.gain.linearRampToValueAtTime(level(), ac.currentTime + 2.5);
      if (kind === 'rain') { const s = loopSrc(noise('white', 3)); s.connect(filt('highpass', 500)).connect(filt('lowpass', 7000)).connect(gain(.22)).connect(out); }
      if (kind === 'sea') { const s = loopSrc(noise('brown', 4)), g = gain(.35), lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .09; lg.gain.value = .28; lfo.connect(lg).connect(g.gain); lfo.start(); nodes.push(lfo, lg); s.connect(filt('lowpass', 800)).connect(g).connect(out); }
      if (kind === 'fire') { const s = loopSrc(noise('brown', 3)); s.connect(filt('lowpass', 420)).connect(gain(.32)).connect(out); }
      if (kind === 'bub') { const s = loopSrc(noise('brown', 3)); s.connect(filt('lowpass', 300)).connect(gain(.12)).connect(out); }
      const step = () => {
        if (!now) return;
        if (now === 'rain' && Math.random() < .55) blip(2200 + Math.random() * 2600, 1200, .03, .03 + Math.random() * .04);
        if (now === 'fire' && Math.random() < .35) crackle(.15 + Math.random() * .3);
        if (now === 'bub' && Math.random() < .12) blip(300 + Math.random() * 400, 900 + Math.random() * 900, .09 + Math.random() * .08, .08);
        if (stopAt && Date.now() > stopAt) { stop(); return; }
        tick = setTimeout(step, now === 'rain' ? 40 + Math.random() * 90 : 60 + Math.random() * 160);
      };
      step(); stopAt = mins ? Date.now() + mins * 60e3 : 0; lsSet('snd_last', kind); repaint(false);
    }
    const level = () => vol * (ducked ? .6 : 1) * .9;
    function stop(quick) {
      clearTimeout(tick); const ns = nodes; nodes = []; now = null;
      if (ac && out) { const t = ac.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + (quick ? .15 : 2)); }
      setTimeout(() => ns.forEach(n => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }), quick ? 200 : 2100);
      if (!quick) repaint(false);
    }
    function setVol(v) { vol = v; lsSet('snd_vol', String(v)); if (ac && now) out.gain.setTargetAtTime(level(), ac.currentTime, .2); }
    function duck(on) { ducked = on; if (ac && now) out.gain.setTargetAtTime(level(), ac.currentTime, .3); }
    const barHTML = () => `<div class="snd-bar">${Object.entries(KINDS).map(([k, [ic, lab]]) => `<button class="${now === k ? 'on' : ''}" data-act="sndplay" data-k="${k}"><i>${ic}</i>${lab}</button>`).join('')}
      ${now ? `<button data-act="sndstop"><i>⏹️</i>Tyst</button>` : ''}</div>
      <div class="snd-opts"><label>🔈 <input type="range" min="0" max="1" step=".05" value="${vol}" data-snd="vol"></label>
      <span>Stäng av efter: ${[0, 15, 30, 60].map(m => `<button class="${(stopAt ? Math.round((stopAt - Date.now()) / 60e3) : 0) === m || (!stopAt && !m) ? 'on' : ''}" data-act="sndtimer" data-m="${m}">${m ? m + ' min' : '∞'}</button>`).join('')}</span></div>`;
    function show() { openModal(`<h3>🎧 Ljudlandskap</h3><div class="setnote" style="margin:-6px 0 10px">Lugna ljud som skapas direkt i telefonen. Fortsätter när du spelar eller vilar.</div>${barHTML()}<div class="btns"><button data-act="close">Klar</button></div>`); bindVol(); }
    function bindVol() { document.querySelectorAll('[data-snd="vol"]').forEach(r => r.addEventListener('input', () => setVol(+r.value))); }
    function act(a, b) {
      if (a === 'sndopen') { show(); return true; }
      if (a === 'sndplay') { play(b.dataset.k, stopAt ? Math.round((stopAt - Date.now()) / 60e3) : 0); refreshBars(); return true; }
      if (a === 'sndstop') { stop(); refreshBars(); return true; }
      if (a === 'sndtimer') { const m = +b.dataset.m; stopAt = m ? Date.now() + m * 60e3 : 0; refreshBars(); return true; }
      return false;
    }
    function refreshBars() { document.querySelectorAll('.snd-host').forEach(h => { h.innerHTML = barHTML(); }); const m = document.querySelector('#modal .snd-bar'); if (m && !m.closest('.snd-host')) { show(); } bindVol(); }
    return { play, stop, act, duck, barHTML, bindVol, playing: () => now, icon: k => KINDS[k][0], label: k => KINDS[k][1] };
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
    let cv, g, raf = 0, W = 0, H = 0, DPR = 1, t0 = 0, D, food2 = [], hearts = [], bubbles = [], fish = [], jelly = [], said = '', saidT = 0, holdT = 0, holdXY = null, flip = 0, plants = [];
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
      D = { x: W * .5, y: H * .42, h: 0, v: 40, face: 1, vx: 40, vy: 0, tx: W * .7, ty: H * .38, sz: Math.min(W, H) * (.16 + Math.min(careDays(a), 20) * .004), calm: m === 'sofa' || f < .2, sleep: f < .2 };
      say(f < .2 ? `${a.name} har somnat. Släpp ner lite mat så vaknar hen 🦐` : (LINES[m || 'none'])[Math.floor(Math.random() * 3)]);
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      window.addEventListener('resize', size); t0 = performance.now(); raf = requestAnimationFrame(loop);
      history.pushState({ aq: 1 }, ''); window.addEventListener('popstate', close, { once: true });
    }
    function close() { cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', size); const w = document.getElementById('aqWrap'); if (w) w.remove(); repaint(false); }
    function say(t) { said = t; saidT = 5.5; const el = document.getElementById('aqSay'); if (el) { el.textContent = t; el.classList.add('on'); } }
    function onDolphin(x, y) { return Math.hypot(x - D.x, y - D.y) < D.sz * .7; }
    function down(e) { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; holdXY = { x, y, t: performance.now(), on: onDolphin(x, y) }; }
    function up(e) {
      if (!holdXY) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, dt = performance.now() - holdXY.t, was = holdXY; holdXY = null;
      const a = get();
      if (was.on && dt < 350) { flip = 1; a.joy = Math.min(1, (a.joy || .5) + .05); put(a); buzz(20); say(['Hihi! 🐬', 'Wiii!', 'En till?', 'Såg du? Perfekt tia!'][Math.floor(Math.random() * 4)]); return; }
      if (!was.on && dt < 500) { for (let i = 0; i < 3; i++) food2.push({ x: x + (Math.random() - .5) * 18, y: Math.max(y, H * .08), vy: 14 + Math.random() * 10, ph: Math.random() * 6 }); D.sleep = false; buzz(8); }
    }
    function eat() {
      const a = get(); a.food = Math.min(1, food(a) + .12); a.fedAt = Date.now(); a.joy = Math.min(1, (a.joy || .5) + .02); put(a);
      const m = document.querySelector('.aq-meter i'); if (m) m.style.width = Math.round(food(a) * 100) + '%';
      if (Math.random() < .3) say(['Mums! 🦐', 'Godaste räkan i hela havet.', 'Tack! Nu orkar jag simma ett varv till.'][Math.floor(Math.random() * 3)]);
    }
    function loop(now) {
      const dt = Math.min(.05, (now - t0) / 1000); t0 = now; const T = now / 1000;
      if (holdXY && holdXY.on && now - holdXY.t > 450) { holdT += dt; if (Math.random() < .25) hearts.push({ x: D.x + (Math.random() - .5) * D.sz * .5, y: D.y - D.sz * .3, v: 30 + Math.random() * 20, life: 1.6 }); if (holdT > 1.2) { holdT = 0; const a = get(); a.joy = Math.min(1, (a.joy || .5) + .06); put(a); if (Math.random() < .5) say(['Mmm… mysigt 💙', 'Mer klapp!', 'Du är min favoritmänniska.'][Math.floor(Math.random() * 3)]); } }
      // Simning: en riktning och en fart som ändras mjukt – delfinen svänger i bågar, håller sig i vattnet
      // och dyker bara ner mot botten för att hämta mat, sedan stiger den igen.
      const sand = H * .76, top = H * .17, bot = sand - D.sz * .3, mx = D.sz * .55;
      for (const f of food2) { f.age = (f.age || 0) + dt; if (f.y < sand - 3) { f.y += f.vy * dt; f.x += Math.sin(T * 2 + f.ph) * 6 * dt; } }
      food2 = food2.filter(f => f.age < 16);                                   // mat som ingen äter löses upp
      const tgt = D.sleep ? null : food2.reduce((b, f) => !b || Math.hypot(f.x - D.x, f.y - D.y) < Math.hypot(b.x - D.x, b.y - D.y) ? f : b, null);
      const cruise = D.sleep ? 16 : D.calm ? 46 : 74;
      let tx, ty;
      if (tgt) { tx = tgt.x; ty = Math.min(tgt.y, bot); }
      else {
        if (D.sleep) { D.tx = W * .5 + Math.sin(T * .22) * W * .2; D.ty = H * .42 + Math.sin(T * .37) * H * .04; }
        else if (Math.hypot(D.tx - D.x, D.ty - D.y) < D.sz * .7 || Math.random() < .002) { D.tx = W * (.14 + Math.random() * .72); D.ty = H * (.24 + Math.random() * .32); }
        tx = D.tx; ty = D.ty;
      }
      let dx = tx - D.x, dy = ty - D.y;
      // mjuka väggar: vänd tillbaka in i vattnet i god tid
      if (D.y > bot - 30 && !tgt) dy -= 120; if (D.y < top + 30) dy += 120;
      if (D.x < mx + 40) dx += 160; if (D.x > W - mx - 40) dx -= 160;
      let want = Math.atan2(dy, dx); const lim = tgt ? 1.1 : .75;                 // inte rakt upp eller ner
      const cw = Math.cos(want), sw0 = Math.max(-Math.sin(lim), Math.min(Math.sin(lim), Math.sin(want))); want = Math.atan2(sw0, cw);
      let dh = want - D.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      const turn = (tgt ? 2.6 : D.calm ? 1.1 : 1.6) * dt; D.h += Math.max(-turn, Math.min(turn, dh));
      const vT = tgt ? cruise * 1.7 : cruise * (.85 + .15 * Math.sin(T * .7)); D.v += (vT - D.v) * Math.min(1, dt * 1.5);
      D.vx = Math.cos(D.h) * D.v; D.vy = Math.sin(D.h) * D.v;
      D.x += D.vx * dt; D.y += D.vy * dt + Math.sin(T * 1.3) * (D.sleep ? 2 : 6) * dt;
      D.x = Math.max(mx, Math.min(W - mx, D.x)); D.y = Math.max(top, Math.min(bot, D.y));
      const faceT = Math.cos(D.h) >= 0 ? 1 : -1; D.face += (faceT - D.face) * Math.min(1, dt * 5);     // vänder mjukt
      const hx = D.x + Math.cos(D.h) * D.sz * .5, hy = D.y + Math.sin(D.h) * D.sz * .5;
      food2 = food2.filter(f => { if (Math.hypot(f.x - hx, f.y - hy) < D.sz * .28 || Math.hypot(f.x - D.x, f.y - D.y) < D.sz * .22) { eat(); return false; } return true; });
      if (flip > 0) flip = Math.max(0, flip - dt * .9);
      if (Math.random() < (D.sleep ? .05 : .03)) bubbles.push({ x: D.x + Math.cos(D.h) * D.sz * .35, y: D.y - D.sz * .1, r: 2 + Math.random() * 3, v: 25 + Math.random() * 25, z: D.sleep });
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
      const s = D.sz, pitch = Math.atan2(Math.sin(D.h), Math.abs(Math.cos(D.h))), sw = Math.sin(T * (2 + D.v / 14)) * (D.sleep ? .04 : .07 + D.v / 900);
      const fx = Math.abs(D.face) < .12 ? .12 * Math.sign(D.face || 1) : D.face;
      g.save(); g.translate(D.x, D.y); g.scale(fx, 1); g.rotate(pitch + (flip > 0 ? (1 - flip) * Math.PI * 2 : 0));
      // glöd
      const glow = g.createRadialGradient(0, 0, s * .1, 0, 0, s * .9); glow.addColorStop(0, 'rgba(165,243,255,.18)'); glow.addColorStop(1, 'rgba(165,243,255,0)'); g.fillStyle = glow; g.beginPath(); g.arc(0, 0, s * .9, 0, 7); g.fill();
      // kropp
      const bd = g.createLinearGradient(0, -s * .3, 0, s * .3); bd.addColorStop(0, '#7c6cff'); bd.addColorStop(.55, '#60a5fa'); bd.addColorStop(1, '#a5f3ff');
      g.fillStyle = bd; g.beginPath();
      g.moveTo(s * .62, s * .02);                                                        // nos
      g.bezierCurveTo(s * .5, -s * .2, s * .1, -s * .3, -s * .3, -s * .16);
      g.bezierCurveTo(-s * .45, -s * .1, -s * .55, -s * .02 + sw * s, -s * .66, sw * s * 1.6);
      g.bezierCurveTo(-s * .55, s * .08 + sw * s, -s * .3, s * .18, 0, s * .17);
      g.bezierCurveTo(s * .3, s * .16, s * .5, s * .12, s * .62, s * .02); g.fill();
      // mage
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(s * .55, s * .06); g.bezierCurveTo(s * .3, s * .17, 0, s * .17, -s * .3, s * .1); g.bezierCurveTo(0, s * .1, s * .3, s * .08, s * .55, s * .06); g.fill();
      // ryggfena
      g.fillStyle = '#6d5ff0'; g.beginPath(); g.moveTo(-s * .02, -s * .24); g.quadraticCurveTo(-s * .1, -s * .48, -s * .2, -s * .44); g.quadraticCurveTo(-s * .16, -s * .3, -s * .2, -s * .19); g.fill();
      // bröstfena
      g.fillStyle = '#5b8def'; g.beginPath(); g.moveTo(s * .12, s * .1); g.quadraticCurveTo(s * .02, s * .3 + sw * s * .5, -s * .1, s * .3); g.quadraticCurveTo(0, s * .16, s * .02, s * .12); g.fill();
      // stjärtfena
      g.save(); g.translate(-s * .66, sw * s * 1.6); g.rotate(sw * 2.2); g.fillStyle = '#7c6cff'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-s * .12, -s * .22, -s * .26, -s * .2); g.quadraticCurveTo(-s * .12, -s * .04, -s * .08, 0); g.quadraticCurveTo(-s * .12, s * .04, -s * .26, s * .2); g.quadraticCurveTo(-s * .12, s * .22, 0, 0); g.fill(); g.restore();
      // stjärnor på ryggen (därav namnet)
      g.fillStyle = '#fff'; for (const [x, y, r] of [[-.05, -.14, .028], [.12, -.16, .02], [-.22, -.1, .018]]) { const tw = .6 + .4 * Math.sin(T * 3 + x * 20); g.globalAlpha = tw; g.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * s * .4 : r * s, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(x * s + Math.cos(a) * rr, y * s + Math.sin(a) * rr); } g.fill(); } g.globalAlpha = 1;
      // öga och leende
      if (D.sleep) { g.strokeStyle = '#0b1220'; g.lineWidth = s * .018; g.beginPath(); g.arc(s * .38, -s * .03, s * .03, .2, Math.PI - .2); g.stroke(); }
      else { g.fillStyle = '#0b1220'; g.beginPath(); g.arc(s * .38, -s * .04, s * .035, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s * .392, -s * .052, s * .012, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(11,18,32,.55)'; g.lineWidth = s * .012; g.beginPath(); g.moveTo(s * .6, s * .04); g.quadraticCurveTo(s * .5, s * .09, s * .42, s * .06); g.stroke();
      // kind
      g.fillStyle = 'rgba(251,113,133,.35)'; g.beginPath(); g.ellipse(s * .44, s * .04, s * .04, s * .025, 0, 0, 7); g.fill();
      if (lvl >= 14) { g.font = `${s * .22}px system-ui`; g.fillText('👑', -s * .12, -s * .3); }
      g.restore();
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
    return { open, close, act, status, _get: get, _d: () => D && { x: D.x, y: D.y, h: D.h, sz: D.sz } };
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
