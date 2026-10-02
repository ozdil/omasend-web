/**
 * OmaSend Universal Clipboard & WebP Thumbnail Generator
 */

import { StorageVault, ClipboardItemRecord } from '../identity/storage';

export class ClipboardVault {
  private vault: StorageVault;

  constructor(vault?: StorageVault) {
    this.vault = vault || new StorageVault();
  }

  async pushText(text: string, sender: string = 'Web Client'): Promise<ClipboardItemRecord> {
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
