export type Cell = { x: number; y: number; revealed?: boolean };
export type Mine = Cell & { type: "mine" };
export type Empty = Cell & { type: "empty"; touchingMines: number };
export type GridCell = Mine | Empty;
export type GridRow = GridCell[];
export type Grid = GridRow[];
