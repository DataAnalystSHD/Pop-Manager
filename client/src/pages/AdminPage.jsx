// client/src/pages/AdminPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useGameState } from "../store/useGameState.js";
import Card, { CardInner } from "../components/Card.jsx";
import Toast from "../components/Toast.jsx";
import TopBar, { LinkBtn, TopPills } from "../components/TopBar.jsx";
import Leaderboard from "../components/Leaderboard.jsx";
import { fetchDepartments, adminUpsertDepartment, adminDeleteDepartment } from "../api/departmentsApi.js";
import { uploadManagerPhoto } from "../api/adminApi.js";

/* =========================
   Pastel "storybook" icon set (no emoji)
   (keep local so AdminPage is copy-paste safe)
========================= */
function Icon({ name, size = 18, style }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", style };
  const paths = {
    shield: (
      <path
        d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    ),
    key: (
      <>
        <path d="M7 14a5 5 0 115-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 9h10v4h-3v3h-3v3h-4v-4h2v-2h-2V9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    settings: (
      <>
        <path
          d="M12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M19.4 15a7.8 7.8 0 000-6l2-1.2-2-3.5-2.3.8a7.9 7.9 0 00-5.2-3L11.5 1h-3L8 2.1a7.9 7.9 0 00-5.2 3L.5 4.3l-2 3.5L.5 9a7.8 7.8 0 000 6l-2 1.2 2 3.5 2.3-.8a7.9 7.9 0 005.2 3l.5 1.1h3l.4-1.1a7.9 7.9 0 005.2-3l2.3.8 2-3.5L19.4 15z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          opacity=".0"
        />
      </>
    ),
    play: <path d="M9 7l10 5-10 5V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    pause: (
      <>
        <path d="M8 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    stop: <path d="M8 8h8v8H8V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    refresh: (
      <>
        <path d="M21 12a9 9 0 10-3.2 6.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M21 12v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    upload: (
      <>
        <path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 8l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M4 21h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M6 7l1 14h10l1-14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 7V4h6v3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    search: (
      <>
        <path d="M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" stroke="currentColor" strokeWidth="2" />
        <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    users: (
      <>
        <path d="M17 21a6 6 0 00-12 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M11 13a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M21 21a5 5 0 00-6-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".85" />
      </>
    ),
    info: (
      <>
        <path d="M12 17v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 7h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 22a10 10 0 110-20 10 10 0 010 20z" stroke="currentColor" strokeWidth="2" />
      </>
    ),
  };
  return (
    <svg {...common} aria-hidden="true">
      {paths[name] || paths.info}
    </svg>
  );
}

/* =========================
   Pastel theme helpers
========================= */
const PASTEL_BG =
  "radial-gradient(1000px 600px at 10% -10%, rgba(255, 200, 221, .75), transparent 60%)," +
  "radial-gradient(900px 600px at 90% 0%, rgba(189, 224, 254, .75), transparent 55%)," +
  "radial-gradient(900px 700px at 40% 110%, rgba(205, 255, 216, .55), transparent 60%)," +
  "linear-gradient(180deg, rgba(255,255,255,1), rgba(248,250,252,1))";

const GLASS = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,.70)",
  background: "rgba(255,255,255,.62)",
  boxShadow: "0 20px 60px rgba(15,23,42,.12)",
  backdropFilter: "blur(12px)",
};

function Btn({ children, onClick, primary = false, danger = false, disabled = false, icon = null }) {
  const bg = primary
    ? "linear-gradient(135deg, rgba(189,224,254,.95), rgba(255,200,221,.85))"
    : "rgba(255,255,255,.70)";
  const border = danger ? "rgba(244,63,94,.28)" : "rgba(148,163,184,.25)";
  const color = danger ? "rgba(244,63,94,.92)" : "rgba(15,23,42,.92)";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${border}`,
        background: bg,
        color,
        padding: "10px 12px",
        borderRadius: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 900,
        opacity: disabled ? 0.55 : 1,
        boxShadow: "0 12px 26px rgba(15,23,42,.10)",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function fileToPreview(file) {
  if (!file) return "";
  try {
    return URL.createObjectURL(file);
  } catch {
    return "";
  }
}

function safeDeptIdClient(id) {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 40);
}

export default function AdminPage({ nav }) {
  const socket = window.__SOCKET__;
  const { roomOpen, phase, cfg, roster, topPlayers, topTeams, toast } = useGameState((s) => s);

  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);

  const [draft, setDraft] = useState({
    mode: "SOLO",
    lobbySeconds: 10,
    matchSeconds: 90,
    warnSeconds: 3,
    eventSecondsMin: 1,
    eventSecondsMax: 3,
    betweenEventSecondsMin: 8,
    betweenEventSecondsMax: 14,
    maxTeamSize: 5,
  });

  // Departments + manager upload
  const [departments, setDepartments] = useState([]);
  const [deptQuery, setDeptQuery] = useState("");
  const [deptId, setDeptId] = useState("");
  const [managerName, setManagerName] = useState("");

  // dept CRUD
  const [newDeptId, setNewDeptId] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [deptCrudMsg, setDeptCrudMsg] = useState("");
  const [deptCrudBusy, setDeptCrudBusy] = useState(false);

  // two files
  const [fileClosed, setFileClosed] = useState(null);
  const [fileOpen, setFileOpen] = useState(null);

  const [uploadMsg, setUploadMsg] = useState("");

  // previews
  const closedPreview = useMemo(() => fileToPreview(fileClosed), [fileClosed]);
  const openPreview = useMemo(() => fileToPreview(fileOpen), [fileOpen]);

  useEffect(() => {
    return () => {
      if (closedPreview) URL.revokeObjectURL(closedPreview);
      if (openPreview) URL.revokeObjectURL(openPreview);
    };
  }, [closedPreview, openPreview]);

  const loadDepartments = async () => {
    const list = await fetchDepartments().catch(() => []);
    const safe = Array.isArray(list) ? list : [];
    setDepartments(safe);

    if (safe.length) {
      const exists = safe.some((d) => String(d.id) === String(deptId));
      if (!deptId || !exists) setDeptId(safe[0]?.id || "");
    } else {
      setDeptId("");
    }

    return safe;
  };

  useEffect(() => {
    loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredDepts = useMemo(() => {
    const q = deptQuery.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => {
      const id = String(d.id || "").toLowerCase();
      const name = String(d.name || "").toLowerCase();
      const mn = String(d.manager?.name || "").toLowerCase();
      return id.includes(q) || name.includes(q) || mn.includes(q);
    });
  }, [deptQuery, departments]);

  const selectedDept = useMemo(() => {
    return departments.find((d) => String(d.id) === String(deptId)) || null;
  }, [departments, deptId]);

  async function onUploadManagerPhoto() {
    try {
      setUploadMsg("");
      if (!deptId) return setUploadMsg("กรุณาเลือกแผนก");
      if (!fileClosed) return setUploadMsg("กรุณาเลือกรูป Closed (ปากปิด)");
      if (!fileOpen) return setUploadMsg("กรุณาเลือกรูป Open (ปากอ้า)");

      const okTypes = ["image/png", "image/jpeg", "image/webp"];
      if (fileClosed && !okTypes.includes(fileClosed.type)) return setUploadMsg("Closed ต้องเป็น png/jpg/webp");
      if (fileOpen && !okTypes.includes(fileOpen.type)) return setUploadMsg("Open ต้องเป็น png/jpg/webp");

      setUploadMsg("Uploading (closed + open) ...");

      await uploadManagerPhoto({
        adminKey: key,
        deptId,
        managerName,
        closedFile: fileClosed,
        openFile: fileOpen,
      });

      await loadDepartments();

      setFileClosed(null);
      setFileOpen(null);

      setUploadMsg("Upload สำเร็จ");
    } catch (e) {
      setUploadMsg(String(e?.message || e));
    }
  }

  async function onAddOrUpdateDept() {
    try {
      setDeptCrudMsg("");
      const id = safeDeptIdClient(newDeptId);
      const name = String(newDeptName || "").trim();

      if (!id) return setDeptCrudMsg("กรุณาใส่ Dept ID");
      if (!name) return setDeptCrudMsg("กรุณาใส่ Dept Name");

      setDeptCrudBusy(true);
      setDeptCrudMsg("Saving department...");

      await adminUpsertDepartment(key, { deptId: id, deptName: name });

      await loadDepartments();
      setDeptId(id);
      setDeptCrudMsg("Saved department");
      setNewDeptId("");
      setNewDeptName("");
    } catch (e) {
      setDeptCrudMsg(String(e?.message || e));
    } finally {
      setDeptCrudBusy(false);
    }
  }

  async function onDeleteDept(id) {
    const deptSafe = safeDeptIdClient(id);
    if (!deptSafe) return;

    const ok = window.confirm(
      `Delete department ${deptSafe}?\n\n- ลบจาก Supabase table\n- ลบ manager pop ใน Supabase (ถ้ามี)\n\nทำต่อไหม?`
    );
    if (!ok) return;

    try {
      setDeptCrudMsg("");
      setDeptCrudBusy(true);
      setDeptCrudMsg(`Deleting ${deptSafe}...`);

      await adminDeleteDepartment(key, deptSafe);

      const next = await loadDepartments();
      if (String(deptId) === String(deptSafe)) setDeptId(next?.[0]?.id || "");

      setDeptCrudMsg(`Deleted ${deptSafe}`);
    } catch (e) {
      setDeptCrudMsg(String(e?.message || e));
    } finally {
      setDeptCrudBusy(false);
    }
  }

  // sync draft from cfg
  useEffect(() => {
    setDraft((d) => ({ ...d, ...cfg }));
  }, [cfg]);

  // socket admin auth
  useEffect(() => {
    if (!socket) return;
    const onAdminOk = (p) => setAuthed(!!p.ok);
    socket.on("admin_ok", onAdminOk);
    return () => socket.off("admin_ok", onAdminOk);
  }, [socket]);

  const login = () => socket?.emit("admin_login", { key });

  const applyCfg = () => {
    const payload = { ...draft };
    if (payload.mode !== "TEAM") delete payload.maxTeamSize;
    socket?.emit("admin_config", payload);
  };

  const toggleRoom = () => socket?.emit("admin_room_toggle", { open: !roomOpen });
  const start = () => socket?.emit("admin_start");
  const pauseToggle = () => socket?.emit("admin_pause_toggle");
  const end = () => socket?.emit("admin_end");
  const resetRoom = () => socket?.emit("admin_reset_room");
  const clearResults = () => {
    const ok = window.confirm("Clear Results?\n\nThis will set ALL player scores to 0 (no kick).");
    if (!ok) return;
    socket?.emit("admin_clear_results");
  };

  return (
    <div style={{ minHeight: "100vh", background: PASTEL_BG, padding: 22, color: "rgba(15,23,42,.92)" }}>
      <div className="container">
        <div style={{ ...GLASS, padding: 14, marginBottom: 14 }}>
          <TopBar
            title="Admin Console"
            subtitle="Room · Start/Pause/End · Mode · Team size · Reset · Realtime roster"
            right={
              <>
                <TopPills roomOpen={roomOpen} phase={phase} mode={cfg.mode || "SOLO"} />
                <LinkBtn onClick={() => nav("/")}>Player</LinkBtn>
                <LinkBtn onClick={() => nav("/screen")}>Screen</LinkBtn>
              </>
            }
          />
        </div>

        {!authed ? (
          <Card big>
            <div style={{ padding: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 950, display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="shield" />
                Admin Login
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Admin key"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,.25)",
                    background: "rgba(255,255,255,.72)",
                    color: "rgba(15,23,42,.92)",
                    outline: "none",
                    minWidth: 240,
                    boxShadow: "0 10px 22px rgba(15,23,42,.08)",
                  }}
                />
                <Btn primary onClick={login} icon={<Icon name="key" />}>
                  Login
                </Btn>
              </div>
            </div>
          </Card>
        ) : (
          <div className="gridAdmin">
            {/* Room controls */}
            <Card big>
              <div style={{ padding: 4 }}>
                <div style={{ fontSize: 18, fontWeight: 950, display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name="settings" />
                  Room & Game Controls
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: `1px solid ${roomOpen ? "rgba(34,197,94,.30)" : "rgba(244,63,94,.28)"}`,
                    background: "rgba(255,255,255,.65)",
                    fontWeight: 900,
                    boxShadow: "0 12px 26px rgba(15,23,42,.10)",
                  }}
                >
                  Room is <b>{roomOpen ? "OPEN" : "CLOSED"}</b>
                  <span style={{ opacity: 0.88 }}> · {roomOpen ? "players can join" : "players cannot join"}</span>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <Btn primary={!roomOpen} onClick={toggleRoom} icon={<Icon name="shield" />}>
                    {roomOpen ? "Close Room (ห้าม Join)" : "Open Room (ให้ Join ได้)"}
                  </Btn>

                  <Btn primary onClick={applyCfg} icon={<Icon name="settings" />}>
                    Apply Settings
                  </Btn>

                  <Btn onClick={start} disabled={phase === "lobby" || phase === "playing"} icon={<Icon name="play" />}>
                    Start Game
                  </Btn>

                  <Btn
                    onClick={pauseToggle}
                    disabled={!(phase === "playing" || phase === "paused")}
                    icon={<Icon name="pause" />}
                  >
                    {phase === "paused" ? "Resume" : "Pause"}
                  </Btn>

                  <Btn danger onClick={end} disabled={phase === "idle"} icon={<Icon name="stop" />}>
                    End Game
                  </Btn>

                  <Btn danger onClick={clearResults} disabled={(roster || []).length === 0} icon={<Icon name="trash" />}>
                    Clear Results (score = 0)
                  </Btn>

                  <Btn danger onClick={resetRoom} icon={<Icon name="trash" />}>
                    Reset Room (เตะทุกคนออก)
                  </Btn>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(15,23,42,.88)" }}>Mode</div>
                  <select
                    value={draft.mode}
                    onChange={(e) => setDraft((d) => ({ ...d, mode: e.target.value }))}
                    style={{
                      padding: "9px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.25)",
                      background: "rgba(255,255,255,.72)",
                      color: "rgba(15,23,42,.92)",
                      outline: "none",
                      fontWeight: 900,
                      boxShadow: "0 10px 22px rgba(15,23,42,.08)",
                    }}
                  >
                    <option value="SOLO">SOLO</option>
                    <option value="TEAM">TEAM</option>
                  </select>

                  {draft.mode === "TEAM" && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(15,23,42,.88)" }}>Max team size</div>
                      <input
                        type="number"
                        value={draft.maxTeamSize}
                        onChange={(e) => setDraft((d) => ({ ...d, maxTeamSize: e.target.value }))}
                        style={{
                          width: 90,
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,.25)",
                          background: "rgba(255,255,255,.72)",
                          color: "rgba(15,23,42,.92)",
                          outline: "none",
                          boxShadow: "0 10px 22px rgba(15,23,42,.08)",
                        }}
                      />
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                  <Label>Lobby (sec)</Label>
                  <Num value={draft.lobbySeconds} onChange={(v) => setDraft((d) => ({ ...d, lobbySeconds: v }))} />
                  <Label>Match (sec)</Label>
                  <Num value={draft.matchSeconds} onChange={(v) => setDraft((d) => ({ ...d, matchSeconds: v }))} />
                  <Label>Warn (sec)</Label>
                  <Num value={draft.warnSeconds} onChange={(v) => setDraft((d) => ({ ...d, warnSeconds: v }))} />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                  <Label>Event len (min/max)</Label>
                  <Num value={draft.eventSecondsMin} onChange={(v) => setDraft((d) => ({ ...d, eventSecondsMin: v }))} />
                  <Num value={draft.eventSecondsMax} onChange={(v) => setDraft((d) => ({ ...d, eventSecondsMax: v }))} />
                  <Label>Between (min/max)</Label>
                  <Num value={draft.betweenEventSecondsMin} onChange={(v) => setDraft((d) => ({ ...d, betweenEventSecondsMin: v }))} />
                  <Num value={draft.betweenEventSecondsMax} onChange={(v) => setDraft((d) => ({ ...d, betweenEventSecondsMax: v }))} />
                </div>

                <div style={{ marginTop: 10, color: "rgba(15,23,42,.88)", fontSize: 14 }}>
                  Phase: <b>{phase}</b>
                </div>

                <Toast toast={toast} />
              </div>
            </Card>

            {/* Manager pop uploader + Dept CRUD */}
            <Card big>
              <div style={{ padding: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 950, display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name="upload" />
                  ตั้งค่ารูป Manager Pop (Closed/Open) ต่อแผนก
                </div>
                <div style={{ marginTop: 6, color: "rgba(15,23,42,.88)", fontSize: 13, lineHeight: 1.5 }}>
                  เลือกแผนก → ใส่ชื่อ (optional) → อัปโหลดรูป 2 รูป <b>Closed</b> + <b>Open</b>
                </div>

                {/* Department CRUD panel */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ ...GLASS, padding: 12 }}>
                    <div style={{ fontWeight: 950, fontSize: 13, opacity: 0.92 }}>Add / Update Department</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr auto", gap: 10, marginTop: 10 }}>
                      <input value={newDeptId} onChange={(e) => setNewDeptId(e.target.value)} placeholder="DEPT ID (เช่น KAM)" style={inputStyle} />
                      <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="Dept Name (เช่น Key Account)" style={inputStyle} />
                      <Btn primary onClick={onAddOrUpdateDept} disabled={deptCrudBusy} icon={<Icon name="settings" />}>
                        {deptCrudBusy ? "Saving..." : "Add / Update"}
                      </Btn>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.88, lineHeight: 1.45 }}>
                      • ถ้า Dept ID ซ้ำ จะเป็น Update ชื่อให้ทันที<br />
                      • ปุ่ม Delete อยู่ในรายการแผนกด้านล่าง
                    </div>

                    {deptCrudMsg ? <div style={{ marginTop: 8, fontSize: 13, opacity: 0.92 }}>{deptCrudMsg}</div> : null}
                  </div>
                </div>

                <CardInner style={{ marginTop: 12 }}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                        <input
                          value={deptQuery}
                          onChange={(e) => setDeptQuery(e.target.value)}
                          placeholder="Search dept (id / name / manager)..."
                          style={{ ...inputStyle, width: "100%", paddingLeft: 40 }}
                        />
                        <div style={{ position: "absolute", left: 12, top: 11, color: "rgba(15,23,42,.75)" }}>
                          <Icon name="search" />
                        </div>
                      </div>

                      <Btn onClick={() => loadDepartments()} disabled={deptCrudBusy} icon={<Icon name="refresh" />}>
                        Refresh
                      </Btn>
                    </div>

                    <div
                      style={{
                        borderRadius: 14,
                        border: "1px solid rgba(148,163,184,.20)",
                        background: "rgba(255,255,255,.60)",
                        padding: 10,
                        maxHeight: 240,
                        overflow: "auto",
                        boxShadow: "0 12px 26px rgba(15,23,42,.08)",
                      }}
                    >
                      {filteredDepts.map((d) => {
                        const selected = String(d.id) === String(deptId);
                        return (
                          <div
                            key={d.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 10,
                              marginBottom: 8,
                              alignItems: "stretch",
                            }}
                          >
                            <button
                              onClick={() => {
                                setDeptId(d.id);
                                setUploadMsg("");
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                borderRadius: 14,
                                border: `1px solid ${selected ? "rgba(99,102,241,.30)" : "rgba(148,163,184,.20)"}`,
                                background: selected
                                  ? "linear-gradient(135deg, rgba(189,224,254,.60), rgba(255,200,221,.50))"
                                  : "rgba(255,255,255,.70)",
                                padding: "10px 10px",
                                cursor: "pointer",
                                color: "rgba(15,23,42,.92)",
                                boxShadow: "0 12px 26px rgba(15,23,42,.08)",
                              }}
                            >
                              <div style={{ fontWeight: 950 }}>
                                {d.name} <span style={{ opacity: 0.88, fontWeight: 800 }}>({d.id})</span>
                              </div>
                              <div style={{ fontSize: 12, opacity: 0.88 }}>
                                Manager: <b>{d.manager?.name || "—"}</b>
                              </div>
                              <div style={{ fontSize: 12, opacity: 0.80, marginTop: 2 }}>
                                Pop: <span style={{ opacity: 0.9 }}>{d.manager?.pop?.closed ? "closed" : "—"} · {d.manager?.pop?.open ? "open" : "—"}</span>
                              </div>
                            </button>

                            <Btn danger disabled={deptCrudBusy} onClick={() => onDeleteDept(d.id)} icon={<Icon name="trash" />}>
                              Delete
                            </Btn>
                          </div>
                        );
                      })}

                      {filteredDepts.length === 0 && (
                        <div style={{ color: "rgba(15,23,42,.80)", fontSize: 12 }}>No departments found</div>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, opacity: 0.88 }}>Selected Department</div>
                        <div
                          style={{
                            marginTop: 6,
                            padding: "10px 12px",
                            borderRadius: 14,
                            border: "1px solid rgba(148,163,184,.20)",
                            background: "rgba(255,255,255,.70)",
                            fontWeight: 950,
                            boxShadow: "0 10px 22px rgba(15,23,42,.08)",
                          }}
                        >
                          {selectedDept ? (
                            <>
                              {selectedDept.name} <span style={{ opacity: 0.88 }}>({selectedDept.id})</span>
                            </>
                          ) : (
                            <span style={{ opacity: 0.88 }}>—</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, opacity: 0.88 }}>Manager Name (optional)</div>
                        <input
                          value={managerName}
                          onChange={(e) => setManagerName(e.target.value)}
                          placeholder="เช่น คุณ A"
                          style={{ ...inputStyle, width: "100%", marginTop: 6 }}
                        />
                      </div>
                    </div>

                    {/* two file pickers + preview */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                      <ImageUploadBox
                        title="Closed (ปากปิด)"
                        hint={`ไฟล์จะถูกบันทึกเป็น: ${deptId || "DEPT"}_closed.jpg`}
                        file={fileClosed}
                        setFile={setFileClosed}
                        previewSrc={closedPreview}
                        currentSrc={selectedDept?.manager?.pop?.closed}
                        emptyText="No Closed image"
                      />
                      <ImageUploadBox
                        title="Open (ปากอ้า)"
                        hint={`ไฟล์จะถูกบันทึกเป็น: ${deptId || "DEPT"}_open.jpg`}
                        file={fileOpen}
                        setFile={setFileOpen}
                        previewSrc={openPreview}
                        currentSrc={selectedDept?.manager?.pop?.open}
                        emptyText="No Open image"
                      />
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                      <Btn primary onClick={onUploadManagerPhoto} icon={<Icon name="upload" />}>
                        Upload Closed + Open
                      </Btn>

                      <Btn
                        onClick={() => {
                          setFileClosed(null);
                          setFileOpen(null);
                          setUploadMsg("");
                        }}
                        disabled={!fileClosed && !fileOpen}
                        icon={<Icon name="trash" />}
                      >
                        Clear Selected Files
                      </Btn>

                      {uploadMsg ? <div style={{ fontSize: 13, opacity: 0.92 }}>{uploadMsg}</div> : null}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                      <div style={{ fontSize: 13, opacity: 0.90 }}>
                        Current: <b>{selectedDept?.manager?.name || "—"}</b>{" "}
                        <span style={{ opacity: 0.88 }}>({deptId || "—"})</span>
                        <span style={{ opacity: 0.88 }}>
                          {" "}
                          · closed: {selectedDept?.manager?.pop?.closed ? "yes" : "—"} · open:{" "}
                          {selectedDept?.manager?.pop?.open ? "yes" : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardInner>
              </div>
            </Card>

            {/* Joined players */}
            <Card>
              <div style={{ padding: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 950, color: "rgba(15,23,42,.88)", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name="users" />
                  Joined Players ({(roster || []).length})
                </div>

                <div
                  style={{
                    maxHeight: 420,
                    overflow: "auto",
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,.20)",
                    background: "rgba(255,255,255,.60)",
                    padding: 10,
                    boxShadow: "0 12px 26px rgba(15,23,42,.08)",
                  }}
                >
                  {(roster || []).map((p) => (
                    <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,.18)" }}>
                      <b style={{ color: "rgba(15,23,42,.92)" }}>{p.name}</b>
                      <span style={{ color: "rgba(15,23,42,.80)", fontSize: 12 }}>
                        {" "}
                        · ฝ่าย {p.departmentLabel} ({p.departmentKey}) · {p.score} pts
                      </span>
                      {p.teamCode && (
                        <span style={{ color: "rgba(15,23,42,.80)", fontSize: 12 }}>
                          {" "}
                          · ทีม {p.teamName} ({p.teamCode})
                        </span>
                      )}
                    </div>
                  ))}
                  {(roster || []).length === 0 && (
                    <div style={{ color: "rgba(15,23,42,.80)", fontSize: 12 }}>No players yet</div>
                  )}
                </div>
              </div>
            </Card>

            {/* Leaderboard */}
            <Card>
              <Leaderboard mode={cfg.mode || "SOLO"} topPlayers={topPlayers || []} topTeams={topTeams || []} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  height: 40,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,.25)",
  background: "rgba(255,255,255,.72)",
  color: "rgba(15,23,42,.92)",
  outline: "none",
  boxShadow: "0 10px 22px rgba(15,23,42,.08)",
};

function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(15,23,42,.88)" }}>{children}</div>;
}

function Num({ value, onChange }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 90,
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,.25)",
        background: "rgba(255,255,255,.72)",
        color: "rgba(15,23,42,.92)",
        outline: "none",
        boxShadow: "0 10px 22px rgba(15,23,42,.08)",
      }}
    />
  );
}

function ImageUploadBox({ title, hint, file, setFile, previewSrc, currentSrc, emptyText }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,.20)",
        background: "rgba(255,255,255,.62)",
        padding: 12,
        boxShadow: "0 12px 26px rgba(15,23,42,.08)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.92 }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.80, marginTop: 2 }}>{hint}</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>

      <div
        style={{
          marginTop: 10,
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid rgba(148,163,184,.20)",
          background: "rgba(255,255,255,.70)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {file ? (
          <img src={previewSrc} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : currentSrc ? (
          <img src={currentSrc} alt="current" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ fontSize: 12, opacity: 0.80 }}>{emptyText}</div>
        )}
      </div>
    </div>
  );
}
