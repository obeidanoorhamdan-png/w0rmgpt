import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, Users, MessageSquare, Crown, Flame, Loader2, Copy, SearchCheck, Trash2 } from "lucide-react";
import { WormLogo } from "@/components/WormLogo";
import { SubscriptionIntegration } from "@/components/SubscriptionIntegration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminLogin, adminOverview, adminSaveSettings, adminChangePassword, adminCreateCode, adminUpdateUser, adminCreateSellerKey, adminToggleSellerKey, adminDeleteSellerKey, adminDeleteCodes, adminInspectCode } from "@/lib/admin.functions";

type CodeInspection = Awaited<ReturnType<typeof adminInspectCode>>;

export const Route = createFileRoute("/Aobeida")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة — WORM GPT" },
      { name: "description", content: "لوحة إدارة WORM GPT." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "لوحة الإدارة — WORM GPT" },
      { property: "og:description", content: "لوحة إدارة WORM GPT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Overview = Awaited<ReturnType<typeof adminOverview>>;

function Admin() {
  const login = useServerFn(adminLogin);
  const overview = useServerFn(adminOverview);
  const save = useServerFn(adminSaveSettings);
  const changePw = useServerFn(adminChangePassword);
  const createCode = useServerFn(adminCreateCode);
  const updateUser = useServerFn(adminUpdateUser);
  const createSellerKey = useServerFn(adminCreateSellerKey);
  const toggleSellerKey = useServerFn(adminToggleSellerKey);
  const deleteSellerKey = useServerFn(adminDeleteSellerKey);
  const deleteCodes = useServerFn(adminDeleteCodes);
  const inspectCode = useServerFn(adminInspectCode);

  const [token, setToken] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [search, setSearch] = useState("");

  const [prompt, setPrompt] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [daily, setDaily] = useState(10);
  const [defModel, setDefModel] = useState("");
  const [disabled, setDisabled] = useState<string[]>([]);
  const [newPw, setNewPw] = useState("");
  const [cPlan, setCPlan] = useState("plus");
  const [cDays, setCDays] = useState(30);
  const [cUses, setCUses] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspectQuery, setInspectQuery] = useState("");
  const [inspection, setInspection] = useState<CodeInspection | null>(null);

  const load = useCallback(async (t: string, s?: string) => {
    try {
      const d = await overview({ data: { token: t, search: s } });
      setData(d);
      setPrompt(d.settings.system_prompt);
      setApiUrl(d.settings.api_url);
      setAnnouncement(d.settings.announcement);
      setDaily(d.settings.daily_credits);
      setDefModel(d.settings.default_model);
      setDisabled(d.settings.disabled_models);
    } catch (e) {
      sessionStorage.removeItem("worm_admin");
      setToken(null);
      toast.error(e instanceof Error ? e.message : "خطأ");
    }
  }, [overview]);

  useEffect(() => {
    const t = sessionStorage.getItem("worm_admin");
    if (t) { setToken(t); void load(t); }
  }, [load]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await login({ data: { password: pw } });
      sessionStorage.setItem("worm_admin", r.token);
      setToken(r.token);
      setPw("");
      await load(r.token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    }
    setBusy(false);
  }

  async function run<T>(fn: () => Promise<T>, ok: string) {
    try { const r = await fn(); toast.success(ok); if (token) await load(token, search); return r; }
    catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); return undefined; }
  }

  if (!token || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero p-6">
        <form onSubmit={doLogin} className="glass w-full max-w-sm space-y-4 rounded-2xl border p-6">
          <div className="flex justify-center"><WormLogo size={56} /></div>
          <h1 className="flex items-center justify-center gap-2 text-lg font-extrabold"><Lock className="size-4 text-primary" /> لوحة الإدارة</h1>
          <Input dir="ltr" type="password" required placeholder="كلمة المرور" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button disabled={busy} className="w-full bg-fire text-primary-foreground">{busy && <Loader2 className="size-4 animate-spin" />} دخول</Button>
        </form>
      </div>
    );
  }

  const chatModels = data.models.filter((m) => m.type !== "image");
  const stats = [
    { i: Users, l: "المستخدمون", v: data.stats.users },
    { i: MessageSquare, l: "الرسائل", v: data.stats.messages },
    { i: Crown, l: "مشتركون نشطون", v: data.stats.subs },
    { i: Flame, l: "أكثر موديل", v: data.stats.topModel.replace("worm-gpt-1.5-", "") },
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <WormLogo size={40} />
          <Button variant="outline" onClick={() => { sessionStorage.removeItem("worm_admin"); setToken(null); setData(null); }}>خروج</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ i: Icon, l, v }) => (
            <div key={l} className="glass rounded-xl border p-4">
              <Icon className="size-5 text-primary" />
              <div className="mt-2 truncate text-2xl font-black">{v}</div>
              <div className="text-xs text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="connection">الاتصال والبرومبت</TabsTrigger>
            <TabsTrigger value="models">الموديلات</TabsTrigger>
            <TabsTrigger value="subs">الاشتراكات</TabsTrigger>
            <TabsTrigger value="users">المستخدمون</TabsTrigger>
            <TabsTrigger value="general">عام</TabsTrigger>
            <TabsTrigger value="logs">السجل</TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-4">
            <div className="glass space-y-3 rounded-xl border p-4">
              <h3 className="font-bold">رابط الاتصال والمفتاح</h3>
              <label className="text-xs text-muted-foreground">رابط الاتصال</label>
              <Input dir="ltr" className="text-left" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
              <label className="text-xs text-muted-foreground">المفتاح الحالي: {data.settings.key_masked} — المصدر: {data.settings.key_source}</label>
              <Input dir="ltr" className="text-left" type="password" placeholder="مفتاح جديد (اتركه فارغاً لعدم التغيير)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <div className="flex gap-2">
                <Button className="bg-fire text-primary-foreground" onClick={() => run(async () => { await save({ data: { token, patch: { api_url: apiUrl, ...(apiKey ? { api_key: apiKey } : {}) } } }); setApiKey(""); }, "تم حفظ الاتصال")}>حفظ</Button>
                <Button variant="outline" onClick={() => run(() => save({ data: { token, patch: { api_key: "" } } }), "تمت العودة للمفتاح الآمن الافتراضي")}>استخدام المفتاح الافتراضي</Button>
              </div>
              <p className="text-xs text-muted-foreground">المفتاح لا يظهر لأي مستخدم ولا يُعرض هنا بعد حفظه.</p>
            </div>
            <div className="glass space-y-3 rounded-xl border p-4">
              <h3 className="font-bold">البرومبت (System Prompt)</h3>
              <Textarea rows={14} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <Button className="bg-fire text-primary-foreground" onClick={() => run(() => save({ data: { token, patch: { system_prompt: prompt } } }), "تم حفظ البرومبت")}>حفظ البرومبت</Button>
            </div>
          </TabsContent>

          <TabsContent value="models">
            <div className="glass space-y-3 rounded-xl border p-4">
              <h3 className="font-bold">جميع الموديلات ({chatModels.length})</h3>
              <p className="text-xs text-muted-foreground">فعّل/عطّل الموديل للمستخدمين واختر الافتراضي.</p>
              <div className="max-h-[28rem] divide-y overflow-y-auto">
                {chatModels.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0" dir="ltr"><div className="truncate font-medium">{m.name}</div><div className="truncate text-xs text-muted-foreground">{m.id}</div></div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant={defModel === m.id ? "default" : "outline"} onClick={() => setDefModel(m.id)}>{defModel === m.id ? "افتراضي" : "تعيين افتراضي"}</Button>
                      <Switch checked={!disabled.includes(m.id)} onCheckedChange={(on) => setDisabled(on ? disabled.filter((x) => x !== m.id) : [...disabled, m.id])} />
                    </div>
                  </div>
                ))}
              </div>
              <Button className="bg-fire text-primary-foreground" onClick={() => run(() => save({ data: { token, patch: { disabled_models: disabled, default_model: defModel } } }), "تم حفظ الموديلات")}>حفظ</Button>
            </div>
          </TabsContent>

          <TabsContent value="subs" className="space-y-4">
            <SubscriptionIntegration enabled={data.settings.subscriptions_api_enabled} configured={data.settings.subscriptions_key_configured} onToggle={(enabled) => run(() => save({ data: { token, patch: { subscriptions_api_enabled: enabled } } }), enabled ? "تم تفعيل الربط" : "تم حذف الربط")} />
            <div className="glass space-y-3 rounded-xl border p-4">
              <h3 className="font-bold">إنشاء كود اشتراك / هدية</h3>
              <div className="flex flex-wrap items-end gap-2">
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={cPlan} onChange={(e) => setCPlan(e.target.value)}>
                  <option value="plus">Plus</option><option value="pro">Pro</option><option value="ultra">Ultra</option>
                </select>
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={cDays} onChange={(e) => setCDays(Number(e.target.value))}>
                  <option value={14}>أسبوعان</option><option value={30}>شهري</option><option value={365}>سنوي</option>
                </select>
                <div className="w-28"><Input type="number" min={1} value={cUses} onChange={(e) => setCUses(Number(e.target.value))} placeholder="عدد الاستخدامات" /></div>
                <Button className="bg-fire text-primary-foreground" onClick={async () => { const r = await run(() => createCode({ data: { token, plan: cPlan, days: cDays, max_uses: cUses } }), "تم إنشاء الكود"); if (r) navigator.clipboard.writeText(r.code); }}>إنشاء</Button>
              </div>
            </div>
            <div className="glass rounded-xl border p-4">
              <h3 className="mb-2 font-bold">الأكواد</h3>
              <div className="divide-y text-sm">
                {data.codes.length === 0 && <p className="text-muted-foreground">لا توجد أكواد</p>}
                {data.codes.map((c) => (
                  <div key={c.code} className="flex items-center justify-between gap-2 py-2">
                    <button className="flex items-center gap-1 font-mono" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("تم النسخ"); }}>{c.code} <Copy className="size-3" /></button>
                    <span className="text-xs text-muted-foreground">{c.plan} · {c.days} يوم · {c.uses}/{c.max_uses}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="بحث بالبريد أو ID" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(token, search)} />
              <Button variant="outline" onClick={() => load(token, search)}>بحث</Button>
            </div>
            <div className="glass divide-y rounded-xl border text-sm">
              {data.users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0"><div className="truncate" dir="ltr">{u.email}</div><div className="text-xs text-muted-foreground">ID {u.short_id} · {u.plan} · نقاط {u.credits}+{u.bonus_credits} · رسائل {u.messages_count}{u.suspended ? " · موقوف" : ""}</div></div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => run(() => updateUser({ data: { token, id: u.id, addCredits: 10 } }), "+10 نقاط")}>+10</Button>
                    <select className="h-8 rounded-md border bg-background px-1 text-xs" value="" onChange={(e) => e.target.value && run(() => updateUser({ data: { token, id: u.id, plan: e.target.value, days: 30 } }), "تم تغيير الخطة")}>
                      <option value="">ترقية…</option><option value="free">Free</option><option value="plus">Plus</option><option value="pro">Pro</option><option value="ultra">Ultra</option>
                    </select>
                    <Button size="sm" variant={u.suspended ? "default" : "destructive"} onClick={() => run(() => updateUser({ data: { token, id: u.id, suspended: !u.suspended } }), u.suspended ? "تم رفع الإيقاف" : "تم الإيقاف")}>{u.suspended ? "تفعيل" : "إيقاف"}</Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            <div className="glass space-y-3 rounded-xl border p-4">
              <h3 className="font-bold">إعلان لكل المستخدمين</h3>
              <Input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="اتركه فارغاً لإخفائه" />
              <h3 className="font-bold">النقاط المجانية اليومية</h3>
              <Input type="number" min={0} value={daily} onChange={(e) => setDaily(Number(e.target.value))} />
              <Button className="bg-fire text-primary-foreground" onClick={() => run(() => save({ data: { token, patch: { announcement, daily_credits: daily } } }), "تم الحفظ")}>حفظ</Button>
            </div>
            <div className="glass space-y-3 rounded-xl border p-4">
              <h3 className="font-bold">تغيير كلمة مرور اللوحة</h3>
              <Input dir="ltr" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="كلمة مرور جديدة" />
              <Button variant="outline" disabled={newPw.length < 6} onClick={() => run(async () => { await changePw({ data: { token, password: newPw } }); setNewPw(""); }, "تم تغيير كلمة المرور")}>تغيير</Button>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <div className="glass divide-y rounded-xl border text-sm">
              {data.logs.length === 0 && <p className="p-4 text-muted-foreground">لا توجد عمليات</p>}
              {data.logs.map((l) => (
                <div key={l.id} className="flex justify-between gap-2 p-3"><span>{l.action} <span className="text-xs text-muted-foreground" dir="ltr">{l.details}</span></span><span className="shrink-0 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar")}</span></div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
