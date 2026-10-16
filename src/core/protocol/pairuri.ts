/**
 * Pairing links. Same rules as devicekey::parse_pair_uri in the desktop engine:
 *   omasend://pair?v=2&pk=<b64url R_pk>&s=<b64url 32-byte secret>&h=<ip>&p=<port>&n=<urlenc name>&o=<0|1>&q=<quic port>
 * The desktop QR code wraps it for the browser as
 *   http://<ip>:<port>/web/#pair=<encodeURIComponent(omasend://pair?...)>
 */
import { decodePk } from './devicekey';
import { b64urlDecode } from './encoding';

export interface PairOffer {
  /** b64url responder public key, exactly as in the link (it is part of the MAC/transcript). */
  pk: string;
  secret: Uint8Array;
  host: string;
  port: number;
  name: string;
  /** o=1: the responder will treat this browser as one of its own devices (its trust, not ours). */
  ownDevice: boolean;
  quicPort: number;
}

export type PairUriError =
  | 'not_pair_link'
  | 'unsupported_version'
  | 'missing_pk'
  | 'invalid_pk'
  | 'missing_secret'
  | 'invalid_secret'
  | 'invalid_secret_length'
  | 'missing_host'
  | 'invalid_port';

export type PairUriResult = { ok: true; offer: PairOffer } | { ok: false; error: PairUriError };

const PREFIX = 'omasend://pair?';

/**
 * Percent-decoding with the engine's semantics (devicekey::url_decode): byte-wise, '+' is a
 * space, an invalid escape is kept literally, invalid UTF-8 becomes U+FFFD.
 */
export function urlDecode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  const out: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] === 0x25 /* % */ && i + 2 < bytes.length) {
      const h = String.fromCharCode(bytes[i + 1], bytes[i + 2]);
      // u8::from_str_radix(h, 16) on two bytes: two hex digits, or '+' and one hex digit.
      if (/^(?:[0-9a-fA-F]{2}|\+[0-9a-fA-F])$/.test(h)) {
        out.push(parseInt(h, 16));
        i += 3;
        continue;
      }
    }
    out.push(bytes[i] === 0x2b /* + */ ? 0x20 : bytes[i]);
    i += 1;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(out));
}

/** Rust's `str::parse::<u16>()`: optional '+', ASCII digits, 0..=65535. */
function parseU16(s: string | undefined): number | null {
  if (s === undefined || !/^\+?[0-9]+$/.test(s)) return null;
  const n = Number(s.replace(/^\+/, ''));
  return Number.isInteger(n) && n <= 65535 ? n : null;
}

export function parsePairUri(uri: string): PairUriResult {
  const trimmed = uri.trim();
  if (!trimmed.startsWith(PREFIX)) return { ok: false, error: 'not_pair_link' };
  const map = new Map<string, string>();
  for (const part of trimmed.slice(PREFIX.length).split('&')) {
    const eq = part.indexOf('=');
    if (eq >= 0) map.set(part.slice(0, eq), part.slice(eq + 1));
  }
  if (map.get('v') !== '2') return { ok: false, error: 'unsupported_version' };
  const pk = map.get('pk');
  if (pk === undefined) return { ok: false, error: 'missing_pk' };
  if (!decodePk(pk)) return { ok: false, error: 'invalid_pk' };
  const s = map.get('s');
  if (s === undefined) return { ok: false, error: 'missing_secret' };
  const secret = b64urlDecode(s);
  if (!secret) return { ok: false, error: 'invalid_secret' };
  if (secret.length !== 32) return { ok: false, error: 'invalid_secret_length' };
  const h = map.get('h');
  if (h === undefined) return { ok: false, error: 'missing_host' };
  const port = parseU16(map.get('p'));
  if (port === null) return { ok: false, error: 'invalid_port' };
  return {
    ok: true,
    offer: {
      pk,
      secret,
      host: urlDecode(h),
      port,
      name: urlDecode(map.get('n') ?? ''),
      ownDevice: map.get('o') === '1',
      quicPort: parseU16(map.get('q')) ?? 0,
    },
  };
}

/**
 * Extracts the omasend:// link from a location.hash such as "#pair=omasend%3A%2F%2Fpair%3F...".
 * Returns null when the fragment has no pair= parameter, or it is not valid percent-encoding.
 */
export function pairLinkFromFragment(hash: string): string | null {
  const frag = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of frag.split('&')) {
    if (part.startsWith('pair=')) {
      try {
        const value = decodeURIComponent(part.slice('pair='.length));
        return value.length > 0 ? value : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** True when location.hash carries a pairing link that must be consumed and removed. */
export function fragmentHasPair(hash: string): boolean {
  const frag = hash.startsWith('#') ? hash.slice(1) : hash;
  return frag.split('&').some((p) => p.startsWith('pair='));
}
