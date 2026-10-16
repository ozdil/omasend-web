import { describe, expect, it } from 'vitest';
import {
  bodyTagJson,
  bodyTagStream,
  canonical,
  decodePk,
  deviceKeyFromSeed,
  pairMac,
  pairTranscript,
  signB64,
  signedHeaders,
  verifyB64,
} from '../src/core/protocol/devicekey';
import { b64urlDecode, b64urlEncode, utf8 } from '../src/core/protocol/encoding';
import { fragmentHasPair, pairLinkFromFragment, pairLinkFromText, parsePairUri, urlDecode } from '../src/core/protocol/pairuri';
import { sanitizeFilename } from '../src/core/protocol/filename';
import { buildPairRequest, decisionPath, uploadPath, verifyPairResponse } from '../src/core/protocol/client';

const fill = (n: number, b: number) => new Uint8Array(n).fill(b);

// PROTOCOL_V2.md "Test vector (must match on both platforms)".
describe('PROTOCOL_V2 test vector', () => {
  const key = deviceKeyFromSeed(fill(32, 0x07));

  it('derives pk and device id', () => {
    expect(key.pkB64).toBe('6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw');
    expect(key.deviceId).toBe('FE81-2C12-F3AB-4CE6');
  });

  it('computes the body tag and signature of the canonical string', () => {
    const tag = bodyTagJson(utf8('{}'));
    expect(tag).toBe('44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
    const canon = canonical('POST', '/api/p2p/request', 1760000000, '00112233445566778899aabbccddeeff', tag);
    expect(canon).toBe(
      'omasend-v2\nPOST\n/api/p2p/request\n1760000000\n00112233445566778899aabbccddeeff\n' + tag,
    );
    const sig = signB64(key, utf8(canon));
    expect(sig).toBe('eFkLAbIm3RpexYvL_-DJ6IlojDwGoLd42QJ72_kyhpn7QA_GBOcYOOLoQPw7kI2GeNO0Bl0PZG60gJZvzI9oAA');
    expect(verifyB64(key.publicKey, utf8(canon), sig)).toBe(true);
    expect(verifyB64(key.publicKey, utf8(canon + 'x'), sig)).toBe(false);
  });

  it('signedHeaders produces the vector signature for fixed ts/nonce', () => {
    const h = signedHeaders(key, 'POST', '/api/p2p/request', bodyTagJson(utf8('{}')), 1760000000, '00112233445566778899aabbccddeeff');
    expect(h).toEqual({
      'X-OmaSend-Pk': '6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw',
      'X-OmaSend-Ts': '1760000000',
      'X-OmaSend-Nonce': '00112233445566778899aabbccddeeff',
      'X-OmaSend-Sig': 'eFkLAbIm3RpexYvL_-DJ6IlojDwGoLd42QJ72_kyhpn7QA_GBOcYOOLoQPw7kI2GeNO0Bl0PZG60gJZvzI9oAA',
    });
    const fresh = signedHeaders(key, 'GET', '/x', bodyTagJson(new Uint8Array(0)));
    expect(fresh['X-OmaSend-Nonce']).toMatch(/^[0-9a-f]{32}$/);
    expect(Math.abs(Number(fresh['X-OmaSend-Ts']) - Date.now() / 1000)).toBeLessThan(5);
  });

  it('computes the pairing MAC', () => {
    expect(pairMac(fill(32, 0x09), key.pkB64, key.pkB64)).toBe(
      '58c09b0af9427c54894465e53a59c22480cb28449242df537932d4c659cd1fb7',
    );
  });
});

describe('base64url', () => {
  it('round-trips and rejects padding / bad trailing bits', () => {
    for (let n = 0; n < 40; n++) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
      expect(b64urlDecode(b64urlEncode(b))).toEqual(b);
    }
    expect(b64urlDecode('AA==')).toBeNull();
    expect(b64urlDecode('AB')).toBeNull(); // non-zero trailing bits
    expect(b64urlDecode('A+/A')).toBeNull();
    expect(b64urlDecode('A')).toBeNull();
  });
});

describe('signed upload URL', () => {
  const key = deviceKeyFromSeed(fill(32, 0x07));
  const name = sanitizeFilename('Çiçek ğüşı 日本 (1)?.txt');

  it('sanitizes like the engine and is idempotent', () => {
    expect(name).toBe('Çiçek ğüşı 日本 1.txt');
    expect(sanitizeFilename(name)).toBe(name);
    expect(sanitizeFilename('../../etc/passwd')).toBe('file_1');
    expect(sanitizeFilename('🙂🙂', 2)).toBe('file_3');
    expect(sanitizeFilename('🙂.png', 0)).toBe('file_1.png');
    expect(sanitizeFilename(sanitizeFilename('🙂.png'))).toBe('file_1.png');
    expect(sanitizeFilename('.hidden')).toBe('file_1.hidden');
  });

  it('builds the canonical string from exactly the URL that is sent', () => {
    const token = '0123456789abcdef0123456789abcdef';
    const path = uploadPath(token, name);
    expect(path).toBe(
      '/api/p2p/upload?token=0123456789abcdef0123456789abcdef&filename=%C3%87i%C3%A7ek%20%C4%9F%C3%BC%C5%9F%C4%B1%20%E6%97%A5%E6%9C%AC%201.txt',
    );
    // The engine decodes filename= byte-wise (urlencoding_decode) and gets the name back.
    expect(urlDecode(path.split('filename=')[1])).toBe(name);
    // A WHATWG URL parser leaves this request target unchanged (what fetch/XHR put on the wire).
    const u = new URL(path, 'http://192.168.1.10:53317/web/');
    expect(u.pathname + u.search).toBe(path);

    const h = signedHeaders(key, 'POST', path, bodyTagStream(12345), 1760000000, '00112233445566778899aabbccddeeff');
    const canon =
      'omasend-v2\nPOST\n' + path + '\n1760000000\n00112233445566778899aabbccddeeff\nstream:12345';
    expect(canon).toBe(canonical('POST', path, 1760000000, '00112233445566778899aabbccddeeff', 'stream:12345'));
    expect(verifyB64(key.publicKey, utf8(canon), h['X-OmaSend-Sig'])).toBe(true);
  });

  it('builds the decision URL', () => {
    expect(decisionPath('abc')).toBe('/api/p2p/decision?token=abc');
  });
});

describe('pair URI parsing', () => {
  const pk = '6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw';
  const s = b64urlEncode(fill(32, 0x09));
  const valid = `omasend://pair?v=2&pk=${pk}&s=${s}&h=192.168.1.10&p=53317&n=Desk%20%26%20Co%C3%A7&o=1&q=53318`;

  it('parses a valid link', () => {
    const r = parsePairUri(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.offer).toEqual({
      pk,
      secret: fill(32, 0x09),
      host: '192.168.1.10',
      port: 53317,
      name: 'Desk & Coç',
      ownDevice: true,
      quicPort: 53318,
    });
    const r2 = parsePairUri(`  omasend://pair?v=2&pk=${pk}&s=${s}&h=10.0.0.2&p=1&n=a+b  `);
    expect(r2.ok && r2.offer).toMatchObject({ name: 'a b', ownDevice: false, quicPort: 0 });
  });

  it('rejects missing or invalid fields', () => {
    const without = (k: string) => valid.replace(new RegExp(`&?${k}=[^&]*`), '').replace('pair?&', 'pair?');
    expect(parsePairUri('https://example.com')).toEqual({ ok: false, error: 'not_pair_link' });
    expect(parsePairUri(valid.replace('v=2', 'v=1'))).toEqual({ ok: false, error: 'unsupported_version' });
    expect(parsePairUri(without('v'))).toEqual({ ok: false, error: 'unsupported_version' });
    expect(parsePairUri(without('pk'))).toEqual({ ok: false, error: 'missing_pk' });
    expect(parsePairUri(valid.replace(pk, 'abc'))).toEqual({ ok: false, error: 'invalid_pk' });
    expect(parsePairUri(without('s'))).toEqual({ ok: false, error: 'missing_secret' });
    expect(parsePairUri(valid.replace(s, s + '=='))).toEqual({ ok: false, error: 'invalid_secret' });
    expect(parsePairUri(without('h'))).toEqual({ ok: false, error: 'missing_host' });
    expect(parsePairUri(without('p'))).toEqual({ ok: false, error: 'invalid_port' });
    expect(parsePairUri(valid.replace('p=53317', 'p=70000'))).toEqual({ ok: false, error: 'invalid_port' });
  });

  it('rejects a secret that is not 32 bytes', () => {
    expect(parsePairUri(valid.replace(s, b64urlEncode(fill(31, 9))))).toEqual({ ok: false, error: 'invalid_secret_length' });
    expect(parsePairUri(valid.replace(s, b64urlEncode(fill(33, 9))))).toEqual({ ok: false, error: 'invalid_secret_length' });
  });

  it('decodes like devicekey::url_decode', () => {
    expect(urlDecode('%aç')).toBe('%aç');
    expect(urlDecode('%ç')).toBe('%ç');
    expect(urlDecode('a%20b+c')).toBe('a b c');
    expect(urlDecode('%C3%A7')).toBe('ç');
    expect(urlDecode('%C3')).toBe('\uFFFD'); // lone byte: lossy UTF-8, as String::from_utf8_lossy
    expect(urlDecode('x%4')).toBe('x%4');
    expect(urlDecode('%C3%')).toBe('\uFFFD%');
  });

  it('extracts the link from the #pair= fragment', () => {
    const hash = '#pair=' + encodeURIComponent(valid);
    expect(fragmentHasPair(hash)).toBe(true);
    expect(pairLinkFromFragment(hash)).toBe(valid);
    expect(pairLinkFromFragment('pair=' + encodeURIComponent(valid))).toBe(valid);
    expect(pairLinkFromFragment('#x=1&pair=' + encodeURIComponent(valid))).toBe(valid);
    expect(pairLinkFromFragment('')).toBeNull();
    expect(pairLinkFromFragment('#settings')).toBeNull();
    expect(fragmentHasPair('#settings')).toBe(false);
    expect(pairLinkFromFragment('#pair=%E0%A4%A')).toBeNull();
    expect(fragmentHasPair('#pair=%E0%A4%A')).toBe(true);
    expect(pairLinkFromFragment('#pair=')).toBeNull();
  });

  it('accepts a pasted omasend:// or http #pair= link', () => {
    expect(pairLinkFromText('  ' + valid + '\n')).toBe(valid);
    expect(pairLinkFromText('http://192.168.1.10:53317/web/#pair=' + encodeURIComponent(valid))).toBe(valid);
    expect(pairLinkFromText('http://192.168.1.10:53317/web/')).toBeNull();
    expect(pairLinkFromText('hello')).toBeNull();
  });
});

describe('pairing request and response', () => {
  const responder = deviceKeyFromSeed(fill(32, 0x07));
  const browser = deviceKeyFromSeed(fill(32, 0x01));
  const secret = fill(32, 0x09);
  const offer = { pk: responder.pkB64, secret, host: '10.0.0.2', port: 53317, name: 'Desk', ownDevice: false, quicPort: 0 };

  it('builds the request per spec and accepts a correctly signed response', () => {
    const req = buildPairRequest(browser, offer, 'Browser on Linux');
    const mac = pairMac(secret, responder.pkB64, browser.pkB64);
    expect(req).toEqual({ pk: browser.pkB64, name: 'Browser on Linux', mac, sig: req.sig, client: 'web' });
    expect(mac).toMatch(/^[0-9a-f]{64}$/);
    const transcript = utf8(pairTranscript(responder.pkB64, browser.pkB64, mac));
    expect(verifyB64(decodePk(browser.pkB64)!, transcript, req.sig)).toBe(true);

    const resp = { pk: responder.pkB64, name: 'desk-host', device_id: responder.deviceId, sig: signB64(responder, transcript), quic_port: 53318 };
    expect(verifyPairResponse(browser, offer, resp)).toEqual({ pk: responder.pkB64, name: 'desk-host', deviceId: 'FE81-2C12-F3AB-4CE6' });
  });

  it('rejects a response from another key or with a bad signature', () => {
    const mac = pairMac(secret, responder.pkB64, browser.pkB64);
    const transcript = utf8(pairTranscript(responder.pkB64, browser.pkB64, mac));
    const other = deviceKeyFromSeed(fill(32, 0x02));
    expect(() => verifyPairResponse(browser, offer, { pk: other.pkB64, sig: signB64(other, transcript) })).toThrow('pair_key_mismatch');
    expect(() => verifyPairResponse(browser, offer, { pk: responder.pkB64, sig: signB64(other, transcript) })).toThrow('pair_bad_signature');
    expect(() => verifyPairResponse(browser, offer, { pk: responder.pkB64 })).toThrow('pair_bad_signature');
  });
});
