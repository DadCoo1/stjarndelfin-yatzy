#!/usr/bin/env bash
# =====================================================================
#  harden.sh – härdning av en ny Ubuntu 24.04-server för Fröknarnas spelserver
#
#  Kör EN gång som root på en nyinstallerad server:
#     curl -fsSLO https://raw.githubusercontent.com/DadCoo1/stjarndelfin-yatzy/main/server/harden.sh
#     less harden.sh                     # läs igenom först!
#     sudo ADMIN_USER=everest bash harden.sh
#
#  Skriptet går att köra om (idempotent). Det låser dig inte ute: lösenords-
#  inloggning och root-inloggning stängs först när en SSH-nyckel finns för
#  ADMIN_USER, och SSH-konfigurationen provas innan den tas i bruk.
#
#  Låt det gamla SSH-fönstret vara öppet tills du har loggat in i ett NYTT
#  fönster som:  ssh ADMIN_USER@servern
# =====================================================================
set -Eeuo pipefail
umask 022

ADMIN_USER="${ADMIN_USER:-admin}"
SSH_PUBKEY="${SSH_PUBKEY:-}"                 # valfritt: nyckeln som text, annars kopieras roots nycklar
TURN_MIN="${TURN_MIN:-49160}"; TURN_MAX="${TURN_MAX:-49200}"
NO_SERVICES="${HARDEN_NO_SERVICES:-0}"       # 1 = hoppa över systemctl (för test i container)
LOG=/var/log/harden.log

say(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*" | tee -a "$LOG"; }
ok(){  printf '  \033[32m✔\033[0m %s\n' "$*" | tee -a "$LOG"; }
warn(){ printf '  \033[33m!\033[0m %s\n' "$*" | tee -a "$LOG"; }
die(){ printf '\n\033[1;31m✘ %s\033[0m\n' "$*" | tee -a "$LOG"; exit 1; }
svc(){ [ "$NO_SERVICES" = 1 ] && return 0; systemctl "$@"; }
trap 'die "Fel på rad $LINENO – inget mer ändrat. Se $LOG"' ERR

[ "$(id -u)" = 0 ] || die "Kör som root (sudo)."
. /etc/os-release
[ "${ID:-}" = ubuntu ] && [ "${VERSION_ID:-}" = 24.04 ] || warn "Skrivet för Ubuntu 24.04 – du kör ${PRETTY_NAME:-okänt}."
[[ "$ADMIN_USER" =~ ^[a-z][a-z0-9_-]{1,30}$ ]] || die "Ogiltigt användarnamn: $ADMIN_USER"
[ "$ADMIN_USER" != root ] || die "ADMIN_USER får inte vara root."
export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------
say "1/11 Uppdaterar systemet och installerar säkerhetspaket"
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confold full-upgrade
apt-get -y -q install ufw fail2ban unattended-upgrades apt-listchanges needrestart \
  auditd audispd-plugins apparmor apparmor-utils lynis debsums ca-certificates curl gnupg \
  chrony libpam-tmpdir
apt-get -y -q purge telnet rsh-client rsh-redone-client nis talk ftp avahi-daemon cups 2>/dev/null || true
apt-get -y -q autoremove --purge
ok "Systemet uppdaterat"

# ---------------------------------------------------------------------
say "2/11 Administratör: $ADMIN_USER (inloggning bara med SSH-nyckel)"
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$ADMIN_USER" >/dev/null
  ok "Användaren skapad"
fi
usermod -aG sudo "$ADMIN_USER"
H=$(getent passwd "$ADMIN_USER" | cut -d: -f6)
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "$H/.ssh"
AK="$H/.ssh/authorized_keys"; touch "$AK"
if [ -n "$SSH_PUBKEY" ] && ! grep -qxF "$SSH_PUBKEY" "$AK"; then echo "$SSH_PUBKEY" >> "$AK"; fi
if [ -s /root/.ssh/authorized_keys ]; then
  while IFS= read -r k; do if [ -n "$k" ] && ! grep -qxF "$k" "$AK"; then echo "$k" >> "$AK"; fi; done < <(grep -E '^(ssh-|ecdsa-|sk-)' /root/.ssh/authorized_keys)
fi
chown "$ADMIN_USER:$ADMIN_USER" "$AK"; chmod 600 "$AK"
HAVE_KEY=0; if grep -qE '^(ssh-ed25519|sk-ssh-ed25519@openssh.com|ecdsa-sha2-|sk-ecdsa-|ssh-rsa) ' "$AK"; then HAVE_KEY=1; fi
# sudo kräver lösenord – administratören får ett slumpat lösenord som skrivs ut EN gång
if [ "$(passwd -S "$ADMIN_USER" | awk '{print $2}')" != P ]; then
  PW=$(tr -dc 'A-HJ-NP-Za-km-z2-9' </dev/urandom | head -c 24)
  echo "$ADMIN_USER:$PW" | chpasswd
  SUDO_PW_MSG="Lösenord för sudo (spara i din lösenordshanterare, visas bara nu): $PW"
fi
passwd -l root >/dev/null
echo 'Defaults use_pty
Defaults logfile="/var/log/sudo.log"
Defaults timestamp_timeout=5
Defaults passwd_tries=3' > /etc/sudoers.d/10-hardening
chmod 440 /etc/sudoers.d/10-hardening; visudo -cq
ok "sudo kräver lösenord, root-kontot låst"

# ---------------------------------------------------------------------
say "3/11 SSH"
SSHD=/etc/ssh/sshd_config.d/00-hardening.conf
# starka värdnycklar; bara ed25519 (och RSA 4096 som reserv)
[ -f /etc/ssh/ssh_host_ed25519_key ] || ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key
rm -f /etc/ssh/ssh_host_ecdsa_key /etc/ssh/ssh_host_ecdsa_key.pub /etc/ssh/ssh_host_dsa_key*
if [ -f /etc/ssh/moduli ]; then awk '$5 >= 3071' /etc/ssh/moduli > /etc/ssh/moduli.safe && mv /etc/ssh/moduli.safe /etc/ssh/moduli; fi
if [ "$HAVE_KEY" = 1 ]; then AUTH='PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no'; else AUTH='# Ingen SSH-nyckel hittades – lösenordsinloggning är KVAR tills du lagt in en och kör skriptet igen
PermitRootLogin prohibit-password'; warn "Ingen SSH-nyckel för $ADMIN_USER – lösenordsinloggning är kvar. Lägg in nyckeln och kör skriptet igen."; fi
cat > "$SSHD" <<EOF
# Fröknarnas spelserver – härdad SSH (genererad av harden.sh)
$AUTH
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
AllowUsers $ADMIN_USER
MaxAuthTries 3
MaxSessions 4
MaxStartups 10:30:60
LoginGraceTime 20
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
AllowStreamLocalForwarding no
PermitTunnel no
GatewayPorts no
PermitUserEnvironment no
Compression no
UseDNS no
LogLevel VERBOSE
HostKey /etc/ssh/ssh_host_ed25519_key
HostKey /etc/ssh/ssh_host_rsa_key
KexAlgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
HostKeyAlgorithms ssh-ed25519,sk-ssh-ed25519@openssh.com,rsa-sha2-512,rsa-sha2-256
PubkeyAcceptedAlgorithms ssh-ed25519,sk-ssh-ed25519@openssh.com,rsa-sha2-512,rsa-sha2-256
Banner none
EOF
[ "$HAVE_KEY" = 1 ] || sed -i 's/^AuthenticationMethods publickey$/AuthenticationMethods any/' "$SSHD"
# molnavbildernas egna filer får inte slå på lösenord igen
if [ "$HAVE_KEY" = 1 ]; then
  for f in /etc/ssh/sshd_config.d/*.conf; do
    if [ "$f" != "$SSHD" ]; then sed -i -E 's/^\s*(PasswordAuthentication|PermitRootLogin|KbdInteractiveAuthentication)\b/# avstängd av harden.sh: &/' "$f"; fi
  done
fi
sshd -t 2>>"$LOG" || die "SSH-konfigurationen godtogs inte – ingenting omstartat."
svc restart ssh || svc restart sshd
ok "SSH: bara nyckel, ingen root, moderna algoritmer$( [ "$HAVE_KEY" = 1 ] || echo ' (lösenord kvar tills nyckel finns)')"

# ---------------------------------------------------------------------
say "4/11 Brandvägg (ufw)"
ufw --force reset >/dev/null
ufw default deny incoming; ufw default allow outgoing; ufw default deny routed
ufw limit 22/tcp comment 'SSH (begränsad takt)'
ufw allow 80/tcp  comment 'HTTP -> HTTPS'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 443/udp comment 'HTTP/3'
ufw allow 3478/udp comment 'TURN/STUN'; ufw allow 3478/tcp comment 'TURN'
ufw allow 5349/tcp comment 'TURN över TLS'
ufw allow "$TURN_MIN:$TURN_MAX/udp" comment 'TURN-reläportar'
sed -i 's/^IPV6=.*/IPV6=yes/' /etc/default/ufw
ufw logging low
ufw --force enable
ok "Allt inkommande stängt utom SSH, webben och TURN"

# ---------------------------------------------------------------------
say "5/11 fail2ban (spärrar den som gissar)"
cat > /etc/fail2ban/jail.d/00-hardening.local <<'EOF'
[DEFAULT]
backend = systemd
banaction = ufw
bantime = 1h
bantime.increment = true
bantime.factor = 4
bantime.maxtime = 4w
findtime = 10m
maxretry = 4
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
mode = aggressive

[recidive]
enabled = true
backend = auto
logpath = /var/log/fail2ban.log
bantime = 4w
findtime = 1d
maxretry = 3
EOF
svc enable --now fail2ban; svc restart fail2ban
ok "Upprepade misslyckade inloggningar spärras i allt längre tid"

# ---------------------------------------------------------------------
say "6/11 Automatiska säkerhetsuppdateringar (omstart kl 04:00 vid behov)"
cat > /etc/apt/apt.conf.d/52hardening-unattended <<'EOF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}";
  "${distro_id}:${distro_codename}-security";
  "${distro_id}ESMApps:${distro_codename}-apps-security";
  "${distro_id}ESM:${distro_codename}-infra-security";
  "Docker:${distro_codename}";
};
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";' > /etc/apt/apt.conf.d/20auto-upgrades
sed -i "s/^#\?\$nrconf{restart} = .*/\$nrconf{restart} = 'a';/" /etc/needrestart/needrestart.conf 2>/dev/null || true
svc enable --now unattended-upgrades
ok "Säkerhetsuppdateringar installeras varje dag"

# ---------------------------------------------------------------------
say "7/11 Kärnan (sysctl)"
cat > /etc/sysctl.d/90-hardening.conf <<'EOF'
# nätverk – OBS: ip_forward lämnas på, Docker behöver den
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_rfc1337 = 1
net.ipv6.conf.all.accept_ra = 0
net.ipv6.conf.default.accept_ra = 0
# kärnan
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.perf_event_paranoid = 3
kernel.unprivileged_bpf_disabled = 1
net.core.bpf_jit_harden = 2
kernel.yama.ptrace_scope = 2
kernel.kexec_load_disabled = 1
kernel.sysrq = 0
kernel.randomize_va_space = 2
dev.tty.ldisc_autoload = 0
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.protected_fifos = 2
fs.protected_regular = 2
fs.suid_dumpable = 0
vm.mmap_rnd_bits = 32
vm.mmap_rnd_compat_bits = 16
EOF
# IPv6 router advertisements behövs om leverantören delar ut IPv6 via RA – Hetzner använder statisk adress
sysctl --system >/dev/null 2>&1 || warn "Någon sysctl-inställning stöds inte här (ofarligt)"
echo '* hard core 0' > /etc/security/limits.d/90-nocore.conf
mkdir -p /etc/systemd/coredump.conf.d; printf '[Coredump]\nStorage=none\nProcessSizeMax=0\n' > /etc/systemd/coredump.conf.d/disable.conf
# kärnmoduler som en server aldrig behöver
cat > /etc/modprobe.d/90-hardening.conf <<'EOF'
install dccp /bin/false
install sctp /bin/false
install rds /bin/false
install tipc /bin/false
install cramfs /bin/false
install freevxfs /bin/false
install hfs /bin/false
install hfsplus /bin/false
install jffs2 /bin/false
install udf /bin/false
install usb-storage /bin/false
install firewire-core /bin/false
install bluetooth /bin/false
EOF
ok "Kärnan härdad, minnesdumpar avstängda, onödiga moduler blockerade"

# ---------------------------------------------------------------------
say "8/11 Filsystem och inloggning"
grep -qE '^\S+\s+/dev/shm\s' /etc/fstab || echo 'tmpfs /dev/shm tmpfs defaults,nodev,nosuid,noexec 0 0' >> /etc/fstab
mount -o remount,nodev,nosuid,noexec /dev/shm 2>/dev/null || true
sed -i -E 's/^UMASK\s+.*/UMASK\t\t027/' /etc/login.defs
sed -i -E 's/^#?\s*(DIR_MODE)=.*/\1=0750/' /etc/adduser.conf
chmod 750 "$H"
chmod 600 /etc/crontab 2>/dev/null || true; chmod 700 /etc/cron.d /etc/cron.daily /etc/cron.hourly /etc/cron.weekly /etc/cron.monthly 2>/dev/null || true
echo root > /etc/cron.allow; echo root > /etc/at.allow 2>/dev/null || true; chmod 600 /etc/cron.allow
# inga kompilatorer för andra än root
for c in /usr/bin/gcc* /usr/bin/cc /usr/bin/g++* /usr/bin/as; do if [ -e "$c" ]; then chmod o-rx "$(readlink -f "$c")"; fi; done
# journalen sparas, men tar inte över disken
mkdir -p /etc/systemd/journald.conf.d; printf '[Journal]\nStorage=persistent\nSystemMaxUse=1G\nCompress=yes\n' > /etc/systemd/journald.conf.d/90-hardening.conf
svc restart systemd-journald
ok "Delat minne utan körbara filer, striktare filrättigheter, loggar sparas"

# ---------------------------------------------------------------------
say "9/11 Granskningslogg (auditd) och AppArmor"
cat > /etc/audit/rules.d/90-hardening.rules <<'EOF'
-D
-b 8192
-f 1
-w /etc/passwd -p wa -k identitet
-w /etc/shadow -p wa -k identitet
-w /etc/group -p wa -k identitet
-w /etc/gshadow -p wa -k identitet
-w /etc/sudoers -p wa -k sudo
-w /etc/sudoers.d/ -p wa -k sudo
-w /etc/ssh/sshd_config -p wa -k ssh
-w /etc/ssh/sshd_config.d/ -p wa -k ssh
-w /root/.ssh/ -p wa -k ssh
-w /etc/ufw/ -p wa -k brandvagg
-w /etc/docker/ -p wa -k docker
-w /usr/bin/docker -p x -k docker
-w /etc/crontab -p wa -k cron
-w /etc/cron.d/ -p wa -k cron
-w /var/log/sudo.log -p wa -k sudo
-a always,exit -F arch=b64 -S init_module,finit_module,delete_module -k moduler
-a always,exit -F arch=b64 -S execve -F euid=0 -F auid>=1000 -F auid!=unset -k rootkommando
-e 2
EOF
svc enable --now auditd; augenrules --load >/dev/null 2>&1 || warn "auditd-reglerna laddas vid nästa omstart"
svc enable --now apparmor
aa-status --enabled 2>/dev/null && ok "AppArmor aktivt" || warn "AppArmor ser inte aktivt ut"
ok "Ändringar i konton, sudo, SSH, brandvägg och Docker loggas (låst tills omstart)"

# ---------------------------------------------------------------------
say "10/11 Docker (för spelservern) med säkra standardvärden"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q; apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "icc": false,
  "no-new-privileges": true,
  "live-restore": true,
  "userland-proxy": false,
  "ip": "127.0.0.1",
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "default-ulimits": { "nofile": { "Name": "nofile", "Soft": 65536, "Hard": 65536 } }
}
EOF
svc enable --now docker; svc restart docker
# OBS: administratören läggs INTE i docker-gruppen (det vore detsamma som root) – använd sudo docker
ok "Docker installerat; portar publiceras som standard bara på 127.0.0.1"

# ---------------------------------------------------------------------
say "11/11 Kontroll med Lynis"
lynis audit system --quick --no-colors > /var/log/lynis-harden.log 2>&1 || true
SCORE=$(grep -oP 'Hardening index : \K[0-9]+' /var/log/lynis-harden.log || echo '?')
ok "Lynis härdningsindex: $SCORE / 100 (hela rapporten: /var/log/lynis-harden.log)"

trap - ERR
printf '\n\033[1;32m✔ Klart.\033[0m\n'
cat <<EOF

  Gör nu så här, i ett NYTT terminalfönster (stäng inte det här än):
     ssh $ADMIN_USER@$(hostname -I | awk '{print $1}')
     sudo -v          # prova att sudo fungerar
  Fungerar det kan du stänga det gamla fönstret. Starta sedan om servern en gång:
     sudo reboot

EOF
if [ -n "${SUDO_PW_MSG:-}" ]; then printf '  \033[1;33m%s\033[0m\n\n' "$SUDO_PW_MSG"; fi
[ "$HAVE_KEY" = 1 ] || printf '  \033[1;33mLägg in din SSH-nyckel och kör skriptet igen för att stänga lösenordsinloggningen.\033[0m\n\n'
