import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cancelDemoSubscription, cancelUahSubscription, openBillingPortal, startCheckout } from "@/app/actions/billing";
import { PlanCards } from "@/components/plan-cards";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { billingProviders, isBillingProviderId, type BillingProviderId } from "@/lib/billing";
import { env } from "@/lib/env";
import { effectivePlan } from "@/lib/plans";

export const metadata: Metadata = { title: "Plan & billing" };

const ERRORS: Record<string, string> = {
  "billing-not-configured": "This payment method isn't configured yet. Please contact support.",
  "price-missing": "This plan isn't available for purchase yet.",
  "switch-provider": "Cancel your current subscription before paying with a different method.",
  cancel: "We couldn't cancel the subscription with the payment provider. Please try again.",
  checkout: "Could not start checkout. Please try again.",
  plan: "Unknown plan.",
};

const PROVIDER_NAMES: Record<string, string> = { stripe: "card (Stripe)", liqpay: "LiqPay", monobank: "monobank", demo: "demo billing" };

export default function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  return (
    <>
      <PageHeader title="Plan & billing" description="Upgrade for more countries, analyses and custom cost settings." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Billing searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Billing({ searchParams }: Pick<PageProps<"/dashboard/billing">, "searchParams">) {
  const user = await requireUser();
  const plan = effectivePlan(user);
  const sp = await searchParams;
  const providers = billingProviders();
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;

  const subscribed = plan.id !== "free" && user.subscriptionStatus !== "canceled";
  // While subscribed, the payment method is fixed to the current provider.
  const lockedProvider = subscribed && isBillingProviderId(user.billingProvider) ? user.billingProvider : null;
  const pay: BillingProviderId = lockedProvider ?? (isBillingProviderId(sp.pay) ? sp.pay : "stripe");
  const provider = providers.find((p) => p.id === pay)!;
  const demo = !provider.configured && !env.isProduction;

  return (
    <>
      {sp.success && <Notice tone="success">Thanks! Your plan is active.</Notice>}
      {sp.pending && (
        <Notice tone="success">
          Payment received by {PROVIDER_NAMES[String(sp.provider)] ?? "the provider"}. Your plan activates as soon as the
          provider confirms it — usually within a minute. Refresh this page if it hasn&apos;t updated yet.
        </Notice>
      )}
      {sp.canceled && <Notice>Checkout canceled. You haven&apos;t been charged.</Notice>}
      {sp.cancelled && <Notice>Subscription cancelled. You keep your plan until the end of the paid period.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="text-xs font-medium text-muted">Current plan</div>
          <div className="text-xl font-semibold">{plan.name}</div>
          <div className="mt-1 text-sm text-muted">
            {plan.id === "free"
              ? "Free"
              : `${user.subscriptionStatus.replace("_", " ")} · paid with ${PROVIDER_NAMES[user.billingProvider ?? ""] ?? "—"}`}
            {user.currentPeriodEnd &&
              plan.id !== "free" &&
              ` · ${user.subscriptionStatus === "canceled" ? "ends" : "renews"} ${user.currentPeriodEnd.toISOString().slice(0, 10)}`}
          </div>
        </div>
        {subscribed && user.billingProvider === "stripe" && (
          <form action={openBillingPortal}>
            <SubmitButton className="btn-secondary" pendingText="Opening…">
              Manage subscription & invoices
            </SubmitButton>
          </form>
        )}
        {subscribed && (user.billingProvider === "liqpay" || user.billingProvider === "monobank") && (
          <form action={cancelUahSubscription}>
            <SubmitButton className="btn-secondary" pendingText="Cancelling…">
              Cancel subscription
            </SubmitButton>
          </form>
        )}
        {subscribed && user.billingProvider === "demo" && (
          <form action={cancelDemoSubscription}>
            <SubmitButton className="btn-secondary">Cancel (demo)</SubmitButton>
          </form>
        )}
      </div>

      <div className="mb-4">
        <div className="label">Pay with</div>
        <div className="flex flex-wrap gap-2">
          {providers.map((p) => {
            const active = p.id === pay;
            const disabled = lockedProvider !== null && !active;
            return (
              <Link
                key={p.id}
                href={`/dashboard/billing?pay=${p.id}`}
                aria-current={active ? "true" : undefined}
                aria-disabled={disabled || undefined}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:bg-background"
                } ${disabled ? "pointer-events-none opacity-50" : ""}`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="block text-xs text-muted">{p.description}</span>
              </Link>
            );
          })}
        </div>
        {lockedProvider && (
          <p className="mt-2 text-xs text-muted">To pay with another method, cancel your current subscription first.</p>
        )}
      </div>

      {demo && (
        <Notice tone="warning">
          <strong>Demo billing:</strong> {provider.label} isn&apos;t configured, so upgrades apply instantly without payment.
          Add its keys in <code>.env</code> to take real payments.
        </Notice>
      )}

      <PlanCards
        currency={provider.currency}
        action={(p) => {
          if (p.id === plan.id) {
            return (
              <button disabled className="btn-secondary w-full">
                Current plan
              </button>
            );
          }
          if (p.id === "free") {
            return <p className="text-center text-xs text-muted">{subscribed ? "Cancel anytime above" : "Included"}</p>;
          }
          const switchingStripe = subscribed && pay === "stripe" && user.billingProvider === "stripe";
          return (
            <form action={switchingStripe ? openBillingPortal : startCheckout}>
              <input type="hidden" name="plan" value={p.id} />
              <input type="hidden" name="provider" value={pay} />
              <SubmitButton className="btn-primary w-full" pendingText="Redirecting…">
                {plan.id === "free" ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
              </SubmitButton>
            </form>
          );
        }}
      />
    </>
  );
}
