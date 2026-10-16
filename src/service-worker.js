/*
 * OmaSend Web service worker.
 * Built by the `omasend-sw` plugin in vite.config.ts, which replaces
 * the version placeholder with the package.json version and emits dist/sw.js.
 *
 * Strategy:
 *  - navigations: network-first; offline fallback to the cached index.html
 *  - hashed build assets (assets/*-<hash>.*): cache-first (immutable)
 *  - other same-origin GETs: network-first, cached copy only when offline
 *  - old caches are deleted on activate
 */
const VERSION = __APP_VERSION__;
const CACHE_PREFIX = 'omasend-web-';
const CACHE_NAME = `${CACHE_PREFIX}v${VERSION}`;

const SCOPE = self.registration.scope;
const INDEX_URL = new URL('index.html', SCOPE).href;
const ASSETS_PREFIX = new URL('assets/', SCOPE).href;
const PRECACHE = [
  INDEX_URL,
  new URL('manifest.webmanifest', SCOPE).href,
  new URL('favicon.svg', SCOPE).href,
  new URL('icon-192.png', SCOPE).href,
  new URL('icon-512.png', SCOPE).href,
];

const HASHED_ASSET = /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|svg|webp|jpg)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function putInCache(key, response) {
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, response);
  }
}

async function navigationNetworkFirst(event) {
  try {
    const response = await fetch(event.request);
    event.waitUntil(putInCache(INDEX_URL, response.clone()));
    return response;
  } catch {
    const cached = await caches.match(INDEX_URL);
    return cached || Response.error();
  }
}

async function cacheFirst(event) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  event.waitUntil(putInCache(event.request, response.clone()));
  return response;
}

async function networkFirst(event) {
  try {
    return await fetch(event.request);
  } catch {
    const cached = await caches.match(event.request);
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept cross-origin requests (e.g. a configured engine URL).
  if (url.origin !== self.location.origin) return;
  // Never intercept engine API / websocket paths when served by the engine.
  if (url.pathname.includes('/api/') || url.pathname.startsWith('/ws')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationNetworkFirst(event));
  } else if (url.href.startsWith(ASSETS_PREFIX) && HASHED_ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(event));
  } else {
    event.respondWith(networkFirst(event));
  }
});
