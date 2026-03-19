// server/src/sockets/admin.handlers.js
import { ADMIN_KEY, DEFAULT_CFG, isAdminKey, isOperatorKey } from "../config.js";
import { state, CFG, resetAllScores } from "../state.js";
import { clampInt } from "../utils/clamp.js";
import { startLobby, pauseMatch, resumeMatch, endMatch } from "../services/match.service.js";
import { cleanupRoomAvatars } from "./player.handlers.js";

function ensureAdmin(socket) {
  return state.admins.has(socket.id);
}

function ensureOperator(socket) {
  return state.admins.has(socket.id) || state.operators?.has?.(socket.id);
}

export function attachAdminHandlers(io, socket, broadcastState, broadcastTop) {
  // make sure operators set exists
  if (!state.operators) state.operators = new Set();

  socket.on("admin_login", ({ key }) => {
    if (isAdminKey(key)) {
      state.admins.add(socket.id);
      state.operators.delete(socket.id);

      socket.leave("players");
      socket.join("admin");

      socket.emit("admin_ok", { ok: true, role: "admin" });
      socket.emit("toast", { type: "good", message: "Admin authenticated" });
      broadcastState();
      return;
    }

    socket.emit("admin_ok", { ok: false });
    socket.emit("toast", { type: "error", message: "Wrong admin key" });
  });

  // NEW: operator login
  socket.on("operator_login", ({ key }) => {
    if (isOperatorKey(key)) {
      if (!isAdminKey(key)) {
        state.operators.add(socket.id);
      } else {
        state.admins.add(socket.id);
      }

      socket.leave("players");
      socket.join("admin");

      socket.emit("operator_ok", {
        ok: true,
        role: isAdminKey(key) ? "admin" : "operator",
      });
      socket.emit("toast", { type: "good", message: "Operator authenticated" });
      broadcastState();
      return;
    }

    socket.emit("operator_ok", { ok: false });
    socket.emit("toast", { type: "error", message: "Wrong operator key" });
  });

  socket.on("disconnect", () => {
    state.admins.delete(socket.id);
    state.operators?.delete?.(socket.id);
  });

  // GAMEPLAY ONLY -> operator allowed
  socket.on("admin_room_toggle", ({ open, adminKey } = {}) => {
    const authed = ensureOperator(socket) || isOperatorKey(adminKey);
    if (!authed) return;

    if (!ensureOperator(socket) && isOperatorKey(adminKey)) {
      if (!isAdminKey(adminKey)) state.operators.add(socket.id);
      else state.admins.add(socket.id);
    }

    state.roomOpen = !!open;
    broadcastState();
  });

  // GAMEPLAY SETTINGS ONLY -> operator allowed
  socket.on("admin_config", (payload = {}) => {
    const authed = ensureOperator(socket) || isOperatorKey(payload.adminKey);
    if (!authed) return;

    if (!ensureOperator(socket) && isOperatorKey(payload.adminKey)) {
      if (!isAdminKey(payload.adminKey)) state.operators.add(socket.id);
      else state.admins.add(socket.id);
    }

    const p = payload || {};

    if (p.mode === "SOLO" || p.mode === "TEAM") CFG.mode = p.mode;

    const lobby = clampInt(
      p.lobbySeconds ?? p.lobbySec,
      3,
      120
    );
    const match = clampInt(
      p.matchSeconds ?? p.matchSec,
      10,
      1200
    );
    const warn = clampInt(
      p.warnSeconds ?? p.warnSec,
      1,
      10
    );
    const eMin = clampInt(
      p.eventSecondsMin ?? p.eventMinSec,
      1,
      8
    );
    const eMax = clampInt(
      p.eventSecondsMax ?? p.eventMaxSec,
      1,
      12
    );
    const bMin = clampInt(
      p.betweenEventSecondsMin ?? p.betweenMinSec,
      2,
      30
    );
    const bMax = clampInt(
      p.betweenEventSecondsMax ?? p.betweenMaxSec,
      2,
      60
    );
    const maxTeamSize = clampInt(
      p.maxTeamSize,
      1,
      50
    );

    if (lobby !== null) CFG.lobbySeconds = lobby;
    if (match !== null) CFG.matchSeconds = match;
    if (warn !== null) CFG.warnSeconds = warn;

    if (eMin !== null) CFG.eventSecondsMin = eMin;
    if (eMax !== null) CFG.eventSecondsMax = Math.max(CFG.eventSecondsMin, eMax);

    if (bMin !== null) CFG.betweenEventSecondsMin = bMin;
    if (bMax !== null) CFG.betweenEventSecondsMax = Math.max(CFG.betweenEventSecondsMin, bMax);

    if (maxTeamSize !== null) CFG.maxTeamSize = maxTeamSize;

    broadcastState();
    broadcastTop();
  });

  // GAMEPLAY ONLY -> operator allowed
  socket.on("admin_start", ({ adminKey } = {}) => {
    const authed = ensureOperator(socket) || isOperatorKey(adminKey);
    if (!authed) return;

    if (!ensureOperator(socket) && isOperatorKey(adminKey)) {
      if (!isAdminKey(adminKey)) state.operators.add(socket.id);
      else state.admins.add(socket.id);
    }

    if (state.phase === "playing" || state.phase === "lobby") return;
    startLobby(io, broadcastState, broadcastTop);
  });

  // GAMEPLAY ONLY -> operator allowed
  socket.on("admin_pause_toggle", ({ adminKey } = {}) => {
    const authed = ensureOperator(socket) || isOperatorKey(adminKey);
    if (!authed) return;

    if (!ensureOperator(socket) && isOperatorKey(adminKey)) {
      if (!isAdminKey(adminKey)) state.operators.add(socket.id);
      else state.admins.add(socket.id);
    }

    if (state.phase === "playing") pauseMatch(broadcastState, broadcastTop);
    else if (state.phase === "paused") resumeMatch(io, broadcastState, broadcastTop);
  });

  // GAMEPLAY ONLY -> operator allowed
  socket.on("admin_end", ({ adminKey } = {}) => {
    const authed = ensureOperator(socket) || isOperatorKey(adminKey);
    if (!authed) return;

    if (!ensureOperator(socket) && isOperatorKey(adminKey)) {
      if (!isAdminKey(adminKey)) state.operators.add(socket.id);
      else state.admins.add(socket.id);
    }

    if (state.phase === "idle") return;
    endMatch(io, broadcastState, broadcastTop, "Ended by admin");
  });

  /**
   * Reset Room
   * GAMEPLAY ONLY -> operator allowed
   */
  socket.on("admin_reset_room", async ({ adminKey } = {}) => {
    const authed = ensureOperator(socket) || isOperatorKey(adminKey);
    if (!authed) return;

    if (!ensureOperator(socket) && isOperatorKey(adminKey)) {
      if (!isAdminKey(adminKey)) state.operators.add(socket.id);
      else state.admins.add(socket.id);
    }

    state.roomOpen = false;

    for (const p of state.players.values()) {
      const sid = p?._socketId || p?.id;
      if (sid) io.to(sid).emit("force_logout", { reason: "Room reset" });
    }

    try {
      await cleanupRoomAvatars();
    } catch {}

    if (state._pidDisconnectTimers && typeof state._pidDisconnectTimers.forEach === "function") {
      for (const t of state._pidDisconnectTimers.values()) {
        try {
          clearTimeout(t);
        } catch {}
      }
      state._pidDisconnectTimers.clear();
    }

    state.players.clear();
    state.playersByPid?.clear?.();
    state.socketIndex.clear();
    state.teamRooms?.clear?.();

    state.phase = "idle";
    state.matchId = null;
    state.round = 0;
    state.lobbyEndsAt = null;
    state.matchEndsAt = null;
    state.event = { active: false, type: null, endsAt: null };

    // keep current config, unless you want to restore defaults:
    // Object.assign(CFG, { ...DEFAULT_CFG });

    broadcastState();
    broadcastTop();

    socket.emit("toast", {
      type: "good",
      message: "✅ Room reset (players cleared + avatars cleaned)",
    });
  });

  // GAMEPLAY ONLY -> operator allowed
  socket.on("admin_clear_results", ({ adminKey } = {}) => {
    const authed = ensureOperator(socket) || isOperatorKey(adminKey);
    if (!authed) return;

    if (!ensureOperator(socket) && isOperatorKey(adminKey)) {
      if (!isAdminKey(adminKey)) state.operators.add(socket.id);
      else state.admins.add(socket.id);
    }

    resetAllScores();

    state.phase = "idle";
    state.matchId = null;
    state.round = 0;
    state.lobbyEndsAt = null;
    state.matchEndsAt = null;
    state.event = { active: false, type: null, endsAt: null };

    broadcastState();
    broadcastTop();

    socket.emit("toast", {
      type: "good",
      message: "✅ Cleared results: all scores set to 0",
    });
  });
}