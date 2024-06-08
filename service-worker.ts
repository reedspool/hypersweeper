// Can't use self/globalThis directly currently,
// See https://github.com/microsoft/TypeScript/issues/11781#issuecomment-2019975124
// Note to self: Don't use just `serviceWorker` because that's an unsettable
// global already in this context :facepalm:
const serviceWorkerSelf: ServiceWorkerGlobalScope & typeof globalThis =
    self as any;

// Cookie utilities from PPK https://www.quirksmode.org/js/cookies.html
// Adapted to take in cookie as a parameter
function extractCookieByName(cookie: string, name: string) {
    var nameEQ = name + "=";
    var ca = cookie.split(";");
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == " ") c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// To refresh user's caches automatically, change the number in this name.
// That will cause `deleteOldCaches` to clean up the past one. So users might
// still need to refresh after that switch happens?
const CACHE_NAME = "minesweeper-service-worker-cache-v1";
// Adapted from an MDN example
const deleteOldCaches = async () => {
    const cacheKeepList = [CACHE_NAME];
    const keyList = await caches.keys();
    const cachesToDelete = keyList.filter(
        (key) => !cacheKeepList.includes(key),
    );
    await Promise.all(cachesToDelete.map((key) => caches.delete(key)));
};

// Adapted from
// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers#recovering_failed_requests
const putInCache: Cache["put"] = async (request, response) => {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
};

const cacheFirst = async (request: RequestInfo | URL) => {
    const responseFromCache = await caches.match(request);
    if (responseFromCache) {
        return responseFromCache;
    }
    const responseFromNetwork = await fetch(request);
    putInCache(request, responseFromNetwork.clone());
    return responseFromNetwork;
};

serviceWorkerSelf.addEventListener("install", async function (event) {
    console.log(
        `Service worker installed. Initiating cache ${CACHE_NAME}`,
        event,
    );

    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll([
                // TODO: Make index.html into a shell that can be cached and loaded instantly
                // "index.html"
                // Favicons
                "favicon.ico",
                "android-chrome-192x192.png",
                "android-chrome-512x512.png",
                "apple-touch-icon.png",
                "favicon-16x16.png",
                "favicon-32x32.png",
                "site.webmanifest",

                "site.css",
            ]);
        }),
    );

    // TODO: Not sure when skipWaiting is necessary.
    //       https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting
    serviceWorkerSelf.skipWaiting();
});

serviceWorkerSelf.addEventListener("activate", function (event) {
    console.log("Service worker activated", event);
    console.log("Service worker cleaning up old caches");
    event.waitUntil(deleteOldCaches());
    event.waitUntil(
        (async () => {
            if (serviceWorkerSelf.registration.navigationPreload) {
                await serviceWorkerSelf.registration.navigationPreload.enable();
                console.log("Service worker enabled navigation preload");
            }
        })(),
    );
    console.log("Service worker attempting to claim");
    event.waitUntil(serviceWorkerSelf.clients.claim());
});

serviceWorkerSelf.addEventListener("fetch", async function (event) {
    // Let the browser do its default thing for non-GET requests not matched above.
    if (event.request.method !== "GET") return;

    // Some things we want to cache after the first time we get them
    if (event.request.url.startsWith("https://unpkg.com/htmx.org")) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // Default, check the cache or just go with the original
    // Note that this is wrapped in an immediately invoked function
    // to get an encompassing promise for event.respondWith to wait for
    event.respondWith(
        (async function () {
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse) return cachedResponse;

            // Else, use the preloaded response, if it's there
            const response = await event.preloadResponse;
            if (response) return response;

            return fetch(event.request);
        })(),
    );
});
