import type { GameState, GridCell } from "./types";

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
