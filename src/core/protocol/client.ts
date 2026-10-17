/**
 * HTTP client for the OmaSend engine that serves this page (same origin, so no CORS and the
 * CSP can stay at connect-src 'self'). Every request to a /api/p2p endpoint is signed with the
 * browser's device key (PROTOCOL_V2.md, "Signed requests").
 */
import {
  bodyTagJson,
  bodyTagStream,
  decodePk,
  deviceIdForPk,
  pairMac,
  pairTranscript,
  signB64,
  signedHeaders,
  verifyB64,
  type DeviceKey,
} from './devicekey';
import { utf8 } from './encoding';
import {
  LABEL_CLIPBOARD,
  LABEL_REQUEST,
  ciphertextLength,
  encryptFileStream,
  newMessageKey,
  sealJson,
  verifyAdvert,
  type MessageKey,
} from './e2e';
import type { PairOffer } from './pairuri';

/** The client kind this page pairs as; part of the signed pairing transcript. */
export const CLIENT_WEB = 'web';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** The engine's {"error": "..."} text, when it sent one. */
    readonly serverMessage: string,
  ) {
    super(serverMessage || `HTTP ${status}`);
  }
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function errorText(status: number, text: string): string {
  const j = parseJson(text);
  if (typeof j.error === 'string') return j.error;
  // Some engine errors are plain text (e.g. 507).
  return text && text.length < 300 && !text.trimStart().startsWith('<') ? text.trim() : `HTTP ${status}`;
}

async function readJson(resp: Response): Promise<Record<string, unknown>> {
  const text = await resp.text();
  if (!resp.ok) throw new ApiError(resp.status, errorText(resp.status, text));
  return parseJson(text);
}

/** Path + query exactly as sent: built here, used for both fetch and the signature. */
export function decisionPath(token: string): string {
  return `/api/p2p/decision?token=${encodeURIComponent(token)}`;
}

/** Encrypted uploads name the file by its index in the (encrypted) transfer request. */
export function uploadPath(token: string, index: number): string {
  return `/api/p2p/upload?token=${encodeURIComponent(token)}&index=${index}`;
}

/**
 * The request target as the browser will put it on the wire. The WHATWG URL parser may
 * re-encode some characters in a query (e.g. ' becomes %27), so the signature covers
 * `pathname + search` of the parsed URL, and the same parsed URL is what gets fetched.
 */
export function wireTarget(path: string, origin: string = location.origin): { href: string; pathAndQuery: string } {
  const u = new URL(path, origin);
  return { href: u.href, pathAndQuery: u.pathname + u.search };
}

async function signedJson(key: DeviceKey, method: 'GET' | 'POST', path: string, body?: unknown, signal?: AbortSignal) {
  const bytes = body === undefined ? new Uint8Array(0) : utf8(JSON.stringify(body));
  const target = wireTarget(path);
  const headers: Record<string, string> = { ...signedHeaders(key, method, target.pathAndQuery, bodyTagJson(bytes)) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const resp = await fetch(target.href, {
    method,
    headers,
    body: body === undefined ? undefined : bytes,
    cache: 'no-store',
    credentials: 'omit',
    signal,
  });
  return readJson(resp);
}

/** GET /api/status (unauthenticated): is the engine that served this page reachable? */
export async function pingEngine(): Promise<boolean> {
  try {
    const resp = await fetch('/api/status', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(4000) });
    return resp.ok;
  } catch {
    return false;
  }
}

export interface PairedDesktop {
  pk: string;
  name: string;
  deviceId: string;
  /** Verified X25519 key for end-to-end encryption; missing when the desktop is older. */
  x25519?: string;
}

/** Builds the POST /api/v2/pair body for this browser (initiator) and a scanned offer. */
export function buildPairRequest(key: DeviceKey, offer: PairOffer, myName: string) {
  const mac = pairMac(offer.secret, offer.pk, key.pkB64);
  const sig = signB64(key, utf8(pairTranscript(offer.pk, key.pkB64, mac, CLIENT_WEB)));
  return { pk: key.pkB64, name: myName, mac, sig, client: CLIENT_WEB };
}

/** Checks the responder's reply against the key pinned in the QR code. Throws on mismatch. */
export function verifyPairResponse(key: DeviceKey, offer: PairOffer, resp: Record<string, unknown>): PairedDesktop {
  if (typeof resp.pk !== 'string' || resp.pk !== offer.pk) throw new Error('pair_key_mismatch');
  const rPk = decodePk(resp.pk);
  if (!rPk) throw new Error('pair_key_mismatch');
  const mac = pairMac(offer.secret, offer.pk, key.pkB64);
  if (typeof resp.sig !== 'string' || !verifyB64(rPk, utf8(pairTranscript(offer.pk, key.pkB64, mac, CLIENT_WEB)), resp.sig)) {
    throw new Error('pair_bad_signature');
  }
  const name = typeof resp.name === 'string' && resp.name.trim() ? resp.name.trim().slice(0, 64) : offer.name;
  const out: PairedDesktop = { pk: offer.pk, name: name || 'OmaSend', deviceId: deviceIdForPk(rPk) };
  // The encryption key rides along, signed by the key we just verified. An unsigned or
  // tampered one is ignored (never trusted), and the page asks for it again later.
  const x = verifyAdvert(rPk, offer.pk, resp.e2e);
  if (x) out.x25519 = x;
  return out;
}

/**
 * GET /api/v2/e2e (signed): the desktop's X25519 key for a pairing made before encryption
 * existed. Returns null when the desktop does not offer one (older engine) or the advert does
 * not verify against the pinned key; the caller then refuses to send.
 */
export async function fetchE2eKey(key: DeviceKey, desktopPk: string): Promise<string | null> {
  const dPk = decodePk(desktopPk);
  if (!dPk) return null;
  try {
    const j = await signedJson(key, 'GET', '/api/v2/e2e');
    return verifyAdvert(dPk, desktopPk, j);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function pair(key: DeviceKey, offer: PairOffer, myName: string): Promise<PairedDesktop> {
  const body = utf8(JSON.stringify(buildPairRequest(key, offer, myName)));
  const resp = await fetch('/api/v2/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
    credentials: 'omit',
  });
  return verifyPairResponse(key, offer, await readJson(resp));
}

/** The metadata the desktop sees after decrypting; it never travels in clear text. */
export interface TransferRequestBody {
  sender_name: string;
  files: { name: string; size_bytes: number }[];
  total_size_bytes: number;
}

/** A transfer in progress: the token and the key that encrypts its files. */
export interface Transfer {
  token: string;
  mk: MessageKey;
}

export type DecisionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'NOT_FOUND';

/**
 * POST /api/p2p/request with the metadata encrypted for `desktopX25519`. The signed outer body
 * only shows that a transfer is being requested; names and sizes are inside the envelope.
 */
export async function requestTransfer(
  key: DeviceKey,
  desktopX25519: string,
  body: TransferRequestBody,
): Promise<{ status: DecisionStatus; transfer: Transfer }> {
  const mk = newMessageKey(desktopX25519, key.pkB64);
  const e2e = sealJson(mk, LABEL_REQUEST, body);
  const j = await signedJson(key, 'POST', '/api/p2p/request', { client: CLIENT_WEB, e2e });
  if (typeof j.token !== 'string' || !j.token) throw new ApiError(200, 'Engine returned no transfer token');
  // An engine that did not decrypt the envelope would not know the files; never upload to it.
  if (j.e2e !== true) throw new ApiError(200, 'Engine did not accept the encrypted request');
  return { status: j.status === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING', transfer: { token: j.token, mk } };
}

export async function pollDecision(key: DeviceKey, token: string, signal?: AbortSignal): Promise<DecisionStatus> {
  try {
    const j = await signedJson(key, 'GET', decisionPath(token), undefined, signal);
    const s = j.status;
    return s === 'ACCEPTED' || s === 'REJECTED' || s === 'EXPIRED' || s === 'PENDING' ? s : 'NOT_FOUND';
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return 'NOT_FOUND';
    throw e;
  }
}

/**
 * Encrypts `file` chunk by chunk into a Blob. HTTP/1.1 cannot stream a request body from the
 * browser, so the ciphertext is assembled first; it is kept as Blob parts (which the browser
 * may page out), with one chunk of plaintext in memory at a time.
 */
async function encryptToBlob(mk: MessageKey, index: number, file: Blob, onProgress: (done: number) => void, signal?: AbortSignal): Promise<Blob> {
  const reader = encryptFileStream(mk, index, file).getReader();
  const parts: Blob[] = [];
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let done = 0;
  for (;;) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException('Aborted', 'AbortError');
    }
    const { value, done: end } = await reader.read();
    if (end) break;
    pending.push(value);
    pendingBytes += value.length;
    done += value.length;
    onProgress(done);
    if (pendingBytes >= 64 * 1024 * 1024) {
      parts.push(new Blob(pending as BlobPart[]));
      pending = [];
      pendingBytes = 0;
    }
  }
  if (pending.length) parts.push(new Blob(pending as BlobPart[]));
  return new Blob(parts, { type: 'application/octet-stream' });
}

/**
 * POST /api/p2p/upload?token=..&index=.. with the encrypted file as the raw body.
 * XMLHttpRequest instead of fetch because fetch cannot report upload progress. The body length
 * is exactly `ciphertextLength(file.size)`, which is what "stream:<size>" signs. `onProgress`
 * reports 0..1 over both phases (encrypting, then sending).
 */
export async function uploadFile(
  key: DeviceKey,
  transfer: Transfer,
  index: number,
  file: Blob,
  onProgress: (fraction: number, phase: 'encrypting' | 'sending') => void,
  signal?: AbortSignal,
): Promise<void> {
  const total = ciphertextLength(file.size);
  const body = await encryptToBlob(transfer.mk, index, file, (n) => onProgress(total > 0 ? (0.5 * n) / total : 0.5, 'encrypting'), signal);
  if (body.size !== total) throw new ApiError(0, 'Encryption produced an unexpected length');
  const target = wireTarget(uploadPath(transfer.token, index));
  const headers = signedHeaders(key, 'POST', target.pathAndQuery, bodyTagStream(total));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', target.href);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (ev) => onProgress(0.5 + 0.5 * (total > 0 ? ev.loaded / total : 1), 'sending');
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1, 'sending');
        resolve();
      } else {
        reject(new ApiError(xhr.status, errorText(xhr.status, xhr.responseText)));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(body);
  });
}

export interface ClipboardBody {
  text: string;
  content_type: 'text';
  sender_name: string;
}

/** POST /api/p2p/clipboard with the text encrypted for the desktop. */
export async function sendClipboard(key: DeviceKey, desktopX25519: string, body: ClipboardBody): Promise<void> {
  const mk = newMessageKey(desktopX25519, key.pkB64);
  const e2e = sealJson(mk, LABEL_CLIPBOARD, body);
  await signedJson(key, 'POST', '/api/p2p/clipboard', { client: CLIENT_WEB, e2e });
}
