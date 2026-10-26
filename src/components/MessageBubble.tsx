import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Pencil, RefreshCw, Volume2, VolumeX, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WormLogo } from "@/components/WormLogo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ToolButton({ label, children, onClick, disabled = false }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" aria-label={label} onClick={onClick} disabled={disabled}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success("تم النسخ"); } catch { toast.error("تعذّر النسخ"); }
}

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return <div className="code-block relative" dir="ltr"><Button variant="ghost" size="sm" className="absolute right-2 top-2 z-10 bg-muted text-muted-foreground" aria-label="نسخ الكود" onClick={async (event) => {
    const text = event.currentTarget.parentElement?.querySelector("pre")?.textContent;
    if (!text) return;
    await copy(text); setCopied(true); setTimeout(() => setCopied(false), 1800);
  }}>{copied ? <Check /> : <Copy />}{copied ? "تم النسخ" : "نسخ الكود"}</Button><pre>{children}</pre></div>;
}

export function MessageBubble({ role, content, onRegen, onEdit, compact = false }: { role: string; content: string; onRegen?: (() => void) | undefined; onEdit?: (() => void) | undefined; compact?: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  function speak() {
    if (!("speechSynthesis" in window)) { toast.error("قراءة النص غير متاحة في هذا المتصفح"); return; }
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = /[\u0600-\u06ff]/.test(content) ? "ar" : "en";
    utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance); setSpeaking(true);
  }
  const user = role === "user";
  return <article className={`group min-w-0 ${compact ? "py-3" : "py-5"}`}>
    <div className="mb-3 flex items-center gap-2.5"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${user ? "bg-muted text-muted-foreground" : "bg-primary/10"}`}>{user ? <User className="size-4" /> : <WormLogo size={26} withText={false} />}</span><span className="text-xs font-bold" dir={user ? "rtl" : "ltr"}>{user ? "أنت" : "WORM GPT"}</span>{!user && <span className="text-[10px] text-muted-foreground">المساعد</span>}</div>
    <div className="min-w-0 ps-0 sm:ps-10">{user ? <div className="w-fit max-w-full whitespace-pre-wrap break-words rounded-lg border bg-muted/50 px-4 py-3 text-sm leading-7" dir="auto">{content}</div> : <div className="prose-worm text-sm leading-8" dir="auto"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock, table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div> }}>{content}</ReactMarkdown></div>}
      <div className="mt-2 flex gap-0.5"><ToolButton label="نسخ الرسالة" onClick={() => void copy(content)}><Copy /></ToolButton>{onEdit && <ToolButton label="تحرير وإرسال مجدداً" onClick={onEdit}><Pencil /></ToolButton>}{!user && <ToolButton label={speaking ? "إيقاف القراءة" : "قراءة الرد"} onClick={speak}>{speaking ? <VolumeX /> : <Volume2 />}</ToolButton>}{onRegen && <ToolButton label="إعادة توليد الرد" onClick={onRegen}><RefreshCw /></ToolButton>}</div>
    </div>
  </article>;
}