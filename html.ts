// A tagged template function to invoke Prettier's built-in formatting

import type {
    Empty,
    Flag,
    GameSettings,
    GridCell as GridCellType,
    Mine,
    Question,
} from "./types";
import { htmlifyJson } from "./utilities";

// See https://prettier.io/blog/2020/08/24/2.1.0.html
const html: typeof String.raw = (templates, ...args) =>
    String.raw(templates, ...args);

type WithContents = { contents: string };

export const Page = ({ contents }: WithContents) => html`
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
            ${"" /* favicons from https://favicon.io/emoji-favicons/bomb */}
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

export const LoadingNewGameForm = () => html`
    <div hx-get="newGameForm.html" hx-trigger="load" hx-swap="outerHTML">
        <div class="loader"></div>
    </div>
`;

export const NewGameForm = ({
    numMines,
    numCols,
    numRows,
}: GameSettings) => html`
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

// TODO Emoji broken in string templates?
//      Confirmed: https://github.com/oven-sh/bun/issues/8745
export const MineCellContents = (_mine: Mine) => `💣`;
export const FlagCellContents = (_: Flag) => `🏁`;
export const QuestionCellContents = (_: Question) => `❓`;
export const EmptyCellContents = ({ touchingMines }: Empty) => html`
    ${touchingMines === 0 ? "" : touchingMines}
`;
export const MysteryCellContents = (cell: GridCellType) => html`
    <button type="submit" name="selected" value="${htmlifyJson(cell)}"></button>
`;
export const GridCell = (cell: GridCellType) =>
    html`<div
        class="grid__cell grid__cell--${cell.type} grid__cell--${cell.revealed
            ? "revealed"
            : "hidden"}"
        data-grid-x="${cell.x}"
        data-grid-y="${cell.y}"
        data-revealed="${cell.revealed}"
        data-type="${cell.type}"
    >
        <input name="grid__cell" type="hidden" value="${htmlifyJson(cell)}" />
        ${!cell.revealed
            ? MysteryCellContents(cell)
            : cell.type === "empty"
            ? EmptyCellContents(cell)
            : cell.type === "flag"
            ? FlagCellContents(cell)
            : cell.type === "question"
            ? QuestionCellContents(cell)
            : MineCellContents(cell)}
    </div>`;
export const GridRow = ({
    contents,
    row,
}: WithContents & { row: number }) => html`
    <fieldset class="grid__row">
        <legend>Row ${row}</legend>
        ${contents}
    </fieldset>
`;

export const Grid = ({ contents }: WithContents) =>
    html`<form hx-post="reveal.html" hx-swap="outerHTML" class="grid">
        ${contents}
    </form>`;

/* TODO Actually do dialogs correctly https://hidde.blog/dialog-modal-popover-differences/ */
export const GameOverMessage = () => html`
    <dialog open class="toast">Game Over :(</dialog>
`;
export const GameWonMessage = () => html`
    <dialog open class="toast">Game Won :)</dialog>
`;

export const GameState = ({
    contents,
    stateMessage,
}: WithContents & { stateMessage: string }) => contents + stateMessage;
