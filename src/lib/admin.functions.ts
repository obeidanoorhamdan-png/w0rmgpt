import { createServerFn } from "@tanstack/react-start";
import type { TablesUpdate } from "@/integrations/supabase/types";

type T = { token: string };

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: String(d.password).slice(0, 200) }))
  .handler(async ({ data }) => {
    const { getSettings, sha256Hex, signAdminToken } = await import("./admin.server");
    const s = await getSettings();
    if ((await sha256Hex(data.password)) !== s.admin_password_hash) throw new Error("كلمة المرور غير صحيحة");
    return { token: await signAdminToken() };
  });

export const adminOverview = createServerFn({ method: "POST" })
  .inputValidator((d: T & { search?: string | undefined }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin, getSettings, fetchModels, resolveKey, maskKey } = await import("./admin.server");
    await verifyAdminToken(data.token);
    const db = await getAdmin();
    const s = await getSettings();
    const key = resolveKey(s.api_key_override);
    let q = db.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
    if (data.search) q = q.or(`email.ilike.%${data.search.replace(/[%,()]/g, "")}%,short_id.ilike.%${data.search.replace(/[%,()]/g, "")}%`);
    const [{ data: users }, { count: userCount }, { count: msgCount }, { data: codes }, { data: logs }, { data: modelRows }, { data: sellerKeys }, models] = await Promise.all([
      q,
      db.from("profiles").select("*", { count: "exact", head: true }),
      db.from("messages").select("*", { count: "exact", head: true }),
      db.from("gift_codes").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("admin_log").select("*").order("created_at", { ascending: false }).limit(30),
      db.from("messages").select("model").eq("role", "assistant").order("created_at", { ascending: false }).limit(1000),
      db.from("seller_api_keys").select("*").order("created_at", { ascending: false }),
      fetchModels(s.api_url, key),
    ]);
    const usage: Record<string, number> = {};
    for (const r of modelRows ?? []) if (r.model) usage[r.model] = (usage[r.model] ?? 0) + 1;
    const topModel = Object.entries(usage).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const subs = (users ?? []).filter((u) => u.plan !== "free" && u.plan_expires_at && new Date(u.plan_expires_at) > new Date()).length;
    const codeCounts: Record<string, number> = {};
    for (const c of codes ?? []) if (c.created_by_key_id) codeCounts[c.created_by_key_id] = (codeCounts[c.created_by_key_id] ?? 0) + 1;
    return {
      settings: {
        system_prompt: s.system_prompt, api_url: s.api_url, key_source: s.api_key_override ? "مفتاح مخصص من اللوحة" : "المفتاح الآمن الافتراضي",
        key_masked: maskKey(key), disabled_models: (s.disabled_models as string[]) ?? [], default_model: s.default_model,
        announcement: s.announcement ?? "", daily_credits: s.daily_credits,
        subscriptions_api_enabled: s.subscriptions_api_enabled,
        subscriptions_key_configured: Boolean(process.env["SUBSCRIPTIONS_API_KEY"]),
      },
      stats: { users: userCount ?? 0, messages: msgCount ?? 0, subs, topModel },
      users: users ?? [], codes: codes ?? [], logs: logs ?? [], models,
      seller_keys: (sellerKeys ?? []).map((k) => ({
        id: k.id, name: k.name, active: k.active, created_at: k.created_at,
        key_masked: `••••${k.key_hash.slice(-6)}`,
        codes_created: codeCounts[k.id] ?? 0,
      })),
    };
  });

async function log(action: string, details: string) {
  const { getAdmin } = await import("./admin.server");
  await (await getAdmin()).from("admin_log").insert({ action, details });
}

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: T & { patch: { system_prompt?: string; api_url?: string; api_key?: string; disabled_models?: string[]; default_model?: string; announcement?: string; daily_credits?: number; subscriptions_api_enabled?: boolean } }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin } = await import("./admin.server");
    await verifyAdminToken(data.token);
    const p = data.patch;
    const upd: TablesUpdate<"app_settings"> = { updated_at: new Date().toISOString() };
    if (p.system_prompt !== undefined) upd.system_prompt = p.system_prompt;
    if (p.api_url) {
      if (!/^https:\/\//.test(p.api_url)) throw new Error("الرابط يجب أن يبدأ بـ https://");
      upd.api_url = p.api_url;
    }
    if (p.api_key !== undefined) upd.api_key_override = p.api_key.trim() || null;
    if (p.disabled_models) upd.disabled_models = p.disabled_models;
    if (p.default_model) upd.default_model = p.default_model;
    if (p.announcement !== undefined) upd.announcement = p.announcement || null;
    if (p.subscriptions_api_enabled !== undefined) upd.subscriptions_api_enabled = p.subscriptions_api_enabled === true;
    if (p.daily_credits !== undefined) upd.daily_credits = Math.max(0, Math.min(100000, Math.floor(p.daily_credits)));
    const { error } = await (await getAdmin()).from("app_settings").update(upd).eq("id", 1);
    if (error) throw new Error(error.message);
    await log("تحديث الإعدادات", Object.keys(upd).filter((k) => k !== "updated_at").join(", "));
    return { ok: true };
  });

export const adminChangePassword = createServerFn({ method: "POST" })
  .inputValidator((d: T & { password: string }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin, sha256Hex } = await import("./admin.server");
    await verifyAdminToken(data.token);
    if (data.password.length < 6) throw new Error("6 أحرف على الأقل");
    await (await getAdmin()).from("app_settings").update({ admin_password_hash: await sha256Hex(data.password) }).eq("id", 1);
    await log("تغيير كلمة مرور اللوحة", "");
    return { ok: true };
  });

export const adminCreateCode = createServerFn({ method: "POST" })
  .inputValidator((d: T & { plan: string; days: number; max_uses: number }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin } = await import("./admin.server");
    await verifyAdminToken(data.token);
    if (!["plus", "pro", "ultra"].includes(data.plan)) throw new Error("خطة غير صالحة");
    const code = "WORM-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    await (await getAdmin()).from("gift_codes").insert({ code, plan: data.plan, days: Math.max(1, data.days), max_uses: Math.max(1, data.max_uses) });
    await log("إنشاء كود", `${code} ${data.plan} ${data.days}d`);
    return { code };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .inputValidator((d: T & { id: string; plan?: string; days?: number; addCredits?: number; suspended?: boolean }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin } = await import("./admin.server");
    await verifyAdminToken(data.token);
    const db = await getAdmin();
    const { data: u } = await db.from("profiles").select("*").eq("id", data.id).single();
    if (!u) throw new Error("مستخدم غير موجود");
    const upd: TablesUpdate<"profiles"> = {};
    if (data.plan) {
      upd.plan = data.plan;
      upd.plan_expires_at = data.plan === "free" ? null : new Date(Date.now() + (data.days ?? 30) * 86400000).toISOString();
    }
    if (data.addCredits) upd.bonus_credits = Math.max(0, u.bonus_credits + data.addCredits);
    if (data.suspended !== undefined) upd.suspended = data.suspended;
    await db.from("profiles").update(upd).eq("id", data.id);
    await log("تعديل مستخدم", `${u.email}: ${JSON.stringify(upd)}`);
    return { ok: true };
  });

export const adminCreateSellerKey = createServerFn({ method: "POST" })
  .inputValidator((d: T & { name: string }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin } = await import("./admin.server");
    await verifyAdminToken(data.token);
    const name = data.name.trim().slice(0, 80);
    if (!name) throw new Error("اسم المفتاح مطلوب");
    const { generateSellerKey, sha256Hex } = await import("./subscriptions-api");
    const key = generateSellerKey();
    const { error } = await (await getAdmin()).from("seller_api_keys").insert({ name, key_hash: await sha256Hex(key) });
    if (error) throw new Error("تعذر إنشاء المفتاح");
    await log("إنشاء مفتاح بيع", name);
    return { key }; // shown once, never stored in plain text
  });

export const adminToggleSellerKey = createServerFn({ method: "POST" })
  .inputValidator((d: T & { id: string; active: boolean }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin } = await import("./admin.server");
    await verifyAdminToken(data.token);
    const { error } = await (await getAdmin()).from("seller_api_keys").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error("تعذر التحديث");
    await log(data.active ? "تفعيل مفتاح بيع" : "تعطيل مفتاح بيع", data.id);
    return { ok: true };
  });

export const adminDeleteSellerKey = createServerFn({ method: "POST" })
  .inputValidator((d: T & { id: string }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin } = await import("./admin.server");
    await verifyAdminToken(data.token);
    const { error } = await (await getAdmin()).from("seller_api_keys").delete().eq("id", data.id);
    if (error) throw new Error("تعذر الحذف");
    await log("حذف مفتاح بيع", data.id);
    return { ok: true };
  });

export const adminDeleteCodes = createServerFn({ method: "POST" })
  .inputValidator((d: T & { codes?: string[]; all?: boolean }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin } = await import("./admin.server");
    await verifyAdminToken(data.token);
    const db = await getAdmin();
    if (data.all) {
      const { error, count } = await db.from("gift_codes").delete({ count: "exact" }).gte("created_at", "1970-01-01");
      if (error) throw new Error("تعذر حذف الأكواد");
      await log("حذف جميع الأكواد", `${count ?? 0}`);
      return { deleted: count ?? 0 };
    }
    const codes = (data.codes ?? []).filter((c) => /^[A-Za-z0-9_-]{4,80}$/.test(c)).slice(0, 500);
    if (!codes.length) throw new Error("لم يتم تحديد أكواد");
    const { error, count } = await db.from("gift_codes").delete({ count: "exact" }).in("code", codes);
    if (error) throw new Error("تعذر حذف الأكواد");
    await log("حذف أكواد محددة", `${count ?? 0}: ${codes.slice(0, 10).join(", ")}`);
    return { deleted: count ?? 0 };
  });

export const adminInspectCode = createServerFn({ method: "POST" })
  .inputValidator((d: T & { code: string }) => d)
  .handler(async ({ data }) => {
    const { verifyAdminToken, getAdmin } = await import("./admin.server");
    await verifyAdminToken(data.token);
    const code = data.code.trim().toUpperCase();
    if (!/^[A-Za-z0-9_-]{4,80}$/.test(code)) throw new Error("صيغة الكود غير صالحة");
    const db = await getAdmin();
    const { data: row } = await db.from("gift_codes").select("*").eq("code", code).maybeSingle();
    if (!row) throw new Error("الكود غير موجود");
    const { data: redemptions } = await db.from("redemptions").select("user_id, created_at").eq("code", code).order("created_at", { ascending: false });
    let keyName: string | null = null;
    if (row.created_by_key_id) {
      const { data: k } = await db.from("seller_api_keys").select("name").eq("id", row.created_by_key_id).maybeSingle();
      keyName = k?.name ?? null;
    }
    const userIds = (redemptions ?? []).map((r) => r.user_id);
    const { data: users } = userIds.length ? await db.from("profiles").select("id, email, short_id").in("id", userIds) : { data: [] };
    const byId = new Map((users ?? []).map((u) => [u.id, u]));
    return {
      code: row.code, plan: row.plan, days: row.days, uses: row.uses, max_uses: row.max_uses,
      remaining: Math.max(0, row.max_uses - row.uses),
      exhausted: row.uses >= row.max_uses,
      created_at: row.created_at,
      created_by: keyName ?? "لوحة الإدارة",
      redeemed_by: (redemptions ?? []).map((r) => ({ email: byId.get(r.user_id)?.email ?? r.user_id, at: r.created_at })),
    };
  });
