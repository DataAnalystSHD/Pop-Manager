import React, { useState } from "react";
import { CardInner } from "./Card.jsx";

function Btn({ children, onClick, primary = false, danger = false, disabled = false }) {
  const bg = primary
    ? "linear-gradient(135deg, rgba(124,58,237,.95), rgba(34,211,238,.70))"
    : "rgba(255,255,255,.06)";
  const border = danger ? "rgba(248,113,113,.35)" : "rgba(148,163,184,.22)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: primary ? 0 : `1px solid ${border}`,
        background: bg,
        color: "rgba(255,255,255,.92)",
        padding: "10px 12px",
        borderRadius: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 900,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default function TeamPanel({ enabled, maxTeamSize, myTeam, isOwner, onCreate, onJoin, onLeave, onRename, onDissolve }) {
  const [code, setCode] = useState("");
  const [rename, setRename] = useState(myTeam?.name || "");

  if (!enabled) return null;

  return (
    <CardInner style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 950, color: "rgba(226,232,240,.78)" }}>
        ทีม (เล่นกับเพื่อน) · max {maxTeamSize} คน/ทีม
      </div>

      {!myTeam?.code ? (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <Btn onClick={onCreate}>Create Team (ได้โค้ด)</Btn>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter team code"
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,.22)",
                background: "rgba(0,0,0,.25)",
                color: "rgba(255,255,255,.92)",
                outline: "none",
                minWidth: 220,
              }}
            />

            <Btn primary onClick={() => onJoin(code.trim().toUpperCase())} disabled={!code.trim()}>
              Join by Code
            </Btn>
          </div>

          <div style={{ color: "rgba(226,232,240,.64)", fontSize: 12, marginTop: 8 }}>
            * ใช้ได้เฉพาะตอน Admin เปิด TEAM mode
          </div>
        </>
      ) : (
        <CardInner style={{ marginTop: 10 }}>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(34,211,238,.35)",
              background: "rgba(2,6,23,.25)",
              fontWeight: 900,
            }}
          >
            ✅ ทีม: <b style={{ color: "white" }}>{myTeam.name}</b> · Code: <b style={{ color: "white" }}>{myTeam.code}</b>
            {isOwner && <span style={{ opacity: 0.75 }}> · (Owner)</span>}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <Btn onClick={onLeave}>ออกทีม</Btn>

            {isOwner && (
              <>
                <input
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                  placeholder="ตั้งชื่อทีม"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,.22)",
                    background: "rgba(0,0,0,.25)",
                    color: "rgba(255,255,255,.92)",
                    outline: "none",
                    minWidth: 220,
                  }}
                />
                <Btn primary onClick={() => onRename(rename)}>เปลี่ยนชื่อทีม</Btn>
                <Btn danger onClick={onDissolve}>ยุบทีม</Btn>
              </>
            )}
          </div>

          {!isOwner && <div style={{ color: "rgba(226,232,240,.64)", fontSize: 12, marginTop: 8 }}>(Owner เท่านั้นที่เปลี่ยนชื่อ/ยุบทีมได้)</div>}
        </CardInner>
      )}
    </CardInner>
  );
}