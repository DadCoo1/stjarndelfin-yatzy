# Installera spelservern steg för steg

Gäller en ny Ubuntu-server (24.04 eller 22.04) och en Ubuntu-dator hemma. Byt ut:

- `SERVERNS_IP` – serverns IP-adress (står i leverantörens kontrollpanel)
- `spel.dindoman.se` – domännamnet som ska peka på servern
- `everest` – det användarnamn du vill ha på servern

Skicka aldrig lösenord, privata nycklar (filer utan `.pub`) eller innehållet i `/etc/spelserver.env` till någon.

## 1. Skapa en SSH-nyckel på din dator

```
ssh-keygen -t ed25519 -C "everest-spelserver"
```

Tryck Enter för standardplatsen (`~/.ssh/id_ed25519`). Välj en lösenfras. Den skyddar nyckeln om datorn kommer på avvägar.

- `~/.ssh/id_ed25519` är den **privata** nyckeln. Den stannar på datorn.
- `~/.ssh/id_ed25519.pub` är den **publika** nyckeln. Den kan du visa för vem som helst.

## 2. Lägg in nyckeln på servern

Om du lade in nyckeln när servern beställdes kan du hoppa direkt till steg 3.

Annars loggar du in en sista gång med lösenordet och kopierar över nyckeln:

```
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@SERVERNS_IP
```

Kontrollera att du kommer in utan lösenord (bara lösenfrasen för nyckeln):

```
ssh root@SERVERNS_IP
```

## 3. Skapa ett eget konto (på servern)

```
adduser everest
usermod -aG sudo everest
rsync --archive --chown=everest:everest ~/.ssh /home/everest
```

Låt det här fönstret vara öppet. Öppna ett **nytt** terminalfönster på datorn och prova:

```
ssh everest@SERVERNS_IP
sudo -v
```

## 4. Stäng av lösenordsinloggning och root-inloggning

Gör det här i fönstret där du är inloggad som `everest`:

```
sudo tee /etc/ssh/sshd_config.d/00-hardening.conf >/dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
MaxAuthTries 3
EOF
sudo sshd -t && sudo systemctl restart ssh
```

Filen heter `00-…` för att den ska gälla före molnleverantörens egen fil (`50-cloud-init.conf`). Där står ofta `PasswordAuthentication yes`, och den första inställningen vinner.

Prova i ett nytt fönster, och stäng inte det gamla förrän det här fungerar:

```
ssh everest@SERVERNS_IP                               # ska fungera
ssh -o PubkeyAuthentication=no everest@SERVERNS_IP    # ska ge "Permission denied (publickey)"
ssh root@SERVERNS_IP                                  # ska nekas
```

Om du låser ute dig går det att logga in via leverantörens webbkonsol och ta bort filen.

## 5. Kortkommando på datorn (valfritt)

Lägg till i `~/.ssh/config` på datorn:

```
Host spel
    HostName SERVERNS_IP
    User everest
    IdentityFile ~/.ssh/id_ed25519
```

Sedan räcker det med `ssh spel`.

## 6. Domännamnet

Lägg in en **A-post** hos domänleverantören: `spel.dindoman.se` → `SERVERNS_IP`. Kontrollera sedan på datorn:

```
dig +short spel.dindoman.se
```

Svaret ska vara serverns IP-adress. Det kan ta några minuter.

## 7. Uppdatera och installera

Gör det här på servern:

```
sudo apt update && sudo apt full-upgrade -y
sudo reboot
```

Logga in igen och kör installationen:

```
curl -fsSL https://raw.githubusercontent.com/DadCoo1/stjarndelfin-yatzy/main/server/install.sh | sudo bash -s spel.dindoman.se
```

Skriptet tar några minuter. Sist skriver det ut status för tjänsterna.

## 8. Kontrollera

```
systemctl is-active caddy spelserver coturn fail2ban
sudo ufw status
curl -s https://spel.dindoman.se/health
```

Alla fyra tjänsterna ska svara `active`. Kontrollen ska svara `{"ok":true}`.

## 9. Koppla appen och skapa ditt adminkonto

1. Skicka domännamnet till Claude. Appen kopplas då till servern, först i testversionen.
2. När det är klart, kör på servern:
   ```
   sudo spel-user invite everest --admin --dev
   ```
3. Öppna länken på telefonen. Lägg in nyckeln i en TOTP-app, till exempel Aegis eller 2FAS (Android), och skriv in koden.
4. Logga in på `https://spel.dindoman.se/admin`. Där bjuder du in fler.

## Underhåll

- Säkerhetsuppdateringar installeras automatiskt. Starta om servern ibland om `/var/run/reboot-required` finns.
- Uppdatera spelservern genom att köra installationsskriptet igen. Det behåller användare, hemligheter och brevlåda.
- Loggar för spelservern: `journalctl -u spelserver -n 50`
