import React from "react";

export default function Card({ children, big = false, style }) {
  const base = {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,.22)",
    background: "rgba(255,255,255,.06)",
    boxShadow: "0 24px 80px -44px rgba(0,0,0,.7)",
    backdropFilter: "blur(10px)",
    padding: big ? 18 : 14,
  };
  return <div style={{ ...base, ...style }}>{children}</div>;
}

export function CardInner({ children, style }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,.18)",
        background: "rgba(0,0,0,.18)",
        padding: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}