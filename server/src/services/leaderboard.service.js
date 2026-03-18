// server/src/services/leaderboard.service.js
import { state } from "../state.js";

function pickAvatarUrl(p) {
  return p.avatarUrl || p.faceUrl || p.photoUrl || "";
}

// FIX #2: Iterate playersByPid (persistent) instead of players (active sockets only).
// Players in the reconnect grace window were invisible on the leaderboard/roster.
export function topPlayers(n = 10, opts = { includeAvatar: true }) {
  const arr = [];
  for (const p of state.playersByPid.values()) {
    arr.push({
      id: p.id,
      name: p.name,
      departmentKey: p.departmentKey,
      departmentLabel: p.departmentLabel,
      departmentManager: p.departmentManager || null,
      avatarUrl: opts.includeAvatar ? pickAvatarUrl(p) : undefined,
      score: p.score,
      teamCode: p.teamCode || null,
      teamName: p.teamName || null,
    });
  }
  arr.sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
  return arr.slice(0, n);
}

export function rosterList(opts = { includeAvatar: false }) {
  const arr = [];
  for (const p of state.playersByPid.values()) {
    arr.push({
      id: p.id,
      name: p.name,
      departmentKey: p.departmentKey,
      departmentLabel: p.departmentLabel,
      departmentManager: p.departmentManager || null,
      avatarUrl: opts.includeAvatar ? pickAvatarUrl(p) : undefined,
      score: p.score,
      teamCode: p.teamCode || null,
      teamName: p.teamName || null,
    });
  }
  arr.sort((a, b) => a.name.localeCompare(b.name));
  return arr;
}
export function teamLeaderboard(n = 10) {
  const arr = [];
  for (const t of state.teamRooms.values()) {
    arr.push({
      code: t.code,
      name: t.name,
      score: t.score,
      members: t.members?.size ?? 0,
      ownerId: t.ownerId ?? null,
    });
  }
  arr.sort((a, b) => (b.score - a.score) || String(a.name || "").localeCompare(String(b.name || "")));
  return arr.slice(0, n);
}