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

// browserEntry.ts
console.log("\uD83D\uDCA3");
navigator.serviceWorker.addEventListener("message", (event) => {
  const { type, cookieName: cookieName2, cookieValue } = event.data;
  if (type !== "set-cookie")
    return;
  document.cookie = `${cookieName2}=${encodeURIComponent(cookieValue)};max-age=${cookieMaxAge}`;
});
