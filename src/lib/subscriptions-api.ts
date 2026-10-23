import { z } from "zod";

export const subscriptionCodeSchema = z.string().trim().min(4).max(80).regex(/^[A-Za-z0-9_-]+$/);
export const subscriptionCreateSchema = z.object({
  code: subscriptionCodeSchema.optional(),
  plan: z.enum(["plus", "pro", "ultra"]),
  days: z.number().int().min(1).max(3650),
  max_uses: z.number().int().min(1).max(100000).default(1),
}).strict();
export const subscriptionUpdateSchema = subscriptionCreateSchema.omit({ code: true }).partial().refine(value => Object.keys(value).length > 0);

export async function validSalesKey(provided: string, expected: string | undefined) {
  if (!expected || !provided) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(expected), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode("subscription-sales-access"));
  const candidate = await crypto.subtle.importKey("raw", encoder.encode(provided), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", candidate, signature, encoder.encode("subscription-sales-access"));
}