// server/src/services/managerPop.service.js
import { supabase } from "./supabase.service.js";

const BUCKET = process.env.SUPABASE_MANAGER_POP_BUCKET || "click-arena-managers";
const TABLE = process.env.SUPABASE_MANAGER_TABLE || "dept_managers";

function normDeptId(v) {
  return String(v || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 40);
}

function extFromMime(m) {
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "jpg";
}

export function getManagerBucket() {
  return BUCKET;
}

export function publicUrl(storagePath, version) {
  if (!storagePath) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const u = data?.publicUrl || "";
  return u ? `${u}?v=${encodeURIComponent(String(version || ""))}` : "";
}

export async function listManagers() {
  const { data, error } = await supabase.from(TABLE).select("*").order("dept_id", { ascending: true });
  if (error) throw new Error(error.message);

  return (data || []).map((r) => ({
    deptId: r.dept_id,
    deptName: r.dept_name || "",
    managerName: r.manager_name || "",
    pop: {
      closed: publicUrl(r.pop_closed_path, r.updated_at),
      open: publicUrl(r.pop_open_path, r.updated_at),
    },
    updatedAt: r.updated_at,
  }));
}

export async function upsertManager({ deptId, deptName, managerName, closedFile, openFile }) {
  const id = normDeptId(deptId);
  if (!id) throw new Error("DEPT_ID_REQUIRED");

  // load old row
  const { data: oldRow, error: oldErr } = await supabase.from(TABLE).select("*").eq("dept_id", id).maybeSingle();
  if (oldErr) throw new Error(oldErr.message);

  const nowIso = new Date().toISOString();

  // deterministic path => upload ซ้ำ = replace ได้แน่นอน
  const closedPath = closedFile
    ? `public/${id}_closed.${extFromMime(closedFile.mimetype)}`
    : oldRow?.pop_closed_path || null;

  const openPath = openFile
    ? `public/${id}_open.${extFromMime(openFile.mimetype)}`
    : oldRow?.pop_open_path || null;

  const uploadOne = async (storagePath, file) => {
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file.buffer, {
      contentType: file.mimetype || "image/jpeg",
      upsert: true,
      cacheControl: "60",
    });
    if (error) throw new Error(error.message || "UPLOAD_FAILED");
  };

  if (closedFile) await uploadOne(closedPath, closedFile);
  if (openFile) await uploadOne(openPath, openFile);

  const payload = {
    dept_id: id,
    dept_name: (deptName || oldRow?.dept_name || null) ?? null,
    manager_name: (managerName || oldRow?.manager_name || null) ?? null,
    pop_closed_path: closedPath,
    pop_open_path: openPath,
    updated_at: nowIso,
  };

  const { data: saved, error: saveErr } = await supabase.from(TABLE).upsert(payload).select("*").single();
  if (saveErr) throw new Error(saveErr.message);

  return {
    deptId: saved.dept_id,
    deptName: saved.dept_name || "",
    managerName: saved.manager_name || "",
    pop: {
      closed: publicUrl(saved.pop_closed_path, saved.updated_at),
      open: publicUrl(saved.pop_open_path, saved.updated_at),
    },
    updatedAt: saved.updated_at,
  };
}

export async function deleteManager(deptId) {
  const id = normDeptId(deptId);
  if (!id) throw new Error("DEPT_ID_REQUIRED");

  const { data: row, error: rErr } = await supabase.from(TABLE).select("*").eq("dept_id", id).maybeSingle();
  if (rErr) throw new Error(rErr.message);

  const paths = [];
  if (row?.pop_closed_path) paths.push(row.pop_closed_path);
  if (row?.pop_open_path) paths.push(row.pop_open_path);

  if (paths.length) {
    // ignore remove errors
    await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
  }

  const { error } = await supabase.from(TABLE).delete().eq("dept_id", id);
  if (error) throw new Error(error.message);

  return { ok: true };
}