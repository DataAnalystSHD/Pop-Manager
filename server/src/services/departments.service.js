// server/src/services/departments.service.js
import { listManagers } from "./managerPop.service.js";

// ---- cache ----
let _cache = [];
let _lastRefresh = 0;
const REFRESH_MS = Number(process.env.DEPTS_REFRESH_MS || 30_000);

function asStr(v) {
  return String(v ?? "").trim();
}
function upperKey(v) {
  return asStr(v).toUpperCase();
}

// Convert a listManagers() row into a department object
function managerRowToDept(m) {
  return {
    id: upperKey(m.deptId),
    name: asStr(m.deptName || m.deptId),
    manager: {
      name: asStr(m.managerName || ""),
      avatar: "",
      pop: {
        closed: asStr(m.pop?.closed || ""),
        open: asStr(m.pop?.open || ""),
      },
    },
  };
}

// ✅ Fetch departments entirely from Supabase — no departments.json needed
export async function refreshDepartmentsCache() {
  try {
    const mgrs = await listManagers();
    _cache = (mgrs || [])
      .filter((m) => m.deptId)
      .map(managerRowToDept);
  } catch (e) {
    console.error("[departments] refresh failed:", e?.message || e);
    // Keep existing cache if refresh fails — don't wipe it
  }

  _lastRefresh = Date.now();
  return _cache;
}

// Sync read — triggers async refresh in background if stale
export function readDepartments() {
  if (Date.now() - _lastRefresh > REFRESH_MS) {
    refreshDepartmentsCache().catch(() => {});
  }
  return _cache;
}

export function resolveDepartment(departmentKey) {
  const depts = readDepartments();
  const key = upperKey(departmentKey || "");
  if (!key) return null;
  return (
    depts.find((x) => x.id === key) ||
    depts.find((x) => upperKey(x.name) === key) ||
    null // ✅ never fall back to depts[0]
  );
}


refreshDepartmentsCache().catch(() => {});
