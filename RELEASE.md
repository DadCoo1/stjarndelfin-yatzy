# Release och testversion

| | Adress | Mapp |
|---|---|---|
| **Release** | https://dadcoo1.github.io/stjarndelfin-yatzy/ | roten |
| **Testversion (DEV)** | https://dadcoo1.github.io/stjarndelfin-yatzy/dev/ | `dev/` |

## Arbetsgång
1. Nya funktioner byggs och publiceras **bara i `dev/`**.
2. Testa och utvärdera på `/dev/` (gärna installerad som egen app – ikonen har en gul DEV-banderoll).
3. När allt är godkänt *släpps* versionen: `dev/index.html`, `dev/app.js`, `dev/peerjs.min.js`, `dev/games.js`, `dev/invaders.js`, `dev/chat.js`, `dev/call.js`, `dev/fr.js`, `dev/kina.js`, `dev/ordfajt.js`, `dev/pong.js`, `dev/kit.js`, `dev/strat.js`, `dev/family.js`, `dev/cards.js`, `dev/puzzle.js`, `dev/drone.js`, `dev/replay.js`, `dev/weather.js`, `dev/slalom.js`, `dev/biathlon.js`, `dev/ordfajt-sv.bin`, `dev/ordfajt-nb.bin`, `dev/ordfajt-nn.bin`, `dev/ORDLISTA-LICENS.txt`, `dev/qr.js` och `dev/sw.js` kopieras till roten,
   `APP_VERSION` och cache-versionen i `sw.js` räknas upp, och ändringen committas som "Release <version>".
4. `dev/manifest.webmanifest` och `dev/icon-*.png` är testversionens egna och kopieras **inte**.

## Vad som skiljer testversionen åt (styrs automatiskt av sökvägen `/dev/`)
- **Egen sparad data:** alla nycklar i webbläsarens lagring får prefixet `dev:` – statistik, rekord och sparade spel blandas aldrig ihop.
- **Egna spelkoder:** onlinespel i testversionen använder ett eget prefix och kan aldrig koppla upp mot releaseversionens spel.
- **Egen offline-cache:** `fl-dev-*` i stället för `stjarndelfin-*`; de två service workers rör inte varandras filer.
- **Märkning:** gul DEV-banderoll, "DEV ·" i fliktiteln, länk till releaseversionen i lobbyn och versionsnummer under ⚙️.

## Spotify i testversionen
Lägg till `https://dadcoo1.github.io/stjarndelfin-yatzy/dev/` som extra *Redirect URI* i Spotify-utvecklarappen.

## Säkerhet

- `index.html` har en Content-Security-Policy: bara skript från egna filer (och Spotify) får köras. Lägg **aldrig** till inline-skript (`<script>…</script>` eller `onclick=`) – de blockeras. All kod ligger i `.js`-filer.
- Tredjepartskod (`peerjs.min.js`, `qr.js`) är oförändrade kopior av npm-paketen PeerJS 1.5.5, qrcode-generator 2.0.4 och jsQR 1.4.0. Kontrollera nya versioner med `npm audit` innan de byts ut.
- Allt som kommer från andra enheter (spel och chatt) valideras strikt och skrivs alltid ut via `esc()`.
- Testkroken `CHAT.__test` finns bara när `DEV` är sann.
