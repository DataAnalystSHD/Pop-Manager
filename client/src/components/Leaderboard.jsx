import React from "react";

export default function Leaderboard({ mode, topPlayers, topTeams }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 950, color: "rgba(15,23,42,.92)", marginBottom: 8 }}>🏆 Live Leaderboard</div>

      {mode === "TEAM" && (
        <>
          <div style={{ color: "rgba(15,23,42,.60)", fontSize: 12, marginBottom: 6 }}>Teams</div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {topTeams.map((t, i) => (
              <li key={t.code} style={{ margin: "6px 0", color: "rgba(15,23,42,.88)", fontSize: 13 }}>
                <b style={{ color: "rgba(15,23,42,.92)" }}>{i + 1}. {t.name}</b>
                <span style={{ color: "rgba(15,23,42,.60)", fontSize: 12 }}> · {t.score} pts · {t.members} members · {t.code}</span>
              </li>
            ))}
            {topTeams.length === 0 && <li style={{ margin: "6px 0", fontSize: 13, color: "rgba(15,23,42,.60)" }}>No teams yet</li>}
          </ol>
          <div style={{ height: 10 }} />
        </>
      )}

      <div style={{ color: "rgba(15,23,42,.60)", fontSize: 12, marginBottom: 6 }}>Players</div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {topPlayers.map((p, i) => (
          <li key={p.id} style={{ margin: "6px 0", color: "rgba(15,23,42,.88)", fontSize: 13 }}>
            <b style={{ color: "rgba(15,23,42,.92)" }}>{i + 1}. {p.name}</b>
            <span style={{ color: "rgba(15,23,42,.60)", fontSize: 12 }}> · {p.score} pts · ฝ่าย {p.departmentKey}</span>
            {p.teamCode && <span style={{ color: "rgba(15,23,42,.60)", fontSize: 12 }}> · ทีม {p.teamName} ({p.teamCode})</span>}
          </li>
        ))}
        {topPlayers.length === 0 && <li style={{ margin: "6px 0", fontSize: 13, color: "rgba(15,23,42,.60)" }}>No players yet</li>}
      </ol>
    </div>
  );
}
