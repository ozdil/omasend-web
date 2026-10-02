/**
 * OmaSend Web Local & Secure Storage Vault
 */

import { OmaIdEngine } from './omaid';

export interface PairedPeer {
  omaId: string;
  name: string;
  ip?: string;
  pairedAt: number;
  lastSeen?: number;
}

export interface ClipboardItemRecord {
  id: string;
  sender: string;
  contentType: 'text' | 'image_png' | 'image_jpeg' | 'image_webp';
  text?: string;
  imageHash?: string;
  imageSize?: number;
  imageWidth?: number;
  imageHeight?: number;
  thumbnailBase64?: string;
  timestamp: number;
}

export type ClipboardItem = ClipboardItemRecord;

const PREF_OMA_ID = 'omasend_active_oma_id';
const PREF_PAIRED_PEERS = 'omasend_paired_peers_v1';
const PREF_CLIPBOARD_VAULT = 'omasend_clipboard_vault_v1';
const PREF_DEVICE_NAME = 'omasend_device_name';

export class StorageVault {
  /**
   * Gets or generates active OmaID
   */
  getOrCreateOmaId(): string {
    return StorageVault.getOrGenerateOmaId();
  }

  static getOrGenerateOmaId(): string {
    const stored = localStorage.getItem(PREF_OMA_ID);
    if (stored && OmaIdEngine.validate(stored)) {
      return OmaIdEngine.format(stored);
    }
    const newId = OmaIdEngine.generate();
    localStorage.setItem(PREF_OMA_ID, OmaIdEngine.normalize(newId));
    return newId;
  }

  /**
   * Saves custom OmaID
   */
  saveOmaId(omaId: string): boolean {
    return StorageVault.saveOmaId(omaId);
  }

  static saveOmaId(omaId: string): boolean {
    if (!OmaIdEngine.validate(omaId)) return false;
    const formatted = OmaIdEngine.format(omaId);
    localStorage.setItem(PREF_OMA_ID, OmaIdEngine.normalize(formatted));
    return true;
  }

  /**
   * Gets local device name or default
   */
  getDeviceName(): string {
    return StorageVault.getDeviceName();
  }

  static getDeviceName(): string {
    return localStorage.getItem(PREF_DEVICE_NAME) || 'OmaSend Web Client';
  }

  setDeviceName(name: string): void {
    StorageVault.setDeviceName(name);
  }

  static setDeviceName(name: string): void {
    if (name && name.trim()) {
      localStorage.setItem(PREF_DEVICE_NAME, name.trim());
    }
  }

  /**
   * Gets list of paired OmaID peers
   */
  getPairedPeers(): PairedPeer[] {
    return StorageVault.getPairedPeers();
  }

  static getPairedPeers(): PairedPeer[] {
    try {
      const raw = localStorage.getItem(PREF_PAIRED_PEERS);
      if (!raw) return [];
      return JSON.parse(raw) as PairedPeer[];
    } catch {
      return [];
    }
  }

  /**
   * Adds or updates a paired peer
   */
  addPairedPeer(peer: { omaId: string; name?: string; ip?: string; pairedAt?: number }): PairedPeer | null {
    return StorageVault.addPairedPeer(peer.omaId, peer.name || '', peer.ip);
  }

  static addPairedPeer(omaId: string, name: string, ip?: string): PairedPeer | null {
    if (!OmaIdEngine.validate(omaId)) return null;
    const formatted = OmaIdEngine.format(omaId);
    const peers = this.getPairedPeers();
    const existingIndex = peers.findIndex(p => OmaIdEngine.normalize(p.omaId) === OmaIdEngine.normalize(omaId));

    const record: PairedPeer = {
      omaId: formatted,
      name: name || `Device-${OmaIdEngine.normalize(omaId).slice(0, 4)}`,
      ip: ip || (existingIndex >= 0 ? peers[existingIndex].ip : undefined),
      pairedAt: existingIndex >= 0 ? peers[existingIndex].pairedAt : Date.now(),
      lastSeen: Date.now(),
    };

    if (existingIndex >= 0) {
      peers[existingIndex] = record;
    } else {
      peers.push(record);
    }

    localStorage.setItem(PREF_PAIRED_PEERS, JSON.stringify(peers));
    return record;
  }

  /**
   * Removes a paired peer
   */
  removePairedPeer(omaId: string): boolean {
    return StorageVault.removePairedPeer(omaId);
  }

  static removePairedPeer(omaId: string): boolean {
    const peers = this.getPairedPeers();
    const filtered = peers.filter(p => OmaIdEngine.normalize(p.omaId) !== OmaIdEngine.normalize(omaId));
    localStorage.setItem(PREF_PAIRED_PEERS, JSON.stringify(filtered));
    return filtered.length !== peers.length;
  }

  /**
   * Gets clipboard records
   */
  getClipboardItems(): ClipboardItemRecord[] {
    return StorageVault.getClipboardItems();
  }

  static getClipboardItems(): ClipboardItemRecord[] {
    try {
      const raw = localStorage.getItem(PREF_CLIPBOARD_VAULT);
      if (!raw) return [];
      return JSON.parse(raw) as ClipboardItemRecord[];
    } catch {
      return [];
    }
  }

  /**
   * Pushes a clipboard record
   */
  addClipboardItem(item: ClipboardItemRecord): void {
    StorageVault.addClipboardItem(item);
  }

  static addClipboardItem(item: ClipboardItemRecord): void {
    const items = this.getClipboardItems();
    const filtered = items.filter(x => x.id !== item.id && (item.text ? x.text !== item.text : true));
    filtered.unshift(item);
    if (filtered.length > 50) filtered.length = 50;
    localStorage.setItem(PREF_CLIPBOARD_VAULT, JSON.stringify(filtered));
  }
}

export const LocalStorageVault = StorageVault;
