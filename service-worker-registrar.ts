//
// Runs on main thread, registers and activates separate service worker script
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

registerServiceWorker();
