import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Zap, Shield, Infinity as InfinityIcon, Globe } from "lucide-react";
import { WormLogo } from "@/components/WormLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WORM GPT — المزيد من القوة، حدود أقل" },
      { name: "description", content: "ابدأ دردشة ذكاء اصطناعي قوية مع 10 نقاط مجانية يومياً." },
      { property: "og:title", content: "WORM GPT — المزيد من القوة، حدود أقل" },
      { property: "og:description", content: "دردشة ذكاء اصطناعي قوية مع نقاط مجانية يومياً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

const features = [
  { icon: Zap, t: "أداء فائق", d: "ردود فورية بالبث المباشر" },
  { icon: Shield, t: "أمن وخصوصية", d: "مفاتيح الاتصال محمية بالكامل" },
  { icon: InfinityIcon, t: "بلا حدود لإبداعك", d: "عشرات الموديلات في مكان واحد" },
  { icon: Globe, t: "أحدث النماذج", d: "تحديث مستمر للموديلات" },
];

function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
    });
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background bg-hero px-6 text-center">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-10 opacity-60">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span
            key={i}
            className="animate-ember block size-1.5 rounded-full bg-primary"
            style={{ animationDelay: `${i * 0.31}s`, marginBottom: `${(i % 3) * 14}px` }}
          />
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
        <div className="flex justify-center">
          <WormLogo size={150} withText={false} />
        </div>
        <h1 className="animate-worm-glitch mt-6 font-display text-5xl font-black tracking-widest sm:text-7xl" dir="ltr">
          WORM <span className="text-primary">GPT</span>
        </h1>
        <p className="mt-3 font-display text-xs tracking-[0.4em] text-muted-foreground sm:text-sm" dir="ltr">
          MORE POWER. LESS LIMITS.
        </p>
        <p className="mx-auto mt-6 max-w-md text-muted-foreground">
          دردشة ذكاء اصطناعي احترافية، 10 نقاط مجانية كل يوم، وعشرات الموديلات تحت تصرفك.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="bg-fire shadow-glow text-primary-foreground hover:opacity-90">
            <Link to="/auth" search={{ mode: "signup" }}>ابدأ الآن ←</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{ mode: "login" }}>تسجيل الدخول</Link>
          </Button>
        </div>
      </div>

      <div className="relative mt-16 grid w-full max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
        {features.map(({ icon: Icon, t, d }) => (
          <div key={t} className="glass rounded-xl border p-4">
            <Icon className="mx-auto size-6 text-primary" />
            <div className="mt-2 text-sm font-bold">{t}</div>
            <div className="mt-1 text-xs text-muted-foreground">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
