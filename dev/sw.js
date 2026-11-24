// FrauLeins game board – service worker: installerbar app, offline-spel och aviseringar.
// Release och testversion (/dev/) har varsin cache och rör aldrig varandras.
const DEV = /\/dev\//.test(self.location.pathname);
const PFX = DEV ? 'fl-dev-' : 'stjarndelfin-';
const CACHE = PFX + 'v139';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './games.js', './invaders.js', './cars3d.js', './race.js', './chat.js', './call.js', './gcall.js', './scenes.js', './amb.js', './worldgl.js', './wglscenes.js', './dolphin.js', './app.js', './peerjs.min.js', './fonts/fredoka-400.woff2', './fonts/fredoka-500.woff2', './fonts/fredoka-600.woff2', './fonts/fredoka-700.woff2', './qr.js', './fr.js', './backup.js', './today.js', './snd/brook.m4a', './style.js', './boot.js', './welcome.js', './pins.js', './kina.js', './ordfajt.js', './pong.js', './duel.js', './kit.js', './strat.js', './family.js', './cards.js', './puzzle.js', './mahjong.js', './drone.js', './replay.js', './weather.js', './mountain.js', './slalomgl.js', './slalom.js', './biathlon.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  // ta bort alla gamla cacher (även från äldre versioner med andra namn) – men releasen rör aldrig testversionens och tvärtom
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && (DEV ? k.startsWith('fl-dev-') : !k.startsWith('fl-dev-'))).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
let slowUntil = 0;
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // releaseversionens worker lägger sig inte i testversionens filer
  if (!DEV && /\/dev\//.test(url.pathname)) return;
  // Fråga servern om filen är ny (GitHub Pages låter annars webbläsaren använda gamla filer i 10 min) – men vänta aldrig
  // länge: i flygläge, på flygplanswifi utan inloggning eller med dålig täckning svarar nätet ibland aldrig. Då startar appen
  // från de sparade filerna efter högst 2,5 s (direkt om telefonen vet att den är offline) och den nya filen hämtas klart i bakgrunden.
  e.respondWith((async () => {
    const c = await caches.open(CACHE), cached = await c.match(req, {ignoreSearch: true});
    const net = fetch(req, {cache: 'no-cache'}).then(res => { if (res.ok && res.type === 'basic') c.put(req, res.clone()); return res; });
    if (!cached) return net.catch(() => c.match('./index.html'));          // första gången: bara nätet duger (offline: appens startsida)
    e.waitUntil(net.then(() => { slowUntil = 0; }, () => {}));
    // har nätet nyss hängt? då använder alla följande filer de sparade direkt i 30 s (annars väntar varje fil för sig)
    const wait = (self.navigator && self.navigator.onLine === false) || Date.now() < slowUntil ? 0 : 2500;
    return Promise.race([net.then(r => r.ok ? r : cached, () => cached), new Promise(r => setTimeout(() => { if (wait) slowUntil = Date.now() + 30000; r(cached); }, wait))]);
  })());
});
// Notis från servern när appen är stängd. Innehållet är bara en kategori – aldrig vem eller vad.
const PUSHTXT = {
  m: ['💬 Nytt meddelande', 'Öppna appen för att läsa'],
  i: ['🎮 Du har fått en spelinbjudan', 'Öppna appen för att vara med'],
  t: ['🎲 Din tur!', 'Någon väntar på ditt drag'],
  c: ['📞 Någon försökte ringa dig', 'Öppna appen för att se vem']
};
self.addEventListener('push', e => {
  let k = 'm'; try { const d = e.data && e.data.json(); if (d && PUSHTXT[d.k]) k = d.k; } catch (_) {}
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(cs => {
    if (cs.some(c => c.visibilityState === 'visible')) return;          // appen syns redan – den visar själv
    const [title, body] = PUSHTXT[k];
    return self.registration.showNotification(title, {body, tag: 'fl-' + k, renotify: true, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [180, 90, 180], data: {url: k === 'm' || k === 'i' ? './#chat' : './'}});
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(cs => {
    for (const c of cs) { if ('focus' in c) { if (/#chat/.test(url)) try { c.postMessage({fl: 'openchat'}); } catch (_) {} return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
