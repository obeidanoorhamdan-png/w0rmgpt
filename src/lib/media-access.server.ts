export async function authorizeMedia(token: unknown) {
  if (typeof token !== "string" || !token) throw new Error("سجّل الدخول أولاً");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data.user) throw new Error("انتهت الجلسة، سجّل الدخول مجدداً");
  const { data: profile, error } = await supabaseAdmin.from("profiles").select("suspended").eq("id", data.user.id).single();
  if (error || !profile || profile.suspended) throw new Error("الحساب غير متاح");
  return data.user.id;
}

export async function assertServiceAvailable(service: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("ai_service_state").select("reason").eq("service", service).maybeSingle();
  if (error) throw new Error("تعذر التحقق من حالة الخدمة");
  if (data) throw new Error(data.reason);
}

export async function pauseService(service: string, status: number, reason: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("ai_service_state").upsert({ service, status, reason });
  if (error) throw new Error("تعذر حفظ حالة توقف الخدمة");
}