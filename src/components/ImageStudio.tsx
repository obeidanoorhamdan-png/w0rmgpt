import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImagePlus, Loader2, Sparkles, Trash2, ArrowUpRight, Palette, Camera, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { streamImage } from "@/lib/stream-image";

export function ImageStudio() {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [final, setFinal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: images = [] } = useQuery({ queryKey: ["images"], queryFn: async () => {
    const { data, error } = await supabase.from("generated_images").select("*").order("created_at", { ascending: false }).limit(24);
    if (error) throw error;
    return data;
  } });

  async function generate() {
    if (busy || !prompt.trim()) return;
    setBusy(true); setFrame(null); setFinal(false); setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("سجّل الدخول مجدداً");
      let completed: string | null = null;
      await streamImage("/api/generate-image", { prompt, size, quality }, (url, done) => {
        setFrame(url); setFinal(done); if (done) completed = url;
      }, undefined, { Authorization: `Bearer ${data.session.access_token}` });
      if (completed) {
        const { error: saveError } = await supabase.from("generated_images").insert({ user_id: data.session.user.id, prompt, image_data: completed });
        if (saveError) throw new Error("تم إنشاء الصورة، لكن تعذر حفظها؛ يمكنك تنزيلها الآن");
        await qc.invalidateQueries({ queryKey: ["images"] });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر إنشاء الصورة"); }
    finally { setBusy(false); }
  }

  function download(url: string) {
    const a = document.createElement("a"); a.href = url; a.download = "worm-gpt-image.png"; a.click();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("generated_images").delete().eq("id", id);
    if (error) setError("تعذر حذف الصورة");
    else void qc.invalidateQueries({ queryKey: ["images"] });
  }

  return <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex items-center justify-between gap-3 border-b pb-6"><div><span className="text-xs font-semibold text-violet" dir="ltr">WORM GPT / IMAGES</span><h1 className="mt-2 text-3xl font-bold">استوديو الصور</h1></div><ImagePlus className="size-8 text-violet" /></header>
      <div className="mb-5 flex flex-wrap gap-2">{[{ icon: Camera, label: "تصوير واقعي", text: "صورة فوتوغرافية واقعية عالية التفاصيل لـ " }, { icon: Palette, label: "رسم إبداعي", text: "رسم فني بأسلوب رقمي بألوان متناغمة لـ " }, { icon: Box, label: "تصميم منتج", text: "تصوير منتج احترافي بإضاءة استوديو وخلفية نظيفة لـ " }].map(({ icon: Icon, label, text }) => <Button key={label} variant="outline" size="sm" disabled={busy} onClick={() => setPrompt(text)}><Icon className="text-violet" />{label}<ArrowUpRight className="text-muted-foreground" /></Button>)}</div>
      <Textarea aria-label="وصف الصورة" placeholder="ما الصورة التي تتخيلها؟" value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-32 resize-y bg-card" disabled={busy} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Select value={size} onValueChange={setSize} disabled={busy}><SelectTrigger className="w-40" aria-label="أبعاد الصورة"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1024x1024">مربعة · 1:1</SelectItem><SelectItem value="1536x1024">أفقية · 3:2</SelectItem><SelectItem value="1024x1536">عمودية · 2:3</SelectItem></SelectContent></Select>
        <Select value={quality} onValueChange={setQuality} disabled={busy}><SelectTrigger className="w-36" aria-label="جودة الصورة"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">سريعة</SelectItem><SelectItem value="medium">متوازنة</SelectItem><SelectItem value="high">عالية</SelectItem></SelectContent></Select>
        <Button onClick={generate} disabled={busy || !prompt.trim()} className="ms-auto">{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {busy ? "جارٍ الإنشاء…" : "إنشاء صورة"}</Button>
      </div>
      {error && <p role="alert" className="mt-4 break-words text-sm text-destructive">{error}</p>}
      {frame && <div className="mt-8"><img src={frame} alt={prompt} className={`mx-auto max-h-[600px] max-w-full rounded-lg object-contain transition-[filter] ${final ? "blur-0" : "blur-2xl"}`} />{final && <Button variant="outline" className="mt-3" onClick={() => download(frame)}><Download className="size-4" /> تنزيل الصورة</Button>}</div>}
      {images.length > 0 && <><div className="mb-4 mt-10 flex items-center justify-between border-b pb-3"><h2 className="text-lg font-bold">صورك</h2><span className="text-xs text-muted-foreground">{images.length} صورة</span></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{images.map(image => <div key={image.id} className="overflow-hidden rounded-lg border bg-card"><img src={image.image_data} alt={image.prompt} className="aspect-square w-full object-cover" loading="lazy" /><div className="p-3"><p className="line-clamp-2 min-h-10 text-sm">{image.prompt}</p><div className="mt-3 flex gap-2"><Button variant="ghost" size="icon" aria-label="تنزيل الصورة" onClick={() => download(image.image_data)}><Download className="size-4" /></Button><Button variant="ghost" size="icon" aria-label="حذف الصورة" onClick={() => remove(image.id)}><Trash2 className="size-4" /></Button></div></div></div>)}</div></>}
    </div>
  </div>;
}