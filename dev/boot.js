/* Laddas först av allt, i <head>: sätter spelarens färger innan något ritas, så att man aldrig ser det
   gamla utseendet blinka förbi. style.js sparar färgerna här varje gång utseendet ändras. */
// Felfångst: alla oväntade fel sparas (bara på enheten, max 30) så att de kan skickas med en felrapport.
(function () {
  var p = /\/dev\//.test(location.pathname) ? 'dev:' : '';
  function keep(msg, where) {
    try {
      var k = p + 'errlog', a = JSON.parse(localStorage.getItem(k) || '[]');
      a.push({ t: Date.now(), m: String(msg || '').slice(0, 300), w: String(where || '').slice(0, 160) });
      if (a.length > 30) a = a.slice(-30);
      localStorage.setItem(k, JSON.stringify(a));
    } catch (e) {}
  }
  window.__flErr = keep;
  window.addEventListener('error', function (e) {
    if (!e || (!e.message && e.target && e.target !== window)) return;          // en bild eller fil som inte laddades – inte ett kodfel
    keep(e.message, (e.filename || '').split('/').pop() + ':' + (e.lineno || '') + ':' + (e.colno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; keep('Promise: ' + (r && (r.message || r.name) || r), r && r.stack ? String(r.stack).split('\n')[1] : ''); });
})();
(function () {
  try {
    var p = /\/dev\//.test(location.pathname) ? 'dev:' : '';
    var c = JSON.parse(localStorage.getItem(p + 'style_cache') || 'null');
    if (!c || !c.v) return;
    var r = document.documentElement.style;
    for (var k in c.v) r.setProperty(k, c.v[k]);
    if (c.bg) r.backgroundColor = c.bg;
    var m = document.querySelector('meta[name=theme-color]');
    if (m && c.bg) m.setAttribute('content', c.bg);
  } catch (e) {}
})();
