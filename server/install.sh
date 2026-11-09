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
AAAA="$(getent ahostsv6 "$DOMAIN" | awk '$1 !~ /^::ffff:/ {print $1; exit}' || true)"
if [ -n "$AAAA" ]; then echo "Varning: $DOMAIN har en IPv6-adress ($AAAA). Servern använder bara IPv4 – ta bort IPv6-adressen (AAAA) hos DNS-leverantören, annars når många mobiler inte servern."; fi

say "Paket"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl gnupg debian-keyring debian-archive-keyring apt-transport-https ufw unattended-upgrades fail2ban coturn nodejs npm openssl qrencode
if ! command -v caddy >/dev/null; then
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi

say "Säkerhet: automatiska uppdateringar, fail2ban, brandvägg"
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
systemctl enable --now fail2ban
# bara IPv4: inga IPv6-regler, och tjänsterna lyssnar bara på IPv4
sed -i 's/^IPV6=.*/IPV6=no/' /etc/default/ufw
ufw default deny incoming >/dev/null; ufw default allow outgoing >/dev/null
ufw limit OpenSSH >/dev/null                      # max 6 nya SSH-anslutningar per 30 s och IP
ufw delete allow OpenSSH >/dev/null 2>&1 || true
ufw delete allow 80/tcp >/dev/null 2>&1 || true   # port 80 behövs inte: certifikatet hämtas via 443 (TLS-ALPN)
ufw allow 443/tcp >/dev/null
ufw allow 3478/udp >/dev/null; ufw allow 3478/tcp >/dev/null; ufw allow 5349/tcp >/dev/null
ufw allow ${RELAY_MIN}:${RELAY_MAX}/udp >/dev/null
ufw logging off >/dev/null                         # ingen brandväggslogg med andras IP-adresser
ufw --force enable >/dev/null
ufw status | sed -n '1,30p'

say "Härdning: kärnan, SSH och fail2ban"
cat > /etc/sysctl.d/90-spelserver.conf <<'EOF2'
# skydd mot förfalskade paket, SYN-flod och omdirigeringar
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
# bara IPv4
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
EOF2
sysctl -q --system >/dev/null 2>&1 || true

# SSH: bara nyckel – men bara om det redan finns en nyckel, så att ingen låses ute
HASKEY=""; for d in /root /home/*; do [ -s "$d/.ssh/authorized_keys" ] && HASKEY="$d"; done
if [ -n "$HASKEY" ]; then
  mkdir -p /etc/ssh/sshd_config.d
  cat > /etc/ssh/sshd_config.d/10-spelserver.conf <<'EOF2'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
MaxStartups 10:30:30
LoginGraceTime 20
X11Forwarding no
AllowAgentForwarding no
PermitTunnel no
ClientAliveInterval 300
ClientAliveCountMax 2
EOF2
  if sshd -t 2>/dev/null; then systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true; echo "SSH: bara nyckelinloggning"; else rm -f /etc/ssh/sshd_config.d/10-spelserver.conf; echo "SSH: kunde inte skärpa (sshd -t klagade) – lämnade som det var"; fi
else
  echo "SSH: hittade ingen authorized_keys – lösenordsinloggning lämnas på tills du har lagt in en nyckel (kör skriptet igen sedan)"
fi

# fail2ban: SSH-gissare, felaktiga inloggningar i appen och sårbarhetsskannrar spärras
mkdir -p /etc/fail2ban/filter.d /etc/fail2ban/jail.d
cat > /etc/fail2ban/filter.d/spelserver.conf <<'EOF2'
[Definition]
failregex = ^.*sec fail ip=<HOST>$
ignoreregex =
EOF2
cat > /etc/fail2ban/filter.d/spelserver-probe.conf <<'EOF2'
[Definition]
failregex = ^.*sec probe ip=<HOST>$
ignoreregex =
EOF2
cat > /etc/fail2ban/jail.d/spelserver.local <<'EOF2'
[DEFAULT]
backend = systemd
banaction = ufw
ignoreip = 127.0.0.1/8

[sshd]
enabled = true
maxretry = 3
findtime = 10m
bantime = 1d

[spelserver]
enabled = true
journalmatch = _SYSTEMD_UNIT=spelserver.service
filter = spelserver
maxretry = 20
findtime = 15m
bantime = 2h

[spelserver-probe]
enabled = true
journalmatch = _SYSTEMD_UNIT=spelserver.service
filter = spelserver-probe
maxretry = 4
findtime = 10m
bantime = 1d

[recidive]
enabled = true
backend = auto
logpath = /var/log/fail2ban.log
maxretry = 3
findtime = 1d
bantime = 2w
EOF2
systemctl restart fail2ban

# loggarna sparas kort (IP-adresser vid misslyckade försök ska inte ligga kvar)
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nMaxRetentionSec=14day\nSystemMaxUse=200M\n' > /etc/systemd/journald.conf.d/90-spelserver.conf
systemctl restart systemd-journald 2>/dev/null || true

# säkerhetsuppdateringar installeras automatiskt – och servern startar om kl 04:30 om en uppdatering kräver det
printf 'Unattended-Upgrade::Automatic-Reboot "true";\nUnattended-Upgrade::Automatic-Reboot-Time "04:30";\n' > /etc/apt/apt.conf.d/52spelserver-reboot

say "Hemlighet för TURN (skapas bara första gången)"
if [ ! -f /etc/spelserver.env ]; then
  ( umask 077
  printf 'TURN_SECRET=%s\nDOMAIN=%s\nALLOW_ORIGINS=%s\nPORT=9000\n' "$(openssl rand -hex 32)" "$DOMAIN" "$ORIGINS" > /etc/spelserver.env )
fi
umask 022
SECRET="$(grep '^TURN_SECRET=' /etc/spelserver.env | cut -d= -f2)"

say "Spelservern"
id spelserver >/dev/null 2>&1 || useradd --system --home /opt/spelserver --shell /usr/sbin/nologin spelserver
mkdir -p /opt/spelserver
mkdir -p /opt/spelserver/admin
for f in app.js package.json spel-user admin/index.html admin/admin.js admin/qr.js; do curl -fsSL "$REPO_RAW/$f" -o "/opt/spelserver/$f"; done
(cd /opt/spelserver && npm install --omit=dev --no-audit --no-fund --loglevel=error)
chown -R root:root /opt/spelserver
chmod -R a+rX /opt/spelserver
install -m 755 /opt/spelserver/spel-user /usr/local/sbin/spel-user
chown root:spelserver /etc/spelserver.env; chmod 640 /etc/spelserver.env
cat > /etc/systemd/system/spelserver.service <<EOF
[Unit]
Description=Spelserver (PeerJS + TURN-inloggningar)
After=network-online.target
[Service]
User=spelserver
EnvironmentFile=/etc/spelserver.env
WorkingDirectory=/opt/spelserver
StateDirectory=spelserver
StateDirectoryMode=0700
Environment=DATA_DIR=/var/lib/spelserver
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
{
	default_bind 0.0.0.0
	# ingen port 80: ingen omdirigering, certifikatet förnyas via 443
	auto_https disable_redirects
	servers {
		protocols h1 h2
		timeouts {
			read_header 10s
			idle 2m
		}
	}
}
$DOMAIN {
	tls {
		issuer acme {
			disable_http_challenge
		}
	}
	request_body {
		max_size 20MB
	}
	encode gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options nosniff
		Referrer-Policy no-referrer
		-Server
	}
	# ingen åtkomstlogg: Caddy loggar inte anrop om man inte ber om det
	# allt går till spelservern, som själv svarar 404 på okända adresser (och spärrar skannrar via fail2ban)
	@root path /
	respond @root "Spelservern är igång" 200
	reverse_proxy 127.0.0.1:9000
}
EOF
chmod 644 /etc/caddy/Caddyfile
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
listening-ip=$LOCALIP
relay-ip=$LOCALIP
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
cipher-list="ECDHE+AESGCM:ECDHE+CHACHA20"

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
# ingen loggning av anslutningar (IP-adresser) – bara uppstart och fel syns i journalen
no-stdout-log
log-file=/dev/null
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

Konton skapas bara via inbjudningslänkar. Börja med ditt eget adminkonto:
  sudo spel-user invite dittnamn --admin
Öppna länken, lägg in nyckeln i din TOTP-app och logga sedan in på admin-sidan:
  https://$DOMAIN/admin
Där bjuder du in fler, ser statistik och hanterar konton.

Säkerheten:
  - Öppna portar: 22 (SSH, bara nyckel, max 6 försök/30 s), 443 (HTTPS), 3478 + 5349 och reläportarna (TURN). Port 80 är stängd.
  - fail2ban spärrar SSH-gissare (1 dygn), felaktiga inloggningar i appen (2 h) och sårbarhetsskannrar (1 dygn); återfall = 2 veckor.
    Se spärrar:  sudo fail2ban-client status spelserver-probe
  - Säkerhetsuppdateringar installeras automatiskt; omstart 04:30 vid behov.
  - Skicka aldrig lösenord, nycklar eller innehållet i /etc/spelserver.env till någon.
EOF
