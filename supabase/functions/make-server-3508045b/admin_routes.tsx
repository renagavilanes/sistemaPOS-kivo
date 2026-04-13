// admin_routes.tsx — RLS-bypass routes for sales, expenses & employees
// Uses SERVICE_ROLE_KEY to bypass RLS for employees.
// Called from index.ts BEFORE the global CORS middleware, so we add CORS here explicitly.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors } from "npm:hono/cors";

export function registerAdminRoutes(app: any): void {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.log("🔧 [ADMIN] Registering admin routes with CORS...");

  // ── CORS for /admin/* — must come BEFORE route handlers ──────────────────────
  app.use("/make-server-3508045b/admin/*", cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Business-ID"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }));

  // ── GET /admin/categories ────────────────────────────────────────────────────
  app.get("/make-server-3508045b/admin/categories", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      console.log("📂 [ADMIN/CATEGORIES] Fetching for business:", businessId);
      const { data, error } = await admin.from("categories").select("*").eq("business_id", businessId).order("name");
      if (error) { console.error("❌ [ADMIN/CATEGORIES]", error.message); return c.json({ error: error.message }, 500); }
      console.log(`✅ [ADMIN/CATEGORIES] ${data?.length ?? 0} records`);
      return c.json({ success: true, categories: data ?? [] });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // ── GET /admin/sales ─────────────────────────────────────────────────────────
  // Query: fields=balance → solo columnas para saldo por cliente (sin items/payments JSONB).
  app.get("/make-server-3508045b/admin/sales", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      const from = c.req.query("from"); const to = c.req.query("to"); const lim = c.req.query("limit");
      const fields = c.req.query("fields");
      const selectCols =
        fields === "balance"
          ? "id,customer_id,total,payment_status,paid_amount"
          : "*";
      let q: any = admin.from("sales").select(selectCols).eq("business_id", businessId).order("created_at", { ascending: false });
      if (from) q = q.gte("created_at", from);
      if (to)   q = q.lte("created_at", to);
      if (lim)  q = q.limit(Number(lim));
      const { data, error } = await q;
      if (error) return c.json({ error: error.message }, 500);
      return c.json({ success: true, sales: data ?? [] });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // ── GET /admin/expenses ──────────────────────────────────────────────────────
  app.get("/make-server-3508045b/admin/expenses", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      const from = c.req.query("from"); const to = c.req.query("to"); const lim = c.req.query("limit");
      let q: any = admin.from("expenses").select("*").eq("business_id", businessId).order("created_at", { ascending: false });
      if (from) q = q.gte("created_at", from);
      if (to)   q = q.lte("created_at", to);
      if (lim)  q = q.limit(Number(lim));
      const { data, error } = await q;
      if (error) return c.json({ error: error.message }, 500);
      return c.json({ success: true, expenses: data ?? [] });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // ── DELETE /admin/sales/:saleId ──────────────────────────────────────────────
  app.delete("/make-server-3508045b/admin/sales/:saleId", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      const saleId = c.req.param("saleId");
      const { error } = await admin.from("sales").delete().eq("id", saleId).eq("business_id", businessId);
      if (error) return c.json({ error: error.message }, 500);
      return c.json({ success: true });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // ── PATCH /admin/sales/:saleId ───────────────────────────────────────────────
  // Persiste ediciones desde Movimientos (fecha, cliente, ítems, totales, pago, etc.)
  app.patch("/make-server-3508045b/admin/sales/:saleId", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      const saleId = c.req.param("saleId");
      const body = await c.req.json();
      const upd: Record<string, any> = {};
      if (body.notes !== undefined) upd.notes = body.notes;
      if (body.paymentStatus !== undefined) upd.payment_status = body.paymentStatus;
      if (body.paidAmount !== undefined) upd.paid_amount = Number(body.paidAmount);
      if (body.changeAmount !== undefined) upd.change_amount = Number(body.changeAmount);
      if (body.customerId !== undefined) upd.customer_id = body.customerId;
      if (body.total !== undefined) upd.total = Number(body.total);
      if (body.subtotal !== undefined) upd.subtotal = Number(body.subtotal);
      if (body.discount !== undefined) upd.discount = Number(body.discount);
      if (body.tax !== undefined) upd.tax = Number(body.tax);
      if (body.paymentMethod !== undefined) upd.payment_method = body.paymentMethod;
      if (body.createdAt !== undefined) upd.created_at = body.createdAt;
      if (body.createdBy !== undefined) upd.created_by = body.createdBy;
      if (body.payments !== undefined) upd.payments = body.payments;
      if (body.items !== undefined) {
        if (!Array.isArray(body.items) || body.items.length === 0) {
          return c.json({ error: "items must be a non-empty array" }, 400);
        }
        upd.items = body.items;
      }
      if (Object.keys(upd).length === 0) {
        return c.json({ error: "No fields to update" }, 400);
      }
      const { data, error } = await admin.from("sales").update(upd).eq("id", saleId).eq("business_id", businessId).select().single();
      if (error) return c.json({ error: error.message }, 500);
      return c.json({ success: true, sale: data });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // ── POST /admin/expenses ─────────────────────────────────────────────────────
  app.post("/make-server-3508045b/admin/expenses", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      const b = await c.req.json();
      const rawStatus = String(b.paymentStatus ?? "paid").toLowerCase();
      const paymentStatus =
        rawStatus === "pending" || rawStatus === "debt" || rawStatus === "deuda"
          ? "pending"
          : rawStatus === "partial"
            ? "partial"
            : "paid";
      const { data, error } = await admin.from("expenses").insert({
        business_id:     businessId,
        category:        b.category       || "Otros",
        description:     b.description    ?? null,
        amount:          Number(b.amount),
        payment_method:  b.paymentMethod  || "Efectivo",
        payment_status:  paymentStatus,
        receipt_image:   b.receiptImage   ?? null,
        notes:           b.notes          ?? null,
        created_by:      b.createdBy      ?? null,
        created_at:      b.createdAt      || new Date().toISOString(),
      }).select().single();
      if (error) return c.json({ error: error.message }, 500);
      return c.json({ success: true, expense: data });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // EMPLOYEE ROUTES — All use SERVICE_ROLE_KEY to bypass RLS
  // ════════════════════════════════════════════════════════════════════════════

  // ── GET /admin/employees — List active employees for a business ──────────────
  app.get("/make-server-3508045b/admin/employees", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      console.log("👥 [ADMIN/EMPLOYEES] GET for business:", businessId);
      const { data, error } = await admin
        .from("employees")
        .select(
          "id,business_id,user_id,name,email,phone,role,permissions,is_active,is_owner,created_at,updated_at",
        )
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) { console.error("❌ [ADMIN/EMPLOYEES/GET]", error.message); return c.json({ error: error.message }, 500); }
      console.log(`✅ [ADMIN/EMPLOYEES/GET] ${data?.length ?? 0} records`);
      return c.json({ success: true, employees: data ?? [] });
    } catch (e: any) { console.error("❌ [ADMIN/EMPLOYEES/GET] catch:", e.message); return c.json({ error: e.message }, 500); }
  });

  // ── POST /admin/employees — Create employee (bypasses RLS INSERT policy) ─────
  app.post("/make-server-3508045b/admin/employees", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      const b = await c.req.json();
      console.log("👥 [ADMIN/EMPLOYEES] POST for business:", businessId, "email:", b.email);

      // Safely handle user_id
      let safeUserId: string | null = null;
      if (b.user_id && typeof b.user_id === "string" && b.user_id.length > 0 && b.user_id !== "undefined") {
        safeUserId = b.user_id;
      }

      const { data, error } = await admin.from("employees").insert({
        business_id: businessId,
        user_id:     safeUserId,
        name:        b.name,
        email:       b.email,
        phone:       b.phone ?? null,
        role:        b.role || "cashier",
        permissions: b.permissions ?? {},
        is_active:   b.is_active !== undefined ? b.is_active : true,
        is_owner:    b.is_owner  ?? false,
      }).select().single();

      if (error) { console.error("❌ [ADMIN/EMPLOYEES/POST]", error.message); return c.json({ error: error.message }, 500); }
      console.log("✅ [ADMIN/EMPLOYEES/POST] created:", data.id, data.email);
      return c.json({ success: true, employee: data });
    } catch (e: any) { console.error("❌ [ADMIN/EMPLOYEES/POST] catch:", e.message); return c.json({ error: e.message }, 500); }
  });

  // ── PATCH /admin/employees/:employeeId — Update employee ─────────────────────
  app.patch("/make-server-3508045b/admin/employees/:employeeId", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      const employeeId = c.req.param("employeeId");
      const b = await c.req.json();
      console.log("👥 [ADMIN/EMPLOYEES] PATCH:", employeeId);

      const upd: Record<string, any> = { updated_at: new Date().toISOString() };
      if (b.name        !== undefined) upd.name        = b.name;
      if (b.email       !== undefined) upd.email       = b.email;
      if (b.phone       !== undefined) upd.phone       = b.phone;
      if (b.role        !== undefined) upd.role        = b.role;
      if (b.permissions !== undefined) upd.permissions = b.permissions;
      if (b.is_active   !== undefined) upd.is_active   = b.is_active;

      const { data, error } = await admin
        .from("employees")
        .update(upd)
        .eq("id", employeeId)
        .eq("business_id", businessId)
        .select()
        .single();

      if (error) { console.error("❌ [ADMIN/EMPLOYEES/PATCH]", error.message); return c.json({ error: error.message }, 500); }
      console.log("✅ [ADMIN/EMPLOYEES/PATCH] updated:", data.id);
      return c.json({ success: true, employee: data });
    } catch (e: any) { console.error("❌ [ADMIN/EMPLOYEES/PATCH] catch:", e.message); return c.json({ error: e.message }, 500); }
  });

  // ── DELETE /admin/employees/:employeeId — Soft-delete employee ───────────────
  app.delete("/make-server-3508045b/admin/employees/:employeeId", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      const employeeId = c.req.param("employeeId");
      console.log("👥 [ADMIN/EMPLOYEES] DELETE:", employeeId);

      // Check is_owner first
      const { data: emp } = await admin.from("employees").select("is_owner").eq("id", employeeId).eq("business_id", businessId).single();
      if (emp?.is_owner) return c.json({ error: "No puedes eliminar al propietario del negocio" }, 400);

      const { error } = await admin
        .from("employees")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", employeeId)
        .eq("business_id", businessId);

      if (error) { console.error("❌ [ADMIN/EMPLOYEES/DELETE]", error.message); return c.json({ error: error.message }, 500); }
      console.log("✅ [ADMIN/EMPLOYEES/DELETE] soft-deleted:", employeeId);
      return c.json({ success: true });
    } catch (e: any) { console.error("❌ [ADMIN/EMPLOYEES/DELETE] catch:", e.message); return c.json({ error: e.message }, 500); }
  });

  // ── GET /admin/employees/by-email — Find employee by email ───────────────────
  app.get("/make-server-3508045b/admin/employees/by-email", async (c: any) => {
    try {
      const businessId = c.req.header("X-Business-ID");
      if (!businessId) return c.json({ error: "Missing X-Business-ID header" }, 400);
      const email = c.req.query("email");
      if (!email) return c.json({ error: "Missing email query param" }, 400);
      console.log("👥 [ADMIN/EMPLOYEES/BY-EMAIL] looking for:", email, "in business:", businessId);
      const { data, error } = await admin
        .from("employees")
        .select("*")
        .eq("business_id", businessId)
        .ilike("email", email)
        .eq("is_active", true)
        .maybeSingle();
      if (error) { console.error("❌ [ADMIN/EMPLOYEES/BY-EMAIL]", error.message); return c.json({ error: error.message }, 500); }
      return c.json({ success: true, employee: data ?? null });
    } catch (e: any) { console.error("❌ [ADMIN/EMPLOYEES/BY-EMAIL] catch:", e.message); return c.json({ error: e.message }, 500); }
  });

  console.log("✅ [ADMIN] All admin routes registered (including employees).");
}