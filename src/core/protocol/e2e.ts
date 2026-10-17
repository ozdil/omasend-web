/**
 * End-to-end encryption towards the desktop, "omasend-web-e2e-v1". Byte-compatible with the
 * engine's src/webe2e.rs (PROTOCOL_V2.md, "Browser end-to-end encryption").
 *
 * The page keeps using the signed-HTTP endpoints (a browser on http://<lan-ip> has no QUIC and
 * no secure context), but everything it sends is encrypted for the desktop's static X25519 key,
 * which the desktop publishes signed by the Ed25519 key pinned at pairing:
 *
 * - One fresh X25519 key pair per message. `K = HKDF-SHA256(salt = epk || x_pk,
 *   ikm = X25519(e, x_pk), info = DOMAIN | browser_pk)`; every purpose has its own subkey.
 * - Metadata and clipboard text: one ChaCha20-Poly1305 message (zero nonce, the subkey is
 *   used once; the label is the AAD).
 * - Files: 64 KiB chunks, counter nonce plus a final-chunk flag, so chunks cannot be
 *   reordered, dropped or cut off. The ciphertext is exactly plain + 16 bytes per chunk.
 *
 * Pure JS (@noble/ciphers, @noble/curves, @noble/hashes), like the rest of the protocol code.
 * The same module is meant to serve a later "send with a link" receiver page too: nothing
 * here depends on the signed-HTTP transport, only on a verified X25519 key.
 */
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { b64urlDecode, b64urlEncode, randomBytes, utf8 } from './encoding';
import { verifyB64 } from './devicekey';

export const E2E_DOMAIN = 'omasend-web-e2e-v1';
export const E2E_VERSION = 1;
/** Plaintext bytes per file chunk. */
export const CHUNK = 64 * 1024;
export const TAG = 16;

export const LABEL_REQUEST = 'request';
export const LABEL_CLIPBOARD = 'clipboard';

/** `{"v":1,"x25519":..,"sig":..}` as the desktop sends it (pair response, GET /api/v2/e2e). */
export interface E2eAdvert {
  v: number;
  x25519: string;
  sig: string;
}

/** The string the desktop signs to vouch for its X25519 key. */
export function advertTranscript(edPkB64: string, xPkB64: string): string {
  return `${E2E_DOMAIN}|${edPkB64}|${xPkB64}`;
}

/**
 * Checks the desktop's X25519 key against its pinned Ed25519 key. Returns the key (b64url) or
 * null when anything is off, so a tampered advert can never become a recipient key.
 */
export function verifyAdvert(desktopEdPk: Uint8Array, desktopEdPkB64: string, advert: unknown): string | null {
  if (!advert || typeof advert !== 'object') return null;
  const a = advert as Record<string, unknown>;
  if (a.v !== E2E_VERSION || typeof a.x25519 !== 'string' || typeof a.sig !== 'string') return null;
  const x = b64urlDecode(a.x25519);
  if (!x || x.length !== 32) return null;
  return verifyB64(desktopEdPk, utf8(advertTranscript(desktopEdPkB64, a.x25519)), a.sig) ? a.x25519 : null;
}

/** Everything needed to seal one request or clipboard message, plus the files it lists. */
export interface MessageKey {
  key: Uint8Array;
  /** b64url of the ephemeral public key, sent in the envelope. */
  epk: string;
}

function isAllZero(b: Uint8Array): boolean {
  let acc = 0;
  for (const x of b) acc |= x;
  return acc === 0;
}

/**
 * Derives a fresh message key for the desktop's X25519 key. `browserPkB64` is this browser's
 * Ed25519 key, so the key is bound to the identity that signs the request.
 */
export function newMessageKey(desktopXPkB64: string, browserPkB64: string, ephemeralSecret: Uint8Array = randomBytes(32)): MessageKey {
  const xPk = b64urlDecode(desktopXPkB64);
  if (!xPk || xPk.length !== 32) throw new Error('e2e_bad_key');
  const epk = x25519.getPublicKey(ephemeralSecret);
  let shared: Uint8Array;
  try {
    // noble refuses low-order points itself; the all-zero check is belt and braces.
    shared = x25519.getSharedSecret(ephemeralSecret, xPk);
  } catch {
    throw new Error('e2e_bad_key');
  }
  if (isAllZero(shared)) throw new Error('e2e_bad_key');
  const salt = new Uint8Array(64);
  salt.set(epk, 0);
  salt.set(xPk, 32);
  const key = hkdf(sha256, shared, salt, utf8(`${E2E_DOMAIN}|${browserPkB64}`), 32);
  shared.fill(0);
  return { key, epk: b64urlEncode(epk) };
}

export function subkey(key: Uint8Array, label: string): Uint8Array {
  return hmac(sha256, key, utf8(`${E2E_DOMAIN}|${label}`));
}

export function fileLabel(index: number): string {
  return `file|${index}`;
}

const ZERO_NONCE = new Uint8Array(12);

/** One-shot message (request metadata, clipboard text): `{v, epk, ct}`. */
export function sealMessage(mk: MessageKey, label: string, plaintext: Uint8Array): { v: number; epk: string; ct: string } {
  const ct = chacha20poly1305(subkey(mk.key, label), ZERO_NONCE, utf8(label)).encrypt(plaintext);
  return { v: E2E_VERSION, epk: mk.epk, ct: b64urlEncode(ct) };
}

export function chunkCount(plainSize: number): number {
  return Math.max(1, Math.ceil(plainSize / CHUNK));
}

/** Exact length of an encrypted file body, which is what `stream:<len>` signs. */
export function ciphertextLength(plainSize: number): number {
  return plainSize + chunkCount(plainSize) * TAG;
}

function chunkNonce(index: number, last: boolean): Uint8Array {
  const n = new Uint8Array(12);
  n[3] = last ? 1 : 0;
  // u64 big-endian chunk index; files are far below 2^53 chunks.
  const hi = Math.floor(index / 0x1_0000_0000);
  const lo = index >>> 0;
  n[4] = (hi >>> 24) & 255;
  n[5] = (hi >>> 16) & 255;
  n[6] = (hi >>> 8) & 255;
  n[7] = hi & 255;
  n[8] = (lo >>> 24) & 255;
  n[9] = (lo >>> 16) & 255;
  n[10] = (lo >>> 8) & 255;
  n[11] = lo & 255;
  return n;
}

/** Encrypts one chunk of file `index`. `chunkIndex` counts from 0; `last` marks the final chunk. */
export function sealChunk(fileKey: Uint8Array, chunkIndex: number, last: boolean, plain: Uint8Array): Uint8Array {
  return chacha20poly1305(fileKey, chunkNonce(chunkIndex, last)).encrypt(plain);
}

/** Whole-file encryption (small files, tests). Streaming callers use `encryptFileStream`. */
export function sealFile(mk: MessageKey, index: number, plain: Uint8Array): Uint8Array {
  const fk = subkey(mk.key, fileLabel(index));
  const n = chunkCount(plain.length);
  const out = new Uint8Array(ciphertextLength(plain.length));
  let o = 0;
  for (let i = 0; i < n; i++) {
    const ct = sealChunk(fk, i, i + 1 === n, plain.subarray(i * CHUNK, Math.min((i + 1) * CHUNK, plain.length)));
    out.set(ct, o);
    o += ct.length;
  }
  return out;
}

/**
 * Encrypts a Blob chunk by chunk as a ReadableStream, reading only one chunk at a time, so
 * large files never sit in memory. Where streaming request bodies are not supported the caller
 * collects the stream into a Blob first (still one chunk of plaintext at a time).
 */
export function encryptFileStream(mk: MessageKey, index: number, file: Blob): ReadableStream<Uint8Array> {
  const fk = subkey(mk.key, fileLabel(index));
  const n = chunkCount(file.size);
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= n) {
        controller.close();
        return;
      }
      const start = i * CHUNK;
      const plain = new Uint8Array(await file.slice(start, Math.min(start + CHUNK, file.size)).arrayBuffer());
      controller.enqueue(sealChunk(fk, i, i + 1 === n, plain));
      i++;
    },
  });
}
