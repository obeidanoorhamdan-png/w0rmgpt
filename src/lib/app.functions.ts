import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAppInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { getSettings, fetchModels, resolveKey } = await import("./admin.server");
  const s = await getSettings();
  const all = await fetchModels(s.api_url, resolveKey(s.api_key_override));
  const disabled = (s.disabled_models as string[]) ?? [];
  const models = all.filter((m) => m.type !== "image" && !disabled.includes(m.id)).map((m) => ({ id: m.id, name: m.name }));
  return { announcement: s.announcement, defaultModel: s.default_model, models, dailyCredits: s.daily_credits };
});

export const redeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => ({ code: String(d.code).trim().toUpperCase().slice(0, 64) }))
  .handler(async ({ data, context }) => {
    const { getAdmin } = await import("./admin.server");
    const db = await getAdmin();
    const { data: gc } = await db.from("gift_codes").select("*").eq("code", data.code).maybeSingle();
    if (!gc) throw new Error("الكود غير صحيح");
    if (gc.uses >= gc.max_uses) throw new Error("الكود مستخدم بالكامل");
    const { error: rErr } = await db.from("redemptions").insert({ code: gc.code, user_id: context.userId });
    if (rErr) throw new Error("لقد استخدمت هذا الكود مسبقاً");
    await db.from("gift_codes").update({ uses: gc.uses + 1 }).eq("code", gc.code);
    const { data: p } = await db.from("profiles").select("plan_expires_at, plan").eq("id", context.userId).single();
    const base = p?.plan === gc.plan && p.plan_expires_at && new Date(p.plan_expires_at) > new Date() ? new Date(p.plan_expires_at) : new Date();
    const exp = new Date(base.getTime() + gc.days * 86400000).toISOString();
    await db.from("profiles").update({ plan: gc.plan, plan_expires_at: exp }).eq("id", context.userId);
    return { plan: gc.plan, expires: exp };
  });
