import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Send, Square, Copy, RefreshCw, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WormLogo } from "@/components/WormLogo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { appInfoQuery, messagesQuery, profileQuery, isPlanActive } from "@/lib/queries";

const SUGGESTIONS = ["اشرح لي الذكاء الاصطناعي ببساطة", "اكتب لي كود Python لترتيب قائمة", "ترجم: Hello, how are you?", "لخّص لي فوائد القراءة"];

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

  useEffect(() => {
    if (!info) return;
    const cached = localStorage.getItem("worm_model");
    const valid = cached && info.models.some((m) => m.id === cached) ? cached : info.defaultModel;
    if (model !== valid) setModel(valid);
  }, [info, model]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, partial, pendingUser]);
  useEffect(() => { taRef.current?.focus(); }, [threadId, streaming]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(tid: string, opts: { content?: string; regenerate?: boolean }) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) { toast.error("انتهت الجلسة"); return; }
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
    if (!content || streaming) return;
    setInput("");
    if (!threadId) {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("انتهت الجلسة، سجّل الدخول مجدداً"); return; }
      const { data, error } = await supabase.from("threads").insert({ user_id: u.user.id, model }).select().single();
      if (error || !data) { toast.error("تعذّر إنشاء المحادثة"); return; }
      sessionStorage.setItem(`worm_pending_${data.id}`, content);
      await qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
      return;
    }
    void run(threadId, { content });
  }

  function exportChat() {
    const txt = msgs.map((m) => `${m.role === "user" ? "أنت" : "WORM GPT"}:\n${m.content}\n`).join("\n---\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
    a.download = "worm-gpt-chat.txt";
    a.click();
  }

  const unlimited = profile ? isPlanActive(profile) : false;
  const empty = msgs.length === 0 && !pendingUser && !partial;
  const lastIsAssistant = msgs.at(-1)?.role === "assistant";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <Select value={model} onValueChange={(v) => { setModel(v); localStorage.setItem("worm_model", v); }}>
          <SelectTrigger className="h-9 w-64 max-w-[60%]" dir="ltr"><SelectValue placeholder="الموديل" /></SelectTrigger>
          <SelectContent dir="ltr">
            {info?.models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {msgs.length > 0 && <Button variant="ghost" size="sm" onClick={exportChat}><Download className="size-4" /> تصدير</Button>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
            <WormLogo size={96} withText={false} />
            <div>
              <h1 className="font-display text-3xl font-black tracking-widest" dir="ltr">WORM <span className="text-primary">GPT</span></h1>
              <p className="mt-2 text-muted-foreground">كيف يمكنني مساعدتك اليوم؟</p>
            </div>
            <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <Button variant="outline" key={s} onClick={() => send(s)} className="h-auto min-h-14 justify-start whitespace-normal rounded-lg p-3 text-start text-sm">{s}</Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 p-4">
            {msgs.map((m, i) => (
              <Bubble key={m.id} role={m.role} content={m.content}
                onRegen={m.role === "assistant" && i === msgs.length - 1 && !streaming && threadId ? () => { void run(threadId, { regenerate: true }); } : undefined} />
            ))}
            {pendingUser && <Bubble role="user" content={pendingUser} />}
            {streaming && (partial ? <Bubble role="assistant" content={partial} /> : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" /> WORM GPT يكتب…</div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t p-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="اكتب رسالتك…"
            rows={1}
            className="max-h-40 min-h-11 resize-none"
          />
          {streaming ? (
            <Button size="icon" variant="outline" onClick={() => abortRef.current?.abort()} aria-label="إيقاف"><Square className="size-4" /></Button>
          ) : (
            <Button size="icon" className="bg-fire shadow-glow text-primary-foreground" onClick={() => send()} disabled={!input.trim()} aria-label="إرسال"><Send className="size-4 rotate-180" /></Button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          كل رسالة = نقطة واحدة · {unlimited ? "رسائل غير محدودة بخطتك" : `المتبقي: ${profile ? profile.credits + profile.bonus_credits : "…"}`}
        </p>
      </div>
    </div>
  );
}

function Bubble({ role, content, onRegen }: { role: string; content: string; onRegen?: (() => void) | undefined }) {
  if (role === "user")
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-ss-sm bg-primary px-4 py-2.5 text-primary-foreground">{content}</div>
      </div>
    );
  return (
    <div className="group min-w-0">
      <div className="prose-worm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>
      <div className="mt-1 flex gap-1 opacity-70 transition group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => { navigator.clipboard.writeText(content); toast.success("تم النسخ"); }} aria-label="نسخ"><Copy className="size-3.5" /></Button>
        {onRegen && <Button variant="ghost" size="icon" className="size-7" onClick={onRegen} aria-label="إعادة التوليد"><RefreshCw className="size-3.5" /></Button>}
      </div>
    </div>
  );
}
