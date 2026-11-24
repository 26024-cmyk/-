'use strict';

/* 팔레오 클래시 — 실시간 순위 서버 (의존성 없음, Node 18+)
 * GET  /health
 * GET  /api/leaderboard
 * POST /api/score      { name, score, wins, packs }
 * GET  /api/stream     Server-Sent Events 실시간 순위
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 10000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'leaderboard.json');
const ORIGINS = String(process.env.ALLOWED_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_ENTRIES = 100;
const MAX_BODY = 16 * 1024;

let store = { updatedAt: 0, entries: [] };
try {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (raw && Array.isArray(raw.entries)) store = raw;
} catch (err) {
  /* 첫 실행: 저장 파일 없음 */
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('[paleo] 저장 실패:', err.message);
  }
}

const clients = new Set();

function board() {
  return { updatedAt: store.updatedAt, entries: store.entries.slice(0, 50) };
}

function broadcast() {
  const payload = 'data: ' + JSON.stringify(board()) + '\n\n';
  for (const res of clients) {
    try {
      res.write(payload);
    } catch (err) {
      clients.delete(res);
    }
  }
}

function cors(req, res) {
  const origin = req.headers.origin;
  let allow = '';
  if (ORIGINS.includes('*')) allow = '*';
  else if (origin && ORIGINS.includes(origin)) allow = origin;
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const lastSubmit = new Map();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0] : req.socket.remoteAddress) || 'unknown';
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, entries: store.entries.length, uptime: process.uptime() });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    sendJson(res, 200, board());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    res.write('data: ' + JSON.stringify(board()) + '\n\n');
    clients.add(res);
    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (err) {
        /* ignore */
      }
    }, 25000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/score') {
    const ip = clientIp(req);
    const now = Date.now();
    if (now - (lastSubmit.get(ip) || 0) < 2500) {
      sendJson(res, 429, { error: 'too many requests' });
      return;
    }
    lastSubmit.set(ip, now);

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (err) {
      sendJson(res, 400, { error: 'invalid json' });
      return;
    }

    const name = clean(body.name, 12);
    const score = Math.floor(Number(body.score));
    const wins = Math.floor(Number(body.wins));
    const packs = Math.floor(Number(body.packs));

    if (!name || name.length < 1) {
      sendJson(res, 400, { error: 'name required' });
      return;
    }
    if (!Number.isFinite(score) || score < 0 || score > 10000000) {
      sendJson(res, 400, { error: 'invalid score' });
      return;
    }
    if (!Number.isFinite(wins) || wins < 0 || wins > 1000000) {
      sendJson(res, 400, { error: 'invalid wins' });
      return;
    }

    const entry = {
      name,
      score,
      wins,
      packs: Number.isFinite(packs) && packs >= 0 ? Math.min(packs, 1000000) : 0,
      at: now,
    };
    const existing = store.entries.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.score = Math.max(existing.score, entry.score);
      existing.wins = Math.max(existing.wins, entry.wins);
      existing.packs = Math.max(existing.packs, entry.packs);
      existing.name = entry.name;
      existing.at = now;
    } else {
      store.entries.push(entry);
    }
    store.entries.sort((a, b) => b.score - a.score || b.wins - a.wins);
    store.entries = store.entries.slice(0, MAX_ENTRIES);
    store.updatedAt = now;
    persist();
    broadcast();
    sendJson(res, 200, board());
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[paleo] 순위 서버 실행 http://0.0.0.0:' + PORT);
  console.log('[paleo] 허용 오리진:', ORIGINS.join(', '));
  console.log('[paleo] 저장 파일:', DATA_FILE);
});
