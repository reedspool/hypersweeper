// web.ts
function extractCookieByName(cookie, name) {
  var nameEQ = name + "=";
  var ca = cookie.split(";");
  for (var i = 0;i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == " ")
      c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0)
      return c.substring(nameEQ.length, c.length);
  }
  return null;
}
var cookieName = "minesweeper";
var cookieMaxAge = 315360000000;

// service-worker-registrar.ts
var registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) {
    console.warn("Couldn't register service worker");
    return;
  }
  try {
    navigator.serviceWorker.addEventListener("controllerchange", (event) => {
      console.log("controllerchange", event);
    });
    const justMineSweeperCookie = extractCookieByName(document.cookie, cookieName);
    navigator.serviceWorker.ready.then((registration2) => {
      console.log("Service worker readied");
      if (!registration2.active) {
        console.error("Registration not active to send cookies or load first view");
        throw new Error("Registration not active to send cookies or load first view");
      }
      setTimeout(() => document.body.dispatchEvent(new CustomEvent("service-worker-ready")), 1);
      registration2.active.postMessage({
        type: "be-nice-with-my-cookies",
        cookie: justMineSweeperCookie
      });
    });
    const registration = await navigator.serviceWorker.register("service-worker.js", {
      scope: "/"
    });
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
