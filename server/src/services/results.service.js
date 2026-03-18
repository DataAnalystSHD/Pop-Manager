// server/src/services/results.service.js
import { supabase } from "./supabase.service.js";
import { CFG, state } from "../state.js";
import { topPlayers, teamLeaderboard } from "./leaderboard.service.js";

export async function saveMatchResults() {
  const results =
    CFG.mode === "TEAM"
      ? { teams: teamLeaderboard(9999), playersTop10: topPlayers(10, { includeAvatar: true }) }
      : { players: topPlayers(9999, { includeAvatar: true }) };

  const payload = {
    match_id: String(state.matchId ?? ""),
    mode: String(CFG.mode ?? "SOLO"),
    ended_at: new Date().toISOString(),
    results,
  };

  await supabase.from("match_results").insert(payload);
}