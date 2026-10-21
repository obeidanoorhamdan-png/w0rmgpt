import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Zap, Shield, Infinity as InfinityIcon, Globe, Gift } from "lucide-react";
import { WormLogo } from "@/components/WormLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { profileQuery, isPlanActive } from "@/lib/queries";
import { redeemCode } from "@/lib/app.functions";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "خطط الاشتراك — WORM GPT" },
      { name: "description", content: "اختر الخطة التي تناسبك: Free وPlus وPro وUltra." },
      { property: "og:title", content: "خطط الاشتراك — WORM GPT" },
      { property: "og:description", content: "اختر الخطة التي تناسبك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Plans,
});

const plans = [
  { id: "free", name: "Free", price: "$0", badge: "الأكثر استخداماً كبداية", rows: ["الرسائل: حسب الحد اليومي (10 نقاط)", "الصور: 3 إنشاء + 3 تعديل أسبوعياً", "النماذج: نماذج Free", "API: رصيد API شهري"], cta: "ابدأ الآن ←" },
  { id: "plus", name: "Plus", price: "$5", badge: "الأفضل قيمة", rows: ["الرسائل: 15,000 شهرياً", "الصور: 1,500 شهرياً", "النماذج: Free + Lite + Basic (V2.x / V3.x)"], cta: "اشتري الآن ←" },
  { id: "pro", name: "Pro", price: "$10", badge: "", rows: ["الرسائل: غير محدود", "الصور: غير محدود", "النماذج: الوكلاء + V4.x + Mind"], cta: "اشتري الآن ←" },
  { id: "ultra", name: "Ultra", price: "$20", badge: "الأقوى", rows: ["الرسائل: غير محدود + API + بلا حد", "الصور: غير محدود", "النماذج: كل مزايا Pro"], cta: "اشتري الآن ←" },
];

const perks = [
  { i: Zap, t: "أداء فائق" }, { i: Shield, t: "أمن وخصوصية" }, { i: InfinityIcon, t: "لا حدود لإبداعك" }, { i: Globe, t: "مدعوم بأحدث النماذج" },
];

function Plans() {
  const { data: profile } = useQuery(profileQuery);
  const qc = useQueryClient();
  const redeem = useServerFn(redeemCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const active = profile && isPlanActive(profile) ? profile.plan : "free";

  async function doRedeem() {
    setBusy(true);
    try {
      const r = await redeem({ data: { code } });
      toast.success(`تم تفعيل خطة ${r.plan.toUpperCase()} حتى ${new Date(r.expires).toLocaleDateString("ar")}`);
      setCode("");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التفعيل");
    }
    setBusy(false);
  }

  return (
    <div className="h-full overflow-y-auto bg-hero p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <WormLogo size={44} tagline />
          </div>
          <div className="text-end">
            <h1 className="text-3xl font-extrabold">خطط الاشتراك</h1>
            <p className="text-muted-foreground">اختر الخطة التي تناسبك</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const hot = p.id !== "free";
            return (
              <div key={p.id} className={`glass relative flex flex-col rounded-2xl border p-5 ${p.id === "ultra" ? "border-primary shadow-glow" : ""}`}>
                {p.badge && <span className="absolute -top-3 start-4 rounded-full bg-fire px-3 py-0.5 text-xs font-bold text-primary-foreground">{p.badge}</span>}
                <h2 className="font-display text-xl font-black">{p.name}</h2>
                <div className="mt-2 font-display text-4xl font-black text-primary" dir="ltr">{p.price}</div>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {p.rows.map((r) => <li key={r} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{r}</li>)}
                </ul>
                {active === p.id ? (
                  <div className="mt-5 rounded-md border border-primary py-2 text-center text-sm font-bold text-primary">خطتك الحالية</div>
                ) : (
                  <Button
                    variant={hot ? "default" : "outline"}
                    className={`mt-5 ${hot ? "bg-fire shadow-glow text-primary-foreground" : ""}`}
                    onClick={() => document.getElementById("redeem")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    {p.cta}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div id="redeem" className="glass mx-auto mt-10 max-w-xl rounded-2xl border p-5">
          <h3 className="flex items-center gap-2 font-bold"><Gift className="size-5 text-primary" /> لديك كود اشتراك أو هدية؟</h3>
          <p className="mt-1 text-sm text-muted-foreground">أدخل الكود لتفعيل الخطة على حسابك فوراً.</p>
          <div className="mt-3 flex gap-2">
            <Input dir="ltr" placeholder="WORM-XXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} className="text-left font-mono" />
            <Button disabled={busy || !code.trim()} onClick={doRedeem} className="bg-fire text-primary-foreground">تفعيل</Button>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 border-t pt-6 sm:grid-cols-4">
          {perks.map(({ i: Icon, t }) => (
            <div key={t} className="flex items-center justify-center gap-2 text-sm font-bold"><Icon className="size-5 text-primary" />{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
