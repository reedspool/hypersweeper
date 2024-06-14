import express, { json, urlencoded } from "express";
import type { ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { setupApp } from "./server";

const app = express();
const port = process.env.PORT || 3003;

app.use(cookieParser());
app.use(json());
app.use(urlencoded({ extended: true }));

setupApp(app);

app.use(express.static("public"));

//
// Final 404/5XX handlers
//
// NOTE Unused parameters REQUIRED - error handlers
//      REQUIRE 4 parameters (Express uses Function:length)
app.use(function (err, _req, res, _next) {
    console.error("5XX", err);
    res.status(err?.status || 500);

    res.send("500");
} as ErrorRequestHandler);

app.use(function (_req, res) {
    res.status(404);
    res.send("404");
});

const baseDomain =
    process.env.NODE_ENV === "production"
        ? `localhost:${port}`
        : `localhost:${port}`;
const baseURL =
    process.env.NODE_ENV === "production"
        ? `https://${baseDomain}`
        : `http://${baseDomain}`;
const listener = app.listen(port, () => {
    console.log(`Server is available at ${baseURL}`);
});

// So I can kill from local terminal with Ctrl-c
// From https://github.com/strongloop/node-foreman/issues/118#issuecomment-475902308
process.on("SIGINT", () => {
    listener.close(() => {});
    // Just wait some amount of time before exiting. Ideally the listener would
    // close successfully, but it seems to hang for some reason.
    setTimeout(() => process.exit(0), 150);
});
