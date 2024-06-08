// Can't use self/globalThis directly currently,
// See https://github.com/microsoft/TypeScript/issues/11781#issuecomment-2019975124
// Note to self: Don't use just `serviceWorker` because that's an unsettable

import { DEFAULTS, newGrid, select } from "./game";
import { GameState } from "./html";
import {
    cellListToGameState,
    gameStateToHtml,
    gridToHtml,
    queryToSettings,
} from "./munge";
import type { GridCell } from "./types";
import { cookieName } from "./web";

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
    const url = new URL(event.request.url);
    if (url.pathname.endsWith("newGame.html")) {
        event.respondWith(
            (async function () {
                const url = new URL(event.request.url);
                const query: { [key in string]: unknown } = {
                    cols: url.searchParams.get("cols"),
                    rows: url.searchParams.get("rows"),
                    mines: url.searchParams.get("mines"),
                };

                const settings = queryToSettings(query);

                // If service worker was installed cross-origin, wouldn't have
                if (event.clientId) {
                    const client = await serviceWorkerSelf.clients.get(
                        event.clientId,
                    );
                    // Client might not exist e.g. if closed
                    if (client)
                        client.postMessage({
                            type: "set-cookie",
                            cookieName,
                            cookieValue: settings,
                        });
                }

                const headers = new Headers();
                const response = new Response(gridToHtml(newGrid(settings)), {
                    status: 200,
                    statusText: "OK",
                    headers,
                });
                return response;
            })(),
        );
        return;
    }
    if (event.request.url.endsWith("reveal.html")) {
        event.respondWith(
            (async function () {
                const formData = await event.request.formData();
                const state = cellListToGameState(
                    formData
                        .getAll("grid__cell")
                        .map((value) => JSON.parse(value as string)),
                );

                const selectedDataString = formData.get("selected");
                if (typeof selectedDataString !== "string") throw Error();
                const selectedParsed: GridCell = JSON.parse(selectedDataString);
                select(state, selectedParsed);
                const headers = new Headers();
                const response = new Response(
                    GameState({
                        contents: gridToHtml(state.grid),
                        stateMessage: gameStateToHtml(state.state),
                    }),
                    {
                        status: 200,
                        statusText: "OK",
                        headers,
                    },
                );
                return response;
            })(),
        );
        return;
    }

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
