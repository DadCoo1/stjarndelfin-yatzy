/* Spelservern för Fröknarna Leins game board
   - /peer : kopplingsserver (PeerJS) som matchar ihop telefonerna
   - /turn : ger tillfälliga inloggningar till reservservern (coturn), giltiga i några timmar
   Hemligheten som inloggningarna räknas fram med finns bara på servern (/etc/spelserver.env). */
'use strict';
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { ExpressPeerServer } = require('peer');

const PORT = +process.env.PORT || 9000;
const SECRET = process.env.TURN_SECRET || '';
const DOMAIN = process.env.DOMAIN || 'localhost';
const TURN_HOST = process.env.TURN_HOST || DOMAIN;
const TTL = 6 * 3600;
const ORIGINS = (process.env.ALLOW_ORIGINS || 'https://dadcoo1.github.io').split(',').map(s => s.trim()).filter(Boolean);
if (!SECRET) { console.error('TURN_SECRET saknas'); process.exit(1); }

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

// enkel begränsning: högst 30 inloggningar per minut och IP-adress
const hits = new Map();
setInterval(() => hits.clear(), 60e3).unref();
function limited(ip) { const n = (hits.get(ip) || 0) + 1; hits.set(ip, n); return n > 30; }

function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGINS.includes(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); }
}

app.get('/turn', (req, res) => {
  cors(req, res);
  res.set('Cache-Control', 'no-store');
  if (limited(req.ip)) return res.status(429).json({ error: 'för många' });
  const o = req.headers.origin;
  if (o && !ORIGINS.includes(o)) return res.status(403).json({ error: 'fel ursprung' });
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const username = exp + ':spel';
  const credential = crypto.createHmac('sha1', SECRET).update(username).digest('base64');
  res.json({
    ttl: TTL, exp,
    iceServers: [
      { urls: [`stun:${TURN_HOST}:3478`] },
      { urls: [`turn:${TURN_HOST}:3478?transport=udp`, `turn:${TURN_HOST}:3478?transport=tcp`, `turns:${TURN_HOST}:5349?transport=tcp`], username, credential }
    ]
  });
});

app.get('/health', (req, res) => { cors(req, res); res.json({ ok: true }); });

const server = http.createServer(app);
const peer = ExpressPeerServer(server, { path: '/', proxied: true, alive_timeout: 60000, allow_discovery: false, corsOptions: { origin: ORIGINS } });
app.use('/peer', peer);

server.listen(PORT, '127.0.0.1', () => console.log(`spelserver lyssnar på 127.0.0.1:${PORT} (${DOMAIN})`));
