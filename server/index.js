// server/index.js
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import http from "http";
import compression from "compression"; // FIX #11: gzip all HTTP responses
import { Server } from "socket.io";

import { attachSocketHandlers } from "./src/sockets/index.js";
import { attachHttpRoutes } from "./src/http/routes.js";
import { refreshDepartmentsCache } from "./src/services/departments.service.js";
import { state } from "./src/state.js";
refreshDepartmentsCache().catch(() => {});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// -------------------- middleware --------------------
// FIX #11: Compress all responses — reduces top_update / roster payload sizes
// significantly when 400 clients are receiving JSON over HTTP polling fallback.
app.use(compression());

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// FIX #12: Health check endpoint — required for Render / uptime monitors.
// Also exposes a quick player count so you can verify the server is alive.
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    players: state.playersByPid.size,
    phase: state.phase,
    uptime: Math.floor(process.uptime()),
  });
});

// -------------------- HTTP routes --------------------
attachHttpRoutes(app);

// -------------------- server + socket.io --------------------
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 20000,
});

attachSocketHandlers(io);

// -------------------- serve client/dist --------------------
// repo structure: /client/dist and /server/index.js
const clientDist = path.resolve(__dirname, "../client/dist");

// serve built assets
app.use(express.static(clientDist));

// SPA fallback (MUST be last — after API routes)
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

// -------------------- start --------------------
const PORT = Number(process.env.PORT || 3000);

server.listen(PORT, () => {
  console.log(`🚀 pop-manager listening on :${PORT}`);
  console.log(`📦 serving client from: ${clientDist}`);
});