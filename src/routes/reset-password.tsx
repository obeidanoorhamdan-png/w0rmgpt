import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WormLogo } from "@/components/WormLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة المرور — WORM GPT" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في WORM GPT." },
      { property: "og:title", content: "إعادة تعيين كلمة المرور — WORM GPT" },
      { property: "og:description", content: "اختر كلمة مرور جديدة لحسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تغيير كلمة المرور");
    navigate({ to: "/chat" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero p-6">
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-4 rounded-2xl border p-6">
        <div className="flex justify-center"><WormLogo size={56} /></div>
        <h1 className="text-center text-xl font-extrabold">كلمة مرور جديدة</h1>
        <Input dir="ltr" type="password" minLength={8} required placeholder="كلمة المرور الجديدة" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button disabled={busy} className="w-full bg-fire text-primary-foreground">حفظ</Button>
      </form>
    </div>
  );
}
