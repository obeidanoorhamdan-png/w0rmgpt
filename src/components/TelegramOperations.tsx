import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { tgOperations, tgModerate, tgTicketReply, tgOrderAction, tgTicketMessages } from "@/lib/telegram.functions";

export function TelegramOperations({ token }: { token: string }) {
  const load = useServerFn(tgOperations);
  const moderate = useServerFn(tgModerate);
  const reply = useServerFn(tgTicketReply);
  const orderAction = useServerFn(tgOrderAction);
  const ticketMessages = useServerFn(tgTicketMessages);
  const [data, setData] = useState<Awaited<ReturnType<typeof tgOperations>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [days, setDays] = useState<Record<string, number>>({});
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof tgTicketMessages>>>([]);
  const refresh = useCallback(async () => setData(await load({ data: { token } })), [load, token]);
  useEffect(() => { refresh().catch((e: Error) => toast.error(e.message)); }, [refresh]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await refresh(); toast.success("تم حفظ العملية"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  async function viewTicket(id: string) {
    setBusy(true);
    try { setMessages(await ticketMessages({ data: { token, id } })); setOpenTicket(id); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  if (!data) return <p className="text-muted-foreground">جارٍ تحميل إدارة البوت…</p>;
  return <Tabs defaultValue="orders" dir="rtl" className="min-w-0 border-t pt-4">
    <TabsList className="flex h-auto flex-wrap justify-start gap-1">
      <TabsTrigger value="orders" className="min-h-11">الطلبات ({data.orders.length})</TabsTrigger>
      <TabsTrigger value="support" className="min-h-11">الدعم ({data.tickets.filter((t) => t.status === "open").length})</TabsTrigger>
      <TabsTrigger value="users" className="min-h-11">المستخدمون</TabsTrigger>
      <TabsTrigger value="log" className="min-h-11">سجل الإدارة</TabsTrigger>
    </TabsList>
    <TabsContent value="orders" className="divide-y">
      {!data.orders.length && <p className="py-4 text-sm text-muted-foreground">لا توجد طلبات بعد</p>}
      {data.orders.map((o) => <div key={o.id} className="space-y-2 py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{o.label} · {o.price}</strong><span>{o.status === "paid" ? "مدفوع" : o.status === "cancelled" ? "ملغى" : "بانتظار التأكيد"}</span></div><div className="break-all text-xs text-muted-foreground">{o.tg_id} · {o.id}</div>{o.status === "pending" && <div className="flex flex-wrap items-end gap-2"><label className="space-y-1">مدة الاشتراك (أيام)<Input className="w-32" type="number" min={1} max={3650} value={days[o.id] ?? 30} onChange={(e) => setDays({ ...days, [o.id]: Number(e.target.value) })} /></label><Button disabled={busy} onClick={() => confirm("هل تأكدت من استلام الدفع؟ سيتم إصدار كود الاشتراك.") && run(async () => { const r = await orderAction({ data: { token, id: o.id, action: "confirm", days: days[o.id] ?? 30 } }); if (!r.delivered) toast.warning("تم تأكيد الطلب؛ تعذّر إرسال الرسالة، والكود محفوظ في سجل طلبات المستخدم."); })}>تأكيد الدفع وإصدار الكود</Button><Button variant="outline" disabled={busy} onClick={() => confirm("إلغاء هذا الطلب؟") && run(() => orderAction({ data: { token, id: o.id, action: "cancel", days: 30 } }))}>إلغاء الطلب</Button></div>}</div>)}
    </TabsContent>
    <TabsContent value="support" className="divide-y">
      {!data.tickets.length && <p className="py-4 text-sm text-muted-foreground">لا توجد تذاكر دعم</p>}
      {data.tickets.map((t) => <div key={t.id} className="space-y-2 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{t.subject} · {t.tg_id} · {t.status === "open" ? "مفتوحة" : "مغلقة"}</span><Button variant="outline" disabled={busy} onClick={() => viewTicket(t.id)}>عرض الرسائل</Button></div>{openTicket === t.id && <div className="space-y-3 border-s-2 ps-3">{!messages.length && <p className="text-muted-foreground">لا توجد رسائل بعد</p>}{messages.map((m) => <div key={m.id} className="space-y-1"><strong className="text-xs text-muted-foreground">{m.from_admin ? "الدعم" : "المستخدم"} · {new Date(m.created_at).toLocaleString("ar")}</strong><p className="whitespace-pre-wrap break-words">{m.text}</p></div>)}</div>}{t.status === "open" && <div className="flex flex-wrap gap-2"><Input className="min-w-0 basis-full sm:basis-auto sm:flex-1" placeholder="رد الدعم" aria-label={`رد التذكرة ${t.id}`} value={replies[t.id] ?? ""} onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })} /><Button disabled={busy || !replies[t.id]?.trim()} onClick={() => run(async () => { await reply({ data: { token, id: t.id, text: replies[t.id] ?? "" } }); setReplies({ ...replies, [t.id]: "" }); if (openTicket === t.id) setMessages(await ticketMessages({ data: { token, id: t.id } })); })}>إرسال</Button><Button variant="outline" disabled={busy} onClick={() => run(() => reply({ data: { token, id: t.id, text: "", close: true } }))}>إغلاق</Button></div>}</div>)}
    </TabsContent>
    <TabsContent value="users" className="divide-y">
      {!data.users.length && <p className="py-4 text-sm text-muted-foreground">لا يوجد مستخدمون بعد</p>}
      {data.users.map((u) => <div key={u.tg_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0 break-all"><strong>{u.first_name ?? u.username ?? u.tg_id}</strong><div className="text-xs text-muted-foreground">{u.tg_id} · {u.points} نقطة · {u.referrals} إحالة</div></div><Button variant={u.banned ? "outline" : "destructive"} disabled={busy} onClick={() => run(() => moderate({ data: { token, tgId: u.tg_id, banned: !u.banned } }))}>{u.banned ? "إلغاء الحظر" : "حظر"}</Button></div>)}
    </TabsContent>
    <TabsContent value="log" className="divide-y">{!data.log.length && <p className="py-4 text-sm text-muted-foreground">لا توجد عمليات مسجلة</p>}{data.log.map((l) => <div key={l.id} className="break-all py-3 text-sm">{l.action} · {l.detail}<div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar")}</div></div>)}</TabsContent>
  </Tabs>;
}