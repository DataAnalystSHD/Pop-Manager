export async function uploadManagerPhoto({ adminKey, deptId, managerName, closedFile, openFile }) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/pjpeg"];
  const maxSize = 3 * 1024 * 1024;

  const validateImage = (file, label) => {
    if (!file) return;
    if (!allowed.includes(file.type)) {
      throw new Error(
        `${label} image type is not supported (${file.type || "unknown"}). Please use JPG, PNG, or WEBP`
      );
    }
    if (file.size > maxSize) {
      throw new Error(`${label} image must be 3MB or less`);
    }
  };

  validateImage(closedFile, "Closed");
  validateImage(openFile, "Open");

  const fd = new FormData();
  fd.append("deptId", deptId);
  if (managerName) fd.append("managerName", managerName);

  if (closedFile) fd.append("closed", closedFile);
  if (openFile) fd.append("open", openFile);

  const r = await fetch("/api/admin/manager-pop", {
    method: "POST",
    headers: {
      "x-admin-key": adminKey || "",
    },
    body: fd,
  });

  const contentType = r.headers.get("content-type") || "";

  let payload = null;

  if (contentType.includes("application/json")) {
    payload = await r.json();
  } else {
    const text = await r.text();
    throw new Error(`Server returned ${r.status} ${r.statusText}: ${text.slice(0, 200)}`);
  }

  if (!r.ok || !payload?.ok) {
    throw new Error(payload?.message || payload?.error || "UPLOAD_FAILED");
  }

  return payload;
}