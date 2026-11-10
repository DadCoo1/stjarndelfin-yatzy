/* Laddas först av allt, i <head>: sätter spelarens färger innan något ritas, så att man aldrig ser det
   gamla utseendet blinka förbi. style.js sparar färgerna här varje gång utseendet ändras. */
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
