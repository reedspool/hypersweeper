import { cookieMaxAge } from "./web";

console.log("🥰");
navigator.serviceWorker.addEventListener("message", (event) => {
    const { type, cookieName, cookieValue } = event.data;
    if (type !== "set-cookie") return;
    document.cookie = `${cookieName}=${encodeURIComponent(
        JSON.stringify(cookieValue),
    )};max-age=${cookieMaxAge}`;
});
