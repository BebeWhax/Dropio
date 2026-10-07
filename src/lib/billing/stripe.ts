import "server-only";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { PlanId } from "@/lib/plans";

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!env.stripeSecretKey) return null;
  client ??= new Stripe(env.stripeSecretKey);
  return client;
}

export function priceIdForPlan(plan: PlanId): string | undefined {
  if (plan === "starter") return env.stripePriceStarter;
  if (plan === "pro") return env.stripePricePro;
  return undefined;
}

function planForPriceId(priceId: string | undefined): PlanId | null {
  if (priceId && priceId === env.stripePriceStarter) return "starter";
  if (priceId && priceId === env.stripePricePro) return "pro";
  return null;
}

/** Mirrors a Stripe subscription onto the user record. Called from the webhook. */
export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const user =
    (await db.user.findUnique({ where: { stripeCustomerId: customerId } })) ??
    (subscription.metadata?.userId
      ? await db.user.findUnique({ where: { id: subscription.metadata.userId } })
      : null);
  if (!user) {
    console.warn(`Stripe subscription ${subscription.id} has no matching user`);
    return;
  }

  const item = subscription.items.data[0];
  const plan = planForPriceId(item?.price.id);
  const ended = subscription.status === "canceled" || subscription.status === "incomplete_expired";

  // Ignore stale events for a Stripe subscription the user has since replaced (e.g. moved to LiqPay).
  if (user.subscriptionRef && user.subscriptionRef !== subscription.id && ended) return;

  await db.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customerId,
      billingProvider: "stripe",
      subscriptionRef: ended ? null : subscription.id,
      plan: ended || !plan ? "free" : plan,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    },
  });
}
