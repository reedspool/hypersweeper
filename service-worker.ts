// Can't use self/globalThis directly currently,
// See https://github.com/microsoft/TypeScript/issues/11781#issuecomment-2019975124
// Note to self: Don't use just `serviceWorker` because that's an unsettable

import { newGrid, select } from "./game";
import { GameState } from "./html";
import {
    cellListToGameState,
    gameStateToHtml,
    gridToHtml,
    queryToSettings,
} from "./munge";
import { handleIndex, handleNewGame, handleReveal } from "./server";
import type {
    GridCell,
    MyMiddlewareHandler,
    MyRequest,
    MyRequestHandler,
    MyResponse,
} from "./types";
import { wait } from "./utilities";
import { cookieName, extractCookieByName } from "./web";

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
                await serviceWorkerSelf.registration.navigationPreload.enable();
                console.log("Service worker enabled navigation preload");
            }
        })(),
    );
    console.log("Service worker attempting to claim");
    event.waitUntil(serviceWorkerSelf.clients.claim());
});

interface Worxpress {
    (serviceWorkerSelf: ServiceWorkerGlobalScope): {
        get: (path: string, handler: MyRequestHandler) => void;
        post: (path: string, handler: MyRequestHandler) => void;
        use: (handler: MyMiddlewareHandler) => void;
    };
    static: (path: string) => MyMiddlewareHandler;
}
const ALL_PATHS = -1;
const worxpress: Worxpress = (serviceWorkerSelf: ServiceWorkerGlobalScope) => {
    const middlewares: {
        path: string | typeof ALL_PATHS;
        handler: MyRequestHandler | MyMiddlewareHandler;
        method: "get" | "post" | "all";
    }[] = [];

    serviceWorkerSelf.addEventListener("fetch", async function (event) {
        const url = new URL(event.request.url);
        console.log({
            url,
            locationOrigin: location.origin,
            originsMatch: location.origin === url.origin,
            pathname: url.pathname,
            original: event.request.url,
            matches: url.pathname.match(new RegExp("^" + "/" + "$")),
        });
        const middlewaresTemp = [...middlewares];

        return event.respondWith(
            new Promise(async function (resolveResponseBody) {
                try {
                    // TODO: Would love for these to go in my proxy and only be accessed
                    // on demand but my proxy isn't async. Would be cool if you could
                    // transparently use async code in sync code via proxy magic...
                    // someday project
                    const cookie = await cookieValuePromise;
                    // const cookie = null;
                    let formData: FormData | [];
                    try {
                        formData =
                            event.request.method.toLowerCase() === "post"
                                ? await event.request.formData()
                                : [];
                    } catch (error) {
                        console.log("Form data couldn't be done ", error);
                        formData = [];
                    }
                    const request: MyRequest = new Proxy(event.request, {
                        get(target, prop) {
                            console.log(`Request accessing ${prop.toString()}`);
                            if (prop === "query") {
                                const query: MyRequest["query"] = {};
                                url.searchParams.forEach((value, key) => {
                                    query[key] = value;
                                });
                                return query;
                            }
                            if (prop === "body") {
                                const body: MyRequest["body"] = {};
                                formData.forEach((value, key) => {
                                    if (
                                        typeof value !== "string" &&
                                        !Array.isArray(value)
                                    )
                                        // TODO Not sure how to handle files
                                        throw new Error(
                                            `POST body values other than strings not yet implemented`,
                                        );
                                    let prior = body[key];
                                    if (typeof prior === "string")
                                        body[key] = [prior];
                                    prior = body[key];
                                    if (Array.isArray(prior)) {
                                        if (typeof value !== "string")
                                            // TODO Not sure how to handle files
                                            throw new Error(
                                                `POST body values other than strings not yet implemented`,
                                            );
                                        prior.push(value);
                                    } else {
                                        body[key] = value;
                                    }
                                });
                                return body;
                            }
                            if (prop === "cookies")
                                return { [cookieName]: cookie };
                            if (prop === "url") return event.request.url;
                            if (prop === "originalEvent") return event;
                            throw new Error(
                                `Sorry, accessing request.${prop.toString()} is not yet implemented.`,
                            );
                        },
                        set(target, prop, value) {
                            throw new Error(
                                "Mutating the request object is not yet implemented",
                            );
                        },
                        // TODO: How can I fix this forcing of types? It seems strange
                        // to me that TypeScript can't do any better, but that probably
                        // means I'm using it wrong
                    }) as unknown as MyRequest;

                    const headers = new Headers();
                    const response: MyResponse = new Proxy(
                        {},
                        {
                            get(target, prop) {
                                if (prop === "cookie") {
                                    return async function (
                                        name: string,
                                        contents: string,
                                        options: Record<string, unknown>,
                                    ) {
                                        // If service worker was installed cross-origin, wouldn't have
                                        if (event.clientId) {
                                            const client =
                                                await serviceWorkerSelf.clients.get(
                                                    event.clientId,
                                                );
                                            // Client might not exist e.g. if closed
                                            if (client)
                                                client.postMessage({
                                                    type: "set-cookie",
                                                    cookieName,
                                                    cookieValue: contents,
                                                    // TODO: This is ignored in the receiver currently
                                                    options,
                                                });
                                        }
                                    };
                                }
                                if (prop === "set") {
                                    return function (
                                        objOrKey:
                                            | Record<string, string>
                                            | string,
                                        nothingOrValue?: string,
                                    ) {
                                        if (typeof objOrKey === "string") {
                                            if (
                                                typeof nothingOrValue ===
                                                "string"
                                            ) {
                                                headers.set(
                                                    objOrKey,
                                                    nothingOrValue,
                                                );
                                            } else {
                                                headers.delete(objOrKey);
                                            }
                                        } else {
                                            Object.entries(objOrKey).forEach(
                                                ([key, value]) => {
                                                    headers.set(key, value);
                                                },
                                            );
                                        }
                                    };
                                }
                                if (prop === "send") {
                                    return function (responseBody: string) {
                                        headers.set(
                                            "Content-Type",
                                            "text/html",
                                        );
                                        const response = new Response(
                                            responseBody,
                                            {
                                                status: 200,
                                                statusText: "OK",
                                                headers,
                                            },
                                        );
                                        return resolveResponseBody(response);
                                    };
                                }
                                if (prop === "rawResponse") {
                                    return function (response: Response) {
                                        return resolveResponseBody(response);
                                    };
                                }
                                throw new Error(
                                    `Sorry, accessing response.${prop.toString()} is not yet implemented.`,
                                );
                            },
                            set(target, prop, value) {
                                throw new Error(
                                    "Mutating the response object is not yet implemented",
                                );
                            },
                        },
                    ) as unknown as MyResponse; // means I'm using it wrong // to me that TypeScript can't do any better, but that probably // TODO: How can I fix this forcing of types? It seems strange
                    async function doNextThing(_: any): Promise<void> {
                        const first = middlewaresTemp.shift();

                        if (!first) {
                            // Default, check the cache or just go with the original
                            // Note that this is wrapped in an immediately invoked function
                            // to get an encompassing promise for event.respondWith to wait for
                            const cachedResponse = await caches.match(
                                event.request,
                            );
                            if (cachedResponse)
                                return resolveResponseBody(cachedResponse);

                            // Else, use the preloaded response, if it's there
                            const response = await event.preloadResponse;
                            if (response) return resolveResponseBody(response);

                            return resolveResponseBody(fetch(event.request));
                        }
                        if (first.path === ALL_PATHS) {
                            return first.handler(request, response, () =>
                                doNextThing(resolveResponseBody),
                            );
                        } else if (
                            first.method.toLowerCase() ===
                                event.request.method.toLowerCase() &&
                            url.origin === location.origin &&
                            url.pathname.match(
                                new RegExp("^" + first.path + "$"),
                            )
                        ) {
                            return first.handler(request, response, () => {
                                console.error(
                                    "I don't think next is supported on Express app.get/app.post/etc but I'm not sure?",
                                );
                                doNextThing(resolveResponseBody);
                            });
                        } else {
                            doNextThing(resolveResponseBody);
                        }
                    }
                    await doNextThing(resolveResponseBody);
                } catch (error) {
                    console.error(
                        "Error in service worker worxpress response",
                        error,
                    );
                    const headers = new Headers();
                    const response = new Response("501", {
                        status: 501,
                        statusText: "Service Worker Failed",
                        headers,
                    });
                    return resolveResponseBody(response);
                }
            }),
        );
    });

    return {
        get: (path: string, handler: MyRequestHandler) => {
            middlewares.push({ path, handler, method: "get" });
        },
        post: (path: string, handler: MyRequestHandler) => {
            middlewares.push({ path, handler, method: "post" });
        },
        use: (handler: MyMiddlewareHandler) => {
            middlewares.push({ path: ALL_PATHS, handler, method: "all" });
        },
    };
};

worxpress.static = () => (req, res, next) => {
    console.warn(`Static function called, not yet implemented, for ${req.url}`);
    next();
};

const app = worxpress(serviceWorkerSelf);

app.get("/", handleIndex);
app.get("/newGame.html", handleNewGame);
app.post("/reveal.html", handleReveal);

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

let resolveCookiePromise: (str: string) => void;
const cookieValuePromise = Promise.race([
    new Promise<string>((resolve) => (resolveCookiePromise = resolve)),
    wait(1000),
]);
cookieValuePromise.then((result) =>
    console.log(`Cookie value promise resolved with '${result}'`),
);
serviceWorkerSelf.addEventListener("message", async (event) => {
    // TODO: This is apparently a security risk but I don't understand why
    //       I mean this is a reasonable argument https://stackoverflow.com/a/59152482
    //       But I don't understand how MY service worker can be malicious untrusted code
    //       since it has to load from my same origin?
    if (event?.data?.type !== "be-nice-with-my-cookies") return;
    try {
        resolveCookiePromise(JSON.parse(decodeURIComponent(event.data.cookie)));
    } catch (error) {
        console.error("Cookie passing failed", error);
    }
});

cookieValuePromise.then((cookie) => console.log("my cookie? ", cookie));
