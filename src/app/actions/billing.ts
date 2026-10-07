"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { billingProviders, cancelBillingSubscription, isBillingProviderId, startUahCheckout } from "@/lib/billing";
import { getStripe, priceIdForPlan } from "@/lib/billing/stripe";
import { updateSubscriptionStatus } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { effectivePlan, PLANS, type PlanId } from "@/lib/plans";

function readPlan(formData: FormData): PlanId | null {
  const plan = formData.get("plan");
  return plan === "starter" || plan === "pro" ? plan : null;
}

export async function startCheckout(formData: FormData): Promise<void> {
  const user = await requireUser();
  const plan = readPlan(formData);
  const providerId = formData.get("provider") ?? "stripe";
  if (!plan || !isBillingProviderId(providerId)) redirect("/dashboard/billing?error=plan");
  const provider = billingProviders().find((p) => p.id === providerId)!;

  const current = effectivePlan(user);
  const hasPaidSubscription = current.id !== "free" && user.subscriptionStatus !== "canceled" && user.billingProvider !== "demo";
  // One provider at a time: switching providers requires cancelling first, so nobody is billed twice.
  if (hasPaidSubscription && user.billingProvider && user.billingProvider !== provider.id) {
    redirect("/dashboard/billing?error=switch-provider");
  }

  if (!provider.configured) {
    // Demo billing: lets you try paid plans locally without payment keys. Never in production.
    if (env.isProduction) redirect("/dashboard/billing?error=billing-not-configured");
    await db.user.update({
      where: { id: user.id },
      data: {
        plan,
        subscriptionStatus: "active",
        billingProvider: "demo",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    // The sidebar plan badge lives in the shared dashboard layout.
    revalidatePath("/dashboard", "layout");
    redirect(`/dashboard/billing?success=1&pay=${provider.id}`);
  }

  if (provider.id === "liqpay" || provider.id === "monobank") {
    // A same-provider plan change creates a new subscription; the old one is cancelled once it's paid.
    redirect(await startUahCheckout(provider.id, user.id, PLANS[plan]));
  }

  const stripe = getStripe()!;
  // Existing Stripe subscribers change plans in the Stripe portal to avoid double subscriptions.
  if (hasPaidSubscription && user.stripeCustomerId) {
    return openBillingPortal();
  }

  const price = priceIdForPlan(plan);
  if (!price) redirect("/dashboard/billing?error=price-missing");

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
    customerId = customer.id;
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { userId: user.id, plan } },
    allow_promotion_codes: true,
    success_url: `${env.appUrl}/dashboard/billing?success=1`,
    cancel_url: `${env.appUrl}/dashboard/billing?canceled=1`,
  });
  if (!session.url) redirect("/dashboard/billing?error=checkout");
  redirect(session.url);
}

export async function openBillingPortal(): Promise<void> {
  const user = await requireUser();
  const stripe = getStripe();
  if (!stripe || !user.stripeCustomerId) redirect("/dashboard/billing");

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.appUrl}/dashboard/billing`,
  });
  redirect(portal.url);
}

/** Cancels a LiqPay/Monobank subscription; access continues until the paid period ends. */
export async function cancelUahSubscription(): Promise<void> {
  const user = await requireUser();
  const sub = user.subscriptionRef
    ? await db.billingSubscription.findFirst({ where: { id: user.subscriptionRef, userId: user.id } })
    : null;
  if (!sub) redirect("/dashboard/billing");

  try {
    await cancelBillingSubscription(sub);
  } catch (err) {
    console.error("Cancel failed:", err);
    redirect("/dashboard/billing?error=cancel");
  }
  await updateSubscriptionStatus(sub, "canceled");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/billing?cancelled=1");
}

/** Demo-mode only: drops back to the free plan. */
export async function cancelDemoSubscription(): Promise<void> {
  const user = await requireUser();
  if (user.billingProvider !== "demo" || env.isProduction) redirect("/dashboard/billing");
  await db.user.update({
    where: { id: user.id },
    data: { plan: PLANS.free.id, subscriptionStatus: "canceled", currentPeriodEnd: null, billingProvider: null },
  });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/billing");
}
