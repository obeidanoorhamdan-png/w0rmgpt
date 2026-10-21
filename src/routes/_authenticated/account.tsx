import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Mail, Lock, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { profileQuery, isPlanActive, PLAN_LABEL } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "حسابي — WORM GPT" },
      { name: "description", content: "إدارة معلومات حسابك، معرّفك، ورابط الدعوة." },
      { property: "og:title", content: "حسابي — WORM GPT" },
      { property: "og:description", content: "إدارة معلومات حسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl border p-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold">{icon}{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Account() {
  const { data: p } = useQuery(profileQuery);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [pw, setPw] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (p) { setName(p.display_name ?? ""); setBio(p.bio ?? ""); setAvatar(p.avatar_url ?? ""); }
  }, [p]);

  if (!p) return null;
  const inviteLink = `${window.location.origin}/auth?mode=signup&ref=${p.short_id}`;
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("تم النسخ"); };

  async function saveProfile() {
    const { error } = await supabase.from("profiles").update({ display_name: name, bio, avatar_url: avatar || null }).eq("id", p!.id);
    if (error) { toast.error("تعذّر الحفظ"); return; }
    toast.success("تم حفظ المعلومات");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  async function savePw() {
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    setPw("");
    toast.success("تم تغيير كلمة المرور");
  }
  async function startEmail() {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) { toast.error(error.message); return; }
    setEmailSent(true);
    toast.success("أرسلنا رمز تحقق إلى البريد الجديد");
  }
  async function confirmEmail() {
    const { error } = await supabase.auth.verifyOtp({ email: newEmail, token: otp, type: "email_change" });
    if (error) { toast.error("الرمز غير صحيح"); return; }
    toast.success("تم تغيير البريد");
    setEmailSent(false); setNewEmail(""); setOtp("");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  const active = isPlanActive(p);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-extrabold">حسابي</h1>

        <Card title="معرّف الحساب والدعوات" icon={<Link2 className="size-5 text-primary" />}>
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <div><div className="text-xs text-muted-foreground">ID الخاص بك</div><div className="font-mono text-lg font-bold" dir="ltr">{p.short_id}</div></div>
            <Button size="sm" variant="outline" onClick={() => copy(p.short_id)}><Copy className="size-4" /> نسخ</Button>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">رابط الدعوة — تحصل على +1 نقطة عن كل صديق يسجّل</div>
            <div className="flex gap-2"><Input readOnly dir="ltr" value={inviteLink} className="text-left text-xs" /><Button variant="outline" onClick={() => copy(inviteLink)}><Copy className="size-4" /></Button></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-muted p-3"><div className="font-display text-xl font-bold text-primary">{active ? "∞" : p.credits}</div>نقاط اليوم</div>
            <div className="rounded-lg bg-muted p-3"><div className="font-display text-xl font-bold text-primary">{p.bonus_credits}</div>نقاط الدعوات</div>
            <div className="rounded-lg bg-muted p-3"><div className="font-display text-xl font-bold text-primary">{PLAN_LABEL[active ? p.plan : "free"]}</div>الخطة</div>
          </div>
          <p className="text-xs text-muted-foreground">النقاط المجانية (10) تتجدد يومياً ولا تتراكم. نقاط الدعوات لا تنتهي. {active && p.plan_expires_at && `خطتك تنتهي في ${new Date(p.plan_expires_at).toLocaleDateString("ar")}.`}</p>
        </Card>

        <Card title="المعلومات الشخصية" icon={<UserRound className="size-5 text-primary" />}>
          <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <Input dir="ltr" placeholder="رابط الصورة الشخصية (اختياري)" value={avatar} onChange={(e) => setAvatar(e.target.value)} className="text-left" />
          <Textarea placeholder="نبذة عنك" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} />
          <Button className="bg-fire text-primary-foreground" onClick={saveProfile}>حفظ</Button>
        </Card>

        <Card title="البريد الإلكتروني" icon={<Mail className="size-5 text-primary" />}>
          <p className="text-sm text-muted-foreground" dir="ltr">{p.email}</p>
          {!emailSent ? (
            <div className="flex gap-2">
              <Input dir="ltr" type="email" placeholder="البريد الجديد" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="text-left" />
              <Button variant="outline" disabled={!newEmail} onClick={startEmail}>إرسال رمز</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">أدخل الرمز المرسل إلى {newEmail}</p>
              <div dir="ltr" className="flex"><InputOTP maxLength={6} value={otp} onChange={setOtp}><InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup></InputOTP></div>
              <Button disabled={otp.length < 6} onClick={confirmEmail} className="bg-fire text-primary-foreground">تأكيد التغيير</Button>
            </div>
          )}
        </Card>

        <Card title="كلمة المرور" icon={<Lock className="size-5 text-primary" />}>
          <div className="flex gap-2">
            <Input dir="ltr" type="password" placeholder="كلمة مرور جديدة" value={pw} onChange={(e) => setPw(e.target.value)} />
            <Button variant="outline" disabled={pw.length < 8} onClick={savePw}>تغيير</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
