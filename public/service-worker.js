// utilities.ts
var randInt = (max) => Math.floor(Math.random() * max);
var randIntBetween = (min, max) => randInt(max - min) + min;
var wait = (millis) => new Promise((resolve) => setTimeout(() => resolve(null), millis));
var htmlifyJson = (obj) => JSON.stringify(obj).replaceAll('"', "&quot;");

// game.ts
var DEFAULTS = {
  numRows: 10,
  numCols: 10,
  numMines: 5
};
var newGrid = ({ numRows, numCols, numMines }) => {
  const grid = Array(numRows).fill(1).map((_, y) => Array(numCols).fill(1).map((_2, x) => {
    return {
      type: "empty",
      touchingMines: 0,
      x,
      y
    };
  }));
  if (numMines > numRows * numCols)
    throw new Error("Can't have more mines than cells");
  for (var i = 0;i < numMines; i++) {
    let x, y;
    do {
      y = randIntBetween(0, numRows);
      x = randIntBetween(0, numCols);
    } while (grid[y][x].type === "mine");
    grid[y][x] = {
      type: "mine",
      x,
      y
    };
    for (let yOffset = -1;yOffset <= 1; yOffset++) {
      for (let xOffset = -1;xOffset <= 1; xOffset++) {
        if (yOffset == 0 && xOffset == 0)
          continue;
        const yActual = y + yOffset;
        const xActual = x + xOffset;
        if (yActual < 0 || yActual >= numRows || xActual < 0 || xActual >= numCols)
          continue;
        const cell = grid[yActual][xActual];
        if (cell.type !== "empty")
          continue;
        cell.touchingMines++;
      }
    }
  }
  return grid;
};
var select = (wholeState, selected) => {
  const selectedCell = wholeState.grid[selected.y][selected.x];
  const {
    settings: { numMines, numCols, numRows }
  } = wholeState;
  if (selectedCell.type === "mine") {
    wholeState.state = "gameOver";
    wholeState.grid.forEach((row) => row.forEach((cell) => cell.revealed = true));
  } else {
    const toRevealIfTouchingNone = [selectedCell];
    do {
      const current = toRevealIfTouchingNone.shift();
      if (!current || current.revealed || current.type !== "empty")
        continue;
      current.revealed = true;
      wholeState.numHidden--;
      if (current.touchingMines > 0)
        continue;
      if (current.x > 0)
        toRevealIfTouchingNone.push(wholeState.grid[current.y][current.x - 1]);
      if (current.x < numCols - 1)
        toRevealIfTouchingNone.push(wholeState.grid[current.y][current.x + 1]);
      if (current.y > 0)
        toRevealIfTouchingNone.push(wholeState.grid[current.y - 1][current.x]);
      if (current.y < numRows - 1)
        toRevealIfTouchingNone.push(wholeState.grid[current.y + 1][current.x]);
    } while (toRevealIfTouchingNone.length > 0);
  }
  if (wholeState.numHidden === numMines)
    wholeState.state = "gameWon";
};

// html.ts
var html = (templates, ...args) => String.raw(templates, ...args);
var Page = ({ contents }) => html`
    <!doctype html>
    <html class="no-js" lang="">
        <head>
            <meta charset="utf-8" />
            <meta http-equiv="x-ua-compatible" content="ie=edge" />
            <title>Minesweeper</title>
            <meta
                name="description"
                content="Minesweeper in hypermedia experiment"
            />
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1"
            />
            ${""}
            <link
                rel="apple-touch-icon"
                sizes="180x180"
                href="apple-touch-icon.png"
            />
            <link
                rel="icon"
                type="image/png"
                sizes="32x32"
                href="favicon-32x32.png"
            />
            <link
                rel="icon"
                type="image/png"
                sizes="16x16"
                href="favicon-16x16.png"
            />
            <link rel="manifest" href="site.webmanifest" />
            <link
                rel="stylesheet"
                href="site.css"
                type="text/css"
                media="screen"
            />
            <script src="service-worker-registrar.js"></script>
        </head>

        <body>
            ${contents}

            <script src="browserEntry.js"></script>
            <script
                src="https://unpkg.com/htmx.org@1.9.10"
                integrity="sha384-D1Kt99CQMDuVetoL1lrYwg5t+9QdHe7NLX/SoJYkXDFfX37iInKRy5xLSi8nO7UC"
                crossorigin="anonymous"
            ></script>
        </body>
    </html>
`;
var LoadingNewGameForm = () => html`
    <div hx-get="newGameForm.html" hx-trigger="load" hx-swap="outerHTML">
        <div class="loader"></div>
    </div>
`;
var NewGameForm = ({
  numMines,
  numCols,
  numRows
}) => html`
    <form hx-get="newGame.html" hx-swap="outerHTML">
        <label>
            # Rows
            <input type="number" name="rows" value="${numRows}" />
        </label>
        <label>
            # Columns
            <input type="number" name="cols" value="${numCols}" />
        </label>
        <label>
            # Mines
            <input type="number" name="mines" value="${numMines}" />
        </label>
        <button hx-swap="outerHTML" hx-target="closest form" type="submit">
            New Game
        </button>
    </form>
`;
var MineCellContents = (_mine) => `\uD83D\uDCA3`;
var FlagCellContents = (_) => `\uD83C\uDFC1`;
var QuestionCellContents = (_) => `\u2753`;
var EmptyCellContents = ({ touchingMines }) => html`
    ${touchingMines === 0 ? "" : touchingMines}
`;
var MysteryCellContents = (cell) => html`
    <button type="submit" name="selected" value="${htmlifyJson(cell)}"></button>
`;
var GridCell = (cell) => html`<div
        class="grid__cell grid__cell--${cell.type} grid__cell--${cell.revealed ? "revealed" : "hidden"}"
        data-grid-x="${cell.x}"
        data-grid-y="${cell.y}"
        data-revealed="${cell.revealed}"
        data-type="${cell.type}"
    >
        <input name="grid__cell" type="hidden" value="${htmlifyJson(cell)}" />
        ${!cell.revealed ? MysteryCellContents(cell) : cell.type === "empty" ? EmptyCellContents(cell) : cell.type === "flag" ? FlagCellContents(cell) : cell.type === "question" ? QuestionCellContents(cell) : MineCellContents(cell)}
    </div>`;
var GridRow = ({
  contents,
  row
}) => html`
    <fieldset class="grid__row">
        <legend>Row ${row}</legend>
        ${contents}
    </fieldset>
`;
var Grid = ({ contents }) => html`<form hx-post="reveal.html" hx-swap="outerHTML" class="grid">
        ${contents}
    </form>`;
var GameOverMessage = () => html`
    <dialog open class="toast">Game Over :(</dialog>
`;
var GameWonMessage = () => html`
    <dialog open class="toast">Game Won :)</dialog>
`;
var GameState = ({
  contents,
  stateMessage
}) => contents + stateMessage;

// munge.ts
var cookieToSettings = (cookie) => {
  let cookieData = { ...DEFAULTS };
  try {
    const cookieDataParsed = JSON.parse(cookie);
    if (cookieDataParsed)
      cookieData = cookieDataParsed;
  } catch (error) {
  }
  return cookieData;
};
var queryToSettings = ({
  rows,
  cols,
  mines
}) => {
  const settings = { ...DEFAULTS };
  if (Number.isSafeInteger(Number(rows)))
    settings.numRows = Number(rows);
  if (Number.isSafeInteger(Number(cols)))
    settings.numCols = Number(cols);
  if (Number.isSafeInteger(Number(mines)))
    settings.numMines = Number(mines);
  return settings;
};
var cellListToGameState = (cells) => {
  const grid = [];
  let maxColumn = 0;
  let maxRow = 0;
  let numMines = 0;
  let numHidden = 0;
  cells.forEach((cell) => {
    const { y, x } = cell;
    if (!grid[y])
      grid[y] = [];
    grid[y][x] = cell;
    maxColumn = Math.max(maxColumn, x);
    maxRow = Math.max(maxRow, y);
    if (cell.type === "mine")
      numMines++;
    if (!cell.revealed)
      numHidden++;
  });
  const numCols = maxColumn + 1;
  const numRows = maxRow + 1;
  let state = "playing";
  if (numHidden === 0)
    state = "gameOver";
  if (numHidden === numMines)
    state = "gameWon";
  return {
    grid,
    settings: {
      numRows,
      numCols,
      numMines
    },
    numHidden,
    state
  };
};
var gridToHtml = (grid) => Grid({
  contents: grid.map((row, index) => GridRow({
    contents: row.map((cell) => GridCell(cell)).join(""),
    row: index
  })).join("")
});
var gameStateToHtml = (state) => state === "gameOver" ? GameOverMessage() : state === "gameWon" ? GameWonMessage() : "";

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

// server.ts
var setupApp = (app) => {
  app.get("/", handleIndex);
  app.get("/newGame.html", handleNewGame);
  app.get("/newGameForm.html", handleNewGameForm);
  app.post("/reveal.html", handleReveal);
};
var handleIndex = (req, res) => {
  let contents;
  if (req.context === "serviceWorker") {
    contents = LoadingNewGameForm();
  } else {
    const cookieData = cookieToSettings(req.cookies[cookieName]);
    contents = NewGameForm(cookieData);
  }
  res.send(Page({ contents }));
};
var handleNewGameForm = (req, res) => {
  const cookieData = cookieToSettings(req.cookies[cookieName]);
  res.send(NewGameForm(cookieData));
};
var handleNewGame = (req, res) => {
  const { rows, cols, mines } = req.query;
  const settings = queryToSettings({ rows, cols, mines });
  res.cookie(cookieName, JSON.stringify(settings), {
    maxAge: cookieMaxAge
  });
  return res.send(gridToHtml(newGrid(settings)));
};
var handleReveal = (req, res) => {
  let { grid__cell, selected } = req.body;
  if (typeof grid__cell === "string")
    grid__cell = [grid__cell];
  const state = cellListToGameState(grid__cell.map((value) => JSON.parse(value)));
  if (Array.isArray(selected))
    throw new Error("Only one cell may be selected");
  const selectedParsed = JSON.parse(selected);
  select(state, selectedParsed);
  res.send(GameState({
    contents: gridToHtml(state.grid),
    stateMessage: gameStateToHtml(state.state)
  }));
};

// worxpress.ts
var ALL_PATHS = -1;
var worxpress = ({ serviceWorkerSelf, cookieName: cookieName2 }) => {
  const middlewares = [];
  serviceWorkerSelf.addEventListener("fetch", async function(event) {
    const url = new URL(event.request.url);
    const middlewaresTemp = [...middlewares];
    return event.respondWith(new Promise(async function(resolveResponseBody) {
      try {
        await coldStartookieValuePromise;
        let formData;
        try {
          formData = event.request.method.toLowerCase() === "post" ? await event.request.formData() : [];
        } catch (error) {
          console.log("Form data couldn't be done ", error);
          formData = [];
        }
        const request = new Proxy(event.request, {
          get(_target, prop) {
            if (prop === "context") {
              return "serviceWorker";
            }
            if (prop === "query") {
              const query = {};
              url.searchParams.forEach((value, key) => {
                query[key] = value;
              });
              return query;
            }
            if (prop === "body") {
              const body = {};
              formData.forEach((value, key) => {
                if (typeof value !== "string" && !Array.isArray(value))
                  throw new Error(`POST body values other than strings not yet implemented`);
                let prior = body[key];
                if (typeof prior === "string")
                  body[key] = [prior];
                prior = body[key];
                if (Array.isArray(prior)) {
                  if (typeof value !== "string")
                    throw new Error(`POST body values other than strings not yet implemented`);
                  prior.push(value);
                } else {
                  body[key] = value;
                }
              });
              return body;
            }
            if (prop === "cookies")
              return { [cookieName2]: receivedCookieValue };
            if (prop === "url")
              return event.request.url;
            if (prop === "originalEvent")
              return event;
            throw new Error(`Sorry, accessing request.${prop.toString()} is not yet implemented.`);
          },
          set(_target, _prop, _value) {
            throw new Error("Mutating the request object is not yet implemented");
          }
        });
        const headers = new Headers;
        const response = new Proxy({}, {
          get(_target, prop) {
            if (prop === "cookie") {
              return async function(name, contents, options) {
                if (name !== cookieName2)
                  throw new Error("Setting cookie other than the one configured is not yet supported");
                receivedCookieValue = contents;
                if (event.clientId) {
                  const client = await serviceWorkerSelf.clients.get(event.clientId);
                  if (client)
                    client.postMessage({
                      type: "set-cookie",
                      cookieName: cookieName2,
                      cookieValue: contents,
                      options
                    });
                }
              };
            }
            if (prop === "set") {
              return function(objOrKey, nothingOrValue) {
                if (typeof objOrKey === "string") {
                  if (typeof nothingOrValue === "string") {
                    headers.set(objOrKey, nothingOrValue);
                  } else {
                    headers.delete(objOrKey);
                  }
                } else {
                  Object.entries(objOrKey).forEach(([key, value]) => {
                    headers.set(key, value);
                  });
                }
              };
            }
            if (prop === "send") {
              return function(responseBody) {
                headers.set("Content-Type", "text/html");
                const response2 = new Response(responseBody, {
                  status: 200,
                  statusText: "OK",
                  headers
                });
                return resolveResponseBody(response2);
              };
            }
            if (prop === "rawResponse") {
              return function(response2) {
                return resolveResponseBody(response2);
              };
            }
            throw new Error(`Sorry, accessing response.${prop.toString()} is not yet implemented.`);
          },
          set(_target, _prop, _value) {
            throw new Error("Mutating the response object is not yet implemented");
          }
        });
        async function doNextThing(_) {
          const first = middlewaresTemp.shift();
          if (!first) {
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse)
              return resolveResponseBody(cachedResponse);
            const response2 = await event.preloadResponse;
            if (response2)
              return resolveResponseBody(response2);
            return resolveResponseBody(fetch(event.request));
          }
          if (first.path === ALL_PATHS) {
            return first.handler(request, response, () => doNextThing(resolveResponseBody));
          } else if (first.method.toLowerCase() === event.request.method.toLowerCase() && url.origin === location.origin && serviceWorkerSelf.registration.scope + first.path.replace(/^\//, "") === url.protocol + "//" + url.host + url.pathname) {
            return first.handler(request, response, () => {
              console.error("I don't think next is supported on Express app.get/app.post/etc but I'm not sure?");
              doNextThing(resolveResponseBody);
            });
          } else {
            doNextThing(resolveResponseBody);
          }
        }
        await doNextThing(resolveResponseBody);
      } catch (error) {
        console.error("Error in service worker worxpress response", error);
        const headers = new Headers;
        const response = new Response("501", {
          status: 501,
          statusText: "Service Worker Failed",
          headers
        });
        return resolveResponseBody(response);
      }
    }));
  });
  let receivedCookieValue = null;
  let resolveColdStartCookiePromise;
  const coldStartookieValuePromise = Promise.race([
    new Promise((resolve) => resolveColdStartCookiePromise = resolve),
    wait(1000)
  ]);
  coldStartookieValuePromise.then((result) => console.log(`Cookie value promise resolved with '${result}'`));
  serviceWorkerSelf.addEventListener("message", async (event) => {
    if (event?.data?.type !== "be-nice-with-my-cookies")
      return;
    try {
      receivedCookieValue = decodeURIComponent(event.data.cookie);
      resolveColdStartCookiePromise?.(receivedCookieValue);
      resolveColdStartCookiePromise = null;
    } catch (error) {
      console.error("Cookie passing failed", error);
    }
  });
  return {
    get: (path, handler) => {
      middlewares.push({ path, handler, method: "get" });
    },
    post: (path, handler) => {
      middlewares.push({ path, handler, method: "post" });
    },
    use: (handler) => {
      middlewares.push({ path: ALL_PATHS, handler, method: "all" });
    }
  };
};
worxpress.static = () => (req, _res, next) => {
  console.warn(`Static function called, not yet implemented, for ${req.url}`);
  next();
};

// service-worker.ts
var serviceWorkerSelf = self;
var CACHE_NAME = "minesweeper-service-worker-cache-v1";
var deleteOldCaches = async () => {
  const cacheKeepList = [CACHE_NAME];
  const keyList = await caches.keys();
  const cachesToDelete = keyList.filter((key) => !cacheKeepList.includes(key));
  await Promise.all(cachesToDelete.map((key) => caches.delete(key)));
};
var putInCache = async (request, response) => {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
};
var cacheFirst = async (request) => {
  const responseFromCache = await caches.match(request);
  if (responseFromCache) {
    return responseFromCache;
  }
  const responseFromNetwork = await fetch(request);
  putInCache(request, responseFromNetwork.clone());
  return responseFromNetwork;
};
serviceWorkerSelf.addEventListener("install", async function(event) {
  console.log(`Service worker installed. Initiating cache ${CACHE_NAME}`, event);
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
    return cache.addAll([
      "favicon.ico",
      "android-chrome-192x192.png",
      "android-chrome-512x512.png",
      "apple-touch-icon.png",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "site.webmanifest",
      "browserEntry.js",
      "site.css"
    ]);
  }));
  serviceWorkerSelf.skipWaiting();
});
serviceWorkerSelf.addEventListener("activate", function(event) {
  console.log("Service worker activated", event);
  console.log("Service worker cleaning up old caches");
  event.waitUntil((async () => {
    await deleteOldCaches();
    if (serviceWorkerSelf.registration.navigationPreload) {
    }
    console.log("Service worker attempting to claim");
    await serviceWorkerSelf.clients.claim();
  })());
});
var app = worxpress({ serviceWorkerSelf, cookieName });
setupApp(app);
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
app.use(worxpress.static("public"));
