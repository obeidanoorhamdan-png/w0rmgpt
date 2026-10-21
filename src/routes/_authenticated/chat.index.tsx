import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/ChatView";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({
    meta: [
      { title: "محادثة جديدة — WORM GPT" },
      { name: "description", content: "ابدأ محادثة جديدة مع WORM GPT." },
      { property: "og:title", content: "محادثة جديدة — WORM GPT" },
      { property: "og:description", content: "ابدأ محادثة جديدة مع WORM GPT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ChatView threadId={null} />,
});
