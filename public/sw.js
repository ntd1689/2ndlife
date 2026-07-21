// Minimal, conservative service worker for the 2ndLife PWA.
// - Satisfies installability (has a fetch handler).
// - Serves an offline fallback page for navigations when the network is down.
// - Deliberately does NOT cache API, auth, or dynamic responses — this is a
//   live marketplace, so stale data/sessions would be worse than a network trip.
//   Static assets are left to the browser's normal HTTP cache.

const CACHE = "2ndlife-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only take over top-level navigations; everything else goes to the network.
  if (req.method === "GET" && req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
