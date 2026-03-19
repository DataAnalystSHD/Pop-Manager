import React, { useEffect, useMemo, useState } from "react";
import { getSocket } from "../store/gameStore.js";
import { useGameState } from "../store/useGameState.js";
import { msToSecCeil } from "../lib/time.js";

import Card, { CardInner } from "../components/Card.jsx";
import TopBar, { TopPills } from "../components/TopBar.jsx";
import Toast from "../components/Toast.jsx";
import Leaderboard from "../components/Leaderboard.jsx";

const OPERATOR_KEY_STORAGE = "pop_operator_key";

/**
 * IMPORTANT:
 * map this to your CURRENT backend socket event names
 */
const OP_EVENTS = {
  roomToggle: "admin_room_toggle",
  startGame: "admin_start",
  pauseToggle: "admin_pause_toggle",
  endGame: "admin_end",
  clearResults: "admin_clear_results",
  resetRoom: "admin_reset_room",
  applySettings: "admin_config",
  operatorLogin: "operator_login",
};

const PASTEL_BG =
  "radial-gradient(900px 600px at 15% 5%, rgba(255,182,193,.55), transparent 60%)," +
  "radial-gradient(850px 540px at 85% 10%, rgba(173,216,230,.55), transparent 58%)," +
  "radial-gradient(900px 600px at 50% 110%, rgba(221,160,221,.35), transparent 62%)," +
  "linear-gradient(180deg, rgba(255,255,255,1), rgba(255,250,252,.88))";

const GLASS_STROKE = "rgba(148,163,184,.22)";
const SHADOW_SOFT = "0 30px 100px -60px rgba(15,23,42,.35)";
const TXT = "rgba(15,23,42,.92)";
const MUTED = "rgba(15,23,42,.62)";
const PRIMARY_GRAD =
  "linear-gradient(135deg, rgba(99,102,241,.92), rgba(236,72,153,.75))";
const PRIMARY_GRAD_SOFT =
  "linear-gradient(135deg, rgba(99,102,241,.20), rgba(236,72,153,.16))";
const SUCCESS_GRAD =
  "linear-gradient(135deg, rgba(22,163,74,.95), rgba(74,222,128,.82))";
const WARNING_GRAD =
  "linear-gradient(135deg, rgba(245,158,11,.95), rgba(251,191,36,.82))";
const DANGER_GRAD =
  "linear-gradient(135deg, rgba(239,68,68,.96), rgba(244,114,182,.84))";
const SOFT_BG = "rgba(255,255,255,.68)";
const WARN_BG =
  "linear-gradient(180deg, rgba(251,191,36,.18), rgba(255,255,255,.55))";
const DANGER_RING = "rgba(239,68,68,.35)";
const SUCCESS_RING = "rgba(22,163,74,.32)";
const WARNING_RING = "rgba(245,158,11,.30)";

function Icon({ name, size = 18, style = {}, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    style: { display: "block", ...style },
    className,
  };

  switch (name) {
    case "play":
      return (
        <svg {...common}>
          <path d="M9 7l10 5-10 5V7z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "stop":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 6v6h-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 18v-6h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 12a8 8 0 00-14.5-4.5L4 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 12a8 8 0 0014.5 4.5L20 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "doorOpen":
      return (
        <svg {...common}>
          <path d="M5 21h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M8 21V5.5A1.5 1.5 0 019.5 4h7A1.5 1.5 0 0118 5.5V21" stroke="currentColor" strokeWidth="2.2" />
          <path d="M8 12h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "doorClosed":
      return (
        <svg {...common}>
          <path d="M6 21V5.5A1.5 1.5 0 017.5 4h9A1.5 1.5 0 0118 5.5V21" stroke="currentColor" strokeWidth="2.2" />
          <path d="M13.5 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M12 8.5A3.5 3.5 0 1112 15.5 3.5 3.5 0 0112 8.5z" stroke="currentColor" strokeWidth="2.2" />
          <path d="M19.4 15a1 1 0 00.2 1.1l.1.1a2 2 0 010 2.8 2 2 0 01-2.8 0l-.1-.1a1 1 0 00-1.1-.2 1 1 0 00-.6.9V20a2 2 0 01-4 0v-.1a1 1 0 00-.6-.9 1 1 0 00-1.1.2l-.1.1a2 2 0 01-2.8 0 2 2 0 010-2.8l.1-.1a1 1 0 00.2-1.1 1 1 0 00-.9-.6H4a2 2 0 010-4h.1a1 1 0 00.9-.6 1 1 0 00-.2-1.1l-.1-.1a2 2 0 010-2.8 2 2 0 012.8 0l.1.1a1 1 0 001.1.2 1 1 0 00.6-.9V4a2 2 0 014 0v.1a1 1 0 00.6.9 1 1 0 001.1-.2l.1-.1a2 2 0 012.8 0 2 2 0 010 2.8l-.1.1a1 1 0 00-.2 1.1 1 1 0 00.9.6H20a2 2 0 010 4h-.1a1 1 0 00-.9.6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common}>
          <path d="M12 3l10 18H2L12 3z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M12 9v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "screen":
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="12" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
          <path d="M8 20h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 16.5V20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2.2" />
          <path d="M4 21a8 8 0 0116 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 2l1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2z" stroke="currentColor" strokeWidth="2.0" strokeLinejoin="round" />
          <path d="M4 14l.7 2.6L7 18l-2.3.4L4 21l-.7-2.6L1 18l2.3-.4L4 14z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

function StatusPill({ label, value, tone = "default" }) {
  const map = {
    success: {
      bg: "linear-gradient(180deg, rgba(22,163,74,.14), rgba(255,255,255,.62))",
      border: "rgba(22,163,74,.22)",
    },
    warning: {
      bg: "linear-gradient(180deg, rgba(245,158,11,.14), rgba(255,255,255,.62))",
      border: "rgba(245,158,11,.22)",
    },
    danger: {
      bg: "linear-gradient(180deg, rgba(239,68,68,.12), rgba(255,255,255,.62))",
      border: "rgba(239,68,68,.22)",
    },
    default: {
      bg: "rgba(255,255,255,.74)",
      border: GLASS_STROKE,
    },
  };
  const t = map[tone] || map.default;

  return (
    <div
      style={{
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: t.bg,
        boxShadow: SHADOW_SOFT,
        padding: "10px 14px",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 1000,
        color: TXT,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: MUTED, fontWeight: 900 }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  sublabel,
  icon,
  tone = "primary",
  onClick,
  disabled = false,
}) {
  const tones = {
    primary: { bg: PRIMARY_GRAD, color: "#fff", border: "transparent" },
    success: { bg: SUCCESS_GRAD, color: "#fff", border: "transparent" },
    warning: { bg: WARNING_GRAD, color: "#fff", border: "transparent" },
    danger: { bg: DANGER_GRAD, color: "#fff", border: "transparent" },
    ghost: { bg: SOFT_BG, color: TXT, border: GLASS_STROKE },
  };

  const t = tones[tone] || tones.primary;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        borderRadius: 20,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.color,
        padding: "14px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.52 : 1,
        boxShadow: SHADOW_SOFT,
        textAlign: "left",
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 1100, fontSize: 16 }}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.35, opacity: 0.95, fontWeight: 800 }}>
        {sublabel}
      </div>
    </button>
  );
}

function InputField({ label, value, onChange, type = "text", min, max, placeholder }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ color: MUTED, fontSize: 12, fontWeight: 900 }}>{label}</div>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={onChange}
        style={{
          width: "100%",
          padding: "11px 12px",
          borderRadius: 16,
          border: `1px solid ${GLASS_STROKE}`,
          background: "rgba(255,255,255,.74)",
          color: TXT,
          outline: "none",
          boxShadow: SHADOW_SOFT,
          fontWeight: 900,
        }}
      />
    </label>
  );
}

function ConfirmStrip({ title, desc, confirmLabel, onConfirm, onCancel, tone = "danger" }) {
  const toneMap = {
    danger: {
      bg: "linear-gradient(180deg, rgba(239,68,68,.12), rgba(255,255,255,.7))",
      border: DANGER_RING,
      btn: DANGER_GRAD,
    },
    warning: {
      bg: "linear-gradient(180deg, rgba(245,158,11,.12), rgba(255,255,255,.7))",
      border: WARNING_RING,
      btn: WARNING_GRAD,
    },
  };

  const t = toneMap[tone] || toneMap.danger;

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 18,
        border: `1px solid ${t.border}`,
        background: t.bg,
        boxShadow: SHADOW_SOFT,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 1100, color: TXT }}>{title}</div>
      <div style={{ marginTop: 4, color: MUTED, fontWeight: 800, lineHeight: 1.45 }}>{desc}</div>
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={onConfirm}
          style={{
            borderRadius: 14,
            border: "0",
            background: t.btn,
            color: "#fff",
            padding: "10px 14px",
            fontWeight: 1100,
            cursor: "pointer",
            boxShadow: SHADOW_SOFT,
          }}
        >
          {confirmLabel}
        </button>
        <button
          onClick={onCancel}
          style={{
            borderRadius: 14,
            border: `1px solid ${GLASS_STROKE}`,
            background: "rgba(255,255,255,.75)",
            color: TXT,
            padding: "10px 14px",
            fontWeight: 1000,
            cursor: "pointer",
            boxShadow: SHADOW_SOFT,
          }}
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

function KeyModal({ value, onChange, onSubmit }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(15,23,42,.38)",
        backdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(92vw, 460px)",
          borderRadius: 28,
          border: `1px solid ${GLASS_STROKE}`,
          background: "rgba(255,255,255,.88)",
          boxShadow: "0 50px 180px -90px rgba(15,23,42,.45)",
          padding: 22,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 1100, color: TXT }}>กรอก Operator Key</div>
        <div style={{ marginTop: 8, color: MUTED, fontWeight: 900, lineHeight: 1.5 }}>
          หน้านี้ใช้สำหรับควบคุมเกมเท่านั้น และไม่สามารถแก้ข้อมูลแผนกได้
        </div>

        <div style={{ marginTop: 16 }}>
          <InputField
            label="Operator Key / Admin Key"
            type="password"
            value={value}
            onChange={onChange}
            placeholder="กรอกรหัสเพื่อเข้าใช้งาน"
          />
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button
            onClick={onSubmit}
            style={{
              flex: 1,
              borderRadius: 18,
              border: "0",
              background: PRIMARY_GRAD,
              color: "#fff",
              padding: "12px 16px",
              fontWeight: 1100,
              cursor: "pointer",
              boxShadow: SHADOW_SOFT,
            }}
          >
            เข้าใช้งาน
          </button>
        </div>
      </div>
    </div>
  );
}

function FlowGuideCard() {
  const steps = [
    "1) ตั้งค่าเกมก่อนเริ่มรอบ",
    "2) เปิดห้องให้ผู้เล่นเข้าร่วม",
    "3) ดูจำนวนผู้เล่นและตรวจสอบความพร้อม",
    "4) กดเริ่มเกม",
    "5) ใช้หยุดชั่วคราว / เล่นต่อ เมื่อต้องการ",
    "6) กดจบเกมเมื่อจบรอบ",
    "7) ใช้ล้างคะแนนสำหรับรอบใหม่ หรือรีเซ็ตห้องหากต้องเริ่มใหม่ทั้งหมด",
  ];

  return (
    <Card>
      <div style={{ fontSize: 20, fontWeight: 1100, color: TXT }}>ลำดับการใช้งานแนะนำ</div>
      <div style={{ marginTop: 8, color: MUTED, fontWeight: 900 }}>
        ทำตามลำดับนี้เพื่อให้การจัดเกมราบรื่น
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              borderRadius: 16,
              border: `1px solid ${GLASS_STROKE}`,
              background: i === 0 ? PRIMARY_GRAD_SOFT : "rgba(255,255,255,.66)",
              padding: "12px 14px",
              boxShadow: SHADOW_SOFT,
              fontWeight: 950,
              color: TXT,
            }}
          >
            {s}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function OperatorPage() {
  const socket = getSocket();
  const {
    connected,
    roomOpen,
    phase,
    cfg,
    lobbyEndsAt,
    matchEndsAt,
    event,
    warn,
    toast,
    topPlayers,
    topTeams,
    roster,
  } = useGameState((s) => s);

  const [nowMs, setNowMs] = useState(Date.now());
  const [operatorKey, setOperatorKey] = useState(() => localStorage.getItem(OPERATOR_KEY_STORAGE) || "");
  const [showKeyModal, setShowKeyModal] = useState(() => !localStorage.getItem(OPERATOR_KEY_STORAGE));
  const [confirmAction, setConfirmAction] = useState("");
  const [busy, setBusy] = useState("");
  const [localToast, setLocalToast] = useState("");

  const [form, setForm] = useState({
    mode: cfg?.mode || "SOLO",
    lobbySec: Number(cfg?.lobbySeconds ?? 10),
    matchSec: Number(cfg?.matchSeconds ?? 90),
    warnSec: Number(cfg?.warnSeconds ?? 4),
    eventMinSec: Number(cfg?.eventSecondsMin ?? 3),
    eventMaxSec: Number(cfg?.eventSecondsMax ?? 3),
    betweenMinSec: Number(cfg?.betweenEventSecondsMin ?? 8),
    betweenMaxSec: Number(cfg?.betweenEventSecondsMax ?? 14),
    maxTeamSize: Number(cfg?.maxTeamSize ?? 5),
  });

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 150);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    localStorage.setItem(OPERATOR_KEY_STORAGE, operatorKey);
  }, [operatorKey]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      mode: cfg?.mode || prev.mode,
      lobbySec: Number(cfg?.lobbySeconds ?? prev.lobbySec),
      matchSec: Number(cfg?.matchSeconds ?? prev.matchSec),
      warnSec: Number(cfg?.warnSeconds ?? prev.warnSec),
      eventMinSec: Number(cfg?.eventSecondsMin ?? prev.eventMinSec),
      eventMaxSec: Number(cfg?.eventSecondsMax ?? prev.eventMaxSec),
      betweenMinSec: Number(cfg?.betweenEventSecondsMin ?? prev.betweenMinSec),
      betweenMaxSec: Number(cfg?.betweenEventSecondsMax ?? prev.betweenMaxSec),
      maxTeamSize: Number(cfg?.maxTeamSize ?? prev.maxTeamSize),
    }));
  }, [cfg]);

  useEffect(() => {
    if (!socket) return;
    try {
      socket.emit("join_role", { role: "operator" });
    } catch {}
  }, [socket]);

  const lobbyLeft = lobbyEndsAt ? msToSecCeil(lobbyEndsAt - nowMs) : 0;
  const matchLeft = matchEndsAt ? msToSecCeil(matchEndsAt - nowMs) : 0;
  const eventLeft = event?.endsAt ? msToSecCeil(event.endsAt - nowMs) : 0;

  const phaseText =
    phase === "playing" ? `กำลังเล่น · เหลือ ${matchLeft} วินาที`
    : phase === "lobby" ? `นับถอยหลัง · เหลือ ${lobbyLeft} วินาที`
    : phase === "paused" ? "หยุดชั่วคราว"
    : phase === "ended" ? "จบเกม"
    : phase || "idle";

  const playersCount = Array.isArray(roster) ? roster.length : Array.isArray(topPlayers) ? topPlayers.length : 0;
  const teamsCount = Array.isArray(topTeams) ? topTeams.length : 0;

  const roomTone = roomOpen ? "success" : "danger";
  const phaseTone =
    phase === "playing" ? "success"
    : phase === "paused" ? "warning"
    : phase === "ended" ? "danger"
    : "default";

  const modeTone = cfg?.mode === "TEAM" ? "warning" : "default";

  const eventLabel = !event?.active
    ? "ไม่มีอีเวนต์"
    : event?.type === "BOMB"
      ? `Bomb · ${eventLeft} วิ`
      : event?.type === "BONUS"
        ? `Bonus · ${eventLeft} วิ`
        : `Event · ${eventLeft} วิ`;

  function setNumberField(key, value) {
    const n = Number(value);
    setForm((prev) => ({
      ...prev,
      [key]: Number.isFinite(n) ? n : 0,
    }));
  }

  function emitWithKey(eventName, payload = {}) {
    if (!socket) return;
    if (!operatorKey.trim()) {
      setShowKeyModal(true);
      setLocalToast("กรุณากรอกรหัสก่อนใช้งาน");
      return;
    }

    setBusy(eventName);
    try {
      socket.emit(eventName, {
        adminKey: operatorKey.trim(),
        ...payload,
      });
      setLocalToast("ส่งคำสั่งแล้ว");
    } catch {
      setLocalToast("ส่งคำสั่งไม่สำเร็จ");
    } finally {
      setTimeout(() => setBusy(""), 350);
    }
  }

  function submitKey() {
    if (!operatorKey.trim()) {
      setLocalToast("กรุณากรอกรหัส");
      return;
    }

    if (socket) {
      socket.emit(OP_EVENTS.operatorLogin, { key: operatorKey.trim() });
    }
    setShowKeyModal(false);
    setLocalToast("เข้าสู่หน้า Operator แล้ว");
  }

  function openRoom() {
    emitWithKey(OP_EVENTS.roomToggle, { open: true });
  }

  function closeRoom() {
    emitWithKey(OP_EVENTS.roomToggle, { open: false });
  }

  function startGame() {
    emitWithKey(OP_EVENTS.startGame);
  }

  function pauseOrResume() {
    emitWithKey(OP_EVENTS.pauseToggle);
  }

  function endGame() {
    emitWithKey(OP_EVENTS.endGame);
    setConfirmAction("");
  }

  function clearResults() {
    emitWithKey(OP_EVENTS.clearResults);
    setConfirmAction("");
  }

  function resetRoom() {
    emitWithKey(OP_EVENTS.resetRoom);
    setConfirmAction("");
  }

  function applySettings() {
    emitWithKey(OP_EVENTS.applySettings, {
      mode: form.mode,
      lobbySeconds: Number(form.lobbySec),
      matchSeconds: Number(form.matchSec),
      warnSeconds: Number(form.warnSec),
      eventSecondsMin: Number(form.eventMinSec),
      eventSecondsMax: Number(form.eventMaxSec),
      betweenEventSecondsMin: Number(form.betweenMinSec),
      betweenEventSecondsMax: Number(form.betweenMaxSec),
      maxTeamSize: Number(form.maxTeamSize),
    });
  }

  const canOpenRoom = !roomOpen;
  const canCloseRoom = !!roomOpen;
  const canStartGame = phase !== "playing" && phase !== "lobby";
  const canPauseGame = phase === "playing";
  const canResumeGame = phase === "paused";
  const canEndGame = phase === "playing" || phase === "paused" || phase === "lobby";

  const dangerHint = useMemo(() => {
    if (confirmAction === "end") {
      return {
        title: "ยืนยันการจบเกม",
        desc: "การกระทำนี้จะหยุดรอบปัจจุบันทันที",
        label: "ยืนยันจบเกม",
        onConfirm: endGame,
        tone: "warning",
      };
    }
    if (confirmAction === "clear") {
      return {
        title: "ยืนยันการล้างคะแนน",
        desc: "คะแนนจะถูกรีเซ็ตเป็น 0 แต่ผู้เล่นยังอยู่ในห้อง",
        label: "ยืนยันล้างคะแนน",
        onConfirm: clearResults,
        tone: "warning",
      };
    }
    if (confirmAction === "reset") {
      return {
        title: "ยืนยันการรีเซ็ตห้อง",
        desc: "การกระทำนี้อาจล้างผู้เล่นทั้งหมดและเริ่มห้องใหม่",
        label: "ยืนยันรีเซ็ตห้อง",
        onConfirm: resetRoom,
        tone: "danger",
      };
    }
    return null;
  }, [confirmAction]);

  const helperCards = [
    {
      title: "เปิดห้อง",
      desc: "อนุญาตให้ผู้เล่นเข้าร่วมห้อง ใช้ก่อนเริ่มลงทะเบียนหรือก่อนเริ่มรอบ",
      tone: "success",
    },
    {
      title: "ปิดห้อง",
      desc: "หยุดผู้เล่นใหม่ไม่ให้เข้าห้อง แต่คนที่อยู่แล้วจะยังอยู่ต่อ",
      tone: "warning",
    },
    {
      title: "เริ่มเกม",
      desc: "เริ่มนับถอยหลังหรือเริ่มรอบเกมตามการตั้งค่า",
      tone: "success",
    },
    {
      title: "หยุดชั่วคราว / เล่นต่อ",
      desc: "ใช้เมื่อต้องหยุดเกมชั่วคราว แล้วกดอีกครั้งเพื่อเล่นต่อ",
      tone: "warning",
    },
    {
      title: "จบเกม",
      desc: "หยุดรอบปัจจุบันทันทีและสรุปผลรอบนี้",
      tone: "danger",
    },
    {
      title: "ล้างคะแนน / รีเซ็ตห้อง",
      desc: "ล้างคะแนนคือรีเซ็ตแต้มเป็น 0 ส่วนรีเซ็ตห้องคือเริ่มห้องใหม่ทั้งหมด",
      tone: "danger",
    },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: PASTEL_BG, color: TXT, padding: 22 }}>
      {showKeyModal && (
        <KeyModal
          value={operatorKey}
          onChange={(e) => setOperatorKey(e.target.value)}
          onSubmit={submitKey}
        />
      )}

      <div className="container">
        <TopBar
          title="หน้าควบคุมเกมสำหรับผู้จัด"
          subtitle="ควบคุมเกมเท่านั้น • ข้อมูลแผนกถูกล็อก"
          right={<TopPills roomOpen={roomOpen} phase={phase} mode={cfg?.mode || "SOLO"} />}
        />

        {!connected && (
          <div
            style={{
              marginBottom: 14,
              borderRadius: 18,
              border: `1px solid ${WARNING_RING}`,
              background: WARN_BG,
              boxShadow: SHADOW_SOFT,
              padding: "12px 14px",
              fontWeight: 1000,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Icon name="warning" size={18} />
            กำลังเชื่อมต่อเซิร์ฟเวอร์ใหม่...
          </div>
        )}

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.1fr 0.9fr" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 1100, color: TXT }}>สถานะปัจจุบัน</div>
                  <div style={{ marginTop: 4, color: MUTED, fontWeight: 900 }}>
                    ตรวจสอบสถานะก่อนกดปุ่มควบคุม
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a
                    href="/player"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: "none",
                      borderRadius: 14,
                      border: `1px solid ${GLASS_STROKE}`,
                      background: SOFT_BG,
                      color: TXT,
                      padding: "10px 12px",
                      boxShadow: SHADOW_SOFT,
                      fontWeight: 1000,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Icon name="user" size={18} />
                    หน้าผู้เล่น
                  </a>

                  <a
                    href="/screen"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: "none",
                      borderRadius: 14,
                      border: `1px solid ${GLASS_STROKE}`,
                      background: SOFT_BG,
                      color: TXT,
                      padding: "10px 12px",
                      boxShadow: SHADOW_SOFT,
                      fontWeight: 1000,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Icon name="screen" size={18} />
                    หน้าจอแสดงผล
                  </a>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatusPill label="ห้อง" value={roomOpen ? "เปิด" : "ปิด"} tone={roomTone} />
                <StatusPill label="สถานะ" value={phaseText} tone={phaseTone} />
                <StatusPill label="โหมด" value={cfg?.mode || "SOLO"} tone={modeTone} />
                <StatusPill label="ผู้เล่น" value={playersCount} />
                <StatusPill label="ทีม" value={teamsCount} />
                <StatusPill label="อีเวนต์" value={eventLabel} tone={event?.active ? "warning" : "default"} />
              </div>

              {warn && (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 18,
                    border: `1px solid ${WARNING_RING}`,
                    background: WARN_BG,
                    boxShadow: SHADOW_SOFT,
                    padding: "12px 14px",
                    fontWeight: 1000,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Icon name="warning" size={18} />
                  จะมีอีเวนต์ในอีก <b>{warn.left}</b> วินาที
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize: 22, fontWeight: 1100, color: TXT }}>ปุ่มควบคุมหลัก</div>
              <div style={{ marginTop: 4, color: MUTED, fontWeight: 900 }}>
                ใช้เฉพาะปุ่มที่จำเป็นระหว่างจัดงาน
              </div>

              <CardInner style={{ marginTop: 14 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                  <ActionButton
                    label="เปิดห้อง"
                    sublabel="อนุญาตให้ผู้เล่นเข้าร่วมห้อง"
                    icon={<Icon name="doorOpen" size={18} />}
                    tone="success"
                    onClick={openRoom}
                    disabled={!canOpenRoom || busy === OP_EVENTS.roomToggle}
                  />

                  <ActionButton
                    label="ปิดห้อง"
                    sublabel="หยุดผู้เล่นใหม่ไม่ให้เข้าร่วม"
                    icon={<Icon name="doorClosed" size={18} />}
                    tone="warning"
                    onClick={closeRoom}
                    disabled={!canCloseRoom || busy === OP_EVENTS.roomToggle}
                  />

                  <ActionButton
                    label="เริ่มเกม"
                    sublabel="เริ่มนับถอยหลังหรือเริ่มรอบ"
                    icon={<Icon name="play" size={18} />}
                    tone="success"
                    onClick={startGame}
                    disabled={!canStartGame || busy === OP_EVENTS.startGame}
                  />

                  <ActionButton
                    label={phase === "paused" ? "เล่นต่อ" : "หยุดชั่วคราว"}
                    sublabel={phase === "paused" ? "ดำเนินเกมต่อจากจุดเดิม" : "หยุดเกมชั่วคราว"}
                    icon={phase === "paused" ? <Icon name="play" size={18} /> : <Icon name="pause" size={18} />}
                    tone="warning"
                    onClick={pauseOrResume}
                    disabled={!(canPauseGame || canResumeGame) || busy === OP_EVENTS.pauseToggle}
                  />

                  <ActionButton
                    label="จบเกม"
                    sublabel="หยุดรอบปัจจุบันทันที"
                    icon={<Icon name="stop" size={18} />}
                    tone="danger"
                    onClick={() => setConfirmAction("end")}
                    disabled={!canEndGame}
                  />

                  <ActionButton
                    label="บันทึกการตั้งค่า"
                    sublabel="บันทึกโหมดและเวลาเกม"
                    icon={<Icon name="settings" size={18} />}
                    tone="primary"
                    onClick={applySettings}
                    disabled={busy === OP_EVENTS.applySettings}
                  />
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                  <ActionButton
                    label="ล้างคะแนน"
                    sublabel="รีเซ็ตคะแนนเป็น 0 แต่ผู้เล่นยังอยู่"
                    icon={<Icon name="refresh" size={18} />}
                    tone="ghost"
                    onClick={() => setConfirmAction("clear")}
                  />

                  <ActionButton
                    label="รีเซ็ตห้อง"
                    sublabel="เริ่มห้องใหม่ทั้งหมด อาจเตะผู้เล่นออก"
                    icon={<Icon name="warning" size={18} />}
                    tone="danger"
                    onClick={() => setConfirmAction("reset")}
                  />
                </div>

                {dangerHint && (
                  <ConfirmStrip
                    title={dangerHint.title}
                    desc={dangerHint.desc}
                    confirmLabel={dangerHint.label}
                    onConfirm={dangerHint.onConfirm}
                    onCancel={() => setConfirmAction("")}
                    tone={dangerHint.tone}
                  />
                )}
              </CardInner>
            </Card>

            <Card>
              <div style={{ fontSize: 22, fontWeight: 1100, color: TXT }}>ตั้งค่าเกม</div>
              <div style={{ marginTop: 4, color: MUTED, fontWeight: 900 }}>
                ปรับเฉพาะค่าที่เกี่ยวกับเกมเท่านั้น
              </div>

              <CardInner style={{ marginTop: 14 }}>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <div style={{ color: MUTED, fontSize: 12, fontWeight: 900 }}>โหมด</div>
                    <select
                      value={form.mode}
                      onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "11px 12px",
                        borderRadius: 16,
                        border: `1px solid ${GLASS_STROKE}`,
                        background: "rgba(255,255,255,.74)",
                        color: TXT,
                        outline: "none",
                        boxShadow: SHADOW_SOFT,
                        fontWeight: 900,
                      }}
                    >
                      <option value="SOLO">SOLO</option>
                      <option value="TEAM">TEAM</option>
                    </select>
                  </label>

                  <InputField
                    label="เวลานับถอยหลังก่อนเริ่ม (วิ)"
                    type="number"
                    min={0}
                    value={form.lobbySec}
                    onChange={(e) => setNumberField("lobbySec", e.target.value)}
                  />

                  <InputField
                    label="เวลาเล่นต่อรอบ (วิ)"
                    type="number"
                    min={5}
                    value={form.matchSec}
                    onChange={(e) => setNumberField("matchSec", e.target.value)}
                  />

                  <InputField
                    label="เวลาเตือนก่อนอีเวนต์ (วิ)"
                    type="number"
                    min={0}
                    value={form.warnSec}
                    onChange={(e) => setNumberField("warnSec", e.target.value)}
                  />

                  <InputField
                    label="อีเวนต์ต่ำสุด (วิ)"
                    type="number"
                    min={0}
                    value={form.eventMinSec}
                    onChange={(e) => setNumberField("eventMinSec", e.target.value)}
                  />

                  <InputField
                    label="อีเวนต์สูงสุด (วิ)"
                    type="number"
                    min={0}
                    value={form.eventMaxSec}
                    onChange={(e) => setNumberField("eventMaxSec", e.target.value)}
                  />

                  <InputField
                    label="ช่วงห่างอีเวนต์ต่ำสุด (วิ)"
                    type="number"
                    min={0}
                    value={form.betweenMinSec}
                    onChange={(e) => setNumberField("betweenMinSec", e.target.value)}
                  />

                  <InputField
                    label="ช่วงห่างอีเวนต์สูงสุด (วิ)"
                    type="number"
                    min={0}
                    value={form.betweenMaxSec}
                    onChange={(e) => setNumberField("betweenMaxSec", e.target.value)}
                  />

                  <InputField
                    label="จำนวนสมาชิกทีมสูงสุด"
                    type="number"
                    min={1}
                    value={form.maxTeamSize}
                    onChange={(e) => setNumberField("maxTeamSize", e.target.value)}
                  />

                  <label style={{ display: "grid", gap: 6 }}>
                    <div style={{ color: MUTED, fontSize: 12, fontWeight: 900 }}>Operator Key</div>
                    <input
                      type="password"
                      value={operatorKey}
                      placeholder="กรอกรหัส"
                      onChange={(e) => setOperatorKey(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "11px 12px",
                        borderRadius: 16,
                        border: `1px solid ${GLASS_STROKE}`,
                        background: "rgba(255,255,255,.74)",
                        color: TXT,
                        outline: "none",
                        boxShadow: SHADOW_SOFT,
                        fontWeight: 900,
                      }}
                    />
                  </label>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 16,
                    border: `1px solid ${SUCCESS_RING}`,
                    background: "linear-gradient(180deg, rgba(22,163,74,.10), rgba(255,255,255,.68))",
                    boxShadow: SHADOW_SOFT,
                    padding: "12px 14px",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    color: TXT,
                    fontWeight: 900,
                  }}
                >
                  <Icon name="sparkle" size={18} />
                  หน้านี้ควบคุมเกมเท่านั้น และไม่แก้ไขข้อมูลแผนก
                </div>
              </CardInner>
            </Card>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <FlowGuideCard />

            <Card>
              <div style={{ fontSize: 20, fontWeight: 1100, color: TXT }}>อธิบายแต่ละปุ่ม</div>
              <div style={{ marginTop: 8, color: MUTED, fontWeight: 900 }}>
                คู่มือสั้น ๆ สำหรับทีมงานจัดกิจกรรม
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {helperCards.map((item) => {
                  const bg =
                    item.tone === "success"
                      ? "linear-gradient(180deg, rgba(22,163,74,.10), rgba(255,255,255,.66))"
                      : item.tone === "warning"
                        ? "linear-gradient(180deg, rgba(245,158,11,.10), rgba(255,255,255,.66))"
                        : "linear-gradient(180deg, rgba(239,68,68,.08), rgba(255,255,255,.66))";

                  const border =
                    item.tone === "success"
                      ? SUCCESS_RING
                      : item.tone === "warning"
                        ? WARNING_RING
                        : DANGER_RING;

                  return (
                    <div
                      key={item.title}
                      style={{
                        borderRadius: 16,
                        border: `1px solid ${border}`,
                        background: bg,
                        boxShadow: SHADOW_SOFT,
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ fontWeight: 1100, color: TXT }}>{item.title}</div>
                      <div style={{ marginTop: 4, color: MUTED, fontWeight: 800, lineHeight: 1.45 }}>
                        {item.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 20, fontWeight: 1100, color: TXT }}>กระดานคะแนนสด</div>
              <div style={{ marginTop: 8, color: MUTED, fontWeight: 900 }}>
                ดูผลคะแนนปัจจุบันได้ทันที
              </div>
              <div style={{ marginTop: 12 }}>
                <Leaderboard mode={cfg?.mode || "SOLO"} topPlayers={topPlayers || []} topTeams={topTeams || []} />
              </div>
            </Card>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Toast toast={localToast ? { type: "info", text: localToast } : toast} />
        </div>
      </div>
    </div>
  );
}