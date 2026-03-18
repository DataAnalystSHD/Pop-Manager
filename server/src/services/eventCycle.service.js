import { state, CFG } from "../state.js";
import { now } from "../utils/time.js";
import { randInt, pickEventType } from "../utils/random.js";

function safeClearTimeout(k) {
  if (state._timers[k]) clearTimeout(state._timers[k]);
  state._timers[k] = null;
}
function clearAllTimers() {
  for (const k of Object.keys(state._timers)) safeClearTimeout(k);
}

export function stopEventCycle() {
  safeClearTimeout("warnEnd");
  safeClearTimeout("eventEnd");
  safeClearTimeout("nextCycle");
  state.event = { active: false, type: null, endsAt: null };
  // FIX #8: clear warn so clients that join mid-game don't see a stale warning
  state.warn = null;
}

export function scheduleNextCycle(io, broadcastState) {
  if (state.phase !== "playing") return;

  const waitSec = randInt(CFG.betweenEventSecondsMin, CFG.betweenEventSecondsMax);
  safeClearTimeout("nextCycle");
  state._timers.nextCycle = setTimeout(() => {
    if (state.phase !== "playing") return;
    startWarningThenEvent(io, broadcastState);
  }, waitSec * 1000);
}

export function startWarningThenEvent(io, broadcastState) {
  if (state.phase !== "playing") return;

  state.round += 1;

  // FIX #8: Persist warn in state so clients that reconnect mid-warning
  // receive it via the next state broadcast instead of missing it entirely.
  const warnEndsAt = now() + CFG.warnSeconds * 1000;
  state.warn = { seconds: CFG.warnSeconds, endsAt: warnEndsAt };

  io.emit("event_warning", { seconds: CFG.warnSeconds });

  safeClearTimeout("warnEnd");
  state._timers.warnEnd = setTimeout(() => {
    if (state.phase !== "playing") return;
    state.warn = null;
    startEventWindow(io, broadcastState);
  }, CFG.warnSeconds * 1000);

  broadcastState();
}

export function startEventWindow(io, broadcastState) {
  if (state.phase !== "playing") return;

  const sec = randInt(CFG.eventSecondsMin, CFG.eventSecondsMax);
  const type = pickEventType();

  state.warn = null;
  state.event.active = true;
  state.event.type = type;
  state.event.endsAt = now() + sec * 1000;

  io.emit("event_start", { type, duration: sec, endsAt: state.event.endsAt });
  broadcastState();

  safeClearTimeout("eventEnd");
  state._timers.eventEnd = setTimeout(() => {
    if (state.phase !== "playing") return;

    state.event = { active: false, type: null, endsAt: null };
    state.warn = null;
    io.emit("event_end", {});
    broadcastState();
    scheduleNextCycle(io, broadcastState);
  }, sec * 1000);
}

export function clearAllTimersPublic() {
  clearAllTimers();
}