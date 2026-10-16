import './style.css';
import { OmaSendApp } from './ui/app';

document.addEventListener('DOMContentLoaded', () => {
  void new OmaSendApp().init();

  // Service workers need a secure context. The engine usually serves this page over plain
  // http on a LAN address, where registration is skipped silently; the app works without it.
  if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch(() => {
        // Service worker unavailable; the app still works online.
      });
  }
});
