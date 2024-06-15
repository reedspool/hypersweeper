import { cookieMaxAge } from "./web";

console.log("💣");
navigator.serviceWorker.addEventListener("message", (event) => {
    const { type, cookieName, cookieValue } = event.data;
    if (type !== "set-cookie") return;
    document.cookie = `${cookieName}=${encodeURIComponent(
        cookieValue,
    )};max-age=${cookieMaxAge}`;
});

document.body.addEventListener("service-worker-ready", () => {
    console.log("service-worker-ready fired!");

    setTimeout(() => {
        const loadingControl = document.querySelector(
            "[hx-trigger^=service-worker-ready]",
        );
        if (loadingControl) {
            // Force refreshing disables service workers entirely, which is
            // in the spec and shows that the concept of a front-end relying
            // on a service worker is specifically dismissed in the spec.
            loadingControl.innerHTML =
                `Something went wrong.` +
                ` The service worker appears to be unavailable.` +
                ` If you force-refreshed (Ctrl-Shift-R), try a normal refresh now.`;
        }
    }, 2000);
});
