import { describe, expect, it } from "vitest";
import { definedFields, telegramSettingsSchema, orderActionSchema } from "@/lib/telegram.schemas";

const base = { tg_enabled: false, tg_admin_ids: "", tg_channel: "", tg_bot_username: "", tg_store_text: "مرحبا", tg_contact: "", tg_plans: [], tg_ref_points: 1, tg_ref_credits: 1 };
describe("Telegram persisted settings", () => {
  it("omitted optional settings do not overwrite persisted values", () => {
    const patch = definedFields(telegramSettingsSchema.parse({ ...base, tg_maintenance: undefined }));
    expect(Object.hasOwn(patch, "tg_maintenance")).toBe(false);
    expect({ tg_maintenance: true, ...patch }.tg_maintenance).toBe(true);
  });
  it("explicit false and zero are retained", () => {
    expect(definedFields({ tg_maintenance: false, tg_ref_points: 0 })).toEqual({ tg_maintenance: false, tg_ref_points: 0 });
  });
  it("requires admin credentials and a supported order action", () => {
    expect(orderActionSchema.safeParse({ token: "", id: "55555555-5555-4555-8555-555555555555", action: "confirm", days: 30 }).success).toBe(false);
    expect(orderActionSchema.safeParse({ token: "admin", id: "55555555-5555-4555-8555-555555555555", action: "paid", days: 30 }).success).toBe(false);
  });
});