/*
 * Express mimick but for service workers
 */
import type {
    MyMiddlewareHandler,
    MyRequest,
    MyRequestHandler,
    MyResponse,
} from "./types";
import { wait } from "./utilities";

export type WorxpressApp = {
    get: (path: string, handler: MyRequestHandler) => void;
    post: (path: string, handler: MyRequestHandler) => void;
    use: (handler: MyMiddlewareHandler) => void;
};
interface Worxpress {
    (args: {
        serviceWorkerSelf: ServiceWorkerGlobalScope;
        cookieName: string;
    }): WorxpressApp;
    static: (path: string) => MyMiddlewareHandler;
}
const ALL_PATHS = -1;
export const worxpress: Worxpress = ({ serviceWorkerSelf, cookieName }) => {
    const middlewares: {
        path: string | typeof ALL_PATHS;
        handler: MyRequestHandler | MyMiddlewareHandler;
        method: "get" | "post" | "all";
    }[] = [];

    serviceWorkerSelf.addEventListener("fetch", async function (event) {
        const url = new URL(event.request.url);
        const middlewaresTemp = [...middlewares];

        return event.respondWith(
            new Promise(async function (resolveResponseBody) {
                try {
                    // TODO: Would love for these to go in my proxy and only be accessed
                    // on demand but my proxy isn't async. Would be cool if you could
                    // transparently use async code in sync code via proxy magic...
                    // someday project
                    //
                    // Wait a moment to receive the cookie value from the main
                    // thread
                    await coldStartookieValuePromise;
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
                        get(_target, prop) {
                            if (prop === "context") {
                                return "serviceWorker";
                            }

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
                                return { [cookieName]: receivedCookieValue };
                            if (prop === "url") return event.request.url;
                            if (prop === "originalEvent") return event;
                            throw new Error(
                                `Sorry, accessing request.${prop.toString()} is not yet implemented.`,
                            );
                        },
                        set(_target, _prop, _value) {
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
                            get(_target, prop) {
                                if (prop === "cookie") {
                                    return async function (
                                        name: string,
                                        contents: string,
                                        options: Record<string, unknown>,
                                    ) {
                                        if (name !== cookieName)
                                            throw new Error(
                                                "Setting cookie other than the one configured is not yet supported",
                                            );

                                        receivedCookieValue = contents;

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
                            set(_target, _prop, _value) {
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

    // When the service worker starts cold, i.e. when it's already installed but it
    // stopped due to inactivity, it won't have this cookie value in memory and it
    // will need to get it from the main thread code
    let receivedCookieValue: null | string = null;
    let resolveColdStartCookiePromise: ((str: string) => void) | null;
    const coldStartookieValuePromise = Promise.race([
        new Promise<string>(
            (resolve) => (resolveColdStartCookiePromise = resolve),
        ),
        wait(1000),
    ]);
    coldStartookieValuePromise.then((result) =>
        console.log(`Cookie value promise resolved with '${result}'`),
    );
    serviceWorkerSelf.addEventListener("message", async (event) => {
        // TODO: This is apparently a security risk but I don't understand why
        //       I mean this is a reasonable argument https://stackoverflow.com/a/59152482
        //       But I don't understand how MY service worker can be malicious untrusted code
        //       since it has to load from my same origin?
        if (event?.data?.type !== "be-nice-with-my-cookies") return;
        try {
            receivedCookieValue = decodeURIComponent(event.data.cookie);
            resolveColdStartCookiePromise?.(receivedCookieValue);
            resolveColdStartCookiePromise = null;
        } catch (error) {
            console.error("Cookie passing failed", error);
        }
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

worxpress.static = () => (req, _res, next) => {
    console.warn(`Static function called, not yet implemented, for ${req.url}`);
    next();
};
