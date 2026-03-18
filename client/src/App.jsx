// client/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createSocket } from "./lib/socket.js";
import { setState } from "./store/gameStore.js";
import PlayerPage from "./pages/PlayerPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import ScreenPage from "./pages/ScreenPage.jsx";

function usePath() {
  const [p, setP] = useState(window.location.pathname || "/");
  useEffect(() => {
    const onPop = () => setP(window.location.pathname || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const nav = (to) => {
    window.history.pushState({}, "", to);
    setP(to);
  };
  return { path: p, nav };
}

function roleFromPath(path) {
  if (String(path || "").startsWith("/screen")) return "screen";
  if (String(path || "").startsWith("/admin")) return "admin";
  return "player";
}

function DebugBanner() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const onErr = () => setOk(false);
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    };
  }, []);

  if (ok) return null;
  return (
    <div style={{ position: "fixed", bottom: 12, left: 12, right: 12, zIndex: 99999 }}>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid rgba(248,113,113,.45)",
          background: "rgba(2,6,23,.55)",
          color: "rgba(255,255,255,.92)",
          fontWeight: 900,
        }}
      >
        ⚠️ Runtime error occurred. Open DevTools Console (F12) to see details.
      </div>
    </div>
  );
}

export default function App() {
  const { path, nav } = usePath();
  const role = useMemo(() => roleFromPath(path), [path]);

  const [bootMsg, setBootMsg] = useState("Booting…");
  useEffect(() => {
    setBootMsg(`Booted. Path: ${window.location.pathname || "/"}`);
  }, []);

  useEffect(() => {
    const s = createSocket();
    window.__SOCKET__ = s;

    console.log("[socket] init", s);

    const emitRole = () => {
      const r = roleFromPath(window.location.pathname || "/");
      console.log("[socket] join_role ->", r);
      s.emit("join_role", { role: r });

      // screen/admin usually need roster immediately
      if (r === "screen" || r === "admin") {
        s.emit("request_roster");
      }
    };

    s.on("connect", () => {
      console.log("[socket] connected", s.id);
      setState({ connected: true });
      emitRole();
    });

    s.on("disconnect", (r) => {
      console.log("[socket] disconnected", r);
      setState({ connected: false });
    });

    s.on("toast", (t) => {
      setState({ toast: { type: t.type || "info", msg: t.message || "" } });
      setTimeout(() => setState({ toast: null }), 1400);
    });

    s.on("state", (st) => {
      setState({
        roomOpen: st.roomOpen !== false,
        phase: st.phase,
        cfg: st.cfg || {},
        matchId: st.matchId || null,
        round: st.round || 0,
        lobbyEndsAt: st.lobbyEndsAt || null,
        matchEndsAt: st.matchEndsAt || null,
        event: st.event || { active: false, type: null, endsAt: null },
      });
    });

    s.on("top_update", (p) => {
    console.log("[socket] top_update", {
      topPlayersLen: p?.topPlayers?.length,
      sample: p?.topPlayers?.[0],
      mode: p?.mode,
    });
    setState({
      topPlayers: p.topPlayers || [],
      topTeams: p.topTeams || [],
    });
  });

    // roster pushed by server (screen/admin) OR via request_roster
    s.on("roster", ({ roster }) => {
      setState({ roster: Array.isArray(roster) ? roster : [] });
    });

    let warnTimer = null;
    s.on("event_warning", ({ seconds }) => {
      if (warnTimer) clearInterval(warnTimer);
      let left = Number(seconds || 3);
      setState({ warn: { left } });
      warnTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(warnTimer);
          warnTimer = null;
          setState({ warn: null });
        } else {
          setState({ warn: { left } });
        }
      }, 1000);
    });

    s.on("event_start", ({ type, endsAt }) => {
      setState({ event: { active: true, type, endsAt: endsAt || null } });
      setState({
        toast: { type: type === "BOMB" ? "bad" : "good", msg: type === "BOMB" ? "💣 BOMB (-5)" : "✨ BONUS (+2)" },
      });
      setTimeout(() => setState({ toast: null }), 1200);
    });

    s.on("event_end", () => setState({ event: { active: false, type: null, endsAt: null } }));

    // expose helper for manual debugging
    window.__JOIN_ROLE__ = emitRole;

    return () => {
      if (warnTimer) clearInterval(warnTimer);
      try {
        s.off();
        s.close();
      } catch {}
      window.__SOCKET__ = null;
      window.__JOIN_ROLE__ = null;
    };
  }, []); // create socket once

  // ✅ whenever path changes, re-join correct role room
  useEffect(() => {
    const s = window.__SOCKET__;
    if (!s || !s.connected) return;

    console.log("[socket] path changed -> join_role", role);
    s.emit("join_role", { role });
    if (role === "screen" || role === "admin") s.emit("request_roster");
  }, [role]);

  let page = null;
  try {
    if (path === "/admin") page = <AdminPage nav={nav} />;
    else if (path === "/screen") page = <ScreenPage nav={nav} />;
    else page = <PlayerPage nav={nav} />;
  } catch (e) {
    console.error("Render error:", e);
    page = (
      <div style={{ padding: 24, color: "white" }}>
        <h2>Render error</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{String(e?.stack || e)}</pre>
        <button onClick={() => nav("/")}>Go Home</button>
      </div>
    );
  }

  return (
    <>
      {page}
      <DebugBanner />
    </>
  );
}