// server/src/sockets/admin.handlers.js
import { ADMIN_KEY, DEFAULT_CFG } from "../config.js";
import { state, CFG, resetAllScores } from "../state.js"; // ✅ add resetAllScores
import { clampInt } from "../utils/clamp.js";
import { startLobby, pauseMatch, resumeMatch, endMatch } from "../services/match.service.js";
import { cleanupRoomAvatars } from "./player.handlers.js";

export function attachAdminHandlers(io, socket, broadcastState, broadcastTop) {
  socket.on("admin_login", ({ key }) => {
    if (String(key || "") === ADMIN_KEY) {
      state.admins.add(socket.id);
      // FIX #5: After auth, move this socket into the protected "admin" room
      // so it receives scores_delta, roster, and admin broadcasts going forward.
      socket.leave("players");
      socket.join("admin");
      socket.emit("admin_ok", { ok: true });
      socket.emit("toast", { type: "good", message: "Admin authenticated" });
      broadcastState();
    } else {
      socket.emit("admin_ok", { ok: false });
      socket.emit("toast", { type: "error", message: "Wrong admin key" });
    }
  });

  socket.on("admin_room_toggle", ({ open }) => {
    if (!state.admins.has(socket.id)) return;
    state.roomOpen = !!open;
    broadcastState();
  });

  socket.on("admin_config", (payload) => {
    if (!state.admins.has(socket.id)) return;
    const p = payload || {};

    if (p.mode === "SOLO" || p.mode === "TEAM") CFG.mode = p.mode;

    const lobby = clampInt(p.lobbySeconds, 3, 120);
    const match = clampInt(p.matchSeconds, 10, 1200);
    const warn = clampInt(p.warnSeconds, 1, 10);
    const eMin = clampInt(p.eventSecondsMin, 1, 8);
    const eMax = clampInt(p.eventSecondsMax, 1, 12);
    const bMin = clampInt(p.betweenEventSecondsMin, 2, 30);
    const bMax = clampInt(p.betweenEventSecondsMax, 2, 60);
    const maxTeamSize = clampInt(p.maxTeamSize, 1, 50);

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

  socket.on("admin_start", () => {
    if (!state.admins.has(socket.id)) return;
    if (state.phase === "playing" || state.phase === "lobby") return;
    startLobby(io, broadcastState, broadcastTop);
  });

  socket.on("admin_pause_toggle", () => {
    if (!state.admins.has(socket.id)) return;
    if (state.phase === "playing") pauseMatch(broadcastState, broadcastTop);
    else if (state.phase === "paused") resumeMatch(io, broadcastState, broadcastTop);
  });

  socket.on("admin_end", () => {
    if (!state.admins.has(socket.id)) return;
    if (state.phase === "idle") return;
    endMatch(io, broadcastState, broadcastTop, "Ended by admin");
  });

  /**
   * ✅ Reset Room:
   * - close room
   * - reset phase/timers/event
   * - force logout all players
   * - clear ALL player maps (including playersByPid + disconnect timers)
   * - ✅ delete old avatars in Supabase storage (cleanupRoomAvatars)
   */
  socket.on("admin_reset_room", async () => {
    if (!state.admins.has(socket.id)) return;

    // 1) stop accepting joins
    state.roomOpen = false;

    // 2) force logout everyone (use correct socket id field)
    for (const p of state.players.values()) {
      const sid = p?._socketId || p?.id; // ✅ correct based on your player structure
      if (sid) io.to(sid).emit("force_logout", { reason: "Room reset" });
    }

    // 3) ✅ delete avatars stored in supabase (best-effort)
    // IMPORTANT: do this BEFORE clearing playersByPid (it needs avatarPath)
    try {
      await cleanupRoomAvatars();
    } catch {
      // ignore cleanup errors (do not block reset)
    }

    // 4) clear reconnect timers (avoid memory leaks)
    if (state._pidDisconnectTimers && typeof state._pidDisconnectTimers.forEach === "function") {
      for (const t of state._pidDisconnectTimers.values()) {
        try {
          clearTimeout(t);
        } catch {}
      }
      state._pidDisconnectTimers.clear();
    }

    // 5) clear all players maps
    state.players.clear();
    state.playersByPid?.clear?.();
    state.socketIndex.clear();

    // OPTIONAL: if you have teams map in state, clear it too (safe guard)
    state.teamRooms?.clear?.();

    // 6) reset match state
    state.phase = "idle";
    state.matchId = null;
    state.round = 0;
    state.lobbyEndsAt = null;
    state.matchEndsAt = null;
    state.event = { active: false, type: null, endsAt: null };

    // OPTIONAL: reset config to defaults on reset-room (comment out if you want keep config)
    // Object.assign(CFG, { ...DEFAULT_CFG });

    broadcastState();
    broadcastTop();

    socket.emit("toast", { type: "good", message: "✅ Room reset (players cleared + avatars cleaned)" });
  });

  // ✅ NEW: Clear results (reset all scores to 0, keep room + players)
  socket.on("admin_clear_results", () => {
    if (!state.admins.has(socket.id)) return;

    resetAllScores();

    // ✅ IMPORTANT: leave game-over phase so /screen unfreezes
    state.phase = "idle";
    state.matchId = null;
    state.round = 0;
    state.lobbyEndsAt = null;
    state.matchEndsAt = null;
    state.event = { active: false, type: null, endsAt: null };

    broadcastState();
    broadcastTop();

    socket.emit("toast", { type: "good", message: "✅ Cleared results: all scores set to 0" });
  });
}