import { queryOptions } from "@tanstack/react-query";
import { getAppInfo } from "@/lib/app.functions";
import { supabase } from "@/integrations/supabase/client";

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    await supabase.rpc("claim_daily");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("no user");
    const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).single();
    if (error) throw error;
    return data;
  },
});

export const threadsQuery = queryOptions({
  queryKey: ["threads"],
  queryFn: async () => {
    const { data, error } = await supabase.from("threads").select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const messagesQuery = (threadId: string) =>
  queryOptions({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

export function isPlanActive(p: { plan: string; plan_expires_at: string | null }) {
  return p.plan !== "free" && !!p.plan_expires_at && new Date(p.plan_expires_at) > new Date();
}

export const PLAN_LABEL: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", ultra: "Ultra" };

export const appInfoQuery = queryOptions({ queryKey: ["appInfo"], queryFn: () => getAppInfo(), staleTime: 60_000 });
