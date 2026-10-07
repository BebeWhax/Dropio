import "server-only";
import { db } from "@/lib/db";
import type { Plan } from "@/lib/plans";

export type UsageKind = "search" | "analysis";

export class QuotaExceededError extends Error {
  constructor(
    readonly kind: UsageKind,
    readonly limit: number,
  ) {
    super(`Daily ${kind} limit reached (${limit}/day). Upgrade your plan or try again tomorrow.`);
  }
}

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function limitFor(plan: Plan, kind: UsageKind): number {
  return kind === "search" ? plan.searchesPerDay : plan.analysesPerDay;
}

export async function getUsageToday(userId: string): Promise<Record<UsageKind, number>> {
  const since = startOfUtcDay();
  const [search, analysis] = await Promise.all([
    db.usageEvent.count({ where: { userId, kind: "search", createdAt: { gte: since } } }),
    db.usageEvent.count({ where: { userId, kind: "analysis", createdAt: { gte: since } } }),
  ]);
  return { search, analysis };
}

/**
 * Records one unit of usage, or throws when the plan's daily limit is used up.
 * Repeating the same request (same `ref`) today is free, so reloads don't count.
 */
export async function consumeQuota(userId: string, plan: Plan, kind: UsageKind, ref: string): Promise<void> {
  const since = startOfUtcDay();
  const repeat = await db.usageEvent.findFirst({ where: { userId, kind, ref, createdAt: { gte: since } } });
  if (repeat) return;

  const used = await db.usageEvent.count({ where: { userId, kind, createdAt: { gte: since } } });
  const limit = limitFor(plan, kind);
  if (used >= limit) throw new QuotaExceededError(kind, limit);

  await db.usageEvent.create({ data: { userId, kind, ref } });
}
