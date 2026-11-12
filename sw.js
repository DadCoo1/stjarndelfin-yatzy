// Fröknarna Leins game board – service worker: installerbar app, offline-spel och aviseringar.
// Release och testversion (/dev/) har varsin cache och rör aldrig varandras.
const DEV = /\/dev\//.test(self.location.pathname);
const PFX = DEV ? 'fl-dev-' : 'stjarndelfin-';
const CACHE = PFX + 'v105';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './games.js', './invaders.js', './race.js', './chat.js', './call.js', './dolphin.js', './app.js', './peerjs.min.js', './qr.js', './fr.js', './backup.js', './today.js', './style.js', './boot.js', './welcome.js', './pins.js', './kina.js', './ordfajt.js', './pong.js', './kit.js', './strat.js', './family.js', './cards.js', './puzzle.js', './drone.js', './replay.js', './weather.js', './mountain.js', './slalomgl.js', './slalom.js', './biathlon.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  // ta bort alla gamla cacher (även från äldre versioner med andra namn) – men releasen rör aldrig testversionens och tvärtom
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && (DEV ? k.startsWith('fl-dev-') : !k.startsWith('fl-dev-'))).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // releaseversionens worker lägger sig inte i testversionens filer
  if (!DEV && /\/dev\//.test(url.pathname)) return;
  // fråga alltid servern om filen är ny (GitHub Pages låter annars webbläsaren använda gamla filer i 10 min)
  e.respondWith(fetch(req, {cache: 'no-cache'}).then(res => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.open(CACHE).then(c => c.match(req, {ignoreSearch: true}).then(r => r || c.match('./index.html')))));   // offline: bara den här versionens filer
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
