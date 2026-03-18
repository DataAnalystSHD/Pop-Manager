// client/src/api/adminApi.js
export async function uploadManagerPhoto({ adminKey, deptId, managerName, closedFile, openFile }) {
  const fd = new FormData();
  fd.append("deptId", deptId);
  if (managerName) fd.append("managerName", managerName);

  if (closedFile) fd.append("closed", closedFile);
  if (openFile) fd.append("open", openFile);

  const r = await fetch(`/api/admin/manager-pop`, {
    method: "POST",
    headers: {
      "x-admin-key": adminKey || "",
    },
    body: fd,
  });

  const j = await r.json();
  if (!j.ok) throw new Error(j.message || j.error || "UPLOAD_FAILED");
  return j;
}