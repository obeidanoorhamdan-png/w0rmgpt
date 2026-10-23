import { createFileRoute } from "@tanstack/react-router";

async function handle({ request }: { request: Request }) {
  const { handleSubscriptions } = await import("@/lib/subscriptions-api.server");
  return handleSubscriptions(request, process.env["SUBSCRIPTIONS_API_KEY"]);
}

export const Route = createFileRoute("/api/public/subscriptions")({
  server: { handlers: { GET: handle, POST: handle, PATCH: handle, DELETE: handle } },
});