// client/src/pages/ScreenPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGameState } from "../store/useGameState.js";
import { msToSecCeil } from "../lib/time.js";

import TopBar from "../components/TopBar.jsx";
import Card, { CardInner } from "../components/Card.jsx";
import Leaderboard from "../components/Leaderboard.jsx";
import Pill from "../components/Pill.jsx";
import { setClientRole } from "../store/gameStore.js";

/* ========================= Utils ========================= */
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function isGameOverPhase(phase) {
  const p = String(phase || "").toLowerCase();
  return p === "ended" || p === "finished" || p === "complete" || p === "completed" || p === "results" || p === "result";
}
function phaseLabel(phase) {
  const p = String(phase || "");
  if (!p) return "idle";
  return p.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
function computeFinishScale(topList) {
  const maxScore = Math.max(0, ...(topList || []).map((p) => Number(p.score || 0)));
  return Math.max(55, Math.ceil(maxScore / 10) * 10 + 5);
}
function medal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}
function pickAvatar(p) {
  if (!p) return "";
  return p.avatarUrl || p.faceUrl || p.photoUrl || p.profileUrl || p.imageUrl || p.avatar || "";
}
function pickManagerObj(p) {
  if (!p) return null;
  return p.departmentManager || p.deptManager || p.manager || null;
}
function pickManagerName(p) {
  const m = pickManagerObj(p);
  if (!m) return "";
  return m.name || m.fullName || m.displayName || m.managerName || m.username || "";
}
function pickManagerPopFrames(p) {
  const m = pickManagerObj(p);
  if (!m) return { open: "", close: "" };
  const pop = m.pop || {};
  const pick = (...xs) => {
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
  const close = pick(
    pop.closed,
    pop.close,
    pop.closeUrl,
    pop.close_url,
    pop.mouthClose,
    pop.mouthCloseUrl,
    pop.mouth_close_url
  );
  const open = pick(
    pop.open,
    pop.openUrl,
    pop.open_url,
    pop.mouthOpen,
    pop.mouthOpenUrl,
    pop.mouth_open_url
  );
  return { open, close };
}

/* ========================= Audio ========================= */
const AUDIO_UNLOCK_KEY = "pop_screen_audio_unlocked_v1";
function canUseAudioContext() { return !!(window.AudioContext || window.webkitAudioContext); }
function beepPop(volume = 0.10) {
  try {
    if (localStorage.getItem(AUDIO_UNLOCK_KEY) !== "1") return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(520, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.06);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.11);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.12);
    o.onended = () => { try { ctx.close(); } catch {} };
  } catch {}
}
async function unlockAudioOnce() {
  try {
    if (!canUseAudioContext()) return;
    if (localStorage.getItem(AUDIO_UNLOCK_KEY) === "1") return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    if (ctx.state === "suspended") await ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.01);
    localStorage.setItem(AUDIO_UNLOCK_KEY, "1");
    try { setTimeout(() => ctx.close(), 50); } catch {}
  } catch {}
}

/* ========================= UI Components ========================= */
function Avatar({
  src,
  alt,
  size = 44,
  ring = "rgba(15,23,42,.18)",
  bg = "rgba(255,255,255,.75)"
}) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: `2px solid ${ring}`,
        background: bg,
        overflow: "hidden",
        boxShadow: "0 14px 40px -26px rgba(2,6,23,.35)",
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center"
      }}
      title={alt}
    >
      {src && !bad ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          loading="lazy"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none"
          }}
          onError={() => setBad(true)}
        />
      ) : (
        <div style={{ fontWeight: 950, opacity: 0.75, fontSize: Math.max(14, Math.floor(size / 2.2)) }}>
          🙂
        </div>
      )}
    </div>
  );
}

function ResultRow({ rank, name, score, extra, avatarUrl }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.10)",
        background: "rgba(255,255,255,.78)",
        boxShadow: "0 18px 60px -44px rgba(2,6,23,.25)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            fontWeight: 950,
            border: "1px solid rgba(15,23,42,.10)",
            background:
              rank === 1
                ? "linear-gradient(180deg, rgba(250,204,21,.35), rgba(250,204,21,.12))"
                : rank === 2
                  ? "linear-gradient(180deg, rgba(148,163,184,.32), rgba(148,163,184,.12))"
                  : rank === 3
                    ? "linear-gradient(180deg, rgba(249,115,22,.28), rgba(249,115,22,.10))"
                    : "rgba(15,23,42,.04)",
            color: "rgba(2,6,23,.88)"
          }}
        >
          {medal(rank)}
        </div>
        <Avatar
          src={avatarUrl}
          alt={name || "Player"}
          size={40}
          ring={rank <= 3 ? "rgba(250,204,21,.25)" : "rgba(15,23,42,.14)"}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 950,
              color: "rgba(2,6,23,.88)",
              fontSize: 16,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {name || "Player"}
          </div>
          {extra ? (
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 800, color: "rgba(15,23,42,.60)" }}>
              {extra}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ fontWeight: 950, color: "rgba(2,6,23,.88)" }}>
        {Number(score || 0).toLocaleString()} <span style={{ opacity: 0.65, fontWeight: 900 }}>pts</span>
      </div>
    </div>
  );
}

function Lane({ rank, name, score, avatarUrl, pct }) {
  return (
    <div
      style={{
        position: "relative",
        height: 68,
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgba(15,23,42,.10)",
        background: "rgba(255,255,255,.72)",
        boxShadow: "0 26px 90px -72px rgba(2,6,23,.28)"
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
        {[18, 34, 50].map((t) => (
          <div
            key={t}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: t,
              height: 1,
              background: "rgba(15,23,42,.08)"
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          width: 34,
          height: 34,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          fontWeight: 950,
          color: "rgba(2,6,23,.86)",
          border: "1px solid rgba(15,23,42,.10)",
          background: rank === 1 ? "rgba(250,204,21,.22)" : "rgba(15,23,42,.04)"
        }}
      >
        {rank}
      </div>

      <div
        style={{
          position: "absolute",
          left: 60,
          right: 76,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          minWidth: 0
        }}
      >
        <div
          style={{
            fontWeight: 950,
            color: "rgba(2,6,23,.88)",
            fontSize: 16,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0
          }}
        >
          {name || "Player"}
        </div>
        <div style={{ color: "rgba(15,23,42,.60)", fontWeight: 900, fontSize: 13 }}>
          {Number(score || 0).toLocaleString()} pts
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `calc(${pct}% - 18px)`,
          transform: "translateY(-50%)",
          transition: "left 140ms ease-out",
          width: 44,
          height: 44,
          borderRadius: 999,
          border: "2px solid rgba(15,23,42,.14)",
          background: "rgba(255,255,255,.75)",
          overflow: "hidden",
          boxShadow: "0 16px 50px -34px rgba(2,6,23,.30)",
          display: "grid",
          placeItems: "center"
        }}
        title={`${name} • ${Number(score || 0).toLocaleString()} pts`}
      >
        <Avatar
          src={avatarUrl}
          alt={name || "Player"}
          size={44}
          ring="rgba(15,23,42,.14)"
          bg="rgba(255,255,255,.75)"
        />
      </div>

      <div
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          width: 28,
          height: 48,
          borderRadius: 10,
          border: "1px solid rgba(15,23,42,.10)",
          background: "linear-gradient(180deg, rgba(2,6,23,.06), rgba(2,6,23,.02))",
          opacity: 0.55
        }}
      />
    </div>
  );
}

function EndgameOverlay({ open, mode, winnersTop10, allPlayers, allTeams, totals, onClose }) {
  if (!open) return null;
  const endedAt = totals?.endedAt ? new Date(totals.endedAt) : null;
  const isTeam = mode === "TEAM";

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 18 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(980px 520px at 50% 15%, rgba(255,255,255,.78), rgba(255,255,255,.40) 40%, rgba(2,6,23,.35) 95%)",
          backdropFilter: "blur(10px)"
        }}
      />
      <div style={{ position: "relative", width: "min(980px, 96vw)" }}>
        <div
          style={{
            borderRadius: 26,
            border: "1px solid rgba(15,23,42,.10)",
            background: "rgba(255,255,255,.85)",
            boxShadow: "0 80px 240px -160px rgba(2,6,23,.45)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              padding: "18px 18px 14px 18px",
              borderBottom: "1px solid rgba(15,23,42,.10)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 18, fontWeight: 950, color: "rgba(2,6,23,.88)" }}>
                  Match Results
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(15,23,42,.60)" }}>
                  Mode: <span style={{ color: "rgba(2,6,23,.85)" }}>{isTeam ? "TEAM" : "SOLO"}</span>
                  {endedAt ? (
                    <>
                      {" "}· Ended: <span style={{ color: "rgba(2,6,23,.85)" }}>{endedAt.toLocaleString()}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ marginTop: 6, color: "rgba(15,23,42,.60)", fontSize: 13 }}>
                Final standings are ready.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(15,23,42,.10)", background: "rgba(2,6,23,.03)", fontWeight: 900 }}>
                Players: {Number(totals?.players || 0).toLocaleString()}
              </span>
              {isTeam ? (
                <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(15,23,42,.10)", background: "rgba(2,6,23,.03)", fontWeight: 900 }}>
                  Teams: {Number(totals?.teams || 0).toLocaleString()}
                </span>
              ) : null}
              <button
                onClick={onClose}
                style={{
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.14)",
                  background: "rgba(2,6,23,.05)",
                  color: "rgba(2,6,23,.86)",
                  fontWeight: 950,
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div style={{ padding: 18 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 950, color: "rgba(2,6,23,.88)" }}>
                    Top 10 {isTeam ? "Teams" : "Players"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,.55)" }}>
                    Highlight
                  </div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {(winnersTop10 || []).map((p, idx) => (
                    <ResultRow
                      key={`${p.id || p.name || "p"}-${idx}`}
                      rank={idx + 1}
                      name={p.name}
                      score={p.score}
                      extra={p.teamName ? `Team: ${p.teamName}` : null}
                      avatarUrl={p.avatarUrl}
                    />
                  ))}
                  {!winnersTop10 || winnersTop10.length === 0 ? (
                    <div style={{ color: "rgba(15,23,42,.65)", fontWeight: 900 }}>No results yet.</div>
                  ) : null}
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 950, color: "rgba(2,6,23,.88)" }}>
                    All {isTeam ? "Teams" : "Players"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,.55)" }}>
                    Scroll to view all
                  </div>
                </div>
                <div style={{ maxHeight: "48vh", overflow: "auto", paddingRight: 6 }}>
                  {isTeam ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {(allTeams || []).map((t, idx) => (
                        <ResultRow
                          key={`${t.id || t.teamId || t.name}-${idx}`}
                          rank={idx + 1}
                          name={t.name || t.teamName || "Team"}
                          score={Number(t.score || 0)}
                          extra={null}
                          avatarUrl={pickAvatar(t)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {(allPlayers || []).map((p, idx) => (
                        <ResultRow
                          key={`${p.id || p.playerId || p.name}-${idx}`}
                          rank={idx + 1}
                          name={p.name || "Player"}
                          score={Number(p.score || 0)}
                          extra={p.teamName ? `Team: ${p.teamName}` : null}
                          avatarUrl={pickAvatar(p)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "12px 18px",
              borderTop: "1px solid rgba(15,23,42,.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              color: "rgba(15,23,42,.60)",
              fontSize: 12,
              fontWeight: 850
            }}
          >
            <div>
              Showing <b style={{ color: "rgba(2,6,23,.88)" }}>final standings</b>.
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span>Pop Manager</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{ opacity: 0.9 }}>Results</span>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: -2,
            borderRadius: 28,
            background: "radial-gradient(600px 220px at 40% 0%, rgba(250,204,21,.22), transparent 60%), radial-gradient(520px 200px at 70% 10%, rgba(99,102,241,.18), transparent 55%)",
            filter: "blur(16px)",
            opacity: 0.75,
            zIndex: -1
          }}
        />
      </div>
    </div>
  );
}

/* ========================= Helpers ========================= */
function uniq(arr) { return Array.from(new Set((Array.isArray(arr) ? arr : []).filter(Boolean))); }
function safeKeyOf(p) { return String(p?.id || p?.playerId || p?.name || "").trim(); }
function preloadUrls(urls) {
  try {
    (urls || []).forEach((u) => {
      if (!u) return;
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = u;
    });
  } catch {}
}

/* ========================= Page ========================= */
export default function ScreenPage({ nav }) {
  const { connected, roomOpen, phase, cfg, matchEndsAt, topPlayers, topTeams } = useGameState((s) => s);

  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 120);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setClientRole("screen"); }, []);
  useEffect(() => {
    const h = () => unlockAudioOnce();
    window.addEventListener("pointerdown", h, { passive: true });
    return () => window.removeEventListener("pointerdown", h);
  }, []);

  const joinUrl = useMemo(() => `${window.location.origin}/`, []);
  const [qrVisible, setQrVisible] = useState(true);

  const matchLeft = matchEndsAt ? msToSecCeil(matchEndsAt - nowMs) : 0;
  const mode = cfg?.mode || "SOLO";
  const gameOver = isGameOverPhase(phase);
  const isPlaying = String(phase || "").toLowerCase() === "playing";
  const isLobby = String(phase || "").toLowerCase() === "lobby";
  const isIdle = String(phase || "").toLowerCase() === "idle" || phase === "";

  const showBigQR = isIdle || isLobby;

  // Freeze results
  const lastPhaseRef = useRef(phase);
  const [frozen, setFrozen] = useState({ active: false, endedAt: null, players: [], teams: [] });

  useEffect(() => {
    const prev = lastPhaseRef.current;
    lastPhaseRef.current = phase;

    const prevOver = isGameOverPhase(prev);
    const nowOver = isGameOverPhase(phase);

    if (!prevOver && nowOver) {
      setFrozen({
        active: true,
        endedAt: Date.now(),
        players: Array.isArray(topPlayers) ? JSON.parse(JSON.stringify(topPlayers)) : [],
        teams: Array.isArray(topTeams) ? JSON.parse(JSON.stringify(topTeams)) : []
      });
      return;
    }

    if (prevOver && !nowOver) {
      setFrozen({ active: false, endedAt: null, players: [], teams: [] });
    }
  }, [phase, topPlayers, topTeams]);

  const livePlayers = Array.isArray(topPlayers) ? topPlayers : [];
  const liveTeams = Array.isArray(topTeams) ? topTeams : [];
  const displayPlayersAll = frozen.active ? frozen.players : livePlayers;
  const displayTeamsAll = frozen.active ? frozen.teams : liveTeams;

  const avatarCacheRef = useRef(new Map());

  const displayPlayersAllCached = useMemo(() => {
    const arr = Array.isArray(displayPlayersAll) ? displayPlayersAll : [];
    for (const p of arr) {
      const k = String(p?.id || p?.playerId || p?.name || "").trim();
      const u = pickAvatar(p);
      if (k && u) avatarCacheRef.current.set(k, u);
    }
    return arr.map((p) => {
      const k = String(p?.id || p?.playerId || p?.name || "").trim();
      const u = pickAvatar(p) || (k ? avatarCacheRef.current.get(k) : "") || "";
      return u ? { ...p, avatarUrl: u } : p;
    });
  }, [displayPlayersAll]);

  const displayTeamsAllCached = useMemo(() => {
    const arr = Array.isArray(displayTeamsAll) ? displayTeamsAll : [];
    for (const t of arr) {
      const k = String(t?.id || t?.teamId || t?.name || t?.teamName || "").trim();
      const u = pickAvatar(t);
      if (k && u) avatarCacheRef.current.set(`team:${k}`, u);
    }
    return arr.map((t) => {
      const k = String(t?.id || t?.teamId || t?.name || t?.teamName || "").trim();
      const u = pickAvatar(t) || (k ? avatarCacheRef.current.get(`team:${k}`) : "") || "";
      return u ? { ...t, avatarUrl: u } : t;
    });
  }, [displayTeamsAll]);

  const displayPlayers = useMemo(() => (
    Array.isArray(displayPlayersAllCached) ? displayPlayersAllCached.slice(0, 600) : []
  ), [displayPlayersAllCached]);

  const displayTeams = useMemo(() => (
    Array.isArray(displayTeamsAllCached) ? displayTeamsAllCached.slice(0, 600) : []
  ), [displayTeamsAllCached]);

  const rosterAvatarUrls = useMemo(() => {
    const arr = mode === "TEAM" ? displayTeams : displayPlayers;
    return uniq((Array.isArray(arr) ? arr : []).map((p) => pickAvatar(p) || p?.avatarUrl || ""));
  }, [mode, displayPlayers, displayTeams]);

  useEffect(() => { preloadUrls(rosterAvatarUrls); }, [rosterAvatarUrls]);

  const top1ForFrames = useMemo(() => {
    const arr = mode === "TEAM" ? displayTeams : displayPlayers;
    return (Array.isArray(arr) ? arr : [])[0] || null;
  }, [mode, displayTeams, displayPlayers]);

  const top1ManagerName = useMemo(() => pickManagerName(top1ForFrames) || "Manager", [top1ForFrames]);
  const frames = useMemo(() => pickManagerPopFrames(top1ForFrames), [top1ForFrames]);
  const openFrame = frames.open;
  const closeFrame = frames.close;
  const canBlink = !!(openFrame && closeFrame);

  const [readyClose, setReadyClose] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setReadyClose(false);
    setReadyOpen(false);

    const load = (src, setOk) => {
      if (!src) return;
      const img = new Image();
      img.onload = () => alive && setOk(true);
      img.onerror = () => alive && setOk(false);
      img.src = src;
    };

    load(closeFrame, setReadyClose);
    load(openFrame, setReadyOpen);

    return () => { alive = false; };
  }, [closeFrame, openFrame]);

  const framesReady = readyClose && (canBlink ? readyOpen : true);

  const [mouthOpen, setMouthOpen] = useState(false);
  const lastBeepAtRef = useRef(0);

  useEffect(() => {
    if (!isPlaying || !framesReady) {
      setMouthOpen(false);
      return;
    }
    if (!canBlink) {
      setMouthOpen(false);
      return;
    }
    setMouthOpen(false);
    const t = setInterval(() => {
      setMouthOpen((v) => !v);
      const now = Date.now();
      if (now - lastBeepAtRef.current > 220) {
        lastBeepAtRef.current = now;
        beepPop(0.10);
      }
    }, 140);
    return () => clearInterval(t);
  }, [isPlaying, framesReady, canBlink]);

  const activeFrame = useMemo(() => {
    if (!framesReady) return closeFrame || "";
    if (!canBlink) return closeFrame || "";
    return mouthOpen ? openFrame : closeFrame;
  }, [framesReady, canBlink, mouthOpen, openFrame, closeFrame]);

  const showManagerBg = isPlaying && framesReady && !!activeFrame;

  const top10List = useMemo(() => {
    const arr = mode === "TEAM" ? displayTeams : displayPlayers;
    return (Array.isArray(arr) ? arr : []).slice(0, 10);
  }, [mode, displayPlayers, displayTeams]);

  const finishScale = useMemo(() => computeFinishScale(top10List), [top10List]);

  const lanes = useMemo(() => top10List.map((p, idx) => {
    const score = Number(p.score || 0);
    const pct = clamp((score / finishScale) * 100, 3, 97);
    const name = mode === "TEAM" ? (p.name || p.teamName || "Team") : (p.name || "Player");
    return {
      rank: idx + 1,
      name,
      score,
      avatarUrl: pickAvatar(p),
      pct
    };
  }), [top10List, finishScale, mode]);

  const winnersTop10 = useMemo(() => {
    if (mode === "TEAM") {
      return (displayTeams || []).slice(0, 10).map((t) => ({
        id: t.id || t.teamId || t.name || t.teamName,
        name: t.name || t.teamName || "Team",
        teamName: t.name || t.teamName,
        score: Number(t.score || 0),
        avatarUrl: pickAvatar(t)
      }));
    }
    return (displayPlayers || []).slice(0, 10).map((p) => ({
      id: p.id || p.playerId || p.name,
      name: p.name,
      score: Number(p.score || 0),
      teamName: p.teamName || null,
      avatarUrl: pickAvatar(p)
    }));
  }, [mode, displayPlayers, displayTeams]);

  const [showResults, setShowResults] = useState(false);
  useEffect(() => setShowResults(!!gameOver), [gameOver]);

  const showRosterStrip = phase === "lobby" || phase === "paused";
  const rosterStrip = useMemo(() => {
    const arr = mode === "TEAM" ? displayTeams : displayPlayers;
    return (Array.isArray(arr) ? arr : []).slice(0, 14);
  }, [mode, displayPlayers, displayTeams]);

  /* ── shared normal (dark) styles ── */
  const cardStyle = {
    padding: 10,
    border: "1px solid rgba(15,23,42,.10)",
    background: "rgba(255,255,255,.78)",
    borderRadius: 22,
    boxShadow: "0 30px 120px -90px rgba(2,6,23,.30)"
  };
  const innerStyle = {
    padding: 12,
    border: "1px solid rgba(15,23,42,.08)",
    background: "rgba(255,255,255,.65)",
    borderRadius: 18
  };
  const headColor = "rgba(2,6,23,.88)";
  const subColor = "rgba(15,23,42,.60)";
  const boldColor = "rgba(2,6,23,.92)";

  return (
  <div style={{ position: "relative", minHeight: "100vh" }}>
    {/* Base pastel background — always visible */}
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        background:
          "radial-gradient(900px 520px at 18% 12%, rgba(250,204,21,.22), transparent 55%), radial-gradient(860px 520px at 78% 18%, rgba(99,102,241,.18), transparent 58%), linear-gradient(180deg, rgba(248,250,252,1), rgba(241,245,249,1))"
      }}
    />

    {/* Manager photo — left 42% only while playing */}
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: isPlaying ? "42%" : "100%",
        zIndex: 1,
        pointerEvents: "none",
        opacity: showManagerBg ? 1 : 0,
        transition: "opacity 240ms ease",
        backgroundImage: showManagerBg ? `url("${activeFrame}")` : "none",
        backgroundSize: "contain",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat"
      }}
    />

    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: isPlaying ? "42%" : "100%",
        zIndex: 1,
        pointerEvents: "none",
        opacity: showManagerBg ? 1 : 0,
        transition: "opacity 240ms ease",
        background: "rgba(0,0,0,.06)"
      }}
    />

    {isPlaying ? (
      /* ═══════════════════════════════════════════
         PLAYING — show racing board only
      ═══════════════════════════════════════════ */
      <div style={{ position: "relative", zIndex: 2, display: "flex", minHeight: "100vh" }}>
        <div style={{ flex: "0 0 42%" }} />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: "20px 22px 22px 10px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center"
          }}
        >
          <TopBar title="Pop Manager" subtitle="" right={null} />

          <div style={{ height: 12 }} />

          <div style={cardStyle}>
            <Card big>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 950, color: headColor }}>
                    RACING ({mode === "TEAM" ? "Teams" : "Players"})
                  </div>
                  <div style={{ color: subColor, fontSize: 13 }}>
                    Time left <b style={{ color: boldColor }}>{Math.max(0, matchLeft)}s</b> · Finish scale: <b style={{ color: boldColor }}>0 → {finishScale}</b>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Pill>Top 10</Pill>
                </div>
              </div>

              <CardInner style={{ marginTop: 14 }}>
                <div style={{ ...innerStyle, minHeight: "72vh" }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    {lanes.length === 0 ? (
                      <div style={{ color: subColor, fontWeight: 900 }}>
                        Waiting for {mode === "TEAM" ? "teams" : "players"}...
                      </div>
                    ) : (
                      lanes.map((l) => (
                        <Lane
                          key={`${mode}-${l.rank}-${l.name}-${l.score}`}
                          rank={l.rank}
                          name={l.name}
                          score={l.score}
                          avatarUrl={l.avatarUrl}
                          pct={l.pct}
                        />
                      ))
                    )}
                  </div>
                </div>
              </CardInner>
            </Card>
          </div>
        </div>
      </div>
    ) : (
      /* ═══════════════════════════════════════════
         NON-PLAYING
      ═══════════════════════════════════════════ */
      <div style={{ position: "relative", zIndex: 2, padding: 22 }}>
        <div className="container">
          <TopBar title="Pop Manager" subtitle="" right={null} />

          {/* BIG QR — idle / lobby only */}
          {showBigQR && (
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  padding: "28px 32px",
                  borderRadius: 28,
                  border: "1px solid rgba(15,23,42,.10)",
                  background: "rgba(255,255,255,.88)",
                  boxShadow: "0 40px 120px -60px rgba(2,6,23,.20)",
                  maxWidth: 340,
                  textAlign: "center"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 10 }}>
                  <div style={{ fontWeight: 950, fontSize: 18, color: headColor }}>
                    Scan to Join
                  </div>
                  <button
                    onClick={() => setQrVisible((v) => !v)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(148,163,184,.30)",
                      background: "rgba(255,255,255,.70)",
                      color: subColor,
                      fontWeight: 900,
                      fontSize: 12,
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {qrVisible ? "Hide QR" : "Show QR"}
                  </button>
                </div>

                <div style={{ color: subColor, fontSize: 13 }}>
                  {isLobby ? "Game is starting soon — join now!" : "Waiting for players to join"}
                </div>

                {qrVisible && (
                  <>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 20,
                        background: "white",
                        border: "1px solid rgba(15,23,42,.08)",
                        boxShadow: "0 8px 32px -12px rgba(2,6,23,.12)"
                      }}
                    >
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=6&data=${encodeURIComponent(joinUrl)}`}
                        alt="QR code to join game"
                        width={200}
                        height={200}
                        style={{ display: "block", borderRadius: 10 }}
                      />
                    </div>
                    <div
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(15,23,42,.10)",
                        background: "rgba(15,23,42,.03)",
                        fontSize: 12,
                        fontWeight: 900,
                        color: subColor,
                        wordBreak: "break-all"
                      }}
                    >
                      {joinUrl}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Roster strip only before game */}
          {showRosterStrip && (
            <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
              <div
                className="pmPill"
                style={{
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  maxWidth: "min(980px, 96vw)",
                  overflow: "hidden",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  border: "1px solid rgba(15,23,42,.10)",
                  background: "rgba(255,255,255,.70)",
                  borderRadius: 999
                }}
              >
                {(rosterStrip || []).map((p) => {
                  const url = pickAvatar(p) || p?.avatarUrl || "";
                  if (!url) return null;
                  const k = safeKeyOf(p) + "|" + url;
                  return (
                    <img
                      key={k}
                      src={url}
                      alt=""
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        objectFit: "cover",
                        border: "1px solid rgba(15,23,42,.14)",
                        background: "rgba(255,255,255,.75)"
                      }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  );
                })}
                <span style={{ fontWeight: 950, color: headColor, fontSize: 12, whiteSpace: "nowrap" }}>
                  {mode === "TEAM" ? `${displayTeams.length} teams` : `${displayPlayers.length} players`}
                </span>
              </div>
            </div>
          )}

          {/* Manager name */}
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 40 }}>
            <div
              className="pmPill"
              style={{
                padding: "10px 16px",
                fontWeight: 950,
                color: headColor,
                border: "1px solid rgba(15,23,42,.10)",
                background: "rgba(255,255,255,.70)",
                borderRadius: 999
              }}
            >
              pop <span style={{ color: boldColor }}>{top1ManagerName}</span>
            </div>
          </div>

          {/* Show racing board after game end */}
          {gameOver && (
            <>
              <div className="pmCard" style={{ marginTop: 10, padding: 10, border: "1px solid rgba(15,23,42,.10)", background: "rgba(255,255,255,.78)", borderRadius: 22, boxShadow: "0 30px 120px -90px rgba(2,6,23,.30)" }}>
                <Card big>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 950, color: headColor }}>
                        FINAL RACE ({mode === "TEAM" ? "Teams" : "Players"})
                      </div>
                      <div style={{ color: subColor, fontSize: 13 }}>
                        Final results · Finish scale: <b style={{ color: boldColor }}>0 → {finishScale}</b>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Pill>Top 10</Pill>
                      <Pill>Final</Pill>
                    </div>
                  </div>

                  <CardInner style={{ marginTop: 14 }}>
                    <div className="pmInner" style={{ padding: 12, border: "1px solid rgba(15,23,42,.08)", background: "rgba(255,255,255,.65)", borderRadius: 18 }}>
                      <div style={{ display: "grid", gap: 12 }}>
                        {lanes.length === 0 ? (
                          <div style={{ color: subColor, fontWeight: 900 }}>
                            Waiting for {mode === "TEAM" ? "teams" : "players"}...
                          </div>
                        ) : (
                          lanes.map((l) => (
                            <Lane
                              key={`${mode}-${l.rank}-${l.name}-${l.score}`}
                              rank={l.rank}
                              name={l.name}
                              score={l.score}
                              avatarUrl={l.avatarUrl}
                              pct={l.pct}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </CardInner>
                </Card>
              </div>

              <div style={{ height: 16 }} />
            </>
          )}

          {/* Leaderboard only after game end */}
          {gameOver && (
            <div className="pmCard" style={{ padding: 10, border: "1px solid rgba(15,23,42,.10)", background: "rgba(255,255,255,.78)", borderRadius: 22, boxShadow: "0 30px 120px -90px rgba(2,6,23,.30)" }}>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 950, color: headColor }}>
                      Final Leaderboard
                    </div>
                    <div style={{ color: subColor, fontSize: 13 }}>
                      Final standings snapshot (stable)
                    </div>
                  </div>

                  <button
                    onClick={() => setShowResults(true)}
                    style={{
                      height: 34,
                      padding: "0 12px",
                      borderRadius: 999,
                      border: "1px solid rgba(15,23,42,.14)",
                      background: "linear-gradient(180deg, rgba(250,204,21,.26), rgba(2,6,23,.04))",
                      color: headColor,
                      fontWeight: 950,
                      cursor: "pointer"
                    }}
                  >
                    Show Results
                  </button>
                </div>

                <CardInner style={{ marginTop: 14 }}>
                  <div className="pmInner" style={{ padding: 12, border: "1px solid rgba(15,23,42,.08)", background: "rgba(255,255,255,.65)", borderRadius: 18 }}>
                    <Leaderboard mode={mode} topPlayers={displayPlayers} topTeams={displayTeams} />
                  </div>
                </CardInner>
              </Card>
            </div>
          )}

          <div style={{ marginTop: 12, color: subColor, fontSize: 12 }}>
            Tip: Use this page on a big screen · /screen
          </div>
        </div>
      </div>
    )}

    <EndgameOverlay
      open={showResults && gameOver}
      mode={mode}
      winnersTop10={winnersTop10}
      allPlayers={displayPlayers}
      allTeams={displayTeams}
      totals={{
        players: displayPlayers.length,
        teams: displayTeams.length,
        endedAt: frozen.endedAt
      }}
      onClose={() => setShowResults(false)}
    />
  </div>
);
}