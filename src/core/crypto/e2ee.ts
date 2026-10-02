/**
 * OmaSend Zero-Knowledge Web Crypto Engine
 * 100% byte-compatible with Linux Rust rendezvous.rs and Android OmaIdentity.kt
 */

import { OmaIdEngine } from '../identity/omaid';

const RENDEZVOUS_SALT = new TextEncoder().encode('omasend-e2ee-rendezvous-salt-v1');
const RENDEZVOUS_INFO = new TextEncoder().encode('omasend-e2ee-rendezvous-aes256-gcm-key-v1');
const RENDEZVOUS_TOPIC_KEY = new TextEncoder().encode('omasend-gh-rendezvous-v1');

export class CryptoEngine {
  /**
   * RFC 2104 HMAC-SHA256 calculation
   */
  static async hmacSha256(keyBytes: Uint8Array, dataBytes: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes as unknown as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, dataBytes as unknown as BufferSource);
    return new Uint8Array(signature);
  }

  /**
   * RFC 5869 HKDF-SHA256 32-byte key derivation
   */
  static async hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array): Promise<Uint8Array> {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      ikm as unknown as BufferSource,
      { name: 'HKDF' },
      false,
      ['deriveBits', 'deriveKey']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: salt as unknown as BufferSource,
        info: info as unknown as BufferSource,
      },
      baseKey,
      256
    );
    return new Uint8Array(derivedBits);
  }

  /**
   * Computes 64-char hex Blinded Rendezvous Topic for an OmaID
   */
  static async computeRendezvousTopic(omaId: string): Promise<string> {
    const norm = OmaIdEngine.normalize(omaId);
    const ikm = new TextEncoder().encode(norm.length === 16 ? norm : omaId.trim());
    const topicBytes = await this.hmacSha256(ikm, RENDEZVOUS_TOPIC_KEY);
    return Array.from(topicBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Derives 256-bit symmetric AES-GCM key from OmaID
   */
  static async deriveRendezvousKey(omaId: string): Promise<CryptoKey> {
    const norm = OmaIdEngine.normalize(omaId);
    const ikm = new TextEncoder().encode(norm.length === 16 ? norm : omaId.trim());
    const rawKey = await this.hkdfSha256(ikm, RENDEZVOUS_SALT, RENDEZVOUS_INFO);
    return await crypto.subtle.importKey(
      'raw',
      rawKey as unknown as BufferSource,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts plaintext buffer using AES-256-GCM.
   * Layout: [12-byte IV] + [Ciphertext + 16-byte Auth Tag]
   */
  static async encryptPayload(plaintext: Uint8Array, omaId: string, aad?: Uint8Array): Promise<Uint8Array> {
    const key = await this.deriveRendezvousKey(omaId);
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const params: AesGcmParams = {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: 128,
    };
    if (aad) {
      params.additionalData = aad as unknown as BufferSource;
    }

    const ciphertextBuffer = await crypto.subtle.encrypt(
      params,
      key,
      plaintext as unknown as BufferSource
    );

    const ciphertext = new Uint8Array(ciphertextBuffer);
    const result = new Uint8Array(iv.length + ciphertext.length);
    result.set(iv, 0);
    result.set(ciphertext, iv.length);
    return result;
  }

  /**
   * Decrypts AES-256-GCM ciphertext payload with 12-byte IV prefix
   */
  static async decryptPayload(ciphertextWithIv: Uint8Array, omaId: string, aad?: Uint8Array): Promise<Uint8Array> {
    if (ciphertextWithIv.length < 28) {
      throw new Error('Payload too short for AES-256-GCM');
    }
    const key = await this.deriveRendezvousKey(omaId);
    const iv = ciphertextWithIv.slice(0, 12);
    const ciphertext = ciphertextWithIv.slice(12);

    const params: AesGcmParams = {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: 128,
    };
    if (aad) {
      params.additionalData = aad as unknown as BufferSource;
    }

    const decryptedBuffer = await crypto.subtle.decrypt(
      params,
      key,
      ciphertext as unknown as BufferSource
    );
    return new Uint8Array(decryptedBuffer);
  }

  /**
   * Computes SHA-256 hex checksum
   */
  static async computeSha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
    const hashBuf = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generates a 6-digit numeric PIN
   */
  static generatePin(): string {
    const buf = new Uint8Array(3);
    crypto.getRandomValues(buf);
    const val = ((buf[0] << 16) | (buf[1] << 8) | buf[2]) % 1000000;
    return val.toString().padStart(6, '0');
  }
}
