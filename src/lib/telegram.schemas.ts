import { z } from "zod";

export const telegramSettingsSchema = z.object({
  tg_enabled: z.boolean(),
  tg_admin_ids: z.string().max(500),
  tg_channel: z.string().max(100),
  tg_bot_username: z.string().max(100),
  tg_store_text: z.string().min(1).max(3000),
  tg_contact: z.string().max(100),
  tg_plans: z.array(z.object({ plan: z.string().max(20), label: z.string().max(50), price: z.string().max(50) })).max(10),
  tg_ref_points: z.number().int().min(0).max(1000),
  tg_ref_credits: z.number().int().min(0).max(1000),
  tg_maintenance: z.boolean().optional(),
  tg_maintenance_text: z.string().min(1).max(1000).optional(),
  tg_captcha_enabled: z.boolean().optional(),
  tg_rate_limit: z.number().int().min(1).max(120).optional(),
  tg_support_enabled: z.boolean().optional(),
  tg_require_channels: z.array(z.string().regex(/^@[A-Za-z0-9_]{5,32}$/)).max(10).optional(),
  tg_points_per_day: z.number().int().min(1).max(100000).optional(),
  tg_daily_box: z.array(z.object({ points: z.number().int().min(0).max(10000), weight: z.number().positive().max(1000) })).min(1).max(20).optional(),
  tg_spin_prizes: z.array(z.object({ points: z.number().int().min(0).max(10000), weight: z.number().positive().max(1000) })).min(1).max(20).optional(),
});

/** Missing optional settings must not overwrite previously saved settings. */
export function definedFields<T extends object>(value: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

export const orderActionSchema = z.object({
  token: z.string().min(1),
  id: z.string().uuid(),
  action: z.enum(["confirm", "cancel"]),
  days: z.number().int().min(1).max(3650),
});