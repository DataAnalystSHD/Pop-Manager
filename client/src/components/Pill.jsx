import React from "react";

export default function Pill({ children, style }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        border: "1px solid rgba(148,163,184,.35)",
        background: "rgba(255,255,255,.70)",
        borderRadius: 999,
        color: "rgba(15,23,42,.88)",
        fontSize: 12,
        fontWeight: 900,
        boxShadow: "0 4px 12px rgba(15,23,42,.08)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
