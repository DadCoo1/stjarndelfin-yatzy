/* ---------- Temaljud: varje värld har sitt eget ljudlandskap ----------
   Allt byggs i enheten med Web Audio – inga inspelningar laddas ned (utom bäcken i snd/, CC0).
   Grundvärlden (Rymd & hav) har kvar sin egen musik i app.js. Övriga världar får här:
   • en ljudbädd i lager (vind, hav, brasa, syrsor …) i stereo med långsam, slumpad rörelse
   • egen generativ musik: varje värld har tonart, skala, ackordföljd och instrument – fraserna
     sätts ihop på nytt hela tiden, så inget upprepar sig och ingen känd melodi citeras
   • händelser som kommer oregelbundet: bjällror från en släde som passerar, fyrverkerier,
     en uggla, valsång, en drake långt bort …
   • ett gemensamt rum (efterklang med tidiga reflexer och mörknande svans) och ett pingpong-eko.
   Ljudet använder appens AudioContext (AC) och styrs av samma av/på som bakgrundsmusiken. */
const AMB = (() => {
  const R = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)], mtf = m => 440 * Math.pow(2, (m - 69) / 12);
  const BUF = {}; let ac = null;

  /* ================= grundbyggstenar ================= */
  const G = v => { const g = ac.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q) => { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; return x; };
  const P = v => { if (!ac.createStereoPanner) return G(1); const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, v)); return p; };
  const link = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  function osc(type, f) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  // rum: tidiga reflexer + diffus svans som mörknar med tiden (olika i vänster och höger öra)
  function impulse(sec, bright) {
    const key = 'ir' + sec + bright; if (BUF[key]) return BUF[key];
    const sr = ac.sampleRate, n = Math.floor(sr * sec), b = ac.createBuffer(2, n, sr), pre = Math.floor(sr * .018);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = pre; i < n; i++) { const t = (i - pre) / (n - pre), k = bright * (1 - .85 * t) + .02; lp += ((Math.random() * 2 - 1) - lp) * k; d[i] = lp * Math.pow(1 - t, 2.2) * (1 - Math.exp(-(i - pre) / (sr * .012))); }
      for (let r = 0; r < 9; r++) { const p = pre + Math.floor(sr * R(.004, .085)); if (p < n) d[p] += R(-.6, .6) * (1 - r / 10); }
    }
    return BUF[key] = b;
  }
  // brus i stereo som går runt utan skarv
  function noise(color, sec) {
    const key = color + sec; if (BUF[key]) return BUF[key];
    const sr = ac.sampleRate, n = Math.floor(sr * sec), fade = Math.floor(sr * .5), b = ac.createBuffer(2, n, sr), tmp = new Float32Array(n + fade);
    for (let ch = 0; ch < 2; ch++) {
      let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < n + fade; i++) { const w = Math.random() * 2 - 1;
        if (color === 'pink') { b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; tmp[i] = (b0 + b1 + b2 + w * .1848) * .22; }
        else if (color === 'brown') { last = (last + .02 * w) / 1.02; tmp[i] = last * 3.5; } else tmp[i] = w * .5; }
      const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = tmp[i];
      for (let i = 0; i < fade; i++) { const t = i / fade; d[i] = tmp[i] * Math.sqrt(t) + tmp[n + i] * Math.sqrt(1 - t); }
    }
    return BUF[key] = b;
  }
  // en slinga av små ljudkorn som räknas ut en gång (syrsor, gnistor, bubblor …)
  function grains(key, sec, make) {
    if (BUF[key]) return BUF[key];
    const sr = ac.sampleRate, n = Math.floor(sr * sec), b = ac.createBuffer(2, n, sr), L = b.getChannelData(0), Rr = b.getChannelData(1);
    make((pos, len, pan, fn) => { const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4); let p = Math.floor(pos * sr) % n;
      for (let k = 0; k < len; k++) { const v = fn(k); L[p] += v * gl; Rr[p] += v * gr; if (++p >= n) p = 0; } }, sr, sec);
    return BUF[key] = b;
  }
  // knäppt sträng (Karplus–Strong): koto, harpa, gitarr, pizzicato
  function ks(m, o) {
    const key = 'ks' + m + o.id; if (BUF[key]) return BUF[key];
    const sr = ac.sampleRate, f = mtf(m), n = Math.floor(sr * (o.dur || 3)), N = Math.max(2, Math.floor(sr / f - .5)), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0);
    let lp = 0; for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * o.bright; d[i] = lp; }
    if (o.pos) { const p = Math.max(1, Math.floor(N * o.pos)); for (let i = N - 1; i >= p; i--) d[i] -= d[i - p]; }
    let mean = 0; for (let i = 0; i < N; i++) mean += d[i]; mean /= N; for (let i = 0; i < N; i++) d[i] -= mean;
    const dm = o.damp, mx = o.mix || .5;
    for (let i = N; i < n; i++) d[i] = dm * (mx * d[i - N] + (1 - mx) * (i - N - 1 >= 0 ? d[i - N - 1] : 0));
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] /= pk || 1;
    for (let i = 0; i < 200; i++) d[n - 1 - i] *= i / 200;
    return BUF[key] = { buf: b, rate: f * (N + 1 - mx) / sr };
  }

  /* ================= ljudrummet för en värld ================= */
  function bus(cfg) {
    const S = { alive: true, timers: [], srcs: [], cfg };
    S.out = G(0); const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = .02; comp.release.value = .4;
    const warm = F('highshelf', 7000); warm.gain.value = -3;
    link(S.out, warm, comp, ac.destination);
    S.dry = G(1); S.dry.connect(S.out);
    S.rev = ac.createConvolver(); S.rev.buffer = impulse(cfg.room || 4.2, cfg.bright || .45); S.wet = G(1); link(S.wet, S.rev, G(cfg.wet || .9), S.out);
    // pingpong-eko
    const dl = ac.createDelay(3), dr = ac.createDelay(3), fb = G(cfg.fb || .38), lpE = F('lowpass', 2600), pl = P(-.75), pr = P(.75);
    dl.delayTime.value = cfg.echo || .42; dr.delayTime.value = (cfg.echo || .42) * 2;
    S.echo = G(1); link(S.echo, dl, pl, S.out); link(dl, dr, pr, S.out); link(dr, lpE, fb, dl); const ew = G(.4); pl.connect(ew); pr.connect(ew); ew.connect(S.wet);
    return S;
  }
  // skicka en nod till rummet: torrt, efterklang, eko
  function to(S, node, d, w, e) { if (d) link(node, G(d), S.dry); if (w) link(node, G(w), S.wet); if (e) link(node, G(e), S.echo); return node; }
  function later(S, fn, ms) { if (!S.alive) return; S.timers.push(setTimeout(() => { if (S.alive) try { fn(); } catch (e) { console.warn('temaljud', e); } }, ms)); }
  function every(S, fn, lo, hi, first) { const go = () => { fn(); later(S, go, R(lo, hi)); }; later(S, go, first != null ? first : R(lo, hi) * .5); }
  function loop(S, buf, rate) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; if (rate) s.playbackRate.value = rate; s.start(0, Math.random() * buf.duration); S.srcs.push(s); return s; }
  function wander(S, param, lo, hi, t0, t1) { const go = () => { const d = R(t0, t1); param.setTargetAtTime(R(lo, hi), ac.currentTime, d / 3); later(S, go, d * 1000); }; go(); }
  function lfo(S, param, rate, depth) { const o = osc('sine', rate), g = G(depth); link(o, g, param); o.start(); S.srcs.push(o); }

  /* ================= instrument ================= */
  // klockor och glas: summa av deltoner [förhållande, styrka, avklingning i s]
  const BELLS = {
    celesta:  [[1, 1, 1.4], [2, .22, .6], [3.01, .06, .3], [4.02, .03, .2]],
    musik:    [[1, 1, 1.1], [3.99, .22, .32], [6.27, .09, .14], [2, .1, .5]],
    glas:     [[1, 1, 2.8], [2.76, .38, 1.3], [5.4, .18, .7], [8.93, .07, .35]],
    kristall: [[1, 1, 4.2], [2.01, .3, 2.5], [2.76, .22, 1.8], [5.4, .1, .9], [8.1, .05, .5]],
    kalimba:  [[1, 1, 1.1], [5.92, .32, .1], [2, .06, .5], [9.7, .1, .05]],
    kyrka:    [[.5, .55, 9], [1, 1, 7], [1.19, .42, 5], [1.5, .3, 4], [2, .45, 3.6], [2.52, .2, 2.6], [3, .14, 2], [4.17, .08, 1.4]],
    bjallra:  [[1, 1, .5], [2.31, .5, .3], [3.87, .25, .2]]
  };
  function bell(S, kind, m, t, v, pan, d, w, e, hz) {
    const f = hz || mtf(m), p = P(pan || 0); to(S, p, d, w, e);
    for (const [k, a, dec] of BELLS[kind]) { if (f * k > 16000) continue; const o = osc('sine', f * k), g = G(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * a, t + (kind === 'kyrka' ? .012 : .004)); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
      link(o, g, p); o.start(t); o.stop(t + dec + .05); }
    if (kind === 'kalimba') { const n = ac.createBufferSource(), g = G(0); n.buffer = noise('white', 2); const bp = F('bandpass', f * 3, 2); g.gain.setValueAtTime(v * .25, t); g.gain.exponentialRampToValueAtTime(.0001, t + .02); link(n, bp, g, p); n.start(t, Math.random()); n.stop(t + .05); }
    later(S, () => { try { p.disconnect(); } catch (e) {} }, ((t - ac.currentTime) + 10) * 1000);
  }
  const STR = {
    koto:   { id: 'k', bright: .7, damp: .9985, mix: .5, pos: .13, dur: 3.5 },
    harpa:  { id: 'h', bright: .38, damp: .9992, mix: .5, dur: 4 },
    gitarr: { id: 'g', bright: .5, damp: .999, mix: .5, pos: .2, dur: 3.5 },
    pizz:   { id: 'p', bright: .3, damp: .994, mix: .5, dur: 1.2 }
  };
  function pluck(S, kind, m, t, v, pan, d, w, e) {
    const k = ks(m, STR[kind]), s = ac.createBufferSource(), g = G(v), p = P(pan || 0);
    s.buffer = k.buf; s.playbackRate.value = k.rate; link(s, g, p); to(S, p, d, w, e); s.start(t);
    s.onended = () => { try { p.disconnect(); } catch (er) {} };
  }
  // mjuk matta: flera svävande röster genom ett filter som andas; "kor" = formantfilter (a/o/u)
  const VOW = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2530], e: [400, 1600, 2700] };
  function pad(S, notes, t, dur, o) {
    const out = G(0), att = o.att || 3, rel = o.rel || 4, v = o.vol || .03;
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(v, t + att); out.gain.setValueAtTime(v, t + Math.max(att, dur - rel * .4)); out.gain.linearRampToValueAtTime(0, t + dur + rel);
    let head;
    if (o.choir) { head = G(1); const vw = VOW[o.vowel || pick(['a', 'o', 'u'])]; vw.forEach((fq, i) => { const bp = F('bandpass', fq, 9 + i * 3); link(head, bp, G([1, .55, .22][i]), out); });
      const lp = F('lowpass', 3200); head.connect(lp); lp.connect(G(.02)).connect(out); }
    else { head = F('lowpass', o.cut || 900, .6); head.frequency.setValueAtTime(o.cut || 900, t); head.frequency.linearRampToValueAtTime((o.cut || 900) * (o.open || 1.6), t + dur * .5); head.frequency.linearRampToValueAtTime(o.cut || 900, t + dur + rel); head.connect(out); }
    to(S, out, o.d != null ? o.d : .55, o.w != null ? o.w : .6, o.e || 0);
    const types = o.types || ['sawtooth', 'triangle'];
    notes.forEach((m, i) => types.forEach((ty, j) => { const x = osc(ty, mtf(m)); x.detune.value = (j ? 1 : -1) * (o.det || 7) + R(-3, 3); const pg = G(o.choir ? .5 : 1); const pp = P(((i + j) % 2 ? 1 : -1) * R(.2, .6));
      if (o.vib) { const l = osc('sine', R(4.5, 5.5)), lg = G(mtf(m) * .004); link(l, lg, x.frequency); l.start(t); l.stop(t + dur + rel + .1); }
      link(x, pg, pp, head); x.start(t); x.stop(t + dur + rel + .1); }));
    later(S, () => { try { out.disconnect(); } catch (e) {} }, ((t - ac.currentTime) + dur + rel + 1) * 1000);
  }
  // en lång bordunton (grundton + kvint) som ligger under allt
  function drone(S, notes, vol, cut, type) {
    const g = G(vol), lp = F('lowpass', cut || 400, .5); link(lp, g); to(S, g, .7, .5);
    notes.forEach((m, i) => { const o = osc(type || 'sawtooth', mtf(m)); o.detune.value = R(-6, 6); link(o, P(i % 2 ? .4 : -.4), lp); o.start(); S.srcs.push(o); });
    wander(S, g.gain, vol * .6, vol * 1.2, 6, 12); wander(S, lp.frequency, cut * .7, cut * 1.4, 5, 11);
  }
  // flöjt/shakuhachi: ton med andning, glidning in i tonen och vibrato som växer fram
  function flute(S, m, t, dur, v, o) {
    o = o || {}; const f = mtf(m), x = osc(o.type || 'triangle', f * (o.bend ? .94 : 1)), g = G(0), p = P(o.pan || R(-.3, .3)), lp = F('lowpass', f * 4);
    if (o.bend) x.frequency.setTargetAtTime(f, t + .02, .12);
    const vb = osc('sine', 5.2), vg = G(0); link(vb, vg, x.frequency); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .012, t + dur * .8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + Math.min(.25, dur * .3)); g.gain.setValueAtTime(v * .85, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur);
    const n = ac.createBufferSource(); n.buffer = noise('white', 2); const bp = F('bandpass', f * 2, 6), ng = G(0); ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(v * (o.breath || .5), t + .08); ng.gain.linearRampToValueAtTime(v * (o.breath || .5) * .3, t + dur * .5); ng.gain.linearRampToValueAtTime(0, t + dur);
    link(x, lp, g, p); link(n, bp, ng, p); to(S, p, .5, .7, o.e != null ? o.e : .35); x.start(t); vb.start(t); n.start(t, Math.random()); x.stop(t + dur + .1); vb.stop(t + dur + .1); n.stop(t + dur + .1);
  }

  /* ================= naturljud och händelser ================= */
  function windBed(S, lo, hi, vol, q) {
    const f = F('bandpass', (lo + hi) / 2, q || .9), g = G(vol), p = P(R(-.3, .3)); link(loop(S, noise('pink', 10)), f, g, p); to(S, p, .8, .3);
    const gust = () => { const s = Math.pow(Math.random(), 1.3), d = R(2, 5), t = ac.currentTime; f.frequency.setTargetAtTime(lo + (hi - lo) * s, t, d / 3); g.gain.setTargetAtTime(vol * (.3 + s), t, d / 3); later(S, gust, d * R(700, 1200)); }; gust();
  }
  function whistleWind(S, vol) {
    windBed(S, 200, 700, vol * .7);
    [[520, 1250, 24, .5], [780, 1900, 30, .3], [1150, 2600, 34, .18]].forEach(([f0, f1, q, a]) => { const f = F('bandpass', f0, q), g = G(0), p = P(R(-.6, .6)); link(loop(S, noise('pink', 10)), f, g, p); to(S, p, .6, .5);
      const gust = () => { const s = Math.pow(Math.random(), 1.2), d = R(1.5, 4.5), t = ac.currentTime; f.frequency.setTargetAtTime(f0 + (f1 - f0) * s, t, d / 2.5); g.gain.setTargetAtTime(vol * a * Math.max(0, s - .25) * 1.4, t, d / 3); later(S, gust, d * R(600, 1200)); }; gust(); });
  }
  function rumble(S, cut, vol) { const f = F('lowpass', cut), g = G(vol); link(loop(S, noise('brown', 8)), f, g); to(S, g, .9, .3); wander(S, g.gain, vol * .6, vol * 1.3, 4, 9); wander(S, f.frequency, cut * .7, cut * 1.4, 4, 9); }
  const cricketBuf = () => grains('crk', 9, (add, sr, sec) => {
    for (let c = 0; c < 5; c++) { const f = R(3900, 5200), per = R(.42, .8), pan = R(-.9, .9), a = R(.03, .07); let t = Math.random() * per;
      while (t < sec) { for (let p = 0; p < 3; p++) { const len = Math.floor(sr * .014), w = 2 * Math.PI * f / sr; add(t + p * .028, len, pan, k => Math.sin(w * k) * Math.sin(Math.PI * k / len) * a); } t += per * R(.9, 1.1); } } });
  const cicadaBuf = () => grains('cic', 11, (add, sr, sec) => {
    for (let c = 0; c < 3; c++) { const f = R(4800, 6200), pan = R(-.8, .8); let t = Math.random() * 2;
      while (t < sec) { const len = R(1.5, 3.5), rate = R(90, 140); for (let x = 0; x < len; x += 1 / rate) { const env = Math.sin(Math.PI * x / len), l = Math.floor(sr * .004), w = 2 * Math.PI * f / sr; add(t + x, l, pan, k => (Math.sin(w * k) * .6 + (Math.random() - .5) * .5) * Math.sin(Math.PI * k / l) * .05 * env); } t += len + R(1, 3); } } });
  const crackBuf = () => grains('crack', 11, (add, sr, sec) => {
    for (let i = 0; i < sec * 9; i++) { const t = Math.random() * sec, m = Math.random() < .3 ? 1 + Math.floor(Math.random() * 4) : 1, a0 = Math.pow(Math.random(), 3) * .8 + .04, pan = R(-.7, .7);
      for (let j = 0; j < m; j++) { const tau = sr * R(.0004, .0028), len = Math.floor(tau * 7) + 8, a = a0 * (j ? R(.3, .8) : 1); let lp = 0, kk = R(.15, .6);
        add(t + j * R(.006, .05), len, pan, k => { lp += ((Math.random() * 2 - 1) - lp) * kk; return lp * Math.exp(-k / tau) * a; }); } } });
  const bubBuf = () => grains('bub', 13, (add, sr, sec) => {
    const one = (t, f0, a, pan) => { const dur = Math.min(.16, 40 / f0 + .02), len = Math.floor(sr * dur), rise = R(1.15, 1.55), tau = len / 4; let ph = 0;
      add(t, len, pan, k => { ph += 2 * Math.PI * f0 * (1 + (rise - 1) * k / len) / sr; return Math.sin(ph) * Math.min(1, k / (sr * .003)) * Math.exp(-k / tau) * a; }); };
    for (let i = 0; i < sec * 1.2; i++) { let t = Math.random() * sec, f = R(300, 900); const m = 2 + Math.floor(Math.random() * 7), pan = R(-.8, .8); for (let j = 0; j < m; j++) { one(t, f, R(.05, .16) * (700 / (f + 300)), pan + R(-.15, .15)); t += R(.04, .14); f *= R(1.02, 1.2); } } });
  const fizzBuf = () => grains('fizz', 6, (add, sr, sec) => { for (let i = 0; i < sec * 1400; i++) { const a = Math.pow(Math.random(), 2) * .16, len = 6 + Math.floor(Math.random() * 18); add(Math.random() * sec, len, R(-1, 1), k => (Math.random() * 2 - 1) * (1 - k / len) * a); } });
  const glitterBuf = () => grains('glit', 3, (add, sr, sec) => { for (let i = 0; i < 900; i++) { const t = Math.pow(Math.random(), .7) * sec * .9, a = Math.pow(Math.random(), 2) * .5 * (1 - t / sec), len = 10 + Math.floor(Math.random() * 40); let lp = 0;
    add(t, len, R(-1, 1), k => { lp += ((Math.random() * 2 - 1) - lp) * .7; return lp * Math.exp(-k / (len / 4)) * a; }); } });
  // en skakning av bjällror (flera små klockor som slår nästan samtidigt), räknas ut i förväg i några varianter
  const jingleBuf = i => grains('jing' + i, .6, (add, sr) => {
    for (let b = 0; b < 9; b++) { const t = Math.random() * .05, base = R(3600, 6800), pan = R(-.6, .6), a = R(.05, .12);
      [[1, 1, .09], [1.47, .6, .06], [2.09, .35, .045], [2.83, .2, .03]].forEach(([k, am, dec]) => { const w = 2 * Math.PI * base * k / sr, len = Math.floor(sr * dec * 5); if (base * k > sr / 2.2) return; add(t, len, pan, s => Math.sin(w * s) * am * a * Math.exp(-s / (sr * dec))); });
      const cl = Math.floor(sr * .004); add(t, cl, pan, s => (Math.random() * 2 - 1) * a * .5 * (1 - s / cl)); } });
  function sleigh(S, vol) {   // släden passerar: bjällrorna i galopp kommer närmare, går förbi och försvinner
    const T = R(8, 12), t0 = ac.currentTime + .1, dir = Math.random() < .5 ? -1 : 1, lp = F('lowpass', 2500), p = P(dir * -.95), g = G(1);
    link(lp, g, p); to(S, p, .8, .55, .1);
    lp.frequency.setValueAtTime(2500, t0); lp.frequency.linearRampToValueAtTime(14000, t0 + T * .5); lp.frequency.linearRampToValueAtTime(2200, t0 + T);
    if (p.pan) { p.pan.setValueAtTime(dir * -.95, t0); p.pan.linearRampToValueAtTime(dir * .95, t0 + T); }
    const beat = R(.2, .25);
    for (let t = 0; t < T; t += beat) { const x = t / T, near = Math.pow(Math.sin(Math.PI * x), 1.6), s = ac.createBufferSource(), sg = G(vol * (.12 + near) * (Math.floor(t / beat) % 2 ? .6 : 1));
      s.buffer = jingleBuf(Math.floor(Math.random() * 4)); s.playbackRate.value = 1.03 - .06 * x; link(s, sg, lp); s.start(t0 + t + R(0, .015)); }
    later(S, () => { try { p.disconnect(); } catch (e) {} }, T * 1000 + 3000);
  }
  function churchBells(S, vol) { const t = ac.currentTime + .1, base = pick([196, 220, 247]), n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) bell(S, 'kyrka', 0, t + i * R(2.2, 2.8), vol, R(-.3, .3), .15, .9, 0, base * (i % 2 ? 1 : 1.122)); }
  function owl(S, vol) { const t = ac.currentTime + .1, pan = R(-.8, .8), pat = Math.random() < .5 ? [[0, .55], [1.3, .18], [1.55, .18], [1.8, .7]] : [[0, .6], [.9, .6]];
    pat.forEach(([dt, d]) => { const o = osc('sine', 390), o2 = osc('sine', 780), g = G(0), g2 = G(.08), lp = F('lowpass', 900), p = P(pan); o.frequency.setValueAtTime(400, t + dt); o.frequency.linearRampToValueAtTime(360, t + dt + d); o2.frequency.setValueAtTime(800, t + dt); o2.frequency.linearRampToValueAtTime(720, t + dt + d);
      g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(vol, t + dt + .07); g.gain.setValueAtTime(vol, t + dt + d * .6); g.gain.linearRampToValueAtTime(0, t + dt + d);
      link(o, g); link(o2, g2, g); link(g, lp, p); to(S, p, .4, .9); o.start(t + dt); o2.start(t + dt); o.stop(t + dt + d + .05); o2.stop(t + dt + d + .05); }); }
  function bird(S, vol, hi) { const t0 = ac.currentTime + .05, pan = R(-.9, .9), p = P(pan), base = R(2600, 4200) * (hi || 1), n = 2 + Math.floor(Math.random() * 6), trill = Math.random() < .35; to(S, p, .5, .5, .15);
    for (let i = 0; i < n; i++) { const t = t0 + i * (trill ? .07 : R(.12, .22)), o = osc('sine', base), g = G(0), d = trill ? .05 : R(.06, .14), up = Math.random() < .5;
      o.frequency.setValueAtTime(base * (up ? .8 : 1.25), t); o.frequency.exponentialRampToValueAtTime(base * (up ? 1.3 : .85), t + d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d); link(o, g, p); o.start(t); o.stop(t + d + .02); } }
  function whale(S, vol) { const t = ac.currentTime + .1, d = R(3, 6), f0 = R(140, 260), o = osc('sawtooth', f0), g = G(0), bp = F('bandpass', 500, 2.5), lp = F('lowpass', 900), p = P(R(-.6, .6)), vb = osc('sine', R(3, 6)), vg = G(f0 * .02);
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * R(1.4, 2.2), t + d * .45); o.frequency.exponentialRampToValueAtTime(f0 * R(.7, 1), t + d);
    link(vb, vg, o.frequency); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + d * .3); g.gain.linearRampToValueAtTime(vol * .6, t + d * .7); g.gain.linearRampToValueAtTime(0, t + d);
    link(o, bp, lp, g, p); to(S, p, .25, 1.2, .3); o.start(t); vb.start(t); o.stop(t + d + .1); vb.stop(t + d + .1); }
  function swoosh(S, vol, dur, lo, hi) { const t = ac.currentTime + .05, d = dur || R(1.2, 2), n = ac.createBufferSource(), bp = F('bandpass', lo || 600, 1.4), g = G(0), dir = Math.random() < .5 ? -1 : 1, p = P(-dir);
    n.buffer = noise('pink', 10); bp.frequency.setValueAtTime(lo || 600, t); bp.frequency.exponentialRampToValueAtTime(hi || 2800, t + d * .5); bp.frequency.exponentialRampToValueAtTime(lo || 600, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + d * .5); g.gain.linearRampToValueAtTime(0, t + d); if (p.pan) p.pan.linearRampToValueAtTime(dir, t + d);
    link(n, bp, g, p); to(S, p, .7, .4); n.start(t, Math.random() * 5); n.stop(t + d + .1); }
  function boom(S, t, vol, cut, dist) {   // dov smäll med eftermuller
    const n = ac.createBufferSource(), lp = F('lowpass', cut), g = G(0), p = P(R(-.7, .7)); n.buffer = noise('brown', 8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(vol * .2, t + .35); g.gain.exponentialRampToValueAtTime(.0001, t + 2.5);
    const o = osc('sine', 75), og = G(0); o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(32, t + .5); og.gain.setValueAtTime(vol * 1.1, t); og.gain.exponentialRampToValueAtTime(.0001, t + .9);
    link(n, lp, g, p); link(o, og, p); to(S, p, .8 - dist * .4, .6 + dist * .5); n.start(t, Math.random() * 6); n.stop(t + 2.6); o.start(t); o.stop(t + 1); }
  function firework(S, big) {
    const t = ac.currentTime + .05, dist = Math.random(), climb = R(.9, 1.6), v = (big ? 1 : .55) * (1 - dist * .55);
    // uppskjutning: väsande visselton som stiger
    const n = ac.createBufferSource(), bp = F('bandpass', 900, 8), g = G(0), p = P(R(-.8, .8)); n.buffer = noise('white', 2);
    bp.frequency.setValueAtTime(R(700, 1000), t); bp.frequency.exponentialRampToValueAtTime(R(2200, 3400), t + climb);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .16, t + .1); g.gain.linearRampToValueAtTime(v * .05, t + climb); g.gain.linearRampToValueAtTime(0, t + climb + .05);
    link(n, bp, g, p); to(S, p, .6, .5); n.start(t, Math.random()); n.stop(t + climb + .1);
    const tb = t + climb; boom(S, tb, v * .5, 600 - dist * 350, dist);
    if (Math.random() < .7) { const c = ac.createBufferSource(), cg = G(v * .9), hp = F('highpass', 1500), cp = P(R(-.8, .8)); c.buffer = glitterBuf(); link(c, hp, cg, cp); to(S, cp, .6, .5); c.start(tb + R(.25, .5)); }
  }
  function pop(S, vol) { const t = ac.currentTime + .05, o = osc('sine', 160), g = G(0), p = P(R(-.5, .5)); o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(70, t + .07);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .1); link(o, g, p); to(S, p, .8, .3); o.start(t); o.stop(t + .12);
    const f = ac.createBufferSource(), fg = G(0), hp = F('highpass', 2500); f.buffer = fizzBuf(); fg.gain.setValueAtTime(0, t + .1); fg.gain.linearRampToValueAtTime(vol * 1.2, t + .3); fg.gain.linearRampToValueAtTime(0, t + 5); link(f, hp, fg, p); f.start(t + .1); f.stop(t + 5.2); }
  function clink(S, vol) { const t = ac.currentTime + .05, f = R(2600, 3400); bell(S, 'glas', 0, t, vol, R(-.5, .5), .6, .4, 0, f); bell(S, 'glas', 0, t + R(.008, .02), vol * .8, R(-.5, .5), .6, .4, 0, f * R(1.03, 1.08)); }
  function roar(S, vol) {   // en drake långt borta: ett mäktigt men avlägset vrål, sedan några vingslag
    const t = ac.currentTime + .1, d = R(2.2, 3.4), o = osc('sawtooth', 85), o2 = osc('sawtooth', 128), am = osc('sine', 28), amg = G(.35), g = G(0), f1 = F('bandpass', 520, 3), f2 = F('bandpass', 950, 4), lp = F('lowpass', 1400), p = P(R(-.7, .7));
    o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(118, t + d * .3); o.frequency.exponentialRampToValueAtTime(62, t + d); o2.frequency.setValueAtTime(140, t); o2.frequency.exponentialRampToValueAtTime(90, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .35); g.gain.setValueAtTime(vol * .9, t + d * .6); g.gain.linearRampToValueAtTime(0, t + d);
    link(am, amg, g.gain); const mix = G(1); link(o, mix); link(o2, G(.6), mix); mix.connect(f1); mix.connect(f2); const sum = G(1); f1.connect(sum); link(f2, G(.6), sum);
    const n = ac.createBufferSource(), nb = F('bandpass', 700, .8), ng = G(.6); n.buffer = noise('pink', 10); link(n, nb, ng, g);
    link(sum, g, lp, p); to(S, p, .25, 1.3); [o, o2, am].forEach(x => { x.start(t); x.stop(t + d + .1); }); n.start(t, Math.random() * 5); n.stop(t + d + .1);
    for (let i = 0; i < 4; i++) { const tw = t + d + .4 + i * R(.55, .7), w = ac.createBufferSource(), wl = F('lowpass', 260), wg = G(0); w.buffer = noise('brown', 8);
      wg.gain.setValueAtTime(0, tw); wg.gain.linearRampToValueAtTime(vol * 1.4 * (1 - i * .18), tw + .12); wg.gain.exponentialRampToValueAtTime(.0001, tw + .5); link(w, wl, wg, p); w.start(tw, Math.random() * 6); w.stop(tw + .6); }
  }
  function timpani(S, vol, roll) { const t = ac.currentTime + .05, n = roll ? 10 : 1;
    for (let i = 0; i < n; i++) { const tt = t + i * .07, a = vol * (roll ? .3 + .7 * i / n : 1), o = osc('sine', 70), g = G(0); o.frequency.setValueAtTime(78, tt); o.frequency.exponentialRampToValueAtTime(64, tt + .3);
      g.gain.setValueAtTime(a, tt); g.gain.exponentialRampToValueAtTime(.0001, tt + (i === n - 1 ? 2.2 : .3)); const p = P(-.2); link(o, g, p); to(S, p, .4, .9); o.start(tt); o.stop(tt + 2.3); } }
  function blips(S, vol) {   // radiosignaler från rymden: små pip i mönster
    const t0 = ac.currentTime + .05, f = pick([880, 1320, 1760, 2093]), n = 3 + Math.floor(Math.random() * 6), p = P(R(-.8, .8)), bp = F('bandpass', f, 3); link(bp, p); to(S, p, .5, .6, .5);
    let t = t0; for (let i = 0; i < n; i++) { const d = Math.random() < .3 ? .16 : .05, o = osc(pick(['sine', 'square']), f * (Math.random() < .2 ? 1.5 : 1)), g = G(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.setValueAtTime(vol, t + d); g.gain.linearRampToValueAtTime(0, t + d + .01);
      link(o, g, bp); o.start(t); o.stop(t + d + .02); t += d + R(.05, .12); } }
  function shishi(S, vol) { const t = ac.currentTime + .1;   // bambuns knack när den tippar, och vattnet som rinner ut
    const o = osc('sine', 820), g = G(0), n = ac.createBufferSource(), bp = F('bandpass', 1400, 5), ng = G(0), p = P(R(-.5, .5)); n.buffer = noise('white', 2);
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(600, t + .06); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18); ng.gain.setValueAtTime(vol * .7, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .05);
    link(o, g, p); link(n, bp, ng, p); to(S, p, .5, 1.1); o.start(t); o.stop(t + .2); n.start(t, Math.random()); n.stop(t + .08);
    const w = ac.createBufferSource(), wb = F('bandpass', 2200, 1), wg = G(0); w.buffer = noise('pink', 10); wg.gain.setValueAtTime(0, t + .05); wg.gain.linearRampToValueAtTime(vol * .25, t + .2); wg.gain.linearRampToValueAtTime(0, t + 1.3); link(w, wb, wg, p); w.start(t, Math.random() * 5); w.stop(t + 1.4); }
  function waves(S, vol) { const t = ac.currentTime + .05, B = R(1.6, 2.8), W = R(4, 6.5), s = ac.createBufferSource(), f = F('lowpass', 220), g = G(0), p = P(R(-.6, .6)); s.buffer = noise('pink', 10);
    f.frequency.setValueAtTime(220, t); f.frequency.exponentialRampToValueAtTime(R(1800, 3200), t + B); f.frequency.exponentialRampToValueAtTime(400, t + B + W);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * .2, t + B * .7); g.gain.linearRampToValueAtTime(vol, t + B); g.gain.exponentialRampToValueAtTime(vol * .25, t + B + 1); g.gain.linearRampToValueAtTime(0, t + B + W);
    link(s, f, g, p); to(S, p, .8, .4); s.start(t, Math.random() * 5); s.stop(t + B + W + .1); }
  function brook(S, vol) { fetch(location.pathname.replace(/[^/]*$/, '') + 'snd/brook.m4a').then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(a => new Promise((res, rej) => ac.decodeAudioData(a, res, rej)))
    .then(buf => { if (!S.alive) return; const s = loop(S, buf), g = G(vol), lp = F('lowpass', 6000); link(s, lp, g); to(S, g, .9, .3); }).catch(() => {}); }

  /* ================= generativ musik ================= */
  // fraser: en slumpvandring i skalan med ackordtoner på betonade slag; vila mellan fraserna
  function music(S, M) {
    const sc = M.scale, deg = d => M.root + 12 * Math.floor(d / sc.length) + sc[((d % sc.length) + sc.length) % sc.length], CB = M.chordBars || 2, beat = M.bar / (M.beats || 4);
    let next = ac.currentTime + .5, bar = 0, last = M.lo != null ? M.lo + 3 : 4, melNext = next + M.bar * (M.pad ? 1 : 0);
    const tick = () => {
      while (next < ac.currentTime + 1.5) {
        const t = next, chord = M.prog[Math.floor(bar / CB) % M.prog.length];
        if (bar % CB === 0) {
          if (M.pad) pad(S, chord.map(d => deg(d) + (M.padOct || 0)), t, M.bar * CB, M.pad);
          if (M.bass) M.bass(t, deg(chord[0]) - 12 + (M.bassOct || 0));
        }
        if (M.arp && bar % (M.arpEvery || 1) === 0) M.arp(t, chord.map(deg));
        if (M.mel && t >= melNext - .01) {
          if (Math.random() < (M.restP != null ? M.restP : .5)) melNext = t + M.bar * Math.floor(R(1, (M.maxRest || 2) + 1));
          else {   // en fras: slumpvandring i skalan, slutar på en ackordton
            const len = 3 + Math.floor(Math.random() * (M.maxLen || 5)), lo = M.lo || 0, hi = M.hi || 9; let d = last, tt = t;
            for (let i = 0; i < len; i++) {
              d += pick([-2, -1, -1, 1, 1, 2, 0, 3, -3]); d = Math.max(lo, Math.min(hi, d));
              if (i === len - 1) { const tones = []; for (let k = lo; k <= hi; k++) if (chord.some(c => ((k - c) % sc.length + sc.length) % sc.length === 0)) tones.push(k); if (tones.length) d = tones.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a); }
              const dur = pick(M.rhythm || [1, 1, 2, .5]) * beat; M.mel(tt + R(0, .012), deg(d), dur); tt += dur;
            }
            last = d; melNext = t + Math.ceil((tt - t) / M.bar) * M.bar;
          }
        }
        next += M.bar; bar++;
      }
    };
    tick(); const iv = setInterval(() => { if (S.alive) tick(); }, 300); S.timers.push(iv);
  }

  /* ================= världarna ================= */
  const TH = {
    // Djuphavet: dovt havsdjup, bubblor, valsång och ett mjukt ekolod
    hav: { gain: 0.56, room: 6, bright: .3, wet: 1.1, echo: .9, fb: .5, go(S) {
      rumble(S, 260, .16); const b = G(.9), lp = F('lowpass', 2600); link(loop(S, bubBuf()), lp, b); to(S, b, .5, .5);
      music(S, { root: 45, scale: [0, 2, 3, 5, 7, 8, 10], bar: 6, chordBars: 2, prog: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]], pad: { vol: .018, cut: 520, att: 5, rel: 7, types: ['triangle', 'sine'], det: 9 } });
      every(S, () => whale(S, .05), 22000, 50000, 6000);
      every(S, () => bell(S, 'glas', 0, ac.currentTime + .1, .025, R(-.6, .6), .1, .9, .5, pick([440, 523, 587, 659, 784])), 9000, 20000);
    } },
    // Solnedgång: gitarr i varm dur, vågor långt bort, syrsorna börjar spela
    sol: { gain: 0.84, room: 3.2, bright: .5, echo: .5, go(S) {
      every(S, () => waves(S, .09), 6000, 10000, 500);
      const c = G(.35), hp = F('highpass', 3000); link(loop(S, cricketBuf()), hp, c); to(S, c, .6, .3); wander(S, c.gain, .15, .45, 6, 12);
      music(S, { root: 50, scale: [0, 2, 4, 7, 9, 11], bar: 3.2, chordBars: 2, prog: [[0, 2, 4, 6], [3, 5, 7, 9], [5, 7, 9], [2, 4, 6, 8]], pad: { vol: .014, cut: 700, types: ['triangle', 'sine'] },
        arp: (t, ns) => ns.concat(ns[1] + 12).forEach((m, i) => { if (Math.random() < .85) pluck(S, 'gitarr', m, t + i * .32 + R(0, .02), .16, -.2 + i * .1, .7, .4, .1); }), arpEvery: 1 });
      every(S, () => bird(S, .012, .7), 15000, 35000);
    } },
    // Skogsnatt: syrsor, löv som prasslar, en uggla, eldflugor som små glasklockor
    skog: { gain: 1.5, room: 4.5, bright: .35, echo: .6, go(S) {
      const c = G(.7), hp = F('highpass', 2800); link(loop(S, cricketBuf()), hp, c); to(S, c, .7, .35); wander(S, c.gain, .45, .85, 5, 10);
      windBed(S, 400, 1600, .06, 1.2); drone(S, [40, 47], .012, 300, 'triangle');
      every(S, () => owl(S, .07), 25000, 60000, 9000);
      music(S, { root: 64, scale: [0, 2, 3, 7, 9], bar: 4, beats: 4, prog: [[0], [3], [2], [4]], lo: 3, hi: 11, restP: .6, rhythm: [1, 2, 1, 3],
        mel: (t, m, d) => bell(S, 'glas', m, t, .02, R(-.8, .8), .15, .8, .45) });
    } },
    // Leopard: savannen i skymning – cikador, kalimba och en mjuk handtrumma
    leopard: { gain: 1, room: 3, bright: .45, echo: .55, go(S) {
      const c = G(.55), hp = F('highpass', 3500); link(loop(S, cicadaBuf()), hp, c); to(S, c, .6, .3); wander(S, c.gain, .25, .65, 6, 12);
      drone(S, [41, 48], .014, 350, 'triangle'); windBed(S, 300, 900, .03);
      music(S, { root: 60, scale: [0, 2, 4, 7, 9], bar: 2.8, beats: 4, prog: [[0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4]], lo: 2, hi: 10, restP: .35, rhythm: [1, .5, 1, 2],
        mel: (t, m) => bell(S, 'kalimba', m, t, .09, R(-.4, .4), .7, .3, .25),
        bass: (t, m) => [0, .7, 1.05].forEach((dt, i) => { if (i && Math.random() < .3) return; const o = osc('sine', mtf(m - 12) * 1.5), g = G(0), tt = t + dt; o.frequency.setValueAtTime(mtf(m - 12) * 1.8, tt); o.frequency.exponentialRampToValueAtTime(mtf(m - 12) * 1.3, tt + .2); g.gain.setValueAtTime(i ? .05 : .08, tt); g.gain.exponentialRampToValueAtTime(.0001, tt + .45); link(o, g); to(S, g, .8, .3); o.start(tt); o.stop(tt + .5); }) });
      every(S, () => bird(S, .01, .45), 20000, 45000);
    } },
    // Molnljus: luftigt – fåglar, speldosa och harpa i ljus dur
    ljus: { gain: 2, room: 3.6, bright: .6, echo: .45, go(S) {
      windBed(S, 500, 1800, .035, 1.1);
      every(S, () => bird(S, .016), 4000, 11000, 1500);
      music(S, { root: 65, scale: [0, 2, 4, 6, 7, 9, 11], bar: 2.6, beats: 4, prog: [[0, 2, 4], [1, 3, 5], [3, 5, 7], [4, 6, 8]], pad: { vol: .01, cut: 1400, types: ['sine', 'triangle'] }, restP: .45, rhythm: [1, 1, .5, 2],
        mel: (t, m) => bell(S, 'musik', m + 12, t, .05, R(-.5, .5), .5, .45, .3), arp: (t, ns) => ns.forEach((m, i) => pluck(S, 'harpa', m, t + i * .2, .08, R(-.5, .5), .5, .5, .1)), arpEvery: 2 });
    } },
    // Ren & enkel: nästan tyst – en varm ton och ett enstaka anslag
    ren: { gain: 2.5, room: 3.5, bright: .35, go(S) {
      drone(S, [48, 55], .008, 280, 'sine');
      every(S, () => pluck(S, 'harpa', pick([60, 62, 64, 67, 69, 72]), ac.currentTime + .1, .07, R(-.4, .4), .4, .6, .2), 7000, 15000);
    } },
    // Vinterfjäll: vinande fjällvind, kalla kristallklockor, ett kor i fjärran och skidåkare som susar förbi
    vinter: { gain: 1.8, room: 5, bright: .55, echo: .6, fb: .45, go(S) {
      whistleWind(S, .09);
      music(S, { root: 52, scale: [0, 2, 4, 6, 7, 9, 11], bar: 5, beats: 4, chordBars: 2, prog: [[0, 4, 8], [3, 7, 9], [5, 9, 11], [4, 8, 11]], pad: { vol: .02, choir: 1, att: 4, rel: 6, vib: 1, d: .4, w: .9 },
        lo: 7, hi: 16, restP: .55, rhythm: [1, 2, 1, 3], mel: (t, m) => bell(S, 'kristall', m, t, .03, R(-.7, .7), .3, .9, .4) });
      every(S, () => swoosh(S, .05, R(1.4, 2.2), 500, 2600), 14000, 30000, 7000);
    } },
    // Rymdäventyr: djup bordun, svävande syntmatta, arpeggion med eko, radiosignaler och en raket som dånar förbi
    kosmos: { gain: 0.42, room: 6, bright: .45, wet: 1, echo: .55, fb: .5, go(S) {
      const sub = G(.05); [36.7, 36.95].forEach(f => { const o = osc('sine', f * 1.5); link(o, sub); o.start(); S.srcs.push(o); }); to(S, sub, .8, .2); wander(S, sub.gain, .03, .06, 5, 10);
      music(S, { root: 49, scale: [0, 3, 5, 7, 10], bar: 4.4, beats: 8, chordBars: 2, prog: [[0, 2, 4], [3, 5, 7], [1, 3, 5], [4, 6, 8]], pad: { vol: .016, cut: 1100, open: 2.4, att: 4, rel: 6, det: 12 },
        arp: (t, ns) => { const seq = [ns[0] + 12, ns[1] + 12, ns[2] + 12, ns[1] + 24]; for (let i = 0; i < 8; i++) { const m = seq[i % 4], tt = t + i * 4.4 / 8; if (Math.random() < .8) { const o = osc('sine', mtf(m)), o2 = osc('triangle', mtf(m) * 2.002), g = G(0), p = P(Math.sin(i) * .6);
          g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.022, tt + .01); g.gain.exponentialRampToValueAtTime(.0001, tt + .5); link(o, g); link(o2, G(.25), g); link(g, p); to(S, p, .5, .5, .6); o.start(tt); o2.start(tt); o.stop(tt + .55); o2.stop(tt + .55); } } }, arpEvery: 2 });
      every(S, () => blips(S, .012), 9000, 24000, 4000);
      every(S, () => { const t = ac.currentTime, d = R(6, 9), n = ac.createBufferSource(), lp = F('lowpass', 120), g = G(0), p = P(-1); n.buffer = noise('brown', 8);
        lp.frequency.setValueAtTime(120, t); lp.frequency.linearRampToValueAtTime(700, t + d * .5); lp.frequency.linearRampToValueAtTime(150, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + d * .5); g.gain.linearRampToValueAtTime(0, t + d);
        if (p.pan) p.pan.linearRampToValueAtTime(1, t + d); link(n, lp, g, p); to(S, p, .8, .4); n.start(t, Math.random() * 6); n.stop(t + d + .1); }, 35000, 70000, 15000);
    } },
    // Norrsken: stilla arktisk natt – ett eteriskt kor, glittrande glas som norrskenet och en renbjällra långt bort
    norrsken: { gain: 2.6, room: 6.5, bright: .4, wet: 1.1, echo: .7, fb: .45, go(S) {
      windBed(S, 250, 800, .04, .8);
      music(S, { root: 50, scale: [0, 2, 4, 7, 9], bar: 6, chordBars: 2, prog: [[0, 2, 4], [3, 5, 7], [1, 3, 5], [2, 4, 6]], pad: { vol: .026, choir: 1, att: 5, rel: 8, vib: 1, d: .35, w: 1 } });
      every(S, () => { const t = ac.currentTime + .1, base = 74 + pick([0, 2, 4, 7, 9]); for (let i = 0; i < 6; i++) bell(S, 'kristall', base + [0, 2, 4, 7, 9, 12][i] - (Math.random() < .5 ? 12 : 0), t + i * R(.09, .16), .012 * (1 - i / 8), R(-.9, .9), .1, .9, .6); }, 7000, 16000, 3000);
      every(S, () => { const t = ac.currentTime + .1; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) bell(S, 'bjallra', 0, t + i * R(.3, .6), .02, R(-.8, .8), .2, .8, 0, R(900, 1100)); }, 20000, 45000, 12000);
    } },
    // Körsbärsträdgård: koto i japansk pentaton, en bäck, bambuns knack, vindspel och en shakuhachi ibland
    sakura: { gain: 0.67, room: 3.8, bright: .45, echo: .5, go(S) {
      brook(S, .45); windBed(S, 600, 1800, .025);
      music(S, { root: 57, scale: [0, 2, 5, 7, 9], bar: 3.6, beats: 4, prog: [[0, 2, 4], [3, 5, 7], [1, 3, 5], [4, 6, 8]], lo: 2, hi: 11, restP: .45, rhythm: [1, 1, 2, .5, 3],
        mel: (t, m) => pluck(S, 'koto', m, t, .2, R(-.4, .4), .6, .45, .2) });
      every(S, () => shishi(S, .08), 24000, 50000, 10000);
      every(S, () => { const t = ac.currentTime + .1; for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) bell(S, 'glas', pick([81, 84, 86, 88, 91, 93]), t + i * R(.15, .4), .015, R(-.7, .7), .3, .6, .2); }, 12000, 26000);
      every(S, () => { let t = ac.currentTime + .1; const ph = [[69, 1.6], [72, .8], [74, 2.4], [72, .6], [69, 2]]; const st = Math.floor(Math.random() * 2); ph.slice(st, st + 3 + Math.floor(Math.random() * 2)).forEach(([m, d]) => { flute(S, m + (Math.random() < .3 ? -12 : 0), t, d, .035, { bend: 1, breath: .9 }); t += d + .1; }); }, 35000, 70000, 20000);
    } },
    // Godislandet: lekfull speldosa, pizzicato, glittriga klockor och små godisploppar
    godis: { gain: 1.4, room: 2.6, bright: .6, echo: .36, fb: .3, go(S) {
      music(S, { root: 67, scale: [0, 2, 4, 5, 7, 9, 11], bar: 2.2, beats: 4, prog: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8, 10]], pad: { vol: .009, cut: 1600, types: ['sine', 'triangle'] }, restP: .4, rhythm: [1, .5, .5, 1, 2], lo: 0, hi: 9,
        mel: (t, m) => bell(S, 'musik', m + 12, t, .055, R(-.3, .3), .6, .35, .25),
        bass: (t, m) => [0, 1.1].forEach((dt, i) => pluck(S, 'pizz', m - (i ? 5 : 0), t + dt, .14, -.2, .8, .2)) });
      every(S, () => { const t = ac.currentTime + .05, o = osc('sine', 500), g = G(0), p = P(R(-.7, .7)), up = Math.random() < .6; o.frequency.setValueAtTime(up ? 400 : 1400, t); o.frequency.exponentialRampToValueAtTime(up ? 1500 : 500, t + .14);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.03, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .18); link(o, g, p); to(S, p, .6, .4, .3); o.start(t); o.stop(t + .2); }, 6000, 15000);
      every(S, () => { const t = ac.currentTime + .1; [0, 4, 7, 12, 16].forEach((x, i) => bell(S, 'celesta', 84 + x, t + i * .06, .02, -.6 + i * .3, .3, .6, .4)); }, 18000, 35000);
    } },
    // Drakdalen: mörk bordun, ett kor i moll, harpa, pukor långt bort, lava som mullrar och en drake som vrålar i fjärran
    drakar: { gain: 0.5, room: 5.5, bright: .35, wet: 1, echo: .6, go(S) {
      drone(S, [38, 45], .022, 420); rumble(S, 140, .1); windBed(S, 200, 600, .04);
      music(S, { root: 50, scale: [0, 2, 3, 5, 7, 8, 10], bar: 4.8, beats: 4, chordBars: 2, prog: [[0, 2, 4], [5, 7, 9], [6, 8, 10], [4, 6, 8]], pad: { vol: .02, choir: 1, vowel: 'o', att: 3, rel: 6, d: .4, w: .9 },
        arp: (t, ns) => ns.concat(ns[0] + 12, ns[2] + 12).forEach((m, i) => { if (Math.random() < .85) pluck(S, 'harpa', m, t + i * .3, .1, -.5 + i * .2, .5, .6, .15); }), arpEvery: 2 });
      every(S, () => timpani(S, .12, Math.random() < .5), 18000, 40000, 8000);
      every(S, () => roar(S, .05), 40000, 90000, 20000);
    } },
    // Jul: en släde med bjällror passerar, brasan sprakar, kyrkklockor långt bort och en varm speldosa
    jul: { gain: 0.8, room: 3.4, bright: .5, echo: .4, fb: .32, go(S) {
      const cr = G(1.1); link(loop(S, crackBuf()), F('highpass', 350), F('lowpass', 5200), cr); to(S, cr, .8, .2); wander(S, cr.gain, .7, 1.4, 2, 6); rumble(S, 240, .05);
      windBed(S, 300, 1000, .03);
      music(S, { root: 65, scale: [0, 2, 4, 5, 7, 9, 11], bar: 3, beats: 4, chordBars: 1, prog: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8, 10], [0, 2, 4], [1, 3, 5], [4, 6, 8], [0, 2, 4]],
        pad: { vol: .012, cut: 1000, att: 1.5, rel: 3, types: ['sawtooth', 'triangle'] }, restP: .3, rhythm: [1, 1, 2, .5], lo: 2, hi: 11,
        mel: (t, m) => bell(S, 'celesta', m + 12, t, .05, R(-.3, .3), .55, .45, .25), bass: (t, m) => pluck(S, 'harpa', m, t, .1, -.3, .6, .3) });
      every(S, () => sleigh(S, .7), 20000, 42000, 5000);
      every(S, () => churchBells(S, .03), 60000, 120000, 30000);
    } },
    // Nyår: fyrverkerier nära och långt bort, en champagnekork, glas som klingar och en förväntansfull matta
    nyar: { gain: 0.63, room: 4.5, bright: .45, echo: .5, go(S) {
      rumble(S, 200, .04);
      music(S, { root: 57, scale: [0, 2, 4, 7, 9, 11], bar: 4, beats: 4, chordBars: 2, prog: [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]], pad: { vol: .02, cut: 1300, open: 2, att: 3, rel: 5 }, restP: .55, lo: 4, hi: 12,
        mel: (t, m) => bell(S, 'celesta', m, t, .035, R(-.4, .4), .5, .55, .35) });
      const fw = () => { const now = new Date(), mid = (now.getMonth() === 11 && now.getDate() === 31 && now.getHours() === 23 && now.getMinutes() >= 55) || (now.getMonth() === 0 && now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() < 20);
        if (Math.random() < .25 || mid) { const n = 3 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) later(S, () => firework(S, i === n - 1), i * R(250, 700)); } else firework(S, Math.random() < .3);
        later(S, fw, mid ? R(900, 2500) : R(4000, 12000)); };
      later(S, fw, 2000);
      every(S, () => pop(S, .06), 30000, 70000, 15000);
      every(S, () => clink(S, .03), 14000, 30000, 8000);
    } }
  };

  /* ================= styrning ================= */
  function start(world) {
    if (typeof AC === 'undefined' || !AC || !TH[world]) return null; ac = AC;
    const T = TH[world], S = bus(T); S.world = world;
    const lvl = (+(typeof lsGet === 'function' && lsGet('ry_music_vol')) || .7) * (T.gain || 1);
    S.out.gain.setValueAtTime(0, ac.currentTime); S.out.gain.linearRampToValueAtTime(lvl, ac.currentTime + 4);
    try { T.go(S); } catch (e) { console.warn('temaljud', world, e); }
    return {
      world, S,
      vol(v) { S.out.gain.setTargetAtTime(v * (T.gain || 1), ac.currentTime, .3); },
      stop(fast) { if (!S.alive) return; S.alive = false; S.timers.forEach(x => { clearTimeout(x); clearInterval(x); }); const d = fast ? .3 : 2;
        try { S.out.gain.cancelScheduledValues(ac.currentTime); S.out.gain.setValueAtTime(S.out.gain.value, ac.currentTime); S.out.gain.linearRampToValueAtTime(0, ac.currentTime + d); } catch (e) {}
        setTimeout(() => { S.srcs.forEach(n => { try { n.stop(); } catch (e) {} }); try { S.out.disconnect(); } catch (e) {} }, d * 1000 + 200); }
    };
  }
  const has = w => !!TH[w];
  return { start, has, _t: { TH, firework: () => 0 } };
})();
