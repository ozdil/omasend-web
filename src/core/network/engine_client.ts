/**
 * OmaSend Engine HTTP & P2P Client
 * Communicates with Linux omasend-engine daemon or Android OmaSend server
 */

import { CryptoEngine } from '../crypto/e2ee';

export interface PeerInfo {
  id: string;
  name: string;
  ip: string;
  port: number;
  transport: string;
  omaId: string;
  isTrusted: boolean;
  lastSeen: number;
}

export type DiscoveredDevice = PeerInfo;

export interface EngineStatus {
  status: string;
  port: number;
  local_ip: string;
  pin: string;
  session_key: string;
  active_mode: string;
  wan_active: boolean;
  active_url: string;
  oma_id: string;
  version?: string;
  device_name?: string;
  p2p_discovered_peers: any[];
}

export class EngineClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/+$/, '');
    } else if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('github.io')) {
      this.baseUrl = window.location.origin;
    } else {
      this.baseUrl = 'http://127.0.0.1:53317';
    }
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Pings peer or engine
   */
  async ping(targetUrl: string = this.baseUrl): Promise<{ status: string; oma_id?: string; name?: string } | null> {
    try {
      const resp = await fetch(`${targetUrl}/api/p2p/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch {
      // Offline / unreachable
    }
    return null;
  }

  /**
   * Fetches local daemon engine status
   */
  async getStatus(): Promise<EngineStatus | null> {
    return this.getEngineStatus();
  }

  async getEngineStatus(): Promise<EngineStatus | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return {
          ...data,
          version: data.version || '1.7.0',
          device_name: data.device_name || 'Arch Linux',
        };
      }
    } catch {
      // Not running locally
    }
    return null;
  }

  /**
   * Sends text/image clipboard to peer via HTTP POST /api/p2p/clipboard
   */
  async sendClipboardToPeer(
    peerIp: string,
    port: number = 53317,
    myOmaId: string,
    myDeviceName: string,
    content: string,
    contentType: 'text' | 'image_png' | 'image_webp' = 'text'
  ): Promise<boolean> {
    const url = `http://${peerIp}:${port}/api/p2p/clipboard`;
    const payload = {
      sender_id: myOmaId,
      sender_name: myDeviceName,
      sender_ip: '',
      content_type: contentType,
      content: content,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OmaSend-OmaID': myOmaId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    return resp.ok;
  }

  /**
   * Fetches discovered peers from local engine
   */
  async getDiscoveredDevices(): Promise<PeerInfo[]> {
    return this.getDiscoveredPeers();
  }

  async getDiscoveredPeers(): Promise<PeerInfo[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/p2p/peers`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const rawPeers = data.peers || [];
        return rawPeers.map((p: any) => ({
          id: p.id || p.oma_id,
          name: p.name || 'Unknown Device',
          ip: p.ip,
          port: p.port || 53317,
          transport: p.transport || 'LAN',
          omaId: p.oma_id || p.id || '',
          isTrusted: Boolean(p.is_trusted),
          lastSeen: p.last_seen_secs ? p.last_seen_secs * 1000 : Date.now(),
        }));
      }
    } catch {
      // Local engine not reachable
    }
    return [];
  }

  /**
   * Sends file stream chunked to a target peer
   */
  async sendFileToPeer(
    peerIp: string,
    port: number = 53317,
    myOmaId: string,
    myDeviceName: string,
    file: File,
    onProgress?: (sentBytes: number, totalBytes: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sha256Hex = await CryptoEngine.computeSha256Hex(await file.slice(0, Math.min(1024 * 1024, file.size)).arrayBuffer());

    // 1. Send transfer request
    const reqUrl = `http://${peerIp}:${port}/api/p2p/request`;
    const reqBody = {
      file_id: fileId,
      file_name: file.name,
      file_size: file.size,
      sha256: sha256Hex,
      sender_id: myOmaId,
      sender_name: myDeviceName,
    };

    try {
      const reqResp = await fetch(reqUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OmaSend-OmaID': myOmaId,
        },
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(10000),
      });

      if (!reqResp.ok) {
        return { success: false, error: `Transfer rejected with status ${reqResp.status}` };
      }

      // 2. Stream chunks via /api/p2p/upload
      const uploadUrl = `http://${peerIp}:${port}/api/p2p/upload?file_id=${fileId}`;
      const chunkSize = 256 * 1024; // 256 KiB
      let offset = 0;

      while (offset < file.size) {
        const slice = file.slice(offset, offset + chunkSize);
        const chunkBuf = await slice.arrayBuffer();

        const chunkResp = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-OmaSend-OmaID': myOmaId,
            'X-Chunk-Offset': offset.toString(),
            'X-Chunk-Size': slice.size.toString(),
            'X-File-Total': file.size.toString(),
          },
          body: chunkBuf,
        });

        if (!chunkResp.ok) {
          return { success: false, error: `Chunk upload failed at offset ${offset}` };
        }

        offset += slice.size;
        if (onProgress) {
          onProgress(offset, file.size);
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Stream error' };
    }
  }
}
