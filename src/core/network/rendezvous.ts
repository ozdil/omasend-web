/**
 * OmaSend Blinded Rendezvous Engine (WAN Global Discovery)
 */

import { CryptoEngine } from '../crypto/e2ee';

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
   * Decrypts a fetched Blinded Rendezvous Record
   */
  static async decryptRecord(
    omaId: string,
    nonceHex: string,
    ciphertextHex: string
  ): Promise<RendezvousRecord | null> {
    try {
      const fromHex = (hex: string) => {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return bytes;
      };

      const iv = fromHex(nonceHex);
      const ciphertext = fromHex(ciphertextHex);
      const fullPayload = new Uint8Array(iv.length + ciphertext.length);
      fullPayload.set(iv, 0);
      fullPayload.set(ciphertext, iv.length);

      const decrypted = await CryptoEngine.decryptPayload(fullPayload, omaId);
      const jsonStr = new TextDecoder().decode(decrypted);
      return JSON.parse(jsonStr) as RendezvousRecord;
    } catch {
      return null;
    }
  }
}

export const BlindedRendezvousClient = RendezvousClient;
