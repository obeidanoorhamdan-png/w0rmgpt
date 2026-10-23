import { subscriptionCodeSchema, subscriptionCreateSchema, subscriptionUpdateSchema, validSalesKey } from "./subscriptions-api";

export async function handleSubscriptions(request: Request, secret: string | undefined) {
  const headers = { "Cache-Control": "no-store" };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  if (!await validSalesKey(supplied, secret)) return reply({ error: "Unauthorized" }, 401);
  const { getAdmin, getSettings } = await import("./admin.server");
  const settings = await getSettings();
  if (!settings.subscriptions_api_enabled) return reply({ error: "Integration disabled" }, 403);
  const db = await getAdmin();
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
      const value = { ...parsed.data, code: parsed.data.code ?? `WORM-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}` };
      const { data, error } = await db.from("gift_codes").insert(value).select("code,plan,days,max_uses,uses,created_at").single();
      if (error) return reply({ error: error.code === "23505" ? "Code already exists" : "Create failed" }, error.code === "23505" ? 409 : 500);
      await db.from("admin_log").insert({ action: "API إنشاء كود", details: value.code });
      return reply({ data }, 201);
    }
    if (!code) return reply({ error: "Code required" }, 400);
    if (request.method === "PATCH") {
      const parsed = subscriptionUpdateSchema.safeParse(await request.json());
      if (!parsed.success) return reply({ error: "Invalid subscription fields" }, 400);
      const { data, error } = await db.from("gift_codes").update(parsed.data).eq("code", code).select("code,plan,days,max_uses,uses,created_at").maybeSingle();
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