// Server-only Telegram user layer: identity, captcha, profile, daily rewards, bot chat + images.
import {
  addPoints, asJson, awardBadge, channelsOf, db, esc, notify, settings, sha256hex, tg, today,
  type Kb, type S,
} from "./telegram.core";
import {
  dupKeyOf, hasClaimed, makeCaptcha, pickPrize, pointsToDays, nextStreak, streakBonus, tierReward,
} from "./drops";

export type TGUser = Record<string, any>;
type From = { id: number; username?: string; first_name?: string; is_bot?: boolean };

export async function upsertUser(from: From) {
  const client = await db();
  const { data: existing } = await client.from("tg_users").select("*").eq("tg_id", from.id).maybeSingle();
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (existing.username !== (from.username ?? null)) patch.username = from.username ?? null;
    if (existing.first_name !== (from.first_name ?? null)) patch.first_name = from.first_name ?? null;
    patch.last_seen_at = new Date().toISOString();
    await client.from("tg_users").update(patch).eq("tg_id", from.id);
    return { user: { ...existing, ...patch } as TGUser, isNew: false };
  }
  const dup = dupKeyOf(from);
  const { data } = await client.from("tg_users").insert({
    tg_id: from.id, username: from.username ?? null, first_name: from.first_name ?? null, dup_key: dup,
  }).select("*").single();
  return { user: data as TGUser, isNew: true };
}

/** New accounts prove they are human with a 4-letter code before the store opens. */
export async function needsCaptcha(user: TGUser, s: S, chatId: number) {
  if (!s.tg_captcha_enabled || user.captcha_code) return false;
  const code = makeCaptcha();
  await (await db()).from("tg_users").update({ captcha_code: code, captcha_expires: new Date(Date.now() + 600_000).toISOString() })
    .eq("tg_id", user.tg_id);
  await notify(chatId, `🤖 تحقق سريع: اكتب <b>${code}</b> لتأكيد أنك إنسان.\nصلاحية الكود 10 دقائق.`);
  return true;
}

export async function checkCaptcha(chatId: number, text: string) {
  const client = await db();
  const { data: u } = await client.from("tg_users").select("captcha_code, captcha_expires").eq("tg_id", chatId).maybeSingle();
  if (!u?.captcha_code) return null;
  if (!new Date(u.captcha_expires).getTime() || new Date(u.captcha_expires) < new Date()) {
    await checkCaptchaReset(chatId);
    return "expired";
  }
  if (text.trim().toUpperCase() !== u.captcha_code) return "wrong";
  await client.from("tg_users").update({ captcha_code: null, captcha_expires: null }).eq("tg_id", chatId);
  await awardBadge(chatId, "first_ref").catch(() => undefined);
  return "ok";
}

async function checkCaptchaReset(chatId: number) {
  const code = makeCaptcha();
  await (await db()).from("tg_users").update({ captcha_code: code, captcha_expires: new Date(Date.now() + 600_000).toISOString() })
    .eq("tg_id", chatId);
  await notify(chatId, `انتهت صلاحية التحقق. اكتب <b>${code}</b> من جديد.`);
}

/** Force-join channels before the bot is usable. */
export async function channelGate(chatId: number, userId: number, s: S): Promise<boolean> {
  const required = asJson<string[]>(s.tg_require_channels, []).map((c) => String(c).trim()).filter(Boolean);
  if (!required.length) return true;
  const missing: string[] = [];
  for (const c of required) {
    try {
      const m = await tg<{ status: string }>("getChatMember", { chat_id: c, user_id: userId });
      if (["left", "kicked"].includes(m.status)) missing.push(c);
    } catch { missing.push(c); }
  }
  if (!missing.length) return true;
  await notify(chatId, "📌 اشترك في القنوات المطلوبة أولا:", missing.map((c) => [{ text: c, url: `https://t.me/${c.replace(/^@/, "")}` }]));
  return false;
}

export async function isChannelMember(channel: string, userId: number) {
  if (!channel) return true;
  try {
    const m = await tg<{ status: string }>("getChatMember", { chat_id: channel, user_id: userId });
    return !["left", "kicked"].includes(m.status);
  } catch { return false; }
}

// ---------- profile, badges, language, notifications ----------

export async function badgesOf(tgId: number) {
  const { data } = await (await db()).from("tg_user_badges")
    .select("badge_key, tg_badges(title, emoji, description)").eq("tg_id", tgId).order("earned_at");
  return (data ?? []) as { badge_key: string; tg_badges: { title: string; emoji: string; description: string } | null }[];
}

export async function profileText(user: TGUser) {
  const badges = await badgesOf(user.tg_id);
  const tier = tierReward(1, user.referrals) > 1 ? ` (مكافأة ×${tierReward(1, user.referrals)})` : "";
  return [
    `👤 <b>${esc(user.first_name ?? user.username ?? user.tg_id)}</b>`,
    `⭐ النقاط: ${user.points}`,
    `👥 الإحالات: ${user.referrals}${tier}`,
    `💎 الرصيد: ${user.paid ? "مشترك مدفوع" : "مجاني"}`,
    `🏅 الشارات: ${badges.length ? badges.map((b) => `${b.tg_badges?.emoji ?? "🏅"} ${esc(b.tg_badges?.title ?? "")}`).join("، ") : "لا توجد بعد"}`,
    `🔗 الموقع: ${user.profile_id ? "مربوط" : "غير مربوط"}`,
    `🔔 الإشعارات: ${user.notifications_on ? "مفعلة" : "متوقفة"}`,
    `🌐 اللغة: ${user.language === "en" ? "English" : "عربية"}`,
  ].join("\n");
}

export async function setLanguage(tgId: number, lang: "ar" | "en") {
  await (await db()).from("tg_users").update({ language: lang }).eq("tg_id", tgId);
  await notify(tgId, lang === "en" ? "✅ Language set to English." : "✅ تم ضبط اللغة على العربية.");
}

export async function toggleNotifications(tgId: number, on: boolean) {
  await (await db()).from("tg_users").update({ notifications_on: on }).eq("tg_id", tgId);
  await notify(tgId, on ? "🔔 مفعّلت إشعارات الدروبات." : "🔕 أوقفت الإشعارات.");
}

// ---------- daily box, streak, wheel ----------

export async function claimDailyBox(user: TGUser, s: S) {
  const day = today();
  if (hasClaimed(user.last_box_at, day)) return notify(user.tg_id, "✅ أخذت صندوق اليوم، تعال غداً.");
  const prize = pickPrize(asJson<{ points: number; weight?: number }[]>(s.tg_daily_box, [{ points: 10 }])) ?? { points: 10 };
  const streak = nextStreak(user.last_checkin ?? null, day, user.streak ?? 0);
  const bonus = streakBonus(asJson<{ days: number; points: number }[]>(s.tg_streak_bonus, []), streak);
  await (await db()).from("tg_users").update({ last_box_at: day, last_checkin: day, streak }).eq("tg_id", user.tg_id);
  await addPoints(user.tg_id, prize.points + bonus, "daily_box", `صندوق اليوم + سلسلة ${streak}`);
  if (streak >= 7) await awardBadge(user.tg_id, "streak_7");
  await notify(user.tg_id, `🎁 صندوق اليوم: +${prize.points} نقطة\n🔥 سلسلتك: ${streak} يوم${bonus ? ` (+${bonus} مكافأة)` : ""}`);
}

export async function spinWheel(user: TGUser, s: S) {
  const day = today();
  if (hasClaimed(user.last_spin_at, day)) return notify(user.tg_id, "🎡 لفتة اليوم مستخدمة، ارجع غداً.");
  const prizes = asJson<{ points: number; weight?: number }[]>(s.tg_spin_prizes, [{ points: 5 }]);
  const prize = pickPrize(prizes) ?? { points: 5 };
  await (await db()).from("tg_users").update({ last_spin_at: day }).eq("tg_id", user.tg_id);
  await addPoints(user.tg_id, prize.points, "spin", "عجلة الحظ");
  await notify(user.tg_id, `🎡 العجلة وقفت على: <b>+${prize.points} نقطة</b>`, [[{ text: "🎁 صندوق اليوم", callback_data: "box" }]]);
}

/** Exchange points for subscription days on the linked site account. */
export async function exchangeDays(user: TGUser, s: S, days: number) {
  const rate = Number(s.tg_points_per_day) || 100;
  const cost = days * rate;
  if (days < 1) return notify(user.tg_id, "اختر يوما واحدا على الأقل.");
  if (user.points < cost) return notify(user.tg_id, `تحتاج ${cost} نقطة (${rate} نقطة لكل يوم).`);
  if (!user.profile_id) return notify(user.tg_id, "اربط حسابك في الموقع أولا من صفحة «حسابي».");
  const code = "WORM-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  const client = await db();
  await client.from("gift_codes").insert({ code, plan: s.tg_trial_plan || "plus", days, max_uses: 1 });
  await addPoints(user.tg_id, -cost, "exchange", `${days} يوم اشتراك`);
  await notify(user.tg_id, `🎟️ كود ${days} يوم: <code>${code}</code>\nاستخدمه في الموقع من صفحة الاشتراك.`);
}

// ---------- AI inside the bot ----------

/** Charge the linked site account first, otherwise bot points. */
async function chargeChat(user: TGUser, s: S): Promise<string | null> {
  if (user.profile_id) {
    const client = await db();
    const { data: p } = await client.from("profiles").select("credits, bonus_credits, plan, plan_expires_at, suspended, last_daily_grant")
      .eq("id", user.profile_id).maybeSingle();
    if (!p) return "حساب الموقع غير موجود.";
    if (p.suspended) return "حسابك في الموقع موقوف.";
    const day = today();
    if (String(p.last_daily_grant) < day) {
      await client.from("profiles").update({ credits: s.daily_credits, last_daily_grant: day }).eq("id", user.profile_id);
      p.credits = s.daily_credits;
    }
    const unlimited = p.plan !== "free" && p.plan_expires_at && new Date(p.plan_expires_at) > new Date();
    if (!unlimited && p.credits + p.bonus_credits <= 0) return "نفدت نقاطك في الموقع. تتجدد غداً.";
    if (!unlimited) {
      if (p.credits > 0) await client.from("profiles").update({ credits: p.credits - 1 }).eq("id", user.profile_id);
      else await client.from("profiles").update({ bonus_credits: p.bonus_credits - 1 }).eq("id", user.profile_id);
    }
    return null;
  }
  const cost = 20;
  if (user.points < cost) return `الدردشة في البوت تكلّف ${cost} نقطة، ونقاطك ${user.points}.`;
  await addPoints(user.tg_id, -cost, "bot_chat", "دردشة WORM GPT");
  return null;
}

export async function botChat(user: TGUser, text: string, s: S) {
  const problem = await chargeChat(user, s);
  if (problem) return notify(user.tg_id, esc(problem));
  const { resolveKey } = await import("./admin.server");
  const key = resolveKey(s.api_key_override);
  if (!key) return notify(user.tg_id, "خدمة الذكاء الاصطناعي غير مهيأة.");
  await notify(user.tg_id, "⏳ أفكر…");
  try {
    const r = await fetch(`${String(s.api_url).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: s.default_model,
        messages: [
          { role: "system", content: `${s.system_prompt}\n\nرد باختصار مناسب لمحادثات تيلجرام.` },
          { role: "user", content: text.slice(0, 4000) },
        ],
      }),
    });
    const body = await r.text();
    if (!r.ok) return notify(user.tg_id, `❌ ${body.slice(0, 300)}`);
    const j = JSON.parse(body) as { choices?: { message?: { content?: string } }[] };
    const out = j.choices?.[0]?.message?.content ?? "لا يوجد رد.";
    for (const chunk of splitForTelegram(out)) await notify(user.tg_id, esc(chunk));
    await awardBadge(user.tg_id, "first_ref").catch(() => undefined);
  } catch (e) {
    await notify(user.tg_id, `تعذّر الاتصال بالخدمة: ${esc((e as Error).message)}`);
  }
}

export function splitForTelegram(text: string, size = 3500) {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.length ? out : [""];
}

/** Generate an image inside the bot using the same gateway the site uses. */
export async function botImage(user: TGUser, prompt: string, s: S) {
  const cost = 60;
  if (user.points < cost) return notify(user.tg_id, `توليد صورة يكلّف ${cost} نقطة، ونقاطك ${user.points}.`);
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return notify(user.tg_id, "خدمة الصور غير مهيأة.");
  await addPoints(user.tg_id, -cost, "bot_image", "صورة من البوت");
  await notify(user.tg_id, "🎨 أرسم الآن… قد يستغرق لحظة.");
  try {
    const { generateImage, imageSettings } = await import("./image-gateway.server");
    const up = await generateImage({ ...imageSettings, apiKey: key }, prompt.slice(0, 2000), false);
    if (!up.ok) return notify(user.tg_id, `❌ ${esc((await up.text()).slice(0, 300))}`);
    const j = (await up.json()) as { data?: { b64_json?: string; url?: string }[] };
    const img = j.data?.[0];
    const url = img?.url ?? (img?.b64_json ? await publishBase64(img.b64_json) : null);
    if (!url) return notify(user.tg_id, "لم ترجع الخدمة صورة صالحة.");
    const { notifyPhoto } = await import("./telegram.core");
    await notifyPhoto(user.tg_id, url, `🎨 ${esc(prompt.slice(0, 200))}`, [[{ text: "🖼️ صورة أخرى", callback_data: "img" }]]);
  } catch (e) {
    await notify(user.tg_id, `تعذّر توليد الصورة: ${esc((e as Error).message)}`);
  }
}

/** Put a base64 image in site storage so Telegram can fetch it. */
async function publishBase64(b64: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const client = await db();
  const path = `bot/${crypto.randomUUID()}.png`;
  const { error } = await client.storage.from("worm-media").upload(path, bytes, { contentType: "image/png" });
  if (error) return null;
  const { data } = client.storage.from("worm-media").getPublicUrl(path);
  return data.publicUrl;
}

/** Referral reward with the referrer's tier multiplier, plus the site-credit part. */
export async function payReferralReward(ref: TGUser, s: S, newId: number) {
  const points = tierReward(Number(s.tg_ref_points) || 1, ref.referrals ?? 0);
  await (await db()).from("tg_users").update({ referred_by: ref.tg_id }).eq("tg_id", newId);
  await (await db()).from("tg_users").update({ referrals: (ref.referrals ?? 0) + 1 }).eq("tg_id", ref.tg_id);
  await addPoints(ref.tg_id, points, "referral", `إحالة جديدة ${newId}`);
  const credits = Number(s.tg_ref_credits) || 0;
  if (credits && ref.profile_id) {
    const { data: p } = await (await db()).from("profiles").select("bonus_credits").eq("id", ref.profile_id).maybeSingle();
    if (p) await (await db()).from("profiles").update({ bonus_credits: p.bonus_credits + credits }).eq("id", ref.profile_id);
  }
  await awardBadge(ref.tg_id, "first_ref");
  if ((ref.referrals ?? 0) + 1 >= 10) await awardBadge(ref.tg_id, "ref_10");
  await notify(ref.tg_id, `🎉 انضم صديق عبر رابطك! +${points} نقطة${credits && ref.profile_id ? ` + ${credits} رصيد في الموقع` : ""}`);
  return points;
}

/** Two-level referral: a smaller cut when someone your invitee invited joins. */
export async function paySecondLevel(ref: TGUser, s: S) {
  if (!s.tg_ref_two_levels || !ref.referred_by) return;
  const { data: top } = await (await db()).from("tg_users").select("tg_id, points, referrals, profile_id")
    .eq("tg_id", ref.referred_by).maybeSingle();
  if (!top) return;
  const points = Math.max(1, Math.round((Number(s.tg_ref_points) || 1) / 2));
  await addPoints(top.tg_id, points, "referral_l2", `صديق صديقك ${ref.tg_id}`);
  await notify(top.tg_id, `🎯 صديق من شبكة إحالتك انضم: +${points} نقطة`);
}

/** Guard against throwaway accounts farming referrals. */
export async function fakeReferral(ref: TGUser, newcomer: { created_at: string }, s: S) {
  if (!s.tg_ref_anti_fake) return false;
  if (newcomer.is_bot) return true;
  const age = Date.now() - new Date(newcomer.created_at).getTime();
  if (age < 60_000) return true;
  const { count } = await (await db()).from("tg_users").select("*", { count: "exact", head: true })
    .eq("referred_by", ref.tg_id).eq("paid", false).gt("created_at", new Date(Date.now() - 3600_000).toISOString());
  return (count ?? 0) >= 5;
}

export async function dropAlertTargets(s: S) {
  if (!s.tg_notify_new_drop) return [];
  const { data } = await (await db()).from("tg_users").select("tg_id").eq("notifications_on", true).eq("banned", false).limit(5000);
  return (data ?? []).map((u: { tg_id: number }) => u.tg_id);
}

export const MAIN_MENU: Kb = [
  [{ text: "🛒 الاشتراكات", callback_data: "plans" }, { text: "🛍️ سلة الشراء", callback_data: "cart:show" }],
  [{ text: "🥚 الدروبات", callback_data: "drops" }, { text: "🎁 الإحالة", callback_data: "ref" }],
  [{ text: "🎡 العجلة", callback_data: "spin" }, { text: "📦 الصندوق اليومي", callback_data: "box" }],
  [{ text: "👤 حسابي", callback_data: "me" }, { text: "🛟 الدعم", callback_data: "support" }],
];

export const REPLY_KEYBOARD: { text: string }[][] = [
  [{ text: "🛒 الاشتراكات" }, { text: "🥚 الدروبات" }],
  [{ text: "🎡 العجلة" }, { text: "📦 الصندوق" }],
  [{ text: "👤 حسابي" }, { text: "🛟 الدعم" }],
];

export async function registerMenus(botName: string) {
  await tg("setMyCommands", {
    commands: [
      { command: "start", description: "افتح المتجر" },
      { command: "plans", description: "خطط الاشتراك" },
      { command: "drops", description: "الدروبات الحالية" },
      { command: "me", description: "نقاطي وحسابي" },
      { command: "ref", description: "رابط الإحالة" },
      { command: "support", description: "الدعم الفني" },
      { command: "stats", description: "إحصائيات (أدمن)" },
    ],
  }).catch(() => undefined);
  void botName;
}
