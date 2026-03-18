// server/src/http/adminUpload.routes.js
import express from "express";
import multer from "multer";
// FIX #4: Use fs.promises (async) instead of fs.readFileSync/writeFileSync.
// Sync disk I/O blocks the entire Node.js event loop — all 400 WebSocket
// connections stall until the read/write completes.
import { readFile, writeFile } from "fs/promises";
import path from "path";

import { upsertManager, deleteManager, listManagers, getManagerBucket } from "../services/managerPop.service.js";

const router = express.Router();

// ===== ENV =====
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const DEPTS_PATH = path.join(process.cwd(), "departments.json");

// ===== Multer (memory) =====
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("ONLY_JPG_PNG_WEBP"), ok);
  },
});

function requireAdminHttp(req, res, next) {
  // allow OPTIONS preflight
  if (req.method === "OPTIONS") return next();

  const k = String(req.headers["x-admin-key"] || "");
  if (!ADMIN_KEY || k !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  return next();
}

function safeDeptId(id) {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 40);
}

function asStr(v) {
  return String(v ?? "").trim();
}

function readDeptJsonRaw() {
  // NOTE: This now returns a Promise — all callers must await it.
  return readFile(DEPTS_PATH, "utf-8")
    .then((raw) => {
      const j = JSON.parse(raw);
      const arr = Array.isArray(j) ? j : Array.isArray(j?.departments) ? j.departments : [];
      return Array.isArray(arr) ? arr : [];
    })
    .catch(() => []);
}

function writeDeptJsonRaw(arr) {
  return writeFile(DEPTS_PATH, JSON.stringify(arr, null, 2), "utf-8");
}

/**
 * ========= MANAGER POP (existing) =========
 */

// GET /api/admin/managers
router.get("/managers", async (_req, res) => {
  try {
    const managers = await listManagers();
    return res.json({ ok: true, bucket: getManagerBucket(), managers });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "LIST_FAILED", message: String(e?.message || e) });
  }
});

// POST /api/admin/manager-pop
router.post(
  "/manager-pop",
  requireAdminHttp,
  upload.fields([
    { name: "closed", maxCount: 1 },
    { name: "open", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const deptId = safeDeptId(req.body.deptId);
      const deptName = asStr(req.body.deptName || "");
      const managerName = asStr(req.body.managerName || "");

      const closedFile = req.files?.closed?.[0] || null;
      const openFile = req.files?.open?.[0] || null;

      if (!deptId) return res.status(400).json({ ok: false, error: "MISSING_DEPT_ID" });

      if (!closedFile && !openFile && !deptName && !managerName) {
        return res.status(400).json({ ok: false, error: "NOTHING_TO_UPDATE" });
      }

      const saved = await upsertManager({ deptId, deptName, managerName, closedFile, openFile });
      return res.json({ ok: true, ...saved });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "UPLOAD_FAILED", message: String(e?.message || e) });
    }
  }
);

// DELETE /api/admin/manager/:deptId
router.delete("/manager/:deptId", requireAdminHttp, async (req, res) => {
  try {
    const deptId = safeDeptId(req.params.deptId);
    if (!deptId) return res.status(400).json({ ok: false, error: "MISSING_DEPT_ID" });

    await deleteManager(deptId);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "DELETE_FAILED", message: String(e?.message || e) });
  }
});

/**
 * ========= NEW: DEPARTMENTS CRUD =========
 */

// GET /api/admin/departments (raw from departments.json)
router.get("/departments", requireAdminHttp, async (_req, res) => {
  const depts = await readDeptJsonRaw();
  return res.json({ ok: true, departments: depts });
});

// POST /api/admin/departments  (add OR update name)
router.post("/departments", requireAdminHttp, async (req, res) => {
  try {
    const id = safeDeptId(req.body?.deptId);
    const name = asStr(req.body?.deptName);

    if (!id) return res.status(400).json({ ok: false, error: "MISSING_DEPT_ID" });
    if (!name) return res.status(400).json({ ok: false, error: "MISSING_DEPT_NAME" });

    const depts = await readDeptJsonRaw();

    const idx = depts.findIndex((d) => safeDeptId(d?.id || d?.key) === id);
    if (idx >= 0) {
      depts[idx] = { ...depts[idx], id, name };
    } else {
      depts.push({ id, name, manager: null });
    }

    await writeDeptJsonRaw(depts);
    return res.json({ ok: true, dept: { id, name } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "DEPT_UPSERT_FAILED", message: String(e?.message || e) });
  }
});

// DELETE /api/admin/departments/:deptId
router.delete("/departments/:deptId", requireAdminHttp, async (req, res) => {
  try {
    const id = safeDeptId(req.params.deptId);
    if (!id) return res.status(400).json({ ok: false, error: "MISSING_DEPT_ID" });

    const depts = await readDeptJsonRaw();
    const next = depts.filter((d) => safeDeptId(d?.id || d?.key) !== id);
    await writeDeptJsonRaw(next);

    await deleteManager(id).catch(() => {});

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "DEPT_DELETE_FAILED", message: String(e?.message || e) });
  }
});

export default router;