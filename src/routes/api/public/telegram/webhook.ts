import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { webhookSecret, handleUpdate } = await import("@/lib/telegram.server");
        const expected = await webhookSecret();
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!process.env["TELEGRAM_API_KEY"] || actual.length !== expected.length || actual !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const update = await request.json().catch(() => null);
        if (!update || typeof update.update_id !== "number") return Response.json({ ok: true });
        try { await handleUpdate(update); } catch (e) { console.error("telegram update failed", e); }
        return Response.json({ ok: true });
      },
    },
  },
});
