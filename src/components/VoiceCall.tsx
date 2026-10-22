import { useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Play, AudioLines } from "lucide-react";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WormLogo } from "@/components/WormLogo";

type Caption = { role: "user" | "assistant"; text: string; start: number; end: number };
export function VoiceCall() {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  function onEvent(event: LiveEvent) {
    if (event.type === "app.delegation.pending") setPending(true);
    if (event.type === "session.output_transcript.delta") setPending(false);
    if (event.type === "app.closed" || event.type === "app.error") setPending(false);
    if ((event.type === "session.usage.updated" || event.type === "session.closed") && typeof event.usage?.seconds === "number") setSeconds(Math.max(15, event.usage.seconds));
    if (event.type === "gateway.session.created") setSeconds(15);
    if ((event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") && typeof event.delta === "string") {
      const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
      const start = typeof event.start_ms === "number" ? event.start_ms : 0;
      const end = typeof event.end_ms === "number" ? event.end_ms : start;
      const text = event.delta;
      setCaptions(previous => {
        const rows = [...previous];
        const index = rows.findLastIndex(row => row.role === role && start <= row.end + 1000 && end >= row.start);
        if (index >= 0) { const row = rows[index]; if (row) rows[index] = { ...row, text: row.text + text, end: Math.max(end, row.end) }; }
        else rows.push({ role, text, start, end });
        return rows.sort((a, b) => a.start - b.start);
      });
    }
  }
  const voice = useLiveVoice({ onEvent, getAccessToken: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("سجّل الدخول مجدداً");
    return data.session.access_token;
  } });
  const canStart = voice.status === "idle" || voice.status === "closed";
  const labels = { idle: "جاهز للمحادثة", connecting: "جارٍ الاتصال…", connected: "متصل الآن", stopping: "جارٍ إنهاء المكالمة…", closed: "انتهت المكالمة" };
  return <div className="flex h-full flex-col overflow-y-auto px-5 py-8">
    <header className="mx-auto w-full max-w-3xl"><h1 className="flex items-center gap-2 text-xl font-bold"><AudioLines className="size-6 text-primary" /> المحادثة الصوتية</h1><p className="mt-1 text-sm text-muted-foreground" dir="ltr">WORM GPT · GPT Live</p></header>
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center py-12">
      <div className={`voice-emblem ${voice.status === "connected" ? "is-connected" : ""}`}><WormLogo size={112} withText={false} /></div>
      <p role="status" className="mt-8 text-lg font-semibold">{labels[voice.status]}</p>
      {pending && <p className="mt-2 text-sm text-muted-foreground">جارٍ التفكير…</p>}
      <audio ref={voice.audioRef} controls className="mt-5 h-10 w-full max-w-xs" />
      <div className="mt-6 flex items-center gap-3">
        {canStart ? <Button onClick={() => { setCaptions([]); setSeconds(null); voice.start(); }}><Phone className="size-4" /> بدء المكالمة</Button> : <Button variant="destructive" onClick={voice.stop} disabled={voice.status === "stopping"}><PhoneOff className="size-4" /> إنهاء المكالمة</Button>}
        <Button variant="outline" size="icon" disabled={voice.status !== "connected"} onClick={() => voice.setMuted(!voice.muted)} aria-label={voice.muted ? "تشغيل الميكروفون" : "كتم الميكروفون"}>{voice.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}</Button>
        {voice.playbackBlocked && <Button variant="outline" onClick={voice.resumePlayback}><Play className="size-4" /> تشغيل الصوت</Button>}
      </div>
      {seconds !== null && <p className="mt-4 text-xs text-muted-foreground">مدة الاستخدام المؤكدة: {Math.ceil(seconds)} ثانية{voice.finalized === false ? " · الإجمالي النهائي غير مؤكد" : ""}</p>}
      {voice.error && <p role="alert" className="mt-5 max-w-xl break-words text-center text-sm text-destructive">{voice.error}</p>}
    </div>
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">{captions.map((row, i) => <div key={`${row.role}-${row.start}-${i}`} className="border-s-2 border-border ps-4"><p className="mb-1 text-xs font-semibold text-muted-foreground">{row.role === "user" ? "أنت" : "WORM GPT"}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{row.text}</p></div>)}</div>
  </div>;
}