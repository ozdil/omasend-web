import { describe, expect, it } from 'vitest';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { deviceKeyFromSeed } from '../src/core/protocol/devicekey';
import { b64urlDecode, b64urlEncode, toHex, utf8 } from '../src/core/protocol/encoding';
import {
  CHUNK,
  LABEL_CLIPBOARD,
  LABEL_REQUEST,
  advertTranscript,
  ciphertextLength,
  encryptFileStream,
  fileLabel,
  MAX_UPLOAD_WIRE,
  maxPlaintextLength,
  newMessageKey,
  PAD_TO,
  sealFile,
  sealJson,
  sealMessage,
  subkey,
  verifyAdvert,
} from '../src/core/protocol/e2e';

const fill = (n: number, b: number) => new Uint8Array(n).fill(b);

// Values from src/webe2e.rs `test_vector_matches_web_client` in omarchy-omasend.
const desktop = deviceKeyFromSeed(fill(32, 0x07));
const DESKTOP_X25519 = 'i4jc1T3UEWi-5t2YzAAjCBEvhgfStTFDplY870idOh4';
const ADVERT_SIG = 'oF7kdBK8YQt5QQVY6UupXgnzKHgZKR9t6EcfdA0o1If1aqLP87bB4tsUBQmtJQFRJKN7r9jBcCFrNaqnR9j4Cg';

async function collect(s: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const r = s.getReader();
  for (;;) {
    const { value, done } = await r.read();
    if (done) break;
    parts.push(value);
  }
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

describe('webe2e test vector', () => {
  it('accepts the desktop advert only when signed by the pinned key', () => {
    const advert = { v: 1, x25519: DESKTOP_X25519, sig: ADVERT_SIG };
    expect(verifyAdvert(desktop.publicKey, desktop.pkB64, advert)).toBe(DESKTOP_X25519);
    expect(advertTranscript(desktop.pkB64, DESKTOP_X25519)).toBe(`omasend-web-e2e-v1|${desktop.pkB64}|${DESKTOP_X25519}`);
    const other = deviceKeyFromSeed(fill(32, 0x08));
    expect(verifyAdvert(other.publicKey, other.pkB64, advert)).toBeNull();
    expect(verifyAdvert(desktop.publicKey, desktop.pkB64, { ...advert, v: 2 })).toBeNull();
    expect(verifyAdvert(desktop.publicKey, desktop.pkB64, { ...advert, x25519: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })).toBeNull();
    expect(verifyAdvert(desktop.publicKey, desktop.pkB64, null)).toBeNull();
  });

  it('derives the same message key, clipboard and file ciphertexts as the engine', () => {
    const mk = newMessageKey(DESKTOP_X25519, desktop.pkB64, fill(32, 0x09));
    expect(mk.epk).toBe('V9tLNZ8jrl4Ubk4lEgVnBHIlBjSMFQwUdT0Mkz0E1CE');
    expect(toHex(mk.key)).toBe('dbeb88569654dc8de014733f6ce06b98b93b27eb5dbbb11cd01f8eccbc647c52');
    const clip = sealMessage(mk, LABEL_CLIPBOARD, utf8('hello'));
    expect(clip).toEqual({ v: 1, epk: mk.epk, ct: 'F1-YlDras6142gWgkZ74xfy9p8cS' });
    expect(toHex(sealFile(mk, 0, new Uint8Array(0)))).toBe('d1c15f58b133dc819d93998d773bffed');
    expect(toHex(sealFile(mk, 1, utf8('abc')))).toBe('f64a652799246345385f30fcbf232b0a319739');
  });

  it('pads JSON messages to 256-byte steps and keeps them parseable', () => {
    const mk = newMessageKey(DESKTOP_X25519, desktop.pkB64, fill(32, 0x09));
    const fk = subkey(mk.key, LABEL_CLIPBOARD);
    const open = (ct: string) => chacha20poly1305(fk, new Uint8Array(12), utf8(LABEL_CLIPBOARD)).decrypt(b64urlDecode(ct)!);
    const short = open(sealJson(mk, LABEL_CLIPBOARD, { text: '123456' }).ct);
    const long = open(sealJson(mk, LABEL_CLIPBOARD, { text: 'x'.repeat(200) }).ct);
    expect(short.length).toBe(PAD_TO);
    expect(long.length).toBe(PAD_TO);
    expect(JSON.parse(new TextDecoder().decode(short))).toEqual({ text: '123456' });
    expect(open(sealJson(mk, LABEL_CLIPBOARD, { text: 'x'.repeat(300) }).ct).length).toBe(2 * PAD_TO);
  });

  it('refuses a low-order desktop key', () => {
    expect(() => newMessageKey(b64urlEncode(new Uint8Array(32)), desktop.pkB64)).toThrow('e2e_bad_key');
    expect(() => newMessageKey('short', desktop.pkB64)).toThrow('e2e_bad_key');
  });
});

describe('file chunking', () => {
  const mk = newMessageKey(DESKTOP_X25519, desktop.pkB64, fill(32, 0x0a));

  it('sizes the ciphertext exactly and the stream matches the one-shot encryption', async () => {
    for (const size of [0, 1, CHUNK - 1, CHUNK, CHUNK + 1, 2 * CHUNK + 5]) {
      const plain = new Uint8Array(size).map((_, i) => (i * 31) % 251);
      const whole = sealFile(mk, 3, plain);
      expect(whole.length).toBe(ciphertextLength(size));
      expect(whole.length).toBe(size + Math.max(1, Math.ceil(size / CHUNK)) * 16);
      const streamed = await collect(encryptFileStream(mk, 3, new Blob([plain])));
      expect(toHex(streamed)).toBe(toHex(whole));
    }
  });

  it('knows the largest file that fits under the upload ceiling', () => {
    for (const wire of [0, 15, 16, 17, CHUNK + 16, CHUNK + 17, MAX_UPLOAD_WIRE]) {
      const p = maxPlaintextLength(wire);
      if (wire >= 16) expect(ciphertextLength(p)).toBeLessThanOrEqual(wire);
      expect(ciphertextLength(p + 1)).toBeGreaterThan(wire);
    }
    expect(maxPlaintextLength(CHUNK + 16)).toBe(CHUNK);
    expect(maxPlaintextLength()).toBeLessThan(MAX_UPLOAD_WIRE);
  });

  it('decrypts with the chunk nonce layout the engine uses (counter + final flag)', () => {
    const plain = new Uint8Array(CHUNK + 10).fill(7);
    const ct = sealFile(mk, 0, plain);
    const fk = subkey(mk.key, fileLabel(0));
    const nonce = (i: number, last: boolean) => {
      const n = new Uint8Array(12);
      n[3] = last ? 1 : 0;
      n[11] = i;
      return n;
    };
    const c0 = chacha20poly1305(fk, nonce(0, false)).decrypt(ct.subarray(0, CHUNK + 16));
    const c1 = chacha20poly1305(fk, nonce(1, true)).decrypt(ct.subarray(CHUNK + 16));
    expect(c0.length + c1.length).toBe(plain.length);
    // The last chunk is marked: it does not open as a middle chunk, so a truncated upload fails.
    expect(() => chacha20poly1305(fk, nonce(1, false)).decrypt(ct.subarray(CHUNK + 16))).toThrow();
    // Other file index, other key.
    expect(() => chacha20poly1305(subkey(mk.key, fileLabel(1)), nonce(0, false)).decrypt(ct.subarray(0, CHUNK + 16))).toThrow();
  });

  it('binds the message key to the browser identity', () => {
    const a = newMessageKey(DESKTOP_X25519, desktop.pkB64, fill(32, 0x0b));
    const b = newMessageKey(DESKTOP_X25519, deviceKeyFromSeed(fill(32, 0x0c)).pkB64, fill(32, 0x0b));
    expect(a.epk).toBe(b.epk);
    expect(toHex(a.key)).not.toBe(toHex(b.key));
    // Sanity: epk is the X25519 public key of the ephemeral secret.
    expect(b64urlEncode(x25519.getPublicKey(fill(32, 0x0b)))).toBe(a.epk);
    expect(b64urlDecode(a.epk)?.length).toBe(32);
    expect(sealMessage(a, LABEL_REQUEST, utf8('{}')).ct).not.toBe(sealMessage(a, LABEL_CLIPBOARD, utf8('{}')).ct);
  });
});
