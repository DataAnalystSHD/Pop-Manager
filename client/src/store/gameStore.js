// client/src/store/gameStore.js
import { io } from "socket.io-client";

// Small helper: shallow compare arrays of primitives quickly (optional)
function sameLen(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length;
}

function asArr(v) {
  return Array.isArray(v) ? v : [];
}

function normName(s) {
  return String(s || "").trim();
}

function guessRoleFromPath() {
  try {
    const p = String(window.location?.pathname || "").toLowerCase();
    if (p.includes("/screen")) return "screen";
    if (p.includes("/admin")) return "admin";
    return "players";
  } catch {
    return "players";
  }
}

/**
 * =========================================================
 * Global Store State
 * =========================================================
 */
let state = {
  connected: false,
  roomOpen: true,
  phase: "idle",
  cfg: {},
  matchId: null,
  round: 0,
  lobbyEndsAt: null,
  matchEndsAt: null,
  event: { active: false, type: null, endsAt: null },
  warn: null,

  // UI lists (screen/admin)
  roster: [], // meta list (may omit avatars for scale)
  topPlayers: [], // ✅ FULL leaderboard (derived from roster + scoreById)
  topTeams: [],

  // compact score storage
  scoreById: Object.create(null), // { [idOrPid]: number }
  scoresTs: 0,

  toast: null,
};

const listeners = new Set();

export function getState() {
  ensureSocket(); // auto-connect on first use
  return state;
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function setState(patch) {
  state = { ...state, ...patch };
  emit();
}

/**
 * ✅ Efficient partial patch: only updates keys that actually changed
 * Helps prevent re-render storms at high frequency.
 */
export function patchState(patch) {
  let changed = false;
  const next = { ...state };

  for (const k of Object.keys(patch || {})) {
    const v = patch[k];
    if (next[k] !== v) {
      next[k] = v;
      changed = true;
    }
  }

  if (changed) {
    state = next;
    emit();
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  ensureSocket(); // auto-connect on first subscribe
  return () => listeners.delete(fn);
}

/**
 * =========================================================
 * Internal indexes for fast merge
 * =========================================================
 */
const rosterById = new Map(); // socketId -> player meta
const rosterByPid = new Map(); // pid -> player meta (if exists)

/**
 * =========================================================
 * Derivation: FULL leaderboard from roster + scores
 * - scheduled to avoid sorting too often under heavy traffic
 * =========================================================
 */
let recalcQueued = false;

function scheduleRecalcTopPlayers() {
  if (recalcQueued) return;
  recalcQueued = true;
  requestAnimationFrame(() => {
    recalcQueued = false;
    recalcTopPlayers();
  });
}

function recalcTopPlayers() {
  const roster = state.roster || [];
  const scoreMap = state.scoreById || Object.create(null);

  // Build array from rosterById (stable) to avoid huge copies
  const arr = [];
  for (const p of rosterById.values()) {
    const sid = p.id;
    const pid = p.playerId || null;

    // scores may be keyed by pid OR socketId depending on server version
    const sPid = pid ? scoreMap[pid] : undefined;
    const sSid = sid ? scoreMap[sid] : undefined;

    const score = Number(
      (sPid ?? sSid ?? p.score ?? 0) || 0
    );

    arr.push({
      ...p,
      score,
    });
  }

  // Sort score desc then name asc
  arr.sort((a, b) => {
    const ds = Number(b.score || 0) - Number(a.score || 0);
    if (ds) return ds;
    return normName(a.name).localeCompare(normName(b.name));
  });

  // Update only if actually changed by reference (cheap guard)
  // (We still replace array; UI slices and renders)
  patchState({ topPlayers: arr });
}

/**
 * =========================================================
 * Apply helpers (called by socket handlers)
 * =========================================================
 */

/**
 * ✅ Merge score snapshot (older server)
 * payload: { scores: [[id,score],...], ts, matchId }
 */
export function applyScoresSnapshot(payload) {
  if (!payload || !Array.isArray(payload.scores)) return;

  const prevMap = state.scoreById || Object.create(null);
  const nextMap = { ...prevMap };

  let changed = false;
  for (const row of payload.scores) {
    if (!row || row.length < 2) continue;
    const id = row[0];
    const s = Number(row[1] || 0);
    if (nextMap[id] !== s) {
      nextMap[id] = s;
      changed = true;
    }
  }

  if (!changed && state.scoresTs === (payload.ts || state.scoresTs)) return;

  state = {
    ...state,
    scoreById: nextMap,
    scoresTs: payload.ts || Date.now(),
    matchId: payload.matchId ?? state.matchId,
  };
  emit();
  scheduleRecalcTopPlayers();
}

/**
 * ✅ Merge score delta (new server)
 * payload: { changes: [[key,score],...], ts, matchId }
 * - key may be pid OR socketId
 * - we write both sides if mapping exists
 */
export function applyScoresDelta(payload) {
  if (!payload || !Array.isArray(payload.changes)) return;

  const prevMap = state.scoreById || Object.create(null);
  const nextMap = { ...prevMap };

  let changed = false;

  for (const row of payload.changes) {
    if (!row || row.length < 2) continue;
    const key = row[0];
    const score = Number(row[1] || 0);

    if (nextMap[key] !== score) {
      nextMap[key] = score;
      changed = true;
    }

    // If key is pid, also update its socket id score slot (if known)
    const byPid = rosterByPid.get(key);
    if (byPid?.id && nextMap[byPid.id] !== score) {
      nextMap[byPid.id] = score;
      changed = true;
    }

    // If key is socket id, also update its pid score slot (if known)
    const byId = rosterById.get(key);
    if (byId?.playerId && nextMap[byId.playerId] !== score) {
      nextMap[byId.playerId] = score;
      changed = true;
    }
  }

  if (!changed && state.scoresTs === (payload.ts || state.scoresTs)) return;

  state = {
    ...state,
    scoreById: nextMap,
    scoresTs: payload.ts || Date.now(),
    matchId: payload.matchId ?? state.matchId,
  };
  emit();
  scheduleRecalcTopPlayers();
}

/**
 * ✅ Apply top update (Top 10)
 * payload: { mode, topPlayers, topTeams, maxTeamSize }
 * - use it for:
 *   - topTeams (display)
 *   - enrich roster avatars (nice for screen)
 */
export function applyTopUpdate(payload) {
  if (!payload) return;

  const tp = asArr(payload.topPlayers);
  const tt = asArr(payload.topTeams);

  // ✅ normalize ให้เป็น reference ใหม่ + ตัวเลขจริง
  const nextTopPlayers = tp.map((p) => ({
    ...p,
    id: String(p?.id ?? ""),
    name: normName(p?.name) || "Player",
    score: Number(p?.score ?? 0),
    departmentKey: p?.departmentKey ?? "",
  }));

  const nextTopTeams = tt.map((t) => ({
    ...t,
    code: String(t?.code ?? ""),
    name: normName(t?.name) || "Team",
    score: Number(t?.score ?? 0),
    members: Number(t?.members ?? 0),
  }));

  // enrich avatarUrl into roster cache when possible + also keep score cache fresh
  const prevMap = state.scoreById || Object.create(null);
  const nextMap = { ...prevMap };
  let scoreChanged = false;

  for (const x of nextTopPlayers) {
    const sid = x.id || null;
    const pid = x.playerId || x.pid || x.player_id || null;

    const target = (sid && rosterById.get(sid)) || (pid && rosterByPid.get(pid)) || null;
    if (target) {
      if (x.avatarUrl) target.avatarUrl = x.avatarUrl;
      if (x.departmentManager) target.departmentManager = x.departmentManager;
      // ✅ keep roster score updated too (optional)
      target.score = Number(x.score || 0);
    }

    // ✅ keep scoreById updated from top_update (so derive path also works)
    if (sid && nextMap[sid] !== x.score) { nextMap[sid] = x.score; scoreChanged = true; }
    if (pid && nextMap[pid] !== x.score) { nextMap[pid] = x.score; scoreChanged = true; }
  }

  const nextCfg = { ...(state.cfg || {}) };
  if (payload.mode) nextCfg.mode = payload.mode;
  if (payload.maxTeamSize) nextCfg.maxTeamSize = payload.maxTeamSize;

  // ✅ IMPORTANT: set topPlayers directly so Leaderboard updates immediately
  state = {
    ...state,
    cfg: nextCfg,
    topPlayers: nextTopPlayers,            // <—— FIX
    topTeams: nextTopTeams,                // <—— also always update
    ...(scoreChanged ? { scoreById: nextMap, scoresTs: Date.now() } : null),
  };
  emit();
}

/**
 * ✅ Apply roster meta (rare)
 * payload: { roster: [...] }
 */
export function applyRoster(payload) {
  const r = payload?.roster;
  if (!Array.isArray(r)) return;

  // Build indexes
  rosterById.clear();
  rosterByPid.clear();

  for (const item of r) {
    if (!item) continue;

    const id = item.id || item.socketId || item.sid;
    if (!id) continue;

    const playerId = item.playerId || item.pid || item.persistentId || null;

    const merged = {
      ...item,
      id,
      playerId,
      score: Number(item.score || 0),
    };

    rosterById.set(id, merged);
    if (playerId) rosterByPid.set(playerId, merged);
  }

  // Guard: avoid useless re-render if identical reference
  if (sameLen(state.roster, r) && state.roster === r) return;

  state = { ...state, roster: r };
  emit();
  scheduleRecalcTopPlayers();
}

/**
 * =========================================================
 * Socket wiring (Singleton)
 * =========================================================
 */
let socket = null;
let connecting = false;
let role = guessRoleFromPath();

// FIX #1: Export a getter so PlayerPage (and any other consumer) can access
// the singleton socket without relying on window.__SOCKET__, which was never set.
export function getSocket() {
  ensureSocket();
  return socket;
}

export function setClientRole(nextRole) {
  role = nextRole || role;
  if (socket && socket.connected) {
    socket.emit("join_role", { role });
    if (role === "screen" || role === "admin") socket.emit("request_roster");
  }
}

function ensureSocket() {
  if (socket || connecting) return;
  connecting = true;

  socket = io({
    autoConnect: true,
    transports: ["websocket"], // ✅ best for Render + many clients
    withCredentials: false,
  });
  let rosterPollTimer = null;

    const startRosterPoll = () => {
      if (rosterPollTimer) return;
      // FIX #10: Raised from 1200ms to 10000ms.
      // The server's dirty-flag push already handles roster updates in real time.
      // The poll is only a safety net for edge cases (missed push during reconnect).
      // At 1.2s with 3 screen/admin clients: ~2.5 rosterList() serialisations/sec
      // across 300-400 players. At 10s that drops to ~0.3/sec — negligible.
      rosterPollTimer = setInterval(() => {
        try {
          if (!socket?.connected) return;
          if (role === "screen" || role === "admin") {
            socket.emit("request_roster");
          }
        } catch {}
      }, 10000);
    };

    const stopRosterPoll = () => {
      if (rosterPollTimer) {
        clearInterval(rosterPollTimer);
        rosterPollTimer = null;
      }
    };

  socket.on("connect", () => {
    patchState({ connected: true });

    socket.emit("join_role", { role });

    if (role === "screen" || role === "admin") {
      socket.emit("request_roster");
      startRosterPoll(); // ✅ keep screen updated even if server doesn't push
    }
  });

  socket.on("disconnect", () => {
    patchState({ connected: false });
    stopRosterPoll();
  });

  socket.on("toast", (t) => {
    patchState({ toast: t || null });
  });

  socket.on("hello", (p = {}) => {
    if (p?.cfg) patchState({ cfg: p.cfg });
    if (p?.phase) patchState({ phase: p.phase });
  });

  socket.on("state", (p = {}) => {
    patchState({
      roomOpen: !!p.roomOpen,
      phase: p.phase ?? state.phase,
      matchId: p.matchId ?? state.matchId,
      round: p.round ?? state.round,
      lobbyEndsAt: p.lobbyEndsAt ?? state.lobbyEndsAt,
      matchEndsAt: p.matchEndsAt ?? state.matchEndsAt,
      cfg: p.cfg ?? state.cfg,
      event: p.event ?? state.event,
      warn: p.warn ?? null,
    });
  });

  socket.on("roster", (p = {}) => {
    console.log("[socket] roster", { n: (p?.roster || []).length, sample: p?.roster?.[0] });
    applyRoster(p);
  });
  socket.on("roster_update", (p = {}) => applyRoster(p));
  socket.on("roster_changed", (p = {}) => applyRoster(p));
  socket.on("roster_full", (p = {}) => applyRoster(p));
  socket.on("top_update", (p = {}) => {
  console.log("[socket] top_update", {
    n: (p?.topPlayers || []).length,
    sample: p?.topPlayers?.[0],
    hasAvatar: Boolean(p?.topPlayers?.[0]?.avatarUrl),
  });
  applyTopUpdate(p);
});

  // ✅ NEW server path
  socket.on("scores_delta", (p = {}) => applyScoresDelta(p));

  // ✅ Fallback old server
  socket.on("scores_snapshot", (p = {}) => applyScoresSnapshot(p));

  // FIX #1 part A: Handle event lifecycle in the store so these are available
  // to ALL pages (Player, Screen, Admin) via a single shared socket.
  // Previously these were only handled in App.jsx's second socket instance.
  let _warnTimer = null;
  socket.on("event_warning", ({ seconds } = {}) => {
    if (_warnTimer) clearInterval(_warnTimer);
    let left = Number(seconds || 3);
    patchState({ warn: { left } });
    _warnTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(_warnTimer);
        _warnTimer = null;
        patchState({ warn: null });
      } else {
        patchState({ warn: { left } });
      }
    }, 1000);
  });

  socket.on("event_start", ({ type, endsAt } = {}) => {
    if (_warnTimer) { clearInterval(_warnTimer); _warnTimer = null; }
    patchState({
      warn: null,
      event: { active: true, type: type || null, endsAt: endsAt || null },
      toast: { type: type === "BOMB" ? "bad" : "good", message: type === "BOMB" ? "BOMB (-5)!" : "BONUS (+2)!" },
    });
  });

  socket.on("event_end", () => {
    patchState({ event: { active: false, type: null, endsAt: null } });
  });

  socket.on("results", () => {
    patchState({ phase: "ended" });
  });

  connecting = false;
}