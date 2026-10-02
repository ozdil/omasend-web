import './style.css';
import { OmaSendApp } from './ui/app';

document.addEventListener('DOMContentLoaded', async () => {
  const app = new OmaSendApp();
  await app.init();

  // Register service worker if available
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline fallback
    });
  }
});
