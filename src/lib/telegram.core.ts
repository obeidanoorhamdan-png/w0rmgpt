// Server-only Telegram core: gateway calls, settings, ledger, safety gates. No UI imports.
import { parseAdminIds, rateAllows } from "./drops";
import type { Tables } from "@/integrations/supabase/types";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";
export type Kb = { text: string; callback_data?: string; url?: string }[][];
export type S = Tables<"app_settings">;

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["TELEGRAM_API_KEY"];
  if (!lovable || !key) throw new Error("Telegram غير مربوط");
  const r = await fetch(`${GATEWAY}/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Telegram ${method} [${r.status}]: ${text}`);
  const j = JSON.parse(text) as { ok: boolean; result: T; description?: string };
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result;
}

/** Best-effort send: a user who blocked the bot must never break a flow. */
export async function notify(chatId: number, text: string, keyboard?: Kb, extra: Record<string, unknown> = {}) {
  await tg("sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
    ...(keyboard?.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    ...extra,
  }).catch(() => undefined);
}

export async function notifyPhoto(chatId: number, photoUrl: string, caption: string, keyboard?: Kb) {
  await tg("sendPhoto", {
    chat_id: chatId, photo: photoUrl, caption, parse_mode: "HTML",
    ...(keyboard?.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  }).catch(() => undefined);
}

export async function editMsg(chatId: number, messageId: number, text: string, keyboard?: Kb) {
  await tg("editMessageText", {
    chat_id: chatId, message_id: messageId, text, parse_mode: "HTML",
    ...(keyboard?.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  }).catch(() => undefined);
}

export function answer(qId: string, text: string, alert = false) {
  return tg("answerCallbackQuery", { callback_query_id: qId, text, show_alert: alert }).catch(() => undefined);
}

export async function webhookSecret() {
  const key = process.env["TELEGRAM_API_KEY"] ?? "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`telegram-webhook:${key}`));
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function settings(): Promise<S> {
  const { data } = await (await db()).from("app_settings").select("*").eq("id", 1).single();
  if (!data) throw new Error("Settings missing");
  return data;
}

export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Calendar day in the shop's timezone — used for daily boxes, streaks and spins. */
export function today(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hebron", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export const adminIdsOf = (s: S) => parseAdminIds(String(s.tg_admin_ids ?? ""));

/** Owner = admin ids in settings; others come from the separate tg_staff table. */
export async function staffRole(tgId: number): Promise<string | null> {
  const s = await settings();
  if (adminIdsOf(s).includes(tgId)) return "owner";
  const { data } = await (await db()).from("tg_staff").select("role").eq("tg_id", tgId).maybeSingle();
  return data?.role ?? null;
}

export async function canManage(tgId: number, area: "drops" | "support"): Promise<boolean> {
  const role = await staffRole(tgId);
  if (!role) return false;
  if (role === "owner" || role === "admin") return true;
  return role === area;
}

export async function logBot(adminTgId: number, action: string, detail = "") {
  await (await db()).from("tg_bot_log").insert({ admin_tg_id: adminTgId, action, detail });
}

/** Move points and keep the ledger + totals consistent. */
export async function addPoints(tgId: number, delta: number, kind: string, note = "") {
  const client = await db();
  const { data, error } = await client.rpc("tg_move_points", { p_tg_id: tgId, p_delta: delta, p_kind: kind, p_note: note });
  if (error || !data) throw new Error("الرصيد لا يكفي أو تعذّر حفظ العملية");
}

/** Give a badge once; returns true the first time. */
export async function awardBadge(tgId: number, key: string) {
  const client = await db();
  const { data: b } = await client.from("tg_badges").select("title, description").eq("key", key).maybeSingle();
  if (!b) return false;
  const { error } = await client.from("tg_user_badges").insert({ tg_id: tgId, badge_key: key });
  if (error) return false;
  await notify(tgId, `🏅 شارة جديدة: <b>${esc(b.title)}</b> — ${esc(b.description)}`);
  return true;
}

/** One-minute sliding window against the configured tap limit. */
export async function rateOk(key: string, limit: number) {
  if (limit <= 0) return true;
  const client = await db();
  const now = Date.now();
  const { data } = await client.from("tg_rate").select("count, window_start").eq("key", key).maybeSingle();
  const prev = data?.window_start ? new Date(data.window_start).getTime() : 0;
  const start = now - prev <= 60_000 ? prev : now;
  const r = rateAllows(start, now, start === prev ? (data?.count ?? 0) : 0, limit);
  await client.from("tg_rate").upsert({ key, count: r.count, window_start: new Date(start).toISOString() }, { onConflict: "key" });
  return r.allowed;
}

/** Maintenance mode and bans stop everything before a handler runs. */
export async function blocked(tgId: number, s: S): Promise<boolean> {
  if (s.tg_maintenance && !adminIdsOf(s).includes(tgId)) {
    await notify(tgId, esc(s.tg_maintenance_text));
    return true;
  }
  const { data: u } = await (await db()).from("tg_users").select("banned, ban_reason").eq("tg_id", tgId).maybeSingle();
  if (u?.banned) {
    await notify(tgId, `🚫 حسابك موقوف في البوت${u.ban_reason ? `: ${esc(u.ban_reason)}` : ""}`);
    return true;
  }
  return false;
}

/** Where a drop gets posted: the main channel plus any extra channels. */
export function channelsOf(s: S, drop?: { channels?: unknown } | null): string[] {
  const extra = Array.isArray(drop?.channels) ? drop.channels.map(String) : [];
  const base = Array.isArray(s.tg_channels) ? (s.tg_channels as unknown[]).map(String) : [];
  return [...new Set([s.tg_channel, ...base, ...extra].map((c) => String(c ?? "").trim()).filter(Boolean))];
}

export function asJson<T>(v: unknown, fallback: T): T {
  return Array.isArray(v) || typeof v === "object" ? (v as T) : fallback;
}
