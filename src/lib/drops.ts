// Pure drop rules shared by the Telegram bot and tests.
export const DROP_KINDS = {
  normal: "دروب عادي",
  sequential: "دروب تسلسلي",
  conditional: "دروب بشرط",
  auction: "دروب بمزاد",
  vote: "دروب بتصويت",
  points: "دروب نقاط",
} as const;
export type DropKind = keyof typeof DROP_KINDS;

export type Entry = { tg_id: number; amount: number; choice: number | null; created_at: string };

function shuffle<T>(arr: T[], rand: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Returns winner tg_ids for a drop at close time. */
export function pickWinners(kind: string, entries: Entry[], count: number, rand: () => number = Math.random): number[] {
  const n = Math.max(1, count);
  if (kind === "sequential") {
    return [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, n).map((e) => e.tg_id);
  }
  if (kind === "auction") {
    return [...entries].filter((e) => e.amount > 0)
      .sort((a, b) => b.amount - a.amount || a.created_at.localeCompare(b.created_at))
      .slice(0, n).map((e) => e.tg_id);
  }
  if (kind === "vote") {
    const tally = new Map<number, number>();
    for (const e of entries) if (e.choice !== null) tally.set(e.choice, (tally.get(e.choice) ?? 0) + 1);
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
    if (top === undefined) return [];
    return shuffle(entries.filter((e) => e.choice === top), rand).slice(0, n).map((e) => e.tg_id);
  }
  return shuffle(entries, rand).slice(0, n).map((e) => e.tg_id);
}

/** Why a user cannot join a conditional/points drop, or null when allowed. */
export function joinBlocker(
  drop: { kind: string; entry_cost: number; min_points: number; min_referrals: number },
  user: { points: number; referrals: number },
): string | null {
  if (drop.kind === "conditional") {
    if (user.points < drop.min_points) return `تحتاج ${drop.min_points} نقطة على الأقل`;
    if (user.referrals < drop.min_referrals) return `تحتاج ${drop.min_referrals} إحالة على الأقل`;
  }
  if (drop.kind === "points" && user.points < drop.entry_cost) return `الدخول يكلّف ${drop.entry_cost} نقطة`;
  return null;
}

export function parseAdminIds(raw: string) {
  return raw.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^\d+$/.test(s)).map(Number);
}
