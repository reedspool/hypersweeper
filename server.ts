// TODO Server.ts is a weak name... Maybe "Hypermedia server"? this glues
// together the request, business logic, and response. Transformer?
import { DEFAULTS, newGrid, select } from "./game";
import { GameState, NewGameForm, Page } from "./html";
import {
    cellListToGameState,
    gameStateToHtml,
    gridToHtml,
    queryToSettings,
} from "./munge";
import type { GridCell, MyRequestHandler } from "./types";
import { cookieMaxAge, cookieName } from "./web";

export const handleIndex: MyRequestHandler = (req, res) => {
    let cookieData = { ...DEFAULTS };
    // TODO: Can't actually access this from service worker
    if (req?.cookies[cookieName]) {
        try {
            cookieData = JSON.parse(req.cookies[cookieName]);
        } catch (error) {
            // Do nothing, just use defaults, maybe add telemetry in the future
        }
    }

    res.send(Page({ contents: NewGameForm(cookieData) }));
};
export const handleNewGame: MyRequestHandler = (req, res) => {
    // TODO: Don't actually generate the board here. Do that on the first reveal. THat means storing the data of the selected game parameters somewhere else?
    const { rows, cols, mines } = req.query;
    const settings = queryToSettings({ rows, cols, mines });
    res.cookie(cookieName, JSON.stringify(settings), {
        maxAge: cookieMaxAge,
    });

    return res.send(gridToHtml(newGrid(settings)));
};

export const handleReveal: MyRequestHandler = (req, res) => {
    let { grid__cell, selected } = req.body;
    if (typeof grid__cell === "string") grid__cell = [grid__cell];
    const state = cellListToGameState(
        grid__cell.map((value: string) => JSON.parse(value)),
    );
    if (Array.isArray(selected))
        throw new Error("Only one cell may be selected");
    const selectedParsed: GridCell = JSON.parse(selected);
    select(state, selectedParsed);
    res.send(
        GameState({
            contents: gridToHtml(state.grid),
            stateMessage: gameStateToHtml(state.state),
        }),
    );
};
