import { db, esc, notify, type S, type Kb } from "./telegram.core";
import type { TGUser } from "./telegram.user";

type Plan = { plan: string; label: string; price: string };
function catalog(s: S): Plan[] {
  return Array.isArray(s.tg_plans) ? s.tg_plans.flatMap((p) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) return [];
    return typeof p['plan'] === "string" && typeof p['label'] === "string" && typeof p['price'] === "string" ? [{ plan: p['plan'], label: p['label'], price: p['price'] }] : [];
  }) : [];
}

export async function shopAction(user: TGUser, action: string, s: S): Promise<boolean> {
  const client = await db();
  const plans = catalog(s);
  if (action === "plans") {
    const keyboard: Kb = plans.map((p, i) => [{ text: `${p.label} — ${p.price}`, callback_data: `cart:add:${i}` }]);
    keyboard.push([{ text: "🛍️ سلة الشراء", callback_data: "cart:show" }, { text: "🧾 طلباتي", callback_data: "orders" }]);
    await notify(user.tg_id, "🛒 <b>الاشتراكات</b>", keyboard);
    return true;
  }
  if (action === "orders") {
    const { data } = await client.from("tg_orders").select("id,label,status,price,gift_code").eq("tg_id", user.tg_id).order("created_at", { ascending: false }).limit(10);
    await notify(user.tg_id, data?.length ? data.map((o) => `🧾 ${esc(o.label)} — ${esc(o.price)}\n${o.status === "paid" ? "✅ مدفوع" : o.status === "cancelled" ? "ملغى" : "⏳ بانتظار التأكيد"}${o.gift_code ? `\n<code>${esc(o.gift_code)}</code>` : ""}`).join("\n\n") : "لا توجد طلبات بعد.");
    return true;
  }
  if (!action.startsWith("cart:")) return false;
  const { data: cart } = await client.from("tg_cart").select("items").eq("tg_id", user.tg_id).maybeSingle();
  const items = Array.isArray(cart?.items) ? cart.items.filter((i): i is string => typeof i === "string") : [];
  if (action.startsWith("cart:add:")) {
    const index = Number(action.split(":")[2]);
    const plan = Number.isInteger(index) ? plans[index] : undefined;
    if (!plan) return true;
    if (items.length >= 10) { await notify(user.tg_id, "السلة ممتلئة."); return true; }
    items.push(plan.plan);
    const { error } = await client.from("tg_cart").upsert({ tg_id: user.tg_id, items });
    if (error) throw new Error("تعذّر حفظ السلة");
  } else if (action === "cart:clear") {
    const { error } = await client.from("tg_cart").upsert({ tg_id: user.tg_id, items: [] });
    if (error) throw new Error("تعذّر تفريغ السلة");
    items.length = 0;
  } else if (action === "cart:checkout") {
    if (!items.length) { await notify(user.tg_id, "السلة فارغة."); return true; }
    const contact = s.tg_contact.replace(/^@/, "");
    if (!contact) { await notify(user.tg_id, "لم يُضبط التواصل للشراء بعد."); return true; }
    const { data: result, error } = await client.rpc("tg_checkout", { p_tg_id: user.tg_id });
    if (error) throw new Error("تعذّر إنشاء الطلب");
    const orders = Array.isArray(result) ? result.flatMap((o) => o && typeof o === "object" && !Array.isArray(o) && typeof o['id'] === "string" && typeof o['label'] === "string" ? [{ id: o['id'], label: o['label'] }] : []) : [];
    if (!orders.length) { await notify(user.tg_id, "السلة فارغة أو تم تسجيل الطلب بالفعل."); return true; }
    await notify(user.tg_id, `🧾 تم تسجيل طلبك، بانتظار تأكيد الدفع من الأدمن.\n${orders.map((o) => `${esc(o.label)}: <code>${o.id}</code>`).join("\n")}`, [[{ text: "📞 إتمام الشراء", url: `https://t.me/${contact}` }]]);
    return true;
  }
  await notify(user.tg_id, items.length ? `🛍️ <b>سلتك</b>\n${items.map((key) => { const p = plans.find((x) => x.plan === key); return p ? `${esc(p.label)} — ${esc(p.price)}` : esc(key); }).join("\n")}` : "🛍️ السلة فارغة", [[{ text: "إتمام الطلب", callback_data: "cart:checkout" }, { text: "تفريغ السلة", callback_data: "cart:clear" }], [{ text: "الاشتراكات", callback_data: "plans" }]]);
  return true;
}