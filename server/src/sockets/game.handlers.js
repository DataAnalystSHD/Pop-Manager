// C:\Users\User\Documents\pop-manager-fixed\server\src\sockets\game.handlers.js
import { state, getPlayerBySocketId } from "../state.js";

const MAX_CLICKS_PER_SEC = 20;
const WINDOW_MS = 1000;

export function attachGameHandlers(io, socket, broadcastState, broadcastTop) {
  socket.on("action_click", () => {
    const p = getPlayerBySocketId(socket.id);
    if (!p) return;
    if (state.phase !== "playing") return;

    const now = Date.now();

    if (!p._rl) p._rl = { t: now, n: 0 };

    if (now - p._rl.t > WINDOW_MS) {
      p._rl.t = now;
      p._rl.n = 0;
    }

    p._rl.n += 1;
    if (p._rl.n > MAX_CLICKS_PER_SEC) return;

    p._pendingClicks = (p._pendingClicks || 0) + 1;

    
  });
}