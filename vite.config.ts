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

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [serviceWorker()],
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
