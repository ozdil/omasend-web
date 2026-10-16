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
 * index.html carries the production CSP (connect-src 'self': the app only talks to the engine
 * that serves it, at http://<desktop>:53317/web/). Under the Vite dev server the CSP meta is
 * dropped, because the dev server relies on inline style injection and an HMR websocket.
 */
function contentSecurityPolicy(): Plugin {
  let isDev = false;
  return {
    name: 'omasend-csp',
    configResolved(config) {
      isDev = config.command === 'serve' && !config.isProduction;
    },
    transformIndexHtml(html) {
      return isDev ? html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '') : html;
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
    // `npm run dev` talks to a local engine (or e2e/mock-engine.mjs) through the dev server.
    proxy: { '/api': process.env.OMASEND_ENGINE ?? 'http://127.0.0.1:53317' },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
  },
});
