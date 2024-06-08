// service-worker.ts
var serviceWorkerSelf = self;
var CACHE_NAME = "minesweeper-service-worker-cache-v1";
var deleteOldCaches = async () => {
  const cacheKeepList = [CACHE_NAME];
  const keyList = await caches.keys();
  const cachesToDelete = keyList.filter((key) => !cacheKeepList.includes(key));
  await Promise.all(cachesToDelete.map((key) => caches.delete(key)));
};
var putInCache = async (request, response) => {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
};
var cacheFirst = async (request) => {
  const responseFromCache = await caches.match(request);
  if (responseFromCache) {
    return responseFromCache;
  }
  const responseFromNetwork = await fetch(request);
  putInCache(request, responseFromNetwork.clone());
  return responseFromNetwork;
};
serviceWorkerSelf.addEventListener("install", async function(event) {
  console.log(`Service worker installed. Initiating cache ${CACHE_NAME}`, event);
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
    return cache.addAll([
      "favicon.ico",
      "android-chrome-192x192.png",
      "android-chrome-512x512.png",
      "apple-touch-icon.png",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "site.webmanifest",
      "site.css"
    ]);
  }));
  serviceWorkerSelf.skipWaiting();
});
serviceWorkerSelf.addEventListener("activate", function(event) {
  console.log("Service worker activated", event);
  console.log("Service worker cleaning up old caches");
  event.waitUntil(deleteOldCaches());
  event.waitUntil((async () => {
    if (serviceWorkerSelf.registration.navigationPreload) {
      await serviceWorkerSelf.registration.navigationPreload.enable();
      console.log("Service worker enabled navigation preload");
    }
  })());
  console.log("Service worker attempting to claim");
  event.waitUntil(serviceWorkerSelf.clients.claim());
});
serviceWorkerSelf.addEventListener("fetch", async function(event) {
  if (event.request.method !== "GET")
    return;
  if (event.request.url.startsWith("https://unpkg.com/htmx.org")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  event.respondWith(async function() {
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse)
      return cachedResponse;
    const response = await event.preloadResponse;
    if (response)
      return response;
    return fetch(event.request);
  }());
});
