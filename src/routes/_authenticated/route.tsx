import { createFileRoute, Link, Outlet, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, MessageSquare, Pin, Trash2, Crown, User, LogOut, Menu, Coins, Copy, MoreHorizontal, Megaphone, Images, AudioLines } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WormLogo } from "@/components/WormLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { appInfoQuery, profileQuery, threadsQuery, isPlanActive, PLAN_LABEL } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "login" } });
  },
  component: Shell,
});

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const { data: profile } = useQuery(profileQuery);
  const { data: threads = [] } = useQuery(threadsQuery);
  const [q, setQ] = useState("");
  const filtered = threads.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));
  const unlimited = profile ? isPlanActive(profile) : false;

  async function togglePin(id: string, pinned: boolean) {
    await supabase.from("threads").update({ pinned: !pinned }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["threads"] });
  }
  async function del(id: string) {
    await supabase.from("threads").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["threads"] });
    if (params.threadId === id) navigate({ to: "/chat" });
  }
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-4"><Link to="/chat" onClick={onNavigate}><WormLogo size={44} /></Link></div>
      <div className="space-y-2 px-3">
        <Button asChild className="w-full justify-start bg-fire shadow-glow text-primary-foreground hover:opacity-90">
          <Link to="/chat" onClick={onNavigate}><Plus className="size-4" /> محادثة جديدة</Link>
        </Button>
        <div className="relative">
          <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="h-9 ps-9" placeholder="ابحث في المحادثات…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <nav aria-label="أدوات WORM GPT" className="mt-4 space-y-1 border-y border-sidebar-border px-3 py-3">
        <Button asChild variant="ghost" className="w-full justify-start"><Link to="/chat" onClick={onNavigate} activeProps={{ className: "bg-sidebar-accent text-primary" }}><MessageSquare className="size-4" /> الدردشة</Link></Button>
        <Button asChild variant="ghost" className="w-full justify-start"><Link to="/images" onClick={onNavigate} activeProps={{ className: "bg-sidebar-accent text-primary" }}><Images className="size-4 text-violet" /> استوديو الصور</Link></Button>
        <Button asChild variant="ghost" className="w-full justify-start"><Link to="/voice" onClick={onNavigate} activeProps={{ className: "bg-sidebar-accent text-primary" }}><AudioLines className="size-4 text-primary" /> محادثة صوتية</Link></Button>
      </nav>
      <div className="flex items-center justify-between px-4 pt-4 text-xs text-muted-foreground"><span>المحادثات</span><span>{threads.length}</span></div>
      <div className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2">
        {filtered.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">لا توجد محادثات</p>}
        {filtered.map((t) => (
          <div key={t.id} className={`group flex items-center rounded-lg ${params.threadId === t.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}>
            <Link to="/chat/$threadId" params={{ threadId: t.id }} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm">
              {t.pinned ? <Pin className="size-3.5 shrink-0 text-primary" /> : <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="truncate">{t.title}</span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="p-2 opacity-60 group-hover:opacity-100" aria-label="خيارات"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => togglePin(t.id, t.pinned)}><Pin className="size-4" /> {t.pinned ? "إلغاء التثبيت" : "تثبيت"}</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => del(t.id)}><Trash2 className="size-4" /> حذف</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
      {profile && (
        <div className="space-y-2 border-t border-sidebar-border p-3">
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-bold"><Coins className="size-4 text-primary" /> النقاط</span>
              <span className="font-display font-bold text-primary">{unlimited ? "∞" : profile.credits + profile.bonus_credits}</span>
            </div>
            {!unlimited && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-fire" style={{ width: `${Math.min(100, (profile.credits / 10) * 100)}%` }} />
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>خطة {PLAN_LABEL[unlimited ? profile.plan : "free"]}</span>
               <Button variant="ghost" size="sm" className="h-auto gap-1 p-0 font-mono text-xs hover:text-primary" onClick={() => { navigator.clipboard.writeText(profile.short_id); toast.success("تم نسخ المعرّف"); }}>
                ID: {profile.short_id} <Copy className="size-3" />
               </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/plans" onClick={onNavigate}><Crown className="size-4 text-primary" /> الخطط</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/account" onClick={onNavigate}><User className="size-4" /> حسابي</Link></Button>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4" /> خروج</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Shell() {
  const [open, setOpen] = useState(false);
  const { data: info } = useQuery(appInfoQuery);
  return (
     <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-80 shrink-0 border-e border-sidebar-border md:block"><Sidebar /></aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-80 p-0"><Sidebar onNavigate={() => setOpen(false)} /></SheetContent>
      </Sheet>
      <main className="flex min-w-0 flex-1 flex-col">
        {info?.announcement && (
          <div className="flex items-center justify-center gap-2 bg-secondary px-4 py-2 text-center text-sm text-secondary-foreground">
            <Megaphone className="size-4" /> {info.announcement}
          </div>
        )}
        <div className="flex items-center gap-2 border-b p-2 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="القائمة"><Menu /></Button>
          <WormLogo size={32} />
        </div>
        <div className="min-h-0 flex-1"><Outlet /></div>
      </main>
    </div>
  );
}
