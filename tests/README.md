# Tester (Playwright)

Starta en webbserver i repots rot (`python3 -m http.server 8811`) och för onlinetester en PeerJS-server på port 9000. Kör sedan:

- `node tests/rules.js` – regeltester för alla spel (kända lägen och kantfall)
- `node tests/fuzz.js c4,fia,hjarter,...` – hela partier med datorspelare blandat med ogiltiga drag; kontrollerar att tillståndet alltid är giltigt och att dolda kort aldrig syns hos gäster
- `node tests/gfx.js` – skärmbilder och automatiska layoutkontroller på fem skärmstorlekar
- `node tests/multi.js fia 4` – onlinespel med flera mobiler, avhopp och återkomst, returmatch
- `TOK=… node tests/echo.js` – ekokompisen via den egna servern: chatt-eko, ping, samtal med ljud och bild, uppläst citat
- `UA=… TA=… UB=… TB=… UC=… TC=… node tests/dir.js` – användarlistan: vanliga användare ser varandra (inte admin), meddelanden utan kontaktförfrågan och samtal
