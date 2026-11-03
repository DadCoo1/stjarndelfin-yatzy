# Härdning av spelservern

`harden.sh` härdar en nyinstallerad Ubuntu 24.04-server. Kör det en gång som root:

```sh
curl -fsSLO https://raw.githubusercontent.com/DadCoo1/stjarndelfin-yatzy/main/server/harden.sh
less harden.sh                         # läs igenom först
sudo ADMIN_USER=everest bash harden.sh
```

Låt SSH-fönstret vara öppet tills du har loggat in i ett nytt fönster som `everest`. Starta sedan om servern en gång.

## Innan: skapa en SSH-nyckel (på din Ubuntu-dator)

```sh
ssh-keygen -t ed25519 -C everest
cat ~/.ssh/id_ed25519.pub              # den här raden klistrar du in hos Hetzner när du skapar servern
```

Välj en lösenfras. Den privata nyckeln (`id_ed25519` utan `.pub`) lämnar aldrig datorn. Har du en
säkerhetsnyckel (YubiKey eller liknande) kan du i stället använda `ssh-keygen -t ed25519-sk`, så krävs
nyckeln fysiskt vid varje inloggning.

## Vad skriptet gör

| # | Område | Åtgärd |
|---|--------|--------|
| 1 | Uppdatering | Uppgraderar allt, installerar säkerhetsverktyg, tar bort gamla osäkra tjänster (telnet, ftp, rsh, avahi, cups) |
| 2 | Konton | Skapar en administratör med sudo; låser root-kontots lösenord; sudo kräver lösenord, loggas och glöms efter 5 min |
| 3 | SSH | Bara nyckelinloggning, ingen root, bara administratören får logga in, max 3 försök, inga tunnlar eller vidarebefordringar, bara moderna krypton (även kvantsäkert nyckelutbyte), svaga värdnycklar och svaga Diffie-Hellman-grupper borttagna. Konfigurationen provas innan den används |
| 4 | Brandvägg | Allt inkommande stängt utom SSH (med takt­begränsning), webben (80/443, HTTP/3) och TURN (3478, 5349, reläportar 49160–49200/udp) |
| 5 | fail2ban | Spärrar IP-adresser som gissar; återfall ger allt längre spärr, upp till 4 veckor |
| 6 | Uppdateringar | Säkerhetsuppdateringar installeras automatiskt varje dag; omstart kl 04:00 när kärnan kräver det; tjänster startas om automatiskt |
| 7 | Kärnan | Skydd mot förfalskade paket och omdirigeringar, SYN-flood-skydd, dold kärnminnesinformation, ingen eBPF för vanliga användare, ingen ptrace mellan processer, inga minnesdumpar, onödiga kärnmoduler (USB-minnen, Bluetooth, ovanliga protokoll och filsystem) blockerade |
| 8 | Filsystem | `/dev/shm` utan körbara filer, striktare standardrättigheter (umask 027), hemkataloger 750, cron bara för root, kompilatorer bara för root, loggar sparas men max 1 GB |
| 9 | Granskning | auditd loggar ändringar i konton, sudo, SSH, brandvägg, Docker och cron samt root-kommandon från inloggade användare; reglerna låses tills omstart. AppArmor aktivt |
| 10 | Docker | Installeras från Dockers officiella källa; containrar kan inte prata med varandra om det inte uttryckligen tillåts, kan inte få fler rättigheter, portar publiceras som standard bara lokalt, loggar begränsas. Administratören läggs inte i docker-gruppen (det vore detsamma som root) |
| 11 | Kontroll | Lynis granskar servern och ger ett härdningsindex; rapporten sparas i `/var/log/lynis-harden.log` |

## Det du gör utanför servern

1. **Tvåstegsinloggning** på Hetzner, domänleverantören och GitHub, helst med säkerhetsnyckel eller app (inte sms).
2. **Hetzner Cloud Firewall**: samma öppna portar som ovan, plus SSH (22) bara från din hemadress om den är fast. Det
   ger ett extra lager utanför servern. Det är också viktigt eftersom portar som Docker publicerar
   går förbi ufw. Spelservern publicerar därför bara det som ska vara öppet.
3. **Ögonblicksbilder**: slå på automatiska säkerhetskopior hos Hetzner (ca 20 % av serverpriset).
4. **Domänen**: slå på registry lock/överföringsspärr och DNSSEC hos domänleverantören, och lägg till en CAA-post
   så att bara Let's Encrypt får utfärda certifikat: `CAA 0 issue "letsencrypt.org"`.
5. **Lösenordshanterare** för sudo-lösenordet som skriptet skriver ut en gång.

## Gränser

Härdningen gör det mycket svårt att ta sig in i själva servern. De största riskerna efter det är
spelserverns egen kod och de konton som styr den (Hetzner, domänen, GitHub). Koden byggs därför också för
det: containrar körs som vanlig användare med skrivskyddat filsystem och utan extra rättigheter, servern
lagrar bara krypterade chattmeddelanden, och varje ny version granskas och testas innan den läggs ut.
