import type { NextFunction } from "express";

export type Cell = { x: number; y: number; revealed?: boolean };
export type Mine = Cell & { type: "mine" };
export type Flag = Cell & { type: "flag" };
export type Question = Cell & { type: "question" };
export type Empty = Cell & { type: "empty"; touchingMines: number };
export type GridCell = Mine | Empty | Flag | Question;
export type GridRow = GridCell[];
export type Grid = GridRow[];

export type GameSettings = {
    numRows: number;
    numCols: number;
    numMines: number;
};

export type GameState = {
    grid: Grid;
    settings: GameSettings;
    numHidden: number;
    state: "gameOver" | "gameWon" | "playing";
};

export type MyRequest = {
    url: string;
    body: Record<string, string | string[]>;
    query: Record<string, string>;
    cookies: Record<string, string>;

    // NOTE Extra stuff that doesn't comply with Express's Request
    //      MUST be totally optional
    originalEvent?: FetchEvent;
    context?: undefined | "serviceWorker" | "server";
};

export type MyResponse = {
    set: (
        objOrKey: Record<string, string> | string,
        nothingOrValue?: string,
    ) => void;
    send: (responseBody: string) => void;
    cookie: (
        name: string,
        contents: string,
        options: Record<string, unknown>,
    ) => void;

    // NOTE Extra stuff that doesn't comply with Express's Response
    //      MUST be totally optional
    rawResponse?: (response: Response) => void;
};

export type MyRequestHandler = (req: MyRequest, res: MyResponse) => void;
export type MyMiddlewareHandler = (
    req: MyRequest,
    res: MyResponse,
    next: NextFunction,
) => void;
