// A tagged template function to invoke Prettier's built-in formatting

import type { Empty, GridCell as GridCellType, Mine } from "./types";

// See https://prettier.io/blog/2020/08/24/2.1.0.html
const html: typeof String.raw = (templates, ...args): string =>
    String.raw(templates, ...args);

type WithContents = { contents: string };
export const MineCellContents = (_mine: Mine) => html` ! `;
export const EmptyCellContents = ({ touchingMines }: Empty) => html`
    ${touchingMines}
`;
export const MysteryCellContents = (cell: GridCellType) => html`
    <button
        type="submit"
        name="selected"
        value="${JSON.stringify(cell).replaceAll('"', "&quot;")}"
    >
        ?
    </button>
`;
export const GridCell = (cell: GridCellType) =>
    html`<div
        class="grid__cell grid__cell--${cell.type}"
        data-grid-x="${cell.x}"
        data-grid-y="${cell.y}"
        data-revealed="${cell.revealed}"
        data-type="${cell.type}"
    >
        <input
            name="grid__cell"
            type="hidden"
            value="${JSON.stringify(cell).replaceAll('"', "&quot;")}"
        />
        ${!cell.revealed
            ? MysteryCellContents(cell)
            : cell.type === "empty"
            ? EmptyCellContents(cell)
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
    html`<form hx-post="/reveal.html" class="grid">${contents}</form>`;
