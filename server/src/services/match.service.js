import { state, CFG, resetAllScores } from "../state.js";
import { now } from "../utils/time.js";
import { newId } from "../utils/random.js";
import { stopEventCycle, scheduleNextCycle, clearAllTimersPublic } from "./eventCycle.service.js";

export function resetForMatch() {
  state.round = 0;
  stopEventCycle();
  state.lobbyEndsAt = null;
  state.matchEndsAt = null;

  // FIX #3: Use resetAllScores() which iterates playersByPid (persistent map).
  // The old inline loop used state.players and missed grace-period reconnectors.
  resetAllScores();
  for (const t of state.teamRooms.values()) t.score = 0;
}

export function startLobby(io, broadcastState, broadcastTop) {
  clearAllTimersPublic();
  state.matchId = newId();
  resetForMatch();

  state.lobbyEndsAt = now() + CFG.lobbySeconds * 1000;
  state.phase = "lobby";
  broadcastState();
  broadcastTop();

  state._timers.lobbyEnd = setTimeout(() => {
    if (state.phase !== "lobby") return;
    startMatch(io, broadcastState, broadcastTop);
  }, CFG.lobbySeconds * 1000);
}

export function startMatch(io, broadcastState, broadcastTop) {
  clearAllTimersPublic();

  state.matchEndsAt = now() + CFG.matchSeconds * 1000;
  state.lobbyEndsAt = null;
  state.phase = "playing";
  broadcastState();
  broadcastTop();

  state._timers.matchEnd = setTimeout(() => {
    if (state.phase !== "playing") return;
    endMatch(io, broadcastState, broadcastTop, "Time up");
  }, Math.max(0, state.matchEndsAt - now()));

  scheduleNextCycle(io, broadcastState);
}

export function pauseMatch(broadcastState, broadcastTop) {
  if (state.phase !== "playing") return;
  clearAllTimersPublic();
  state.phase = "paused";
  broadcastState();
  broadcastTop();
}

export function resumeMatch(io, broadcastState, broadcastTop) {
  if (state.phase !== "paused") return;
  state.phase = "playing";
  broadcastState();
  broadcastTop();

  const remaining = Math.max(0, (state.matchEndsAt || now()) - now());
  state._timers.matchEnd = setTimeout(() => {
    if (state.phase !== "playing") return;
    endMatch(io, broadcastState, broadcastTop, "Time up");
  }, remaining);

  scheduleNextCycle(io, broadcastState);
}

export function endMatch(io, broadcastState, broadcastTop, reason = "ended") {
  clearAllTimersPublic();
  state.phase = "ended";
  broadcastState();
  broadcastTop();

  io.emit("results", { reason });

  
}