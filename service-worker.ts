import { setupApp } from "./server";
import { cookieName } from "./web";
import { worxpress } from "./worxpress";

// Can't use self/globalThis directly currently,
// See https://github.com/microsoft/TypeScript/issues/11781#issuecomment-2019975124
// Note to self: Don't use just `serviceWorker` because that's an unsettable
// global already in this context :facepalm:
const serviceWorkerSelf: ServiceWorkerGlobalScope & typeof globalThis =
    self as any;

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
                // "index.html",
                // Favicons
                "favicon.ico",
                "android-chrome-192x192.png",
                "android-chrome-512x512.png",
                "apple-touch-icon.png",
                "favicon-16x16.png",
                "favicon-32x32.png",
                "site.webmanifest",

                // Client JS
                "browserEntry.js",

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
                // Trying to handle index page in service worker,
                // so navigation preload is wasted resources
                // await serviceWorkerSelf.registration.navigationPreload.enable();
                // console.log("Service worker enabled navigation preload");
            }
        })(),
    );
    console.log("Service worker attempting to claim");
    event.waitUntil(serviceWorkerSelf.clients.claim());
});

const app = worxpress({ serviceWorkerSelf, cookieName });

setupApp(app);

app.use(async (req, res, next) => {
    if (req.url.startsWith("https://unpkg.com/htmx.org")) {
        const originalRequest = req.originalEvent?.request;
        if (!originalRequest)
            throw new Error("Ran originalEvent code in wrong context");
        if (!res.rawResponse)
            throw new Error("Ran originalEvent code in wrong context");
        res.set("Content-Type", "text/html");
        res.rawResponse(await cacheFirst(originalRequest));
    }

    next();
});

// TODO Can static always mean "cache aggressively?" any static stuff I wouldn't
// want to cache?
app.use(worxpress.static("public"));
