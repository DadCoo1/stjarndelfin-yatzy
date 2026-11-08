# Spelservern

Gör så att onlinespel, chatt och samtal fungerar även på mobilnät, med VPN och på låsta wifi.

- **Kopplingsserver** (PeerJS, `/peer`) matchar ihop telefonerna via spelkoden.
- **Reservserver** (coturn) skickar vidare trafiken när telefonerna inte når varandra direkt.
  Trafiken är redan end-to-end-krypterad, så servern ser bara krypterade paket.
- **`/turn`** ger tillfälliga inloggningar till reservservern (gäller 6 timmar). Hemligheten skapas på servern och lämnar den aldrig.
- **Inloggning** med användarnamn och sexsiffrig kod från en TOTP-app. Konton kan **bara** skapas via en inbjudningslänk (gäller 7 dagar, en gång).
- **Brevlåda** (`/mbox`): krypterade chattmeddelanden sparas tills mottagaren är online igen. Servern kan inte läsa dem. Sparas högst 45 dagar.
- **Närvaro** (`/presence`): visar vilka kontakter som är uppkopplade.

## Konton

```
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
