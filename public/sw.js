const CACHE = "meteoverso-v3";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Don't cache API calls - just pass through
self.addEventListener("fetch", e => {
  const url = e.request.url;
  // Skip API calls entirely
  if (url.includes('api.') || url.includes('opendata.') || url.includes('open-meteo') || url.includes('nominatim') || url.includes('tilecache')) {
    return;
  }
  // For everything else, network first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
