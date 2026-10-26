import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Square, Search, X, ChevronUp, ChevronDown, Download, Loader2, Sparkles, Code2, Languages, Lightbulb, Images, AudioLines, Plus, PanelTop, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WormLogo } from "@/components/WormLogo";
import { Button } from "@/components/ui/button";
import { MessageBubble, ToolButton } from "@/components/MessageBubble";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportMessages, findMessageMatches } from "@/lib/chat-tools";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { appInfoQuery, messagesQuery, profileQuery, isPlanActive } from "@/lib/queries";

const SUGGESTIONS = [
  { icon: Code2, label: "اكتب كوداً", detail: "من الفكرة إلى الحل", prompt: "ساعدني في كتابة كود Python. " },
  { icon: Lightbulb, label: "طوّر فكرة", detail: "ابدأ بشيء مختلف", prompt: "ساعدني في تطوير فكرة مشروع: " },
  { icon: Languages, label: "ترجم نصاً", detail: "المعنى، بكل دقة", prompt: "ترجم النص التالي إلى العربية: " },
  { icon: Sparkles, label: "اكتب باحتراف", detail: "كلمات تصنع الفرق", prompt: "اكتب لي نصاً احترافياً عن: " },
];

export function ChatView({ threadId }: { threadId: string | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: info } = useQuery(appInfoQuery);
  const { data: profile } = useQuery(profileQuery);
  const { data: msgs = [] } = useQuery({ ...messagesQuery(threadId ?? "none"), enabled: !!threadId });
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [compact, setCompact] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `worm_draft_${threadId ?? "new"}`;
  const matches = findMessageMatches(msgs, search);
  const availableModels = info?.models.length ? info.models : info?.defaultModel ? [{ id: info.defaultModel, name: info.defaultModel }] : [];
  useEffect(() => { setInput(localStorage.getItem(draftKey) ?? ""); setDraftReady(true); }, [draftKey]);
  useEffect(() => { if (draftReady) localStorage.setItem(draftKey, input); }, [input, draftKey, draftReady]);
  useEffect(() => {
    const index = matches[matchIndex % Math.max(matches.length, 1)];
    if (index !== undefined) document.getElementById(`message-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [search, matchIndex]);
  useEffect(() => { if (taRef.current) { taRef.current.style.height = "auto"; taRef.current.style.height = `${Math.min(160, taRef.current.scrollHeight)}px`; } }, [input]);

  useEffect(() => {
    if (!info) return;
    const cached = localStorage.getItem("worm_model");
    const valid = cached && info.models.some((m) => m.id === cached) ? cached : info.defaultModel;
    if (model !== valid) setModel(valid);
  }, [info, model]);
  useEffect(() => { if (stickToBottom.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, partial, pendingUser]);
  useEffect(() => { taRef.current?.focus(); }, [threadId, streaming]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(tid: string, opts: { content?: string; regenerate?: boolean }) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) { toast.error("انتهت الجلسة"); return; }
    stickToBottom.current = true;
    setStreaming(true);
    setPartial("");
    setPendingUser(opts.content ?? null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ threadId: tid, content: opts.content, regenerate: opts.regenerate, model: model || info?.defaultModel }),
        signal: ctrl.signal,
      });
      if (!r.ok || !r.body) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "فشل الاتصال بالذكاء الاصطناعي");
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setPartial(acc);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("انقطع الاتصال");
    } finally {
      await qc.invalidateQueries({ queryKey: ["messages", tid] });
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      setPartial("");
      setPendingUser(null);
      setStreaming(false);
    }
  }

  // Start a message queued while creating a new thread.
  useEffect(() => {
    if (!threadId || started.current === threadId || !model) return;
    const key = `worm_pending_${threadId}`;
    const pending = sessionStorage.getItem(key);
    if (pending) {
      started.current = threadId;
      sessionStorage.removeItem(key);
      void run(threadId, { content: pending });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, model]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || creating || !model) return;
    setInput("");
    if (!threadId) {
      setCreating(true);
      try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("انتهت الجلسة، سجّل الدخول مجدداً"); return; }
      const { data, error } = await supabase.from("threads").insert({ user_id: u.user.id, model }).select().single();
      if (error || !data) { toast.error("تعذّر إنشاء المحادثة"); return; }
      sessionStorage.setItem(`worm_pending_${data.id}`, content);
      await qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
      } finally { setCreating(false); }
      return;
    }
    void run(threadId, { content });
  }

  function exportChat(format: "md" | "json") {
    const url = URL.createObjectURL(new Blob([exportMessages(msgs, format)], { type: format === "json" ? "application/json" : "text/markdown;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `worm-gpt-chat.${format}`; a.click(); URL.revokeObjectURL(url);
  }

  const unlimited = profile ? isPlanActive(profile) : false;
  const empty = msgs.length === 0 && !pendingUser && !partial;
  const busy = streaming || creating;

  return (
    <TooltipProvider delayDuration={250}>
    <div className="flex h-full flex-col">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3"><span className="hidden text-xs font-bold text-muted-foreground lg:block">الموديل</span><Select value={model} disabled={busy} onValueChange={(v) => { setModel(v); localStorage.setItem("worm_model", v); }}>
          <SelectTrigger className="h-9 w-56 max-w-[48vw] border-none bg-muted/40 text-xs shadow-none" dir="ltr" aria-label="اختيار الموديل"><SelectValue placeholder="جارٍ تحميل الموديلات…" /></SelectTrigger>
          <SelectContent dir="ltr">{availableModels.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
        </Select></div>
        <div className="flex items-center gap-0.5"><ToolButton label="بحث في المحادثة" onClick={() => setSearchOpen(!searchOpen)}><Search /></ToolButton><ToolButton label={compact ? "عرض مريح" : "عرض مكثّف"} onClick={() => setCompact(!compact)}><PanelTop /></ToolButton>{msgs.length > 0 && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="تصدير المحادثة" className="size-8 text-muted-foreground"><Download /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => exportChat("md")}>Markdown (.md)</DropdownMenuItem><DropdownMenuItem onClick={() => exportChat("json")}>JSON (.json)</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}<Button asChild variant="ghost" size="icon" className="size-8" aria-label="محادثة جديدة"><Link to="/chat"><Plus /></Link></Button></div>
      </header>
      {searchOpen && <div className="flex items-center gap-2 border-b px-4 py-2"><Search className="size-4 shrink-0 text-muted-foreground" /><Input autoFocus aria-label="بحث داخل المحادثة" placeholder="ابحث عن كلمة…" value={search} onChange={e => { setSearch(e.target.value); setMatchIndex(0); }} className="h-8 min-w-0 flex-1" /><span className="shrink-0 text-xs text-muted-foreground">{matches.length ? `${matchIndex % matches.length + 1} / ${matches.length}` : "0"}</span><ToolButton label="النتيجة السابقة" disabled={!matches.length} onClick={() => setMatchIndex((matchIndex - 1 + matches.length) % matches.length)}><ChevronUp /></ToolButton><ToolButton label="النتيجة التالية" disabled={!matches.length} onClick={() => setMatchIndex(matchIndex + 1)}><ChevronDown /></ToolButton><ToolButton label="إغلاق البحث" onClick={() => { setSearchOpen(false); setSearch(""); }}><X /></ToolButton></div>}
      <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} className="h-full overflow-y-auto" onScroll={() => { const el = scrollRef.current; if (!el) return; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; setShowJump(!stickToBottom.current); }}>
        {empty ? <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-8 text-center sm:px-8">
          <div className="mb-5 grid size-20 place-items-center rounded-2xl border border-primary/20 bg-primary/5"><WormLogo size={65} withText={false} /></div>
          <span className="mb-3 text-xs font-semibold text-primary">مساحة أفكارك</span>
          <h1 className="font-display text-3xl font-black sm:text-4xl" dir="ltr">WORM <span className="text-primary">GPT</span></h1>
          <p className="mt-3 text-lg font-semibold">ماذا سنُبدع اليوم؟</p>
          <p className="mt-2 font-display text-[10px] text-muted-foreground" dir="ltr">MORE POWER. LESS LIMITS.</p>
          <div className="mt-8 grid w-full grid-cols-2 gap-3">{SUGGESTIONS.map(({ icon: Icon, label, detail, prompt }) => <Button variant="outline" key={label} onClick={() => { setInput(prompt); taRef.current?.focus(); }} className="group h-auto min-h-28 flex-col items-start justify-center gap-2 whitespace-normal rounded-lg border-border/60 bg-card/50 p-4 text-start hover:border-primary/40"><Icon className="text-primary" /><span className="text-sm font-bold">{label}</span><span className="text-xs font-normal text-muted-foreground">{detail}</span></Button>)}</div>
          <div className="mt-5 flex flex-wrap justify-center gap-3"><Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link to="/images"><Images className="text-violet" /> استوديو الصور</Link></Button><Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link to="/voice"><AudioLines className="text-primary" /> محادثة صوتية</Link></Button></div>
        </div> : <div className="mx-auto max-w-3xl px-5 pb-10 sm:px-8">
          {msgs.map((m, i) => <div id={`message-${i}`} key={m.id} className={`scroll-mt-4 rounded-lg ${search && matches[matchIndex % Math.max(matches.length, 1)] === i ? "bg-secondary/50 ring-1 ring-violet/40" : ""}`}><MessageBubble role={m.role} content={m.content} compact={compact} onEdit={m.role === "user" && !busy ? () => { setInput(m.content); taRef.current?.focus(); } : undefined} onRegen={m.role === "assistant" && i === msgs.length - 1 && !busy && threadId ? () => void run(threadId, { regenerate: true }) : undefined} /></div>)}
          {pendingUser && !msgs.some(m => m.role === "user" && m.content === pendingUser && m.id === msgs.at(-1)?.id) && <MessageBubble role="user" content={pendingUser} compact={compact} />}
          {streaming && (partial ? <MessageBubble role="assistant" content={partial} compact={compact} /> : <div role="status" className="flex items-center gap-3 py-6 text-sm text-muted-foreground"><WormLogo size={28} withText={false} /><Loader2 className="size-4 animate-spin text-primary" /> جارٍ التفكير…</div>)}
          <div ref={bottomRef} />
        </div>}
      </div>
      {showJump && <Button size="icon" variant="outline" className="absolute bottom-4 start-1/2 rounded-full shadow-sm" aria-label="آخر رسالة" onClick={() => { stickToBottom.current = true; bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}><ArrowDown /></Button>}
      </div>
      <footer className="shrink-0 px-4 pb-3 pt-2 sm:px-7 sm:pb-5">
        <div className="chat-composer mx-auto max-w-3xl rounded-xl border bg-card p-3 transition-colors focus-within:border-primary/50">
          <Textarea ref={taRef} value={input} aria-label="رسالتك" onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} placeholder="اسأل، ابتكر، أو ابدأ بفكرة…" rows={1} className="max-h-40 min-h-12 resize-none border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0" />
          <div className="mt-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1"><Button asChild variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="الانتقال إلى الصور"><Link to="/images"><Images /></Link></Button><Button asChild variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="الانتقال إلى الصوت"><Link to="/voice"><AudioLines /></Link></Button>{input && <ToolButton label="مسح المسودة" onClick={() => setInput("")}><X /></ToolButton>}<span className="hidden text-[10px] text-muted-foreground sm:block">{input.length ? `${input.length.toLocaleString("ar")} حرف` : ""}</span></div>
          {streaming ? <Button size="icon" variant="outline" onClick={() => abortRef.current?.abort()} aria-label="إيقاف الرد"><Square /></Button> : <Button size="icon" className="size-10 rounded-lg" onClick={() => void send()} disabled={!input.trim() || busy || !model} aria-label="إرسال">{creating ? <Loader2 className="animate-spin" /> : <ArrowUp />}</Button>}</div>
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground"><span>كل رسالة = نقطة واحدة · {unlimited ? "غير محدود" : `المتبقي: ${profile ? profile.credits + profile.bonus_credits : "…"}`}</span><span className="flex items-center gap-1">{input && <Check className="size-3" />}{input ? "مسودة محفوظة" : "قد يخطئ الذكاء الاصطناعي؛ تحقّق من المعلومات المهمة."}</span></div>
      </footer>
    </div>
    </TooltipProvider>
  );
}
