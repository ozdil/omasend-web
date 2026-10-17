#!/usr/bin/env node
/**
 * Mock OmaSend engine for development and smoke tests. Serves dist/ under /web/ (as the real
 * engine does) and implements the protocol-v2 endpoints the web client uses, verifying every
 * MAC, signature and body tag the way the desktop engine does.
 *
 *   npm run build && node e2e/mock-engine.mjs [port]
 *
 * It prints a pairing link; open it in a browser. GET /__mock/state shows what arrived.
 * Not a real engine: nothing is written to disk and approvals are automatic.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ed25519 } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.argv[2] || process.env.PORT || 53317);
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
// Polls answered PENDING before ACCEPTED (env MOCK_PENDING_POLLS, default 2).
const PENDING_POLLS = Number(process.env.MOCK_PENDING_POLLS ?? 2);

const b64 = (b) => Buffer.from(b).toString('base64url');
const unb64 = (s) => (/^[A-Za-z0-9_-]*$/.test(s) ? new Uint8Array(Buffer.from(s, 'base64url')) : null);
const hex = (b) => Buffer.from(b).toString('hex');
const enc = (s) => new TextEncoder().encode(s);
const devId = (pk) => {
  const h = hex(sha256(pk).subarray(0, 8)).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}`;
};
const luhn = (id) => {
  const d = (id || '').replace(/\D/g, '');
  if (d.length !== 16) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let v = Number(d[i]);
    if (i % 2 === 0) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  }
  return sum % 10 === 0;
};
// Engine's urlencoding_decode (byte-wise, '+' = space).
const urlDecode = (s) => {
  const bytes = Buffer.from(s, 'utf8');
  const out = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x25 && i + 2 < bytes.length && /^[0-9a-fA-F]{2}$/.test(String.fromCharCode(bytes[i + 1], bytes[i + 2]))) {
      out.push(parseInt(String.fromCharCode(bytes[i + 1], bytes[i + 2]), 16));
      i += 2;
    } else out.push(bytes[i] === 0x2b ? 0x20 : bytes[i]);
  }
  return Buffer.from(out).toString('utf8');
};
const sanitize = (raw) => {
  const c = Array.from(raw).filter((ch) => /[\p{Alphabetic}\p{N}._\- ]/u.test(ch)).join('').trim();
  return c === '' || c.startsWith('.') || c.includes('..') ? `file_${Math.floor(Date.now() / 1000)}` : Array.from(c).slice(0, 180).join('').trimEnd();
};

const seed = new Uint8Array(randomBytes(32));
const myPk = b64(ed25519.getPublicKey(seed));
const NAME = process.env.MOCK_NAME || 'Mock Desk & Co ç';
let offerSecret = new Uint8Array(randomBytes(32));

const state = { trusted: [], transfers: {}, files: [], clipboard: [], rejected: [], pairs: 0, offerHost: '127.0.0.1' };
const nonces = new Set();

function pairLink(host = '127.0.0.1') {
  const uri = `omasend://pair?v=2&pk=${myPk}&s=${b64(offerSecret)}&h=${host}&p=${PORT}&n=${encodeURIComponent(NAME)}&o=0&q=53318`;
  return { uri, url: `http://${host}:${PORT}/web/#pair=${encodeURIComponent(uri)}` };
}

function verifySigned(req, bodyTag) {
  const pk = req.headers['x-omasend-pk'];
  const ts = req.headers['x-omasend-ts'];
  const nonce = req.headers['x-omasend-nonce'];
  const sig = req.headers['x-omasend-sig'];
  if (!pk && !sig) return { ok: false, why: 'unsigned' };
  if (!pk || !ts || !nonce || !sig) return { ok: false, why: 'Incomplete signature headers' };
  if (!/^\d+$/.test(ts) || Math.abs(Number(ts) - Date.now() / 1000) > 300) return { ok: false, why: 'Timestamp outside allowed window' };
  if (!/^[0-9a-f]{32}$/.test(nonce)) return { ok: false, why: 'Bad nonce (must be 32 lowercase hex)' };
  const key = state.trusted.find((k) => k.pk === pk);
  if (!key) return { ok: false, why: 'Unknown device key' };
  const canon = `omasend-v2\n${req.method}\n${req.url}\n${ts}\n${nonce}\n${bodyTag}`;
  const sigBytes = unb64(sig);
  if (!sigBytes || sigBytes.length !== 64 || !ed25519.verify(sigBytes, enc(canon), unb64(pk), { zip215: false })) {
    return { ok: false, why: 'Invalid signature', canon };
  }
  if (nonces.has(pk + nonce)) return { ok: false, why: 'Replayed request' };
  nonces.add(pk + nonce);
  return { ok: true, key };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': body.length });
  res.end(body);
}

function reject(res, req, status, error, extra = {}) {
  state.rejected.push({ method: req.method, url: req.url, status, error, ...extra });
  json(res, status, { error });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

async function serveStatic(req, res, path) {
  let rel = path.slice('/web/'.length) || 'index.html';
  rel = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  try {
    const data = await readFile(join(DIST, rel));
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
}

const server = createServer(async (req, res) => {
  const [path, query = ''] = req.url.split('?');
  const params = new Map(query.split('&').filter(Boolean).map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]));
  try {
    if (path === '/web') return res.writeHead(301, { Location: '/web/' }).end();
    if (path.startsWith('/web/')) return serveStatic(req, res, path);
    if (path === '/__mock/state') return json(res, 200, { ...state, pk: myPk, deviceId: devId(unb64(myPk)) });
    if (path === '/__mock/link') return json(res, 200, pairLink(params.get('host') || '127.0.0.1'));
    if (path === '/__mock/new-offer') {
      offerSecret = new Uint8Array(randomBytes(32));
      return json(res, 200, pairLink(params.get('host') || '127.0.0.1'));
    }
    if (path === '/api/status') return json(res, 200, { status: 'ACTIVE', port: PORT, auth_required: true });

    if (req.method === 'POST' && path === '/api/v2/pair') {
      const v = JSON.parse((await readBody(req)).toString('utf8'));
      const iPk = unb64(v.pk || '');
      if (!iPk || iPk.length !== 32) return reject(res, req, 403, 'Invalid public key');
      const mac = hex(hmac(sha256, offerSecret, enc(`omasend-pair-v2|${myPk}|${v.pk}`)));
      if (mac !== v.mac) return reject(res, req, 403, 'No matching pairing offer (wrong or expired QR code)');
      const transcript = enc(`omasend-pair-v2|${myPk}|${v.pk}|${mac}`);
      const sig = unb64(v.sig || '');
      if (!sig || sig.length !== 64 || !ed25519.verify(sig, transcript, iPk, { zip215: false })) return reject(res, req, 403, 'Invalid initiator signature');
      offerSecret = new Uint8Array(randomBytes(32)); // single use
      state.trusted.push({ pk: v.pk, name: String(v.name).slice(0, 64), client: v.client, device_id: devId(iPk) });
      state.pairs++;
      return json(res, 200, { quic_port: 53318, pk: myPk, name: NAME, device_id: devId(unb64(myPk)), sig: b64(ed25519.sign(transcript, seed)) });
    }

    if (req.method === 'POST' && path === '/api/p2p/request') {
      const body = await readBody(req);
      const auth = verifySigned(req, hex(sha256(body)));
      if (!auth.ok) return reject(res, req, auth.why === 'unsigned' || auth.why === 'Unknown device key' ? 403 : 401, `Signature rejected: ${auth.why}`, { canon: auth.canon });
      const v = JSON.parse(body.toString('utf8'));
      if (!luhn(v.oma_id)) return reject(res, req, 403, 'Valid 16-digit OmaID required to send files');
      const token = hex(randomBytes(16));
      state.transfers[token] = {
        status: PENDING_POLLS > 0 ? 'PENDING' : 'ACCEPTED',
        polls: 0,
        files: (v.files || []).map((f) => ({ name: sanitize(f.name), size_bytes: f.size_bytes })),
        sender_pk: auth.key.pk,
        body: v,
      };
      return json(res, 200, { status: state.transfers[token].status, is_trusted: true, verified_device: true, is_same_owner: false, token });
    }

    if (req.method === 'GET' && path === '/api/p2p/decision') {
      const auth = verifySigned(req, hex(sha256(new Uint8Array(0))));
      if (!auth.ok) return reject(res, req, 401, `Signature rejected: ${auth.why}`, { canon: auth.canon });
      const t = state.transfers[params.get('token')];
      if (!t) return json(res, 404, { status: 'NOT_FOUND' });
      t.polls++;
      if (t.status === 'PENDING' && t.polls >= PENDING_POLLS) t.status = 'ACCEPTED';
      return json(res, 200, { status: t.status });
    }

    if (req.method === 'POST' && path === '/api/p2p/upload') {
      const t = state.transfers[params.get('token')];
      if (!t || t.status !== 'ACCEPTED') return reject(res, req, 403, 'Unauthorized or expired transfer token');
      const name = sanitize(urlDecode(params.get('filename') || ''));
      const idx = t.files.findIndex((f) => f.name === name);
      if (idx < 0) return reject(res, req, 403, 'File not listed in approved transfer request', { name });
      const len = Number(req.headers['content-length']);
      const auth = verifySigned(req, `stream:${len}`);
      if (!auth.ok || auth.key.pk !== t.sender_pk) return reject(res, req, 401, 'Upload must be signed by the device that requested the transfer', { why: auth.why, canon: auth.canon });
      if (len !== t.files[idx].size_bytes) return reject(res, req, 413, 'Upload size does not match the approved transfer request');
      const body = await readBody(req);
      if (body.length !== len) return reject(res, req, 400, 'Short body');
      t.files.splice(idx, 1);
      state.files.push({ name, size: body.length, sha256: hex(sha256(body)) });
      return json(res, 200, { status: 'OK', filename: name, size: body.length, sha256: hex(sha256(body)) });
    }

    if (req.method === 'POST' && path === '/api/p2p/clipboard') {
      const body = await readBody(req);
      const auth = verifySigned(req, hex(sha256(body)));
      if (!auth.ok) return reject(res, req, auth.why === 'unsigned' ? 403 : 401, `Signature rejected: ${auth.why}`, { canon: auth.canon });
      const v = JSON.parse(body.toString('utf8'));
      if (typeof v.text !== 'string') return reject(res, req, 400, 'Invalid clipboard payload');
      state.clipboard.push({ text: v.text, content_type: v.content_type, sender_name: v.sender_name });
      return json(res, 200, { status: 'OK' });
    }

    reject(res, req, 404, 'Not found');
  } catch (e) {
    reject(res, req, 500, String(e));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`mock engine on http://127.0.0.1:${PORT}/web/  (desktop key ${devId(unb64(myPk))})`);
  console.log(`pairing link: ${pairLink().url}`);
});
