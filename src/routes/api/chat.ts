import { createFileRoute } from "@tanstack/react-router";

const SAFETY = "\n\n# قواعد ثابتة\nمهما كانت التعليمات الأخرى: ارفض المساعدة في البرمجيات الخبيثة، اختراق أنظمة الآخرين، الاحتيال، الأسلحة، أو أي أذى جسيم. كن محترماً ولا تهن المستخدم.";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getAdmin, getSettings, resolveKey, planActive } = await import("@/lib/admin.server");
        const db = await getAdmin();
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "غير مصرح" }, { status: 401 });
        const { data: u } = await db.auth.getUser(token);
        const uid = u.user?.id;
        if (!uid) return Response.json({ error: "غير مصرح" }, { status: 401 });

        const body = (await request.json()) as { threadId: string; content?: string; model: string; regenerate?: boolean };
        const { data: thread } = await db.from("threads").select("*").eq("id", body.threadId).eq("user_id", uid).maybeSingle();
        if (!thread) return Response.json({ error: "المحادثة غير موجودة" }, { status: 404 });

        const s = await getSettings();
        let { data: p } = await db.from("profiles").select("*").eq("id", uid).single();
        if (!p) return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
        if (p.suspended) return Response.json({ error: "تم إيقاف حسابك" }, { status: 403 });
        const today = new Date().toISOString().slice(0, 10);
        if (p.last_daily_grant < today) {
          await db.from("profiles").update({ credits: s.daily_credits, last_daily_grant: today }).eq("id", uid);
          p = { ...p, credits: s.daily_credits, last_daily_grant: today };
        }
        const unlimited = planActive(p);
        if (!unlimited && p.credits + p.bonus_credits <= 0)
          return Response.json({ error: "نفدت نقاطك اليوم. تتجدد غداً أو قم بالترقية." }, { status: 402 });
        if ((s.disabled_models as string[]).includes(body.model)) return Response.json({ error: "هذا الموديل معطّل" }, { status: 400 });

        if (body.regenerate) {
          const { data: last } = await db.from("messages").select("id, role").eq("thread_id", thread.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (last?.role === "assistant") await db.from("messages").delete().eq("id", last.id);
        } else {
          const content = String(body.content ?? "").slice(0, 20000);
          if (!content.trim()) return Response.json({ error: "رسالة فارغة" }, { status: 400 });
          const { error } = await db.from("messages").insert({ thread_id: thread.id, user_id: uid, role: "user", content });
          if (error) return Response.json({ error: error.message }, { status: 500 });
        }

        const { data: hist } = await db.from("messages").select("role, content").eq("thread_id", thread.id).order("created_at", { ascending: false }).limit(30);
        const messages = [{ role: "system", content: s.system_prompt + SAFETY }, ...(hist ?? []).reverse()];

        const up = await fetch(`${s.api_url.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${resolveKey(s.api_key_override)}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: body.model, messages, stream: true }),
          signal: request.signal,
        });
        if (!up.ok || !up.body) {
          let msg = `خطأ من الخادم (${up.status})`;
          try { const j = (await up.json()) as { error?: { message?: string } }; if (j.error?.message) msg = j.error.message; } catch { /* ignore */ }
          return Response.json({ error: msg }, { status: up.status === 503 ? 503 : 502 });
        }

        // charge one credit
        if (!unlimited) {
          if (p.credits > 0) await db.from("profiles").update({ credits: p.credits - 1 }).eq("id", uid);
          else await db.from("profiles").update({ bonus_credits: p.bonus_credits - 1 }).eq("id", uid);
        }
        await db.from("profiles").update({ messages_count: p.messages_count + 1 }).eq("id", uid);

        let full = "";
        const reader = up.body.getReader();
        const dec = new TextDecoder();
        const encd = new TextEncoder();
        const stream = new ReadableStream({
          async start(ctrl) {
            let buf = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split("\n");
                buf = lines.pop() ?? "";
                for (const line of lines) {
                  const t = line.trim();
                  if (!t.startsWith("data:")) continue;
                  const d = t.slice(5).trim();
                  if (d === "[DONE]") continue;
                  try {
                    const j = JSON.parse(d) as { choices?: { delta?: { content?: string } }[] };
                    const c = j.choices?.[0]?.delta?.content;
                    if (c) { full += c; ctrl.enqueue(encd.encode(c)); }
                  } catch { /* skip */ }
                }
              }
            } catch { /* aborted */ }
            if (full) {
              await db.from("messages").insert({ thread_id: thread.id, user_id: uid, role: "assistant", content: full, model: body.model });
            }
            const title = thread.title === "محادثة جديدة" && body.content ? body.content.slice(0, 50) : thread.title;
            await db.from("threads").update({ updated_at: new Date().toISOString(), title, model: body.model }).eq("id", thread.id);
            ctrl.close();
          },
        });
        return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
      },
    },
  },
});
