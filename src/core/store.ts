/**
 * Persistent state in IndexedDB (works in insecure contexts, unlike WebCrypto key storage).
 *
 * Honest note: the device seed is stored UNENCRYPTED in this browser profile. Anyone with access
 * to the profile can copy it and act as this browser towards the paired desktop.
 * "Forget this browser" deletes the whole database.
 */
import { deviceKeyFromSeed, generateSeed, type DeviceKey } from './protocol/devicekey';

const DB_NAME = 'omasend-web';
const STORE = 'kv';

export interface Profile {
  /** Name shown on the desktop (the engine keeps at most 64 characters). */
  name: string;
}

export interface Pairing {
  pk: string;
  name: string;
  deviceId: string;
  pairedAt: number;
  /** Local label only ("this is my device"); the desktop decides its own trust. */
  own: boolean;
  /**
   * The desktop's X25519 key for end-to-end encryption (b64url), verified against `pk`.
   * Missing on pairings made before encryption existed; fetched and verified on first use.
   */
  x25519?: string;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return req(db.transaction(STORE, 'readonly').objectStore(STORE).get(key)) as Promise<T | undefined>;
}

async function put(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await req(db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key));
}

async function del(key: string): Promise<void> {
  const db = await openDb();
  await req(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key));
}

/** Loads the device key, creating a random 32-byte seed on first use. */
export async function loadOrCreateDeviceKey(): Promise<DeviceKey> {
  const stored = await get<{ seed: Uint8Array }>('identity');
  if (stored && stored.seed instanceof Uint8Array && stored.seed.length === 32) {
    return deviceKeyFromSeed(stored.seed);
  }
  const seed = generateSeed();
  await put('identity', { seed, createdAt: Date.now() });
  return deviceKeyFromSeed(seed);
}

export async function loadOrCreateProfile(defaultName: string): Promise<Profile> {
  const stored = await get<Profile>('profile');
  // Older profiles also carried a random OmaID; it is no longer sent and simply dropped.
  if (stored && typeof stored.name === 'string' && stored.name.trim()) return { name: stored.name };
  const profile: Profile = { name: defaultName };
  await put('profile', profile);
  return profile;
}

export async function saveProfile(profile: Profile): Promise<void> {
  await put('profile', profile);
}

export async function loadPairing(): Promise<Pairing | null> {
  const p = await get<Pairing>('pairing');
  return p && typeof p.pk === 'string' ? p : null;
}

export async function savePairing(p: Pairing): Promise<void> {
  await put('pairing', p);
}

export async function forgetPairing(): Promise<void> {
  await del('pairing');
}

/** Deletes the device key, profile and pairing (and leftovers of the old localStorage client). */
export async function forgetBrowser(): Promise<void> {
  try {
    (await dbPromise)?.close();
  } catch {
    // ignore
  }
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    r.onblocked = () => resolve();
  });
  try {
    for (const k of ['omasend_active_oma_id', 'omasend_paired_peers_v1', 'omasend_clipboard_vault_v1', 'omasend_device_name']) {
      localStorage.removeItem(k);
    }
  } catch {
    // storage may be blocked
  }
}
