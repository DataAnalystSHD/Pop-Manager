import { state, CFG } from "../state.js";
import { genTeamCode } from "../utils/random.js";

/** normalize team name for uniqueness check */
function normName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** clean/display name */
function cleanName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

export function isTeamNameTaken(name, exceptTeamCode = null) {
  const n = normName(name);
  if (!n) return false;

  for (const t of state.teamRooms.values()) {
    if (exceptTeamCode && String(t.code).toUpperCase() === String(exceptTeamCode).toUpperCase()) continue;
    if (normName(t.name) === n) return true;
  }
  return false;
}

/** ✅ delete team if empty (single source of truth) */
export function cleanupEmptyTeam(teamCode) {
  const code = String(teamCode || "").toUpperCase();
  const t = state.teamRooms.get(code);
  if (!t) return false;

  if (t.members.size === 0) {
    state.teamRooms.delete(code);
    return true;
  }
  return false;
}

export function createTeam({ ownerId, name }) {
  const displayName = cleanName(name);
  if (!displayName) return { ok: false, reason: "TEAM_NAME_REQUIRED" };
  if (isTeamNameTaken(displayName)) return { ok: false, reason: "TEAM_NAME_TAKEN" };

  let code = genTeamCode();
  while (state.teamRooms.has(code)) code = genTeamCode();

  const t = {
    code,
    name: displayName,
    ownerId,
    members: new Set([ownerId]),
    score: 0,
  };

  state.teamRooms.set(code, t);
  return { ok: true, team: t };
}

export function joinTeam({ playerId, code }) {
  const t = state.teamRooms.get(String(code || "").toUpperCase());
  if (!t) return { ok: false, reason: "TEAM_NOT_FOUND" };
  if (t.members.size >= (CFG.maxTeamSize || 999)) return { ok: false, reason: "TEAM_FULL" };
  t.members.add(playerId);
  return { ok: true, team: t };
}

export function renameTeam({ teamCode, name }) {
  const t = state.teamRooms.get(String(teamCode || "").toUpperCase());
  if (!t) return { ok: false, reason: "TEAM_NOT_FOUND" };

  const displayName = cleanName(name);
  if (!displayName) return { ok: false, reason: "TEAM_NAME_REQUIRED" };
  if (isTeamNameTaken(displayName, t.code)) return { ok: false, reason: "TEAM_NAME_TAKEN" };

  t.name = displayName;
  return { ok: true, team: t };
}

export function dissolveTeam(io, teamCode) {
  const code = String(teamCode || "").toUpperCase();
  const t = state.teamRooms.get(code);
  if (!t) return;

  for (const memberId of t.members) {
    const p = state.players.get(memberId);
    if (p) {
      p.teamCode = null;
      p.teamName = null;
      io.to(memberId).emit("team_update", {
        teamCode: null,
        teamName: null,
        isOwner: false,
        maxTeamSize: CFG.maxTeamSize,
      });
    }
  }
  state.teamRooms.delete(code);
}

/**
 * ✅ leaveTeam:
 * - remove player from team
 * - if team becomes empty => delete it automatically
 * - if owner left & still has members => transfer owner
 */
export function leaveTeam(io, playerId) {
  const p = state.players.get(playerId);
  if (!p?.teamCode) return;

  const code = String(p.teamCode || "").toUpperCase();
  const t = state.teamRooms.get(code);

  // clear player's team
  p.teamCode = null;
  p.teamName = null;

  // notify player privately
  io.to(playerId).emit("team_update", {
    teamCode: null,
    teamName: null,
    isOwner: false,
    maxTeamSize: CFG.maxTeamSize,
  });

  if (!t) return;

  // remove from team
  t.members.delete(playerId);

  // ✅ auto delete if empty
  if (cleanupEmptyTeam(code)) return;

  // owner transfer if needed
  if (t.ownerId === playerId) {
    const [newOwner] = t.members; // Set iterator gives first
    t.ownerId = newOwner;

    io.to(newOwner).emit("toast", { type: "info", message: "You are now the team owner." });

    // update only the new owner privately (others will get team_update from handlers if you emit)
    io.to(newOwner).emit("team_update", {
      teamCode: t.code,
      teamName: t.name,
      isOwner: true,
      maxTeamSize: CFG.maxTeamSize,
    });
  }
}