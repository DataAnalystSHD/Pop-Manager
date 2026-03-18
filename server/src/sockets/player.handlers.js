// server/src/sockets/player.handlers.js
import { state, clearDisconnectTimer, setDisconnectTimer } from "../state.js";
import { resolveDepartment, refreshDepartmentsCache } from "../services/departments.service.js";
import { supabase } from "../services/supabase.service.js";

const MAX_AVATAR_CHARS = 220_000;
const BUCKET = process.env.SUPABASE_AVATAR_BUCKET || "click-arena-avatars";

// how long we keep an account after disconnect (refresh)
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS || 60_000);

function asStr(v) {
  return String(v ?? "").trim();
}
function isDataImageUrl(s) {
  return typeof s === "string" && s.startsWith("data:image/");
}
function isHttpUrl(s) {
  return typeof s === "string" && /^https?:\/\/.+/i.test(s);
}
function isValidPlayerId(pid) {
  const s = asStr(pid);
  if (!s) return false;
  if (s.length < 8 || s.length > 80) return false;
  return /^[a-zA-Z0-9_\-:]+$/.test(s);
}

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { contentType: m[1], b64: m[2] };
}

function extFromContentType(ct) {
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  return "jpg";
}

function safePidForPath(pid) {
  return String(pid || "")
    .trim()
    .replace(/[^a-zA-Z0-9_\-:]/g, "_")
    .slice(0, 80);
}

/**
 * Upload avatar with stable path by playerId (upsert/replace)
 * Path: public/players/<playerId>.<ext>
 * returns { publicUrl, path }
 */
async function uploadAvatarDataUrl({ playerId, dataUrl }) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("INVALID_DATA_URL");

  const { contentType, b64 } = parsed;
  const buf = Buffer.from(b64, "base64");
  if (!buf || buf.length < 50) throw new Error("AVATAR_EMPTY");

  const ext = extFromContentType(contentType);
  const pid = safePidForPath(playerId);
  if (!pid) throw new Error("PLAYER_ID_REQUIRED");

  const storagePath = `public/players/${pid}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
    contentType,
    upsert: true,
    cacheControl: "60",
  });

  if (error) throw new Error(error.message || "UPLOAD_FAILED");

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error("PUBLIC_URL_FAILED");

  const v = Date.now();
  return { publicUrl: `${publicUrl}?v=${v}`, path: storagePath };
}

/**
 * Call on RESET ROOM — deletes all avatar files in storage
 */
export async function cleanupRoomAvatars() {
  try {
    const paths = [];
    for (const p of state.playersByPid.values()) {
      if (p?.avatarPath) paths.push(p.avatarPath);
    }
    const uniq = Array.from(new Set(paths));
    if (!uniq.length) return { ok: true, deleted: 0 };

    await supabase.storage.from(BUCKET).remove(uniq).catch(() => {});
    return { ok: true, deleted: uniq.length };
  } catch {
    return { ok: false, deleted: 0 };
  }
}

function detachOldSocketMapping(player) {
  if (!player?._socketId) return;
  if (state.players.get(player._socketId) === player) {
    state.players.delete(player._socketId);
    state.socketIndex.delete(player._socketId);
  }
}

function attachNewSocketMapping(socketId, player) {
  player._socketId = socketId;
  player.id = socketId;
  state.players.set(socketId, player);

  const pid = player.playerId;
  if (pid) state.socketIndex.set(socketId, pid);
}

export function attachPlayerHandlers(io, socket, requestStateBroadcast, requestTopBroadcast, requestRosterBroadcast) {

  // FIX #6: Per-socket join rate limiter.
  // Without this, a single connection could spam `join` events and trigger
  // a new Supabase avatar upload on each one. 3-second cooldown between attempts.
  const JOIN_COOLDOWN_MS = 3000;
  let lastJoinAt = 0;

  // ─── JOIN / REJOIN ────────────────────────────────────────────────────────
  socket.on("join", async ({ playerId, name, departmentKey, avatarUrl } = {}) => {
    const now = Date.now();
    if (now - lastJoinAt < JOIN_COOLDOWN_MS) {
      socket.emit("toast", { type: "warning", message: "Please wait a moment before trying again." });
      return;
    }
    lastJoinAt = now;

    try {
      if (!state.roomOpen) {
        socket.emit("join_denied", { reason: "ROOM_CLOSED" });
        socket.emit("toast", { type: "info", message: "Room is closed. Please wait for admin to open." });
        return;
      }

      const pid = asStr(playerId);

      // ── REJOIN PATH (refresh / reconnect) ──────────────────────────────
      if (pid && isValidPlayerId(pid) && state.playersByPid.has(pid)) {
        const existing = state.playersByPid.get(pid);

        clearDisconnectTimer(pid);
        detachOldSocketMapping(existing);
        attachNewSocketMapping(socket.id, existing);

        // Update name if provided
        const safeName = asStr(name).slice(0, 18);
        if (safeName) existing.name = safeName;

        // ✅ Update department only if key provided AND resolves to a real dept
        if (departmentKey) {
          let dept = resolveDepartment(departmentKey);
          if (!dept) {
            // Cache might be cold — refresh once and retry
            try { await refreshDepartmentsCache(); } catch {}
            dept = resolveDepartment(departmentKey);
          }
          if (dept) {
            existing.departmentKey = dept.id;
            existing.departmentLabel = dept.name;
            existing.departmentManager = dept.manager || null;
          }
          // If still null, keep existing dept — never overwrite with fallback
        }

        // Update avatar if provided
        const av = asStr(avatarUrl);
        if (av) {
          if (isDataImageUrl(av)) {
            if (av.length > MAX_AVATAR_CHARS) {
              socket.emit("join_denied", { reason: "AVATAR_TOO_LARGE" });
              socket.emit("toast", { type: "warning", message: "Avatar too large. Please upload a smaller image." });
              return;
            }
            const up = await uploadAvatarDataUrl({ playerId: pid, dataUrl: av });
            existing.avatarUrl = up.publicUrl;
            existing.avatarPath = up.path;
          } else if (isHttpUrl(av)) {
            existing.avatarUrl = av;
            existing.avatarPath = null;
          }
        }

        socket.emit("joined", { ...existing, id: socket.id, playerId: pid });
        requestRosterBroadcast();
        requestStateBroadcast();
        requestTopBroadcast();
        return;
      }

      // ── NEW JOIN PATH ───────────────────────────────────────────────────
      if (!pid || !isValidPlayerId(pid)) {
        socket.emit("join_denied", { reason: "PLAYER_ID_REQUIRED" });
        return;
      }

      const safeName = asStr(name).slice(0, 18) || "Player";

      if (!departmentKey) {
        socket.emit("join_denied", { reason: "DEPARTMENT_REQUIRED" });
        socket.emit("toast", { type: "warning", message: "Please select a department before joining." });
        return;
      }

      // ✅ Resolve dept — retry once if cache was cold (Render cold start)
      let dept = resolveDepartment(departmentKey);
      if (!dept) {
        try { await refreshDepartmentsCache(); } catch {}
        dept = resolveDepartment(departmentKey);
      }
      if (!dept) {
        socket.emit("join_denied", { reason: "DEPARTMENT_NOT_FOUND" });
        socket.emit("toast", { type: "warning", message: "Department not found. Please try again in a moment." });
        return;
      }

      const av = asStr(avatarUrl);
      if (!av) {
        socket.emit("join_denied", { reason: "AVATAR_REQUIRED" });
        socket.emit("toast", { type: "warning", message: "Please upload a face picture before joining." });
        return;
      }

      if (isDataImageUrl(av) && av.length > MAX_AVATAR_CHARS) {
        socket.emit("join_denied", { reason: "AVATAR_TOO_LARGE" });
        socket.emit("toast", { type: "warning", message: "Avatar too large. Please upload a smaller image." });
        return;
      }

      let publicUrl = "";
      let avatarPath = null;

      if (isDataImageUrl(av)) {
        const up = await uploadAvatarDataUrl({ playerId: pid, dataUrl: av });
        publicUrl = up.publicUrl;
        avatarPath = up.path;
      } else if (isHttpUrl(av)) {
        publicUrl = av;
      } else {
        socket.emit("join_denied", { reason: "AVATAR_REQUIRED" });
        socket.emit("toast", { type: "warning", message: "Invalid avatar format. Please re-upload." });
        return;
      }

      const player = {
        id: socket.id,
        playerId: pid,
        _socketId: socket.id,
        name: safeName,
        departmentKey: dept.id,
        departmentLabel: dept.name,
        departmentManager: dept.manager || null,
        avatarUrl: publicUrl,
        avatarPath,
        score: 0,
        teamCode: null,
        teamName: null,
        _rl: null,
        _pendingClicks: 0,
      };

      state.players.set(socket.id, player);
      state.playersByPid.set(pid, player);
      state.socketIndex.set(socket.id, pid);

      socket.emit("joined", { ...player, playerId: pid });
      requestRosterBroadcast();
      requestStateBroadcast();
      requestTopBroadcast();

    } catch (e) {
      // ✅ Specific error logging — never hide real cause
      console.error("[join] unhandled error:", e?.message || e);

      if (e?.message === "UPLOAD_FAILED" || e?.message === "INVALID_DATA_URL" || e?.message === "AVATAR_EMPTY") {
        socket.emit("join_denied", { reason: "AVATAR_UPLOAD_FAILED" });
        socket.emit("toast", { type: "error", message: "Avatar upload failed. Please try again." });
      } else {
        socket.emit("join_denied", { reason: "SERVER_ERROR" });
        socket.emit("toast", { type: "error", message: "Server error. Please try again in a moment." });
      }
    }
  });

  // ─── PLAYER DELETES OWN ACCOUNT ───────────────────────────────────────────
  socket.on("player_delete_account", ({ playerId } = {}) => {
    const pid = asStr(playerId);
    if (!pid) return;

    const p = state.playersByPid.get(pid);
    if (!p) return;

    // Only the owning socket can delete
    if (p._socketId !== socket.id) return;

    if (p._socketId) {
      state.players.delete(p._socketId);
      state.socketIndex.delete(p._socketId);
    }
    state.playersByPid.delete(pid);
    clearDisconnectTimer(pid);

    socket.emit("force_logout", { reason: "Account deleted." });
    requestRosterBroadcast();
    requestStateBroadcast();
    requestTopBroadcast();
  });

  // ─── DISCONNECT (grace period — allow refresh) ────────────────────────────
  socket.on("disconnect", () => {
    const p = state.players.get(socket.id);
    if (!p) return;

    state.players.delete(socket.id);
    state.socketIndex.delete(socket.id);

    const pid = p.playerId;
    if (!pid) return;

    clearDisconnectTimer(pid);
    setDisconnectTimer(pid, RECONNECT_GRACE_MS);

    requestRosterBroadcast();
    requestStateBroadcast();
    requestTopBroadcast();
  });
}
