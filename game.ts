import { randIntBetween } from "./utilities";
import type { GameSettings, GameState, GridCell, Grid } from "./types";

export const DEFAULTS: GameSettings = {
    numRows: 10,
    numCols: 10,
    numMines: 5,
};

export const newGrid = ({ numRows, numCols, numMines }: GameSettings): Grid => {
    const grid: Grid = Array(numRows)
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

    if (numMines > numRows * numCols)
        throw new Error("Can't have more mines than cells");

    // Mine generation algorithm from
    // StackOverflow user Yanick Rochon https://stackoverflow.com/a/3578497
    for (var i = 0; i < numMines; i++) {
        let x: number, y: number;
        do {
            // Keep generating as long as we keep hitting mines
            y = randIntBetween(0, numRows);
            x = randIntBetween(0, numCols);
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

                const cell = grid[yActual][xActual];
                if (cell.type !== "empty") continue;
                cell.touchingMines++;
            }
        }
    }
    return grid;
};
export const select: (state: GameState, selected: GridCell) => void = (
    wholeState,
    selected,
) => {
    const selectedCell = wholeState.grid[selected.y][selected.x];
    const {
        settings: { numMines, numCols, numRows },
    } = wholeState;

    if (selectedCell.type === "mine") {
        wholeState.state = "gameOver";
        wholeState.grid.forEach((row) =>
            row.forEach((cell) => (cell.revealed = true)),
        );
    } else {
        const toRevealIfTouchingNone: GridCell[] = [selectedCell];
        do {
            const current = toRevealIfTouchingNone.shift();
            if (!current || current.revealed || current.type !== "empty")
                continue;
            current.revealed = true;
            wholeState.numHidden--;
            if (current.touchingMines > 0) continue;
            if (current.x > 0)
                toRevealIfTouchingNone.push(
                    wholeState.grid[current.y][current.x - 1],
                );
            if (current.x < numCols - 1)
                toRevealIfTouchingNone.push(
                    wholeState.grid[current.y][current.x + 1],
                );
            if (current.y > 0)
                toRevealIfTouchingNone.push(
                    wholeState.grid[current.y - 1][current.x],
                );
            if (current.y < numRows - 1)
                toRevealIfTouchingNone.push(
                    wholeState.grid[current.y + 1][current.x],
                );
        } while (toRevealIfTouchingNone.length > 0);
    }

    if (wholeState.numHidden === numMines) wholeState.state = "gameWon";
};
