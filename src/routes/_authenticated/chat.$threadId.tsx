import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/ChatView";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "محادثة — WORM GPT" },
      { name: "description", content: "محادثتك مع WORM GPT." },
      { property: "og:title", content: "محادثة — WORM GPT" },
      { property: "og:description", content: "محادثتك مع WORM GPT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Thread,
});

function Thread() {
  const { threadId } = Route.useParams();
  return <ChatView key={threadId} threadId={threadId} />;
}
