import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DROP_KINDS, type DropKind } from "@/lib/drops";
import { tgOverview, tgSaveSettings, tgRegisterWebhook, tgCreateDrop, tgDropAction } from "@/lib/telegram.functions";

type Data = Awaited<ReturnType<typeof tgOverview>>;
const STATUS: Record<string, string> = { scheduled: "مجدول", live: "حي", closed: "منتهي" };

const emptyDrop = {
  kind: "normal" as DropKind, title: "", description: "", prize_plan: "plus" as "plus" | "pro" | "ultra" | null,
  prize_days: 7, prize_credits: 0, winners_count: 1, entry_cost: 0, min_points: 0, min_referrals: 0,
  require_channel: false, vote_options: "", starts_at: "", ends_at: "",
};

export function TelegramAdmin({ token }: { token: string }) {
  const load = useServerFn(tgOverview);
  const save = useServerFn(tgSaveSettings);
  const hook = useServerFn(tgRegisterWebhook);
  const create = useServerFn(tgCreateDrop);
  const act = useServerFn(tgDropAction);
  const [data, setData] = useState<Data | null>(null);
  const [s, setS] = useState<Data["settings"] | null>(null);
  const [plans, setPlans] = useState("");
  const [drop, setDrop] = useState(emptyDrop);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const d = await load({ data: { token } });
    setData(d); setS(d.settings);
    setPlans(((d.settings.tg_plans as { plan: string; label: string; price: string }[]) ?? []).map((p) => `${p.plan}|${p.label}|${p.price}`).join("\n"));
  }, [load, token]);
  useEffect(() => { refresh().catch((e: Error) => toast.error(e.message)); }, [refresh]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  if (!data || !s) return <p className="p-4 text-muted-foreground">جارٍ التحميل…</p>;
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS({ ...s, [k]: v });
  const d = drop;
  const setD = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setDrop({ ...d, [k]: v });
  const list = data.drops.filter((x) => filter === "all" || x.status === filter);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["مستخدمو البوت", data.stats.users], ["كل الدروبات", data.stats.total], ["حي / مجدول", `${data.stats.live} / ${data.stats.scheduled}`], ["المشاركات", data.stats.entries]].map(([l, v]) => (
          <div key={String(l)} className="glass rounded-xl border p-4"><div className="text-2xl font-black">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
        ))}
      </div>
      <div className="glass flex flex-wrap gap-2 rounded-xl border p-3 text-xs">
        {Object.entries(DROP_KINDS).map(([k, l]) => <span key={k} className="rounded-full border px-3 py-1">{l}: {data.stats.kinds[k] ?? 0}</span>)}
      </div>

      <section className="glass space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">إعدادات البوت والمتجر</h3>
          <label className="flex items-center gap-2 text-sm">تشغيل <Switch checked={s.tg_enabled} onCheckedChange={(v) => set("tg_enabled", v)} /></label>
        </div>
        {!data.connected && <p className="text-sm text-destructive">البوت غير مربوط بعد.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">يوزر البوت<Input dir="ltr" placeholder="@MyStoreBot" value={s.tg_bot_username} onChange={(e) => set("tg_bot_username", e.target.value)} /></label>
          <label className="space-y-1 text-sm">قناة النشر (البوت مشرف فيها)<Input dir="ltr" placeholder="@mychannel" value={s.tg_channel} onChange={(e) => set("tg_channel", e.target.value)} /></label>
          <label className="space-y-1 text-sm">أيدي الأدمن (مفصولة بفواصل)<Input dir="ltr" placeholder="123456789" value={s.tg_admin_ids} onChange={(e) => set("tg_admin_ids", e.target.value)} /></label>
          <label className="space-y-1 text-sm">يوزر التواصل للشراء<Input dir="ltr" placeholder="@admin" value={s.tg_contact} onChange={(e) => set("tg_contact", e.target.value)} /></label>
          <label className="space-y-1 text-sm">نقاط لكل إحالة<Input type="number" value={s.tg_ref_points} onChange={(e) => set("tg_ref_points", Number(e.target.value))} /></label>
          <label className="space-y-1 text-sm">رصيد موقع لكل إحالة<Input type="number" value={s.tg_ref_credits} onChange={(e) => set("tg_ref_credits", Number(e.target.value))} /></label>
        </div>
        <label className="block space-y-1 text-sm">رسالة الترحيب<Textarea value={s.tg_store_text} onChange={(e) => set("tg_store_text", e.target.value)} /></label>
        <label className="block space-y-1 text-sm">الخطط (سطر لكل خطة: plan|الاسم|السعر)<Textarea dir="ltr" value={plans} onChange={(e) => setPlans(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => run(() => save({ data: { token, patch: {
            tg_enabled: s.tg_enabled, tg_admin_ids: s.tg_admin_ids, tg_channel: s.tg_channel.trim(), tg_bot_username: s.tg_bot_username.trim(),
            tg_store_text: s.tg_store_text, tg_contact: s.tg_contact.trim(), tg_ref_points: s.tg_ref_points, tg_ref_credits: s.tg_ref_credits,
            tg_plans: plans.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p.length === 3 && p[0]).map(([plan, label, price]) => ({ plan: plan!, label: label!, price: price! })),
          } } }), "تم الحفظ")}>حفظ</Button>
          <Button variant="outline" disabled={busy || !data.connected} onClick={() => run(async () => {
            const origin = window.location.origin.includes("id-preview--") ? "https://w0rmgpt.lovable.app" : window.location.origin;
            const r = await hook({ data: { token, origin } });
            toast.message(`@${r.username} ← ${r.url}`);
          }, "تم ربط البوت بالموقع")}>ربط البوت (Webhook)</Button>
        </div>
        <p className="text-xs text-muted-foreground">البوت يعمل 24 ساعة من الموقع المنشور. أوامر الأدمن في البوت: /stats</p>
      </section>

      <section className="glass space-y-3 rounded-xl border p-4">
        <h3 className="font-bold">إنشاء دروب حظ 🥚</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DROP_KINDS) as DropKind[]).map((k) => (
            <Button key={k} size="sm" variant={d.kind === k ? "default" : "outline"} onClick={() => setD("kind", k)}>{DROP_KINDS[k]}</Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">العنوان<Input value={d.title} onChange={(e) => setD("title", e.target.value)} /></label>
          <label className="space-y-1 text-sm">عدد الفائزين<Input type="number" min={1} value={d.winners_count} onChange={(e) => setD("winners_count", Number(e.target.value))} /></label>
          <label className="space-y-1 text-sm">خطة الجائزة
            <select className="h-11 w-full rounded-md border bg-background px-3" value={d.prize_plan ?? ""} onChange={(e) => setD("prize_plan", (e.target.value || null) as typeof d.prize_plan)}>
              <option value="">بدون اشتراك</option><option value="plus">Plus</option><option value="pro">Pro</option><option value="ultra">Ultra</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">مدة الاشتراك (أيام)<Input type="number" value={d.prize_days} onChange={(e) => setD("prize_days", Number(e.target.value))} /></label>
          <label className="space-y-1 text-sm">رصيد موقع للفائز<Input type="number" value={d.prize_credits} onChange={(e) => setD("prize_credits", Number(e.target.value))} /></label>
          {d.kind === "points" && <label className="space-y-1 text-sm">تكلفة الدخول (نقاط)<Input type="number" value={d.entry_cost} onChange={(e) => setD("entry_cost", Number(e.target.value))} /></label>}
          {d.kind === "conditional" && <>
            <label className="space-y-1 text-sm">أقل نقاط<Input type="number" value={d.min_points} onChange={(e) => setD("min_points", Number(e.target.value))} /></label>
            <label className="space-y-1 text-sm">أقل إحالات<Input type="number" value={d.min_referrals} onChange={(e) => setD("min_referrals", Number(e.target.value))} /></label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={d.require_channel} onCheckedChange={(v) => setD("require_channel", v)} /> يشترط الاشتراك بالقناة</label>
          </>}
          {d.kind === "vote" && <label className="space-y-1 text-sm sm:col-span-2">خيارات التصويت (سطر لكل خيار)<Textarea value={d.vote_options} onChange={(e) => setD("vote_options", e.target.value)} /></label>}
          <label className="space-y-1 text-sm">موعد النشر (فارغ = الآن)<Input type="datetime-local" value={d.starts_at} onChange={(e) => setD("starts_at", e.target.value)} /></label>
          <label className="space-y-1 text-sm">موعد الانتهاء{d.kind === "sequential" ? " (اختياري)" : ""}<Input type="datetime-local" value={d.ends_at} onChange={(e) => setD("ends_at", e.target.value)} /></label>
        </div>
        <label className="block space-y-1 text-sm">الوصف<Textarea value={d.description} onChange={(e) => setD("description", e.target.value)} /></label>
        <Button disabled={busy || !d.title} onClick={() => run(async () => {
          const iso = (v: string) => (v ? new Date(v).toISOString() : null);
          await create({ data: { token, publishNow: !d.starts_at, drop: {
            kind: d.kind, title: d.title, description: d.description, prize_plan: d.prize_plan, prize_days: d.prize_days, prize_credits: d.prize_credits,
            winners_count: d.winners_count, entry_cost: d.entry_cost, min_points: d.min_points, min_referrals: d.min_referrals, require_channel: d.require_channel,
            vote_options: d.vote_options.split("\n").map((x) => x.trim()).filter(Boolean), starts_at: iso(d.starts_at), ends_at: iso(d.ends_at),
          } } });
          setDrop(emptyDrop);
        }, d.starts_at ? "تمت الجدولة" : "تم النشر في القناة")}>{d.starts_at ? "جدولة الدروب" : "نشر الآن"}</Button>
      </section>

      <section className="glass space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap gap-2">
          {[["all", "كل الدروبات"], ["scheduled", "المجدولة"], ["live", "الحية"], ["closed", "المنتهية"]].map(([k, l]) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k!)}>{l}</Button>
          ))}
        </div>
        {list.length === 0 && <p className="text-sm text-muted-foreground">لا توجد دروبات</p>}
        <div className="divide-y">
          {list.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-bold">{x.title} <span className="text-xs text-muted-foreground">· {DROP_KINDS[x.kind as DropKind]} · {STATUS[x.status]}</span></div>
                <div className="text-xs text-muted-foreground">
                  {x.status === "scheduled" && `ينشر: ${new Date(x.starts_at).toLocaleString("ar")}`}
                  {x.ends_at && ` · ينتهي: ${new Date(x.ends_at).toLocaleString("ar")}`}
                  {(x.winners as string[]).length > 0 && ` · الفائزون: ${(x.winners as string[]).join("، ")}`}
                </div>
              </div>
              <div className="flex gap-2">
                {x.status === "scheduled" && <Button size="sm" disabled={busy} onClick={() => run(() => act({ data: { token, id: x.id, action: "publish" } }), "تم النشر")}>نشر</Button>}
                {x.status === "live" && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => act({ data: { token, id: x.id, action: "close" } }), "تم السحب")}>إنهاء وسحب</Button>}
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => confirm("حذف الدروب؟") && run(() => act({ data: { token, id: x.id, action: "delete" } }), "تم الحذف")}>حذف</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
