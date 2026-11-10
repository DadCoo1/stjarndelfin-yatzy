/* =====================================================================
   mountain.js – 3D-modeller av fjällen som slalomspelet åker på
   • Björnrike (Blästerfjället, Vemdalen): Storslalombacken – brant och
     svart överst, röd längre ned, längs Björnliften
   • Åre (Åreskutan 1 420 m ö.h., Åresjön 372 m ö.h.): Störtloppet och
     Gästrappet från VM-platån ned till målarenan
   Modellerna är höjdfält byggda efter kända höjder, fallhöjder och
   backarnas läge och karaktär (inte lantmäteridata) – toppar, trädgräns,
   sjö, by och nedfarter ligger där de ligger i verkligheten, sett från
   backen. Samma höjdfält ger backprofilen i tävlingen, terrängen runt
   pisten, panoramat och drönarbilden.
   Koordinater: z = meter nedför från backens topp (vågrätt), x = meter
   åt höger när man tittar nedför, y = meter över havet.
   ===================================================================== */
'use strict';
const MOUNTAIN = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, sm = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  // mjuk kurva genom punkter utan översläng (monoton kubisk) – ger backprofiler med tydliga krön och flacker
  function curve(P) {
    const n = P.length, xs = P.map(p => p[0]), ys = P.map(p => p[1]), d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 * d[i - 1] * d[i] / (d[i - 1] + d[i]);
    return x => {
      if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const md = (lo + hi) >> 1; if (xs[md] <= x) lo = md; else hi = md; }
      const h = xs[hi] - xs[lo], t = (x - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
      return ys[lo] * (2 * t3 - 3 * t2 + 1) + h * m[lo] * (t3 - 2 * t2 + t) + ys[hi] * (-2 * t3 + 3 * t2) + h * m[hi] * (t3 - t2);
    };
  }
  const hash = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function noise(x, z) { const i = Math.floor(x), j = Math.floor(z), u = sm(x - i), v = sm(z - j); return lerp(lerp(hash(i, j), hash(i + 1, j), u), lerp(hash(i, j + 1), hash(i + 1, j + 1), u), v) - .5; }

  /* ---------- fjällen ---------- */
  const DEF = {
    bjornrike: {
      fjall: 'Blästerfjället', ort: 'Björnrike', omr: 'Vemdalen', top: 946, lake: 555, tree: [800, 860], sun: [-.45, .5, .74], spread: 2300, far: 5200,
      // profilen längs Storslalombacken: fjälltoppen bakom starten, brant svart parti, röd mellandel med ett krön, flackare ned mot Björnidet och tjärnen
      base: [[-2600, 700], [-1300, 850], [-450, 946], [-150, 918], [0, 884], [130, 852], [340, 766], [520, 706], [596, 690.5], [606, 689.6], [622, 683.5], [760, 640], [900, 603], [1000, 585], [1150, 568], [1320, 558], [1420, 552], [1560, 552], [1700, 560], [2300, 585], [3200, 640], [4600, 760], [6200, 830], [8000, 790]],
      peaks: [[1900, -350, 110, 700], [-2500, -900, 190, 900], [-3200, 2600, 150, 1200], [2800, 4200, 170, 1300], [-900, 6200, 120, 1500]],
      valley: [1300, 1750, 300],
      xlim: [-3900, 3900], zlim: [-3000, 7800],
      pistes: {
        storslalom: { name: 'Storslalombacken', nr: 7, zFin: 1000, mid: [[-100, 0], [150, -6], [420, 12], [700, 24], [1000, 8], [1400, 0]], half: [[0, 23], [300, 29], [620, 26], [900, 31], [1100, 36]], lift: -1,
          race: { gs: 206, sl: 106, gsp: 128, slp: 70 }, fin: 'MÅL · BJÖRNRIKE', banner: ['BJÖRNRIKE', 'VEMDALEN', 'HEJA! 🐬', 'STORSLALOMBACKEN'] }
      },
      decor: [[[[-430, 310], [-80, 300], [300, 250], [700, 270], [1150, 150]], 20], [[[-200, -380], [200, -330], [600, -420], [1050, -300], [1300, -120]], 22], [[[0, -62], [1050, -52]], 5], [[[-420, 60], [-200, 500], [300, 760], [900, 640], [1250, 300]], 16]],
      houses: [[-140, 1220, 3], [90, 1250, 2], [240, 1180, 3], [-300, 1150, 2], [380, 1300, 2], [-420, 1330, 3], [520, 1210, 2], [-60, 1330, 4], [640, 1420, 2], [-560, 1500, 2], [300, 1700, 3], [-250, 1820, 2], [820, 1650, 2], [-760, 1280, 2]]
    },
    are: {
      fjall: 'Åreskutan', ort: 'Åre', omr: 'Åre', top: 1420, lake: 372, tree: [800, 900], sun: [.35, .52, .78], spread: 2700, far: 6800,
      // profilen längs Störtloppet: toppen (1 420), toppstationen (1 274), VM-platån (820), brant, mellanparti, flack över tunneln, målbranten, byn och Åresjön, Renfjället på andra sidan
      base: [[-6000, 620], [-4300, 880], [-3100, 1210], [-2350, 1420], [-1700, 1274], [-900, 1040], [-220, 852], [0, 820], [150, 799], [450, 679], [700, 624], [1000, 540], [1150, 514], [1162, 512.6], [1180, 506], [1430, 418], [1500, 398], [1560, 392], [1620, 390], [1900, 380], [2010, 364], [3250, 364], [3420, 384], [4600, 520], [6100, 800], [7500, 986], [9200, 780]],
      peaks: [[1500, -2150, 170, 620], [-2300, -700, 250, 680], [-1500, 520, 215, 460], [1950, -150, 150, 620], [-100, -2350, 50, 240], [3000, 6500, 120, 1500], [-3200, 7200, 100, 1600]],
      xlim: [-4200, 4200], zlim: [-3900, 8700],
      pistes: {
        stortloppet: { name: 'Störtloppet', nr: 56, zFin: 1500, mid: [[-100, 0], [300, 14], [700, -18], [1000, -6], [1500, 0], [1900, 0]], half: [[0, 26], [450, 30], [1000, 26], [1300, 32], [1500, 38]], lift: 1,
          race: { gs: 208, sl: 108, gsp: 130, slp: 72 }, fin: 'MÅL · ÅRE', banner: ['ÅRE', 'STÖRTLOPPET', 'HEJA! 🐬', 'VM-ARENAN'] },
        gastrappet: { name: 'Gästrappet', nr: 57, zFin: 1500, mid: [[-100, 170], [250, 190], [600, 204], [1000, 178], [1350, 122], [1500, 96], [1900, 90]], half: [[0, 22], [500, 25], [1000, 24], [1350, 28], [1500, 34]], lift: -1,
          delta: [[-100, 0], [150, -5], [450, 24], [700, 12], [1000, 16], [1200, 3], [1450, 7], [1560, 0]],
          race: { gs: 206, sl: 106, gsp: 128, slp: 70 }, fin: 'MÅL · ÅRE', banner: ['ÅRE', 'GÄSTRAPPET', 'HEJA! 🐬', 'VM-ARENAN'] }
      },
      decor: [[[[-100, -190], [400, -210], [900, -170], [1450, -110]], 22], [[[-100, 88], [1480, 60]], 5], [[[-900, 900], [-300, 700], [400, 560], [1000, 480], [1500, 330]], 18], [[[-200, -520], [500, -470], [1100, -420], [1550, -330]], 20], [[[-1700, -250], [-900, -80], [-200, 0]], 30], [[[-1650, 500], [-900, 1050], [-200, 900]], 22]],
      houses: [[-420, 1640, 4], [-250, 1700, 5], [-80, 1660, 3], [120, 1720, 4], [330, 1680, 3], [520, 1750, 4], [-600, 1760, 3], [-760, 1680, 3], [700, 1700, 3], [-120, 1800, 5], [240, 1830, 4], [-380, 1850, 3], [880, 1790, 3], [-950, 1800, 3], [460, 1880, 3], [1100, 1740, 2], [-1200, 1730, 2], [40, 1900, 4], [-560, 1920, 3], [1350, 1800, 2], [-1500, 1850, 2], [640, 1930, 2]],
      cable: [[-330, 1730], [-250, -1700]], church: [-520, 1790]
    }
  };
  // tävlingsbackar som går att välja i spelet
  const VENUES = {
    bj: { fjall: 'bjornrike', pist: 'storslalom', name: 'Björnrike', title: 'Storslalombacken', icon: '🐻' },
    st: { fjall: 'are', pist: 'stortloppet', name: 'Åre', title: 'Störtloppet', icon: '🏔️' },
    ga: { fjall: 'are', pist: 'gastrappet', name: 'Åre', title: 'Gästrappet', icon: '🌙' }
  };

  const cache = {}; let LOW = false;   // LOW: glesare nät på svaga enheter
  function fjall(id) {
    if (cache[id]) return cache[id];
    const D = DEF[id], base = curve(D.base), ps = {};
    for (const k in D.pistes) { const p = D.pistes[k]; ps[k] = { ...p, midF: curve(p.mid), halfF: curve(p.half), deltaF: p.delta ? curve(p.delta) : null }; }
    const decor = D.decor.map(([pts, w]) => ({ f: curve(pts.map(p => [p[0], p[1]])), z0: pts[0][0], z1: pts[pts.length - 1][0], w }));
    // höjd över havet i punkten (x, z)
    function raw(x, z) {
      const g = Math.exp(-(x * x) / (D.spread * D.spread));
      let h = D.lake + (base(z) - D.lake) * (z < 1300 ? g : lerp(g, Math.exp(-(x * x) / (D.far * D.far)), sm((z - 1300) / 900)));
      for (const [px, pz, a, s] of D.peaks) { const dx = x - px, dz = z - pz, q = (dx * dx + dz * dz) / (s * s); if (q < 9) h += a * Math.exp(-q); }
      if (D.valley && z > D.valley[0] - 300 && z < D.valley[1] + 300) h += Math.pow((x - 60) / D.valley[2], 2) * 4 * sm((z - D.valley[0] + 300) / 300) * sm((D.valley[1] + 300 - z) / 300);
      // varje tävlingsbacke har sin egen profil nära sin mittlinje, och terrängen är slät där
      let near = 1e9;
      for (const k in ps) { const p = ps[k], dxp = Math.abs(x - p.midF(z)); if (dxp < near) near = dxp; if (p.deltaF && dxp < 150) h += p.deltaF(z) * sm(1 - dxp / 150); }
      const k = sm((near - 40) / 160);
      if (k > 0) h += (noise(x / 420, z / 420) * 26 + noise(x / 95 + 7, z / 95 + 3) * 6) * k;
      return h;
    }
    const H = (x, z) => Math.max(D.lake, raw(x, z));
    const isLake = (x, z) => raw(x, z) < D.lake - .3;
    // skog: tät nedanför trädgränsen, glesnar uppåt, borta i nedfarter, på sjön och glesare i byn
    function forest(x, z, h) {
      if (h == null) h = H(x, z);
      if (h <= D.lake + .4) return 0;
      let f = 1 - sm((h - D.tree[0]) / (D.tree[1] - D.tree[0]));
      if (!f) return 0;
      for (const k in ps) { const p = ps[k]; if (z > -60 && z < p.zFin + 220) { const d = Math.abs(x - p.midF(z)) - p.halfF(z) - 3; if (d < 0) return 0; f = Math.min(f, d / 14); } }
      for (const dc of decor) if (z > dc.z0 && z < dc.z1) { const d = Math.abs(x - dc.f(z)) - dc.w; if (d < 0) return 0; f = Math.min(f, d / 12); }
      if (h < D.lake + 34) f *= .35;
      return clamp(f, 0, 1);
    }
    const F = { id, D, H, isLake, forest, ps, mesh: null };
    return cache[id] = F;
  }
  function get(vid) {
    const V = VENUES[vid] || VENUES.bj, F = fjall(V.fjall), p = F.ps[V.pist];
    const elev = z => F.H(p.midF(z), z);
    return { vid: VENUES[vid] ? vid : 'bj', V, F, D: F.D, p, H: F.H, forest: F.forest, isLake: F.isLake, mid: p.midF, half: p.halfF, elev, zFin: p.zFin,
      // var starten ligger för en given fallhöjd ned till mållinjen
      zOfDrop(drop) { const e = elev(p.zFin) + drop; let z = p.zFin; while (z > -60 && elev(z) < e) z -= 1; return z; } };
  }

  /* ---------- nät av ytor (grovt över hela fjället, finare runt backarna) ---------- */
  function buildMesh(F) {
    if (F.mesh) return F.mesh;
    const D = F.D, sun = D.sun, grids = [];
    const mk = (x0, x1, z0, z1, step, skip) => {
      const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1, X = new Float32Array(nx * nz), Y = new Float32Array(nx * nz), Z = new Float32Array(nx * nz);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; X[k] = x0 + i * step; Z[k] = z0 + j * step; Y[k] = F.H(X[k], Z[k]); }
      const cells = [];
      for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const cx = x0 + (i + .5) * step, cz = z0 + (j + .5) * step; if (skip && skip(cx, cz)) continue;
        const k = j * nx + i, h = (Y[k] + Y[k + 1] + Y[k + nx] + Y[k + nx + 1]) / 4;
        const gx = (Y[k + 1] + Y[k + nx + 1] - Y[k] - Y[k + nx]) / (2 * step), gz = (Y[k + nx] + Y[k + nx + 1] - Y[k] - Y[k + 1]) / (2 * step), nl = Math.hypot(gx, 1, gz);
        const lam = clamp((-gx * sun[0] + sun[1] - gz * sun[2]) / nl, 0, 1), sh = .58 + .42 * lam;
        let lake = 0, fo = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const px = cx + (a - 1) * step * .33, pz = cz + (b - 1) * step * .33; if (F.isLake(px, pz)) lake++; else fo += F.forest(px, pz); }
        lake /= 9; fo /= 9;
        let r = lerp(168, 248, lam), g = lerp(184, 251, lam), b2 = lerp(216, 255, lam);
        const steep = Math.hypot(gx, gz); if (steep > .62 && h > D.tree[0]) { const t = clamp((steep - .62) * 2.2, 0, .6); r = lerp(r, 128 * sh, t); g = lerp(g, 138 * sh, t); b2 = lerp(b2, 160 * sh, t); }
        const fr = .5 + .5 * hash(i * 3 + 1, j * 5 + 2);
        r = lerp(r, (34 + 26 * fr) * (.7 + .5 * lam), fo * .9); g = lerp(g, (66 + 30 * fr) * (.7 + .5 * lam), fo * .9); b2 = lerp(b2, (62 + 26 * fr) * (.7 + .5 * lam), fo * .9);
        if (lake > 0) { r = lerp(r, 204, lake); g = lerp(g, 222, lake); b2 = lerp(b2, 240, lake); }
        const dist = Math.hypot(cx, cz - 800), hz = clamp((dist - 1200) / 8000, 0, 1) * .62;     // dis på avstånd
        r = lerp(r, 205, hz); g = lerp(g, 217, hz); b2 = lerp(b2, 238, hz);
        cells.push(k, `rgb(${r | 0},${g | 0},${b2 | 0})`);
      }
      return { nx, nz, X, Y, Z, cells, S: new Float32Array(nx * nz * 3) };
    };
    const fine = { x0: -1000, x1: 1100, z0: -700, z1: 2500 };
    grids.push(mk(D.xlim[0], D.xlim[1], D.zlim[0], D.zlim[1], LOW ? 420 : 300, (x, z) => x > fine.x0 && x < fine.x1 && z > fine.z0 && z < fine.z1));
    grids.push(mk(fine.x0 - 100, fine.x1 + 100, fine.z0 - 100, fine.z1 + 100, LOW ? 200 : 100, null));
    // hus, kyrka och kabinbana
    const spots = [];
    for (const [x, z, s] of D.houses) spots.push({ t: 'house', x, z, y: F.H(x, z), s: s * 2.2, c: hash(x | 0, z | 0) });
    if (D.church) spots.push({ t: 'church', x: D.church[0], z: D.church[1], y: F.H(D.church[0], D.church[1]), s: 9 });
    let cable = null;
    if (D.cable) { const [a, b] = D.cable; cable = []; for (let i = 0; i <= 8; i++) { const x = lerp(a[0], b[0], i / 8), z = lerp(a[1], b[1], i / 8); cable.push([x, F.H(x, z) + 14 + Math.sin(i / 8 * Math.PI) * 30, z, F.H(x, z)]); } }
    return F.mesh = { grids, spots, cable, order: [] };
  }
  // ritar fjället: proj(x, y, z) → [skärm-x, skärm-y, skala, djup] eller null; y0 dras av från alla höjder
  function draw(ctx, F, proj, W, H, y0, lite) {
    const M = buildMesh(F), L = M.order; L.length = 0;
    for (let gi = 0; gi < M.grids.length; gi++) {
      const G = M.grids[gi], S = G.S, n = G.nx * G.nz;
      for (let k = 0; k < n; k++) { const p = proj(G.X[k], G.Y[k] - y0, G.Z[k]); if (p) { S[k * 3] = p[0]; S[k * 3 + 1] = p[1]; S[k * 3 + 2] = p[3] != null ? p[3] : 1 / p[2]; } else S[k * 3 + 2] = -1; }
      const C = G.cells, nx = G.nx;
      for (let c = 0; c < C.length; c += 2) {
        const k = C[c], a = k * 3, b = (k + 1) * 3, d = (k + nx + 1) * 3, e = (k + nx) * 3;
        if (S[a + 2] < 0 || S[b + 2] < 0 || S[d + 2] < 0 || S[e + 2] < 0) continue;
        const xa = S[a], xb = S[b], xd = S[d], xe = S[e]; if ((xa < 0 && xb < 0 && xd < 0 && xe < 0) || (xa > W && xb > W && xd > W && xe > W)) continue;
        const ya = S[a + 1], yb = S[b + 1], yd = S[d + 1], ye = S[e + 1]; if ((ya < 0 && yb < 0 && yd < 0 && ye < 0) || (ya > H && yb > H && yd > H && ye > H)) continue;
        L.push({ z: S[a + 2] + S[d + 2], g: G, c });
      }
    }
    L.sort((p, q) => q.z - p.z);
    ctx.lineWidth = 1; ctx.lineJoin = 'round';
    for (const it of L) { const G = it.g, S = G.S, k = G.cells[it.c], a = k * 3, b = (k + 1) * 3, d = (k + G.nx + 1) * 3, e = (k + G.nx) * 3, col = G.cells[it.c + 1];
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(S[a], S[a + 1]); ctx.lineTo(S[b], S[b + 1]); ctx.lineTo(S[d], S[d + 1]); ctx.lineTo(S[e], S[e + 1]); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (lite) return;
    // kabinbanan upp mot toppstationen
    if (M.cable) { ctx.strokeStyle = 'rgba(51,65,85,.7)'; ctx.lineWidth = 1; ctx.beginPath(); let on = false;
      for (const c of M.cable) { const p = proj(c[0], c[1] - y0, c[2]); if (!p) { on = false; continue; } on ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); on = true; } ctx.stroke();
      for (let i = 1; i < M.cable.length; i += 2) { const c = M.cable[i], p = proj(c[0], c[1] - y0, c[2]), q = proj(c[0], c[3] - y0, c[2]); if (p && q && Math.abs(q[1] - p[1]) > 2) { ctx.strokeStyle = 'rgba(71,85,105,.8)'; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); } } }
    // byn: röda hus med snö på taken och varmt ljus i fönstren, kyrkan
    for (const s of M.spots) { const p = proj(s.x, s.y - y0, s.z); if (!p) continue; const u = p[2] * s.s; if (u < 1.2 || p[0] < -20 || p[0] > W + 20) continue;
      if (s.t === 'church') { ctx.fillStyle = '#f5f1e8'; ctx.fillRect(p[0] - u * .6, p[1] - u * .7, u * 1.2, u * .7); ctx.fillStyle = '#3f3f46'; ctx.beginPath(); ctx.moveTo(p[0] - u * .7, p[1] - u * .7); ctx.lineTo(p[0], p[1] - u * 1.3); ctx.lineTo(p[0] + u * .7, p[1] - u * .7); ctx.fill(); continue; }
      ctx.fillStyle = s.c < .7 ? '#a3271f' : s.c < .85 ? '#e8dcc0' : '#4b5563'; ctx.fillRect(p[0] - u, p[1] - u * .75, u * 2, u * .75);
      ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.moveTo(p[0] - u * 1.15, p[1] - u * .75); ctx.lineTo(p[0], p[1] - u * 1.35); ctx.lineTo(p[0] + u * 1.15, p[1] - u * .75); ctx.fill();
      if (u > 2.5) { ctx.fillStyle = '#ffe08a'; ctx.fillRect(p[0] - u * .5, p[1] - u * .5, u * .3, u * .25); ctx.fillRect(p[0] + u * .2, p[1] - u * .5, u * .3, u * .25); } }
  }
  // kamera som tittar från en punkt mot en annan
  function camera(px, py, pz, lx, ly, lz, f, W, H) {
    const dx = lx - px, dy = ly - py, dz = lz - pz, yaw = Math.atan2(dx, dz), pitch = Math.atan2(-dy, Math.hypot(dx, dz)), cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return (x, y, z) => { const ax = x - px, ay = y - py, az = z - pz, X = ax * cy - az * sy, Z0 = ax * sy + az * cy, Y = ay * cp + Z0 * sp, Z = -ay * sp + Z0 * cp; if (Z < 40) return null; return [W / 2 + X * f / Z, H / 2 - Y * f / Z, f / Z, Z]; };
  }
  // förhandsvisning i menyn: fjället snurrar långsamt, tävlingsbacken är markerad
  function preview(cv, vid, t) {
    const m = get(vid), F = m.F, D = F.D, W = cv.width, Hh = cv.height, g = cv.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, Hh); sky.addColorStop(0, '#4f86d4'); sky.addColorStop(.6, '#b9d2f0'); sky.addColorStop(1, '#fde7d3'); g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
    const a = Math.sin(t * .22) * .7, R = F.id === 'are' ? 8200 : 5600, cz = F.id === 'are' ? -200 : 300, ty = lerp(D.lake, D.top, .3);
    const proj = camera(Math.sin(a) * R, ty + R * .3, cz + Math.cos(a) * R, 0, ty, cz, W * 1.7, W, Hh);
    draw(g, F, proj, W, Hh, 0, false);
    // tävlingsbacken
    const z0 = m.zOfDrop(m.p.race.gs), line = (x, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); let on = false; for (let z = z0; z <= m.zFin; z += 20) { const p = proj(m.mid(z) + x(z), m.H(m.mid(z), z) + 4, z); if (!p) { on = false; continue; } on ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); on = true; } g.stroke(); };
    line(() => 0, 'rgba(15,23,42,.55)', Math.max(3, W * .012)); line(() => 0, '#facc15', Math.max(1.6, W * .006));
    const lab = (x, y, z, txt, col) => { const p = proj(x, y, z); if (!p) return; g.font = `700 ${Math.max(10, W * .032)}px system-ui`; g.textAlign = 'center'; const w = g.measureText(txt).width + 10; g.fillStyle = 'rgba(15,23,42,.72)'; g.beginPath(); g.roundRect(p[0] - w / 2, p[1] - W * .07, w, W * .048, 6); g.fill(); g.fillStyle = col || '#fff'; g.textBaseline = 'middle'; g.fillText(txt, p[0], p[1] - W * .045); g.fillStyle = col || '#fff'; g.beginPath(); g.arc(p[0], p[1], 2.5, 0, 7); g.fill(); };
    const pk = D.base.reduce((b, p) => p[1] > b[1] ? p : b, [0, 0]);
    lab(0, D.top, pk[0], `${D.fjall} ${D.top} m`);
    lab(m.mid(z0), m.elev(z0), z0, `Start ${Math.round(m.elev(z0))} m`, '#fde047');
    lab(m.mid(m.zFin), m.elev(m.zFin), m.zFin, `Mål ${Math.round(m.elev(m.zFin))} m`, '#fca5a5');
  }
  return { VENUES, get, draw, camera, preview, curve, setLow: v => { LOW = !!v; }, buildMesh: vid => buildMesh(get(vid).F) };
})();
