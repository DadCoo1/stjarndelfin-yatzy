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
- **Närvaro:** appen skickar aldrig sin kontaktlista. Servern ger ut hashade ID:n (nytt salt varje dygn) för dem som är online, och jämförelsen görs i telefonen.
- **TURN-inloggningarna** innehåller inget användarnamn, bara en slumpad etikett.
- **Loggar:** Caddy har ingen åtkomstlogg, coturn loggar inte anslutningar och spelservern skriver inte ut IP-adresser. Misslyckade admininloggningar sparas med förkortad IP-adress.
- **Sessioner** sparas bara som hash, utan webbläsarinformation.
- **Statistik** är räknare per dag och sparas i 35 dagar. Händelseloggen sparas i 90 dagar.
- **IP-adresser mellan telefoner:** med "Dölj min IP-adress" i appens inställningar går all trafik via servern, så andra aldrig ser ens IP-adress.

**Det som inte går att dölja för servern:** att ett konto är inloggat och online, och att två telefoner kopplar upp mot varandra (kopplingsservern måste veta vart den ska skicka uppkopplingen). Det sparas aldrig och finns bara i minnet medan anslutningen pågår.
