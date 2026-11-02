// Server-only Telegram store + drops engine. Called by the webhook, the cron tick and admin functions.
import { DROP_KINDS, joinBlocker, parseAdminIds, pickWinners, type Entry } from "./drops";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";
type Kb = { text: string; callback_data?: string; url?: string }[][];

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

export async function webhookSecret() {
  const key = process.env["TELEGRAM_API_KEY"] ?? "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`telegram-webhook:${key}`));
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function settings() {
  const { data } = await (await db()).from("app_settings").select("*").eq("id", 1).single();
  if (!data) throw new Error("Settings missing");
  return data;
}

type Drop = NonNullable<Awaited<ReturnType<typeof loadDrop>>>;
async function loadDrop(id: string) {
  const { data } = await (await db()).from("tg_drops").select("*").eq("id", id).maybeSingle();
  return data;
}

function prizeText(d: { prize_plan: string | null; prize_days: number; prize_credits: number }) {
  const parts: string[] = [];
  if (d.prize_plan) parts.push(`اشتراك ${d.prize_plan.toUpperCase()} لمدة ${d.prize_days} يوم`);
  if (d.prize_credits > 0) parts.push(`${d.prize_credits} رصيد في الموقع`);
  return parts.join(" + ") || "جائزة";
}

function dropText(d: Drop, count: number) {
  const lines = [
    `🥚 <b>${esc(d.title)}</b>`,
    `النوع: ${DROP_KINDS[d.kind as keyof typeof DROP_KINDS] ?? d.kind}`,
    d.description ? esc(d.description) : "",
    `🎁 الجائزة: ${prizeText(d)}`,
    `🏆 عدد الفائزين: ${d.winners_count}`,
    d.kind === "points" ? `💎 تكلفة الدخول: ${d.entry_cost} نقطة` : "",
    d.kind === "conditional" ? `📌 الشرط: ${d.min_points} نقطة، ${d.min_referrals} إحالة${d.require_channel ? "، الاشتراك بالقناة" : ""}` : "",
    d.ends_at ? `⏰ ينتهي: ${new Date(d.ends_at).toLocaleString("ar", { timeZone: "Asia/Hebron" })}` : "",
    `👥 المشاركون: ${count}`,
  ];
  if (d.status === "closed") lines.push("✅ انتهى الدروب");
  return lines.filter(Boolean).join("\n");
}

function dropKeyboard(d: Drop): Kb {
  if (d.status !== "live") return [];
  if (d.kind === "auction") return [[1, 5, 10].map((n) => ({ text: `+${n} نقطة`, callback_data: `bid:${d.id}:${n}` }))];
  if (d.kind === "vote") return (d.vote_options as string[]).map((o, i) => [{ text: o, callback_data: `vote:${d.id}:${i}` }]);
  return [[{ text: d.kind === "sequential" ? "⚡ أسرع واحد" : "🥚 شارك", callback_data: `join:${d.id}` }]];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function entryCount(id: string) {
  const { count } = await (await db()).from("tg_drop_entries").select("*", { count: "exact", head: true }).eq("drop_id", id);
  return count ?? 0;
}

async function refreshPost(d: Drop) {
  const s = await settings();
  if (!d.message_id || !s.tg_channel) return;
  await tg("editMessageText", {
    chat_id: s.tg_channel, message_id: d.message_id, text: dropText(d, await entryCount(d.id)), parse_mode: "HTML",
    reply_markup: { inline_keyboard: dropKeyboard(d) },
  }).catch(() => undefined);
}

export async function publishDrop(id: string) {
  const s = await settings();
  if (!s.tg_channel) throw new Error("لم يتم ضبط القناة");
  const d = await loadDrop(id);
  if (!d || d.status === "closed") throw new Error("الدروب غير متاح");
  const live = { ...d, status: "live" };
  const msg = await tg<{ message_id: number }>("sendMessage", {
    chat_id: s.tg_channel, text: dropText(live, 0), parse_mode: "HTML", reply_markup: { inline_keyboard: dropKeyboard(live) },
  });
  await (await db()).from("tg_drops").update({ status: "live", message_id: msg.message_id, starts_at: new Date().toISOString() }).eq("id", id);
}

async function grantPrize(d: Drop, tgId: number) {
  const client = await db();
  const parts: string[] = [];
  if (d.prize_plan) {
    const code = "WORM-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    await client.from("gift_codes").insert({ code, plan: d.prize_plan, days: Math.max(1, d.prize_days), max_uses: 1 });
    parts.push(`كود الاشتراك: <code>${code}</code>`);
  }
  if (d.prize_credits > 0) {
    const { data: u } = await client.from("tg_users").select("profile_id").eq("tg_id", tgId).maybeSingle();
    if (u?.profile_id) {
      const { data: p } = await client.from("profiles").select("bonus_credits").eq("id", u.profile_id).single();
      if (p) await client.from("profiles").update({ bonus_credits: p.bonus_credits + d.prize_credits }).eq("id", u.profile_id);
      parts.push(`أُضيف ${d.prize_credits} رصيد إلى حسابك في الموقع`);
    } else {
      const { data: tu } = await client.from("tg_users").select("points").eq("tg_id", tgId).single();
      await client.from("tg_users").update({ points: (tu?.points ?? 0) + d.prize_credits }).eq("tg_id", tgId);
      parts.push(`حسابك غير مربوط بالموقع، فأُضيفت ${d.prize_credits} نقطة في البوت بدلاً من الرصيد`);
    }
  }
  await tg("sendMessage", { chat_id: tgId, text: `🎉 مبروك! فزت في «${esc(d.title)}»\n${parts.join("\n")}`, parse_mode: "HTML" }).catch(() => undefined);
}

export async function closeDrop(id: string) {
  const client = await db();
  const d = await loadDrop(id);
  if (!d || d.status === "closed") return;
  await client.from("tg_drops").update({ status: "closed" }).eq("id", id).neq("status", "closed");
  const { data: entries } = await client.from("tg_drop_entries").select("tg_id, amount, choice, created_at").eq("drop_id", id);
  const winners = pickWinners(d.kind, (entries ?? []) as Entry[], d.winners_count);
  const { data: users } = winners.length ? await client.from("tg_users").select("tg_id, username, first_name, points").in("tg_id", winners) : { data: [] };
  for (const w of winners) {
    if (d.kind === "auction") {
      const bid = entries?.find((e) => e.tg_id === w)?.amount ?? 0;
      const u = users?.find((x) => x.tg_id === w);
      await client.from("tg_users").update({ points: Math.max(0, (u?.points ?? 0) - bid) }).eq("tg_id", w);
    }
    await grantPrize(d, w);
  }
  const names = winners.map((w) => { const u = users?.find((x) => x.tg_id === w); return u?.username ? `@${u.username}` : (u?.first_name ?? String(w)); });
  await client.from("tg_drops").update({ winners: names }).eq("id", id);
  const closed = { ...d, status: "closed" };
  await refreshPost(closed);
  const s = await settings();
  if (s.tg_channel) await tg("sendMessage", {
    chat_id: s.tg_channel, parse_mode: "HTML",
    text: `🏁 انتهى «${esc(d.title)}»\n${names.length ? `🏆 الفائزون: ${names.map(esc).join("، ")}` : "لا يوجد مشاركون"}`,
  }).catch(() => undefined);
}

/** Runs every minute: publish due scheduled drops, close expired ones. */
export async function tick() {
  const client = await db();
  const s = await settings();
  if (!s.tg_enabled) return { skipped: true };
  const now = new Date().toISOString();
  const { data: due } = await client.from("tg_drops").select("id").eq("status", "scheduled").lte("starts_at", now).limit(10);
  for (const d of due ?? []) await publishDrop(d.id).catch((e) => console.error("publish", e));
  const { data: ended } = await client.from("tg_drops").select("id").eq("status", "live").not("ends_at", "is", null).lte("ends_at", now).limit(10);
  for (const d of ended ?? []) await closeDrop(d.id).catch((e) => console.error("close", e));
  return { published: due?.length ?? 0, closed: ended?.length ?? 0 };
}

async function upsertUser(from: { id: number; username?: string; first_name?: string }) {
  const client = await db();
  const { data: existing } = await client.from("tg_users").select("*").eq("tg_id", from.id).maybeSingle();
  if (existing) {
    if (existing.username !== (from.username ?? null)) await client.from("tg_users").update({ username: from.username ?? null }).eq("tg_id", from.id);
    return { user: existing, isNew: false };
  }
  const { data } = await client.from("tg_users").insert({ tg_id: from.id, username: from.username ?? null, first_name: from.first_name ?? null }).select("*").single();
  return { user: data!, isNew: true };
}

function storeMenu(): Kb {
  return [
    [{ text: "🛒 الاشتراكات", callback_data: "plans" }],
    [{ text: "🎁 رابط الإحالة", callback_data: "ref" }, { text: "⭐ نقاطي", callback_data: "me" }],
    [{ text: "🥚 الدروبات الحالية", callback_data: "drops" }],
  ];
}

async function handleStart(chatId: number, from: { id: number; username?: string; first_name?: string }, arg: string) {
  const client = await db();
  const s = await settings();
  const { user, isNew } = await upsertUser(from);
  if (arg.startsWith("link_")) {
    const { data: t } = await client.from("tg_link_tokens").select("*").eq("token", arg.slice(5)).maybeSingle();
    if (t && new Date(t.expires_at) > new Date()) {
      await client.from("tg_users").update({ profile_id: t.profile_id }).eq("tg_id", from.id);
      await client.from("tg_link_tokens").delete().eq("token", t.token);
      await tg("sendMessage", { chat_id: chatId, text: "✅ تم ربط حسابك في الموقع بالبوت" });
    } else await tg("sendMessage", { chat_id: chatId, text: "رابط الربط منتهي، أنشئ رابطاً جديداً من صفحة حسابك" });
  }
  const refId = /^ref_(\d+)$/.exec(arg)?.[1];
  if (isNew && refId && Number(refId) !== from.id) {
    const { data: ref } = await client.from("tg_users").select("*").eq("tg_id", Number(refId)).maybeSingle();
    if (ref) {
      await client.from("tg_users").update({ referred_by: ref.tg_id }).eq("tg_id", from.id);
      await client.from("tg_users").update({ points: ref.points + s.tg_ref_points, referrals: ref.referrals + 1 }).eq("tg_id", ref.tg_id);
      if (ref.profile_id && s.tg_ref_credits > 0) {
        const { data: p } = await client.from("profiles").select("bonus_credits").eq("id", ref.profile_id).single();
        if (p) await client.from("profiles").update({ bonus_credits: p.bonus_credits + s.tg_ref_credits }).eq("id", ref.profile_id);
      }
      await tg("sendMessage", { chat_id: ref.tg_id, text: `🎉 انضم صديق عبر رابطك! +${s.tg_ref_points} نقطة` }).catch(() => undefined);
    }
  }
  void user;
  await tg("sendMessage", { chat_id: chatId, text: s.tg_store_text, reply_markup: { inline_keyboard: storeMenu() } });
}

async function isChannelMember(channel: string, userId: number) {
  try {
    const m = await tg<{ status: string }>("getChatMember", { chat_id: channel, user_id: userId });
    return !["left", "kicked"].includes(m.status);
  } catch { return false; }
}

async function handleCallback(q: { id: string; from: { id: number; username?: string; first_name?: string }; message?: { chat: { id: number } }; data?: string }) {
  const client = await db();
  const s = await settings();
  const answer = (text: string, alert = false) => tg("answerCallbackQuery", { callback_query_id: q.id, text, show_alert: alert }).catch(() => undefined);
  const { user } = await upsertUser(q.from);
  const data = q.data ?? "";
  const chatId = q.message?.chat.id ?? q.from.id;

  if (data === "plans") {
    const plans = (s.tg_plans as { plan: string; label: string; price: string }[]) ?? [];
    const contact = s.tg_contact.replace(/^@/, "");
    await tg("sendMessage", {
      chat_id: q.from.id, parse_mode: "HTML",
      text: `🛒 <b>خطط الاشتراك</b>\n\n${plans.map((p) => `• ${esc(p.label)} — ${esc(p.price)}`).join("\n")}\n\nللشراء تواصل مع الأدمن وسيرسل لك كود التفعيل.`,
      reply_markup: contact ? { inline_keyboard: [[{ text: "📞 تواصل مع الأدمن", url: `https://t.me/${contact}` }]] } : undefined,
    });
    return answer("");
  }
  if (data === "ref") {
    const link = `https://t.me/${s.tg_bot_username.replace(/^@/, "")}?start=ref_${q.from.id}`;
    await tg("sendMessage", { chat_id: q.from.id, text: `🎁 رابط الإحالة الخاص بك:\n${link}\n\nكل صديق ينضم = ${s.tg_ref_points} نقطة${s.tg_ref_credits ? ` + ${s.tg_ref_credits} رصيد في الموقع (للحسابات المربوطة)` : ""}` });
    return answer("");
  }
  if (data === "me") {
    await tg("sendMessage", { chat_id: q.from.id, text: `⭐ نقاطك: ${user.points}\n👥 إحالاتك: ${user.referrals}\n🔗 الموقع: ${user.profile_id ? "مربوط" : "غير مربوط"}` });
    return answer("");
  }
  if (data === "drops") {
    const { data: live } = await client.from("tg_drops").select("title, kind").eq("status", "live").limit(10);
    await tg("sendMessage", { chat_id: chatId, text: live?.length ? `🥚 الدروبات الحالية في القناة ${s.tg_channel}:\n${live.map((d) => `• ${d.title} (${DROP_KINDS[d.kind as keyof typeof DROP_KINDS]})`).join("\n")}` : "لا توجد دروبات حالياً" });
    return answer("");
  }

  const [action, dropId, arg] = data.split(":");
  if (!dropId || !["join", "bid", "vote"].includes(action ?? "")) return answer("");
  const d = await loadDrop(dropId);
  if (!d || d.status !== "live") return answer("هذا الدروب انتهى", true);
  const block = joinBlocker(d, user);
  if (block) return answer(block, true);
  if ((d.kind === "conditional" && d.require_channel) && !(await isChannelMember(s.tg_channel, q.from.id))) return answer("اشترك في القناة أولاً", true);
  const { data: existing } = await client.from("tg_drop_entries").select("*").eq("drop_id", d.id).eq("tg_id", q.from.id).maybeSingle();

  if (action === "bid") {
    const next = (existing?.amount ?? 0) + Number(arg ?? 1);
    if (next > user.points) return answer(`نقاطك (${user.points}) لا تكفي لهذه المزايدة`, true);
    if (existing) await client.from("tg_drop_entries").update({ amount: next }).eq("id", existing.id);
    else await client.from("tg_drop_entries").insert({ drop_id: d.id, tg_id: q.from.id, amount: next });
    await refreshPost(d);
    return answer(`مزايدتك الآن: ${next} نقطة`);
  }
  if (action === "vote") {
    const choice = Number(arg);
    if (existing) await client.from("tg_drop_entries").update({ choice }).eq("id", existing.id);
    else await client.from("tg_drop_entries").insert({ drop_id: d.id, tg_id: q.from.id, choice });
    await refreshPost(d);
    return answer("تم تسجيل صوتك ✅");
  }
  if (existing) return answer("أنت مشارك بالفعل ✅");
  const { error } = await client.from("tg_drop_entries").insert({ drop_id: d.id, tg_id: q.from.id });
  if (error) return answer("أنت مشارك بالفعل ✅");
  if (d.kind === "points") await client.from("tg_users").update({ points: user.points - d.entry_cost }).eq("tg_id", q.from.id);
  const count = await entryCount(d.id);
  if (d.kind === "sequential" && count >= d.winners_count) { await closeDrop(d.id); return answer("⚡ كنت من الأسرع!", true); }
  await refreshPost(d);
  return answer("تمت مشاركتك 🥚");
}

type Update = {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { id: number; username?: string; first_name?: string }; text?: string };
  callback_query?: Parameters<typeof handleCallback>[0];
};

export async function handleUpdate(u: Update) {
  const client = await db();
  const { error } = await client.from("tg_updates").insert({ update_id: u.update_id });
  if (error) return; // duplicate delivery
  const s = await settings();
  if (!s.tg_enabled) return;
  if (u.callback_query) return handleCallback(u.callback_query);
  const m = u.message;
  if (!m?.from || m.chat.type !== "private" || !m.text) return;
  const [cmd, arg = ""] = m.text.trim().split(/\s+/);
  if (cmd === "/start") return handleStart(m.chat.id, m.from, arg);
  if (cmd === "/stats" && parseAdminIds(s.tg_admin_ids).includes(m.from.id)) {
    const st = await dropStats();
    return tg("sendMessage", { chat_id: m.chat.id, text: `📊 المستخدمون: ${st.users}\nالدروبات: ${st.total} (حي ${st.live}، مجدول ${st.scheduled}، منتهي ${st.closed})\nالمشاركات: ${st.entries}` });
  }
  return tg("sendMessage", { chat_id: m.chat.id, text: s.tg_store_text, reply_markup: { inline_keyboard: storeMenu() } });
}

export async function dropStats() {
  const client = await db();
  const [{ count: users }, { count: entries }, { data: drops }] = await Promise.all([
    client.from("tg_users").select("*", { count: "exact", head: true }),
    client.from("tg_drop_entries").select("*", { count: "exact", head: true }),
    client.from("tg_drops").select("status, kind"),
  ]);
  const by = (k: string) => (drops ?? []).filter((d) => d.status === k).length;
  const kinds: Record<string, number> = {};
  for (const d of drops ?? []) kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
  return { users: users ?? 0, entries: entries ?? 0, total: drops?.length ?? 0, live: by("live"), scheduled: by("scheduled"), closed: by("closed"), kinds };
}
