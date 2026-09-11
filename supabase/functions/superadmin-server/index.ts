/**
 * Código de referencia para el panel Super Admin (sin Hono).
 * En Supabase el nombre de la función define la URL (ej. swift-task → …/functions/v1/swift-task/…).
 * Mantén el mismo slug en utils/supabase/superadminEdgeSlug.ts del frontend.
 *
 * Rutas: GET …/superadmin/stats|users|business|comunicados?key=… ; POST …/superadmin/mutate?key=… (JSON { action, … }).
 * Acciones user: set_user_block, delete_user, set_user_password (newPassword + confirmEmail si el usuario tiene email en Auth).
 * CLI ejemplo: supabase functions deploy swift-task
 * Secretos: SUPERADMIN_KEY (obligatorio), SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (auto).
 * En Dashboard: desactiva "Verify JWT" para esta función, o usa verify_jwt = false en config.toml.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPERADMIN_KEY = (Deno.env.get("SUPERADMIN_KEY") ?? "").trim();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

const MAX_BLOCK_HISTORY = 100;

type BlockHistoryEntry =
  | { kind: "blocked"; at: string; message: string }
  | { kind: "unblocked"; at: string; note: string };

function normalizeBlockHistory(raw: unknown): BlockHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: BlockHistoryEntry[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const at = typeof o.at === "string" ? o.at : "";
    if (!at) continue;
    if (o.kind === "blocked" && typeof o.message === "string") {
      out.push({ kind: "blocked", at, message: o.message });
    } else if (o.kind === "unblocked" && typeof o.note === "string") {
      out.push({ kind: "unblocked", at, note: o.note });
    }
  }
  return out.slice(-MAX_BLOCK_HISTORY);
}

function readAccessFromMetadata(md: Record<string, unknown>): {
  blocked: boolean;
  block_message: string;
  block_history: BlockHistoryEntry[];
} {
  const blocked = md.superadmin_blocked === true;
  const block_message = typeof md.superadmin_block_message === "string" ? md.superadmin_block_message : "";
  return {
    blocked,
    block_message,
    block_history: normalizeBlockHistory(md.superadmin_block_history),
  };
}

/** Sube data URL a Storage; si falla el bucket, devuelve null para intentar guardar inline. */
async function tryUploadComunicadoDataUrl(dataUrl: string): Promise<string | null> {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const contentType = m[1].trim();
  const b64 = m[2].replace(/\s/g, "");
  let bytes: Uint8Array;
  try {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return null;
  }
  if (bytes.length > 4_000_000) return null;
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `c/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage.from("comunicado-images").upload(path, bytes, {
    contentType: contentType || "image/jpeg",
    upsert: false,
  });
  if (upErr) return null;
  const { data: pub } = admin.storage.from("comunicado-images").getPublicUrl(path);
  return pub.publicUrl;
}

/**
 * Localiza el segmento tras "superadmin" aunque el pathname venga como
 * /functions/v1/swift-task/superadmin/mutate, /superadmin/mutate o sin barra inicial.
 */
function matchRoute(
  pathname: string,
): "stats" | "users" | "business" | "comunicados" | "analytics" | "mutate" | null {
  const pathOnly = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  const parts = pathOnly.split("/").filter(Boolean);
  const i = parts.indexOf("superadmin");
  if (i < 0 || i >= parts.length - 1) return null;
  const sub = parts[i + 1];
  if (sub === "stats") return "stats";
  if (sub === "users") return "users";
  if (sub === "business") return "business";
  if (sub === "comunicados") return "comunicados";
  if (sub === "analytics") return "analytics";
  if (sub === "mutate") return "mutate";
  return null;
}

function validateKey(url: URL): Response | null {
  if (!SUPERADMIN_KEY) return json({ error: "SUPERADMIN_KEY no configurado" }, 500);
  const key = (url.searchParams.get("key") ?? "").trim();
  if (key !== SUPERADMIN_KEY) return json({ error: "No autorizado" }, 401);
  return null;
}

async function handleStats(): Promise<Response> {
  const [usersR, bizR, prodR, empR, saleR, expR, custR] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }),
    admin.from("businesses").select("id", { count: "exact", head: true }),
    admin.from("products").select("id", { count: "exact", head: true }),
    admin.from("employees").select("id", { count: "exact", head: true }),
    admin.from("sales").select("id", { count: "exact", head: true }),
    admin.from("expenses").select("id", { count: "exact", head: true }),
    admin.from("customers").select("id", { count: "exact", head: true }),
  ]);

  return json({
    users: { total: usersR.count ?? 0, active: 0 },
    businesses: bizR.count ?? 0,
    products: prodR.count ?? 0,
    employees: empR.count ?? 0,
    sales: saleR.count ?? 0,
    expenses: expR.count ?? 0,
    customers: custR.count ?? 0,
  });
}

/** PostgREST limita a 1000 filas: hay que paginar o los conteos quedan cortos. */
async function tallyByBusinessId(table: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const page = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select("business_id")
      .range(from, from + page - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const r of rows) {
      const id = (r as { business_id?: string }).business_id;
      if (!id) continue;
      map.set(id, (map.get(id) || 0) + 1);
    }
    if (rows.length < page) break;
    from += page;
  }
  return map;
}

function countIn(map: Map<string, number>, bizId: string): number {
  return map.get(bizId) || 0;
}

async function handleUsers(): Promise<Response> {
  let allAuthUsers: any[] = [];
  let pg = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pg, perPage: 1000 });
    if (error || !data?.users?.length) break;
    allAuthUsers = allAuthUsers.concat(data.users);
    if (data.users.length < 1000) break;
    pg++;
  }

  const { data: publicUsers } = await admin.from("users").select("id, email, metadata");
  const publicMap = new Map<string, any>((publicUsers ?? []).map((r: any) => [r.id, r]));

  const { data: businesses } = await admin
    .from("businesses")
    .select("id, name, owner_id, created_at");

  const [productMap, employeeMap, saleMap, expenseMap, customerMap] = await Promise.all([
    tallyByBusinessId("products"),
    tallyByBusinessId("employees"),
    tallyByBusinessId("sales"),
    tallyByBusinessId("expenses"),
    tallyByBusinessId("customers"),
  ]);

  const enriched = (businesses ?? []).map((b: any) => {
    const sales = countIn(saleMap, b.id);
    const expenses = countIn(expenseMap, b.id);
    return {
      ...b,
      products: countIn(productMap, b.id),
      employees: countIn(employeeMap, b.id),
      sales,
      expenses,
      customers: countIn(customerMap, b.id),
      movements: sales + expenses,
    };
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const usersData = allAuthUsers.map((u: any) => {
    const userBizs = enriched.filter((b: any) => b.owner_id === u.id);
    const totals = userBizs.reduce(
      (acc: any, b: any) => ({
        businesses: acc.businesses + 1,
        products: acc.products + b.products,
        employees: acc.employees + b.employees,
        sales: acc.sales + b.sales,
        expenses: acc.expenses + b.expenses,
        movements: acc.movements + b.movements,
        customers: acc.customers + b.customers,
      }),
      { businesses: 0, products: 0, employees: 0, sales: 0, expenses: 0, movements: 0, customers: 0 },
    );
    const pu = publicMap.get(u.id);
    const md = (pu?.metadata ?? {}) as Record<string, unknown>;
    const access = readAccessFromMetadata(md);
    const lastActivityAt =
      typeof (md as any).last_activity_at === "string" ? String((md as any).last_activity_at) : "";
    const lastRelevantAt =
      (u.last_sign_in_at && String(u.last_sign_in_at) > lastActivityAt)
        ? String(u.last_sign_in_at)
        : (lastActivityAt || (u.last_sign_in_at ? String(u.last_sign_in_at) : ""));
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.user_metadata?.full_name || "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      is_active: !!(lastRelevantAt && lastRelevantAt > thirtyDaysAgo),
      blocked: access.blocked,
      block_message: access.block_message,
      block_history: access.block_history,
      ...totals,
    };
  });

  const sumMap = (m: Map<string, number>) => [...m.values()].reduce((a, n) => a + n, 0);
  const activeUsers = usersData.filter((u: any) => u.is_active).length;

  return json({
    users: usersData,
    businesses: enriched,
    stats: {
      users: { total: usersData.length, active: activeUsers },
      businesses: (businesses ?? []).length,
      products: sumMap(productMap),
      employees: sumMap(employeeMap),
      sales: sumMap(saleMap),
      expenses: sumMap(expenseMap),
      customers: sumMap(customerMap),
    },
  });
}

function isMissingComunicadosTable(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  if (m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find the table")) {
    return true;
  }
  const c = String(err.code ?? "");
  return c === "42P01" || c === "PGRST116" || c === "PGRST205";
}

async function emailMapForUserIds(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(userIds.filter((id) => isUuid(id)))];
  if (unique.length === 0) return map;

  const { data: pubUsers } = await admin.from("users").select("id, email").in("id", unique);
  for (const r of pubUsers ?? []) {
    const em = typeof (r as { email?: string }).email === "string" ? (r as { email: string }).email : "";
    if (em) map.set((r as { id: string }).id, em);
  }

  const missing = unique.filter((id) => !map.has(id));
  await Promise.all(
    missing.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (!error && data?.user?.email) map.set(id, data.user.email);
    }),
  );

  return map;
}

async function handleComunicados(): Promise<Response> {
  try {
    const { data: rows, error } = await admin.from("admin_comunicados").select(
      "id, title, body, image_url, target_user_ids, created_at",
    ).order("created_at", { ascending: false });

    if (error) {
      console.error("[handleComunicados] select error:", error.code, error.message);
      if (isMissingComunicadosTable(error)) {
        return json({
          comunicados: [],
          _warning:
            "Las tablas admin_comunicados no existen o el esquema no está actualizado. En Supabase → SQL Editor ejecuta el archivo supabase/migrations/20250326120000_admin_comunicados.sql y luego Dashboard → Settings → API → Reload schema (o espera 1–2 min).",
        });
      }
      if (/permission denied|42501/i.test(error.message)) {
        return json({
          comunicados: [],
          _warning:
            "Sin permiso sobre admin_comunicados. Ejecuta en SQL Editor el archivo supabase/migrations/20250326210000_admin_comunicados_grants_fix.sql (GRANT a service_role y authenticated).",
        });
      }
      return json({ error: error.message, code: error.code }, 500);
    }

    const list = rows ?? [];
    const comunicadoIds = list.map((r: Record<string, unknown>) => r.id as string).filter(Boolean);

    let dismissalsByComunicado = new Map<
      string,
      { user_id: string; dismissed_at: string }[]
    >();
    let emailByUserId = new Map<string, string>();

    let dismissalsBulkFailed = false;
    if (comunicadoIds.length > 0) {
      const { data: allDismissals, error: dErr } = await admin
        .from("admin_comunicado_dismissals")
        .select("comunicado_id, user_id, dismissed_at")
        .in("comunicado_id", comunicadoIds);

      if (dErr) {
        console.error("[handleComunicados] dismissals error:", dErr.code, dErr.message);
        dismissalsBulkFailed = true;
      } else {
        const flat = (allDismissals ?? []) as { comunicado_id: string; user_id: string; dismissed_at: string }[];
        for (const d of flat) {
          const cid = d.comunicado_id;
          if (!dismissalsByComunicado.has(cid)) dismissalsByComunicado.set(cid, []);
          dismissalsByComunicado.get(cid)!.push({
            user_id: d.user_id,
            dismissed_at: d.dismissed_at,
          });
        }
        const allUserIds = flat.map((x) => x.user_id);
        emailByUserId = await emailMapForUserIds(allUserIds);
      }
    }

    const withStats = await Promise.all(
      list.map(async (r: Record<string, unknown>) => {
        const ids = r.target_user_ids as string[] | null;
        const recipientCount = Array.isArray(ids) ? ids.length : 0;
        const cid = r.id as string;
        const rawSeen = dismissalsByComunicado.get(cid) ?? [];

        if (dismissalsBulkFailed) {
          const { count, error: cErr } = await admin.from("admin_comunicado_dismissals").select("*", {
            count: "exact",
            head: true,
          }).eq("comunicado_id", cid);
          return {
            ...r,
            recipient_count: recipientCount,
            seen_count: cErr ? 0 : count ?? 0,
            seen_by: [] as { user_id: string; email: string; dismissed_at: string }[],
            ...(cErr ? { count_error: cErr.message } : {}),
          };
        }

        const seenSorted = [...rawSeen].sort((a, b) => (a.dismissed_at < b.dismissed_at ? 1 : -1));
        const seen_by = seenSorted.map((s) => ({
          user_id: s.user_id,
          email: emailByUserId.get(s.user_id) ?? "",
          dismissed_at: s.dismissed_at,
        }));
        return {
          ...r,
          recipient_count: recipientCount,
          seen_count: seen_by.length,
          seen_by,
        };
      }),
    );

    return json({ comunicados: withStats });
  } catch (e: any) {
    console.error("[handleComunicados] exception:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
}

async function handleBusinessDetail(url: URL): Promise<Response> {
  const businessId = (url.searchParams.get("businessId") ?? url.searchParams.get("id") ?? "").trim();
  if (!businessId) return json({ error: "Falta businessId o id en la query" }, 400);

  const { data: business, error: bErr } = await admin.from("businesses").select("*").eq("id", businessId).maybeSingle();
  if (bErr) return json({ error: bErr.message }, 500);
  if (!business) return json({ error: "Negocio no encontrado" }, 404);

  const [productQ, employeeQ, customerQ, saleQ, expenseQ] = await Promise.all([
    admin
      .from("products")
      .select("id, business_id, name, price, cost, stock, category, barcode, is_active, created_at, updated_at")
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
    admin
      .from("employees")
      .select("id, business_id, name, email, phone, role, is_active, is_owner, created_at, updated_at")
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
    admin
      .from("customers")
      .select("id, business_id, name, email, phone, address, tax_id, cedula, contact_type, credit_limit, created_at")
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
    admin
      .from("sales")
      .select("id, business_id, sale_number, total, subtotal, discount, tax, payment_method, payment_status, paid_amount, change_amount, customer_id, notes, created_at, created_by")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("expenses")
      .select("id, business_id, category, description, amount, payment_method, payment_status, notes, created_at, created_by")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const warnings = [productQ.error, employeeQ.error, customerQ.error, saleQ.error, expenseQ.error]
    .map((e) => e?.message)
    .filter(Boolean) as string[];

  return json({
    business,
    products: productQ.data ?? [],
    employees: employeeQ.data ?? [],
    customers: customerQ.data ?? [],
    sales: saleQ.data ?? [],
    expenses: expenseQ.data ?? [],
    warnings,
  });
}

function pickPatch(
  patch: Record<string, unknown> | null | undefined,
  allowed: string[],
): Record<string, unknown> {
  if (!patch || typeof patch !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) out[k] = patch[k];
  }
  return out;
}

async function handleMutate(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const action = String(body.action ?? "").trim();
  if (!action) return json({ error: "Falta action" }, 400);

  const businessId = String(body.businessId ?? body.business_id ?? "").trim();
  const id = String(body.id ?? "").trim();
  const userId = String(body.userId ?? body.user_id ?? "").trim();
  const patchRaw = body.patch as Record<string, unknown> | undefined;

  const requireBiz = () => {
    if (!isUuid(businessId)) return json({ error: "businessId UUID inválido" }, 400) as Response;
    return null;
  };
  const requireId = () => {
    if (!isUuid(id)) return json({ error: "id UUID inválido" }, 400) as Response;
    return null;
  };

  try {
    switch (action) {
      case "delete_sale": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const { error } = await admin.from("sales").delete().eq("id", id).eq("business_id", businessId);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      case "patch_sale": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const p = pickPatch(patchRaw, ["notes", "payment_status", "paid_amount"]);
        if (patchRaw && typeof patchRaw === "object") {
          if ("paymentStatus" in patchRaw) p.payment_status = patchRaw.paymentStatus;
          if ("paidAmount" in patchRaw) p.paid_amount = patchRaw.paidAmount;
        }
        if (p.paid_amount !== undefined) p.paid_amount = Number(p.paid_amount);
        if (Object.keys(p).length === 0) return json({ error: "patch vacío" }, 400);
        const { data, error } = await admin.from("sales").update(p).eq("id", id).eq(
          "business_id",
          businessId,
        ).select().single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, row: data });
      }
      case "delete_expense": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const { error } = await admin.from("expenses").delete().eq("id", id).eq("business_id", businessId);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      case "patch_expense": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const p = pickPatch(patchRaw, [
          "category",
          "description",
          "amount",
          "payment_method",
          "notes",
          "reference",
        ]);
        if (p.amount !== undefined) p.amount = Number(p.amount);
        if (Object.keys(p).length === 0) return json({ error: "patch vacío" }, 400);
        const { data, error } = await admin.from("expenses").update(p).eq("id", id).eq(
          "business_id",
          businessId,
        ).select().single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, row: data });
      }
      case "delete_employee": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const { error } = await admin.from("employees").delete().eq("id", id).eq("business_id", businessId);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      case "patch_employee": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const p = pickPatch(patchRaw, ["name", "email", "phone", "role", "is_active", "permissions"]);
        if (Object.keys(p).length === 0) return json({ error: "patch vacío" }, 400);
        const { data, error } = await admin.from("employees").update(p).eq("id", id).eq(
          "business_id",
          businessId,
        ).select().single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, row: data });
      }
      case "delete_customer": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const { error } = await admin.from("customers").delete().eq("id", id).eq("business_id", businessId);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      case "patch_customer": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const p = pickPatch(patchRaw, [
          "name",
          "email",
          "phone",
          "address",
          "notes",
          "active",
          "credit_limit",
          "current_debt",
          "tax_id",
        ]);
        if (p.credit_limit !== undefined) p.credit_limit = Number(p.credit_limit);
        if (p.current_debt !== undefined) p.current_debt = Number(p.current_debt);
        if (Object.keys(p).length === 0) return json({ error: "patch vacío" }, 400);
        const { data, error } = await admin.from("customers").update(p).eq("id", id).eq(
          "business_id",
          businessId,
        ).select().single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, row: data });
      }
      case "delete_product": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const { error } = await admin.from("products").delete().eq("id", id).eq("business_id", businessId);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      case "patch_product": {
        const e = requireBiz() ?? requireId();
        if (e) return e;
        const p = pickPatch(patchRaw, [
          "name",
          "description",
          "sku",
          "barcode",
          "price",
          "cost",
          "stock",
          "min_stock",
          "category",
          "active",
        ]);
        if (p.price !== undefined) p.price = Number(p.price);
        if (p.cost !== undefined) p.cost = Number(p.cost);
        if (p.stock !== undefined) p.stock = Number(p.stock);
        if (p.min_stock !== undefined) p.min_stock = Number(p.min_stock);
        if (Object.keys(p).length === 0) return json({ error: "patch vacío" }, 400);
        const { data, error } = await admin.from("products").update(p).eq("id", id).eq(
          "business_id",
          businessId,
        ).select().single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, row: data });
      }
      case "delete_business": {
        const bid = (businessId || id).trim();
        if (!isUuid(bid)) return json({ error: "businessId UUID inválido" }, 400);
        const { error } = await admin.from("businesses").delete().eq("id", bid);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      case "patch_business": {
        const bid = (businessId || id).trim();
        if (!isUuid(bid)) return json({ error: "businessId UUID inválido" }, 400);
        const p = pickPatch(patchRaw, ["name", "email", "phone", "address", "active", "tax_id", "country", "currency"]);
        if (Object.keys(p).length === 0) return json({ error: "patch vacío" }, 400);
        const { data, error } = await admin.from("businesses").update(p).eq("id", bid).select().single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, row: data });
      }
      case "set_user_block": {
        if (!isUuid(userId)) return json({ error: "userId UUID inválido" }, 400);
        const blocked = Boolean(body.blocked);
        const rawMsg = body.message ?? body.block_message;
        const msg = typeof rawMsg === "string" ? rawMsg.trim().slice(0, 4000) : "";
        const rawNote = body.unblock_note ?? body.note;
        const unblockNote = typeof rawNote === "string" ? rawNote.trim().slice(0, 4000) : "";

        const { data: got, error: gErr } = await admin.from("users").select("id, email, metadata").eq("id", userId).maybeSingle();
        if (gErr) return json({ error: gErr.message }, 500);

        let email = got?.email as string | undefined;
        if (!email) {
          const { data: au, error: auErr } = await admin.auth.admin.getUserById(userId);
          if (auErr || !au?.user?.email) return json({ error: auErr?.message || "Usuario no encontrado" }, 404);
          email = au.user.email;
        }

        const prevMd = (got?.metadata ?? {}) as Record<string, unknown>;
        const nextMd: Record<string, unknown> = { ...prevMd };
        const now = new Date().toISOString();
        const history = normalizeBlockHistory(nextMd.superadmin_block_history);

        if (blocked) {
          if (!msg) {
            return json({ error: "Escribe el mensaje que verá el usuario en el modal de bloqueo" }, 400);
          }
          history.push({ kind: "blocked", at: now, message: msg });
          nextMd.superadmin_blocked = true;
          nextMd.superadmin_block_message = msg;
          nextMd.superadmin_block_history = history.slice(-MAX_BLOCK_HISTORY);
        } else {
          if (!unblockNote) {
            return json({ error: "Escribe una nota de desbloqueo (quedará en el historial del usuario)" }, 400);
          }
          history.push({ kind: "unblocked", at: now, note: unblockNote });
          nextMd.superadmin_blocked = false;
          delete nextMd.superadmin_block_message;
          nextMd.superadmin_block_history = history.slice(-MAX_BLOCK_HISTORY);
        }

        const { error: upErr } = await admin.from("users").upsert({
          id: userId,
          email,
          metadata: nextMd,
        }, { onConflict: "id" });
        if (upErr) return json({ error: upErr.message }, 500);
        return json({ success: true });
      }
      case "delete_user": {
        if (!isUuid(userId)) return json({ error: "userId UUID inválido" }, 400);
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      case "set_user_password": {
        if (!isUuid(userId)) return json({ error: "userId UUID inválido" }, 400);
        const newPassword = String(body.newPassword ?? body.password ?? "");
        if (newPassword.length < 6) {
          return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
        }
        if (newPassword.length > 72) {
          return json({ error: "Contraseña demasiado larga (máximo 72 caracteres para el hash)" }, 400);
        }

        const { data: au, error: auErr } = await admin.auth.admin.getUserById(userId);
        if (auErr || !au?.user) {
          return json({ error: auErr?.message || "Usuario no encontrado" }, 404);
        }
        const authEmail = (au.user.email ?? "").trim().toLowerCase();
        const confirmEmail = String(body.confirmEmail ?? "").trim().toLowerCase();
        if (authEmail && confirmEmail !== authEmail) {
          return json({
            error: "El email de confirmación no coincide con el usuario seleccionado",
          }, 400);
        }

        const { error: upErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
        if (upErr) return json({ error: upErr.message }, 500);
        return json({ success: true });
      }
      case "upload_comunicado_image": {
        const raw = body.imageBase64;
        if (typeof raw !== "string" || raw.length < 32) {
          return json({ error: "imageBase64 inválido (usa data URL base64)" }, 400);
        }
        const url = await tryUploadComunicadoDataUrl(raw);
        if (!url) return json({ error: "No se pudo subir la imagen (revisa bucket comunicado-images o el formato)" }, 500);
        return json({ success: true, url });
      }
      case "create_comunicado": {
        const title = String(body.title ?? "").trim().slice(0, 500);
        const comunicadoBody = String(body.comunicadoText ?? body.text ?? "").trim().slice(0, 20000);
        const imageUrlRaw = body.image_url;
        let image_url: string | null = typeof imageUrlRaw === "string" && imageUrlRaw.trim().length > 0
          ? imageUrlRaw.trim().slice(0, 4000)
          : null;
        const imageBase64Payload = body.imageBase64;
        if (!image_url && typeof imageBase64Payload === "string" && imageBase64Payload.startsWith("data:")) {
          const uploaded = await tryUploadComunicadoDataUrl(imageBase64Payload);
          if (uploaded) {
            image_url = uploaded;
          } else if (imageBase64Payload.length <= 750_000) {
            image_url = imageBase64Payload.slice(0, 750_000);
          } else {
            return json({
              error:
                "Imagen demasiado grande o Storage no disponible. Crea el bucket «comunicado-images» o reduce la imagen.",
            }, 400);
          }
        }
        const idsRaw = body.targetUserIds;
        if (!title) return json({ error: "El titular es obligatorio" }, 400);
        if (!comunicadoBody) return json({ error: "El texto del comunicado es obligatorio" }, 400);
        if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
          return json({ error: "Selecciona al menos un destinatario" }, 400);
        }
        const clean: string[] = [];
        for (const x of idsRaw) {
          const s = String(x ?? "").trim();
          if (isUuid(s) && !clean.includes(s)) clean.push(s);
        }
        if (clean.length === 0) return json({ error: "Ningún userId válido" }, 400);
        const { data: ins, error: insErr } = await admin.from("admin_comunicados").insert({
          title,
          body: comunicadoBody,
          image_url,
          target_user_ids: clean,
        }).select("id").single();
        if (insErr) {
          console.error("[create_comunicado] insert error:", insErr.code, insErr.message);
          if (isMissingComunicadosTable(insErr)) {
            return json({
              error: "No existe la tabla admin_comunicados o el esquema API no está actualizado.",
              hint:
                "Ejecuta la migración 20250326120000_admin_comunicados.sql en SQL Editor y recarga el esquema en Dashboard → Settings → API.",
            }, 503);
          }
          if (/permission denied|42501/i.test(insErr.message)) {
            return json({
              error: insErr.message,
              hint:
                "Ejecuta supabase/migrations/20250326210000_admin_comunicados_grants_fix.sql (GRANT a service_role).",
            }, 503);
          }
          return json({ error: insErr.message, code: insErr.code }, 500);
        }
        return json({ success: true, id: ins?.id });
      }
      default:
        return json({ error: `Acción desconocida: ${action}` }, 400);
    }
  } catch (err: any) {
    return json({ error: err?.message ?? String(err) }, 500);
  }
}

function ymdOk(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function dayStartEc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000-05:00`);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

function pctChange(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function parseScopedBusinessIds(url: URL): string[] {
  const raw = `${url.searchParams.get("businessIds") ?? ""},${url.searchParams.get("businessId") ?? ""}`;
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (isUuid(s)) seen.add(s);
  }
  return [...seen];
}

function applyBusinessFilter<Q extends { eq: Function; in: Function }>(q: Q, businessIds?: string[]): Q {
  if (!businessIds?.length) return q;
  if (businessIds.length === 1) return q.eq("business_id", businessIds[0]);
  return q.in("business_id", businessIds);
}

function uniqueBizIds(rows: { business_id?: string | null }[]): number {
  return new Set(rows.map((r) => r.business_id).filter(Boolean)).size;
}

async function fetchCreatedInRange<T extends Record<string, unknown>>(
  table: string,
  columns: string,
  fromIso: string,
  toExclusiveIso: string,
  businessIds?: string[],
): Promise<T[]> {
  const page = 1000;
  const maxPages = 40;
  const all: T[] = [];
  let from = 0;
  for (let p = 0; p < maxPages; p++) {
    let q = admin
      .from(table)
      .select(columns)
      .gte("created_at", fromIso)
      .lt("created_at", toExclusiveIso)
      .order("created_at", { ascending: true })
      .range(from, from + page - 1);
    q = applyBusinessFilter(q as any, businessIds);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < page) break;
    from += page;
  }
  return all;
}

function bucketKey(iso: string, grain: "day" | "week"): string {
  const d = new Date(iso);
  if (grain === "day") return d.toISOString().slice(0, 10);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return utc.toISOString().slice(0, 10);
}

function inRange(iso: string, fromMs: number, toMs: number): boolean {
  const t = new Date(iso).getTime();
  return t >= fromMs && t < toMs;
}

async function handleAnalytics(url: URL): Promise<Response> {
  const today = new Date();
  const defaultTo = today.toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
  const defaultFromDate = addDays(dayStartEc(defaultTo), -29);
  const defaultFrom = defaultFromDate.toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });

  const fromYmd = ymdOk(url.searchParams.get("from") ?? "") ? String(url.searchParams.get("from")) : defaultFrom;
  const toYmd = ymdOk(url.searchParams.get("to") ?? "") ? String(url.searchParams.get("to")) : defaultTo;
  let fromStart = dayStartEc(fromYmd);
  let toEnd = addDays(dayStartEc(toYmd), 1);
  if (!(fromStart < toEnd)) {
    fromStart = dayStartEc(defaultFrom);
    toEnd = addDays(dayStartEc(defaultTo), 1);
  }

  const durationMs = toEnd.getTime() - fromStart.getTime();
  const prevStart = new Date(fromStart.getTime() - durationMs);
  const prevEnd = fromStart;
  const scanStartIso = prevStart.toISOString();
  const scanEndIso = toEnd.toISOString();
  const days = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));
  const grain: "day" | "week" = days > 90 ? "week" : "day";
  const scopedIds = parseScopedBusinessIds(url);
  const isScoped = scopedIds.length > 0;

  type SaleRow = { created_at: string; total: number | null; business_id: string | null; payment_method: string | null };
  type ExpRow = { created_at: string; amount: number | null; business_id: string | null };
  type IdRow = { created_at: string; business_id?: string | null };

  const [sales, expenses, customers, employees, products, catalogSettings, businesses] = await Promise.all([
    fetchCreatedInRange<SaleRow>("sales", "created_at, total, business_id, payment_method", scanStartIso, scanEndIso, scopedIds.length ? scopedIds : undefined),
    fetchCreatedInRange<ExpRow>("expenses", "created_at, amount, business_id", scanStartIso, scanEndIso, scopedIds.length ? scopedIds : undefined),
    fetchCreatedInRange<IdRow>("customers", "created_at, business_id", scanStartIso, scanEndIso, scopedIds.length ? scopedIds : undefined),
    fetchCreatedInRange<IdRow>("employees", "created_at, business_id", scanStartIso, scanEndIso, scopedIds.length ? scopedIds : undefined),
    fetchCreatedInRange<IdRow>("products", "created_at, business_id", scanStartIso, scanEndIso, scopedIds.length ? scopedIds : undefined),
    admin.from("business_settings").select("business_id, created_at, updated_at, value").eq("key", "virtual_catalog").then((r) =>
      r.error ? { data: [] as unknown[] } : r
    ),
    admin.from("businesses").select("id, name, owner_id, created_at"),
  ]);

  let allAuthUsers: { created_at?: string; last_sign_in_at?: string | null }[] = [];
  if (!isScoped) {
    let pg = 1;
    while (pg <= 20) {
      const { data, error } = await admin.auth.admin.listUsers({ page: pg, perPage: 1000 });
      if (error || !data?.users?.length) break;
      allAuthUsers = allAuthUsers.concat(data.users as any);
      if (data.users.length < 1000) break;
      pg++;
    }
  }

  const fromMs = fromStart.getTime();
  const toMs = toEnd.getTime();
  const prevFromMs = prevStart.getTime();
  const prevToMs = prevEnd.getTime();

  const sumSales = (rows: SaleRow[]) =>
    rows.reduce((a, r) => a + (Number(r.total) || 0), 0);
  const sumExp = (rows: ExpRow[]) =>
    rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  const salesCur = sales.filter((r) => inRange(r.created_at, fromMs, toMs));
  const salesPrev = sales.filter((r) => inRange(r.created_at, prevFromMs, prevToMs));
  const expCur = expenses.filter((r) => inRange(r.created_at, fromMs, toMs));
  const expPrev = expenses.filter((r) => inRange(r.created_at, prevFromMs, prevToMs));

  const salesCount = salesCur.length;
  const salesTotal = sumSales(salesCur);
  const salesCountPrev = salesPrev.length;
  const salesTotalPrev = sumSales(salesPrev);
  const expensesCount = expCur.length;
  const expensesTotal = sumExp(expCur);
  const expensesCountPrev = expPrev.length;
  const expensesTotalPrev = sumExp(expPrev);
  const avgTicket = salesCount ? salesTotal / salesCount : 0;
  const avgTicketPrev = salesCountPrev ? salesTotalPrev / salesCountPrev : 0;
  const net = salesTotal - expensesTotal;
  const netPrev = salesTotalPrev - expensesTotalPrev;

  const customersCur = customers.filter((r) => inRange(r.created_at, fromMs, toMs)).length;
  const customersPrev = customers.filter((r) => inRange(r.created_at, prevFromMs, prevToMs)).length;
  const employeesCur = employees.filter((r) => inRange(r.created_at, fromMs, toMs)).length;
  const employeesPrev = employees.filter((r) => inRange(r.created_at, prevFromMs, prevToMs)).length;

  const usersCur = isScoped
    ? employeesCur
    : allAuthUsers.filter((u) => u.created_at && inRange(u.created_at, fromMs, toMs)).length;
  const usersPrev = isScoped
    ? employeesPrev
    : allAuthUsers.filter((u) => u.created_at && inRange(u.created_at, prevFromMs, prevToMs)).length;
  const activeUsers = isScoped
    ? 0
    : allAuthUsers.filter((u) => u.last_sign_in_at && inRange(String(u.last_sign_in_at), fromMs, toMs)).length;

  const bizRows = (businesses.data ?? []) as { id: string; name: string; created_at: string }[];
  const scopedBizRows = isScoped ? bizRows.filter((b) => scopedIds.includes(b.id)) : bizRows;
  const bizCur = isScoped
    ? scopedBizRows.filter((b) => b.created_at && inRange(b.created_at, fromMs, toMs)).length
    : bizRows.filter((b) => b.created_at && inRange(b.created_at, fromMs, toMs)).length;
  const bizPrev = isScoped
    ? 0
    : bizRows.filter((b) => b.created_at && inRange(b.created_at, prevFromMs, prevToMs)).length;
  const activeBiz = new Set(salesCur.map((s) => s.business_id).filter(Boolean)).size;

  const seriesMap = new Map<string, { salesCount: number; salesTotal: number; expensesTotal: number; newUsers: number }>();
  const ensure = (key: string) => {
    if (!seriesMap.has(key)) seriesMap.set(key, { salesCount: 0, salesTotal: 0, expensesTotal: 0, newUsers: 0 });
    return seriesMap.get(key)!;
  };
  for (const r of salesCur) {
    const b = ensure(bucketKey(r.created_at, grain));
    b.salesCount += 1;
    b.salesTotal += Number(r.total) || 0;
  }
  for (const r of expCur) {
    const b = ensure(bucketKey(r.created_at, grain));
    b.expensesTotal += Number(r.amount) || 0;
  }
  if (isScoped) {
    for (const r of employees) {
      if (!inRange(r.created_at, fromMs, toMs)) continue;
      ensure(bucketKey(r.created_at, grain)).newUsers += 1;
    }
  } else {
    for (const u of allAuthUsers) {
      if (!u.created_at || !inRange(u.created_at, fromMs, toMs)) continue;
      ensure(bucketKey(u.created_at, grain)).newUsers += 1;
    }
  }

  const series = [...seriesMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }));

  const byBiz = new Map<string, { count: number; total: number }>();
  for (const r of salesCur) {
    const id = r.business_id;
    if (!id) continue;
    const cur = byBiz.get(id) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(r.total) || 0;
    byBiz.set(id, cur);
  }
  const nameById = new Map(bizRows.map((b) => [b.id, b.name || "Sin nombre"]));
  const topBusinesses = scopedIds.length === 1
    ? []
    : [...byBiz.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([id, v]) => ({ id, name: nameById.get(id) || "Sin nombre", ...v }));

  const payMap = new Map<string, { count: number; total: number }>();
  for (const r of salesCur) {
    const k = String(r.payment_method || "sin método").trim() || "sin método";
    const cur = payMap.get(k) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(r.total) || 0;
    payMap.set(k, cur);
  }
  const paymentMethods = [...payMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([method, v]) => ({ method, ...v }));

  const productsCur = products.filter((r) => inRange(r.created_at, fromMs, toMs));
  const catalogRows = ((catalogSettings.data ?? []) as {
    business_id: string;
    created_at?: string;
    updated_at?: string;
    value?: { enabled?: boolean } | null;
  }).filter((r) => !isScoped || scopedIds.includes(r.business_id));
  const catalogEvents = catalogRows.filter((r) => {
    const ts = r.updated_at || r.created_at || "";
    return ts && inRange(ts, fromMs, toMs);
  });
  const catalogEnabled = catalogRows.filter((r) => r.value?.enabled !== false);

  const modules = [
    { id: "sales", name: "Vender", events: salesCur.length, businesses: uniqueBizIds(salesCur) },
    { id: "expenses", name: "Gastos", events: expCur.length, businesses: uniqueBizIds(expCur) },
    { id: "products", name: "Inventario", events: productsCur.length, businesses: uniqueBizIds(productsCur) },
    { id: "contacts", name: "Contactos", events: customers.filter((r) => inRange(r.created_at, fromMs, toMs)).length, businesses: uniqueBizIds(customers.filter((r) => inRange(r.created_at, fromMs, toMs))) },
    { id: "employees", name: "Empleados", events: employeesCur, businesses: uniqueBizIds(employees.filter((r) => inRange(r.created_at, fromMs, toMs))) },
    { id: "catalog", name: "Catálogo", events: catalogEvents.length, businesses: uniqueBizIds(catalogEnabled) },
  ].sort((a, b) => b.events - a.events || b.businesses - a.businesses);

  const kpi = (curr: number, prev: number) => ({ value: curr, previous: prev, changePct: pctChange(curr, prev) });

  return json({
    from: fromStart.toISOString(),
    to: new Date(toEnd.getTime() - 1).toISOString(),
    fromYmd,
    toYmd,
    grain,
    scope: isScoped
      ? {
        type: "businesses",
        ids: scopedIds,
        names: scopedIds.map((id) => nameById.get(id) || "Negocio"),
      }
      : { type: "all" },
    previousFrom: prevStart.toISOString(),
    previousTo: new Date(prevEnd.getTime() - 1).toISOString(),
    kpis: {
      salesTotal: kpi(salesTotal, salesTotalPrev),
      salesCount: kpi(salesCount, salesCountPrev),
      avgTicket: kpi(avgTicket, avgTicketPrev),
      expensesTotal: kpi(expensesTotal, expensesTotalPrev),
      expensesCount: kpi(expensesCount, expensesCountPrev),
      net: kpi(net, netPrev),
      newUsers: kpi(usersCur, usersPrev),
      newBusinesses: kpi(bizCur, bizPrev),
      newCustomers: kpi(customersCur, customersPrev),
      newEmployees: kpi(employeesCur, employeesPrev),
      activeUsers,
      activeBusinesses: activeBiz,
    },
    series,
    topBusinesses,
    paymentMethods,
    modules,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const route = matchRoute(url.pathname);

  if (req.method === "POST" && route === "mutate") {
    const authErr = validateKey(url);
    if (authErr) return authErr;
    try {
      return await handleMutate(req);
    } catch (e: any) {
      return json({ error: e?.message ?? String(e) }, 500);
    }
  }

  if (req.method !== "GET" || !route) {
    return json({ error: "Not found" }, 404);
  }

  const authErr = validateKey(url);
  if (authErr) return authErr;

  try {
    if (route === "stats") return await handleStats();
    if (route === "users") return await handleUsers();
    if (route === "business") return await handleBusinessDetail(url);
    if (route === "comunicados") return await handleComunicados();
    if (route === "analytics") return await handleAnalytics(url);
    return json({ error: "Not found" }, 404);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
