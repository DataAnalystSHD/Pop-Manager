// client/src/api/departmentsApi.js
async function readJsonSafe(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 160)}`);
}

export async function fetchDepartments() {
  const res = await fetch("/api/departments");
  const j = await readJsonSafe(res);
  if (!res.ok || !j.ok) throw new Error(j.message || j.error || `HTTP ${res.status}`);
  return Array.isArray(j.departments) ? j.departments : [];
}

// ✅ OPTION B: (adminKey, payload)
export async function adminUpsertDepartment(adminKey, { deptId, deptName }) {
  const r = await fetch(`/api/admin/departments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey || "",
    },
    body: JSON.stringify({ deptId, deptName }),
  });

  const j = await readJsonSafe(r);
  if (!j.ok) throw new Error(j.message || j.error || "DEPT_UPSERT_FAILED");
  return j.dept;
}

// ✅ OPTION B: (adminKey, deptId)
export async function adminDeleteDepartment(adminKey, deptId) {
  const r = await fetch(`/api/admin/departments/${encodeURIComponent(deptId)}`, {
    method: "DELETE",
    headers: {
      "x-admin-key": adminKey || "",
    },
  });

  const j = await readJsonSafe(r);
  if (!j.ok) throw new Error(j.message || j.error || "DEPT_DELETE_FAILED");
  return true;
}