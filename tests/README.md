# Tester (Playwright)

Starta en webbserver i repots rot (`python3 -m http.server 8811`) och för onlinetester en PeerJS-server på port 9000. Kör sedan:

- `node tests/rules.js` – regeltester för alla spel (kända lägen och kantfall)
- `node tests/fuzz.js c4,fia,hjarter,...` – hela partier med datorspelare blandat med ogiltiga drag; kontrollerar att tillståndet alltid är giltigt och att dolda kort aldrig syns hos gäster
- `node tests/gfx.js` – skärmbilder och automatiska layoutkontroller på fem skärmstorlekar
- `node tests/multi.js fia 4` – onlinespel med flera mobiler, avhopp och återkomst, returmatch
- `TOK=… node tests/echo.js` – ekokompisen via den egna servern: chatt-eko, ping, samtal med ljud och bild, uppläst citat
- `UA=… TA=… UB=… TB=… UC=… TC=… node tests/dir.js` – användarlistan: vanliga användare ser varandra (inte admin), meddelanden utan kontaktförfrågan och samtal
- `UA=… TA=… UB=… TB=… node tests/push.js` – notiser: registrering med falsk push-tjänst (https-mock på 9443, servern med `NODE_EXTRA_CA_CERTS`), push för meddelande och "din tur", bara kategorin skickas
- `TOK=… node tests/today.js` – Idag: hälsning och dagsform (även dold), lugnt läge, dagens kod, akvariet, ljudlandskap, säkerhetskopia till servern och återställning på ny enhet
- `node tests/ghost.js` – spökbil i Sommarvägen: första åket sparas, andra åket kör mot det
- `node tests/style.js` – utseende: världar, accentfärg, dekor, rörelse, textstorlek, ikonstil, och att varje spelruta behåller sin färg och får egen ikon
- `node tests/aquarium.js` – akvariet: delfinen simmar i mjuka bågar, fastnar inte på botten, hämtar mat och stiger igen
- `node tests/boot.js` – start utan blink: färgerna sätts innan något ritas, gamla hälsningen och vanliga spelrutor syns aldrig
- `node tests/compat.js [mapp]` – kompatibilitet med iPadOS 15/Safari 15: syntax, reguljära uttryck, funktioner och CSS (körs utan webbläsare; kräver acorn)
- `node tests/stability.js` – fel fångas och sparas, trasig del tar inte ner startsidan, vänligt felkort, felrapport utan personuppgifter, lugnare utseende på äldre enheter
- `node tests/welcome.js` – guidad start: visas för nya, inte för befintliga eller mitt i en inbjudan; namn, värld och delfinnamn sparas
- `UA=… TA=… UB=… TB=… node tests/multidev.js` – samma konto på två enheter: en person i kontakterna, meddelanden till båda enheterna, svar i samma konversation, synk av egna meddelanden, samtal till enheten som är online
