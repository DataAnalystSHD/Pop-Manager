import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchDepartments } from "../api/departmentsApi.js";
import { useGameState } from "../store/useGameState.js";
import { getSocket } from "../store/gameStore.js";
import { msToSecCeil } from "../lib/time.js";

import Card, { CardInner } from "../components/Card.jsx";
import TopBar, { TopPills } from "../components/TopBar.jsx";
import Toast from "../components/Toast.jsx";
import Leaderboard from "../components/Leaderboard.jsx";
import TeamPanel from "../components/TeamPanel.jsx";
import Pill from "../components/Pill.jsx";

/* =========================================
   Pastel / Disney-ish UI Tokens (no emoji)
========================================= */
const PASTEL_BG =
  "radial-gradient(900px 600px at 15% 5%, rgba(255,182,193,.55), transparent 60%)," +
  "radial-gradient(850px 540px at 85% 10%, rgba(173,216,230,.55), transparent 58%)," +
  "radial-gradient(900px 600px at 50% 110%, rgba(221,160,221,.35), transparent 62%)," +
  "linear-gradient(180deg, rgba(255,255,255,1), rgba(255,250,252,.88))";

const GLASS_CARD =
  "linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.52))";

const GLASS_STROKE = "rgba(148,163,184,.22)";
const SHADOW_SOFT = "0 30px 100px -60px rgba(15,23,42,.35)";
const TXT = "rgba(15,23,42,.92)";
const MUTED = "rgba(15,23,42,.62)";
const PRIMARY_GRAD =
  "linear-gradient(135deg, rgba(99,102,241,.92), rgba(236,72,153,.75))";
const PRIMARY_GRAD_SOFT =
  "linear-gradient(135deg, rgba(99,102,241,.20), rgba(236,72,153,.16))";
const WARN_BG = "linear-gradient(180deg, rgba(251,191,36,.18), rgba(255,255,255,.55))";
const DANGER_RING = "rgba(239,68,68,.35)";
const DANGER_BG = "rgba(239,68,68,.10)";

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
    case "arrowLeft":
      return (
        <svg {...common}>
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="M4 8l4 4 4-6 4 6 4-4v10H4V8z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M4 18h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 2l1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2z" stroke="currentColor" strokeWidth="2.0" strokeLinejoin="round" />
          <path d="M4 14l.7 2.6L7 18l-2.3.4L4 21l-.7-2.6L1 18l2.3-.4L4 14z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "bomb":
      return (
        <svg {...common}>
          <path d="M14 7l3-3 3 3-3 3" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M11 8a7 7 0 107 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14.5 5.5l4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "timer":
      return (
        <svg {...common}>
          <path d="M9 2h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 22a9 9 0 100-18 9 9 0 000 18z" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M6 11h12v10H6V11z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path d="M4 7h4l2-2h4l2 2h4v14H4V7z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M12 18a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2.2" />
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
    case "play":
      return (
        <svg {...common}>
          <path d="M9 7l10 5-10 5V7z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M5 7h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M10 11v7M14 11v7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9 7l1-2h4l1 2" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M7 7l1 14h8l1-14" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      );
    case "user":
    default:
      return (
        <svg {...common}>
          <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2.2" />
          <path d="M4 21a8 8 0 0116 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
}

function preloadImages(urls = []) {
  const list = (Array.isArray(urls) ? urls : []).filter(Boolean);
  if (!list.length) return Promise.resolve();
  return Promise.allSettled(
    list.map(
      (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(src);
          img.onerror = reject;
          img.src = src;
        })
    )
  );
}

function createPopAudio(url) {
  let ctx = null;
  let buffer = null;
  let loadPromise = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
    }
    return ctx;
  }

  async function load() {
    const audioCtx = getCtx();
    const resp = await fetch(url);
    const raw = await resp.arrayBuffer();
    buffer = await audioCtx.decodeAudioData(raw);
  }

  function unlock() {
    const audioCtx = getCtx();
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    if (!loadPromise) {
      loadPromise = load().catch(() => {});
    }
  }

  function play({ volume = 0.9, rate = 1.0 } = {}) {
    if (!ctx || !buffer) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch {}
  }

  return { unlock, play };
}

const POP_SFX_SRC = "/sfx/pop.mp3";
const PLAYER_ID_KEY = "pop_player_id";

async function fileToThumbDataUrl(file, max = 128, quality = 0.75) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(1, max / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const c = canvas.getContext("2d");
    c.drawImage(img, 0, 0, tw, th);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ensurePlayerId() {
  let pid = localStorage.getItem(PLAYER_ID_KEY);
  if (!pid) {
    try {
      pid = crypto?.randomUUID?.() || `pid_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    } catch {
      pid = `pid_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    }
    localStorage.setItem(PLAYER_ID_KEY, pid);
  }
  return pid;
}

function CircleAvatar({ src, label = "Avatar", size = 36 }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  return (
    <div
      title={label}
      style={{
        width: size, height: size, borderRadius: 999, overflow: "hidden",
        border: `1px solid ${GLASS_STROKE}`, background: "rgba(255,255,255,.70)",
        display: "grid", placeItems: "center",
        boxShadow: "0 12px 30px -18px rgba(2,6,23,.30)", flex: "0 0 auto",
      }}
    >
      {src && !bad ? (
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={() => setBad(true)} />
      ) : (
        <span style={{ opacity: 0.8, color: "rgba(15,23,42,.85)" }}>
          <Icon name="user" size={Math.max(16, Math.round(size * 0.55))} />
        </span>
      )}
    </div>
  );
}

function PopcatFullScreen({
  popTitle, score, canClick, onPop,
  imgClosed, imgOpen, phase, lobbyLeft, matchLeft, matchEndsAt,
  modeLabel, eventActive, eventLeft, eventType, warn,
  topPlayers, myId, myName, myAvatarUrl, onExit,
}) {
  const UI_LIFT_KEY = "pop_ui_lift";

  const [mouthOpen, setMouthOpen] = useState(false);
  const activePtrsRef = useRef(new Set());
  const holdingSpaceRef = useRef(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const canClickRef = useRef(canClick);
  const onPopRef = useRef(onPop);
  useEffect(() => { canClickRef.current = canClick; }, [canClick]);
  useEffect(() => { onPopRef.current = onPop; }, [onPop]);

  useEffect(() => setImgLoaded(false), [imgClosed, imgOpen, mouthOpen]);

  const [uiLift, setUiLift] = useState(() => Number(localStorage.getItem(UI_LIFT_KEY) || 0));
  useEffect(() => localStorage.setItem(UI_LIFT_KEY, String(uiLift)), [uiLift]);

  useEffect(() => {
    const prev = {
      userSelect: document.body.style.userSelect,
      webkitUserSelect: document.body.style.webkitUserSelect,
      webkitTouchCallout: document.body.style.webkitTouchCallout,
      overscrollBehavior: document.body.style.overscrollBehavior,
      touchAction: document.body.style.touchAction,
    };
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.webkitTouchCallout = "none";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.userSelect = prev.userSelect;
      document.body.style.webkitUserSelect = prev.webkitUserSelect;
      document.body.style.webkitTouchCallout = prev.webkitTouchCallout;
      document.body.style.overscrollBehavior = prev.overscrollBehavior;
      document.body.style.touchAction = prev.touchAction;
    };
  }, []);

  useEffect(() => {
    const preventGesture = (e) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (holdingSpaceRef.current || e.repeat) return;
        holdingSpaceRef.current = true;
        setMouthOpen(true);
        if (!canClickRef.current) return;
        onPopRef.current();
        return;
      }
      if (e.code === "Escape") { e.preventDefault(); onExit?.(); }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        holdingSpaceRef.current = false;
        if (activePtrsRef.current.size === 0) setMouthOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onExit]);

  const activeImg = mouthOpen ? (imgOpen || imgClosed) : imgClosed;

  const safePlayers = Array.isArray(topPlayers) ? topPlayers : [];
  const sorted = useMemo(() => {
    const arr = [...safePlayers];
    arr.sort((a, b) =>
      Number(b.score || 0) - Number(a.score || 0) ||
      String(a.name || "").localeCompare(String(b.name || ""))
    );
    return arr;
  }, [safePlayers]);

  const myRank = useMemo(() => {
    if (!myId) return null;
    const idx = sorted.findIndex((p) => String(p.id) === String(myId));
    return idx >= 0 ? idx + 1 : null;
  }, [sorted, myId]);

  const myRow = useMemo(() => {
    if (!myId) return null;
    return sorted.find((p) => String(p.id) === String(myId)) || null;
  }, [sorted, myId]);

  const isTop3 = !!(myRank && myRank <= 3);

  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  useEffect(() => { if (phase === "playing") setHasEverPlayed(true); }, [phase]);

  const ended = useMemo(() => {
    if (!hasEverPlayed) return false;
    if (phase === "idle" || phase === "lobby") return false;
    const hardEnded = phase === "ended" || phase === "finish" || phase === "result" || phase === "postgame";
    const timeEnded = !!matchEndsAt && Number(matchEndsAt) > 0 && phase !== "playing" && matchLeft <= 0;
    const leftEnded = phase !== "playing" && matchLeft <= 0;
    return hardEnded || timeEnded || leftEnded;
  }, [hasEverPlayed, phase, matchEndsAt, matchLeft]);

  const avatarOf = (p) => p?.avatarUrl || p?.faceUrl || p?.photoUrl || p?.avatar || "";

  const timerLabel =
    phase === "playing" ? `${matchLeft}s`
    : phase === "lobby" ? `${lobbyLeft}s`
    : phase === "paused" ? "Paused"
    : "Idle";

  const eventMeta = useMemo(() => {
    if (!eventActive) return { text: null, kind: null };
    if (eventType === "BOMB") return { text: `Bomb · ${eventLeft}s`, kind: "BOMB" };
    if (eventType === "BONUS") return { text: `Bonus · ${eventLeft}s`, kind: "BONUS" };
    return { text: `Event · ${eventLeft}s`, kind: "OTHER" };
  }, [eventActive, eventType, eventLeft]);

  const eventLabel = eventMeta.text || "";

  function MiniAvatar({ src, label, size = 28 }) {
    const [bad, setBad] = useState(false);
    useEffect(() => setBad(false), [src]);
    return (
      <div
        title={label || ""}
        style={{
          width: size, height: size, borderRadius: 999, overflow: "hidden",
          border: `1px solid ${GLASS_STROKE}`, background: "rgba(255,255,255,.70)",
          display: "grid", placeItems: "center", flex: "0 0 auto",
        }}
      >
        {src && !bad ? (
          <img
            src={src} alt="" draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", WebkitTouchCallout: "none", userSelect: "none" }}
            onError={() => setBad(true)}
          />
        ) : (
          <span style={{ opacity: 0.85, color: "rgba(15,23,42,.85)" }}>
            <Icon name="user" size={Math.max(14, Math.round(size * 0.55))} />
          </span>
        )}
      </div>
    );
  }

  const eventIcon =
    eventMeta.kind === "BOMB" ? <Icon name="bomb" size={18} />
    : eventMeta.kind ? <Icon name="sparkle" size={18} />
    : null;

  const modeIcon =
    phase === "paused" ? <Icon name="pause" size={18} /> : <Icon name="timer" size={18} />;

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePtrsRef.current.add(e.pointerId);
    setMouthOpen(true);
    if (!canClickRef.current) return;
    onPopRef.current();
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    activePtrsRef.current.delete(e.pointerId);
    if (activePtrsRef.current.size === 0 && !holdingSpaceRef.current) setMouthOpen(false);
  };

  const handlePointerCancel = (e) => {
    e.preventDefault();
    activePtrsRef.current.delete(e.pointerId);
    if (activePtrsRef.current.size === 0 && !holdingSpaceRef.current) setMouthOpen(false);
  };

  return (
    <div
      onSelectStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        width: "100vw",
        height: "100dvh",
        maxWidth: "100vw",
        maxHeight: "100dvh",
        background: PASTEL_BG,
        color: TXT,
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
        transform: "none",
      }}
    >
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        background:
          "radial-gradient(2px 2px at 18% 22%, rgba(255,255,255,.65), transparent 60%)," +
          "radial-gradient(2px 2px at 42% 14%, rgba(255,255,255,.55), transparent 60%)," +
          "radial-gradient(2px 2px at 68% 20%, rgba(255,255,255,.60), transparent 60%)," +
          "radial-gradient(2px 2px at 84% 34%, rgba(255,255,255,.55), transparent 60%)," +
          "radial-gradient(2px 2px at 28% 66%, rgba(255,255,255,.45), transparent 60%)," +
          "radial-gradient(2px 2px at 74% 72%, rgba(255,255,255,.50), transparent 60%)",
        opacity: 0.55, pointerEvents: "none",
      }} />

      <div style={{
        position: "absolute", left: 12, right: 12, top: 0, zIndex: 20,
        pointerEvents: "none",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, pointerEvents: "auto" }}>
          <button
            onClick={onExit}
            style={{
              borderRadius: 999, border: `1px solid ${GLASS_STROKE}`, background: GLASS_CARD,
              color: TXT, padding: "10px 12px", fontWeight: 950, cursor: "pointer",
              boxShadow: SHADOW_SOFT, backdropFilter: "blur(12px)",
              display: "inline-flex", gap: 8, alignItems: "center",
            }}
            title="Exit fullscreen"
          >
            <Icon name="arrowLeft" size={18} />
            Back
          </button>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{
              borderRadius: 999, border: `1px solid ${GLASS_STROKE}`, background: GLASS_CARD,
              padding: "10px 12px", fontWeight: 1000, fontSize: 13, color: TXT,
              backdropFilter: "blur(12px)", whiteSpace: "nowrap", boxShadow: SHADOW_SOFT,
            }}>
              {modeLabel}
            </div>
            <div style={{
              borderRadius: 999, border: `1px solid ${GLASS_STROKE}`, background: GLASS_CARD,
              padding: "10px 12px", fontWeight: 1000, fontSize: 13, color: TXT,
              backdropFilter: "blur(12px)", whiteSpace: "nowrap", boxShadow: SHADOW_SOFT,
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              {modeIcon}
              {timerLabel}
            </div>
          </div>
        </div>

        {warn && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{
              borderRadius: 999, border: "1px solid rgba(251,191,36,.35)", background: WARN_BG,
              backdropFilter: "blur(12px)", boxShadow: SHADOW_SOFT,
              padding: "10px 14px", fontWeight: 1000, color: TXT, whiteSpace: "nowrap",
              maxWidth: "92vw", overflow: "hidden", textOverflow: "ellipsis",
              display: "inline-flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ color: "rgba(245,158,11,.95)" }}><Icon name="warning" size={18} /></span>
              Event incoming in <span style={{ fontWeight: 1100 }}>{warn.left}</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, textAlign: "center", pointerEvents: "none" }}>
          <div style={{
            fontWeight: 1100, letterSpacing: 1.5, textTransform: "uppercase",
            fontSize: "clamp(22px, 5vw, 44px)", lineHeight: 1.05,
            color: "rgba(15,23,42,.92)", textShadow: "0 18px 70px rgba(15,23,42,.10)",
          }}>
            {popTitle}
          </div>
          <div style={{ marginTop: 6, fontWeight: 1100, fontSize: "clamp(18px, 3.6vw, 34px)", color: TXT }}>
            {score}
          </div>
          {eventLabel ? (
            <div style={{ marginTop: 8, pointerEvents: "none" }}>
              <div style={{
                borderRadius: 12,
                background: eventMeta.kind === "BOMB"
                  ? "linear-gradient(90deg, rgba(220,38,38,.95), rgba(239,68,68,.85))"
                  : "linear-gradient(90deg, rgba(22,163,74,.95), rgba(34,197,94,.85))",
                padding: "10px 16px", fontWeight: 1000, fontSize: 15, color: "#fff",
                letterSpacing: 0.4, display: "flex", alignItems: "center",
                justifyContent: "center", gap: 10,
                boxShadow: eventMeta.kind === "BOMB"
                  ? "0 4px 24px rgba(220,38,38,.45)"
                  : "0 4px 24px rgba(22,163,74,.45)",
              }}>
                {eventIcon}
                {eventLabel}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 10, pointerEvents: "auto", display: "flex", justifyContent: "center" }}>
          <div style={{
            width: "min(980px, 100%)", borderRadius: 18, border: `1px solid ${GLASS_STROKE}`,
            background: GLASS_CARD, backdropFilter: "blur(12px)",
            padding: "10px 10px", boxShadow: SHADOW_SOFT,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 999,
                border: `1px solid ${GLASS_STROKE}`, background: "rgba(255,255,255,.55)", maxWidth: "100%",
              }} title={(sorted[0]?.name || "Player") + " (Top 1)"}>
                <div style={{
                  fontWeight: 1100, fontSize: 12, paddingInline: 8, paddingBlock: 6,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, rgba(251,191,36,.22), rgba(236,72,153,.10))",
                  border: "1px solid rgba(251,191,36,.30)", color: TXT,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ color: "rgba(245,158,11,.95)" }}><Icon name="crown" size={16} /></span>
                  #1
                </div>
                <MiniAvatar src={avatarOf(sorted[0])} label={sorted[0]?.name} size={24} />
                <div style={{ fontWeight: 1000, fontSize: 12, color: TXT, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sorted[0]?.name || "Player"}
                </div>
                <div style={{ fontWeight: 1100, fontSize: 12, color: TXT }}>{Number(sorted[0]?.score || 0)}</div>
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 999,
                border: `1px solid ${GLASS_STROKE}`, background: "rgba(255,255,255,.55)", maxWidth: "100%",
              }}>
                <MiniAvatar src={myAvatarUrl || avatarOf(myRow)} label={myName} size={24} />
                <div style={{ fontWeight: 1000, fontSize: 12, color: TXT, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={myName || "You"}>
                  {myName || "You"}
                </div>
                <div style={{
                  fontWeight: 1100, fontSize: 12, paddingInline: 10, paddingBlock: 6,
                  borderRadius: 999, background: "rgba(255,255,255,.60)",
                  border: `1px solid ${GLASS_STROKE}`, color: TXT,
                }}>
                  #{myRank ?? "—"}
                </div>
                <div style={{ fontWeight: 1100, fontSize: 12, color: TXT }}>{Number(myRow?.score ?? score)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        position: "absolute", inset: 0,
        display: "grid", placeItems: "center",
        paddingInline: 14,
        paddingTop: "clamp(190px, 24vh, 260px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
        transform: uiLift ? `translateY(-${uiLift}px)` : undefined,
        transition: "transform 160ms ease",
      }}>
        <div
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            width: "min(94vw, 920px)", height: "min(70dvh, 720px)",
            borderRadius: 28, border: "1px solid rgba(0,0,0,.12)",
            background: "rgb(2, 6, 23)",
            boxShadow: mouthOpen
              ? "0 8px 20px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.4)"
              : "0 20px 60px rgba(0,0,0,.5), 0 8px 20px rgba(0,0,0,.3)",
            overflow: "hidden", position: "relative", isolation: "isolate",
            cursor: canClick ? "pointer" : "not-allowed",
            userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
            touchAction: "none",
            transform: mouthOpen ? "scale(0.97) translateY(4px)" : "scale(1) translateY(0px)",
            transition: "transform 60ms ease-out, box-shadow 60ms ease-out",
          }}
        >
          {activeImg ? (
            <>
              {!imgLoaded && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 4,
                  display: "grid", placeItems: "center",
                  background: "rgb(2, 6, 23)", color: "rgba(255,255,255,.75)",
                  fontWeight: 1000, letterSpacing: 0.5,
                }}>
                  Loading…
                </div>
              )}
              <img
                key={activeImg} src={activeImg} alt="pop" draggable={false}
                onLoad={() => setImgLoaded(true)}
                onError={(e) => { setImgLoaded(true); e.currentTarget.style.display = "none"; }}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover", objectPosition: "50% 50%",
                  pointerEvents: "none", userSelect: "none",
                  WebkitUserSelect: "none", WebkitTouchCallout: "none",
                  filter: "drop-shadow(0 28px 40px rgba(15,23,42,.16))",
                }}
              />
            </>
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "rgba(255,255,255,.55)", fontWeight: 900 }}>
              Upload manager images
            </div>
          )}

          {!canClick && (
            <div style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center",
              zIndex: 3, background: "rgba(2,6,23,.72)", backdropFilter: "blur(6px)",
            }}>
              <div style={{
                borderRadius: 999, border: "1px solid rgba(255,255,255,.15)",
                background: "rgba(255,255,255,.12)", padding: "12px 14px",
                fontWeight: 1000, color: "rgba(255,255,255,.92)",
                maxWidth: "92%", textAlign: "center", boxShadow: SHADOW_SOFT,
              }}>
                {phase === "idle" ? "Waiting for admin to start…"
                  : phase === "lobby" ? `Starting in ${lobbyLeft}s…`
                  : phase === "paused" ? "Paused by admin"
                  : "Not clickable"}
              </div>
            </div>
          )}
        </div>

        <div style={{ position: "absolute", right: 14, bottom: 14, zIndex: 8, pointerEvents: "auto" }}>
          <div style={{
            borderRadius: 999, border: `1px solid ${GLASS_STROKE}`,
            background: "rgba(255,255,255,.78)", boxShadow: SHADOW_SOFT,
            padding: "8px 10px", display: "flex", gap: 8, alignItems: "center",
            color: TXT, fontWeight: 900,
          }} title="Adjust UI height">
            <button onClick={() => setUiLift((v) => Math.min(120, v + 10))}
              style={{ borderRadius: 999, border: `1px solid ${GLASS_STROKE}`, background: "rgba(255,255,255,.65)", padding: "6px 10px", cursor: "pointer", fontWeight: 1000, color: TXT }}>
              ↑
            </button>
            <button onClick={() => setUiLift((v) => Math.max(0, v - 10))}
              style={{ borderRadius: 999, border: `1px solid ${GLASS_STROKE}`, background: "rgba(255,255,255,.65)", padding: "6px 10px", cursor: "pointer", fontWeight: 1000, color: TXT }}>
              ↓
            </button>
          </div>
        </div>
      </div>

      {ended && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50, display: "grid", placeItems: "center",
          background: "rgba(255,255,255,.55)", backdropFilter: "blur(10px)", padding: 16,
        }}>
          <div style={{
            width: "min(92vw, 560px)", borderRadius: 24, border: `1px solid ${GLASS_STROKE}`,
            background: "rgba(255,255,255,.78)", boxShadow: "0 50px 180px -120px rgba(15,23,42,.45)",
            padding: 18, textAlign: "center",
          }}>
            <div style={{ fontWeight: 1000, fontSize: 12, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Game Ended
            </div>
            <div style={{ marginTop: 10, fontWeight: 1100, fontSize: "clamp(26px, 6vw, 44px)", letterSpacing: 0.5, color: TXT }}>
              Your Rank: #{myRank ?? "—"}
            </div>
            <div style={{ marginTop: 6, fontWeight: 1000, color: TXT, opacity: 0.9 }}>
              Score: {Number(myRow?.score ?? score)}
            </div>
            {isTop3 ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 1100, fontSize: "clamp(22px, 5vw, 34px)", color: TXT, display: "inline-flex", gap: 10, alignItems: "center" }}>
                  <span style={{ color: "rgba(245,158,11,.95)" }}><Icon name="crown" size={22} /></span>
                  Top {myRank}
                </div>
                <div style={{ marginTop: 6, color: MUTED, fontWeight: 900 }}>Amazing run!</div>
              </div>
            ) : (
              <div style={{ marginTop: 14, color: MUTED, fontWeight: 900 }}>Nice run — try again!</div>
            )}
            <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
              <button onClick={onExit} style={{
                borderRadius: 999, border: `1px solid ${GLASS_STROKE}`,
                background: PRIMARY_GRAD, color: "white",
                padding: "10px 14px", fontWeight: 1100, cursor: "pointer", boxShadow: SHADOW_SOFT,
              }}>
                Back to Player Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlayerPage() {
  const socket = getSocket();

  const { connected, roomOpen, phase, cfg, lobbyEndsAt, matchEndsAt, event, warn, toast, topPlayers, topTeams } =
    useGameState((s) => s);

  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 120);
    return () => clearInterval(t);
  }, []);

  const lobbyLeft = lobbyEndsAt ? msToSecCeil(lobbyEndsAt - nowMs) : 0;
  const matchLeft = matchEndsAt ? msToSecCeil(matchEndsAt - nowMs) : 0;
  const eventLeft = event?.endsAt ? msToSecCeil(event.endsAt - nowMs) : 0;

  const [departments, setDepartments] = useState([]);
  const [deptQuery, setDeptQuery] = useState("");
  const [departmentKey, setDepartmentKey] = useState(() => localStorage.getItem("pop_dept_key") || "");
  const departmentKeyRef = useRef(localStorage.getItem("pop_dept_key") || "");
  useEffect(() => {
    departmentKeyRef.current = departmentKey;
    if (departmentKey) localStorage.setItem("pop_dept_key", departmentKey);
  }, [departmentKey]);

  const [deptErr, setDeptErr] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarErr, setAvatarErr] = useState("");
  const [joined, setJoined] = useState(false);
  const myIdRef = useRef(null);
  const [myScore, setMyScore] = useState(0);
  const [myTeam, setMyTeam] = useState({ code: null, name: null });
  const [isOwner, setIsOwner] = useState(false);
  const [fs, setFs] = useState(false);
  const [fsPending, setFsPending] = useState(false);
  const fsRootRef = useRef(null);

  const reloadDepartments = async () => {
    const list = await fetchDepartments().catch(() => []);
    setDepartments(Array.isArray(list) ? list : []);
  };

  useEffect(() => { reloadDepartments(); }, []);

  const popAudioRef = useRef(null);

  useEffect(() => {
    popAudioRef.current = createPopAudio(POP_SFX_SRC);
    const earlyUnlock = () => {
      popAudioRef.current?.unlock?.();
      window.removeEventListener("pointerdown", earlyUnlock, { capture: true });
      window.removeEventListener("keydown", earlyUnlock, { capture: true });
    };
    window.addEventListener("pointerdown", earlyUnlock, { capture: true, passive: true });
    window.addEventListener("keydown", earlyUnlock, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", earlyUnlock, { capture: true });
      window.removeEventListener("keydown", earlyUnlock, { capture: true });
    };
  }, []);

  const playPopSfx = () => {
    const rate = 0.95 + Math.random() * 0.12;
    popAudioRef.current?.play?.({ volume: 0.9, rate });
  };

  const socketRef = useRef(socket);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  const canClick = joined && phase === "playing";
  const canClickRef = useRef(canClick);
  useEffect(() => { canClickRef.current = canClick; }, [canClick]);

  useEffect(() => {
    if (!socket) return;
    try { socket.emit("join_role", { role: "player" }); } catch {}
  }, [socket]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const savedPid = localStorage.getItem(PLAYER_ID_KEY);
      if (!savedPid || !socket) return;
      try {
        const savedDept = localStorage.getItem("pop_dept_key") || undefined;
        socket.emit("join_role", { role: "player" });
        socket.emit("join", { playerId: savedPid, ...(savedDept ? { departmentKey: savedDept } : {}) });
      } catch {}
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const savedPid = localStorage.getItem(PLAYER_ID_KEY);
    const savedDept = localStorage.getItem("pop_dept_key") || undefined;
    if (savedPid) socket.emit("join", { playerId: savedPid, ...(savedDept ? { departmentKey: savedDept } : {}) });

    const onJoined = (p) => {
      myIdRef.current = p.id;
      if (p?.playerId) localStorage.setItem(PLAYER_ID_KEY, p.playerId);
      setJoined(true);
      setMyScore(Number(p.score || 0));
      if (p?.name) setName(p.name);
      if (p?.avatarUrl) setAvatarUrl(p.avatarUrl);
      if (p?.departmentKey && !departmentKeyRef.current) {
        setDepartmentKey(p.departmentKey);
        localStorage.setItem("pop_dept_key", p.departmentKey);
      }
      setMyTeam({ code: p.teamCode || null, name: p.teamName || null });
      setIsOwner(!!p.isOwner);
      setFs(false);
      setAvatarErr("");
      setDeptErr("");
    };

    const onJoinDenied = ({ reason }) => {
      if (reason === "ROOM_CLOSED") alert("Room is closed. Please wait for admin.");
      else if (reason === "AVATAR_REQUIRED") alert("Please upload your photo before joining.");
      else if (reason === "AVATAR_TOO_LARGE") alert("Photo is too large. Please try another.");
      else if (reason === "SESSION_NOT_FOUND") localStorage.removeItem(PLAYER_ID_KEY);
      else if (reason === "DEPARTMENT_NOT_FOUND") alert("Department not found. Please refresh and select again.");
      else if (reason === "SERVER_ERROR") alert("Server is warming up, please try again in a few seconds.");
      else if (reason === "AVATAR_UPLOAD_FAILED") alert("Avatar upload failed. Please try again.");
      else alert("Join failed: " + reason);
    };

    const onMyScore = ({ score }) => setMyScore(Number(score || 0));
    const onTeamUpdate = ({ teamCode, teamName, isOwner }) => {
      setMyTeam({ code: teamCode || null, name: teamName || null });
      setIsOwner(!!isOwner);
    };

    const onKicked = ({ reason }) => {
      setJoined(false); myIdRef.current = null; setMyScore(0);
      setMyTeam({ code: null, name: null }); setIsOwner(false); setFs(false);
      alert(reason || "Room reset. Please join again.");
    };

    const onForceLogout = ({ reason } = {}) => {
      localStorage.removeItem(PLAYER_ID_KEY);
      setJoined(false); myIdRef.current = null; setMyScore(0);
      setMyTeam({ code: null, name: null }); setIsOwner(false); setFs(false);
      alert(reason || "Room reset by admin.");
    };

    socket.on("joined", onJoined);
    socket.on("join_denied", onJoinDenied);
    socket.on("my_score", onMyScore);
    socket.on("team_update", onTeamUpdate);
    socket.on("kicked", onKicked);
    socket.on("force_logout", onForceLogout);

    return () => {
      socket.off("joined", onJoined);
      socket.off("join_denied", onJoinDenied);
      socket.off("my_score", onMyScore);
      socket.off("team_update", onTeamUpdate);
      socket.off("kicked", onKicked);
      socket.off("force_logout", onForceLogout);
    };
  }, [socket]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setFs(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!fs) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevHtmlTouchAction = document.documentElement.style.touchAction;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.touchAction = "none";

    window.scrollTo(0, 0);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
      document.documentElement.style.touchAction = prevHtmlTouchAction;
    };
  }, [fs]);

  const filteredDepts = useMemo(() => {
    const q = deptQuery.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => {
      const nm = String(d.name || "").toLowerCase();
      const id = String(d.id || "").toLowerCase();
      const mname = String(d?.manager?.name || "").toLowerCase();
      return nm.includes(q) || id.includes(q) || mname.includes(q);
    });
  }, [deptQuery, departments]);

  const joinDisabled = !connected || !roomOpen || !avatarUrl || !departmentKey;

  const join = () => {
    const safeName = name.trim().slice(0, 18) || "Player";
    setAvatarErr(""); setDeptErr("");
    if (!avatarUrl) { setAvatarErr("Please upload your photo before joining."); return; }
    if (!departmentKey) { setDeptErr("Please select a department before joining."); return; }
    const pid = ensurePlayerId();
    socket?.emit("join", { playerId: pid, name: safeName, departmentKey, avatarUrl });
  };

  const clickAction = () => {
    playPopSfx();
    socketRef.current?.emit("action_click");
  };

  const createTeam = () => {
    const suggest = `${(name.trim() || "Team").slice(0, 12)} team`;
    const teamName = window.prompt("Team name?", suggest);
    if (teamName === null) return;
    socket?.emit("team_create", { teamName });
  };
  const joinTeam = (code) => socket?.emit("team_join", { code });
  const leaveTeam = () => socket?.emit("team_leave");
  const renameTeam = (teamName) => socket?.emit("team_rename", { teamName });
  const dissolveTeam = () => socket?.emit("team_dissolve");

  const deleteAccount = () => {
    const pid = localStorage.getItem(PLAYER_ID_KEY);
    if (!pid) return;
    const ok = window.confirm("Delete your account? You will need to join again.");
    if (!ok) return;
    socket?.emit("player_delete_account", { playerId: pid });
    localStorage.removeItem(PLAYER_ID_KEY);
    localStorage.removeItem("pop_dept_key");
    setJoined(false); myIdRef.current = null; setMyScore(0);
    setMyTeam({ code: null, name: null }); setIsOwner(false); setFs(false);
    setDepartmentKey("");
  };

  const modeLabel =
    phase !== "playing" ? "—"
    : event?.active ? (event?.type === "BOMB" ? "Bomb (-5)" : "Bonus (+2)")
    : "Normal (+1)";

  const selectedDept = departments.find((d) => String(d.id) === String(departmentKey)) || null;
  const selectedDeptName = selectedDept?.name || departmentKey || "—";

  const mgr = selectedDept?.manager || selectedDept?.departmentManager || null;
  const managerName = mgr?.name || mgr?.fullName || mgr?.displayName || "";

  const pickUrl = (...xs) => {
    for (const x of xs) {
      if (!x) continue;
      if (typeof x === "string" && x.trim()) return x.trim();
      if (typeof x === "object") {
        const u = x.url || x.src || x.href;
        if (typeof u === "string" && u.trim()) return u.trim();
      }
    }
    return "";
  };

  const pop = mgr?.pop || {};
  const mgrClosed = pickUrl(pop.closed, pop.close, pop.closeUrl, pop.close_url, mgr?.avatarUrl, mgr?.avatar);
  const mgrOpen = pickUrl(pop.open, pop.openUrl, pop.open_url, mgr?.avatarUrl, mgr?.avatar, pop.closed);
  const popTitle = `POP${managerName ? ` ${managerName}` : ""}`;

  useEffect(() => {
    const urls = [mgrClosed, mgrOpen].filter(Boolean);
    if (!urls.length) return;
    urls.forEach((src) => { const img = new Image(); img.src = src; });
  }, [mgrClosed, mgrOpen]);

  const closeFullscreen = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
    setFs(false);
  };

  const openFullscreen = async () => {
    if (!joined) return;

    setFsPending(true);
    try {
      await preloadImages([mgrClosed, mgrOpen]);

      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      setFs(true);

      requestAnimationFrame(async () => {
        const el = fsRootRef.current;
        if (!el) {
          setFsPending(false);
          return;
        }

        try {
          if (el.requestFullscreen) {
            await el.requestFullscreen({ navigationUI: "hide" });
          }
        } catch {
          // fallback: still show overlay even if browser fullscreen is denied
        } finally {
          setFsPending(false);
        }
      });
    } catch {
      setFsPending(false);
      setFs(true);
    }
  };

  return (
    <>
      {fs && joined && (
        <div
          ref={fsRootRef}
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100dvh",
            maxWidth: "100vw",
            maxHeight: "100dvh",
            overflow: "hidden",
            zIndex: 999999,
            background: "#000",
            transform: "none",
          }}
        >
          <PopcatFullScreen
            popTitle={popTitle}
            score={myScore}
            canClick={canClick}
            onPop={clickAction}
            imgClosed={mgrClosed}
            imgOpen={mgrOpen}
            phase={phase}
            lobbyLeft={lobbyLeft}
            matchLeft={matchLeft}
            matchEndsAt={matchEndsAt}
            modeLabel={modeLabel}
            eventActive={!!event?.active}
            eventLeft={eventLeft}
            eventType={event?.type || ""}
            warn={warn}
            topPlayers={topPlayers || []}
            myId={myIdRef.current}
            myName={name.trim() || "You"}
            myAvatarUrl={avatarUrl}
            onExit={closeFullscreen}
          />
        </div>
      )}

      <div style={{ minHeight: "100dvh", background: PASTEL_BG, color: TXT, padding: 22 }}>
        {!connected && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
            background: "rgba(15,23,42,.93)", color: "#fff",
            padding: "10px 16px", textAlign: "center",
            fontWeight: 1000, fontSize: 13, letterSpacing: 0.3,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, background: "rgba(251,191,36,1)", boxShadow: "0 0 0 0 rgba(251,191,36,.6)" }} />
            Reconnecting to server… please wait
          </div>
        )}

        {warn && (
          <div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 9999, pointerEvents: "none" }}>
            <div style={{
              borderRadius: 999, border: "1px solid rgba(251,191,36,.30)", background: WARN_BG,
              backdropFilter: "blur(12px)", boxShadow: SHADOW_SOFT,
              padding: "10px 14px", fontWeight: 1000, color: TXT,
              display: "inline-flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ color: "rgba(245,158,11,.95)" }}><Icon name="warning" size={18} /></span>
              Event incoming in <b style={{ color: TXT }}>{warn.left}</b>
            </div>
          </div>
        )}

        <div className="container">
          <TopBar
            title="Pop Manager"
            subtitle=""
            right={<TopPills roomOpen={roomOpen} phase={null} mode={cfg?.mode || "SOLO"} />}
          />

          <div className="grid2">
            <Card big>
              {!joined ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 1100, color: TXT }}>Join Game</div>

                  {!roomOpen && (
                    <div style={{
                      marginTop: 12, padding: "10px 12px", borderRadius: 16,
                      border: `1px solid ${DANGER_RING}`, background: "rgba(255,255,255,.65)",
                      fontWeight: 1000, color: TXT,
                      display: "flex", alignItems: "center", gap: 10, boxShadow: SHADOW_SOFT,
                    }}>
                      <span style={{ color: "rgba(239,68,68,.95)" }}><Icon name="lock" size={18} /></span>
                      Room is closed — please wait for admin
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                    <CircleAvatar src={avatarUrl} label="Avatar" size={46} />
                    <label style={{
                      borderRadius: 16, border: `1px solid ${GLASS_STROKE}`,
                      background: "rgba(255,255,255,.70)", color: TXT,
                      padding: "10px 12px", cursor: "pointer", fontWeight: 1000,
                      display: "inline-flex", alignItems: "center", gap: 10, boxShadow: SHADOW_SOFT,
                    }}>
                      <Icon name="camera" size={18} />
                      Upload photo
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setAvatarErr("");
                          try {
                            const dataUrl = await fileToThumbDataUrl(f, 128, 0.75);
                            setAvatarUrl(dataUrl);
                          } catch {
                            setAvatarErr("Upload failed");
                            setAvatarUrl("");
                          }
                        }}
                      />
                    </label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                      style={{
                        padding: "10px 12px", borderRadius: 16, border: `1px solid ${GLASS_STROKE}`,
                        background: "rgba(255,255,255,.70)", color: TXT, outline: "none",
                        minWidth: 220, boxShadow: SHADOW_SOFT,
                      }}
                    />
                    <button onClick={join} disabled={joinDisabled} style={{
                      border: 0, background: PRIMARY_GRAD, color: "white",
                      padding: "10px 12px", borderRadius: 16,
                      cursor: joinDisabled ? "not-allowed" : "pointer",
                      fontWeight: 1100, opacity: joinDisabled ? 0.55 : 1, boxShadow: SHADOW_SOFT,
                    }}>
                      Join
                    </button>
                    <button onClick={reloadDepartments} style={{
                      borderRadius: 16, border: `1px solid ${GLASS_STROKE}`,
                      background: "rgba(255,255,255,.70)", color: TXT,
                      padding: "10px 12px", cursor: "pointer", fontWeight: 1000,
                      boxShadow: SHADOW_SOFT, display: "inline-flex", alignItems: "center", gap: 10,
                    }} title="Reload departments">
                      <Icon name="refresh" size={18} />
                      Refresh
                    </button>
                  </div>

                  {!avatarUrl && (
                    <div style={{ marginTop: 10, color: "rgba(239,68,68,.92)", fontWeight: 1000, display: "flex", gap: 10, alignItems: "center" }}>
                      <Icon name="warning" size={18} />
                      Please upload your photo before joining.
                    </div>
                  )}
                  {avatarErr ? <div style={{ marginTop: 6, color: "rgba(239,68,68,.92)", fontWeight: 900 }}>{avatarErr}</div> : null}
                  {deptErr ? (
                    <div style={{ marginTop: 6, color: "rgba(239,68,68,.92)", fontWeight: 1000, display: "flex", gap: 10, alignItems: "center" }}>
                      <Icon name="warning" size={18} />
                      {deptErr}
                    </div>
                  ) : null}

                  <CardInner style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                      <div style={{ color: MUTED, fontSize: 12, fontWeight: 900 }}>Search Department</div>
                      <div style={{ color: MUTED, fontSize: 12, fontWeight: 900 }}>
                        Selected: <b style={{ color: departmentKey ? TXT : MUTED }}>
                          {departmentKey ? selectedDeptName : "— Please select —"}
                        </b>
                      </div>
                    </div>
                    <input value={deptQuery} onChange={(e) => setDeptQuery(e.target.value)}
                      placeholder="Search... (id / name / manager)"
                      style={{
                        width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 16,
                        border: `1px solid ${GLASS_STROKE}`, background: "rgba(255,255,255,.70)",
                        color: TXT, outline: "none", boxShadow: SHADOW_SOFT,
                      }}
                    />
                    <div style={{ marginTop: 10, display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                      {filteredDepts.map((d) => {
                        const selected = departmentKey === d.id;
                        return (
                          <button key={d.id} onClick={() => { setDepartmentKey(d.id); setDeptErr(""); }}
                            style={{
                              borderRadius: 16,
                              border: `1px solid ${selected ? "rgba(99,102,241,.35)" : GLASS_STROKE}`,
                              background: selected ? PRIMARY_GRAD_SOFT : "rgba(255,255,255,.65)",
                              padding: "10px 12px", cursor: "pointer", textAlign: "left",
                              color: TXT, fontWeight: 1000, boxShadow: SHADOW_SOFT,
                            }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                              <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</b>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardInner>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: MUTED, fontSize: 12, fontWeight: 900 }}>You</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <CircleAvatar src={avatarUrl} label={name.trim() || "Player"} size={34} />
                        <div style={{ fontSize: 18, fontWeight: 1100, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: TXT }}>
                          <span>{name.trim() || "Player"}</span>
                          <Pill style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                            <span>Department: {selectedDeptName}</span>
                          </Pill>
                        </div>
                      </div>
                      <div style={{ color: MUTED, fontSize: 14, fontWeight: 900 }}>
                        Score: <b style={{ color: TXT }}>{myScore}</b>
                      </div>
                      <button onClick={deleteAccount} style={{
                        marginTop: 10, borderRadius: 16, border: `1px solid ${DANGER_RING}`,
                        background: DANGER_BG, color: TXT, padding: "8px 12px",
                        fontWeight: 1000, cursor: "pointer", boxShadow: SHADOW_SOFT,
                        display: "inline-flex", alignItems: "center", gap: 10,
                      }}>
                        <Icon name="trash" size={18} />
                        Delete Account
                      </button>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <button onClick={openFullscreen} disabled={fsPending} style={{
                        marginTop: 6, borderRadius: 16, border: `1px solid ${GLASS_STROKE}`,
                        background: PRIMARY_GRAD, color: "white",
                        padding: "10px 12px", fontWeight: 1100,
                        cursor: fsPending ? "not-allowed" : "pointer",
                        boxShadow: SHADOW_SOFT, display: "inline-flex", alignItems: "center", gap: 10,
                      }}>
                        <Icon name="play" size={18} />
                        Fullscreen
                      </button>
                    </div>
                  </div>

                  <TeamPanel
                    enabled={cfg?.mode === "TEAM"}
                    maxTeamSize={cfg?.maxTeamSize || 5}
                    myTeam={myTeam}
                    isOwner={isOwner}
                    onCreate={createTeam}
                    onJoin={joinTeam}
                    onLeave={leaveTeam}
                    onRename={renameTeam}
                    onDissolve={dissolveTeam}
                  />

                  <CardInner style={{ marginTop: 12 }}>
                    <button onClick={openFullscreen} disabled={fsPending} style={{
                      width: "100%", borderRadius: 18, border: `1px solid ${GLASS_STROKE}`,
                      background: PRIMARY_GRAD, padding: 14, fontWeight: 1100, color: "white",
                      cursor: fsPending ? "not-allowed" : "pointer", boxShadow: SHADOW_SOFT,
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
                    }}>
                      <Icon name="play" size={18} />
                      Open Fullscreen
                    </button>
                  </CardInner>

                  <Toast toast={toast} />
                </>
              )}
            </Card>

            <Card>
              <Leaderboard mode={cfg?.mode || "SOLO"} topPlayers={topPlayers || []} topTeams={topTeams || []} />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}