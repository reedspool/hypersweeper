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
        navigator.serviceWorker.addEventListener(
            "controllerchange",
            (event) => {
                console.log("controllerchange", event);
            },
        );
        // TODO: This is probably the security risk: that I'm manually extracting
        //       just my relevant cookie, but in actuality many other domains may be
        //       accessible to me here and those might not be appropriate
        const justMineSweeperCookie = extractCookieByName(
            document.cookie,
            cookieName,
        );

        navigator.serviceWorker.ready.then((registration) => {
            console.log("Service worker readied");
            if (!registration.active) {
                console.error(
                    "Registration not active to send cookies or load first view",
                );
                throw new Error(
                    "Registration not active to send cookies or load first view",
                );
            }
            setTimeout(
                () =>
                    document.body.dispatchEvent(
                        new CustomEvent("service-worker-ready"),
                    ),
                // TODO: Why does a 1 here work, but a 0 does not?
                1,
            );
            registration.active.postMessage({
                // See security note question on message listener
                type: "be-nice-with-my-cookies",
                cookie: justMineSweeperCookie,
            });
        });

        const registration = await navigator.serviceWorker.register(
            "service-worker.js",
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

registerServiceWorker();
