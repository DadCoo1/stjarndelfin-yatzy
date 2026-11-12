/* ================= Stjärndelfinen – en gemensam 3D-modell =================
   En flasknosdelfin byggd som en kropp med tvärsnitt längs ryggraden (proportioner
   från riktiga delfiner): kort nos med tydlig veck mot pannan (melonen), bakåtsvept
   ryggfena vars spets ligger bakom fenans bas, bröstfenor som pekar bakåt-nedåt och
   en LIGGANDE stjärtfena. Delfiner simmar genom att slå stjärten upp och ner – vågen
   går bakåt längs kroppen och fenan ligger före i fas. Modellen kan vridas (sväng),
   rollas och lutas i 3D, så att vändningar ser ut som riktiga vändningar.
   Samma modell ritar startsidans SVG, appikonen och akvariet. */
const DOLPH = (() => {
  // s: 0 = nosspets, 1 = stjärtfenans infästning. U = ryggsida, LO = buksida, W = halv bredd (andel av längden)
  const KS = [0, .025, .06, .085, .11, .16, .24, .34, .44, .54, .64, .74, .83, .91, .97, 1];
  const KU = [.004, .014, .022, .028, .050, .079, .102, .115, .114, .105, .089, .069, .049, .032, .020, .012];
  const KL = [.004, .013, .020, .026, .035, .057, .084, .100, .102, .093, .075, .055, .037, .025, .016, .011];
  const KW = [.004, .012, .019, .026, .041, .065, .085, .095, .092, .080, .060, .037, .020, .012, .008, .006];
  const PIV = .36;                                   // tyngdpunkt – kroppen vrids runt den
  function cr(K, s) {
    if (s <= 0) return K[0]; if (s >= 1) return K[K.length - 1];
    let i = 0; while (KS[i + 1] < s) i++;
    const t = (s - KS[i]) / (KS[i + 1] - KS[i]), p0 = K[Math.max(0, i - 1)], p1 = K[i], p2 = K[i + 1], p3 = K[Math.min(K.length - 1, i + 2)];
    const v = .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    return Math.max(.002, Math.min(Math.max(p1, p2) * 1.04, v));
  }
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  /* pose: bend (kroppen böjs uppåt/nedåt i en båge), lat (böjs åt sidan i en sväng), A (stjärtslagets storlek),
     ph (fas i slaget), roll, pitch (+ = nosen ner), yaw (0 = höger, π = vänster), elev (kameran lite ovanför) */
  function make(P) {
    const bend = P.bend || 0, lat = P.lat || 0, A = P.A || 0, ph = P.ph || 0;
    const cr0 = Math.cos(P.roll || 0), sr0 = Math.sin(P.roll || 0), cp = Math.cos(P.pitch || 0), sp = Math.sin(P.pitch || 0);
    const cy = Math.cos(P.yaw || 0), sy = Math.sin(P.yaw || 0), el = P.elev == null ? .22 : P.elev, ce = Math.cos(el), se = Math.sin(el);
    const wave = s => A * (.03 + 1.75 * Math.max(0, s - .3) ** 2) * Math.sin(ph - 2.4 * s);
    const line = s => [PIV - s, bend * (s - PIV) ** 2 + wave(s), lat * (s - PIV) ** 2];
    // 3D → skärm: rollning runt kroppens längdaxel, lutning, sväng, kameravinkel. Ger [x, y nedåt, djup mot betraktaren]
    const rot = p => {
      let x = p[0], y = p[1] * cr0 - p[2] * sr0, z = p[1] * sr0 + p[2] * cr0;
      const x2 = x * cp + y * sp, y2 = -x * sp + y * cp;
      const x3 = x2 * cy - z * sy, d3 = x2 * sy + z * cy;
      return [x3, -(y2 * ce - d3 * se), y2 * se + d3 * ce];
    };
    function frame(s) {
      const e = .004, a = line(Math.max(0, s - e)), b = line(Math.min(1, s + e));
      const t = nrm([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);          // framåt
      const n = nrm(add([0, 1, 0], t, -t[1]));                          // uppåt
      const bb = cross(t, n);                                           // åt sidan (mot betraktaren när yaw = 0)
      const U = cr(KU, s), Lo = cr(KL, s);
      return { c: line(s), t, n, b: bb, off: (U - Lo) / 2, hh: (U + Lo) / 2, w: cr(KW, s) };
    }
    // en punkt på kroppen: s längs kroppen, u = -1 (buk) … 1 (rygg), v = -1 … 1 (sida), plus fri förskjutning (i längdenheter)
    function surf(s, u, v, extra) {
      const f = frame(s); let p = add(f.c, f.n, f.off + u * f.hh); p = add(p, f.b, v * f.w);
      if (extra) { p = add(p, f.t, extra[0] || 0); p = add(p, f.n, extra[1] || 0); p = add(p, f.b, extra[2] || 0); }
      return p;
    }
    return { P, frame, surf, rot, wave, line };
  }

  /* ---------- geometri i skärmkoordinater ---------- */
  function area(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  const ccw = pts => (area(pts) < 0 ? pts.reverse() : pts);
  // kroppens kontur för s0..s1: ett band runt ryggraden + en ellips per tvärsnitt (så att den håller även framifrån)
  function body(M, k, ox, oy, s0 = 0, s1 = 1, mod) {
    const N = Math.max(12, Math.round(64 * (s1 - s0))), st = [];
    for (let i = 0; i <= N; i++) {
      const s = s0 + (s1 - s0) * i / N, f = M.frame(s);
      let off = f.off, hh = f.hh, w = f.w; if (mod) [off, hh, w] = mod(s, f);
      const c = M.rot(add(f.c, f.n, off)), A = M.rot(f.n.map(x => x * hh)), B = M.rot(f.b.map(x => x * w));
      st.push({ s, C: [ox + c[0] * k, oy + c[1] * k], A: [A[0] * k, A[1] * k], B: [B[0] * k, B[1] * k], d: c[2] });
    }
    let lp = [0, 1]; const up = [], dn = [];
    st.forEach((q, i) => {
      const a = st[Math.max(0, i - 1)].C, b = st[Math.min(st.length - 1, i + 1)].C, tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty);
      if (l > 1e-3 * k) lp = [-ty / l, tx / l];
      const e = Math.hypot(q.A[0] * lp[0] + q.A[1] * lp[1], q.B[0] * lp[0] + q.B[1] * lp[1]), sg = (q.A[0] * lp[0] + q.A[1] * lp[1]) >= 0 ? 1 : -1;
      q.p = lp; q.e = e; q.sg = sg;
      up.push([q.C[0] + lp[0] * e, q.C[1] + lp[1] * e]); dn.push([q.C[0] - lp[0] * e, q.C[1] - lp[1] * e]);
    });
    const outline = ccw(up.concat(dn.reverse()));
    const rings = [];
    for (let i = 1; i < st.length - 1; i += 2) { const q = st[i], r = []; for (let j = 0; j < 14; j++) { const a = j / 14 * Math.PI * 2; r.push([q.C[0] + q.A[0] * Math.cos(a) + q.B[0] * Math.sin(a), q.C[1] + q.A[1] * Math.cos(a) + q.B[1] * Math.sin(a)]); } rings.push(ccw(r)); }
    return { st, outline, rings };
  }
  // fenor: punkter i ett plan (a = framåt, c = utåt) runt en infästning
  function fin(M, k, ox, oy, o, ax, cx, pts) {
    return pts.map(([a, c]) => { const p = M.rot(add(add(o, ax, a), cx, c)); return [ox + p[0] * k, oy + p[1] * k, p[2]]; });
  }
  const ROT = (v, axis, ang) => { // Rodrigues
    const c = Math.cos(ang), s = Math.sin(ang), k = axis, d = dot(k, v), cx = cross(k, v);
    return [v[0] * c + cx[0] * s + k[0] * d * (1 - c), v[1] * c + cx[1] * s + k[1] * d * (1 - c), v[2] * c + cx[2] * s + k[2] * d * (1 - c)];
  };
  function parts(M, k, ox, oy, P) {
    // ryggfena: falkformad, spetsen bakom bakkanten (lutar mot stjärten)
    const DF = [[.405, 0], [.43, .028], [.465, .062], [.51, .094], [.56, .116], [.605, .126], [.618, .124], [.603, .108], [.585, .084], [.572, .056], [.569, .03], [.578, .008], [.588, 0]];
    const dorsal = DF.map(([s, h]) => { const f = M.frame(s), p = add(M.surf(s, .96, 0), f.n, h); const r = M.rot(p); return [ox + r[0] * k, oy + r[1] * k, r[2]]; });
    // bröstfenor (vänster och höger): pekar bakåt, nedåt och lite utåt; slår svagt i takt med simningen
    const pec = side => {
      const f = M.frame(.25), o = M.surf(.25, -.55, .74 * side), back = f.t.map(x => -x);
      const beta = .62 + (P.flap || 0) * .16, out = nrm(add(f.n.map(x => -x * Math.cos(beta)), f.b, side * Math.sin(beta)));
      return fin(M, k, ox, oy, o, back, out, [[-.012, -.004], [.008, .028], [.03, .058], [.062, .084], [.098, .098], [.112, .097], [.102, .083], [.084, .058], [.068, .03], [.06, .008], [.052, -.006]]);
    };
    // stjärtfenan: ligger ner (vågrät), svept bakåt, skåra i mitten. Lutar med stjärtslaget.
    const ft = M.frame(1), fo = add(M.line(1), ft.n, ft.off), fwd = ROT(ft.t, ft.b, P.fluke || 0);
    const FL = [[.022, 0], [.006, .033], [-.018, .068], [-.048, .108], [-.079, .141], [-.099, .156], [-.108, .154], [-.095, .13], [-.077, .094], [-.064, .057], [-.063, .026], [-.055, .007], [-.046, 0]];
    const half = FL.slice(1, -1), flukePts = [FL[0], ...half, FL[FL.length - 1], ...half.slice().reverse().map(([a, c]) => [a, -c])];
    const flukes = fin(M, k, ox, oy, fo, fwd, ft.b, flukePts);
    const nd = M.rot(M.frame(.5).n)[2], bd = M.rot(M.frame(.2).b)[2], tailD = M.rot(M.line(1))[2], pivD = M.rot(M.line(PIV))[2];
    return { dorsal, pecL: pec(1), pecR: pec(-1), flukes, nd, bd, tailFront: tailD > pivD + .12 };
  }

  /* ---------- canvas ---------- */
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } return `rgb(${r | 0},${g | 0},${b | 0})`; };
  function smooth(g, pts, close) {
    if (!pts.length) return; const n = pts.length;
    if (!close) { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } g.lineTo(pts[n - 1][0], pts[n - 1][1]); return; }
    const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2]; g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const q = pts[(i + 1) % n], m = [(pts[i][0] + q[0]) / 2, (pts[i][1] + q[1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    g.closePath();
  }
  function polyPath(g, pts) { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  const COL = { back: '#33509c', flank: '#6aa2e8', belly: '#eef8ff', fin: '#2c4486', glow: '#a5f3ff' };

  // ritar delfinen. o: { x, y (tyngdpunkt), k (pixlar per kroppslängd), col, eyes: 'open'|'closed', T (tid), stars }
  function draw(g, P, o) {
    const C = Object.assign({}, COL, o.col || {}), k = o.k, M = make(P), B = body(M, k, o.x, o.y), F = parts(M, k, o.x, o.y, P), T = o.T || 0;
    const nearPec = F.bd >= 0 ? F.pecL : F.pecR, farPec = F.bd >= 0 ? F.pecR : F.pecL;
    const finFill = (pts, c1, c2) => { const a = pts[0], b = pts[Math.floor(pts.length / 2)], gr = g.createLinearGradient(a[0], a[1], b[0], b[1]); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); smooth(g, pts, true); g.fill(); };
    const drawFlukes = () => { const gr = g.createLinearGradient(B.st[B.st.length - 1].C[0], B.st[B.st.length - 1].C[1], F.flukes[6][0], F.flukes[6][1]); gr.addColorStop(0, C.flank); gr.addColorStop(1, C.fin);
      g.fillStyle = shade(C.fin, -.35); g.beginPath(); smooth(g, F.flukes.map(p => [p[0], p[1] + k * .006]), true); g.fill();
      g.fillStyle = gr; g.beginPath(); smooth(g, F.flukes, true); g.fill(); };
    const drawDorsal = () => { finFill(F.dorsal, C.back, shade(C.fin, -.2)); g.strokeStyle = 'rgba(210,240,255,.28)'; g.lineWidth = Math.max(1, k * .006); g.beginPath(); smooth(g, F.dorsal.slice(0, 6)); g.stroke(); };
    // bakom kroppen
    finFill(farPec, shade(C.fin, -.25), shade(C.back, -.3));
    if (!F.tailFront) drawFlukes();
    if (F.nd < -.2) drawDorsal();
    // kropp
    const bodyPath = () => { g.beginPath(); smooth(g, B.outline, true); for (const r of B.rings) polyPath(g, r); };
    const pv = B.st[Math.round(B.st.length * PIV)], al = Math.max(Math.hypot(pv.A[0], pv.A[1]), k * .04), ax = pv.A[0] / al * k * .11, ay = pv.A[1] / al * k * .11;
    const gr = g.createLinearGradient(pv.C[0] + ax * 1.1, pv.C[1] + ay * 1.1, pv.C[0] - ax * 1.1, pv.C[1] - ay * 1.1);
    gr.addColorStop(0, shade(C.back, -.12)); gr.addColorStop(.3, C.back); gr.addColorStop(.55, C.flank); gr.addColorStop(.78, shade(C.flank, .45)); gr.addColorStop(1, C.belly);
    g.fillStyle = gr; bodyPath(); g.fill();
    g.save(); bodyPath(); g.clip();
    // ljus buk och haka (motskuggning), mjuk kant i två lager
    for (const [f, a] of [[.72, .16], [.6, .2], [.48, .24], [.36, .3]]) {
      const BB = body(M, k, o.x, o.y, .0, .82, (s, fr) => { const tp = Math.min(1, s / .05, (.82 - s) / .25); return [fr.off - fr.hh * (1 - f * .9), fr.hh * f * Math.max(.05, tp), fr.w * .92]; });
      g.globalAlpha = a; g.fillStyle = C.belly; g.beginPath(); smooth(g, BB.outline, true); g.fill();
    }
    g.globalAlpha = 1;
    // mörkare rygg (kappa)
    const CB = body(M, k, o.x, o.y, .1, .74, (s, fr) => { const tp = Math.min(1, (s - .1) / .12, (.74 - s) / .2); return [fr.off + fr.hh * .62, fr.hh * .42 * Math.max(.05, tp), fr.w * .8]; });
    g.globalAlpha = .3; g.fillStyle = shade(C.back, -.35); g.beginPath(); smooth(g, CB.outline, true); g.fill(); g.globalAlpha = 1;
    // glans längs ryggen och på pannan
    const hl = B.st.filter(q => q.s > .1 && q.s < .8).map(q => [q.C[0] + q.p[0] * q.sg * q.e * .6, q.C[1] + q.p[1] * q.sg * q.e * .6]);
    g.lineCap = 'round'; g.strokeStyle = 'rgba(220,245,255,.07)'; g.lineWidth = k * .06; g.beginPath(); smooth(g, hl); g.stroke();
    g.strokeStyle = 'rgba(220,245,255,.09)'; g.lineWidth = k * .03; g.beginPath(); smooth(g, hl.slice(1, -2)); g.stroke();
    g.strokeStyle = 'rgba(240,252,255,.22)'; g.lineWidth = k * .009; g.beginPath(); smooth(g, hl.slice(3, Math.round(hl.length * .62))); g.stroke();
    const mel = B.st.find(q => q.s >= .13); g.fillStyle = 'rgba(235,250,255,.35)'; g.beginPath(); g.ellipse(mel.C[0] + mel.p[0] * mel.sg * mel.e * .55, mel.C[1] + mel.p[1] * mel.sg * mel.e * .55, k * .022, k * .009, Math.atan2(mel.p[0], -mel.p[1]), 0, 7); g.fill();
    // solkatter från ytan som glider över ryggen
    if (o.caustics !== false) { g.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 7; j++) { const q = B.st[Math.round((.12 + j * .1) * (B.st.length - 1))]; if (!q) continue; const a = .5 + .5 * Math.sin(T * 1.6 + j * 1.9 + q.C[0] * .02);
        const x = q.C[0] + q.p[0] * q.sg * q.e * .35 + Math.sin(T * .9 + j) * k * .02, y = q.C[1] + q.p[1] * q.sg * q.e * .35, r = q.e * .9 + 2;
        const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(200,245,255,${.13 * a})`); rg.addColorStop(1, 'rgba(200,245,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'source-over'; }
    g.restore();
    // kontur i motljus
    g.strokeStyle = 'rgba(190,235,255,.22)'; g.lineWidth = Math.max(1, k * .004); g.beginPath(); smooth(g, B.outline, true); g.stroke();
    // ansiktet på den sida som syns
    const side = F.bd >= 0 ? 1 : -1, vis = Math.min(1, Math.abs(F.bd) * 1.6);
    if (vis > .12) {
      const P2 = p => { const r = M.rot(p); return [o.x + r[0] * k, o.y + r[1] * k]; };
      // munnen: från nosspetsen till mungipan, med ett litet leende
      g.strokeStyle = `rgba(14,24,52,${.5 * vis})`; g.lineWidth = Math.max(1, k * .006); g.beginPath();
      smooth(g, [0, .02, .045, .07, .09, .105].map(s => P2(M.surf(s, -.22 + (s > .08 ? (s - .08) * 6 : 0), .97 * side)))); g.stroke();
      // ögat med ögonfläck
      const e = P2(M.surf(.145, .14, .9 * side)), ta = P2(M.surf(.17, .14, .9 * side)), ang = Math.atan2(ta[1] - e[1], ta[0] - e[0]) + Math.PI, r = k * .011 * (.55 + .45 * vis);
      g.fillStyle = `rgba(20,30,70,${.25 * vis})`; g.beginPath(); g.ellipse(e[0], e[1], r * 2.4, r * 1.5, ang, 0, 7); g.fill();
      if (o.eyes === 'closed') { g.strokeStyle = '#0b1220'; g.lineWidth = Math.max(1, k * .005); g.beginPath(); g.ellipse(e[0], e[1], r * 1.1, r * .7, ang, .15, Math.PI - .15); g.stroke(); }
      else { g.fillStyle = '#0b1220'; g.beginPath(); g.ellipse(e[0], e[1], r * 1.15, r, ang, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(e[0] - r * .35, e[1] - r * .4, r * .38, 0, 7); g.fill(); }
    }
    // andningshålet syns när man ser ryggen
    if (F.nd > .12) { const bh = M.rot(M.surf(.18, 1, 0)); g.fillStyle = 'rgba(14,24,52,.35)'; g.beginPath(); g.ellipse(o.x + bh[0] * k, o.y + bh[1] * k, k * .008, k * .004 * (.3 + F.nd), 0, 0, 7); g.fill(); }
    if (F.nd >= -.2) drawDorsal();
    if (F.tailFront) drawFlukes();
    finFill(nearPec, C.flank, shade(C.back, -.1));
    // små stjärnglimtar på ryggen – stjärndelfinen
    if (o.stars) { for (const [s, i] of [[.3, 0], [.47, 1], [.62, 2]]) { const q = B.st[Math.round(s * (B.st.length - 1))], a = .35 + .35 * Math.sin(T * 2.2 + i * 2.1), x = q.C[0] + q.p[0] * q.sg * q.e * .45, y = q.C[1] + q.p[1] * q.sg * q.e * .45, r = k * .016;
      g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); for (let j = 0; j < 8; j++) { const rr = j % 2 ? r * .25 : r, aa = j * Math.PI / 4; g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); } g.fill(); } }
    return { nose: B.st[0].C, tail: B.st[B.st.length - 1].C, eye: null };
  }

  /* ---------- SVG (startsidan, introduktionen, ikonen) ---------- */
  const f1 = x => Math.round(x * 10) / 10;
  function pathD(pts, close) {
    const n = pts.length; if (!n) return '';
    if (!close) { let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`; for (let i = 1; i < n - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${f1(m[0])} ${f1(m[1])}`; } return d + `L${f1(pts[n - 1][0])} ${f1(pts[n - 1][1])}`; }
    const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2]; let d = `M${f1(m0[0])} ${f1(m0[1])}`;
    for (let i = 0; i < n; i++) { const q = pts[(i + 1) % n], m = [(pts[i][0] + q[0]) / 2, (pts[i][1] + q[1]) / 2]; d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${f1(m[0])} ${f1(m[1])}`; }
    return d + 'Z';
  }
  const poly = pts => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';
  const hexMix = (a, b, t) => { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), c = s => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t); return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1); };
  const svgCache = {};
  // c1 = ljus färg, c2 = mörk/accentfärg (samma signatur som förut)
  function svg(id = 'd', c1 = '#7df9ff', c2 = '#4f7cff') {
    const key = c1 + c2; let base = svgCache[key];
    if (!base) {
      const P = { pitch: -.08, yaw: -.12, elev: .4, bend: .12, A: .05, ph: 1.2, fluke: -.15, flap: 0 }, M = make(P), k = 100;
      const front = body(M, k, 0, 0, 0, .66), tail = body(M, k, 0, 0, .57, 1), F = parts(M, k, 0, 0, P);
      const belF = f => body(M, k, 0, 0, 0, .82, (s, fr) => { const tp = Math.min(1, s / .05, (.82 - s) / .25); return [fr.off - fr.hh * (1 - f * .9), fr.hh * f * Math.max(.05, tp), fr.w * .92]; }), bels = [.72, .6, .48, .36].map(belF);
      const cape = body(M, k, 0, 0, .1, .74, (s, fr) => { const tp = Math.min(1, (s - .1) / .12, (.74 - s) / .2); return [fr.off + fr.hh * .62, fr.hh * .42 * Math.max(.05, tp), fr.w * .8]; });
      const hl = front.st.filter(q => q.s > .12 && q.s < .62).map(q => [q.C[0] + q.p[0] * q.sg * q.e * .58, q.C[1] + q.p[1] * q.sg * q.e * .58]);
      const all = [...front.outline, ...tail.outline, ...F.dorsal, ...F.flukes, ...F.pecL, ...F.pecR];
      const x0 = Math.min(...all.map(p => p[0])) - 3, y0 = Math.min(...all.map(p => p[1])) - 3, x1 = Math.max(...all.map(p => p[0])) + 3, y1 = Math.max(...all.map(p => p[1])) + 6;
      const sh = pts => pts.map(p => [p[0] - x0, p[1] - y0]);
      const pv = front.st[Math.round(front.st.length * PIV / .66)], al = Math.hypot(pv.A[0], pv.A[1]) || 1, gx = pv.C[0] - x0, gy = pv.C[1] - y0, ux = pv.A[0] / al * 11.5, uy = pv.A[1] / al * 11.5;
      const ring = pts => sh(pts);
      const P2 = p => { const r = M.rot(p); return [r[0] * k - x0, r[1] * k - y0]; };
      const eye = P2(M.surf(.145, .14, .9)), mouth = [0, .02, .045, .07, .09, .105].map(s => P2(M.surf(s, -.22 + (s > .08 ? (s - .08) * 6 : 0), .97)));
      const piv = tail.st[0].C;
      base = { W: f1(x1 - x0), H: f1(y1 - y0), gx, gy, ux, uy,
        front: pathD(sh(front.outline), true) + front.rings.map(r => poly(ring(r))).join(''),
        tail: pathD(sh(tail.outline), true) + tail.rings.map(r => poly(ring(r))).join(''),
        bellies: bels.map(b => pathD(sh(b.outline), true)), cape: pathD(sh(cape.outline), true), hl: pathD(sh(hl)), dorsal: pathD(sh(F.dorsal), true), dorsalEdge: pathD(sh(F.dorsal.slice(0, 6))),
        flukes: pathD(sh(F.flukes), true), near: pathD(sh(F.bd >= 0 ? F.pecL : F.pecR), true), far: pathD(sh(F.bd >= 0 ? F.pecR : F.pecL), true),
        eye, mouth: pathD(mouth), ox: f1(piv[0] - x0), oy: f1(piv[1] - y0) };
      svgCache[key] = base;
    }
    const b = base, back = hexMix(c2, '#0b1640', .45), fin = hexMix(c2, '#0b1640', .55), flank = hexMix(c1, c2, .55), belly = hexMix(c1, '#ffffff', .78);
    return `<svg class="dolph" viewBox="0 0 ${b.W} ${b.H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Delfin">
  <defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f1(b.gx + b.ux)}" y1="${f1(b.gy + b.uy)}" x2="${f1(b.gx - b.ux)}" y2="${f1(b.gy - b.uy)}">
    <stop offset="0" stop-color="${back}"/><stop offset=".5" stop-color="${flank}"/><stop offset=".8" stop-color="${hexMix(flank, '#ffffff', .45)}"/><stop offset="1" stop-color="${belly}"/></linearGradient>
  <linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${back}"/><stop offset="1" stop-color="${fin}"/></linearGradient><linearGradient id="${id}t" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${flank}"/><stop offset="1" stop-color="${fin}"/></linearGradient></defs>
  <path d="${b.far}" fill="${fin}" opacity=".85"/>
  <g class="dtl" style="transform-origin:${b.ox}px ${b.oy}px"><path d="${b.flukes}" fill="url(#${id}t)"/><path d="${b.tail}" fill="url(#${id})"/></g>
  <path d="${b.front}" fill="url(#${id})"/>
  <clipPath id="${id}c"><path d="${b.front}"/><path d="${b.tail}"/></clipPath>
  <g clip-path="url(#${id}c)">${b.bellies.map((d, i) => `<path d="${d}" fill="${belly}" opacity="${[.16, .2, .24, .3][i]}"/>`).join('')}<path d="${b.cape}" fill="${hexMix(back, "#000000", .3)}" opacity=".18"/></g>
  <path d="${b.hl}" stroke="#fff" stroke-opacity=".22" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <path d="${b.dorsal}" fill="url(#${id}f)"/><path d="${b.dorsalEdge}" stroke="#fff" stroke-opacity=".3" stroke-width=".8" fill="none"/>
  <path d="${b.near}" fill="${hexMix(flank, back, .4)}"/>
  <path d="${b.mouth}" stroke="#0e1834" stroke-opacity=".5" stroke-width=".7" fill="none" stroke-linecap="round"/>
  <ellipse cx="${f1(b.eye[0])}" cy="${f1(b.eye[1])}" rx="2.6" ry="1.7" fill="#14204a" opacity=".25"/>
  <circle cx="${f1(b.eye[0])}" cy="${f1(b.eye[1])}" r="1.25" fill="#0b1220"/><circle cx="${f1(b.eye[0] - .4)}" cy="${f1(b.eye[1] - .45)}" r=".45" fill="#fff"/>
</svg>`;
  }
  return { make, body, parts, draw, svg, PIV };
})();
function DOLPHIN(id, c1, c2) { return DOLPH.svg(id, c1, c2); }
