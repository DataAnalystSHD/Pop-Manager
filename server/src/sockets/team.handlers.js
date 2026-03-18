import { state, CFG } from "../state.js";
import { createTeam, joinTeam, leaveTeam, dissolveTeam, renameTeam } from "../services/team.service.js";

function toastForTeamNameError(socket, reason) {
  if (reason === "TEAM_NAME_REQUIRED") return socket.emit("toast", { type: "error", message: "Please enter a team name." });
  if (reason === "TEAM_NAME_TAKEN") return socket.emit("toast", { type: "error", message: "This team name is already taken." });
  return socket.emit("toast", { type: "error", message: "Team name is invalid." });
}

export function attachTeamHandlers(io, socket, broadcastState, broadcastTop) {
  socket.on("team_create", ({ teamName } = {}) => {
    const p = state.players.get(socket.id);
    if (!p) return;

    if (CFG.mode !== "TEAM") return socket.emit("toast", { type: "error", message: "Team mode is OFF" });

    if (p.teamCode) leaveTeam(io, p.id);

    const res = createTeam({ ownerId: p.id, name: teamName });
    if (!res.ok) return toastForTeamNameError(socket, res.reason);

    const t = res.team;
    p.teamCode = t.code;
    p.teamName = t.name;

    // ✅ private (ok to include code)
    socket.emit("team_update", { teamCode: t.code, teamName: t.name, isOwner: true, maxTeamSize: CFG.maxTeamSize });
    broadcastState();
    broadcastTop();
  });

  socket.on("team_join", ({ code } = {}) => {
    const p = state.players.get(socket.id);
    if (!p) return;

    if (CFG.mode !== "TEAM") return socket.emit("toast", { type: "error", message: "Team mode is OFF" });

    if (p.teamCode) leaveTeam(io, p.id);

    const res = joinTeam({ playerId: p.id, code });
    if (!res.ok) {
      if (res.reason === "TEAM_NOT_FOUND") socket.emit("toast", { type: "error", message: "Invalid team code" });
      if (res.reason === "TEAM_FULL") socket.emit("toast", { type: "error", message: `Team is full (max ${CFG.maxTeamSize})` });
      return;
    }

    const t = res.team;
    p.teamCode = t.code;
    p.teamName = t.name;

    socket.emit("team_update", { teamCode: t.code, teamName: t.name, isOwner: t.ownerId === p.id, maxTeamSize: CFG.maxTeamSize });
    broadcastState();
    broadcastTop();
  });

  socket.on("team_leave", () => {
    const p = state.players.get(socket.id);
    if (!p) return;
    if (!p.teamCode) return socket.emit("toast", { type: "info", message: "You are not in a team." });

    leaveTeam(io, p.id);
    broadcastState();
    broadcastTop();
  });

  socket.on("team_rename", ({ teamName } = {}) => {
    const p = state.players.get(socket.id);
    if (!p?.teamCode) return socket.emit("toast", { type: "error", message: "You are not in a team." });

    const t = state.teamRooms.get(p.teamCode);
    if (!t) return;

    if (t.ownerId !== p.id) return socket.emit("toast", { type: "error", message: "Only team owner can rename the team." });

    const res = renameTeam({ teamCode: t.code, name: teamName });
    if (!res.ok) return toastForTeamNameError(socket, res.reason);

    const updated = res.team;

    // update members' player cache + private update to each member
    for (const memberId of updated.members) {
      const mp = state.players.get(memberId);
      if (mp) mp.teamName = updated.name;

      io.to(memberId).emit("team_update", {
        teamCode: updated.code, // ✅ private ok
        teamName: updated.name,
        isOwner: updated.ownerId === memberId,
        maxTeamSize: CFG.maxTeamSize,
      });
    }

    broadcastState();
    broadcastTop();
  });

  socket.on("team_dissolve", () => {
    const p = state.players.get(socket.id);
    if (!p?.teamCode) return socket.emit("toast", { type: "error", message: "You are not in a team." });

    const t = state.teamRooms.get(p.teamCode);
    if (!t) return;

    if (t.ownerId !== p.id) return socket.emit("toast", { type: "error", message: "Only team owner can dissolve the team." });

    dissolveTeam(io, t.code);
    broadcastState();
    broadcastTop();
  });

  socket.on("disconnect", () => {
    // cleanup team membership (auto dissolve if empty in leaveTeam)
    leaveTeam(io, socket.id);
  });
}