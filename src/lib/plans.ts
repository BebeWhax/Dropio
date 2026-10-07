export type PlanId = "free" | "starter" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  /** Fixed monthly price for LiqPay / Monobank checkout, in hryvnia. */
  priceUah: number;
  tagline: string;
  searchesPerDay: number;
  analysesPerDay: number;
  /** How many countries one analysis may compare. */
  maxCountries: number;
  maxSaved: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    priceUah: 0,
    tagline: "Try the research workflow",
    searchesPerDay: 10,
    analysesPerDay: 3,
    maxCountries: 2,
    maxSaved: 5,
    features: ["Supplier product search", "Landed-cost margin per country", "Save up to 5 products"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceUsd: 19,
    priceUah: 799,
    tagline: "For new stores validating products",
    searchesPerDay: 150,
    analysesPerDay: 40,
    maxCountries: 4,
    maxSaved: 100,
    features: ["Compare 4 countries at once", "40 analyses per day", "Custom cost assumptions", "Watchlist of 100 products"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 49,
    priceUah: 1999,
    tagline: "For sellers scaling across markets",
    searchesPerDay: 1000,
    analysesPerDay: 250,
    maxCountries: 9,
    maxSaved: 1000,
    features: ["All 9 markets incl. Ukraine", "250 analyses per day", "Custom cost assumptions", "Watchlist of 1,000 products"],
  },
};

export const PAID_PLANS = [PLANS.starter, PLANS.pro];

/** Statuses that keep paid access (past_due gets a grace period while the provider retries). */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/** Extra time after a paid period ends before access is removed, covering late renewal callbacks. */
export const RENEWAL_GRACE_MS = 3 * 24 * 3600 * 1000;

export function effectivePlan(user: {
  plan: string;
  subscriptionStatus: string;
  currentPeriodEnd?: Date | null;
}): Plan {
  if (!(user.plan in PLANS) || user.plan === "free") return PLANS.free;
  const periodEnd = user.currentPeriodEnd?.getTime();
  const now = Date.now();

  const active = ACTIVE_STATUSES.has(user.subscriptionStatus) && (periodEnd === undefined || periodEnd + RENEWAL_GRACE_MS > now);
  // A cancelled subscription keeps working until the end of the period that was paid for.
  const paidThrough = user.subscriptionStatus === "canceled" && periodEnd !== undefined && periodEnd > now;
  return active || paidThrough ? PLANS[user.plan as PlanId] : PLANS.free;
}
