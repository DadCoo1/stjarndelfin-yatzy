// Fröknarna Leins game board – service worker: installerbar app, offline-spel och aviseringar.
// Release och testversion (/dev/) har varsin cache och rör aldrig varandras.
const DEV = /\/dev\//.test(self.location.pathname);
const PFX = DEV ? 'fl-dev-' : 'stjarndelfin-';
const CACHE = PFX + 'v57';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './games.js', './invaders.js', './chat.js', './app.js', './peerjs.min.js', './qr.js', './fr.js', './kina.js', './ordfajt.js', './pong.js', './kit.js', './strat.js', './family.js', './cards.js', './puzzle.js', './drone.js', './replay.js', './weather.js', './slalom.js', './biathlon.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PFX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // releaseversionens worker lägger sig inte i testversionens filer
  if (!DEV && /\/dev\//.test(url.pathname)) return;
  // fråga alltid servern om filen är ny (GitHub Pages låter annars webbläsaren använda gamla filer i 10 min)
  e.respondWith(fetch(req, {cache: 'no-cache'}).then(res => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('./index.html'))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
