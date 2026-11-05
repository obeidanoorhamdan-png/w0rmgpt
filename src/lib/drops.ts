// Pure drop / bot rules shared by the Telegram engine and tests. No I/O, no network.
export const DROP_KINDS = {
  normal: "دروب عادي",
  sequential: "دروب تسلسلي",
  conditional: "دروب بشرط",
  auction: "دروب بمزاد",
  vote: "دروب بتصويت",
  points: "دروب نقاط",
  egg: "دروب البيضة",
  lottery: "يانصيب التذاكر",
  reverse: "مزاد عكسي",
  first: "أسرع إجابة",
  quiz: "مسابقة أسئلة",
} as const;
export type DropKind = keyof typeof DROP_KINDS;

export const DROP_KIND_LIST = Object.keys(DROP_KINDS) as DropKind[];

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
  if (kind === "reverse") return reverseWinner(entries, n, rand);
  if (kind === "lottery") return lotteryWinner(entries, n, rand);
  if (kind === "first") {
    return [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, n).map((e) => e.tg_id);
  }
  if (kind === "quiz") {
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

/** Reverse auction: the lowest *unique* bid wins. */
export function reverseWinner(entries: Entry[], count = 1, rand: () => number = Math.random): number[] {
  const bids = entries.filter((e) => e.amount > 0);
  const seen = new Map<number, number>();
  for (const e of bids) seen.set(e.amount, (seen.get(e.amount) ?? 0) + 1);
  const unique = bids.filter((e) => seen.get(e.amount) === 1).sort((a, b) => a.amount - b.amount);
  if (!unique.length) return shuffle(bids, rand).slice(0, count).map((e) => e.tg_id);
  return unique.slice(0, Math.max(1, count)).map((e) => e.tg_id);
}

/** Lottery: each entry holds `amount` tickets, so a bigger holding is a bigger chance. */
export function lotteryWinner(entries: Entry[], count = 1, rand: () => number = Math.random): number[] {
  const pool = entries.filter((e) => e.amount > 0);
  const total = pool.reduce((s, e) => s + e.amount, 0);
  if (!total) return [];
  const out: number[] = [];
  const taken = new Set<number>();
  const n = Math.min(Math.max(1, count), pool.length);
  while (out.length < n) {
    let r = rand() * total;
    const hit = pool.find((e) => (r -= e.amount) <= 0 && !taken.has(e.tg_id)) ?? pool.find((e) => !taken.has(e.tg_id));
    if (!hit) break;
    taken.add(hit.tg_id);
    out.push(hit.tg_id);
  }
  return out;
}

/** Why a user cannot join a drop, or null when allowed. */
export function joinBlocker(
  drop: { kind: string; entry_cost: number; min_points: number; min_referrals: number; min_paid?: boolean; max_win_days?: number },
  user: { points: number; referrals: number; paid?: boolean; last_win_at?: string | null },
  now: number = Date.now(),
): string | null {
  if (drop.kind === "conditional") {
    if (user.points < drop.min_points) return `تحتاج ${drop.min_points} نقطة على الأقل`;
    if (user.referrals < drop.min_referrals) return `تحتاج ${drop.min_referrals} إحالة على الأقل`;
  }
  if ((drop.kind === "points" || drop.kind === "lottery" || drop.kind === "egg") && user.points < drop.entry_cost) {
    return `الدخول يكلّف ${drop.entry_cost} نقطة`;
  }
  if (drop.min_paid && !user.paid) return "هذا الدروب للمشتركين المدفوعين فقط";
  const block = winBlocker(user.last_win_at, drop.max_win_days ?? 0, now);
  if (block) return block;
  return null;
}

/** Anti-repeat: someone who just won cannot win again inside the window. */
export function winBlocker(lastWinAt: string | null | undefined, maxWinDays: number, now: number = Date.now()): string | null {
  if (!lastWinAt || maxWinDays <= 0) return null;
  const days = (now - new Date(lastWinAt).getTime()) / 86_400_000;
  if (days < maxWinDays) return `فزت مؤخراً، يمكنك المشاركة بعد ${Math.ceil(maxWinDays - days)} يوم`;
  return null;
}

export function parseAdminIds(raw: string) {
  return raw.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^\d+$/.test(s)).map(Number);
}

// ---------- random prizes (egg / wheel / daily box) ----------

/** Weighted pick over a prize list; higher weight = more likely. */
export function pickPrize<T extends { points?: number; weight?: number }>(prizes: T[], rand: () => number = Math.random): T | null {
  if (!prizes.length) return null;
  const total = prizes.reduce((s, p) => s + (p.weight ?? 1), 0);
  let r = rand() * total;
  for (const p of prizes) if ((r -= (p.weight ?? 1)) <= 0) return p;
  return prizes[prizes.length - 1] ?? null;
}

/** A random hex seed the admin can publish as proof of a fair draw. */
export function makeSeed(rand: () => number = Math.random) {
  return Array.from({ length: 16 }, () => Math.floor(rand() * 16).toString(16)).join("");
}

// ---------- daily streak / box ----------

/** Streak after today's check-in: +1 when yesterday, reset to 1 otherwise. */
export function nextStreak(lastCheckin: string | null, today: string, current: number): number {
  if (!lastCheckin) return 1;
  if (lastCheckin === today) return current;
  const diff = (new Date(today).getTime() - new Date(lastCheckin).getTime()) / 86_400_000;
  return Math.round(diff) === 1 ? current + 1 : 1;
}

/** Bonus for a streak: the highest configured threshold that was reached. */
export function streakBonus(bonus: { days: number; points: number }[], streak: number): number {
  return [...bonus].sort((a, b) => b.days - a.days).find((b) => streak >= b.days)?.points ?? 0;
}

export function hasClaimed(last: string | null | undefined, today: string) {
  return last === today;
}

// ---------- captcha + rate limit + duplicate detection ----------

export function makeCaptcha(rand: () => number = Math.random) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(rand() * chars.length)]).join("");
}

/** Sliding-one-minute window: allowed when under the limit. */
export function rateAllows(windowStart: number, now: number, count: number, limitPerMin: number) {
  if (limitPerMin <= 0) return { allowed: true, count: 0 };
  if (now - windowStart > 60_000) return { allowed: true, count: 1 };
  if (count >= limitPerMin) return { allowed: false, count, waitMs: 60_000 - (now - windowStart) };
  return { allowed: true, count: count + 1 };
}

/** Weak fingerprint: same display name and no username tends to mean the same person. */
export function dupKeyOf(u: { first_name?: string | null; username?: string | null }) {
  const name = (u.first_name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!name) return null;
  return u.username ? null : `${name}|${(u.username ?? "").length}`;
}

// ---------- referral tiers, contests, conversion ----------

export const REF_TIERS = [
  { key: "gold", label: "ذهبي", min: 25, bonus: 3 },
  { key: "silver", label: "فضي", min: 10, bonus: 2 },
  { key: "bronze", label: "برونزي", min: 0, bonus: 1 },
] as const;

export function refTier(referrals: number) {
  return REF_TIERS.find((t) => referrals >= t.min) ?? REF_TIERS[REF_TIERS.length - 1]!;
}

/** Multiply a referral reward by the referrer's tier bonus. */
export function tierReward(base: number, referrals: number) {
  return Math.round(base * refTier(referrals).bonus);
}

/** Top N by a numeric metric, ties broken by earliest join. */
export function rankBy<T extends { created_at: string }>(rows: T[], metric: (r: T) => number, count = 10): T[] {
  return [...rows].sort((a, b) => metric(b) - metric(a) || a.created_at.localeCompare(b.created_at)).slice(0, count);
}

/** Share of referrers whose referred friends actually bought. */
export function conversionRate(referrals: number, purchases: number) {
  if (!referrals) return 0;
  return Math.round((purchases / referrals) * 100);
}

// ---------- store maths ----------

export function discountAmount(amount: number, percent: number) {
  const p = Math.min(100, Math.max(0, percent));
  return Math.round((amount * p) / 100);
}

export function pointsToDays(points: number, pointsPerDay: number) {
  if (pointsPerDay <= 0) return 0;
  return Math.floor(points / pointsPerDay);
}

export function daysToPoints(days: number, pointsPerDay: number) {
  return Math.max(0, days) * Math.max(1, pointsPerDay);
}

/** A pending invoice expires after `minutes`; used to auto-cancel unpaid orders. */
export function invoiceExpired(createdAt: string, minutes: number, now: number = Date.now()) {
  return now - new Date(createdAt).getTime() > minutes * 60_000;
}

/** Receipt text for a finished purchase. */
export function receiptText(o: {
  label: string; price: string; method: string; gift_code?: string | null; discount?: number; coupon?: string | null;
}) {
  const lines = [
    "🧾 <b>إيصال WORM GPT</b>",
    `الخطة: ${o.label}`,
    `السعر: ${o.price}`,
    o.discount ? `الخصم: ${o.discount}%${o.coupon ? ` (كوبون ${o.coupon})` : ""}` : "",
    `طريقة الدفع: ${o.method}`,
    o.gift_code ? `كود التفعيل: <code>${o.gift_code}</code>` : "",
    `التاريخ: ${new Date().toLocaleString("ar", { timeZone: "Asia/Hebron" })}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Repeat scheduling: the next run for a daily/weekly drop. */
export function nextRun(repeat: string, from: number): number | null {
  if (repeat === "daily") return from + 86_400_000;
  if (repeat === "weekly") return from + 7 * 86_400_000;
  return null;
}

/** Whether a scheduled drop is due for its recurring run. */
export function repeatDue(repeat: string, lastRun: string | null, now: number = Date.now()) {
  const gap = repeat === "daily" ? 86_400_000 : repeat === "weekly" ? 7 * 86_400_000 : 0;
  if (!gap) return false;
  if (!lastRun) return true;
  return now - new Date(lastRun).getTime() >= gap;
}
