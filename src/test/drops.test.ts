import { describe, expect, it } from "vitest";
import { joinBlocker, parseAdminIds, pickWinners } from "@/lib/drops";

const e = (tg_id: number, amount = 0, choice: number | null = null, t = tg_id) => ({ tg_id, amount, choice, created_at: `2026-01-01T00:00:${String(t).padStart(2, "0")}Z` });

describe("drops", () => {
  it("sequential: first joiners win", () => {
    expect(pickWinners("sequential", [e(3), e(1), e(2)], 2)).toEqual([1, 2]);
  });
  it("auction: highest bids win", () => {
    expect(pickWinners("auction", [e(1, 5), e(2, 20), e(3, 10)], 2)).toEqual([2, 3]);
  });
  it("vote: winners come from the most voted option", () => {
    const w = pickWinners("vote", [e(1, 0, 0), e(2, 0, 1), e(3, 0, 1)], 5);
    expect(w.sort()).toEqual([2, 3]);
  });
  it("points drop blocks users without enough points", () => {
    expect(joinBlocker({ kind: "points", entry_cost: 5, min_points: 0, min_referrals: 0 }, { points: 4, referrals: 0 })).not.toBeNull();
    expect(joinBlocker({ kind: "points", entry_cost: 5, min_points: 0, min_referrals: 0 }, { points: 5, referrals: 0 })).toBeNull();
  });
  it("conditional drop requires referrals", () => {
    expect(joinBlocker({ kind: "conditional", entry_cost: 0, min_points: 0, min_referrals: 3 }, { points: 9, referrals: 2 })).not.toBeNull();
  });
  it("parses admin ids", () => {
    expect(parseAdminIds("123, 456 abc")).toEqual([123, 456]);
  });
});
