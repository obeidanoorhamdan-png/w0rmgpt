import { createFileRoute } from "@tanstack/react-router";
import { VoiceCall } from "@/components/VoiceCall";
export const Route = createFileRoute("/_authenticated/voice")({
  head: () => ({ meta: [
    { title: "المحادثة الصوتية — WORM GPT" }, { name: "description", content: "تحدث مباشرة بالصوت مع مساعد WORM GPT." },
    { property: "og:title", content: "المحادثة الصوتية — WORM GPT" }, { property: "og:description", content: "محادثة صوتية مباشرة باللغة العربية." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: VoiceCall,
});