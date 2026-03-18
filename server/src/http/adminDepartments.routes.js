// server/src/http/adminDepartments.routes.js
import express from "express";
// FIX #9: Import shared Supabase client instead of creating a second instance.
// Duplicate clients waste connections and create two service-role key references to audit.
import { supabase } from "../services/supabase.service.js";

const router = express.Router();

const ADMIN_KEY = process.env.ADMIN_KEY || "shd-admin";

function safeStr(v) {
  return String(v ?? "").trim();
}
function safeDeptId(id) {
  return safeStr(id).toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 40);
}

function requireAdmin(req, res, next) {
  const k = safeStr(req.headers["x-admin-key"]);
  if (!k || k !== ADMIN_KEY) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  next();
}

router.post("/departments", requireAdmin, express.json(), async (req, res) => {
  try {
    const deptId = safeDeptId(req.body?.deptId);
    const deptName = safeStr(req.body?.deptName);

    if (!deptId) return res.status(400).json({ ok: false, error: "MISSING_DEPT_ID" });
    if (!deptName) return res.status(400).json({ ok: false, error: "MISSING_DEPT_NAME" });

    const payload = {
      dept_id: deptId,
      dept_name: deptName,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("dept_managers")
      .upsert(payload, { onConflict: "dept_id" })
      .select("dept_id, dept_name")
      .single();

    if (error) throw new Error(error.message);

    return res.json({
      ok: true,
      dept: { id: data.dept_id, name: data.dept_name },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

router.delete("/departments/:id", requireAdmin, async (req, res) => {
  try {
    const deptId = safeDeptId(req.params.id);
    if (!deptId) return res.status(400).json({ ok: false, error: "MISSING_DEPT_ID" });

    const { error } = await supabase.from("dept_managers").delete().eq("dept_id", deptId);
    if (error) throw new Error(error.message);

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;