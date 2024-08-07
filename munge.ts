import type * as Type from "./types";
import * as HTML from "./html";
import { DEFAULTS } from "./game";

export const cookieToSettings = (cookie: string): Type.GameSettings => {
    let cookieData = { ...DEFAULTS };
    try {
        const cookieDataParsed = JSON.parse(cookie);
        if (cookieDataParsed) cookieData = cookieDataParsed;
    } catch (error) {
        // Do nothing, just use defaults, maybe add telemetry in the future
    }
    return cookieData;
};

export const queryToSettings = ({
    rows,
    cols,
    mines,
}: { [key in string]: unknown }): Type.GameSettings => {
    const settings = { ...DEFAULTS };
    if (Number.isSafeInteger(Number(rows))) settings.numRows = Number(rows);
    if (Number.isSafeInteger(Number(cols))) settings.numCols = Number(cols);
    if (Number.isSafeInteger(Number(mines))) settings.numMines = Number(mines);
    return settings;
};

export const cellListToGameState: (cells: Type.GridCell[]) => Type.GameState = (
    cells,
) => {
    const grid: Type.Grid = [];
    let maxColumn = 0;
    let maxRow = 0;
    let numMines = 0;
    let numHidden = 0;
    cells.forEach((cell) => {
        const { y, x } = cell;
        if (!grid[y]) grid[y] = [];
        grid[y][x] = cell;
        maxColumn = Math.max(maxColumn, x);
        maxRow = Math.max(maxRow, y);
        if (cell.type === "mine") numMines++;
        if (!cell.revealed) numHidden++;
    });

    const numCols = maxColumn + 1;
    const numRows = maxRow + 1;

    let state: Type.GameState["state"] = "playing";
    if (numHidden === 0) state = "gameOver";
    if (numHidden === numMines) state = "gameWon";
    return {
        grid,
        settings: {
            numRows,
            numCols,
            numMines,
        },
        numHidden,
        state,
    };
};

export const gridToHtml: (grid: Type.Grid) => string = (grid): string =>
    HTML.Grid({
        contents: grid
            .map((row, index) =>
                HTML.GridRow({
                    contents: row.map((cell) => HTML.GridCell(cell)).join(""),
                    row: index,
                }),
            )
            .join(""),
    });

export const gameStateToHtml: (state: Type.GameState["state"]) => string = (
    state,
) =>
    state === "gameOver"
        ? HTML.GameOverMessage()
        : state === "gameWon"
        ? HTML.GameWonMessage()
        : "";
