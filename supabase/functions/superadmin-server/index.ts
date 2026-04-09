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
function matchRoute(pathname: string): "stats" | "users" | "business" | "comunicados" | "mutate" | null {
  const pathOnly = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  const parts = pathOnly.split("/").filter(Boolean);
  const i = parts.indexOf("superadmin");
  if (i < 0 || i >= parts.length - 1) return null;
  const sub = parts[i + 1];
  if (sub === "stats") return "stats";
  if (sub === "users") return "users";
  if (sub === "business") return "business";
  if (sub === "comunicados") return "comunicados";
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
  let allUsers: any[] = [];
  let pg = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pg, perPage: 1000 });
    if (error || !data?.users?.length) break;
    allUsers = allUsers.concat(data.users);
    if (data.users.length < 1000) break;
    pg++;
  }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const activeUsers = allUsers.filter(
    (u: any) => u.last_sign_in_at && u.last_sign_in_at > thirtyDaysAgo,
  ).length;

  const [bizR, prodR, empR, saleR, expR, custR] = await Promise.all([
    admin.from("businesses").select("*", { count: "exact", head: true }),
    admin.from("products").select("*", { count: "exact", head: true }),
    admin.from("employees").select("*", { count: "exact", head: true }),
    admin.from("sales").select("*", { count: "exact", head: true }),
    admin.from("expenses").select("*", { count: "exact", head: true }),
    admin.from("customers").select("*", { count: "exact", head: true }),
  ]);

  return json({
    users: { total: allUsers.length, active: activeUsers },
    businesses: bizR.count ?? 0,
    products: prodR.count ?? 0,
    employees: empR.count ?? 0,
    sales: saleR.count ?? 0,
    expenses: expR.count ?? 0,
    customers: custR.count ?? 0,
  });
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

  const [{ data: products }, { data: employees }, { data: sales }, { data: expenses }, { data: customers }] =
    await Promise.all([
      admin.from("products").select("business_id"),
      admin.from("employees").select("business_id"),
      admin.from("sales").select("business_id"),
      admin.from("expenses").select("business_id"),
      admin.from("customers").select("business_id"),
    ]);

  const countBy = (arr: any[] | null, bizId: string) =>
    (arr ?? []).filter((r: any) => r.business_id === bizId).length;

  const enriched = (businesses ?? []).map((b: any) => ({
    ...b,
    products: countBy(products, b.id),
    employees: countBy(employees, b.id),
    sales: countBy(sales, b.id),
    expenses: countBy(expenses, b.id),
    customers: countBy(customers, b.id),
    movements: countBy(sales, b.id) + countBy(expenses, b.id),
  }));

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
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.user_metadata?.full_name || "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      is_active: !!(u.last_sign_in_at && u.last_sign_in_at > thirtyDaysAgo),
      blocked: access.blocked,
      block_message: access.block_message,
      block_history: access.block_history,
      ...totals,
    };
  });

  return json({ users: usersData, businesses: enriched });
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

  const [{ data: products, error: pErr }, { data: employees, error: eErr }, { data: customers, error: cErr }, {
    data: sales,
    error: sErr,
  }, { data: expenses, error: xErr }] = await Promise.all([
    admin.from("products").select("*").eq("business_id", businessId).order("name", { ascending: true }),
    admin.from("employees").select("*").eq("business_id", businessId).order("name", { ascending: true }),
    admin.from("customers").select("*").eq("business_id", businessId).order("name", { ascending: true }),
    admin.from("sales").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200),
    admin.from("expenses").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200),
  ]);

  const firstErr = pErr || eErr || cErr || sErr || xErr;
  if (firstErr) return json({ error: firstErr.message }, 500);

  return json({
    business,
    products: products ?? [],
    employees: employees ?? [],
    customers: customers ?? [],
    sales: sales ?? [],
    expenses: expenses ?? [],
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
    return json({ error: "Not found" }, 404);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
