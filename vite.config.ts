import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const APP_VERSION = pkg.version;

/** Emits dist/sw.js from src/service-worker.js with the app version baked in. */
function serviceWorker(): Plugin {
  return {
    name: 'omasend-sw',
    apply: 'build',
    generateBundle() {
      const source = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8')
        .replaceAll('__APP_VERSION__', JSON.stringify(APP_VERSION));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

/**
 * index.html carries the production CSP.
 * - build: if VITE_OMASEND_ENGINE_URL points outside the default local
 *   origins, add its origin to connect-src so the configured engine works.
 * - dev: drop the CSP meta, because the Vite dev server relies on inline
 *   style injection and an HMR websocket.
 */
function contentSecurityPolicy(): Plugin {
  let engineOrigin: string | null = null;
  let isDev = false;
  return {
    name: 'omasend-csp',
    configResolved(config) {
      isDev = config.command === 'serve' && !config.isProduction;
      const raw = config.env.VITE_OMASEND_ENGINE_URL;
      if (typeof raw === 'string' && raw.trim()) {
        engineOrigin = new URL(raw.trim()).origin;
      }
    },
    transformIndexHtml(html) {
      if (isDev) {
        return html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
      }
      if (engineOrigin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(engineOrigin)) {
        return html.replace(/connect-src 'self'/, `connect-src 'self' ${engineOrigin}`);
      }
      return html;
    },
  };
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [serviceWorker(), contentSecurityPolicy()],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
  },
});
