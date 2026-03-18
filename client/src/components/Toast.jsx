import React from "react";

export default function Toast({ toast }) {
  if (!toast) return null;

  const isBad = toast.type === "bad" || toast.type === "error";
  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: `1px solid ${isBad ? "rgba(248,113,113,.35)" : "rgba(34,211,238,.35)"}`,
        background: "rgba(2,6,23,.25)",
        color: "rgba(226,232,240,.88)",
        fontWeight: 900,
      }}
    >
      {toast.msg}
    </div>
  );
}