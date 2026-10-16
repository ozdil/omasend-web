/**
 * OmaSend Universal Clipboard & WebP Thumbnail Generator
 */

import { StorageVault, ClipboardItemRecord } from '../identity/storage';

export class ClipboardVault {
  private vault: StorageVault;

  constructor(vault?: StorageVault) {
    this.vault = vault || new StorageVault();
  }

  /**
   * Sensitive Clipboard Shield: Heuristics to detect passwords, keys, and tokens
   */
  static isSensitivePayload(text: string): boolean {
    const t = text.trim();
    if (!t) return false;

    // 1. Private keys and certificates
    if (
      t.includes('BEGIN PRIVATE KEY') ||
      t.includes('BEGIN RSA PRIVATE KEY') ||
      t.includes('BEGIN OPENSSH PRIVATE KEY') ||
      t.includes('BEGIN PGP PRIVATE KEY') ||
      t.includes('BEGIN CERTIFICATE')
    ) {
      return true;
    }

    // 2. High entropy API tokens and cloud credentials
    if (
      t.startsWith('ghp_') || t.startsWith('gho_') || t.startsWith('ghu_') || t.startsWith('ghs_') ||
      t.startsWith('glpat-') || t.startsWith('sk_live_') || t.startsWith('rk_live_') ||
      t.startsWith('AIzaSy') || t.startsWith('AKIA') || t.startsWith('ASIA') ||
      t.startsWith('xoxb-') || t.startsWith('xoxp-') ||
      (t.startsWith('eyJ') && (t.match(/\./g) || []).length === 2)
    ) {
      return true;
    }

    // 3. BIP-39 mnemonic seed phrases (12 or 24 words)
    const words = t.split(/\s+/);
    if ((words.length === 12 || words.length === 24) && words.every(w => /^[a-z]+$/.test(w))) {
      return true;
    }

    // 4. Typical high-entropy password/token heuristic (20-128 chars without spaces)
    if (!t.includes(' ') && !t.includes('\n') && !t.includes('/') && !t.includes('.') && t.length >= 20 && t.length <= 128) {
      const hasUpper = /[A-Z]/.test(t);
      const hasLower = /[a-z]/.test(t);
      const hasDigit = /[0-9]/.test(t);
      const hasSpecial = /[!@#$%^&*()\-_=+[\]{}|;:,<>?]/.test(t);
      if (hasUpper && hasLower && hasDigit && hasSpecial) {
        return true;
      }
    }

    return false;
  }

  async pushText(text: string, sender: string = 'Web Client'): Promise<ClipboardItemRecord | null> {
    if (ClipboardVault.isSensitivePayload(text)) {
      return null;
    }
    const item: ClipboardItemRecord = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: sender,
      contentType: 'text',
      text: text,
      timestamp: Date.now(),
    };
    this.vault.addClipboardItem(item);
    return item;
  }

  async pushImage(file: File | Blob, sender: string = 'Web Client'): Promise<ClipboardItemRecord> {
    const thumb = await ClipboardManager.generateWebpThumbnail(file);
    const item: ClipboardItemRecord = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: sender,
      contentType: 'image_webp',
      text: `[Image ${thumb.width}x${thumb.height}]`,
      thumbnailBase64: thumb.dataUrl,
      imageWidth: thumb.width,
      imageHeight: thumb.height,
      imageSize: file.size,
      timestamp: Date.now(),
    };
    this.vault.addClipboardItem(item);
    return item;
  }
}

export class ClipboardManager {
  /**
   * Generates a compact WebP micro-thumbnail (< 8 KB) using OffscreenCanvas
   */
  static async generateWebpThumbnail(imageBlob: Blob): Promise<{ dataUrl: string; width: number; height: number }> {
    const bitmap = await createImageBitmap(imageBlob);
    const origW = bitmap.width;
    const origH = bitmap.height;

    const maxDim = 96;
    let targetW = origW;
    let targetH = origH;
    if (origW > maxDim || origH > maxDim) {
      if (origW > origH) {
        targetW = maxDim;
        targetH = Math.round((origH * maxDim) / origW);
      } else {
        targetH = maxDim;
        targetW = Math.round((origW * maxDim) / origH);
      }
    }

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const thumbBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.75 });
    const arrayBuf = await thumbBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);

    return {
      dataUrl: `data:image/webp;base64,${b64}`,
      width: origW,
      height: origH,
    };
  }

  /**
   * Reads text from system clipboard if permissions allowed
   */
  static async readSystemClipboardText(): Promise<string | null> {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      }
    } catch {
      // Permission denied
    }
    return null;
  }

  /**
   * Writes text to system clipboard
   */
  static async writeSystemClipboardText(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback
    }
    return false;
  }
}
