import { describe, expect, it } from "vitest";
import { subscriptionCreateSchema, subscriptionUpdateSchema, validSalesKey } from "@/lib/subscriptions-api";

describe("Sales-site subscriptions", () => {
  it("allows subscription creation for Plus, Pro and Ultra", () => {
    for (const plan of ["plus", "pro", "ultra"]) expect(subscriptionCreateSchema.parse({ plan, days: 30 }).plan).toBe(plan);
    expect(subscriptionCreateSchema.safeParse({ plan: "admin", days: 30 }).success).toBe(false);
  });
  it("allows updates without permitting usage-counter changes", () => {
    expect(subscriptionUpdateSchema.safeParse({ days: 365 }).success).toBe(true);
    expect(subscriptionUpdateSchema.safeParse({ uses: 0 }).success).toBe(false);
  });
  it("requires the matching sales-site key", async () => {
    expect(await validSalesKey("test-sales-key", "test-sales-key")).toBe(true);
    expect(await validSalesKey("wrong-key", "test-sales-key")).toBe(false);
    expect(await validSalesKey("test-sales-key", undefined)).toBe(false);
  });
});