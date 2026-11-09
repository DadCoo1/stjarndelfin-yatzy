# Spelservern

Gör så att onlinespel, chatt och samtal fungerar även på mobilnät, med VPN och på låsta wifi.

- **Kopplingsserver** (PeerJS, `/peer`) matchar ihop telefonerna via spelkoden.
- **Reservserver** (coturn) skickar vidare trafiken när telefonerna inte når varandra direkt.
  Trafiken är redan end-to-end-krypterad, så servern ser bara krypterade paket.
- **`/turn`** ger tillfälliga inloggningar till reservservern (gäller 6 timmar). Hemligheten skapas på servern och lämnar den aldrig.
- **Inloggning** med användarnamn och sexsiffrig kod från en TOTP-app. Konton kan **bara** skapas via en inbjudningslänk (gäller 7 dagar, en gång).
- **Brevlåda** (`/mbox`): krypterade chattmeddelanden sparas tills mottagaren är online igen. Servern kan inte läsa dem. Sparas högst 45 dagar.
- **Närvaro** (`/presence`): visar vilka kontakter som är uppkopplade.

## Admin-sidan

`https://<domän>/admin` – bara för konton med admin-flagga. Logga in med användarnamn och TOTP-kod (gäller 8 timmar).

- **Översikt:** vem som är online, spelomgångar per dag och spel, populäraste spelen, online/mot datorn/ensam, samtal, inloggningar, meddelanden i brevlådan, upptid
- **Användare:** logga ut på alla enheter, ny nyckel (ny inbjudningslänk), stäng av/slå på, gör till admin, ta bort
- **Inbjudningar:** skapa länk (med QR-kod), se öppna, dra tillbaka
- **Händelser:** logg över admininloggningar, misslyckade försök och ändringar

Statistiken är bara räknare per dag (vilket spel och hur man spelade, antal samtal och minuter). Meddelandens innehåll kan servern aldrig se.

## Konton

```
sudo spel-user invite pappa --admin  # första adminkontot
sudo spel-user invite elsa        # inbjudningslänk till appen (lägg till --dev för testversionen)
sudo spel-user list               # användare och öppna inbjudningar
sudo spel-user reset elsa         # ny länk och ny TOTP-nyckel, loggar ut alla enheter
sudo spel-user logout elsa        # logga ut på alla enheter
sudo spel-user disable elsa       # stäng av kontot
sudo spel-user remove elsa        # ta bort kontot
```

## Installation

1. Skaffa en Ubuntu-server (22.04 eller 24.04) och ett domännamn, t.ex. `spel.dindoman.se`.
2. Lägg in en A-post så att domännamnet pekar på serverns IP-adress.
3. Logga in på servern och kör:

```
curl -fsSL https://raw.githubusercontent.com/DadCoo1/stjarndelfin-yatzy/main/server/install.sh | sudo bash -s spel.dindoman.se
```

4. Säg till Claude vilket domännamn servern har, så kopplas appen dit (konstanten `NET_SERVER` i `app.js` och adressen i sidans `connect-src`).

Portar som öppnas: 22, 80, 443 (TCP), 3478 (UDP och TCP), 5349 (TCP) och 49160–49400 (UDP).

## Säkerhet och metadata

**All trafik är krypterad:**
- Telefon ↔ server: HTTPS och WSS (TLS 1.2+, HSTS). Reservservern: TURN över UDP/TCP eller TLS (5349).
- Telefon ↔ telefon: WebRTC med DTLS (spel, chatt) och DTLS-SRTP (samtal). Det gäller också när trafiken går via reservservern – den ser bara krypterade paket.
- Chatt: end-to-end med dubbel ratchet. Samtalens nycklar (DTLS-fingeravtryck) skickas genom chattens kryptering, så inte ens servern kan sitta emellan.

**Metadata som servern ser, och vad som har gjorts för att minimera den:**
- **Brevlådan** tar bara emot *förseglade* kuvert: allt utom mottagarens chatt-ID krypteras med en engångsnyckel till mottagaren. Avsändare, meddelande-ID och tid syns inte, och storleken fylls ut till fasta steg (1, 2, 4 … 256 kB). Tiden avrundas till timmen, och allt raderas efter hämtning eller senast efter 30 dagar.
- **Brevlådan är inte kopplad till användarnamn.** Hämtning bevisas med chatt-identitetens egen nyckel (ECDH-utmaning), inte med kontot.
- **Notiser på låsskärmen** (Web Push): appen ber om notiser för sin *brevlåda* (bevisat med chattnyckeln, inte kopplat till kontot) och väljer kategorier. Avsändaren märker ett kuvert med en bokstav – m (meddelande), i (spelinbjudan), t (din tur), c (missat samtal) – och servern skickar då en notis som bara innehåller den bokstaven, krypterad till telefonen. Google/Apple ser varken vem, vad eller text. VAPID-nyckeln skapas automatiskt i `vapid.json`.
- **Skydd mot skanning och intrång:** bara portarna 22, 443, 3478, 5349 och TURN-reläportarna är öppna (port 80 är stängd – certifikatet förnyas via 443). SSH tar bara nycklar (max 3 försök, max 6 anslutningar/30 s). fail2ban spärrar SSH-gissare, felaktiga inloggningar i appen och sårbarhetsskannrar (wp-login, .env, phpmyadmin …) via brandväggen; återfall ger två veckor. Kärnan skyddas mot förfalskade paket och SYN-flod, IPv6 är avstängt, säkerhetsuppdateringar installeras automatiskt (omstart 04:30 vid behov). Spelservern loggar bara IP-adressen vid misslyckade försök (för fail2ban) och journalen sparas i 14 dagar.
- **Säkerhetskopior** (`backups/`): appen krypterar allt med en lösenfras (PBKDF2-SHA256, 310 000 varv, AES-GCM) innan det skickas. Servern lagrar bara chiffertexten under ett hashat filnamn per användare och app – den kan inte läsa innehållet och ingen kan återställa utan lösenfrasen.
- **Användarlistan** (`dir.json`) är det enda som kopplar ett användarnamn till en chatt-identitet: varje app lägger upp sitt publika chattkort (nyckel, visningsnamn, emoji) så att alla vanliga användare kan hitta varandra. Adminkonton och avstängda konton listas inte, och borttagna konton försvinner. Den som vill slipper synas: ⚙️ → "Synas i listan över alla användare". Nycklar från listan räknas som overifierade – skanna varandras QR-kod för full verifiering, så kan inte ens servern byta ut en nyckel.
- **Närvaro:** appen skickar aldrig sin kontaktlista. Servern ger ut hashade ID:n (nytt salt varje dygn) för dem som är online, och jämförelsen görs i telefonen.
- **TURN-inloggningarna** innehåller inget användarnamn, bara en slumpad etikett.
- **Loggar:** Caddy har ingen åtkomstlogg, coturn loggar inte anslutningar och spelservern skriver inte ut IP-adresser. Misslyckade admininloggningar sparas med förkortad IP-adress.
- **Sessioner** sparas bara som hash, utan webbläsarinformation.
- **Statistik** är räknare per dag och sparas i 35 dagar. Händelseloggen sparas i 90 dagar.
- **IP-adresser mellan telefoner:** med "Dölj min IP-adress" i appens inställningar går all trafik via servern, så andra aldrig ser ens IP-adress.

**Det som inte går att dölja för servern:** att ett konto är inloggat och online, och att två telefoner kopplar upp mot varandra (kopplingsservern måste veta vart den ska skicka uppkopplingen). Det sparas aldrig och finns bara i minnet medan anslutningen pågår.
