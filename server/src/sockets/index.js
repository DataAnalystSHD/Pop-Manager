// server/src/sockets/index.js
import "dotenv/config";
import { state, CFG } from "../state.js";
import { rosterList, topPlayers, teamLeaderboard } from "../services/leaderboard.service.js";
import { attachAdminHandlers } from "./admin.handlers.js";
import { attachPlayerHandlers } from "./player.handlers.js";
import { attachTeamHandlers } from "./team.handlers.js";
import { attachGameHandlers } from "./game.handlers.js";

/**
 * ==========================================
 * Payload builders
 * ==========================================
 */
function makeStatePayload() {
  return {
    roomOpen: state.roomOpen,
    phase: state.phase,
    matchId: state.matchId,
    round: state.round,
    lobbyEndsAt: state.lobbyEndsAt,
    matchEndsAt: state.matchEndsAt,
    cfg: { ...CFG },
    event: {
      active: !!state.event.active,
      type: state.event.active ? state.event.type : null,
      endsAt: state.event.endsAt,
    },
    warn: state.warn ?? null,
  };
}

function makeTopPayload({ includeAvatar = true } = {}) {
  return {
    mode: CFG.mode,
    topPlayers: topPlayers(10, { includeAvatar }),
    topTeams: teamLeaderboard(10),
    maxTeamSize: CFG.maxTeamSize,
  };
}

/**
 * ==========================================
 * Socket handlers + tick loops
 * ==========================================
 */
export function attachSocketHandlers(io) {
  let dirtyState = false;
  let dirtyTop = false;
  let dirtyRoster = false;

  const requestStateBroadcast = () => (dirtyState = true);
  const requestTopBroadcast = () => (dirtyTop = true);
  const requestRosterBroadcast = () => (dirtyRoster = true);

  io.on("connection", (socket) => {
    // initial payload only to this socket
    socket.emit("hello", { phase: state.phase, cfg: { ...CFG } });
    socket.emit("state", makeStatePayload());

    // role-based rooms (IMPORTANT)
    socket.on("join_role", ({ role } = {}) => {
      // always leave first to avoid accidental multiple room membership
      socket.leave("players");
      socket.leave("screen");
      socket.leave("admin");

      // FIX #5: Anyone sending { role: "admin" } used to receive scores_delta,
      // roster, and all admin-room broadcasts without any auth check.
      // Now we downgrade unauthenticated admin requests to the "players" room.
      let resolvedRole = role;
      if (role === "admin" && !state.admins.has(socket.id)) {
        resolvedRole = "players";
      }

      if (resolvedRole === "screen") socket.join("screen");
      else if (resolvedRole === "admin") socket.join("admin");
      else socket.join("players");

      // Immediately push current data to THIS socket (no waiting)
      socket.emit("state", makeStatePayload());
      socket.emit("top_update", makeTopPayload({ includeAvatar: true }));

      // roster only for screen/admin
      if (resolvedRole === "screen" || resolvedRole === "admin") {
        socket.emit("roster", { roster: rosterList({ includeAvatar: true }) });
      }
    });

    // roster on demand (NO AVATARS for big roster)
    socket.on("request_roster", () => {
      socket.emit("roster", { roster: rosterList({ includeAvatar: false }) });
    });

    attachAdminHandlers(io, socket, requestStateBroadcast, requestTopBroadcast);
    attachPlayerHandlers(io, socket, requestStateBroadcast, requestTopBroadcast, requestRosterBroadcast);
    attachTeamHandlers(io, socket, requestStateBroadcast, requestTopBroadcast, requestRosterBroadcast);
    attachGameHandlers(io, socket, requestStateBroadcast, requestTopBroadcast);

    // NOTE:
    // Player disconnect cleanup (playersByPid grace) is handled in player.handlers.js
    socket.on("disconnect", () => {
      // admins can be removed immediately
      state.admins.delete(socket.id);

      requestStateBroadcast();
      requestTopBroadcast();
      requestRosterBroadcast();
    });
  });

  /**
   * ==========================================
   * Tick loop (score apply)
   * ==========================================
   * - Apply _pendingClicks in batches
   * - Emit:
   *   - my_score: only to changed players
   *   - scores_delta: to screen/admin (throttled) ✅ now ACCUMULATED (no drop)
   *   - top_update: to all roles (throttled + only when changed)
   */
  const TICK_MS = 200;

  // ✅ screen/admin throttles (for 400–500 players)
  const SNAPSHOT_MS = Number(process.env.SCORES_SNAPSHOT_MS || 500);
  const TOP_MS = Number(process.env.TOP_UPDATE_MS || 700);

  let lastSnapAt = 0;
  let lastTopAt = 0;

  // ✅ IMPORTANT: accumulate deltas between flushes so nothing is dropped
  // key = pid (preferred) or socket id fallback, value = latest score
  const pendingDelta = new Map();

  setInterval(() => {
    // changed sockets for my_score
    const changedSockets = []; // [[socketId, score], ...]

    if (state.phase === "playing") {
      for (const p of state.players.values()) {
        const c = p._pendingClicks || 0;
        if (!c) continue;

        // consume pending
        p._pendingClicks = 0;

        // event-aware delta
        let deltaPerClick = 1;
        if (state.event.active) {
          if (state.event.type === "BOMB") deltaPerClick = -CFG.bombPenalty;
          else if (state.event.type === "BONUS") deltaPerClick = CFG.bonusGain;
        }

        const delta = c * deltaPerClick;
        if (!delta) continue;

        // apply score
        p.score += delta;

        // team score
        if (CFG.mode === "TEAM" && p.teamCode) {
          const t = state.teamRooms.get(p.teamCode);
          if (t) t.score += delta;
        }

        // ✅ accumulate for screen/admin (pid preferred)
        const pid = p.playerId || p.id;
        pendingDelta.set(pid, p.score);

        // my_score needs socket id
        const sid = p._socketId || p.id;
        if (sid) changedSockets.push([sid, p.score]);
      }

      if (changedSockets.length) {
        dirtyTop = true;
        const now = Date.now();

        // ✅ my_score: only to affected sockets
        for (const [sid, score] of changedSockets) {
          io.to(sid).volatile.emit("my_score", { score, ts: now, matchId: state.matchId });
        }

        // ✅ screen/admin: flush accumulated delta only on throttle
        if (now - lastSnapAt >= SNAPSHOT_MS && pendingDelta.size) {
          const changes = Array.from(pendingDelta.entries()); // [[pid, score], ...]
          pendingDelta.clear();

          const payload = { changes, ts: now, matchId: state.matchId };
          io.to("screen").volatile.emit("scores_delta", payload);
          io.to("admin").volatile.emit("scores_delta", payload);

          lastSnapAt = now;
        }
      }
    } else {
      // if not playing, keep pendingDelta clean
      if (pendingDelta.size) pendingDelta.clear();
    }

    // ✅ state broadcast (rare)
    if (dirtyState) {
      dirtyState = false;
      io.emit("state", makeStatePayload());
    }

    // ✅ top update — throttled
    if (dirtyTop) {
      const now = Date.now();
      if (now - lastTopAt >= TOP_MS) {
        dirtyTop = false;
        lastTopAt = now;

        const payload = makeTopPayload({ includeAvatar: true });
        io.to("players").volatile.emit("top_update", payload);
        io.to("screen").volatile.emit("top_update", payload);
        io.to("admin").volatile.emit("top_update", payload);
      }
    }

    // ✅ roster update (rare) — screen/admin only
    if (dirtyRoster) {
      dirtyRoster = false;
      const roster = rosterList({ includeAvatar: true });
      io.to("screen").emit("roster", { roster });
      io.to("admin").emit("roster", { roster });
    }
  }, TICK_MS);
}