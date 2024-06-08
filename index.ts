import express, { json, urlencoded } from "express";
import type { ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import type {
    Grid as GridType,
    GridCell as GridCellType,
    GameSettings,
} from "./types";
import { GameState, NewGameForm, Page } from "./html";
import {
    cellListToGameState,
    gameStateToHtml,
    gridToHtml,
    queryToSettings,
} from "./munge";
import { DEFAULTS, newGrid, select } from "./game";
import { cookieMaxAge, cookieName } from "./web";

const app = express();
const port = process.env.PORT || 3003;

app.use(cookieParser());
app.use(json());
app.use(urlencoded({ extended: true }));

app.get("/", async (req, res) => {
    let cookieData = { ...DEFAULTS };
    if (req?.cookies[cookieName]) {
        try {
            cookieData = JSON.parse(req.cookies[cookieName]);
        } catch (error) {
            console.log("Oops!", error);
            // Do nothing, just use defaults, maybe add telemetry in the future
        }
    }
    res.send(Page({ contents: NewGameForm(cookieData) }));
});

app.get("/newGame.html", async (req, res) => {
    // TODO: Don't actually generate the board here. Do that on the first reveal. THat means storing the data of the selected game parameters somewhere else?
    const { rows, cols, mines } = req.query;
    const settings = queryToSettings({ rows, cols, mines });
    res.cookie(cookieName, JSON.stringify(settings), {
        maxAge: cookieMaxAge,
    });

    return res.send(gridToHtml(newGrid(settings)));
});

app.post("/reveal.html", (req, res) => {
    const { grid__cell, selected } = req.body;
    const state = cellListToGameState(
        grid__cell.map((value: string) => JSON.parse(value)),
    );
    const selectedParsed: GridCellType = JSON.parse(selected);
    select(state, selectedParsed);
    res.send(
        GameState({
            contents: gridToHtml(state.grid),
            stateMessage: gameStateToHtml(state.state),
        }),
    );
});

app.use(express.static("public"));

//
// Final 404/5XX handlers
//
app.use(function (err, req, res, next) {
    console.error("5XX", err, req, next);
    res.status(err?.status || 500);

    res.send("500");
} as ErrorRequestHandler);

app.use(function (_req, res) {
    res.status(404);
    res.send("404");
});

const baseDomain =
    process.env.NODE_ENV === "production"
        ? `localhost:${port}`
        : `localhost:${port}`;
const baseURL =
    process.env.NODE_ENV === "production"
        ? `https://${baseDomain}`
        : `http://${baseDomain}`;
const listener = app.listen(port, () => {
    console.log(`Server is available at ${baseURL}`);
});

// So I can kill from local terminal with Ctrl-c
// From https://github.com/strongloop/node-foreman/issues/118#issuecomment-475902308
process.on("SIGINT", () => {
    listener.close(() => {});
    // Just wait some amount of time before exiting. Ideally the listener would
    // close successfully, but it seems to hang for some reason.
    setTimeout(() => process.exit(0), 150);
});
