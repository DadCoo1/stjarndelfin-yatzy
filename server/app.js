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
const APP_URL = (process.env.APP_URL || 'https://dadcoo1.github.io/stjarndelfin-yatzy/').replace(/\/?$/, '/');
const STARTED = Date.now();
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

/* ---------- statistik (per dag, svensk tid) ---------- */
let STATS = load('stats.json', { days: {}, audit: [] });
const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' });
const today = () => dayFmt.format(new Date());
function bump(user, fn) {
  const d = STATS.days[today()] = STATS.days[today()] || { games: {}, users: {}, logins: 0, turn: 0, mbox: 0, calls: { n: 0, video: 0, sec: 0 } };
  const u = user ? (d.users[user] = d.users[user] || { games: 0, msgs: 0, calls: 0, sec: 0, logins: 0 }) : null;
  fn(d, u); saveSoon('stats.json', () => STATS);
}
function audit(who, what) { STATS.audit.unshift({ at: now(), who, what }); STATS.audit = STATS.audit.filter(x => now() - x.at < 90 * 864e5).slice(0, 400); saveSoon('stats.json', () => STATS); }
setInterval(() => { const keep = new Set(); for (let i = 0; i < 35; i++) keep.add(dayFmt.format(new Date(now() - i * 864e5))); for (const k of Object.keys(STATS.days)) if (!keep.has(k)) delete STATS.days[k]; }, 6 * 3600e3).unref();

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
function fail(k) { const t = fails.get(k) || []; t.push(now()); fails.set(k, t); if (/^(ip|inv|aip):/.test(k)) secLog('fail', k.slice(k.indexOf(':') + 1)); }
// säkerhetsrad för fail2ban: bara IP-adressen vid misslyckade inloggningar och skanningsförsök – aldrig användarnamn eller innehåll
const secSeen = new Map();
function secLog(kind, ip) {
  if (!ip || !/^[0-9.]+$/.test(ip = String(ip).replace(/^::ffff:/, ''))) return;
  const k = kind + ip, t = now(); if (t - (secSeen.get(k) || 0) < 2000) return; secSeen.set(k, t);
  if (secSeen.size > 5000) secSeen.clear();
  console.log(`sec ${kind} ip=${ip}`);
}
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
  if (o && ORIGINS.includes(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE'); res.set('Access-Control-Max-Age', '600'); }
  const self = o && (o === 'https://' + DOMAIN || o === 'http://' + req.headers.host);
  if (o && !ORIGINS.includes(o) && !self && !req.path.startsWith('/peer')) return res.status(403).json({ error: 'fel ursprung' });
  if (req.path.startsWith('/admin') && o && !self) return res.status(403).json({ error: 'fel ursprung' });
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
  SESS[hashTok(tok)] = { u: name, exp: now() + SESSION_DAYS * 864e5, at: now() };
  save('sessions.json', SESS);
  bump(name, (d, u) => { d.logins++; u.logins++; });
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
  all.users[name] = { ...old, secret: x.inv.secret, created: old.created || now(), lastStep: step, lastLogin: now(), revokedBefore: old.secret ? now() - 1 : old.revokedBefore, disabled: false, admin: !!(old.admin || x.inv.admin) };
  save('users.json', all); usersMtime = 0;
  delete x.db.invites[x.h]; save('invites.json', x.db); audit(name, (old.secret ? 'bytte TOTP-nyckel via inbjudan' : 'skapade kontot via inbjudan'));
  const tok = crypto.randomBytes(32).toString('hex');
  SESS[hashTok(tok)] = { u: name, exp: now() + SESSION_DAYS * 864e5, at: now() };
  save('sessions.json', SESS);
  bump(name, (d, u) => { d.logins++; u.logins++; });
  res.json({ token: tok, user: name, days: SESSION_DAYS });
});
app.post('/auth/logout', (req, res) => { const t = bearer(req); if (t) { delete SESS[hashTok(t)]; save('sessions.json', SESS); } res.json({ ok: true }); });
app.get('/auth/me', auth, (req, res) => res.json({ user: req.user }));

app.get('/turn', auth, (req, res) => {
  if (limited('turn:' + req.user, 60)) return res.status(429).json({ error: 'för många' });
  const exp = Math.floor(now() / 1000) + TTL, username = exp + ':' + crypto.randomBytes(6).toString('hex');   // inget användarnamn syns i TURN-trafiken
  const credential = crypto.createHmac('sha1', SECRET).update(username).digest('base64');
  bump(req.user, d => { d.turn++; });
  res.json({ ttl: TTL, exp, iceServers: [
    { urls: [`stun:${TURN_HOST}:3478`] },
    { urls: [`turn:${TURN_HOST}:3478?transport=udp`, `turn:${TURN_HOST}:3478?transport=tcp`, `turns:${TURN_HOST}:5349?transport=tcp`], username, credential }
  ] });
});

/* ---------- brevlåda för förseglade meddelanden ----------
   Kuverten är förseglade i appen: utanpå syns bara mottagarens chatt-ID och en utfylld storlek – inte avsändaren,
   inte innehållet. Servern sparar inte vilket konto en chatt-identitet hör till: hämtning bevisas med
   chatt-identitetens egen nyckel (ECDH-utmaning), så brevlådan går inte att koppla till ett användarnamn. */
const isId = x => typeof x === 'string' && /^[0-9a-f]{16}$/.test(x);
const isB64 = (x, max) => typeof x === 'string' && x.length <= max && /^[A-Za-z0-9+/=]+$/.test(x);
const MAXBOX = 3000, KEEP = 30 * 864e5, hourOf = t => Math.floor(t / 3600e3) * 3600e3;
MBOX.keys = MBOX.keys || {}; delete MBOX.owner;
function prune() { const lim = now() - KEEP; for (const id of Object.keys(MBOX.box)) { MBOX.box[id] = MBOX.box[id].filter(m => m.at > lim); if (!MBOX.box[id].length) delete MBOX.box[id]; } }
setInterval(() => { prune(); saveSoon('mbox.json', () => MBOX); }, 3600e3).unref();
function rawToKey(curve, pubB64) {
  const raw = Buffer.from(pubB64, 'base64');
  if (curve === 'X25519' && raw.length === 32) return crypto.createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x: raw.toString('base64url') }, format: 'jwk' });
  if (curve === 'P-256' && raw.length === 65 && raw[0] === 4) return crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' });
  throw new Error('fel nyckel');
}
function ephFor(curve) {
  const kp = curve === 'X25519' ? crypto.generateKeyPairSync('x25519') : crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const j = kp.publicKey.export({ format: 'jwk' });
  const raw = curve === 'X25519' ? Buffer.from(j.x, 'base64url') : Buffer.concat([Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url')]);
  return { priv: kp.privateKey, pub: raw.toString('base64') };
}
// en chatt-identitet registreras med sin publika nyckel (ID = hash av nyckeln) – utan koppling till kontot
app.post('/mbox/claim', auth, json, (req, res) => {
  const b = req.body || {};
  if (!isId(b.id) || !['X25519', 'P-256'].includes(b.curve) || !isB64(b.pub, 100)) return res.status(400).json({ error: 'fel' });
  const id = crypto.createHash('sha256').update(Buffer.from(b.pub, 'base64')).digest('hex').slice(0, 16);
  if (id !== b.id) return res.status(400).json({ error: 'fel' });
  try { rawToKey(b.curve, b.pub); } catch (e) { return res.status(400).json({ error: 'fel' }); }
  if (!MBOX.keys[id]) { MBOX.keys[id] = { c: b.curve, p: b.pub }; saveSoon('mbox.json', () => MBOX); }
  res.json({ ok: MBOX.keys[id].p === b.pub });
});
app.post('/mbox/send', auth, json, (req, res) => {
  if (limited('send:' + req.user, 600)) return res.status(429).json({ error: 'för många' });
  const list = [].concat((req.body || {}).items || []).slice(0, 50); let n = 0;
  for (const it of list) {
    const e = it && it.env;
    // bara förseglade kuvert tas emot: {t, to, e, c} och inget annat
    if (!e || e.t !== 'sealed' || !isId(e.to) || it.to !== e.to || !isB64(e.e, 100) || typeof e.c !== 'string' || e.c.length > 360000 || Object.keys(e).length !== 4) continue;
    const env = { t: 'sealed', to: e.to, e: e.e, c: e.c };
    const k = crypto.createHash('sha256').update(e.to + '|' + e.e + '|' + e.c).digest('hex').slice(0, 24);
    const box = MBOX.box[e.to] = MBOX.box[e.to] || [];
    if (!box.some(m => m.k === k)) { box.push({ k, env, at: hourOf(now()) }); if (box.length > MAXBOX) box.splice(0, box.length - MAXBOX); }
    n++;
    if (PUSHCAT.includes(it.p)) pushTo(e.to, it.p);
  }
  saveSoon('mbox.json', () => MBOX); if (n) bump(req.user, (d, u) => { d.mbox += n; u.msgs += n; }); res.json({ stored: n });
});
// hämtning: 1) utmaning  2) bevis med chatt-nyckeln -> innehåll + kvitto-nyckel för att radera
const CHAL = new Map(), ACKS = new Map();
setInterval(() => { for (const [k, v] of CHAL) if (v.exp < now()) CHAL.delete(k); for (const [k, v] of ACKS) if (v.exp < now()) ACKS.delete(k); }, 60e3).unref();
app.post('/mbox/challenge', json, (req, res) => {
  if (limited('chal:' + req.ip, 120)) return res.status(429).json({ error: 'för många' });
  const id = (req.body || {}).id, key = isId(id) && MBOX.keys[id];
  // okänt ID: svara likadant, så att man inte kan fråga ut vilka ID:n som finns
  const curve = key ? key.c : ((req.body || {}).curve === 'P-256' ? 'P-256' : 'X25519');
  const eph = ephFor(curve), n = crypto.randomBytes(16).toString('hex');
  CHAL.set(n, { id, priv: eph.priv, exp: now() + 60e3 });
  res.json({ n, e: eph.pub });
});
// bevis på att man äger chatt-nyckeln för en brevlåda (utmaningen gäller en gång)
function proveBox(b, label) {
  const ch = typeof b.n === 'string' && CHAL.get(b.n); if (ch) CHAL.delete(b.n);
  const key = ch && isId(b.id) && ch.id === b.id && MBOX.keys[b.id];
  if (!key || !isB64(b.proof, 100)) return false;
  try { const sh = crypto.diffieHellman({ privateKey: ch.priv, publicKey: rawToKey(key.c, key.p) });
    const exp = crypto.createHmac('sha256', sh).update(label + '|' + b.id + '|' + b.n).digest();
    const got = Buffer.from(b.proof, 'base64'); return got.length === exp.length && crypto.timingSafeEqual(got, exp); } catch (e) { return false; }
}
app.post('/mbox/fetch', json, (req, res) => {
  const b = req.body || {};
  if (!proveBox(b, 'FL-mbox-v1')) return res.status(403).json({ error: 'nej' });
  const items = (MBOX.box[b.id] || []).slice(0, 300).map(m => ({ k: m.k, env: m.env }));
  const ack = crypto.randomBytes(16).toString('hex'); ACKS.set(ack, { id: b.id, exp: now() + 300e3 });
  res.json({ items, ack });
});
app.post('/mbox/ack', json, (req, res) => {
  const b = req.body || {}, a = typeof b.ack === 'string' && ACKS.get(b.ack); if (!a) return res.status(403).json({ error: 'nej' });
  const keys = new Set([].concat(b.keys || []).filter(k => typeof k === 'string').slice(0, 1000));
  if (MBOX.box[a.id]) { MBOX.box[a.id] = MBOX.box[a.id].filter(m => !keys.has(m.k)); if (!MBOX.box[a.id].length) delete MBOX.box[a.id]; }
  saveSoon('mbox.json', () => MBOX); res.json({ ok: true });
});

/* ---------- notiser på låsskärmen (Web Push) ----------
   En app kan be om notiser för sin brevlåda (bevisas med chatt-nyckeln, inte kopplat till kontot).
   Avsändaren märker kuvertet med en kategori (m = meddelande, i = spelinbjudan, t = din tur, c = missat samtal);
   mottagaren väljer själv vilka kategorier den vill ha. Notisen innehåller bara kategorin – aldrig vem, vad eller text –
   och är krypterad till telefonen, så Google/Apple ser inget innehåll. */
const PUSHCAT = ['m', 'i', 't', 'c'];
let webpush = null; try { webpush = require('web-push'); } catch (e) { console.warn('web-push saknas – notiser avstängda'); }
let VAPID = load('vapid.json', null);
if (webpush && !VAPID) { VAPID = webpush.generateVAPIDKeys(); save('vapid.json', VAPID); }
if (webpush && VAPID) webpush.setVapidDetails('https://' + (process.env.DOMAIN || 'localhost'), VAPID.publicKey, VAPID.privateKey);
let PUSH = load('push.json', {});                  // chatId -> { s: subscription, c: ['m','i'...], at }
const pushLast = new Map();
const b64ok = v => typeof v === 'string' && /^[A-Za-z0-9+/_=-]+$/.test(v);
function pushTo(id, cat) {
  const p = PUSH[id]; if (!webpush || !p || !p.c.includes(cat)) return;
  const k = id + cat, t = now(); if (t - (pushLast.get(k) || 0) < 20e3) return; pushLast.set(k, t);   // högst en notis per typ var 20:e sekund
  webpush.sendNotification(p.s, JSON.stringify({ k: cat }), { TTL: cat === 'c' ? 600 : 86400, urgency: 'high', topic: 'fl' + cat })
    .catch(err => { if (err && (err.statusCode === 404 || err.statusCode === 410)) { delete PUSH[id]; saveSoon('push.json', () => PUSH); } });
}
app.get('/push/key', (req, res) => res.json({ key: webpush && VAPID ? VAPID.publicKey : null }));
app.post('/mbox/push', json, (req, res) => {
  if (limited('push:' + req.ip, 60)) return res.status(429).json({ error: 'för många' });
  const b = req.body || {};
  if (!proveBox(b, 'FL-push-v1')) return res.status(403).json({ error: 'nej' });
  const cats = [].concat(b.cats || []).filter(c => PUSHCAT.includes(c));
  if (!b.sub || !cats.length) { delete PUSH[b.id]; }
  else { const s = b.sub; if (!(s && typeof s.endpoint === 'string' && s.keys && b64ok(s.keys.p256dh) && b64ok(s.keys.auth) && s.keys.p256dh.length < 140 && s.keys.auth.length < 40 && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 900)) return res.status(400).json({ error: 'fel' });
    PUSH[b.id] = { s: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, c: [...new Set(cats)], at: hourOf(now()) }; }
  saveSoon('push.json', () => PUSH); res.json({ ok: true, on: !!PUSH[b.id] });
});

/* ---------- säkerhetskopia (krypterad på telefonen – servern ser bara chiffertext) ----------
   En per användare och app (dev/vanlig). Krypteringen görs med en lösenfras som bara användaren känner till. */
const BKDIR = path.join(DATA, 'backups'); try { fs.mkdirSync(BKDIR, { recursive: true, mode: 0o700 }); } catch (e) {}
const bkFile = (u, env) => path.join(BKDIR, crypto.createHash('sha256').update('bk|' + u + '|' + env).digest('hex').slice(0, 32) + '.json');
const bkJson = express.json({ limit: '12mb' });
app.put('/backup', auth, bkJson, (req, res) => {
  if (limited('bk:' + req.user, 30)) return res.status(429).json({ error: 'för många' });
  const b = req.body || {}, env = dirEnv(req.query.env);
  if (b.v !== 1 || b.app !== 'fl' || b.kdf !== 'pbkdf2' || !Number.isInteger(b.it) || b.it < 100000 || b.it > 5e6 || !b64ok(b.salt) || !b64ok(b.iv) || !b64ok(b.ct) || b.salt.length > 64 || b.iv.length > 32)
    return res.status(400).json({ error: 'fel format' });
  const out = { v: 1, app: 'fl', kdf: 'pbkdf2', it: b.it, salt: b.salt, iv: b.iv, ct: b.ct, at: now() };
  const t = bkFile(req.user, env) + '.tmp'; fs.writeFileSync(t, JSON.stringify(out), { mode: 0o600 }); fs.renameSync(t, bkFile(req.user, env));
  res.json({ ok: true, at: out.at, size: b.ct.length });
});
app.get('/backup', auth, (req, res) => {
  const f = bkFile(req.user, dirEnv(req.query.env));
  if (req.query.info) { try { const st = fs.statSync(f); return res.json({ has: true, at: st.mtimeMs, size: st.size }); } catch (e) { return res.json({ has: false }); } }
  try { res.type('application/json').send(fs.readFileSync(f, 'utf8')); } catch (e) { res.status(404).json({ error: 'ingen kopia' }); }
});
app.delete('/backup', auth, (req, res) => { try { fs.unlinkSync(bkFile(req.user, dirEnv(req.query.env))); } catch (e) {} res.json({ ok: true }); });

/* ---------- användarlista (katalog) ----------
   Varje inloggad app lägger upp sitt chattkort (publik nyckel + visningsnamn) under sitt användarnamn,
   så att alla vanliga användare kan hitta och kontakta varandra. Adminkonton och avstängda konton listas inte.
   Dev och vanlig app har olika chattidentiteter och hålls isär. Upp till 3 enheter per användare. */
let DIR = load('dir.json', {});                 // user -> { prod: [{card, at}], dev: [...] }
const dirEnv = v => v === 'dev' ? 'dev' : 'prod';
const cleanStr = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n) : '';
function okDirCard(c) {
  if (!c || typeof c !== 'object' || c.v !== 1 || !isId(c.id) || !['X25519', 'P-256'].includes(c.curve) || !isB64(c.ik, 100)) return null;
  if (crypto.createHash('sha256').update(Buffer.from(c.ik, 'base64')).digest('hex').slice(0, 16) !== c.id) return null;
  try { rawToKey(c.curve, c.ik); } catch (e) { return null; }
  return { v: 1, id: c.id, curve: c.curve, ik: c.ik, name: cleanStr(c.name, 20) || 'Okänd', emoji: cleanStr(c.emoji, 8) };
}
app.post('/dir/publish', auth, json, (req, res) => {
  if (limited('dir:' + req.user, 60)) return res.status(429).json({ error: 'för många' });
  const b = req.body || {}, env = dirEnv(b.env), card = okDirCard(b.card);
  if (!card) return res.status(400).json({ error: 'fel' });
  const e = DIR[req.user] = DIR[req.user] || {};
  const list = (e[env] || []).filter(x => x.card.id !== card.id);
  list.unshift({ card, at: hourOf(now()) }); e[env] = list.slice(0, 3);
  saveSoon('dir.json', () => DIR); res.json({ ok: true });
});
app.post('/dir/unpublish', auth, json, (req, res) => {
  const b = req.body || {}, env = dirEnv(b.env), e = DIR[req.user];
  if (e && e[env]) { e[env] = isId(b.id) ? e[env].filter(x => x.card.id !== b.id) : []; if (!e[env].length) delete e[env]; if (!Object.keys(e).length) delete DIR[req.user]; saveSoon('dir.json', () => DIR); }
  res.json({ ok: true });
});
app.get('/dir', auth, (req, res) => {
  const env = dirEnv(req.query.env), U = users(), out = [];
  for (const [name, e] of Object.entries(DIR)) {
    const u = U[name]; if (!u || u.disabled || u.admin || !e[env]) continue;
    e[env].forEach((x, i) => out.push({ user: name, n: i, card: x.card }));
  }
  out.sort((a, b) => a.user.localeCompare(b.user, 'sv') || a.n - b.n);
  // alla vanliga konton syns, även de som inte har öppnat appen sedan katalogen kom (de kan läggas till när de har gjort det)
  const people = Object.entries(U).filter(([n, u]) => n !== req.user && !u.disabled && !u.admin).map(([n]) => ({ user: n, ready: !!(DIR[n] && DIR[n][env] && DIR[n][env].length) }))
    .sort((a, b) => a.user.localeCompare(b.user, 'sv'));
  res.json({ me: req.user, list: out, people });
});
// borttagna användare försvinner ur katalogen
setInterval(() => { const U = users(); let ch = false; for (const n of Object.keys(DIR)) if (!U[n]) { delete DIR[n]; ch = true; } if (ch) save('dir.json', DIR); }, 3600e3).unref();

/* ---------- närvaro ----------
   Appen skickar inte sin kontaktlista. Servern lämnar ut en lista med hashade ID:n (nytt salt varje dygn)
   för dem som är uppkopplade, och appen jämför lokalt med sina kontakter. */
const ONLINE = new Map(), LAST = new Map(), PEERUSER = new Map();
const presSalt = () => crypto.createHmac('sha256', SECRET).update('pres|' + today()).digest('hex').slice(0, 16);
const presH = (salt, peerId) => crypto.createHash('sha256').update(salt + '|' + peerId).digest('hex').slice(0, 16);
app.get('/presence', auth, (req, res) => {
  const salt = presSalt(), on = [], last = {};
  for (const p of ONLINE.keys()) if (p.startsWith('fl-chat-')) on.push(presH(salt, p));
  for (const [p, t] of LAST) if (p.startsWith('fl-chat-') && !ONLINE.has(p) && now() - t < 14 * 864e5) last[presH(salt, p)] = Math.floor(t / 300e3) * 300e3;
  on.sort(); res.json({ now: now(), salt, on, last });
});

/* ---------- statistik från appen (bara inloggade, bara räknare) ---------- */
app.post('/stats', auth, json, (req, res) => {
  if (limited('stats:' + req.user, 120)) return res.status(429).json({ error: 'för många' });
  const b = req.body || {}, name = v => typeof v === 'string' && /^[a-z0-9_-]{1,20}$/.test(v);
  if (b.ev === 'game' && name(b.game)) { const m = ['solo', 'ai', 'online'].includes(b.mode) ? b.mode : 'solo';
    if (typeof b.title === 'string' && b.title.length <= 30) { STATS.names = STATS.names || {}; STATS.names[b.game] = b.title.replace(/[<>&"]/g, ''); }
    bump(req.user, (d, u) => { const g = d.games[b.game] = d.games[b.game] || {}; g[m] = (g[m] || 0) + 1; u.games++; }); }
  else if (b.ev === 'call') { const sec = Math.max(0, Math.min(6 * 3600, +b.sec || 0));
    bump(req.user, (d, u) => { d.calls.n++; if (b.video) d.calls.video++; d.calls.sec += sec; u.calls++; u.sec += sec; }); }
  res.json({ ok: true });
});

/* ---------- administration ----------
   Bara konton med admin-flagga (sudo spel-user admin <namn>). Separat, kortlivad inloggning (8 timmar). */
const ADM = new Map();   // sha256(token) -> {u, exp}
function adm(req, res, next) {
  const t = bearer(req), a = /^[0-9a-f]{64}$/.test(t) && ADM.get(hashTok(t));
  if (!a || a.exp < now()) return res.status(401).json({ error: 'inte inloggad som admin' });
  const u = users()[a.u]; if (!u || !u.admin || u.disabled) { ADM.delete(hashTok(t)); return res.status(403).json({ error: 'inte admin' }); }
  req.admin = a.u; next();
}
const ADMIN_DIR = path.join(__dirname, 'admin');
app.get(['/admin', '/admin/'], (req, res) => {
  res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.set('X-Frame-Options', 'DENY'); res.set('Referrer-Policy', 'no-referrer');
  res.sendFile(path.join(ADMIN_DIR, 'index.html'));
});
app.get('/admin/:f(admin\\.js|qr\\.js)', (req, res) => { res.set('Content-Type', 'text/javascript; charset=utf-8'); res.sendFile(path.join(ADMIN_DIR, req.params.f)); });
app.post('/admin/api/login', json, (req, res) => {
  const ip = req.ip, b = req.body || {}, name = String(b.user || '').trim().toLowerCase().slice(0, 40), code = String(b.code || '').replace(/\s/g, '');
  if (tooMany('aip:' + ip, 10, 15 * 60e3) || tooMany('au:' + name, 5, 15 * 60e3)) return res.status(429).json({ error: 'För många försök. Vänta en kvart.' });
  const u = users()[name];
  const step = u && u.admin && !u.disabled && /^\d{6}$/.test(code) ? checkTotp(u.secret, code, u.lastStep) : 0;
  if (!step) { fail('aip:' + ip); fail('au:' + name); audit(name || '?', 'misslyckad admininloggning från ' + String(ip).replace(/\.\d+$/, '.x').replace(/:[0-9a-f]*:[0-9a-f]*$/i, ':x:x')); return res.status(401).json({ error: 'Fel användarnamn eller kod, eller inte admin' }); }
  const all = load('users.json', { users: {} }); all.users[name].lastStep = step; save('users.json', all); usersMtime = 0;
  const tok = crypto.randomBytes(32).toString('hex'); ADM.set(hashTok(tok), { u: name, exp: now() + 8 * 3600e3 });
  audit(name, 'loggade in i admin'); res.json({ token: tok, user: name });
});
app.post('/admin/api/logout', adm, (req, res) => { ADM.delete(hashTok(bearer(req))); res.json({ ok: true }); });

// vilka konton som är uppkopplade just nu (bara i minnet, sparas aldrig)
function onlineUsers_() { const u = new Set(); for (const p of ONLINE.keys()) { const x = PEERUSER.get(p); if (x) u.add(x); } return u; }
function lastDays(n) { const out = []; for (let i = n - 1; i >= 0; i--) { const k = dayFmt.format(new Date(now() - i * 864e5)); out.push({ day: k, ...(STATS.days[k] || { games: {}, users: {}, logins: 0, turn: 0, mbox: 0, calls: { n: 0, video: 0, sec: 0 } }) }); } return out; }
function sessCount(name) { const u = users()[name] || {}; let n = 0; for (const s of Object.values(SESS)) if (s.u === name && s.exp > now() && !(u.revokedBefore && s.at < u.revokedBefore)) n++; return n; }

app.get('/admin/api/overview', adm, (req, res) => {
  const U = users(), onlineUsers = onlineUsers_();
  let chat = 0, game = 0; for (const p of ONLINE.keys()) { if (p.startsWith('fl-chat-')) chat++; else game++; }
  let pending = 0; for (const b of Object.values(MBOX.box)) pending += b.length;
  const inv = load('invites.json', { invites: {} }); const openInv = Object.values(inv.invites || {}).filter(x => x.exp > now()).length;
  res.json({ now: now(), uptime: now() - STARTED, mem: process.memoryUsage().rss, users: Object.keys(U).length, admins: Object.values(U).filter(u => u.admin).length,
    sessions: Object.values(SESS).filter(s => s.exp > now()).length, onlineUsers: [...onlineUsers], peers: { chat, game }, pending, invites: openInv, days: lastDays(30), names: STATS.names || {} });
});
app.get('/admin/api/users', adm, (req, res) => {
  const U = users(), on = onlineUsers_(), days = lastDays(30), out = [];
  for (const [name, u] of Object.entries(U)) {
    const sum = { games: 0, msgs: 0, calls: 0, sec: 0, logins: 0 }; for (const d of days) { const x = d.users[name]; if (x) for (const k in sum) sum[k] += x[k] || 0; }
    out.push({ name, admin: !!u.admin, disabled: !!u.disabled, created: u.created, lastLogin: u.lastLogin || 0, sessions: sessCount(name), online: on.has(name), last30: sum });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'sv')); res.json({ users: out });
});
function editUser(name, fn) { const all = load('users.json', { users: {} }); if (!all.users[name]) return false; fn(all.users[name], all); save('users.json', all); usersMtime = 0; return true; }
function makeInvite(name, opts) {
  const inv = load('invites.json', { invites: {} }); inv.invites = inv.invites || {};
  for (const [h, x] of Object.entries(inv.invites)) if (x.user === name || x.exp < now()) delete inv.invites[h];
  const tok = crypto.randomBytes(24).toString('base64url');
  inv.invites[invHash(tok)] = { user: name, exp: now() + 7 * 864e5, created: now(), admin: !!opts.admin, dev: !!opts.dev };
  save('invites.json', inv);
  return APP_URL + (opts.dev ? 'dev/' : '') + '#invite=' + tok;
}
const okName = n => /^[a-z0-9åäö._-]{2,32}$/.test(n);
app.post('/admin/api/users/:name/:act', adm, json, (req, res) => {
  const name = String(req.params.name).toLowerCase(), act = req.params.act, U = users();
  if (!U[name]) return res.status(404).json({ error: 'Finns ingen sådan användare' });
  if (name === req.admin && ['disable', 'remove', 'unadmin'].includes(act)) return res.status(400).json({ error: 'Du kan inte göra det med ditt eget konto' });
  let out = { ok: true };
  if (act === 'logout') editUser(name, u => { u.revokedBefore = now(); });
  else if (act === 'disable' || act === 'enable') editUser(name, u => { u.disabled = act === 'disable'; });
  else if (act === 'admin' || act === 'unadmin') editUser(name, u => { u.admin = act === 'admin'; });
  else if (act === 'reset') { editUser(name, u => { u.revokedBefore = now(); }); out.link = makeInvite(name, { dev: !!(req.body || {}).dev, admin: !!U[name].admin }); }
  else if (act === 'remove') { editUser(name, (u, all) => { delete all.users[name]; }); delete DIR[name]; saveSoon('dir.json', () => DIR); for (const [h, x] of Object.entries(SESS)) if (x.u === name) delete SESS[h]; save('sessions.json', SESS); }
  else return res.status(400).json({ error: 'okänd åtgärd' });
  for (const [h, a] of ADM) if (a.u === name && (act === 'disable' || act === 'remove' || act === 'unadmin' || act === 'logout')) ADM.delete(h);
  audit(req.admin, `${({ logout: 'loggade ut', disable: 'stängde av', enable: 'slog på', admin: 'gjorde till admin', unadmin: 'tog bort admin från', reset: 'skapade ny inbjudan (byt nyckel) för', remove: 'tog bort' })[act]} ${name}`);
  res.json(out);
});
app.get('/admin/api/invites', adm, (req, res) => {
  const inv = load('invites.json', { invites: {} });
  res.json({ invites: Object.values(inv.invites || {}).filter(x => x.exp > now()).map(x => ({ user: x.user, exp: x.exp, created: x.created, started: !!x.secret, admin: !!x.admin, dev: !!x.dev, reset: !!users()[x.user] })) });
});
app.post('/admin/api/invites', adm, json, (req, res) => {
  const b = req.body || {}, name = String(b.name || '').trim().toLowerCase();
  if (!okName(name)) return res.status(400).json({ error: 'Namnet får innehålla a–ö, siffror, punkt, bindestreck och understreck (2–32 tecken).' });
  if (users()[name]) return res.status(400).json({ error: `${name} finns redan. Använd "Ny nyckel" på användaren i stället.` });
  const link = makeInvite(name, { dev: !!b.dev, admin: !!b.admin });
  audit(req.admin, `bjöd in ${name}${b.admin ? ' (admin)' : ''}${b.dev ? ' till testversionen' : ''}`); res.json({ link });
});
app.post('/admin/api/invites/revoke', adm, json, (req, res) => {
  const name = String((req.body || {}).name || '').toLowerCase(), inv = load('invites.json', { invites: {} }); let n = 0;
  for (const [h, x] of Object.entries(inv.invites || {})) if (x.user === name) { delete inv.invites[h]; n++; }
  save('invites.json', inv); audit(req.admin, `drog tillbaka inbjudan till ${name}`); res.json({ removed: n });
});
app.get('/admin/api/audit', adm, (req, res) => res.json({ audit: STATS.audit.slice(0, 200) }));
// serveruppdatering: läser status från uppdateraren (root) och lämnar en begäran som den reagerar på – appen installerar aldrig själv
const UPD_STATUS = path.join(DATA, 'update.json'), UPD_REQ = path.join(DATA, 'update-request.json'), UPD_CHECK = path.join(DATA, 'update-check');
const myVersion = () => { try { return fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim(); } catch (e) { return 'okänd'; } };
app.get('/admin/api/update', adm, (req, res) => {
  let st = null; try { st = JSON.parse(fs.readFileSync(UPD_STATUS, 'utf8')); } catch (e) {}
  res.json({ running: myVersion(), status: st, pending: fs.existsSync(UPD_REQ), checking: fs.existsSync(UPD_CHECK), updater: !!st || fs.existsSync('/usr/local/sbin/spel-update') });
});
app.post('/admin/api/update', adm, json, (req, res) => {
  const b = req.body || {};
  if (b.check) { fs.writeFileSync(UPD_CHECK, String(now())); audit(req.admin, 'kollade efter serveruppdatering'); return res.json({ ok: true }); }
  const v = String(b.version || '');
  if (!/^\d{4}\.\d{2}\.\d{2}\.\d{1,3}$/.test(v)) return res.status(400).json({ error: 'fel version' });
  let st = null; try { st = JSON.parse(fs.readFileSync(UPD_STATUS, 'utf8')); } catch (e) {}
  if (!st || st.available !== v) return res.status(409).json({ error: 'den versionen är inte den som finns att hämta – kolla igen' });
  fs.writeFileSync(UPD_REQ, JSON.stringify({ version: v, by: req.admin, at: now() }));
  audit(req.admin, 'godkände serveruppdatering till ' + v);
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

/* ---------- kopplingsservern: bara med giltig inloggning ----------
   Klienten skickar sin sessionsnyckel som PeerJS "key"; här kontrolleras den och byts ut. */
const server = http.createServer(app);
server.prependListener('upgrade', (req, socket) => {
  try {
    const u = new URL(req.url, 'http://x'); if (!u.pathname.startsWith('/peer')) return;
    const ss = session(u.searchParams.get('key'));
    if (!ss) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
    const pid = u.searchParams.get('id'); if (pid) PEERUSER.set(pid, ss.u);
    u.searchParams.set('key', 'peerjs'); req.url = u.pathname + u.search;
  } catch (e) { socket.destroy(); }
});
const peer = ExpressPeerServer(server, { path: '/', key: 'peerjs', proxied: true, alive_timeout: 60000, allow_discovery: false });
app.use('/peer', peer);
// allt annat: 404 – och den som letar efter kända sårbarheter (wp-login, .env, phpmyadmin …) hamnar i fail2ban
const PROBE = /(\.php|\.env|\.git|wp-|wordpress|phpmyadmin|\.aspx?|\.cgi|\/cgi-bin|\/boaform|\/actuator|\/HNAP1|\/vendor\/|\/\.well-known\/(?!acme)|\/etc\/passwd|\.\.\/|%2e%2e|\/shell|\/console|\/solr|\/owa|\/autodiscover|\.(bak|sql|zip|tar|gz|ini|log|cfg|yml|yaml|xml)$)/i;
app.use((req, res) => { if (PROBE.test(req.originalUrl || req.url)) secLog('probe', req.ip); res.status(404).type('text/plain').send('Finns inte'); });
peer.on('connection', c => { ONLINE.set(c.getId(), now()); LAST.set(c.getId(), now()); });
peer.on('disconnect', c => { ONLINE.delete(c.getId()); PEERUSER.delete(c.getId()); LAST.set(c.getId(), now()); });
setInterval(() => { for (const [p, t] of LAST) if (now() - t > 14 * 864e5) LAST.delete(p); }, 3600e3).unref();

server.listen(PORT, '127.0.0.1', () => console.log(`spelserver lyssnar på 127.0.0.1:${PORT} (${DOMAIN})`));
process.on('SIGTERM', () => { save('push.json', PUSH); save('dir.json', DIR); save('sessions.json', SESS); save('mbox.json', MBOX); save('stats.json', STATS); process.exit(0); });
