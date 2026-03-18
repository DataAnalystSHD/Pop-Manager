// server/src/state.js
import { DEFAULT_CFG } from "./config.js";

/**
 * ==========================================
 * Runtime Config (admin can modify)
 * ==========================================
 */
export const CFG = { ...DEFAULT_CFG };

/**
 * ==========================================
 * Global State
 * ==========================================
 * Player object schema (as used in your code):
 * - player.id        = socket.id  (for UI/leaderboard compatibility)
 * - player.playerId  = persistent id (pid) for reconnect
 * - player._socketId = current socket mapping (active socket)
 *
 * Maps:
 * - players: socketId -> player (active sockets only)
 * - playersByPid: pid -> player (persistent identity across reconnect)
 * - socketIndex: socketId -> pid (fast lookup / safety)
 */
export const state = {
  // room
  roomOpen: true,

  // match state
  phase: "idle",
  matchId: null,
  round: 0,
  lobbyEndsAt: null,
  matchEndsAt: null,

  // players
  players: new Map(), // socketId -> player (active)
  playersByPid: new Map(), // pid -> player (persistent)
  socketIndex: new Map(), // socketId -> pid

  // admins
  admins: new Set(),

  // teams
  teamRooms: new Map(),

  // event
  event: { active: false, type: null, endsAt: null },
  warn: null,

  // reconnect grace timers
  _pidDisconnectTimers: new Map(), // pid -> timeout

  // match timers
  _timers: {
    lobbyEnd: null,
    matchEnd: null,
    warnEnd: null,
    eventEnd: null,
    nextCycle: null,
  },
};

/**
 * ==========================================
 * Helpers
 * ==========================================
 */

export function getPlayerBySocketId(socketId) {
  return state.players.get(socketId) || null;
}

export function getPidBySocketId(socketId) {
  return state.socketIndex.get(socketId) || null;
}

export function getPlayerByPid(pid) {
  return state.playersByPid.get(pid) || null;
}

/**
 * Attach player to a socket (used on join/rejoin).
 * Keeps ONE player object shared across maps (no cloning).
 */
export function attachPlayerSocket(player, socketId) {
  if (!player || !socketId) return;

  const pid = player.playerId;
  if (!pid) return;

  // clean old socket mapping (if any)
  if (player._socketId && player._socketId !== socketId) {
    state.players.delete(player._socketId);
    state.socketIndex.delete(player._socketId);
  }

  // update player fields to match your current convention
  player._socketId = socketId;
  player.id = socketId; // important: keep id = socket.id for UI compatibility

  // active maps
  state.players.set(socketId, player);
  state.socketIndex.set(socketId, pid);

  // persistent map
  state.playersByPid.set(pid, player);
}

/**
 * Detach socket mapping on disconnect.
 * Does NOT delete persistent record immediately (grace handles).
 */
export function detachPlayerSocket(socketId) {
  const pid = state.socketIndex.get(socketId) || null;

  state.players.delete(socketId);
  state.socketIndex.delete(socketId);

  if (!pid) return null;

  const player = state.playersByPid.get(pid) || null;
  if (player && player._socketId === socketId) {
    player._socketId = null;
    // keep player.id as last socketId (UI harmless), or null it if you prefer
    // player.id = null;
  }

  return player;
}

/**
 * ==========================================
 * Reset all player scores (keep them joined)
 * ==========================================
 * IMPORTANT:
 * - Mutate in place so all references remain consistent.
 */
export function resetAllScores() {
  for (const p of state.playersByPid.values()) {
    p.score = 0;
    p._pendingClicks = 0;
    p._rl = null;
  }
}

/**
 * ==========================================
 * Reconnect Grace System
 * ==========================================
 */

/**
 * Start disconnect timer
 * If player does not reconnect within GRACE_MS,
 * remove them permanently.
 */
export function setDisconnectTimer(pid, graceMs = 10_000) {
  if (!pid) return;

  clearDisconnectTimer(pid);

  const timer = setTimeout(() => {
    const player = state.playersByPid.get(pid);
    if (!player) return;

    // remove from active socket map if still mapped
    if (player._socketId) {
      state.players.delete(player._socketId);
      state.socketIndex.delete(player._socketId);
      player._socketId = null;
    }

    // remove persistent record
    state.playersByPid.delete(pid);
    state._pidDisconnectTimers.delete(pid);
  }, graceMs);

  state._pidDisconnectTimers.set(pid, timer);
}

/**
 * Clear reconnect timer if player comes back
 */
export function clearDisconnectTimer(pid) {
  const timer = state._pidDisconnectTimers.get(pid);
  if (timer) {
    clearTimeout(timer);
    state._pidDisconnectTimers.delete(pid);
  }
}

/**
 * Hard remove player by pid (no grace)
 */
export function removePlayerByPid(pid) {
  if (!pid) return;

  clearDisconnectTimer(pid);

  const player = state.playersByPid.get(pid);
  if (!player) return;

  if (player._socketId) {
    state.players.delete(player._socketId);
    state.socketIndex.delete(player._socketId);
  }

  state.playersByPid.delete(pid);
}