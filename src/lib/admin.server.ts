// Server-only helpers for the admin panel session token and settings access.
const enc = new TextEncoder();

async function hmac(data: string) {
  const secret = process.env["ADMIN_SESSION_SECRET"];
  if (!secret) throw new Error("Admin secret missing");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, "");
}

export async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signAdminToken() {
  const exp = String(Date.now() + 1000 * 60 * 60 * 12);
  return `${exp}.${await hmac(exp)}`;
}

export async function verifyAdminToken(token: string | undefined) {
  if (!token) throw new Error("غير مصرح");
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() || (await hmac(exp)) !== sig) throw new Error("انتهت الجلسة، سجّل الدخول مجدداً");
}

export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getSettings() {
  const db = await getAdmin();
  const { data, error } = await db.from("app_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("Settings missing");
  return data;
}

export function resolveKey(override: string | null) {
  return override?.trim() || process.env["WORM_API_KEY"] || "";
}

export function maskKey(k: string) {
  if (!k) return "غير مضبوط";
  return "•••••••••••• (مخفي)";
}

export async function fetchModels(apiUrl: string, key: string): Promise<{ id: string; name: string; type?: string | undefined }[]> {
  try {
    const r = await fetch(`${apiUrl.replace(/\/$/, "")}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return [];
    const j = (await r.json()) as { data?: { id: string; name?: string; type?: string }[] };
    return (j.data ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id, type: m.type }));
  } catch {
    return [];
  }
}

export function planActive(p: { plan: string; plan_expires_at: string | null }) {
  return p.plan !== "free" && !!p.plan_expires_at && new Date(p.plan_expires_at) > new Date();
}
