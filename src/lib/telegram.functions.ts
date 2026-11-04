import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type T = { token: string };
const auth = async (token: string) => {
  const { verifyAdminToken, getAdmin } = await import("./admin.server");
  await verifyAdminToken(token);
  return getAdmin();
};

export const tgOverview = createServerFn({ method: "POST" })
  .inputValidator((d: T) => d)
  .handler(async ({ data }) => {
    const db = await auth(data.token);
    const { dropStats } = await import("./telegram.server");
    const [{ data: s }, { data: drops }, stats] = await Promise.all([
      db.from("app_settings").select("tg_enabled, tg_admin_ids, tg_channel, tg_bot_username, tg_store_text, tg_contact, tg_plans, tg_ref_points, tg_ref_credits").eq("id", 1).single(),
      db.from("tg_drops").select("*").order("created_at", { ascending: false }).limit(100),
      dropStats(),
    ]);
    return { settings: s!, drops: drops ?? [], stats, connected: Boolean(process.env["TELEGRAM_API_KEY"]) };
  });

const settingsSchema = z.object({
  tg_enabled: z.boolean(),
  tg_admin_ids: z.string().max(500),
  tg_channel: z.string().max(100),
  tg_bot_username: z.string().max(100),
  tg_store_text: z.string().min(1).max(3000),
  tg_contact: z.string().max(100),
  tg_plans: z.array(z.object({ plan: z.string().max(20), label: z.string().max(50), price: z.string().max(50) })).max(10),
  tg_ref_points: z.number().int().min(0).max(1000),
  tg_ref_credits: z.number().int().min(0).max(1000),
});

export const tgSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: T & { patch: z.infer<typeof settingsSchema> }) => ({ token: d.token, patch: settingsSchema.parse(d.patch) }))
  .handler(async ({ data }) => {
    const db = await auth(data.token);
    await db.from("app_settings").update(data.patch).eq("id", 1);
    return { ok: true };
  });

/** Registers the Telegram webhook to the given public site origin. */
export const tgRegisterWebhook = createServerFn({ method: "POST" })
  .inputValidator((d: T & { origin: string }) => ({ token: d.token, origin: z.string().url().startsWith("https://").parse(d.origin) }))
  .handler(async ({ data }) => {
    await auth(data.token);
    const { tg, webhookSecret } = await import("./telegram.server");
    const url = `${data.origin.replace(/\/$/, "")}/api/public/telegram/webhook`;
    await tg("setWebhook", { url, secret_token: await webhookSecret(), allowed_updates: ["message", "callback_query"] });
    const me = await tg<{ username: string }>("getMe", {});
    return { url, username: me.username };
  });

const dropSchema = z.object({
  kind: z.enum(["normal", "sequential", "conditional", "auction", "vote", "points"]),
  title: z.string().min(1).max(120),
  description: z.string().max(1000),
  prize_plan: z.enum(["plus", "pro", "ultra"]).nullable(),
  prize_days: z.number().int().min(0).max(3650),
  prize_credits: z.number().int().min(0).max(100000),
  winners_count: z.number().int().min(1).max(100),
  entry_cost: z.number().int().min(0).max(100000),
  min_points: z.number().int().min(0).max(100000),
  min_referrals: z.number().int().min(0).max(100000),
  require_channel: z.boolean(),
  vote_options: z.array(z.string().min(1).max(60)).max(8),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
});

export const tgCreateDrop = createServerFn({ method: "POST" })
  .inputValidator((d: T & { drop: z.infer<typeof dropSchema>; publishNow: boolean }) => ({ token: d.token, publishNow: d.publishNow === true, drop: dropSchema.parse(d.drop) }))
  .handler(async ({ data }) => {
    const db = await auth(data.token);
    const d = data.drop;
    if (d.kind === "vote" && d.vote_options.length < 2) throw new Error("التصويت يحتاج خيارين على الأقل");
    const { data: row, error } = await db.from("tg_drops").insert({
      ...d, status: "scheduled", starts_at: d.starts_at ?? new Date().toISOString(),
    }).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "فشل الإنشاء");
    if (data.publishNow) {
      const { publishDrop } = await import("./telegram.server");
      await publishDrop(row.id);
    }
    return { id: row.id };
  });

export const tgDropAction = createServerFn({ method: "POST" })
  .inputValidator((d: T & { id: string; action: "publish" | "close" | "delete" }) => ({ token: d.token, id: z.string().uuid().parse(d.id), action: z.enum(["publish", "close", "delete"]).parse(d.action) }))
  .handler(async ({ data }) => {
    const db = await auth(data.token);
    const srv = await import("./telegram.server");
    if (data.action === "publish") await srv.publishDrop(data.id);
    else if (data.action === "close") await srv.closeDrop(data.id);
    else await db.from("tg_drops").delete().eq("id", data.id);
    return { ok: true };
  });

/** Signed-in site user gets a one-time link to connect their account to the bot. */
export const tgCreateLinkToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = crypto.randomUUID().replace(/-/g, "");
    await supabaseAdmin.from("tg_link_tokens").insert({ token, profile_id: context.userId, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() });
    const { data: s } = await supabaseAdmin.from("app_settings").select("tg_bot_username").eq("id", 1).single();
    const bot = (s?.tg_bot_username ?? "").replace(/^@/, "");
    if (!bot) throw new Error("البوت غير مضبوط بعد");
    return { url: `https://t.me/${bot}?start=link_${token}` };
  });
