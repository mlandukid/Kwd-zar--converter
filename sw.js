// Caches the app shell (the page itself, icons, manifest) so the app opens
// instantly even with no signal. Deliberately does NOT touch exchange-rate
// API requests — those go straight to the network as normal, and the app's
// own localStorage rate-caching already handles what happens when those
// fail offline. This worker only ever intercepts requests back to this
// same site.
//
// Bump CACHE_NAME (e.g. to "kwd-zar-shell-v2") whenever you push a change
// to index.html/manifest/icons, so returning visitors pick up the update
// instead of being stuck on an old cached copy.
var CACHE_NAME = "kwd-zar-shell-v1";
var SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);

  // Only handle same-origin GET requests (the app shell). Anything else —
  // in particular every exchange-rate API call, which is cross-origin —
  // is left completely alone and goes straight to the network.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var networkFetch = fetch(event.request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return cached;
        });
      // Serve the cached shell instantly if we have it (fast + offline-safe),
      // while quietly refreshing the cache in the background for next time.
      return cached || networkFetch;
    })
  );
});
