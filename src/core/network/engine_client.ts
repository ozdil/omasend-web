/**
 * OmaSend engine HTTP client (read-only).
 *
 * This client only reads status and LAN discovery data from an OmaSend
 * engine. Sending files/clipboard and pairing from the browser are not
 * implemented: the engine's current protocol (v2) is not supported here.
 *
 * The engine URL must be configured explicitly:
 *   - build time:  VITE_OMASEND_ENGINE_URL=http://127.0.0.1:53317 npm run build
 *   - or the page is served by the engine itself (production build, same origin).
 * Under the Vite dev server there is no implicit fallback, because the dev
 * server's own origin is not an engine.
 */

export interface PeerInfo {
  id: string;
  name: string;
  ip: string;
  port: number;
  transport: string;
}

export type DiscoveredDevice = PeerInfo;

/** Fields the engine may return from GET /api/status. Everything is optional; nothing is invented. */
export interface EngineStatus {
  status?: string;
  port?: number;
  version?: string;
  device_name?: string;
  mode?: string;
  auth_required?: boolean;
}

export type EngineStatusResult =
  | { ok: true; status: EngineStatus }
  | { ok: false; reason: string };

const NOT_CONFIGURED_REASON =
  'Engine URL not configured (set VITE_OMASEND_ENGINE_URL at build time)';

function resolveDefaultBaseUrl(): string | null {
  const configured = (import.meta.env.VITE_OMASEND_ENGINE_URL as string | undefined)?.trim();
  if (configured) return configured;
  // Under `vite dev`, window.location.origin is the Vite server, not an engine.
  if (import.meta.env.DEV) return null;
  // A production build served over http(s) by the engine itself talks to its own origin.
  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) {
    return window.location.origin;
  }
  return null;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function asPort(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 65536 ? v : undefined;
}

export class EngineClient {
  private baseUrl: string | null;

  constructor(baseUrl?: string) {
    const url = baseUrl ?? resolveDefaultBaseUrl();
    this.baseUrl = url ? url.replace(/\/+$/, '') : null;
  }

  getBaseUrl(): string | null {
    return this.baseUrl;
  }

  async getStatus(): Promise<EngineStatusResult> {
    if (!this.baseUrl) return { ok: false, reason: NOT_CONFIGURED_REASON };
    try {
      const resp = await fetch(`${this.baseUrl}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) {
        return { ok: false, reason: `Engine at ${this.baseUrl} answered HTTP ${resp.status}` };
      }
      const data: Record<string, unknown> = await resp.json();
      return {
        ok: true,
        status: {
          status: asString(data.status),
          port: asPort(data.port),
          version: asString(data.version),
          device_name: asString(data.device_name),
          mode: asString(data.mode),
          auth_required: typeof data.auth_required === 'boolean' ? data.auth_required : undefined,
        },
      };
    } catch {
      return { ok: false, reason: `Engine not reachable at ${this.baseUrl}` };
    }
  }

  async getDiscoveredDevices(): Promise<PeerInfo[]> {
    if (!this.baseUrl) return [];
    try {
      const resp = await fetch(`${this.baseUrl}/api/p2p/peers`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const rawPeers: unknown[] = Array.isArray(data?.peers) ? data.peers : [];
      return rawPeers
        .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
        .map((p) => ({
          id: asString(p.id) ?? asString(p.oma_id) ?? '',
          name: asString(p.name) ?? 'Unknown device',
          ip: asString(p.ip) ?? '',
          port: asPort(p.port) ?? 0,
          transport: asString(p.transport) ?? 'LAN',
        }));
    } catch {
      return [];
    }
  }
}
