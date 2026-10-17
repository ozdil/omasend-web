/**
 * Protocol v2 (Phase 1) primitives: Ed25519 device identity, pairing MAC/transcript and the
 * canonical string for signed requests. Byte-compatible with the desktop engine
 * (src/devicekey.rs) and the Android app (crypto/DeviceKey.kt); see PROTOCOL_V2.md.
 *
 * Pure JS (@noble/curves, @noble/hashes): the page is usually served over plain http on a LAN
 * address, which is not a secure context, so WebCrypto's crypto.subtle may be missing.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { b64urlDecode, b64urlEncode, randomBytes, toHex, utf8 } from './encoding';

export const PAIR_DOMAIN = 'omasend-pair-v2';
export const SIG_DOMAIN = 'omasend-v2';

export interface DeviceKey {
  seed: Uint8Array;
  publicKey: Uint8Array;
  /** b64url(pk) */
  pkB64: string;
  /** XXXX-XXXX-XXXX-XXXX */
  deviceId: string;
}

export function deviceKeyFromSeed(seed: Uint8Array): DeviceKey {
  if (seed.length !== 32) throw new Error('Device seed must be 32 bytes');
  const publicKey = ed25519.getPublicKey(seed);
  return { seed, publicKey, pkB64: b64urlEncode(publicKey), deviceId: deviceIdForPk(publicKey) };
}

export function generateSeed(): Uint8Array {
  return randomBytes(32);
}

/** First 8 bytes of SHA-256(pk), uppercase hex, grouped as XXXX-XXXX-XXXX-XXXX. */
export function deviceIdForPk(pk: Uint8Array): string {
  const h = toHex(sha256(pk).subarray(0, 8)).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}`;
}

/** Decodes a b64url public key and checks that it is a valid Ed25519 point. */
export function decodePk(pkB64: string): Uint8Array | null {
  const bytes = b64urlDecode(pkB64.trim());
  if (!bytes || bytes.length !== 32) return null;
  return ed25519.utils.isValidPublicKey(bytes, false) ? bytes : null;
}

export function signB64(key: DeviceKey, msg: Uint8Array): string {
  return b64urlEncode(ed25519.sign(msg, key.seed));
}

/** Strict verification (non-canonical encodings rejected), like ed25519-dalek's verify_strict. */
export function verifyB64(pk: Uint8Array, msg: Uint8Array, sigB64: string): boolean {
  const sig = b64urlDecode(sigB64.trim());
  if (!sig || sig.length !== 64) return false;
  try {
    return ed25519.verify(sig, msg, pk, { zip215: false });
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ pairing

/** hex(HMAC-SHA256(secret, "omasend-pair-v2|" + R_pk + "|" + I_pk)) */
export function pairMac(secret: Uint8Array, responderPk: string, initiatorPk: string): string {
  return toHex(hmac(sha256, secret, utf8(`${PAIR_DOMAIN}|${responderPk}|${initiatorPk}`)));
}

/**
 * "omasend-pair-v2|" + R_pk + "|" + I_pk + "|" + mac, plus "|" + client for a non-native client:
 * signed by both sides. The browser signs as `web`, so nobody on the path can strip the
 * `client` field and make the desktop treat this key as a native one (which would later accept
 * unencrypted requests from it). Native apps keep the four-part transcript.
 */
export function pairTranscript(responderPk: string, initiatorPk: string, mac: string, client = ''): string {
  const base = `${PAIR_DOMAIN}|${responderPk}|${initiatorPk}|${mac}`;
  return client ? `${base}|${client}` : base;
}

// ------------------------------------------------------------------ signed requests

/** body_tag for JSON and empty bodies: hex(SHA-256(body)). */
export function bodyTagJson(body: Uint8Array): string {
  return toHex(sha256(body));
}

/** body_tag for POST /api/p2p/upload: "stream:" + Content-Length. */
export function bodyTagStream(contentLength: number): string {
  return `stream:${contentLength}`;
}

/** "omasend-v2\n" + METHOD + "\n" + path[?query] + "\n" + ts + "\n" + nonce + "\n" + body_tag */
export function canonical(method: string, pathAndQuery: string, ts: number, nonce: string, bodyTag: string): string {
  return `${SIG_DOMAIN}\n${method}\n${pathAndQuery}\n${ts}\n${nonce}\n${bodyTag}`;
}

export interface SignedHeaders {
  'X-OmaSend-Pk': string;
  'X-OmaSend-Ts': string;
  'X-OmaSend-Nonce': string;
  'X-OmaSend-Sig': string;
}

/**
 * The four v2 headers. `pathAndQuery` must be exactly the request target sent on the wire,
 * i.e. the same string that is passed to fetch / XMLHttpRequest.
 */
export function signedHeaders(
  key: DeviceKey,
  method: string,
  pathAndQuery: string,
  bodyTag: string,
  ts: number = Math.floor(Date.now() / 1000),
  nonce: string = toHex(randomBytes(16)),
): SignedHeaders {
  const sig = signB64(key, utf8(canonical(method, pathAndQuery, ts, nonce, bodyTag)));
  return {
    'X-OmaSend-Pk': key.pkB64,
    'X-OmaSend-Ts': String(ts),
    'X-OmaSend-Nonce': nonce,
    'X-OmaSend-Sig': sig,
  };
}
