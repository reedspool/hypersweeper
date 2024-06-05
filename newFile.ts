import type { Grid, GridCell } from "./types";
import { randIntBetween } from "./utilities";
import { app } from ".";

app.get("/newGame.html", async (req, res) => {
    const numRows = 50;
    const numCols = 50;
    const grid: Grid = Array(numCols)
        .fill(1)
        .map((_, y) =>
            Array(numRows)
                .fill(1)
                .map((_, x) => {
                    return {
                        type: "empty",
                        touchingMines: 0,
                        x,
                        y,
                    } as GridCell;
                }),
        );
    const numMines = 20;

    for (var i = 0; i < numMines; i++) {
        let x: number, y: number;
        do {
            x = randIntBetween(0, numRows);
            y = randIntBetween(0, numCols);
        } while (grid[y][x].type !== "mine");
        grid[y][x] = {};
    }
    for (let y = 0; y < numRows; y++) {
        const row: Grid[number] = [];
        grid.push(row);
        for (let x = 0; x < numCols; x++) {}
    }
    return res.send("hi");
});
