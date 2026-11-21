/* ================= Scenerna i 3D (WGL) =================
   Varje scen: cfg (kamera, ljus, himmel, dimma, färgsättning), statics (landskapet, byggs en gång),
   update (rörliga figurer, lampor och partiklar varje bild). Allt är egna modeller byggda av mjuka former. */
(() => {
  if (typeof WGL === 'undefined') return;
  const { Mesh, terrain, fir, house, mkNoise, rng, V, C } = WGL;
  const SC = WGL.SC, PI = Math.PI;
  // syns platsen i något skärmformat (upp till 2,4:1)? och hur långt bort är den (för detaljnivå)
  const seen = (cfg, x, z, pad) => { const e = cfg.eye, yaw = (cfg.yaw || 0) * PI / 180, a = Math.atan2(x - e[0], -(z - e[2])) - yaw, hf = Math.atan(Math.tan((cfg.fov || 50) * PI / 360) * 2.4); return Math.abs(a) < hf + (pad || .08) && -(z - e[2]) * Math.cos(yaw) + (x - e[0]) * Math.sin(yaw) > -5; };
  const lodOf = (cfg, x, z) => { const d = Math.hypot(x - cfg.eye[0], z - cfg.eye[2]); return d > 220 ? 2 : d > 90 ? 1 : 0; };
  const firC = (M, cfg, x, y, z, h, snow, seed, col) => { if (!seen(cfg, x, z)) return; fir(M, x, y, z, h, snow, seed, col, lodOf(cfg, x, z)); };
  const dir = (az, el) => { az *= PI / 180; el *= PI / 180; return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]; };   // az: 0 = rakt fram, + = höger

  /* ---------- figurer: byggs i en lokal mesh och läggs in vridna/flyttade ---------- */
  const TMP = new Mesh(4096);
  function put(dst, src, pos, yaw, pitch, roll, s) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0), cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
    const R = v => { let x = v[0], y = v[1], z = v[2];
      let y1 = y * cr - z * sr, z1 = y * sr + z * cr;           // roll runt x
      let x2 = x * cp - y1 * sp, y2 = x * sp + y1 * cp;         // pitch runt z (+ = nosen upp)
      return [x2 * cy - z1 * sy, y2, x2 * sy + z1 * cy]; };   // yaw runt y (0 = +x)
    const f = src.f; dst.need(src.n);
    for (let i = 0; i < src.n; i++) { const o = i * 11, p = R([f[o] * s, f[o + 1] * s, f[o + 2] * s]), n = R([f[o + 3], f[o + 4], f[o + 5]]);
      dst.v([p[0] + pos[0], p[1] + pos[1], p[2] + pos[2]], n, [f[o + 6], f[o + 7], f[o + 8]], f[o + 9], f[o + 10]); }
  }
  // ren i flygande galopp (x = framåt). ph = fas i steget
  function reindeer(M, ph, col, walk) {
    const fur = col || '#8a5a3a', dark = '#5e3a24', light = '#d8bf9c';
    M.ellip([0, 1.12, 0], [.78, .4, .33], fur, 0, 0, 10); M.ellip([.05, 1.0, 0], [.6, .27, .27], light, 0, 0, 8);
    M.ellip([-.15, 1.25, 0], [.55, .22, .3], dark, 0, 0, 8);
    M.tube([.55, 1.25, 0], [.88, 1.72, 0], .21, .14, fur, 0, 0, 10); M.ellip([.6, 1.3, 0], [.22, .2, .24], light, 0, 0, 7);
    M.ellip([1.02, 1.8, 0], [.27, .16, .14], fur, 0, 0, 10); M.ellip([1.24, 1.74, 0], [.13, .1, .1], dark, 0, 0, 7); M.sphere([1.35, 1.75, 0], .045, '#1a1210', 0, 0, 5);
    for (const z of [-.08, .08]) { M.sphere([1.1, 1.85, z * 1.05], .03, '#120c08', 5, 0, 4); M.ellip([.92, 1.95, z * 2.2], [.09, .04, .05], fur, 0, 0, 6);
      const b = [.92, 1.94, z], t1 = [.78, 2.45, z * 4.2], t2 = [.6, 2.7, z * 5];
      M.tube(b, t1, .035, .025, '#e8d6b4', 0, 0, 5); M.tube(t1, t2, .025, .012, '#e8d6b4', 0, 0, 5); M.tube(t1, [.95, 2.6, z * 4], .02, .01, '#e8d6b4', 0, 0, 4); M.tube([.86, 2.2, z * 3], [1.02, 2.38, z * 3.4], .02, .01, '#e8d6b4', 0, 0, 4); }
    M.ellip([-.78, 1.3, 0], [.1, .12, .08], '#f4efe6', 0, 0, 6);
    // ben: flygande galopp – framben sträcks framåt, bakben bakåt, i otakt
    const leg = (hx, z, a, k) => { const hip = [hx, 1.05, z], knee = [hx + Math.sin(a) * .42, 1.05 - Math.cos(a) * .42, z], b2 = a + k, hoof = [knee[0] + Math.sin(b2) * .45, knee[1] - Math.cos(b2) * .45, z];
      M.tube(hip, knee, .1, .065, fur, 0, 0, 7); M.tube(knee, hoof, .055, .04, dark, 0, 0, 6); M.sphere(hoof, .05, '#1d140e', 0, 0, 4); };
    const s = Math.sin(ph), s2 = Math.sin(ph + .5);
    if (walk) { const w = (q) => Math.sin(ph + q) * .32; leg(.45, .15, w(0), -Math.max(0, Math.sin(ph)) * .5); leg(.45, -.15, w(PI), -Math.max(0, Math.sin(ph + PI)) * .5); leg(-.5, .15, w(PI), Math.max(0, Math.sin(ph + PI)) * .4); leg(-.5, -.15, w(0), Math.max(0, Math.sin(ph)) * .4); }
    else { leg(.45, .15, .9 + s * .35, -.9 - s * .3); leg(.4, -.15, .75 + s2 * .35, -.8 - s2 * .3);
    leg(-.5, .15, -.9 + s * .3, 1.2 + s * .2); leg(-.55, -.15, -.75 + s2 * .3, 1.1 + s2 * .2); }
    // seldon med bjällror
    M.tube([.42, 1.5, -.36], [.42, .78, -.36], .035, .035, '#9b1c1c', 0, 0, 5); M.tube([.42, 1.5, .36], [.42, .78, .36], .035, .035, '#9b1c1c', 0, 0, 5);
    M.ellip([.42, 1.14, 0], [.1, .4, .36], '#9b1c1c', 0, 0, 8);
    for (let i = 0; i < 3; i++) M.sphere([.48, 1.0 + i * .14, .37], .045, '#f5c542', 5, 0, 5);
  }
  function sleigh(M, t) {
    const red = '#8f0d14', gold = '#d9a73a';
    // korgen
    M.box(-.2, .45, 0, 2.6, .55, 1.4, red, 5); M.box(-1.35, .45, 0, .35, 1.35, 1.4, red, 5);
    M.box(-.2, 1.0, .72, 2.6, .07, .06, gold, 5); M.box(-.2, 1.0, -.72, 2.6, .07, .06, gold, 5);
    for (let i = 0; i < 6; i++) { const a = i / 5 * PI * .9; M.tube([1.1 + Math.sin(a) * .38, .5 + (1 - Math.cos(a)) * .38, .7], [1.1 + Math.sin(a + .18) * .38, .5 + (1 - Math.cos(a + .18)) * .38, .7], .05, .05, gold, 5, 0, 5);
      M.tube([1.1 + Math.sin(a) * .38, .5 + (1 - Math.cos(a)) * .38, -.7], [1.1 + Math.sin(a + .18) * .38, .5 + (1 - Math.cos(a + .18)) * .38, -.7], .05, .05, gold, 5, 0, 5); }
    M.box(1.1, .45, 0, .5, .55, 1.4, red, 5);
    // medar som rullar upp framtill
    for (const z of [-.62, .62]) { let pp = [-1.6, .05, z]; for (let i = 0; i <= 10; i++) { const x = -1.6 + i * .32, y = i < 9 ? .05 : .05 + (i - 8) * .25, q = [x, y, z]; if (i) M.tube(pp, q, .05, .05, gold, 5, 0, 5); pp = q; }
      M.tube(pp, [1.55, .9, z], .05, .05, gold, 5, 0, 5); M.tube([1.55, .9, z], [1.25, 1.0, z], .05, .04, gold, 5, 0, 5);
      for (const x of [-1.1, -.2, .7]) M.tube([x, .05, z], [x, .45, z], .04, .04, gold, 5, 0, 4); }
    // säcken med julklappar
    M.ellip([-.85, 1.35, 0], [.6, .68, .55], '#8a6236', 0, 0, 10); M.ellip([-.85, 1.95, 0], [.3, .2, .3], '#7a5530', 0, 0, 8);
    [['#2f9e44', -.95, 2.15, .1, .3], ['#1c64f2', -.7, 2.05, -.2, .26], ['#e64980', -1.05, 2.0, -.15, .24], ['#fab005', -.75, 2.2, .2, .22]].forEach(([c, x, y, z, w]) => { M.box(x, y - w / 2, z, w, w, w, c, 0, 0, x * 3); M.box(x, y - w / 2 - .01, z, w * 1.04, w * 1.04, .05, '#fff3bf', 5, 0, x * 3); });
    // tomten
    const wave = Math.sin(t * 5) * .4;
    M.ellip([.25, 1.25, 0], [.42, .52, .45], '#c4161c', 0, 0, 10); M.ellip([.25, 1.05, 0], [.44, .09, .46], '#1f1f1f', 5, 0, 8); M.box(.6, 1.0, 0, .08, .12, .14, gold, 5);
    M.ellip([.25, .78, 0], [.46, .1, .48], '#f8f9fa', 0, 0, 8);
    M.sphere([.35, 1.85, 0], .2, '#f2c6a8', 0, 0, 10); M.ellip([.43, 1.7, 0], [.16, .22, .2], '#f8f9fa', 1, 0, 8); M.sphere([.53, 1.86, 0], .045, '#e8988a', 0, 0, 5);
    M.tube([.33, 2.0, 0], [.1, 2.45, .05], .2, .03, '#c4161c', 0, 0, 10); M.tube([.35, 1.97, 0], [.35, 2.06, 0], .22, .22, '#f8f9fa', 0, 0, 10); M.sphere([.08, 2.47, .05], .08, '#f8f9fa', 0, 0, 6);
    M.tube([.3, 1.5, .4], [.55, 1.75 + wave * .3, .7], .1, .08, '#c4161c', 0, 0, 7); M.sphere([.6, 1.85 + wave * .35, .78], .09, '#f8f9fa', 0, 0, 6);
    M.tube([.3, 1.5, -.4], [.85, 1.25, -.35], .1, .08, '#c4161c', 0, 0, 7); M.sphere([.9, 1.25, -.33], .08, '#2b2b2b', 0, 0, 5);
    // lykta framtill
    M.tube([1.55, .9, .62], [1.55, 1.35, .62], .02, .02, '#333', 0, 0, 4); M.sphere([1.55, 1.42, .62], .1, '#ffd27a', 2, 0, 6);
  }

  /* =================================================================== Julnatt */
  SC.jul = (o) => {
    const moon = dir(6, 16), key = dir(155, 26), N = mkNoise(7);
    const cfg = { fov: 46, eye: [0, 5.5, 0], pitch: -2.5, light: key, skyLight: moon, lightC: [.42, .5, .74], ambSky: [.085, .11, .19], ambGnd: [.04, .04, .06],
      top: [.006, .012, .04], hor: [.06, .09, .19], gnd: [.03, .04, .07], glowC: [.1, .13, .22], stars: 1, moon, moonC: [1, .96, .88], moonR: .028, mw: V.norm([.55, .5, .67]),
      aur: [.75, .5, 0, 0], aurC1: [.18, 1, .55], aurC2: [.6, .3, 1], fogC: [.075, .1, .18], haze: [.1, .12, .18], fog: [.0022, .02, 0, 1], em: 1.8, glowK: 1.5, bloom: 1.05,
      grade: [1.2, .95, 1.08, .6], skyRes: .4, stillT: 20, shadow: { c: [0, 0, -60], r: 100, res: 2048 } };
    // nära: byn på en flack platå, mjuka snödrivor; långt bort: fjäll med skarpa kammar
    const Hn = (x, z) => { let h = N.fbm(x * .02, z * .02, 4) * 5 - 2.5 + Math.max(0, z - 2) * .22; const vx = Math.abs(x) / 60, vz = Math.abs(z + 72) / 52; if (vx < 1 && vz < 1) h *= .2 + .8 * Math.max(vx, vz) ** 2; return h; };
    const Hf = (x, z) => { const d = Math.max(0, -z - 480); return Hn(x, z) + Math.min(1, d / 350) ** 1.5 * (N.ridge(x * .0024 + 3, z * .0024, 4) * 230 + N.fbm(x * .004, z * .004, 3) * 120 + 10); };
    const H = (x, z) => z < -300 ? Hf(x, z) : Hn(x, z);
    const paint = (p, n) => { const steep = 1 - n[1]; const rock = steep > .42 && p[1] > 30; return [rock ? [.2, .22, .27] : [.88, .92, .99], rock ? 0 : 1, 0]; };
    return { cfg, defs: ['MILKY', 'MOON', 'AURORA', 'SHADOW'],
      statics(M, L) {
        terrain(M, -260, 260, -300, 40, 170, 120, Hn, paint);
        terrain(M, -1500, 1500, -1700, -296, 200, 110, Hf, paint);
        const r = rng(3);
        // skog runt byn och på åsarna
        for (let i = 0; i < 520; i++) { const x = (r() - .5) * 700, z = -40 - r() * 520; if (Math.abs(x) < 45 && z > -125 && z < -35) continue; const y = H(x, z); if (y > 120) continue;
          firC(M, cfg, x, y, z, 6 + r() * 9 * (1 + Math.min(1, -z / 300)), true, i, r() < .5 ? '#163a2a' : '#1c4434'); }
        for (let i = 0; i < 26; i++) { const x = (r() < .5 ? -1 : 1) * (14 + r() * 26), z = -20 - r() * 110; if (Math.abs(x) < 40 && z < -40) continue; firC(M, cfg, x, H(x, z), z, 5 + r() * 6, true, 900 + i); }
        // byn: hus med tända fönster, kyrka, julgran, lyktstolpar, ljusslingor
        const HS = [[-16, -60, .3, '#8b2323'], [10, -55, -.2, '#a86b2d'], [-6, -82, .1, '#8b2323'], [22, -78, -.4, '#e7dcc3'], [-28, -88, .5, '#8b2323'], [30, -104, -.1, '#8b2323'], [-18, -112, .2, '#a86b2d'], [14, -118, 0, '#8b2323']];
        const chim = [];
        HS.forEach(([x, z, ry, c], i) => { const y = H(x, z); const w = 6 + (i % 3), d = 4.6 + (i % 2), h = 3 + (i % 2) * .6;
          chim.push(house(M, L, x, y, z, w, d, h, ry, c, '#2f3542', true, true));
          // ljusslinga längs takfoten
          const cr = Math.cos(ry), sr = Math.sin(ry); if (i % 2 === 0) for (let k = 0; k <= 16; k++) { const a = -w / 2 - .3 + (w + .6) * k / 16, sag = Math.sin(k / 16 * PI) * .25, zz = d / 2 + .4;
            M.sphere([x + a * cr - zz * sr, y + h - .25 - sag, z + a * sr + zz * cr], .09, ['#ff4d4d', '#ffd43b', '#51cf66', '#4dabf7', '#f783ac'][k % 5], 6, ((k * 37) % 100) / 100, 4); } });
        // kyrkan
        { const x = 4, z = -100, y = H(x, z); M.box(x, y - .5, z, 9, 7, 16, '#d6d9e0', 0, 0, 0); M.box(x, y - .5, z + 9.5, 4.4, 15, 4.4, '#d6d9e0');
          M.quad([x - 5, y + 6.5, z - 8.4], [x, y + 10.5, z - 8.4], [x, y + 10.5, z + 8.4], [x - 5, y + 6.5, z + 8.4], '#3b4252'); M.quad([x, y + 10.5, z - 8.4], [x + 5, y + 6.5, z - 8.4], [x + 5, y + 6.5, z + 8.4], [x, y + 10.5, z + 8.4], '#3b4252');
          M.quad([x - 5.1, y + 6.65, z - 8.5], [x, y + 10.65, z - 8.5], [x, y + 10.65, z + 7.2], [x - 5.1, y + 6.65, z + 7.2], '#e3ebf8', 1); M.quad([x, y + 10.65, z - 8.5], [x + 5.1, y + 6.65, z - 8.5], [x + 5.1, y + 6.65, z + 7.2], [x, y + 10.65, z + 7.2], '#e3ebf8', 1);
          M.tube([x, y + 14.5, z + 9.5], [x, y + 24, z + 9.5], 3.1, .05, '#3b4252', 0, 0, 4); M.tube([x, y + 24, z + 9.5], [x, y + 26, z + 9.5], .1, .1, '#e9c46a', 5, 0, 4); M.box(x, y + 25, z + 9.5, 1.2, .14, .14, '#e9c46a', 5);
          for (const zz of [-5, 0, 5]) for (const side of [-1, 1]) { M.quad([x + side * 4.53, y + 1.6, z + zz - .7], [x + side * 4.53, y + 1.6, z + zz + .7], [x + side * 4.53, y + 4.2, z + zz + .7], [x + side * 4.53, y + 4.2, z + zz - .7], '#ffcf7a', 2); }
          M.quad([x - .9, y, z + 11.73], [x + .9, y, z + 11.73], [x + .9, y + 3, z + 11.73], [x - .9, y + 3, z + 11.73], '#ffcf7a', 2);
          M.quad([x - .4, y + 9.4, z + 11.73], [x + .4, y + 9.4, z + 11.73], [x + .4, y + 10.8, z + 11.73], [x - .4, y + 10.8, z + 11.73], '#e0a858', 2);
          L.push([[x, y + 2, z + 16], [1, .75, .45], 1.1, .1], [[x + 6, y + 3, z], [1, .75, .45], 1.2, .2], [[x - 6, y + 3, z], [1, .75, .45], 1.2, .2]); }
        // julgranen på torget
        { const x = -4, z = -68, y = H(x, z), h = 13; fir(M, x, y, z, h, true, 77, '#123a28'); const LC = ['#ff4d4d', '#ffd43b', '#4dabf7', '#f783ac', '#ffe8a3', '#69db7c'];
          for (let i = 0; i < 90; i++) { const t = i / 90, hh = y + 1 + t * h * .82, rr = (1 - t) * h * .34 + .2, a = t * 34 + (i % 2) * PI; M.sphere([x + Math.cos(a) * rr, hh, z + Math.sin(a) * rr], .13, LC[i % 6], 6, (i * .137) % 1, 4); }
          const sy = y + h + .5; for (let k = 0; k < 5; k++) { const a0 = k / 5 * PI * 2, a1 = a0 + PI / 5, a2 = a0 - PI / 5, P0 = [x + Math.sin(a0) * .9, sy + Math.cos(a0) * .9, z], P1 = [x + Math.sin(a1) * .38, sy + Math.cos(a1) * .38, z], P2 = [x + Math.sin(a2) * .38, sy + Math.cos(a2) * .38, z];
            M.tri([x, sy, z + .15], P2, P0, '#ffe066', 2); M.tri([x, sy, z + .15], P0, P1, '#ffe066', 2); M.tri([x, sy, z - .15], P0, P2, '#ffe066', 2); M.tri([x, sy, z - .15], P1, P0, '#ffe066', 2); }
          L.push([[x, sy, z + 1], [1, .85, .5], 2.4, .06], [[x, y + 4, z + 3], [1, .6, .5], 1.6, .12]); }
        // förgrunden: stig med staket, en kälke, en snögubbe och några små granar
        for (let i = 0; i < 14; i++) { const t = i / 13, x = -9 - t * 5 + Math.sin(t * 3) * 1.2, z = -9 - t * 34, y = H(x, z);
          M.box(x, y - .3, z, .14, 1.5, .14, '#5a4636', 8); M.box(x, y + 1.2, z, .2, .12, .2, '#eef3fc', 1);
          if (i) { const pt = -9 - (i - 1) / 13 * 5 + Math.sin((i - 1) / 13 * 3) * 1.2, pz = -9 - (i - 1) / 13 * 34, py = H(pt, pz);
            M.tube([pt, py + .55, pz], [x, y + .55, z], .045, .045, '#5a4636', 8, 0, 4); M.tube([pt, py + 1.0, pz], [x, y + 1.0, z], .045, .045, '#5a4636', 8, 0, 4); M.tube([pt, py + 1.08, pz], [x, y + 1.08, z], .06, .06, '#eef3fc', 1, 0, 4); } }
        { const x = 4.5, z = -17, y = H(x, z) + .15; M.box(x, y + .35, z, 1.6, .1, .6, '#b3261e', 5, 0, .4);
          for (const s2 of [-.25, .25]) { const cz = z + s2; M.tube([x - .9, y + .05, cz], [x + .7, y + .05, cz + .3 * Math.sin(.4)], .04, .04, '#d4a53c', 5, 0, 4); M.tube([x + .7, y + .05, cz + .3 * Math.sin(.4)], [x + .95, y + .4, cz + .1], .04, .04, '#d4a53c', 5, 0, 4); } }
        { const x = 8.5, z = -24, y = H(x, z) - .2, sn = '#f4f7fd';
          M.sphere([x, y + .7, z], .85, sn, 1, 0, 12); M.sphere([x, y + 1.85, z], .6, sn, 1, 0, 12); M.sphere([x, y + 2.75, z], .42, sn, 1, 0, 12);
          M.tube([x, y + 2.75, z + .38], [x + .05, y + 2.72, z + .9], .07, .01, '#f08c00', 0, 0, 7);
          for (const e of [-.14, .14]) M.sphere([x + e, y + 2.88, z + .36], .05, '#111', 5, 0, 5);
          for (let k = 0; k < 5; k++) M.sphere([x + Math.cos(-1 + k * .5) * .4 - .0, y + 2.52 - Math.sin(k * .6) * .06, z + Math.sin(-1 + k * .5) * .3 + .22], .04, '#111', 5, 0, 4);
          M.tube([x, y + 2.38, z], [x, y + 2.5, z], .5, .5, '#c92a2a', 0, 0, 12); M.tube([x + .3, y + 2.4, z + .35], [x + .45, y + 1.8, z + .45], .12, .1, '#c92a2a', 0, 0, 6);
          M.tube([x, y + 3.1, z], [x, y + 3.15, z], .55, .55, '#212529', 0, 0, 12); M.tube([x, y + 3.15, z], [x, y + 3.75, z], .36, .34, '#212529', 0, 0, 12); M.tube([x, y + 3.2, z], [x, y + 3.32, z], .37, .37, '#c92a2a', 0, 0, 12);
          for (const sd of [-1, 1]) { M.tube([x + sd * .5, y + 2.0, z], [x + sd * 1.3, y + 2.6, z + .1], .05, .02, '#4a3426', 0, 0, 4); M.tube([x + sd * 1.1, y + 2.45, z + .05], [x + sd * 1.3, y + 2.3, z + .2], .03, .01, '#4a3426', 0, 0, 3); }
          L.push([[x - 2, y + 3, z + 3], [1, .75, .5], .5, .3]); }
        [[-15, -22, 4.5], [-19, -30, 6], [16, -34, 5.5], [13, -14, 3.5], [-6, -16, 2.6]].forEach(([x, z, h], i) => fir(M, x, H(x, z), z, h, true, 500 + i));
        // lyktstolpar
        [[-10, -42], [8, -40], [-2, -52], [16, -66], [-20, -74], [-7, -26], [2, -30]].forEach(([x, z]) => { const y = H(x, z); M.tube([x, y, z], [x, y + 3.6, z], .07, .05, '#1f2430', 5, 0, 5); M.ellip([x, y + 3.85, z], [.22, .3, .22], '#ffd894', 2, 0, 6); M.tube([x, y + 4.1, z], [x, y + 4.4, z], .25, .02, '#1f2430', 0, 0, 6); L.push([[x, y + 3.6, z], [1, .78, .48], 1.6, .14]); });
        this.chim = chim;
      },
      update(t, D, P, L, cam) {
        // släden: en båge över byn från vänster till höger, går om var 34:e sekund
        const T = 40, u = ((t % T) / T), x = -95 + u * 190, z = -62 + Math.sin(u * PI) * 14, y = 13 + Math.sin(u * PI) * 5 + Math.sin(t * 1.3) * .6;
        const dx = 190 / T, dy = (5 * PI / T) * Math.cos(u * PI), yaw = Math.atan2(14 * PI / T * Math.cos(u * PI), dx), pitch = Math.atan2(dy, dx) * .8, s = 1.7;
        const cy = Math.cos(yaw), sy = Math.sin(yaw), at = (lx, ly, lz) => [x + (lx * cy - lz * sy) * s, y + ly * s, z + (lx * sy + lz * cy) * s];
        if (u > .01 && u < .99) {
          TMP.reset(); sleigh(TMP, t); put(D, TMP, [x, y, z], yaw, pitch, Math.sin(t * .9) * .05, s);
          [[4.2, -.75], [4.2, .75], [7, -.75], [7, .75]].forEach(([fx, fz], i) => { TMP.reset(); reindeer(TMP, t * 7 + i * .9); const p = at(fx, Math.sin(t * 7 + i) * .12, fz); put(D, TMP, p, yaw, pitch + Math.sin(t * 7 + i * .9) * .06, 0, s * .95); });
          // tömmar
          for (const fz of [-.55, .55]) { const a = at(1.4, 1.2, fz * .9), b = at(7.5, 1.25, fz * 1.3); D.tube(a, b, .025 * s, .025 * s, '#e9b949', 5, 0, 4); }
          L.push([at(1.55, 1.42, .62), [1, .8, .5], 1.4, .25]);
          // glittrande spår
          for (let i = 0; i < 70; i++) { const k = i / 70, uu = u - k * .07; if (uu < 0) break; const xx = -95 + uu * 190, zz = -62 + Math.sin(uu * PI) * 14, yy = 13 + Math.sin(uu * PI) * 5 + Math.sin((t - k * 2.8) * 1.3) * .6;
            const j = rng(i * 7 + Math.floor(t * 8))(); P.add([xx - 2 + (j - .5) * 1.4, yy + .8 + (j - .5) * 1.2 - k * 2, zz + (j - .5)], [1, .85, .5, (1 - k) * (.5 + .5 * Math.sin(t * 20 + i))], .55 * (1 - k * .6), true); }
        }
        // snöfall runt kameran
        const n = o.few ? 700 : 1500, R = rng(5);
        for (let i = 0; i < n; i++) { const bx = (R() - .5) * 70, bz = 30 - R() * 110, sp = .9 + R() * .9, ph = R() * 40, h = 40;
          const yy = h - ((t * sp + ph * 3) % h), xx = bx + Math.sin(t * .7 + ph) * 1.5 + t * .4 % 70, zz = bz + Math.cos(t * .5 + ph) * 1.2;
          const wx = ((xx + 35) % 70 + 70) % 70 - 35;
          P.add([wx, yy - 2, zz], [.92, .95, 1, .85], .09 + R() * .08, false); }
        // rök ur skorstenarna
        (this.chim || []).forEach((c, k) => { for (let i = 0; i < 10; i++) { const a = ((t * .18 + i / 10 + k * .13) % 1); P.add([c[0] + a * 2.5 + Math.sin(t + i) * .3, c[1] + a * 7, c[2] - a * .8], [.55, .6, .7, (1 - a) * .22], 1.2 + a * 3.5, false); } });
      } };
  };

  /* ---------- fler figurer ---------- */
  // skidåkare i åkställning (x = framåt). crouch 0..1
  function skier(M, crouch, jk, pants, helm, skiC) {
    const k = .1 + crouch * .25;
    for (const zs of [-.13, .13]) { M.box(.05, .0, zs, 1.75, .05, .09, skiC, 5); M.tube([.9, .02, zs], [1.0, .12, zs], .045, .02, skiC, 5, 0, 4);
      const foot = [.02, .14, zs], knee = [.3 + k * .3, .62 - k * .15, zs * 1.1], hip = [-.04, 1.0 - k * .3, zs * .9];
      M.ellip([.06, .16, zs], [.17, .1, .08], '#2b2f3a', 5, 0, 6); M.tube(foot, knee, .075, .085, pants, 0, 0, 8); M.tube(knee, hip, .09, .11, pants, 0, 0, 8); }
    const hipY = 1.0 - k * .3;
    M.ellip([.12, hipY + .38, 0], [.2, .36, .22], jk, 0, 0, 10, v => [v[0] + v[1] * .45, v[1], v[2]]);
    M.ellip([.36, hipY + .78, 0], [.13, .13, .12], helm, 5, 0, 10); M.ellip([.46, hipY + .76, 0], [.05, .055, .1], '#ffb347', 5, 0, 6); M.sphere([.38, hipY + .67, 0], .07, '#f1c7a5', 0, 0, 6);
    for (const zs of [-1, 1]) { const sh = [.28, hipY + .6, zs * .2], hand = [.62, hipY + .25, zs * .32]; M.tube(sh, hand, .065, .055, jk, 0, 0, 7); M.sphere(hand, .06, '#1f2430', 0, 0, 5);
      M.tube(hand, [.15, .02, zs * .42], .015, .012, '#c0c5ce', 5, 0, 4); M.tube([.2, .1, zs * .42], [.2, .12, zs * .42], .08, .08, '#222', 0, 0, 6); }
  }
  // stjärndelfinen i 3D: samma modell som på startsidan (DOLPH), byggd som en glansig kropp med fenor
  function dolphin(M, P) {
    if (typeof DOLPH === 'undefined') return; const D = DOLPH.make(P), S = 34, R = 14;
    const back = C('#33509c'), flank = C('#6aa2e8'), belly = C('#eef8ff'), fin = C('#2c4486');
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const ring = s => { const f = D.frame(s), out = []; for (let j = 0; j <= R; j++) { const a = j / R * PI * 2, u = Math.cos(a), v = Math.sin(a);
        const p = V.add(V.add(f.c, V.mul(f.n, f.off + u * f.hh)), V.mul(f.b, v * f.w)), n = V.norm(V.add(V.mul(f.n, u / Math.max(f.hh, .002)), V.mul(f.b, v / Math.max(f.w, .002))));
        const col = u > .1 ? mix(flank, back, Math.min(1, (u - .1) / .6)) : mix(belly, flank, Math.min(1, (u + .55) / .65)); out.push([p, n, col]); } return out; };
    let prev = ring(0);
    for (let i = 1; i <= S; i++) { const s = Math.pow(i / S, 1.08), cur = ring(s);
      for (let j = 0; j < R; j++) { const a = prev[j], b = prev[j + 1], c = cur[j + 1], d = cur[j]; M.need(6);
        M.v(a[0], a[1], a[2], 5); M.v(d[0], d[1], d[2], 5); M.v(c[0], c[1], c[2], 5); M.v(a[0], a[1], a[2], 5); M.v(c[0], c[1], c[2], 5); M.v(b[0], b[1], b[2], 5); }
      prev = cur; }
    // öga
    const fe = D.frame(.09); for (const sd of [-1, 1]) { const e = V.add(V.add(fe.c, V.mul(fe.n, fe.off + fe.hh * .25)), V.mul(fe.b, sd * fe.w * .86)); M.sphere(e, .011, '#0b1220', 5, 0, 5); }
    const fan = (pts, col) => { for (let i = 1; i < pts.length - 1; i++) M.tri(pts[0], pts[i], pts[i + 1], col, 4); };
    const DF = [[.405, 0], [.43, .028], [.465, .062], [.51, .094], [.56, .116], [.605, .126], [.618, .124], [.603, .108], [.585, .084], [.572, .056], [.569, .03], [.578, .008], [.588, 0]];
    fan(DF.map(([s2, h]) => { const f = D.frame(s2); return V.add(D.surf(s2, .96, 0), V.mul(f.n, h)); }), fin);
    for (const side of [-1, 1]) { const f = D.frame(.25), o = D.surf(.25, -.55, .74 * side), bk = V.mul(f.t, -1), beta = .62 + (P.flap || 0) * .16, out = V.norm(V.add(V.mul(f.n, -Math.cos(beta)), V.mul(f.b, side * Math.sin(beta))));
      fan([[-.012, -.004], [.008, .028], [.03, .058], [.062, .084], [.098, .098], [.112, .097], [.102, .083], [.084, .058], [.068, .03], [.06, .008], [.052, -.006]].map(([a, c]) => V.add(V.add(o, V.mul(bk, a)), V.mul(out, c))), fin); }
    const ft = D.frame(1), fo = V.add(D.line(1), V.mul(ft.n, ft.off)), ang = P.fluke || 0, fw = V.add(V.mul(ft.t, Math.cos(ang)), V.mul(ft.n, Math.sin(ang)));
    const FLK = [[.022, 0], [.006, .033], [-.018, .068], [-.048, .108], [-.079, .141], [-.099, .156], [-.108, .154], [-.095, .13], [-.077, .094], [-.064, .057], [-.063, .026], [-.055, .007], [-.046, 0]];
    for (const sd of [-1, 1]) fan(FLK.map(([a, c]) => V.add(V.add(fo, V.mul(fw, a)), V.mul(ft.b, c * sd))), fin);
  }

  /* =================================================================== Vinterfjäll – skymning med alpglöd */
  SC.vinter = (o) => {
    const sun = dir(78, -1), key = dir(74, 7), N = mkNoise(21);
    const cfg = { fov: 46, eye: [18, 12, 12], yaw: -8, pitch: 4, light: key, skyLight: sun, lightC: [1.0, .58, .5], ambSky: [.2, .26, .44], ambGnd: [.08, .08, .12],
      top: [.03, .06, .17], hor: [.62, .5, .66], gnd: [.2, .2, .3], glowC: [.9, .45, .35], stars: .35, fogC: [.42, .42, .6], haze: [.5, .25, .2], fog: [.0016, .006, 0, 1],
      em: 1.7, glowK: 1.2, bloom: .9, grade: [1.12, .95, 1.1, .5], skyRes: .35, stillT: 9, shadow: { c: [0, 20, -80], r: 140, res: 2048 }, cl: [.35, .25, .004, .55], clC: [.55, .45, .6] };
    const xc = z => 14 * Math.sin(z * .012);
    const Hs = (x, z) => { const up = Math.min(170, Math.max(0, -z + 20)) * .2; const off = Math.abs(x - xc(z)); const piste = Math.max(0, 1 - Math.max(0, off - 20) / 14);
      return up + N.fbm(x * .03, z * .03, 4) * 6 * (1 - piste * .8) + Math.max(0, off - 30) * .12; };
    const Hm = (x, z) => { const d = Math.max(0, -z - 520); return Hs(x, z) + Math.min(1, d / 500) ** 1.4 * (N.ridge(x * .0017 + 7, z * .0017, 4) * 460 + N.fbm(x * .0035, z * .0035, 4) * 160); };
    const paint = (p, n) => { const steep = 1 - n[1], off = Math.abs(p[0] - xc(p[2])); const rock = steep > .5 && p[1] > 140; return [rock ? [.2, .2, .26] : [.9, .92, 1], rock ? 0 : (off < 22 && p[2] > -260 ? 9 : 1), 0]; };
    const skiers = [['#e03131', '#1c2541', '#ffd43b', '#f1f3f5', 0], ['#7048e8', '#212529', '#f783ac', '#ffd43b', 6.5], ['#0ca678', '#343a40', '#ffffff', '#ff6b6b', 12.5]];
    return { cfg, defs: ['CLOUDS', 'SHADOW'],
      statics(M, L) {
        terrain(M, -320, 320, -330, 60, 160, 110, Hs, paint); terrain(M, -1800, 1800, -2200, -320, 240, 130, Hm, paint);
        const r = rng(11);
        for (let i = 0; i < 700; i++) { const x = (r() - .5) * 640, z = 40 - r() * 520; if (Math.abs(x - xc(z)) < 30) continue; const y = Hm(x, z); if (y > 170) continue; firC(M, cfg, x, y, z, 6 + r() * 8, true, i + 3); }
        for (let i = 0; i < 40; i++) { const z = 8 - r() * 90, sd = r() < .5 ? -1 : 1, x = xc(z) + sd * (24 + r() * 14); firC(M, cfg, x, Hs(x, z), z, 5 + r() * 7, true, 2000 + i); }
        // stuga vid backen
        house(M, L, -24, Hs(-24, -60), -60, 6.5, 5, 3.2, .4, '#7a2318', '#2b2f3a', true, true);
        // liftstolpar
        this.lift = []; for (let i = 0; i <= 8; i++) { const z = 10 - i * 34, x = xc(z) - 32 - i * .8, y = Hs(x, z); M.tube([x, y, z], [x, y + 10, z], .22, .16, '#5c6370', 5, 0, 6); M.box(x, y + 10, z, .3, .3, 3.2, '#5c6370', 5); this.lift.push([x, y + 10.3, z]); }
      },
      update(t, D, P, L) {
        const lf = this.lift; for (let i = 0; i < lf.length - 1; i++) for (const s of [-1.4, 1.4]) D.tube([lf[i][0], lf[i][1], lf[i][2] + s], [lf[i + 1][0], lf[i + 1][1], lf[i + 1][2] + s], .03, .03, '#2b2f3a', 0, 0, 3);
        for (let k = 0; k < 14; k++) { const u = ((t * .018 + k / 14) % 1), f = u * (lf.length - 1), i = Math.floor(f), w = f - i, a = lf[i], b = lf[Math.min(lf.length - 1, i + 1)], p = V.lerp(a, b, w);
          const c = [p[0], p[1], p[2] + 1.4]; D.tube(c, [c[0], c[1] - 2.2, c[2]], .03, .03, '#2b2f3a', 0, 0, 3); D.box(c[0], c[1] - 2.5, c[2], .9, .12, 1.4, '#c92a2a', 5); D.box(c[0], c[1] - 2.5, c[2] - .7, .9, .9, .1, '#c92a2a', 5);
          const c2 = [p[0], p[1] - 2.2, p[2] - 1.4]; D.box(c2[0], c2[1] - .3, c2[2], .9, .12, 1.4, '#c92a2a', 5); }
        // skidåkare som svänger nedför backen mot kameran
        skiers.forEach(([jk, pants, helm, ski, off], i) => {
          const T = 17, u = (((t + off) % T) / T), z = -230 + u * 250, ph = z * .085 + i * 1.7, x = xc(z) + (i - 1) * 6 + Math.sin(ph) * 9, y = Hs(x, z);
          const z2 = z + 1, x2 = xc(z2) + (i - 1) * 6 + Math.sin(z2 * .085 + i * 1.7) * 9, yaw = Math.atan2(z2 - z, x2 - x), slope = Math.atan2(Hs(x, z) - Hs(x2, z2), Math.hypot(x2 - x, z2 - z));
          const lean = -Math.cos(ph) * .55;
          TMP.reset(); skier(TMP, .5 + Math.abs(Math.cos(ph)) * .5, jk, pants, helm, ski); put(D, TMP, [x, y + .03, z], yaw, -slope, lean, 1.6);
          if (Math.abs(Math.sin(ph)) > .7) for (let k = 0; k < 10; k++) { const j = rng(k + Math.floor(t * 20) * 7 + i * 99); P.add([x + (j() - .5) * 1.6 - Math.cos(yaw) * j() * 2, y + j() * 1.2, z + (j() - .5) * 1.6 - Math.sin(yaw) * j() * 2], [1, .96, .95, .5 * j()], .25 + j() * .25, false); }
        });
        const n = o.few ? 400 : 900, R = rng(5);
        for (let i = 0; i < n; i++) { const bx = (R() - .5) * 60, bz = 34 - R() * 90, sp = .7 + R() * .7, ph = R() * 40, h = 36; const yy = Hs(0, bz) + h - ((t * sp + ph * 3) % h); P.add([bx + Math.sin(t * .6 + ph) * 1.5, yy, bz], [.95, .95, 1, .8], .08 + R() * .07, false); }
      } };
  };

  /* =================================================================== Norrsken – sjö, stuga och renar under norrskenet */
  SC.norrsken = (o) => {
    const key = dir(-10, 42), N = mkNoise(33);
    const cfg = { fov: 50, eye: [0, 4.2, 30], pitch: 7, light: key, lightC: [.1, .22, .2], ambSky: [.05, .09, .11], ambGnd: [.02, .03, .04],
      top: [.003, .008, .025], hor: [.02, .06, .08], gnd: [.01, .02, .03], glowC: [.03, .1, .08], stars: 1.1, mw: V.norm([.3, .7, .64]), aur: [2.2, 2.2, 0, 0], aurC1: [.2, 1, .6], aurC2: [.75, .3, 1],
      fogC: [.03, .06, .08], haze: [.04, .12, .1], fog: [.0024, .02, 0, 1], em: 1.8, glowK: 1.6, bloom: 1.15, grade: [1.25, .95, 1.12, .55], skyRes: .4, skyEvery: 2, stillT: 30, shadow: null };
    const lake = (x, z) => { const dx = x / 95, dz = (z + 75) / 58; return dx * dx + dz * dz; };
    const H = (x, z) => { const l = lake(x, z); let h = N.fbm(x * .02, z * .02, 4) * 7 - 2; if (l < 1.6) h = Math.min(h, -2.5 + (l - 1) * 9); h = Math.max(h, -3);
      const d = Math.max(0, -z - 360); return h + Math.min(1, d / 300) ** 1.4 * (N.ridge(x * .0028, z * .0028 + 4, 5) * 200 + 15) + Math.max(0, z - 10) * .15; };
    const paint = (p, n) => { const rock = (1 - n[1]) > .45 && p[1] > 30; return [rock ? [.14, .15, .18] : [.82, .88, .96], rock ? 0 : 1, 0]; };
    return { cfg, defs: ['MILKY', 'AURORA'], water: { y: 0, deep: [.004, .012, .02], wv: [.18, .9, .012, .03], ext: [-3000, 3000, -1000, 40] },
      statics(M, L) {
        terrain(M, -300, 300, -380, 60, 170, 130, H, paint); terrain(M, -1600, 1600, -1800, -370, 170, 100, H, paint);
        const r = rng(9);
        for (let i = 0; i < 650; i++) { const x = (r() - .5) * 600, z = 50 - r() * 500; if (lake(x, z) < 1.35) continue; const y = H(x, z); if (y > 90 || y < .3) continue; firC(M, cfg, x, y, z, 5 + r() * 9, true, i, '#0f2a22'); }
        const cx = -2, cz = -4, cy = H(cx, cz); this.chim = [house(M, L, cx, cy, cz, 6.5, 5, 3, .35, '#7a1f1f', '#262b36', true, true)];
        M.tube([cx + 6, cy, cz + 4], [cx + 6, cy + 2.6, cz + 4], .06, .05, '#222', 0, 0, 4); M.ellip([cx + 6, cy + 2.75, cz + 4], [.16, .2, .16], '#ffd894', 2, 0, 6); L.push([[cx + 6, cy + 2.5, cz + 4.5], [1, .75, .45], 1.2, .2]);
        // brygga ut i sjön
        for (let i = 0; i < 9; i++) M.box(5, .25, -14 - i * 1.6, 1.8, .14, 1.4, '#5a4636', 8);
      },
      update(t, D, P, L) {
        // renar som går längs stranden
        [[0, 1], [11, .85], [19, .92]].forEach(([off, s], i) => { const T = 70, u = (((t * .9 + off) % T) / T), x = -70 + u * 140, z = -128 + Math.sin(u * 6) * 4 + i * 3, y = H(x, z);
          const ph = t * 4 + i; TMP.reset(); reindeer(TMP, ph, '#6b4a35', true);
          // gående: benen pendlar mjukt, huvudet nickar
          put(D, TMP, [x, y - .25 + Math.abs(Math.sin(ph)) * .05, z], .05, Math.sin(ph) * .02, 0, s * 1.15); });
        (this.chim || []).forEach(c => { for (let i = 0; i < 12; i++) { const a = ((t * .15 + i / 12) % 1); P.add([c[0] + a * 2 + Math.sin(t + i) * .3, c[1] + a * 7, c[2] - a], [.4, .48, .5, (1 - a) * .2], 1 + a * 3.5, false); } });
        // svävande iskristaller som glimmar i norrskenet
        const R = rng(2); for (let i = 0; i < (o.few ? 120 : 260); i++) { const x = (R() - .5) * 60, z = 30 - R() * 80, y = 1 + R() * 14 + Math.sin(t * .3 + i) * .5; P.add([x, y, z], [.7, 1, .85, .35 * (.5 + .5 * Math.sin(t * 2 + i))], .05, true); }
      } };
  };

  /* =================================================================== Nyårsnatt – fyrverkerier över staden vid vattnet */
  SC.nyar = (o) => {
    const key = dir(-30, 30), N = mkNoise(55);
    const cfg = { fov: 50, eye: [0, 4, 30], pitch: 9, light: key, lightC: [.16, .18, .3], ambSky: [.07, .07, .12], ambGnd: [.03, .03, .04],
      top: [.006, .006, .03], hor: [.12, .07, .16], gnd: [.02, .02, .03], glowC: [.15, .08, .12], stars: .45, mw: V.norm([-.3, .5, .8]), fogC: [.09, .07, .13], haze: [.1, .06, .1], fog: [.0016, .012, 0, 1],
      em: 1.9, glowK: 1.7, bloom: 1.2, grade: [1.2, .95, 1.15, .5], skyRes: .35, stillT: 31.2, shadow: null };
    const SH = []; const R0 = rng(77); for (let i = 0; i < 9; i++) SH.push({ P: 3.6 + R0() * 2.6, off: R0() * 9, x: (R0() - .5) * 260, z: -300 - R0() * 100, h: 90 + R0() * 80, c: [[1, .85, .3], [1, .35, .55], [.4, .85, 1], [.6, 1, .4], [1, .45, .25], [.8, .5, 1], [1, 1, 1], [1, .6, .9], [.5, 1, .9]][i], c2: [[1, .5, .2], [.8, .4, 1], [1, 1, 1], [1, .9, .3], [1, .9, .5], [.5, .9, 1], [1, .8, .4], [1, 1, .6], [1, .6, .3]][i], crackle: i % 3 === 0 });
    const DIRS = []; for (let i = 0; i < 110; i++) { const yy = 1 - 2 * (i + .5) / 110, rr = Math.sqrt(1 - yy * yy), a = i * 2.39996; DIRS.push([Math.cos(a) * rr, yy, Math.sin(a) * rr]); }
    return { cfg, defs: ['MILKY'], water: { y: 0, deep: [.006, .008, .02], wv: [.5, .4, .02, .03], ext: [-3000, 3000, -240, 22] },
      statics(M, L) {
        // kajen där vi står
        M.box(0, -2, 34, 200, 3.5, 24, '#3b3a40'); M.box(0, 1.5, 22.6, 200, .2, .8, '#55545c');
        for (let i = -12; i <= 12; i++) { M.tube([i * 3, 1.6, 22.4], [i * 3, 2.7, 22.4], .05, .05, '#1c1c22', 5, 0, 4); if (i < 12) M.tube([i * 3, 2.6, 22.4], [i * 3 + 3, 2.6, 22.4], .03, .03, '#1c1c22', 5, 0, 3); }
        [-14, 14].forEach(x => { M.tube([x, 1.5, 24], [x, 6, 24], .09, .07, '#1c1c22', 5, 0, 5); M.ellip([x, 6.3, 24], [.25, .35, .25], '#ffe0a0', 2, 0, 6); L.push([[x, 5.8, 23], [1, .78, .5], 1.4, .1]); });
        // staden: hus med fönster som lyser, antenner med blinkande lampor
        const r = rng(4); M.box(0, -2, -500, 2000, 4, 200, '#2a2832');
        for (let x = -600; x < 600; x += 14 + r() * 16) { const w = 14 + r() * 20, d = 14 + r() * 20, near = Math.abs(x) < 120, h = (near ? 16 : 12) + r() * (near ? 42 : 30) * (1 + Math.max(0, 1 - Math.abs(x) / 300)), z = -420 - r() * 70 - (Math.abs(x) > 250 ? r() * 80 : 0);
          if (Math.abs(x) < 16) continue; const shade = .14 + r() * .1; M.box(x, 2, z, w, h, d, [shade, shade * .95, shade * 1.15], 3, r()); if (r() < .35) { M.tube([x, 2 + h, z], [x, 2 + h + 6 + r() * 10, z], .3, .1, '#222', 0, 0, 4); M.sphere([x, 2 + h + 6.5 + r() * 9, z], .5, '#ff3030', 6, r(), 4); } }
        // klocktornet: tavlan visar tolv
        { const x = 0, z = -410; M.box(x, 2, z, 12, 52, 12, [.2, .19, .24], 0, .5); M.box(x, 54, z, 14, 2, 14, '#2c2a33'); M.tube([x, 56, z], [x, 76, z], 8.5, .3, '#2c2a33', 0, 0, 4);
          M.tube([x, 44, z + 6.05], [x, 44, z + 6.4], 4.2, 4.2, '#fff0c2', 2, 0, 24); M.box(x, 44, z + 6.5, .5, 3.6, .2, '#1a1a1a'); M.box(x, 44, z + 6.55, .7, 2.6, .2, '#1a1a1a');
          for (const yy of [12, 22, 32]) M.box(x, yy, z + 6.1, 2, 3, .2, '#ffcf7a', 2); }
      },
      update(t, D, P, L) {
        // pariserhjulet snurrar
        { const cx = 70, cy = 30, cz = -330, Rw = 24, a0 = t * .06; D.tube([cx - 6, 2, cz], [cx, cy, cz], .6, .5, '#3b3b48', 5, 0, 5); D.tube([cx + 6, 2, cz], [cx, cy, cz], .6, .5, '#3b3b48', 5, 0, 5);
          let pp = null; for (let i = 0; i <= 32; i++) { const a = a0 + i / 32 * PI * 2, q = [cx + Math.cos(a) * Rw, cy + Math.sin(a) * Rw, cz]; if (pp) D.tube(pp, q, .3, .3, '#c5b8ff', 6, (i % 4) / 4, 4); pp = q; }
          for (let i = 0; i < 16; i++) { const a = a0 + i / 16 * PI * 2, q = [cx + Math.cos(a) * Rw, cy + Math.sin(a) * Rw, cz]; D.tube([cx, cy, cz], q, .12, .12, '#8f86c9', 0, 0, 3); D.box(q[0], q[1] - 3, q[2], 2.2, 2.4, 2.2, ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c'][i % 4], 6, i / 16); }
          L.push([[cx, cy, cz + 10], [.8, .6, 1], 1.5, .01]); }
        // fyrverkerier: raketer stiger och slår ut; gnistorna faller med luftmotstånd och tyngd, ljuset lyser upp stan och vattnet
        const nn = o.few ? 60 : 110;
        SH.forEach((s, k) => { const u = ((t + s.off) % s.P), cyc = Math.floor((t + s.off) / s.P), j = rng(k * 131 + cyc * 7); const x = s.x + (j() - .5) * 80, h = s.h + (j() - .5) * 30, z = s.z;
          if (u < 1.1) { const f = u / 1.1, p = [x + (j() - .5) * 2, 2 + (h - 2) * (1 - (1 - f) * (1 - f)), z]; P.add(p, [1, .85, .6, 1], 1.4, true); for (let i = 1; i < 6; i++) P.add([p[0], p[1] - i * 1.6, p[2]], [1, .6, .3, .5 - i * .08], 1.2, true); return; }
          const tb = u - 1.1; if (tb > 3.4) return; const v = 58 + j() * 16, kd = 1.5, g = 9;
          const pos = (d, tt) => { const r = v * (1 - Math.exp(-kd * tt)) / kd; return [x + d[0] * r, h + d[1] * r - .5 * g * tt * tt * .6, z + d[2] * r]; };
          const fade = Math.max(0, 1 - tb / 3.2), flash = Math.exp(-tb * 5);
          if (flash > .02) L.push([[x, h, z + 20], s.c, 30 * flash, .0006]);
          for (let i = 0; i < nn; i++) { const d = DIRS[(i * 7 + k * 13) % DIRS.length], c = i % 3 ? s.c : s.c2;
            for (let q = 0; q < 3; q++) { const tt = Math.max(0, tb - q * .07), p = pos(d, tt), a = fade * (1 - q * .3) * (s.crackle && tb > 1.6 ? (rng(i * 13 + Math.floor(t * 18))() > .5 ? 1 : .1) : 1);
              P.add(p, [c[0], c[1], c[2], a], 2.3 - q * .5, true); } }
          if (tb < 3) for (let i = 0; i < 8; i++) { const d = DIRS[(i * 17) % DIRS.length]; P.add([x + d[0] * 10 * tb, h + d[1] * 6 * tb - tb * 2, z + d[2] * 10], [.25, .22, .3, .12 * (1 - tb / 3)], 10 + tb * 8, false); }
        });
        // glittrande stjärnfall
        const R = rng(3); for (let i = 0; i < 80; i++) { const x = (R() - .5) * 120, z = -40 - R() * 200, y = 80 - ((t * (2 + R() * 2) + R() * 80) % 80); P.add([x, y, z], [1, .85, .4, .5], .35, true); }
      } };
  };

  /* =================================================================== Rymd & hav – grundvärlden: havet under en ringplanet, och stjärndelfiner som hoppar */
  SC.rymd = (o) => {
    const moon = dir(9, 21), N = mkNoise(5);
    const cfg = { fov: 48, eye: [0, 3.2, 20], pitch: 6, light: moon, lightC: [.5, .55, .8], ambSky: [.08, .1, .2], ambGnd: [.02, .03, .06],
      top: [.008, .01, .04], hor: [.07, .09, .2], gnd: [.02, .03, .06], glowC: [.12, .14, .3], stars: 1.1, moon, moonC: [.95, .95, 1], moonR: .022, mw: V.norm([-.4, .6, .7]),
      neb: [.55, .25, .85, .45], pl: dir(-7, 9), plP: [.095, -.35, .26, 0], plC1: [.95, .6, .4], plC2: [.55, .45, 1],
      fogC: [.05, .07, .16], haze: [.15, .15, .3], fog: [.0012, .01, 0, 1], em: 1.6, glowK: 1.4, bloom: 1.1, grade: [1.18, .95, 1.12, .5], skyRes: .6, skyEvery: 3, stillT: 2, shadow: null };
    return { cfg, defs: ['MILKY', 'MOON', 'NEBULA', 'PLANET'], water: { y: 0, deep: [.005, .015, .04], wv: [.38, .32, .012, .02], ext: [-4000, 4000, -4000, 40] },
      statics(M, L) {
        const r = rng(8);
        // öar långt bort med en fyr
        [[-260, -700, 70, 30], [180, -900, 110, 45], [520, -800, 60, 22], [-620, -950, 90, 40]].forEach(([x, z, w, h], k) => { for (let i = 0; i < 6; i++) M.ellip([x + (r() - .5) * w, -2, z + (r() - .5) * 20], [w * (.4 + r() * .4), h * (.5 + r() * .6), 30], '#0c1324', 0); });
        M.tube([-250, 20, -690], [-250, 52, -690], 3, 2.2, '#d9d9e3', 0, 0, 8); M.sphere([-250, 54, -690], 2.6, '#fff1b8', 2, 0, 6);
      },
      update(t, D, P, L) {
        // fyrens ljuskägla som sveper runt
        const ba = t * .9; for (let i = 0; i < 40; i++) { const d = i * 7; P.add([-250 + Math.cos(ba) * d, 54, -690 + Math.sin(ba) * d], [1, .95, .75, .5 * (1 - i / 40)], 6 + i * .6, true); }
        // två delfiner som hoppar i bågar i otakt
        [[0, -30, 1, 7.4], [3.7, -42, -1, 8.6]].forEach(([off, z, sd, T], i) => {
          const u = ((t + off) % T) / T, J = .55; if (u > J) { return; }
          const f = u / J, x = sd * (-9 + f * 18), y = Math.sin(f * PI) * 4.2 - .6, dy = Math.cos(f * PI) * 4.2 * PI / (J * T), dx = 18 / (J * T), pitch = Math.atan2(dy, dx);
          TMP.reset(); dolphin(TMP, { A: .5, ph: t * 7, bend: -.1, fluke: Math.sin(t * 7) * .3 }); put(D, TMP, [x, y, z], sd > 0 ? 0 : PI, pitch, 0, 3.4);
          // stänk när den lämnar och når vattnet
          [[.04, -9], [.96, 9]].forEach(([fs, ex]) => { if (Math.abs(f - fs) < .1) { const k = 1 - Math.abs(f - fs) / .1; for (let q = 0; q < 40; q++) { const j = rng(q + i * 50 + Math.floor(t * 12))(), j2 = rng(q * 3 + i)(); P.add([sd * ex + (j - .5) * 2.5, j2 * 2.2 * k, z + (j2 - .5) * 1.5], [.85, .93, 1, .6 * k], .2 + j * .25, false); } } });
        });
        // glittrande plankton nära ytan
        const R = rng(6); for (let i = 0; i < (o.few ? 150 : 300); i++) { const x = (R() - .5) * 80, z = 15 - R() * 120; P.add([x, .05 + Math.sin(t + i) * .05, z], [.5, .9, 1, .5 * (.5 + .5 * Math.sin(t * 2.3 + i * 1.7))], .08, true); }
      } };
  };
})();
