import "server-only";
import type { BillingSubscription } from "@prisma/client";
import { db } from "@/lib/db";

/** Adds one calendar month, used to extend access after each successful monthly charge. */
export function addMonth(from: Date): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/**
 * Marks a LiqPay/Monobank subscription as paid through `periodEnd` and makes it the
 * user's current plan. A previous LiqPay/Monobank subscription is cancelled at the
 * provider so a plan switch never double-charges.
 */
export async function activateSubscription(
  sub: BillingSubscription,
  periodEnd: Date,
  cancelPrevious: (previous: BillingSubscription) => Promise<void>,
): Promise<void> {
  await db.billingSubscription.update({ where: { id: sub.id }, data: { status: "active", currentPeriodEnd: periodEnd } });

  const user = await db.user.findUnique({ where: { id: sub.userId } });
  if (!user) return;

  if (user.subscriptionRef && user.subscriptionRef !== sub.id) {
    const previous = await db.billingSubscription.findUnique({ where: { id: user.subscriptionRef } });
    if (previous && previous.status !== "canceled") {
      try {
        await cancelPrevious(previous);
      } catch (err) {
        console.error(`Could not cancel replaced subscription ${previous.id}:`, err);
      }
      await db.billingSubscription.update({ where: { id: previous.id }, data: { status: "canceled" } });
    }
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      plan: sub.plan,
      subscriptionStatus: "active",
      billingProvider: sub.provider,
      subscriptionRef: sub.id,
      currentPeriodEnd: periodEnd,
    },
  });
}

/** Records a failed renewal or a cancellation; the user keeps access until the paid period ends. */
export async function updateSubscriptionStatus(
  sub: BillingSubscription,
  status: "past_due" | "canceled",
  periodEnd?: Date,
): Promise<void> {
  await db.billingSubscription.update({
    where: { id: sub.id },
    data: { status, ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) },
  });
  await db.user.updateMany({
    where: { id: sub.userId, subscriptionRef: sub.id },
    data: { subscriptionStatus: status, ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) },
  });
}
