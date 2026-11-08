import { adminIdsOf, canManage, db, esc, logBot, notify, type S } from "./telegram.core";

export async function openSupport(tgId: number, s: S) {
  if (!s.tg_support_enabled) return notify(tgId, "الدعم متوقف مؤقتاً.");
  const client = await db();
  const { data: existing } = await client.from("tg_tickets").select("id").eq("tg_id", tgId).eq("status", "open").limit(1).maybeSingle();
  if (!existing) {
    const { error } = await client.from("tg_tickets").insert({ tg_id: tgId, subject: "دعم من البوت" });
    if (error) throw new Error("تعذّر فتح تذكرة الدعم");
  }
  await notify(tgId, "🛟 تذكرة الدعم مفتوحة؛ أرسل رسالتك هنا.", [[{ text: "إغلاق التذكرة", callback_data: "support:close" }]]);
}

export async function supportMessage(tgId: number, text: string, s: S): Promise<boolean> {
  const client = await db();
  const reply = /^\/reply\s+([\da-f-]{36})\s+([\s\S]+)$/i.exec(text);
  if (reply) {
    if (!(await canManage(tgId, "support"))) return true;
    const ticketId = reply[1]; const body = reply[2];
    if (!ticketId || !body) return true;
    const { data: ticket } = await client.from("tg_tickets").select("tg_id,status").eq("id", ticketId).maybeSingle();
    if (!ticket || ticket.status !== "open") { await notify(tgId, "التذكرة غير متاحة."); return true; }
    const { error } = await client.from("tg_ticket_msgs").insert({ ticket_id: ticketId, text: body.slice(0, 3000), from_admin: true });
    if (error) throw new Error("تعذّر حفظ الرد");
    await notify(ticket.tg_id, `🛟 <b>رد الدعم</b>\n${esc(body.slice(0, 3000))}`);
    await logBot(tgId, "support_reply", ticketId);
    await notify(tgId, "تم إرسال الرد.");
    return true;
  }
  if (!s.tg_support_enabled || text.startsWith("/")) return false;
  const { data: ticket } = await client.from("tg_tickets").select("id").eq("tg_id", tgId).eq("status", "open").limit(1).maybeSingle();
  if (!ticket) return false;
  const { error } = await client.from("tg_ticket_msgs").insert({ ticket_id: ticket.id, text: text.slice(0, 3000) });
  if (error) throw new Error("تعذّر حفظ رسالة الدعم");
  for (const admin of adminIdsOf(s)) await notify(admin, `🛟 تذكرة <code>${ticket.id}</code>\nمستخدم: ${tgId}\n${esc(text.slice(0, 2500))}\n\nللرد: <code>/reply ${ticket.id} نص الرد</code>`);
  await notify(tgId, "✅ وصلت رسالتك للدعم.");
  return true;
}

export async function closeSupport(tgId: number) {
  const { error } = await (await db()).from("tg_tickets").update({ status: "closed", closed_at: new Date().toISOString() }).eq("tg_id", tgId).eq("status", "open");
  if (error) throw new Error("تعذّر إغلاق التذكرة");
  await notify(tgId, "تم إغلاق تذكرتك.");
}