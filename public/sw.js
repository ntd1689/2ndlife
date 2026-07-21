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

// Web Push: show the notification the server sent.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { /* non-JSON */ }
  const title = data.title || "2ndLife";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    })
  );
});

// Focus an existing tab (or open one) at the notification's target URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && "focus" in w) return w.focus();
      }
      if (wins.length && "focus" in wins[0]) {
        wins[0].focus();
        if ("navigate" in wins[0]) return wins[0].navigate(url);
        return;
      }
      return self.clients.openWindow(url);
    })
  );
});
