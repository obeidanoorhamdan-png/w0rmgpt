import { createFileRoute } from "@tanstack/react-router";
import { ImageStudio } from "@/components/ImageStudio";
export const Route = createFileRoute("/_authenticated/images")({
  head: () => ({ meta: [
    { title: "استوديو الصور — WORM GPT" }, { name: "description", content: "أنشئ صورك بالذكاء الاصطناعي واحفظها في WORM GPT." },
    { property: "og:title", content: "استوديو الصور — WORM GPT" }, { property: "og:description", content: "صور من أفكارك مع WORM GPT." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ImageStudio,
});