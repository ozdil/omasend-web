/** Byte/string helpers shared by the protocol code. No WebCrypto: works in insecure contexts. */

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64URL_INDEX: Record<string, number> = Object.fromEntries([...B64URL].map((c, i) => [c, i]));

/** base64url without padding (RFC 4648 §5), as the engine's URL_SAFE_NO_PAD. */
export function b64urlEncode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63] + B64URL[(n >> 6) & 63] + B64URL[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63] + B64URL[(n >> 6) & 63];
  }
  return out;
}

/**
 * Strict base64url (no padding) decoder. Like the engine's decoder it rejects padding,
 * characters outside the URL-safe alphabet and non-zero trailing bits. Returns null on error.
 */
export function b64urlDecode(s: string): Uint8Array | null {
  if (s.length % 4 === 1) return null;
  const vals: number[] = [];
  for (const c of s) {
    const v = B64URL_INDEX[c];
    if (v === undefined) return null;
    vals.push(v);
  }
  const out = new Uint8Array(Math.floor((vals.length * 6) / 8));
  let o = 0;
  let i = 0;
  for (; i + 3 < vals.length; i += 4) {
    const n = (vals[i] << 18) | (vals[i + 1] << 12) | (vals[i + 2] << 6) | vals[i + 3];
    out[o++] = (n >> 16) & 255;
    out[o++] = (n >> 8) & 255;
    out[o++] = n & 255;
  }
  const rest = vals.length - i;
  if (rest === 2) {
    if (vals[i + 1] & 15) return null;
    out[o++] = ((vals[i] << 2) | (vals[i + 1] >> 4)) & 255;
  } else if (rest === 3) {
    if (vals[i + 2] & 3) return null;
    const n = (vals[i] << 18) | (vals[i + 1] << 12) | (vals[i + 2] << 6);
    out[o++] = (n >> 16) & 255;
    out[o++] = (n >> 8) & 255;
  }
  return out;
}

/** Lowercase hex. */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function utf8(s: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(s);
}

/** CSPRNG bytes. crypto.getRandomValues is available in insecure contexts too. */
export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Constant-time comparison of two strings of equal length. */
export function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
