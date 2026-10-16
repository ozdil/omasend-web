/**
 * Optional in-page QR scanning with the browser's BarcodeDetector (no QR library is bundled).
 * BarcodeDetector exists only in some browsers (e.g. Chrome on Android) and, like the camera,
 * usually only in a secure context. The normal way to pair is to scan the desktop's QR code
 * with the phone's camera app, which opens this page with the link in the #pair= fragment.
 */
import { el } from './dom';
import type { Strings } from './i18n';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

function detectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

export function scanAvailable(): boolean {
  return detectorCtor() !== null;
}

/**
 * Shows a scanner in `modal` and resolves with the first QR code's text, or null when the user
 * closes it. Uses the live camera when getUserMedia is available, otherwise a photo picker.
 */
export async function scanQr(modal: HTMLElement, t: Strings): Promise<string | null> {
  const Ctor = detectorCtor();
  if (!Ctor) throw new Error('BarcodeDetector unavailable');
  const detector = new Ctor({ formats: ['qr_code'] });

  if (!navigator.mediaDevices?.getUserMedia) {
    return scanFromPhoto(detector);
  }

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  const video = el('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
  video.muted = true;
  video.srcObject = stream;
  return new Promise<string | null>((resolve) => {
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      stream.getTracks().forEach((tr) => tr.stop());
      modal.replaceChildren();
      resolve(value);
    };
    const closeBtn = el('button', { class: 'btn', type: 'button' }, t.cancel);
    closeBtn.addEventListener('click', () => finish(null));
    modal.replaceChildren(
      el(
        'div',
        { class: 'modal-backdrop' },
        el('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true' }, el('p', { class: 'muted' }, t.pairScanHint), video, el('div', { class: 'actions' }, closeBtn)),
      ),
    );
    const tick = async () => {
      if (done) return;
      try {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video);
          const hit = codes.find((c) => c.rawValue);
          if (hit) return finish(hit.rawValue);
        }
      } catch {
        // keep trying
      }
      setTimeout(() => void tick(), 300);
    };
    void video.play().catch(() => undefined);
    void tick();
  });
}

function scanFromPhoto(detector: BarcodeDetectorLike): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = el('input', { type: 'file', accept: 'image/*', capture: 'environment' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const bitmap = await createImageBitmap(file);
        const codes = await detector.detect(bitmap);
        resolve(codes.find((c) => c.rawValue)?.rawValue ?? '');
      } catch (e) {
        reject(e);
      }
    });
    input.click();
  });
}
