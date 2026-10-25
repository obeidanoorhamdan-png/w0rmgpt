import { sha256Hex, subscriptionCodeSchema, subscriptionCreateSchema, subscriptionUpdateSchema, validSalesKey } from "./subscriptions-api";

export async function handleSubscriptions(request: Request, secret: string | undefined) {
  const headers = { "Cache-Control": "no-store" };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const { getAdmin, getSettings } = await import("./admin.server");
  const db = await getAdmin();

  // Master key from env, or any active seller key created in the admin panel.
  let sellerKeyId: string | null = null;
  if (await validSalesKey(supplied, secret)) {
    sellerKeyId = null; // master key: tracked as admin-created
  } else if (supplied) {
    const { data: sellerKey } = await db
      .from("seller_api_keys")
      .select("id, active")
      .eq("key_hash", await sha256Hex(supplied))
      .maybeSingle();
    if (!sellerKey || !sellerKey.active) return reply({ error: "Unauthorized" }, 401);
    sellerKeyId = sellerKey.id;
  } else {
    return reply({ error: "Unauthorized" }, 401);
  }

  const settings = await getSettings();
  if (!settings.subscriptions_api_enabled) return reply({ error: "Integration disabled" }, 403);
  const rawCode = new URL(request.url).searchParams.get("code");
  const codeResult = rawCode === null ? null : subscriptionCodeSchema.safeParse(rawCode);
  if (codeResult && !codeResult.success) return reply({ error: "Invalid code" }, 400);
  const code = codeResult?.success ? codeResult.data : null;
  try {
    if (request.method === "GET") {
      let query = db.from("gift_codes").select("code,plan,days,max_uses,uses,created_at").order("created_at", { ascending: false }).limit(100);
      if (code) query = query.eq("code", code);
      const { data, error } = await query;
      if (error) return reply({ error: "Read failed" }, 500);
      if (code && !data?.length) return reply({ error: "Code not found" }, 404);
      return reply({ data });
    }
    if (request.method === "POST") {
      const parsed = subscriptionCreateSchema.safeParse(await request.json());
      if (!parsed.success) return reply({ error: "Invalid subscription fields" }, 400);
      const value = { ...parsed.data, code: parsed.data.code ?? `WORM-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`, created_by_key_id: sellerKeyId };
      const { data, error } = await db.from("gift_codes").insert(value).select("code,plan,days,max_uses,uses,created_at").single();
      if (error) return reply({ error: error.code === "23505" ? "Code already exists" : "Create failed" }, error.code === "23505" ? 409 : 500);
      await db.from("admin_log").insert({ action: "API إنشاء كود", details: value.code });
      return reply({ data }, 201);
    }
    if (!code) return reply({ error: "Code required" }, 400);
    if (request.method === "PATCH") {
      const parsed = subscriptionUpdateSchema.safeParse(await request.json());
      if (!parsed.success) return reply({ error: "Invalid subscription fields" }, 400);
      const patch = { ...(parsed.data.plan !== undefined ? { plan: parsed.data.plan } : {}), ...(parsed.data.days !== undefined ? { days: parsed.data.days } : {}), ...(parsed.data.max_uses !== undefined ? { max_uses: parsed.data.max_uses } : {}) };
      const { data, error } = await db.from("gift_codes").update(patch).eq("code", code).select("code,plan,days,max_uses,uses,created_at").maybeSingle();
      if (error) return reply({ error: "Update failed" }, 500);
      if (!data) return reply({ error: "Code not found" }, 404);
      await db.from("admin_log").insert({ action: "API تعديل كود", details: code });
      return reply({ data });
    }
    const { data, error } = await db.from("gift_codes").delete().eq("code", code).select("code").maybeSingle();
    if (error) return reply({ error: "Delete failed" }, 500);
    if (!data) return reply({ error: "Code not found" }, 404);
    await db.from("admin_log").insert({ action: "API حذف كود", details: code });
    return reply({ deleted: true, code });
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
}
