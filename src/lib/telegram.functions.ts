import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { telegramSettingsSchema as settingsSchema, definedFields, orderActionSchema } from "./telegram.schemas";

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
      db.from("app_settings").select("tg_enabled, tg_admin_ids, tg_channel, tg_bot_username, tg_store_text, tg_contact, tg_plans, tg_ref_points, tg_ref_credits, tg_maintenance, tg_maintenance_text, tg_captcha_enabled, tg_rate_limit, tg_support_enabled, tg_require_channels, tg_points_per_day, tg_daily_box, tg_spin_prizes, tg_streak_bonus").eq("id", 1).single(),
      db.from("tg_drops").select("*").order("created_at", { ascending: false }).limit(100),
      dropStats(),
    ]);
    if (!s) throw new Error("إعدادات البوت غير متاحة");
    return { settings: s, drops: drops ?? [], stats, connected: Boolean(process.env["TELEGRAM_API_KEY"]) };
  });

export const tgSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: T & { patch: z.infer<typeof settingsSchema> }) => ({ token: d.token, patch: settingsSchema.parse(d.patch) }))
  .handler(async ({ data }) => {
    const db = await auth(data.token);
    const { error } = await db.from("app_settings").update(definedFields(data.patch)).eq("id", 1);
    if (error) throw new Error("تعذّر حفظ الإعدادات");
    return { ok: true };
  });

/** Registers the Telegram webhook to the given public site origin. */
export const tgRegisterWebhook = createServerFn({ method: "POST" })
  .inputValidator((d: T & { origin: string }) => ({ token: d.token, origin: z.string().url().startsWith("https://").parse(d.origin) }))
  .handler(async ({ data }) => {
    await auth(data.token);
    const { tg, webhookSecret } = await import("./telegram.server");
    const { registerMenus } = await import("./telegram.user");
    const url = `${data.origin.replace(/\/$/, "")}/api/public/telegram/webhook`;
    await tg("setWebhook", { url, secret_token: await webhookSecret(), allowed_updates: ["message", "callback_query"] });
    const me = await tg<{ username: string }>("getMe", {});
    await registerMenus(me.username);
    return { url, username: me.username };
  });

const dropSchema = z.object({
  kind: z.enum(["normal", "sequential", "conditional", "auction", "vote", "points", "egg", "lottery", "reverse", "first", "quiz"]),
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

export const tgOperations = createServerFn({ method: "POST" })
  .inputValidator((d: T) => d)
  .handler(async ({ data }) => {
    const db = await auth(data.token);
    const [orders, tickets, users, log] = await Promise.all([
      db.from("tg_orders").select("id,tg_id,label,price,status,created_at").order("created_at", { ascending: false }).limit(50),
      db.from("tg_tickets").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("tg_users").select("tg_id,first_name,username,points,referrals,banned").order("created_at", { ascending: false }).limit(100),
      db.from("tg_bot_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    return { orders: orders.data ?? [], tickets: tickets.data ?? [], users: users.data ?? [], log: log.data ?? [] };
  });

export const tgModerate = createServerFn({ method: "POST" })
  .inputValidator((d: T & { tgId: number; banned: boolean }) => ({ token: d.token, tgId: z.number().int().positive().parse(d.tgId), banned: z.boolean().parse(d.banned) }))
  .handler(async ({ data }) => {
    const db = await auth(data.token);
    const { error } = await db.from("tg_users").update({ banned: data.banned }).eq("tg_id", data.tgId);
    if (error) throw new Error("تعذّر تغيير حالة المستخدم");
    await db.from("tg_bot_log").insert({ admin_tg_id: 0, action: data.banned ? "ban" : "unban", detail: String(data.tgId) });
    return { ok: true };
  });

export const tgTicketReply = createServerFn({ method: "POST" })
  .inputValidator((d: T & { id: string; text: string; close?: boolean }) => ({ token: d.token, id: z.string().uuid().parse(d.id), text: z.string().max(3000).parse(d.text), close: d.close === true }))
  .handler(async ({ data }) => {
    const db = await auth(data.token);
    const { data: ticket } = await db.from("tg_tickets").select("tg_id,status").eq("id", data.id).single();
    if (!ticket || ticket.status !== "open") throw new Error("التذكرة مغلقة أو غير موجودة");
    if (data.text.trim()) {
      const { error } = await db.from("tg_ticket_msgs").insert({ ticket_id: data.id, text: data.text, from_admin: true });
      if (error) throw new Error("تعذّر حفظ الرد");
      const { tg, esc } = await import("./telegram.core");
      await tg("sendMessage", { chat_id: ticket.tg_id, text: `🛟 رد الدعم\n${esc(data.text)}`, parse_mode: "HTML" });
    }
    if (data.close) await db.from("tg_tickets").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", data.id);
    await db.from("tg_bot_log").insert({ admin_tg_id: 0, action: data.close ? "ticket_close" : "ticket_reply", detail: data.id });
    return { ok: true };
  });
