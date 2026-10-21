import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Lock, User, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { WormLogo } from "@/components/WormLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Search = { mode?: "login" | "signup" | "forgot" | undefined; ref?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s["mode"] === "signup" || s["mode"] === "forgot" ? s["mode"] : "login",
    ref: typeof s["ref"] === "string" ? s["ref"].slice(0, 16) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — WORM GPT" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساب WORM GPT واحصل على 10 نقاط مجانية يومياً." },
      { property: "og:title", content: "تسجيل الدخول — WORM GPT" },
      { property: "og:description", content: "أنشئ حسابك واحصل على نقاط مجانية يومياً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

function AuthPage() {
  const { mode = "login", ref } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/chat", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const setMode = (m: "login" | "signup" | "forgot") => navigate({ to: "/auth", search: { mode: m, ref }, replace: true });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (strength(password) < 2) throw new Error("كلمة المرور ضعيفة: استخدم 8 أحرف على الأقل مع أرقام وحروف");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/chat", data: { display_name: name || undefined, ref } },
        });
        if (error) throw error;
        if (!data.session) {
          setVerify(true);
          toast.success("أرسلنا رمز التحقق إلى بريدك");
        }
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/confirm/i.test(error.message)) {
            setVerify(true);
            await supabase.auth.resend({ type: "signup", email });
            throw new Error("فعّل حسابك أولاً — أعدنا إرسال رمز التحقق");
          }
          throw new Error("البريد أو كلمة المرور غير صحيحة");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
    setBusy(false);
    if (error) toast.error("الرمز غير صحيح أو منتهي");
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("تعذّر تسجيل الدخول عبر Google");
  }

  const s = strength(password);

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-hero bg-card p-10 lg:flex">
        <WormLogo size={180} withText={false} />
        <h2 className="mt-8 font-display text-4xl font-black tracking-widest" dir="ltr">
          WORM <span className="text-primary">GPT</span>
        </h2>
        <p className="mt-2 font-display text-xs tracking-[0.4em] text-muted-foreground" dir="ltr">MORE POWER. LESS LIMITS.</p>
        <ul className="mt-10 space-y-3 text-sm text-muted-foreground">
          <li>🔥 10 نقاط مجانية كل يوم</li>
          <li>🎁 احصل على نقطة عن كل صديق تدعوه</li>
          <li>⚡ عشرات الموديلات في مكان واحد</li>
        </ul>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex justify-center lg:hidden"><WormLogo size={56} /></Link>

          {verify ? (
            <div className="text-center">
              <Mail className="mx-auto size-10 text-primary" />
              <h1 className="mt-4 text-2xl font-extrabold">تأكيد الحساب</h1>
              <p className="mt-2 text-sm text-muted-foreground">أرسلنا رسالة إلى <b dir="ltr">{email}</b>. افتح الرابط فيها أو أدخل الرمز هنا.</p>
              <div className="mt-6 flex justify-center" dir="ltr">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button className="mt-6 w-full bg-fire shadow-glow text-primary-foreground" disabled={busy || code.length < 6} onClick={confirmCode}>
                {busy && <Loader2 className="size-4 animate-spin" />} تأكيد
              </Button>
              <button className="mt-4 text-sm text-muted-foreground hover:text-primary" onClick={async () => { await supabase.auth.resend({ type: "signup", email }); toast.success("تم إعادة الإرسال"); }}>
                إعادة إرسال الرمز
              </button>
              <button className="mt-2 block w-full text-sm text-muted-foreground hover:text-primary" onClick={() => setVerify(false)}>رجوع</button>
            </div>
          ) : sent ? (
            <div className="text-center">
              <Mail className="mx-auto size-10 text-primary" />
              <h1 className="mt-4 text-2xl font-extrabold">تحقق من بريدك</h1>
              <p className="mt-2 text-sm text-muted-foreground">أرسلنا رابط إعادة تعيين كلمة المرور إلى {email}</p>
              <Button variant="outline" className="mt-6" onClick={() => { setSent(false); setMode("login"); }}>العودة لتسجيل الدخول</Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold">
                {mode === "login" ? "مرحباً بعودتك" : mode === "signup" ? "إنشاء حساب جديد" : "نسيت كلمة المرور"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "login" ? "سجّل الدخول لمتابعة محادثاتك" : mode === "signup" ? (ref ? `🎁 دعاك صديق — رمز الدعوة ${ref}` : "10 نقاط مجانية كل يوم") : "سنرسل لك رابطاً لإعادة التعيين"}
              </p>

              {mode !== "forgot" && (
                <>
                  <Button type="button" variant="outline" className="mt-6 w-full" onClick={google}>
                    <svg viewBox="0 0 24 24" className="size-4"><path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.5 2.4-2.5 3.6-5.35 3.6a6 6 0 1 1 0-12c1.5 0 2.8.5 3.8 1.4l2.1-2.1A9 9 0 1 0 12 21c5.2 0 8.6-3.6 8.6-8.8 0-.4 0-.8-.1-1.1Z" /></svg>
                    المتابعة عبر Google
                  </Button>
                  <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />أو<span className="h-px flex-1 bg-border" /></div>
                </>
              )}

              <form onSubmit={submit} className={`space-y-3 ${mode === "forgot" ? "mt-6" : ""}`}>
                {mode === "signup" && (
                  <div className="relative">
                    <User className="absolute start-3 top-3 size-4 text-muted-foreground" />
                    <Input className="ps-9" placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute start-3 top-3 size-4 text-muted-foreground" />
                  <Input dir="ltr" className="ps-9 text-left" type="email" required placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {mode !== "forgot" && (
                  <div className="relative">
                    <Lock className="absolute start-3 top-3 size-4 text-muted-foreground" />
                    <Input dir="ltr" className="px-9 text-left" type={show ? "text" : "password"} required minLength={6} placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" className="absolute end-3 top-3 text-muted-foreground" onClick={() => setShow(!show)} aria-label="إظهار">
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                )}
                {mode === "signup" && password && (
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < s ? "bg-primary" : "bg-muted"}`} />)}
                  </div>
                )}
                {mode === "login" && (
                  <button type="button" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setMode("forgot")}>نسيت كلمة المرور؟</button>
                )}
                <Button type="submit" disabled={busy} className="w-full bg-fire shadow-glow text-primary-foreground hover:opacity-90">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {mode === "login" ? "دخول" : mode === "signup" ? "إنشاء الحساب" : "إرسال الرابط"}
                  {!busy && <ArrowRight className="size-4 rotate-180" />}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>ليس لديك حساب؟ <button className="font-bold text-primary" onClick={() => setMode("signup")}>أنشئ حساباً</button></>
                ) : (
                  <>لديك حساب؟ <button className="font-bold text-primary" onClick={() => setMode("login")}>سجّل الدخول</button></>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
