import './style.css';
import { OmaSendApp } from './ui/app';

document.addEventListener('DOMContentLoaded', async () => {
  const app = new OmaSendApp();
  await app.init();

  // The service worker is only built for production (see vite.config.ts).
  if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch(() => {
        // Service worker unavailable; the app still works online.
      });
  }
});
