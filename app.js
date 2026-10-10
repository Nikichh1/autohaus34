"use strict";

// cPanel/CloudLinux Passenger must execute this file, not the preview server.
const passenger = typeof PhusionPassenger !== "undefined" ? PhusionPassenger : null;
if (passenger) passenger.configure({ autoInstall: false });
const { createServer } = require("./server/cpanel-server");
const server = createServer();
const port = passenger ? "passenger" : Number(process.env.PORT || 3217);
if (!passenger && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error("Invalid PORT");

// Passenger intercepts this single listen() and supplies its own Unix socket.
// Outside Passenger the default is loopback-only, including production previews.
const started = () => console.log("AutoHaus Node.js application started");
if (passenger) server.listen("passenger", started);
else server.listen(port, process.env.HOST || "127.0.0.1", started);
server.on("error", error => {
  console.error("AutoHaus startup failed:", error.code || error.name);
  process.exitCode = 1;
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 10000).unref();
  });
}
