//
// Runs on main thread, registers and activates separate service worker script

import { cookieName, extractCookieByName } from "./web";

//
const registerServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) {
        console.warn("Couldn't register service worker");
        return;
    }
    try {
        const registration = await navigator.serviceWorker.register(
            "/service-worker.js",
            {
                scope: "/",
            },
        );
        if (registration.installing) {
            console.log("Service worker installing");
        } else if (registration.waiting) {
            console.log("Service worker installed");
        } else if (registration.active) {
            console.log("Service worker active");
        }
    } catch (error) {
        console.error(`Registration failed with ${error}`, error);
    }
};

navigator.serviceWorker.addEventListener("controllerchange", (event) => {
    console.log("controllerchange", event);
});
// TODO: This is probably the security risk: that I'm manually extracting
//       just my relevant cookie, but in actuality many other domains may be
//       accessible to me here and those might not be appropriate
const justMineSweeperCookie = extractCookieByName(document.cookie, cookieName);

navigator.serviceWorker.ready.then((registration) => {
    console.log("Service worker readied");
    if (!registration.active)
        throw new Error("Registration not active to send cookies");
    registration.active.postMessage({
        // See security note question on message listener
        type: "be-nice-with-my-cookies",
        cookie: justMineSweeperCookie,
    });
});

registerServiceWorker();
