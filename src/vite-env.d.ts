/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Explicit OmaSend engine base URL, e.g. http://127.0.0.1:53317 */
  readonly VITE_OMASEND_ENGINE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** package.json version, injected by vite.config.ts `define`. */
declare const __APP_VERSION__: string;
