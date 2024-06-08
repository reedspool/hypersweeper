import express, { json, urlencoded } from "express";
import type { ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import type {
    Grid as GridType,
    GridCell as GridCellType,
    GameSettings,
} from "./types";
import { randIntBetween } from "./utilities";
import {
    GameOverMessage,
    GameWonMessage,
    Grid,
    GridCell,
    GridRow,
    NewGameForm,
    Page,
} from "./html";
import { cellListToGameState, gameStateToHtml, gridToHtml } from "./munge";
import { select } from "./game";

const app = express();
const port = process.env.PORT || 3003;

const cookieName = "minesweeper";
app.use(cookieParser());
app.use(json());
app.use(urlencoded({ extended: true }));

const DEFAULTS: GameSettings = {
    numRows: 10,
    numCols: 10,
    numMines: 5,
};

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
    const numRows: number = Number(rows) || DEFAULTS.numRows;
    const numCols: number = Number(cols) || DEFAULTS.numCols;
    const numMines: number = Number(mines) || DEFAULTS.numMines;
    res.cookie(cookieName, JSON.stringify({ numMines, numRows, numCols }), {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
    });
    const grid: GridType = Array(numRows)
        .fill(1)
        .map((_, y) =>
            Array(numCols)
                .fill(1)
                .map((_, x) => {
                    return {
                        type: "empty",
                        touchingMines: 0,
                        x,
                        y,
                    };
                }),
        );

    // Mine generation algorithm from uncovered
    // StackOverflow user Yanick Rochon https://stackoverflow.com/a/3578497
    for (var i = 0; i < numMines; i++) {
        let x: number, y: number;
        do {
            // Keep generating as long as we keep hitting mines
            y = randIntBetween(0, numRows);
            x = randIntBetween(0, numCols);
            if (!grid?.[y]?.[x]) {
                console.error("BAD", {
                    y,
                    x,
                    numRows,
                    numCols,
                });
            }
        } while (grid[y][x].type === "mine");
        grid[y][x] = {
            type: "mine",
            x,
            y,
        };

        for (let yOffset = -1; yOffset <= 1; yOffset++) {
            for (let xOffset = -1; xOffset <= 1; xOffset++) {
                if (yOffset == 0 && xOffset == 0) continue;
                const yActual = y + yOffset;
                const xActual = x + xOffset;
                if (
                    yActual < 0 ||
                    yActual >= numRows ||
                    xActual < 0 ||
                    xActual >= numCols
                )
                    continue;

                if (!grid?.[yActual]?.[xActual]) {
                    console.error("BAD", {
                        y,
                        x,
                        yActual,
                        xActual,
                        numRows,
                        numCols,
                    });
                }
                const cell = grid[yActual][xActual];
                if (cell.type !== "empty") continue;
                cell.touchingMines++;
            }
        }
    }

    return res.send(gridToHtml(grid));
});

app.post("/reveal.html", (req, res) => {
    const { grid__cell, selected } = req.body;
    const state = cellListToGameState(
        grid__cell.map((value: string) => JSON.parse(value)),
    );
    const selectedParsed: GridCellType = JSON.parse(selected);
    select(state, selectedParsed);
    res.send(gridToHtml(state.grid) + gameStateToHtml(state.state));
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
