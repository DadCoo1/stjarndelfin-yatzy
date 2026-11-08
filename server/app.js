/* Spelservern för Fröknarna Leins game board
   - /auth   : inloggning med användarnamn + engångskod från en TOTP-app (t.ex. Google Authenticator, 2FAS, Aegis)
   - /peer   : kopplingsserver (PeerJS) – bara för inloggade
   - /turn   : tillfälliga inloggningar till reservservern (coturn) – bara för inloggade
   - /mbox   : brevlåda för krypterade chattmeddelanden när mottagaren är offline (servern kan inte läsa dem)
   - /presence : vilka kontakter som är uppkopplade just nu
   Konton kan bara skapas via en inbjudningslänk från administratören:  sudo spel-user invite <namn>
   Den som öppnar länken får en egen TOTP-nyckel (QR-kod) och bekräftar med en kod – annars går det inte att skapa konto. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { ExpressPeerServer } = require('peer');

const PORT = +process.env.PORT || 9000;
const SECRET = process.env.TURN_SECRET || '';
const DOMAIN = process.env.DOMAIN || 'localhost';
const TURN_HOST = process.env.TURN_HOST || DOMAIN;
const DATA = process.env.DATA_DIR || '/var/lib/spelserver';
const TTL = 6 * 3600;
const SESSION_DAYS = 180;
const ORIGINS = (process.env.ALLOW_ORIGINS || 'https://dadcoo1.github.io').split(',').map(s => s.trim()).filter(Boolean);
if (!SECRET) { console.error('TURN_SECRET saknas'); process.exit(1); }
fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });

/* ---------- lagring (små JSON-filer, skrivs atomiskt) ---------- */
const file = n => path.join(DATA, n);
function load(n, def) { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch (e) { return def; } }
function save(n, obj) { const t = file(n) + '.tmp'; fs.writeFileSync(t, JSON.stringify(obj), { mode: 0o600 }); fs.renameSync(t, file(n)); }
const later = {}; function saveSoon(n, get) { if (later[n]) return; later[n] = setTimeout(() => { later[n] = null; save(n, get()); }, 1500); }

// användare: läses om när filen ändras (spel-user skriver den)
let USERS = {}, usersMtime = 0;
function users() { try { const m = fs.statSync(file('users.json')).mtimeMs; if (m !== usersMtime) { usersMtime = m; USERS = (load('users.json', { users: {} }).users) || {}; } } catch (e) { USERS = {}; } return USERS; }
let SESS = load('sessions.json', {});            // sha256(token) -> {u, exp, at}
let MBOX = load('mbox.json', { box: {}, owner: {} });   // box: chatId -> [{k, env, at}], owner: chatId -> användare
const now = () => Date.now();

/* ---------- inbjudningar (skapas av spel-user, används en gång) ---------- */
function b32enc(buf) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0, out = ''; for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += A[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += A[(val << (5 - bits)) & 31]; return out; }
const invHash = t => crypto.createHash('sha256').update('inv|' + String(t)).digest('hex');
function invite(tok) {
  if (typeof tok !== 'string' || !/^[A-Za-z0-9_-]{24,64}$/.test(tok)) return null;
  const db = load('invites.json', { invites: {} }), h = invHash(tok), inv = (db.invites || {})[h];
  if (!inv || inv.exp < now()) return null;
  return { db, h, inv };
}

/* ---------- TOTP (RFC 6238, SHA-1, 30 s, 6 siffror) ---------- */
function b32dec(s) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) { const i = A.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out); }
function hotp(key, counter) { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter)); const h = crypto.createHmac('sha1', key).update(b).digest();
  const o = h[h.length - 1] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0'); }
function checkTotp(secret, code, lastStep) {
  const key = b32dec(secret), step = Math.floor(now() / 30000);
  for (const d of [0, -1, 1]) { const s = step + d; if (s <= (lastStep || 0)) continue;
    const c = hotp(key, s); if (c.length === code.length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(code))) return s; }
  return 0;
}

/* ---------- skydd mot gissning ---------- */
const fails = new Map();   // nyckel -> [tider]
function tooMany(k, max, ms) { const t = (fails.get(k) || []).filter(x => now() - x < ms); fails.set(k, t); return t.length >= max; }
function fail(k) { const t = fails.get(k) || []; t.push(now()); fails.set(k, t); }
setInterval(() => { for (const [k, t] of fails) if (!t.some(x => now() - x < 3600e3)) fails.delete(k); }, 600e3).unref();
const hits = new Map(); setInterval(() => hits.clear(), 60e3).unref();
function limited(k, n) { const c = (hits.get(k) || 0) + 1; hits.set(k, c); return c > n; }

/* ---------- sessioner ---------- */
const hashTok = t => crypto.createHash('sha256').update(String(t)).digest('hex');
function session(tok) {
  if (typeof tok !== 'string' || !/^[0-9a-f]{64}$/.test(tok)) return null;
  const s = SESS[hashTok(tok)]; if (!s || s.exp < now()) return null;
  const u = users()[s.u]; if (!u || u.disabled || (u.revokedBefore && s.at < u.revokedBefore)) return null;
  if (s.exp - now() < (SESSION_DAYS - 7) * 864e5) { s.exp = now() + SESSION_DAYS * 864e5; saveSoon('sessions.json', () => SESS); }   // glidande giltighet
  return s;
}
const bearer = req => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7).trim() : ''; };
function auth(req, res, next) { const s = session(bearer(req)); if (!s) return res.status(401).json({ error: 'inte inloggad' }); req.user = s.u; next(); }

/* ---------- appen ---------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && ORIGINS.includes(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.set('Access-Control-Max-Age', '600'); }
  if (o && !ORIGINS.includes(o) && !req.path.startsWith('/peer')) return res.status(403).json({ error: 'fel ursprung' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  res.set('Cache-Control', 'no-store');
  next();
});
const json = express.json({ limit: '400kb' });
// PeerJS-anrop över HTTP: /peer/<sessionsnyckel>/... -> kontrollera och byt till den interna nyckeln
app.use((req, res, next) => {
  if (!req.url.startsWith('/peer/')) return next();
  const m = req.url.match(/^\/peer\/([0-9a-f]{64})(\/.*)?$/);
  if (!m || !session(m[1])) return res.status(401).json({ error: 'inte inloggad' });
  req.url = '/peer/peerjs' + (m[2] || '/'); next();
});

app.post('/auth/login', json, (req, res) => {
  const ip = req.ip, name = String((req.body || {}).user || '').trim().toLowerCase().slice(0, 40), code = String((req.body || {}).code || '').replace(/\s/g, '');
  if (tooMany('ip:' + ip, 20, 15 * 60e3) || tooMany('u:' + name, 6, 15 * 60e3)) return res.status(429).json({ error: 'För många försök. Vänta en kvart.' });
  const u = users()[name];
  const step = u && !u.disabled && /^\d{6}$/.test(code) ? checkTotp(u.secret, code, u.lastStep) : 0;
  if (!step) { fail('ip:' + ip); fail('u:' + name); return res.status(401).json({ error: 'Fel användarnamn eller kod' }); }
  // samma kod får inte användas två gånger
  const all = load('users.json', { users: {} }); if (all.users[name]) { all.users[name].lastStep = step; all.users[name].lastLogin = now(); save('users.json', all); usersMtime = 0; }
  const tok = crypto.randomBytes(32).toString('hex');
  SESS[hashTok(tok)] = { u: name, exp: now() + SESSION_DAYS * 864e5, at: now(), ua: String(req.headers['user-agent'] || '').slice(0, 120) };
  save('sessions.json', SESS);
  res.json({ token: tok, user: name, days: SESSION_DAYS });
});
// 1) vad gäller inbjudan?
app.post('/invite/info', json, (req, res) => {
  if (tooMany('inv:' + req.ip, 30, 15 * 60e3)) return res.status(429).json({ error: 'För många försök. Vänta en kvart.' });
  const x = invite((req.body || {}).token); if (!x) { fail('inv:' + req.ip); return res.status(404).json({ error: 'Inbjudan finns inte eller har gått ut. Be om en ny länk.' }); }
  res.json({ user: x.inv.user, exp: x.inv.exp, reset: !!users()[x.inv.user] });
});
// 2) skapa en TOTP-nyckel för inbjudan (samma nyckel om man öppnar länken igen)
app.post('/invite/start', json, (req, res) => {
  if (tooMany('inv:' + req.ip, 30, 15 * 60e3)) return res.status(429).json({ error: 'För många försök. Vänta en kvart.' });
  const x = invite((req.body || {}).token); if (!x) { fail('inv:' + req.ip); return res.status(404).json({ error: 'Inbjudan finns inte eller har gått ut. Be om en ny länk.' }); }
  if (!x.inv.secret) { x.inv.secret = b32enc(crypto.randomBytes(20)); save('invites.json', x.db); }
  const uri = `otpauth://totp/${encodeURIComponent('Spelservern:' + x.inv.user)}?secret=${x.inv.secret}&issuer=${encodeURIComponent('Spelservern')}&algorithm=SHA1&digits=6&period=30`;
  res.json({ user: x.inv.user, secret: x.inv.secret, uri });
});
// 3) bekräfta med en kod från appen -> kontot skapas, inbjudan förbrukas, inloggad
app.post('/invite/finish', json, (req, res) => {
  const b = req.body || {}, code = String(b.code || '').replace(/\s/g, '');
  const x = invite(b.token); if (!x || !x.inv.secret) return res.status(404).json({ error: 'Inbjudan finns inte eller har gått ut. Be om en ny länk.' });
  if (tooMany('invf:' + x.h, 8, 15 * 60e3)) return res.status(429).json({ error: 'För många fel koder. Vänta en kvart.' });
  const step = /^\d{6}$/.test(code) ? checkTotp(x.inv.secret, code, 0) : 0;
  if (!step) { fail('invf:' + x.h); return res.status(401).json({ error: 'Koden stämmer inte. Kolla att du skannade rätt QR-kod och försök med nästa kod.' }); }
  const name = x.inv.user, all = load('users.json', { users: {} }); all.users = all.users || {};
  const old = all.users[name] || {};
  all.users[name] = { ...old, secret: x.inv.secret, created: old.created || now(), lastStep: step, lastLogin: now(), revokedBefore: old.secret ? now() - 1 : old.revokedBefore, disabled: false };
  save('users.json', all); usersMtime = 0;
  delete x.db.invites[x.h]; save('invites.json', x.db);
  const tok = crypto.randomBytes(32).toString('hex');
  SESS[hashTok(tok)] = { u: name, exp: now() + SESSION_DAYS * 864e5, at: now(), ua: String(req.headers['user-agent'] || '').slice(0, 120) };
  save('sessions.json', SESS);
  res.json({ token: tok, user: name, days: SESSION_DAYS });
});
app.post('/auth/logout', (req, res) => { const t = bearer(req); if (t) { delete SESS[hashTok(t)]; save('sessions.json', SESS); } res.json({ ok: true }); });
app.get('/auth/me', auth, (req, res) => res.json({ user: req.user }));

app.get('/turn', auth, (req, res) => {
  if (limited('turn:' + req.user, 60)) return res.status(429).json({ error: 'för många' });
  const exp = Math.floor(now() / 1000) + TTL, username = exp + ':' + req.user;
  const credential = crypto.createHmac('sha1', SECRET).update(username).digest('base64');
  res.json({ ttl: TTL, exp, iceServers: [
    { urls: [`stun:${TURN_HOST}:3478`] },
    { urls: [`turn:${TURN_HOST}:3478?transport=udp`, `turn:${TURN_HOST}:3478?transport=tcp`, `turns:${TURN_HOST}:5349?transport=tcp`], username, credential }
  ] });
});

/* ---------- brevlåda för krypterade meddelanden ---------- */
const isId = x => typeof x === 'string' && /^[0-9a-f]{16,64}$/.test(x);
const MAXBOX = 3000, KEEP = 45 * 864e5;
function prune() { const lim = now() - KEEP; for (const id of Object.keys(MBOX.box)) { MBOX.box[id] = MBOX.box[id].filter(m => m.at > lim); if (!MBOX.box[id].length) delete MBOX.box[id]; } }
setInterval(() => { prune(); saveSoon('mbox.json', () => MBOX); }, 3600e3).unref();
// en chatt-identitet kopplas till det konto som först gör anspråk på den
app.post('/mbox/claim', auth, json, (req, res) => {
  const ids = [].concat((req.body || {}).ids || []).filter(isId).slice(0, 8), mine = [];
  for (const id of ids) { if (!MBOX.owner[id]) MBOX.owner[id] = req.user; if (MBOX.owner[id] === req.user) mine.push(id); }
  saveSoon('mbox.json', () => MBOX); res.json({ ids: mine });
});
app.post('/mbox/send', auth, json, (req, res) => {
  if (limited('send:' + req.user, 600)) return res.status(429).json({ error: 'för många' });
  const list = [].concat((req.body || {}).items || []).slice(0, 50); let n = 0;
  for (const it of list) {
    if (!it || !isId(it.to) || !it.env || typeof it.env !== 'object') continue;
    const raw = JSON.stringify(it.env); if (raw.length > 300000) continue;
    const k = crypto.createHash('sha256').update(it.to + '|' + raw).digest('hex').slice(0, 24);
    const box = MBOX.box[it.to] = MBOX.box[it.to] || [];
    if (box.some(m => m.k === k)) { n++; continue; }
    box.push({ k, env: it.env, at: now() }); if (box.length > MAXBOX) box.splice(0, box.length - MAXBOX); n++;
  }
  saveSoon('mbox.json', () => MBOX); res.json({ stored: n });
});
app.post('/mbox/fetch', auth, json, (req, res) => {
  const ids = [].concat((req.body || {}).ids || []).filter(id => isId(id) && MBOX.owner[id] === req.user).slice(0, 8);
  const out = []; for (const id of ids) for (const m of (MBOX.box[id] || []).slice(0, 300)) out.push({ to: id, k: m.k, env: m.env, at: m.at });
  res.json({ items: out });
});
app.post('/mbox/ack', auth, json, (req, res) => {
  const b = req.body || {}, keys = new Set([].concat(b.keys || []).filter(k => typeof k === 'string').slice(0, 1000));
  for (const id of [].concat(b.ids || []).filter(id => isId(id) && MBOX.owner[id] === req.user)) {
    if (MBOX.box[id]) { MBOX.box[id] = MBOX.box[id].filter(m => !keys.has(m.k)); if (!MBOX.box[id].length) delete MBOX.box[id]; } }
  saveSoon('mbox.json', () => MBOX); res.json({ ok: true });
});

/* ---------- närvaro ---------- */
const ONLINE = new Map(), LAST = new Map();
app.post('/presence', auth, json, (req, res) => {
  const ids = [].concat((req.body || {}).peers || []).filter(x => typeof x === 'string' && x.length < 120).slice(0, 200);
  const out = {}; for (const id of ids) { if (ONLINE.has(id)) out[id] = 0; else if (LAST.has(id)) out[id] = LAST.get(id); }
  res.json({ now: now(), peers: out });
});

app.get('/health', (req, res) => res.json({ ok: true }));

/* ---------- kopplingsservern: bara med giltig inloggning ----------
   Klienten skickar sin sessionsnyckel som PeerJS "key"; här kontrolleras den och byts ut. */
const server = http.createServer(app);
server.prependListener('upgrade', (req, socket) => {
  try {
    const u = new URL(req.url, 'http://x'); if (!u.pathname.startsWith('/peer')) return;
    if (!session(u.searchParams.get('key'))) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
    u.searchParams.set('key', 'peerjs'); req.url = u.pathname + u.search;
  } catch (e) { socket.destroy(); }
});
const peer = ExpressPeerServer(server, { path: '/', key: 'peerjs', proxied: true, alive_timeout: 60000, allow_discovery: false });
app.use('/peer', peer);
peer.on('connection', c => { ONLINE.set(c.getId(), now()); LAST.set(c.getId(), now()); });
peer.on('disconnect', c => { ONLINE.delete(c.getId()); LAST.set(c.getId(), now()); });

server.listen(PORT, '127.0.0.1', () => console.log(`spelserver lyssnar på 127.0.0.1:${PORT} (${DOMAIN})`));
process.on('SIGTERM', () => { save('sessions.json', SESS); save('mbox.json', MBOX); process.exit(0); });
