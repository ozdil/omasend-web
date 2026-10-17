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
import type { PairOffer } from './pairuri';

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

export function uploadPath(token: string, filename: string): string {
  return `/api/p2p/upload?token=${encodeURIComponent(token)}&filename=${encodeURIComponent(filename)}`;
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
}

/** Builds the POST /api/v2/pair body for this browser (initiator) and a scanned offer. */
export function buildPairRequest(key: DeviceKey, offer: PairOffer, myName: string) {
  const mac = pairMac(offer.secret, offer.pk, key.pkB64);
  const sig = signB64(key, utf8(pairTranscript(offer.pk, key.pkB64, mac)));
  return { pk: key.pkB64, name: myName, mac, sig, client: 'web' };
}

/** Checks the responder's reply against the key pinned in the QR code. Throws on mismatch. */
export function verifyPairResponse(key: DeviceKey, offer: PairOffer, resp: Record<string, unknown>): PairedDesktop {
  if (typeof resp.pk !== 'string' || resp.pk !== offer.pk) throw new Error('pair_key_mismatch');
  const rPk = decodePk(resp.pk);
  if (!rPk) throw new Error('pair_key_mismatch');
  const mac = pairMac(offer.secret, offer.pk, key.pkB64);
  if (typeof resp.sig !== 'string' || !verifyB64(rPk, utf8(pairTranscript(offer.pk, key.pkB64, mac)), resp.sig)) {
    throw new Error('pair_bad_signature');
  }
  const name = typeof resp.name === 'string' && resp.name.trim() ? resp.name.trim().slice(0, 64) : offer.name;
  return { pk: offer.pk, name: name || 'OmaSend', deviceId: deviceIdForPk(rPk) };
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

export interface TransferRequestBody {
  /** Not needed by engines that accept signed requests without an OmaID; kept for older engines. */
  oma_id: string;
  sender_name: string;
  files: { name: string; size_bytes: number }[];
  total_size_bytes: number;
  client: 'web';
}

export type DecisionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'NOT_FOUND';

export async function requestTransfer(key: DeviceKey, body: TransferRequestBody): Promise<{ status: DecisionStatus; token: string }> {
  const j = await signedJson(key, 'POST', '/api/p2p/request', body);
  if (typeof j.token !== 'string' || !j.token) throw new ApiError(200, 'Engine returned no transfer token');
  return { status: j.status === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING', token: j.token };
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
 * POST /api/p2p/upload with the file as the raw body. XMLHttpRequest instead of fetch because
 * fetch cannot report upload progress. The browser sets Content-Length to file.size, which is
 * what "stream:<size>" signs.
 */
export function uploadFile(
  key: DeviceKey,
  token: string,
  filename: string,
  file: Blob,
  onProgress: (sent: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const target = wireTarget(uploadPath(token, filename));
  const headers = signedHeaders(key, 'POST', target.pathAndQuery, bodyTagStream(file.size));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', target.href);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (ev) => onProgress(ev.loaded, ev.lengthComputable ? ev.total : file.size);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(file.size, file.size);
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
    xhr.send(file);
  });
}

export interface ClipboardBody {
  text: string;
  content_type: 'text';
  sender_name: string;
  oma_id: string;
  client: 'web';
}

export async function sendClipboard(key: DeviceKey, body: ClipboardBody): Promise<void> {
  await signedJson(key, 'POST', '/api/p2p/clipboard', body);
}
