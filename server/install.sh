#!/usr/bin/env bash
# Installerar spelservern på en ny Ubuntu-server (22.04 eller 24.04).
#
#   curl -fsSL https://raw.githubusercontent.com/DadCoo1/stjarndelfin-yatzy/main/server/install.sh | sudo bash -s spel.dindoman.se
#
# Det här sätts upp:
#   - Caddy: HTTPS med automatiskt certifikat (Let's Encrypt) på port 443
#   - spelserver: kopplingsserver (PeerJS) på /peer och tillfälliga TURN-inloggningar på /turn
#   - coturn: reservserver som skickar vidare krypterad trafik när telefonerna inte når varandra
#             direkt (mobilnät, VPN, skolans wifi). Port 3478 (UDP/TCP) och 5349 (TLS).
#   - brandvägg (ufw), automatiska säkerhetsuppdateringar och fail2ban mot lösenordsgissning
#
# Domännamnet måste peka på serverns IP-adress (A-post) innan skriptet körs.
# Hemligheten för TURN skapas här på servern och lämnar den aldrig.
set -euo pipefail

DOMAIN="${1:-}"
REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/DadCoo1/stjarndelfin-yatzy/main/server}"
ORIGINS="${ALLOW_ORIGINS:-https://dadcoo1.github.io}"
RELAY_MIN=49160; RELAY_MAX=49400

say(){ printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Kör med sudo."; exit 1; }
[ -n "$DOMAIN" ] || { echo "Ange domännamnet: sudo bash install.sh spel.dindoman.se"; exit 1; }
. /etc/os-release; [ "${ID:-}" = ubuntu ] || echo "Varning: skriptet är testat för Ubuntu, inte ${ID:-okänt}."

say "Kontrollerar att $DOMAIN pekar hit"
MYIP="$(curl -fsS4 https://api.ipify.org || true)"
DNSIP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
echo "Serverns IP: ${MYIP:-okänd}   $DOMAIN pekar på: ${DNSIP:-ingenting}"
if [ -n "$MYIP" ] && [ "$MYIP" != "$DNSIP" ]; then echo "Domänen pekar inte på den här servern än. Lägg in en A-post och vänta några minuter."; exit 1; fi

say "Paket"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl gnupg debian-keyring debian-archive-keyring apt-transport-https ufw unattended-upgrades fail2ban coturn nodejs npm openssl
if ! command -v caddy >/dev/null; then
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi

say "Säkerhet: automatiska uppdateringar, fail2ban, brandvägg"
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
systemctl enable --now fail2ban
ufw default deny incoming >/dev/null; ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
ufw allow 3478/udp >/dev/null; ufw allow 3478/tcp >/dev/null; ufw allow 5349/tcp >/dev/null
ufw allow ${RELAY_MIN}:${RELAY_MAX}/udp >/dev/null
ufw --force enable >/dev/null
ufw status | sed -n '1,30p'

say "Hemlighet för TURN (skapas bara första gången)"
if [ ! -f /etc/spelserver.env ]; then
  umask 077
  printf 'TURN_SECRET=%s\nDOMAIN=%s\nALLOW_ORIGINS=%s\nPORT=9000\n' "$(openssl rand -hex 32)" "$DOMAIN" "$ORIGINS" > /etc/spelserver.env
fi
SECRET="$(grep '^TURN_SECRET=' /etc/spelserver.env | cut -d= -f2)"

say "Spelservern"
id spelserver >/dev/null 2>&1 || useradd --system --home /opt/spelserver --shell /usr/sbin/nologin spelserver
mkdir -p /opt/spelserver
for f in app.js package.json; do curl -fsSL "$REPO_RAW/$f" -o "/opt/spelserver/$f"; done
(cd /opt/spelserver && npm install --omit=dev --no-audit --no-fund --loglevel=error)
chown -R root:root /opt/spelserver
chown root:spelserver /etc/spelserver.env; chmod 640 /etc/spelserver.env
cat > /etc/systemd/system/spelserver.service <<EOF
[Unit]
Description=Spelserver (PeerJS + TURN-inloggningar)
After=network-online.target
[Service]
User=spelserver
EnvironmentFile=/etc/spelserver.env
WorkingDirectory=/opt/spelserver
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload; systemctl enable --now spelserver; systemctl restart spelserver

say "Caddy (HTTPS)"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode gzip
	reverse_proxy /peer* 127.0.0.1:9000
	reverse_proxy /turn 127.0.0.1:9000
	reverse_proxy /health 127.0.0.1:9000
	respond / "Spelservern är igång" 200
}
EOF
systemctl enable --now caddy; systemctl reload caddy || systemctl restart caddy

say "Väntar på certifikatet"
CERTDIR=""
for i in $(seq 1 40); do
  CERTDIR="$(dirname "$(find /var/lib/caddy -name "$DOMAIN.crt" 2>/dev/null | head -1)" 2>/dev/null || true)"
  [ -n "$CERTDIR" ] && [ -f "$CERTDIR/$DOMAIN.key" ] && break; sleep 3
done
[ -n "$CERTDIR" ] && echo "Certifikat: $CERTDIR" || echo "Inget certifikat än – TLS-porten 5349 startar när det finns (kör skriptet igen senare)."

say "Kopia av certifikatet till coturn (förnyas varje dag)"
cat > /usr/local/sbin/spel-certsync <<EOF
#!/bin/sh
D=\$(dirname "\$(find /var/lib/caddy -name '$DOMAIN.crt' | head -1)")
[ -f "\$D/$DOMAIN.crt" ] || exit 0
install -d -m 750 -o root -g turnserver /etc/coturn/certs
if ! cmp -s "\$D/$DOMAIN.crt" /etc/coturn/certs/cert.pem; then
  install -m 640 -o root -g turnserver "\$D/$DOMAIN.crt" /etc/coturn/certs/cert.pem
  install -m 640 -o root -g turnserver "\$D/$DOMAIN.key" /etc/coturn/certs/key.pem
  systemctl restart coturn
fi
EOF
chmod 755 /usr/local/sbin/spel-certsync
cat > /etc/systemd/system/spel-certsync.service <<EOF
[Unit]
Description=Kopiera Caddys certifikat till coturn
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/spel-certsync
EOF
cat > /etc/systemd/system/spel-certsync.timer <<EOF
[Unit]
Description=Daglig kopia av certifikat till coturn
[Timer]
OnCalendar=daily
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload; systemctl enable --now spel-certsync.timer

say "coturn (reservservern)"
LOCALIP="$(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')"
EXT="$MYIP"; [ -n "$LOCALIP" ] && [ "$LOCALIP" != "$MYIP" ] && EXT="$MYIP/$LOCALIP"
cat > /etc/turnserver.conf <<EOF
# Skapad av install.sh
listening-port=3478
tls-listening-port=5349
${EXT:+external-ip=$EXT}
realm=$DOMAIN
server-name=$DOMAIN
use-auth-secret
static-auth-secret=$SECRET
fingerprint
min-port=$RELAY_MIN
max-port=$RELAY_MAX
cert=/etc/coturn/certs/cert.pem
pkey=/etc/coturn/certs/key.pem
no-tlsv1
no-tlsv1_1
no-cli
no-multicast-peers
no-software-attribute
# skicka aldrig vidare till serverns eget eller privata nät
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=::1
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
# begränsningar mot missbruk
user-quota=12
total-quota=300
max-bps=3000000
stale-nonce=600
log-file=syslog
simple-log
EOF
chmod 640 /etc/turnserver.conf; chown root:turnserver /etc/turnserver.conf
[ -f /etc/default/coturn ] && sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
/usr/local/sbin/spel-certsync || true
systemctl enable coturn; systemctl restart coturn

say "Kontroll"
sleep 2
for s in caddy spelserver coturn fail2ban; do printf '%-12s %s\n' "$s" "$(systemctl is-active $s)"; done
curl -fsS "https://$DOMAIN/health" && echo || echo "HTTPS svarar inte än – vänta en minut och prova https://$DOMAIN/health"

cat <<EOF

Klart! Säg till Claude att servern är igång på $DOMAIN, så kopplas appen dit.

Tips för säkerheten:
  - Logga in med SSH-nyckel och stäng av lösenordsinloggning:
      sätt  PasswordAuthentication no  i /etc/ssh/sshd_config och kör  systemctl restart ssh
    (gör det först när du har provat att nyckeln fungerar i ett andra terminalfönster)
  - Skicka aldrig lösenord, nycklar eller innehållet i /etc/spelserver.env till någon.
EOF
