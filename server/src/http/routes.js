// server/src/http/routes.js
import adminUploadRoutes from "./adminUpload.routes.js";
import adminDepartmentsRoutes from "./adminDepartments.routes.js";
import { listManagers } from "../services/managerPop.service.js";

// Convert Supabase rows into the shape the client expects
function toClientDepartmentRow(m) {
  const id = String(m?.deptId || "").trim().toUpperCase();
  const name = String(m?.deptName || "").trim() || id;

  return {
    id,
    name,
    manager: {
      name: m?.managerName || "",
      avatar: "",
      pop: {
        closed: m?.pop?.closed || "",
        open: m?.pop?.open || "",
      },
    },
  };
}

export function attachHttpRoutes(app) {
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // ✅ Source of Truth = Supabase table ONLY (public.dept_managers)
  app.get("/api/departments", async (_req, res) => {
    try {
      const mgr = await listManagers(); // reads SUPABASE_MANAGER_TABLE (dept_managers)
      const departments = (mgr || [])
        .map(toClientDepartmentRow)
        .filter((d) => d.id);

      res.json({ ok: true, departments });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // ✅ admin endpoints (CRUD dept rows in Supabase)
  app.use("/api/admin", adminDepartmentsRoutes);

  // ✅ upload endpoints (upload closed/open images + upsert row in Supabase)
  app.use("/api/admin", adminUploadRoutes);
}