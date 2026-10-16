/**
 * OmaSend Blinded Rendezvous Engine (WAN Global Discovery)
 */

import { CryptoEngine } from '../crypto/web_crypto';

export interface RendezvousRecord {
  v: number;
  topic: string;
  device_id: string;
  hostname: string;
  local_ip: string;
  local_port: number;
  stun_addr?: string;
  wan_url?: string;
  timestamp: number;
  expires_at: number;
}

export class RendezvousClient {
  /**
   * Encrypts and builds a Blinded Rendezvous Record for publishing
   */
  static async createEncryptedRecord(
    omaId: string,
    deviceId: string,
    hostname: string,
    localIp: string,
    localPort: number = 53317,
    stunAddr?: string,
    wanUrl?: string
  ): Promise<{ topic: string; nonce: string; ciphertext: string; updated_at: number }> {
    const topic = await CryptoEngine.computeRendezvousTopic(omaId);
    const now = Math.floor(Date.now() / 1000);
    const record: RendezvousRecord = {
      v: 1,
      topic: topic,
      device_id: deviceId,
      hostname: hostname,
      local_ip: localIp,
      local_port: localPort,
      stun_addr: stunAddr,
      wan_url: wanUrl,
      timestamp: now,
      expires_at: now + 300, // 5 min TTL
    };

    const jsonBytes = new TextEncoder().encode(JSON.stringify(record));
    const encryptedBytes = await CryptoEngine.encryptPayload(jsonBytes, omaId);
    const iv = encryptedBytes.slice(0, 12);
    const ciphertext = encryptedBytes.slice(12);

    const toHex = (buf: Uint8Array) => Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      topic: topic,
      nonce: toHex(iv),
      ciphertext: toHex(ciphertext),
      updated_at: now,
    };
  }

  /**
   * Decrypts a fetched Blinded Rendezvous Record.
   *
   * Mirrors decrypt_rendezvous_record in the desktop engine (rendezvous.rs):
   * the envelope topic must equal the topic derived from the OmaID
   * (constant-time compare) and the nonce must be 12 bytes. In addition the
   * decrypted record's own topic must match and it must not be expired.
   * Returns null on any mismatch.
   */
  static async decryptRecord(
    omaId: string,
    envelope: { topic: string; nonce: string; ciphertext: string },
    nowSecs: number = Math.floor(Date.now() / 1000)
  ): Promise<RendezvousRecord | null> {
    try {
      const expectedTopic = await CryptoEngine.computeRendezvousTopic(omaId);
      if (!constantTimeEqual(envelope.topic, expectedTopic)) return null;

      const iv = fromHex(envelope.nonce);
      const ciphertext = fromHex(envelope.ciphertext);
      if (!iv || iv.length !== 12 || !ciphertext) return null;

      const fullPayload = new Uint8Array(iv.length + ciphertext.length);
      fullPayload.set(iv, 0);
      fullPayload.set(ciphertext, iv.length);

      const decrypted = await CryptoEngine.decryptPayload(fullPayload, omaId);
      const record = JSON.parse(new TextDecoder().decode(decrypted)) as RendezvousRecord;

      if (typeof record !== 'object' || record === null) return null;
      if (!constantTimeEqual(String(record.topic), expectedTopic)) return null;
      if (typeof record.expires_at !== 'number' || record.expires_at <= nowSecs) return null;
      return record;
    } catch {
      return null;
    }
  }
}

function fromHex(hex: string): Uint8Array | null {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const BlindedRendezvousClient = RendezvousClient;
