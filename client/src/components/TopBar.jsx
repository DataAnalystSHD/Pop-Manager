import React from "react";
import Pill from "./Pill.jsx";

export default function TopBar({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
      <div>
        <div style={{ fontWeight: 950, letterSpacing: 0.2, fontSize: 18, color: "rgba(15,23,42,.92)" }}>{title}</div>
        {subtitle && <div style={{ color: "rgba(15,23,42,.60)", fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {right}
      </div>
    </div>
  );
}

export function LinkBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,.35)",
        background: "rgba(255,255,255,.70)",
        color: "rgba(15,23,42,.88)",
        cursor: "pointer",
        fontWeight: 850,
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(15,23,42,.08)",
      }}
    >
      {children}
    </button>
  );
}

export function TopPills({ roomOpen, phase, mode }) {
  return (
    <>
      <Pill>{`Room: ${roomOpen ? "OPEN" : "CLOSED"}`}</Pill>
      <Pill>{`Phase: ${phase}`}</Pill>
      <Pill>{`Mode: ${mode}`}</Pill>
    </>
  );
}
