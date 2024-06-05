import express, { json, urlencoded } from "express";
import type { ErrorRequestHandler } from "express";
import type { Grid as GridType, GridCell as GridCellType } from "./types";
import { randIntBetween } from "./utilities";
import { Grid, GridCell, GridRow } from "./html";

const app = express();
const port = process.env.PORT || 3003;

app.use(json());
app.use(urlencoded({ extended: true }));

app.get("/newGame.html", async (req, res) => {
    const { rows, cols, mines } = req.query;
    const numRows: number = Number(rows) || 10;
    const numCols: number = Number(cols) || 10;
    const numMines: number = Number(mines) || 5;
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

    for (let y = 0; y < numRows; y++) {
        const row: GridType[number] = [];
        grid.push(row);
        for (let x = 0; x < numCols; x++) {}
    }
    return res.send(htmlifyGrid(grid));
});

const htmlifyGrid = (grid: GridType): string =>
    Grid({
        contents: grid
            .map((row, index) =>
                GridRow({
                    contents: row.map((cell) => GridCell(cell)).join(""),
                    row: index,
                }),
            )
            .join(""),
    });

app.post("/reveal.html", (req, res) => {
    debugger;
    const { grid__cell } = req.body;
    const grid: GridType = [];
    grid__cell
        .map((value: string) => JSON.parse(value))
        .forEach((cell: GridCellType) => {
            const { y, x } = cell;
            if (!grid[y]) grid[y] = [];
            grid[y][x] = cell;
        });

    res.send(htmlifyGrid(grid));
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
