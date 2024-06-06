export type Cell = { x: number; y: number; revealed?: boolean };
export type Mine = Cell & { type: "mine" };
export type Flag = Cell & { type: "flag" };
export type Question = Cell & { type: "question" };
export type Empty = Cell & { type: "empty"; touchingMines: number };
export type GridCell = Mine | Empty | Flag | Question;
export type GridRow = GridCell[];
export type Grid = GridRow[];
