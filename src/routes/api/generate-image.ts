import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const inputSchema = z.object({
  prompt: z.string().trim().min(1).max(12000),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
  quality: z.enum(["low", "medium", "high"]).default("medium"),
  stream: z.boolean().default(true),
});

export const Route = createFileRoute("/api/generate-image")({
  server: { handlers: { POST: async ({ request }) => {
    const { authorizeMedia, assertServiceAvailable, pauseService } = await import("@/lib/media-access.server");
    try {
      await authorizeMedia(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    } catch {
      return Response.json({ message: "الحساب غير متاح أو انتهت الجلسة" }, { status: 401 });
    }
    try { await assertServiceAvailable("images"); } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "الخدمة متوقفة" }, { status: 403 });
    }
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: "وصف الصورة أو إعداداتها غير صالح" }, { status: 400 });
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return Response.json({ message: "خدمة الصور غير مهيأة" }, { status: 500 });
    const { generateImage, imageSettings } = await import("@/lib/image-gateway.server");
    const { prompt, stream, size, quality } = parsed.data;
    const upstream = await generateImage({ ...imageSettings, apiKey: key }, prompt, stream, undefined, { size, quality });
    if (upstream.status === 402 || upstream.status === 403) {
      const payload = await upstream.clone().json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
      await pauseService("images", upstream.status, payload?.message ?? payload?.error?.message ?? "خدمة الصور متوقفة؛ راجع إعدادات الخدمة");
    }
    return new Response(upstream.body, { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store",
    } });
  } } },
});