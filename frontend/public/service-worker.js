/* Marsol MMS — Service Worker
 *
 * Strategy:
 *   - Precache the app shell (HTML / manifest / icons) at install time so the
 *     PWA can launch offline with branded UI.
 *   - Network-first for /api/* (data is fast-moving; fall back to cache only
 *     if the network fails AND we have a previous response).
 *   - Cache-first for static assets (JS, CSS, images, fonts) — they are
 *     hashed/fingerprinted by CRA so a new build → new URL.
 *   - Navigation requests (HTML) → network-first, fallback to cached
 *     index.html so deep-links work offline.
 */

const VERSION = 'mms-v3-safearea';
const APP_SHELL = `mms-shell-${VERSION}`;
const RUNTIME = `mms-runtime-${VERSION}`;
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-32.png',
  '/favicon-64.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

const isApiRequest = (url) => url.pathname.startsWith('/api/');
const isStaticAsset = (url) =>
  /\.(?:js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // API → network-first, fallback to cache
  if (isApiRequest(url) && url.origin !== self.location.origin) {
    // cross-origin /api/* hits the backend ingress — let the browser handle it
    // but still apply network-first
  }
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(request, copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Navigation → network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets → cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy)).catch(() => null);
            return res;
          })
      )
    );
    return;
  }

  // Anything else — try network, fall back to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Allow the page to trigger an immediate update via postMessage('SKIP_WAITING')
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
