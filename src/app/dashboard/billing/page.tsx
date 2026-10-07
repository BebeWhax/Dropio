import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cancelDemoSubscription, cancelUahSubscription, openBillingPortal, startCheckout } from "@/app/actions/billing";
import { PlanCards } from "@/components/plan-cards";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader, Skeleton } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { billingProviders, isBillingProviderId, type BillingProviderId } from "@/lib/billing";
import { env } from "@/lib/env";
import { effectivePlan } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).billing.title };
}

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const t = (await getMessages()).billing;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Billing searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Billing({ searchParams }: Pick<PageProps<"/dashboard/billing">, "searchParams">) {
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.billing;
  const plan = effectivePlan(user);
  const sp = await searchParams;
  const providers = billingProviders();

  const errors: Record<string, string> = {
    "billing-not-configured": t.errBillingNotConfigured,
    "price-missing": t.errPriceMissing,
    "switch-provider": t.errSwitchProvider,
    cancel: t.errCancel,
    checkout: t.errCheckout,
    plan: t.errPlan,
  };
  const error = typeof sp.error === "string" ? errors[sp.error] : undefined;
  const providerCopy: Record<BillingProviderId, { label: string; description: string }> = {
    stripe: t.providerCard,
    liqpay: t.providerLiqpay,
    monobank: t.providerMono,
  };
  const providerName = (id: string | null | undefined) => t.providers[(id ?? "") as keyof typeof t.providers] ?? "—";
  const statusName = t.status[user.subscriptionStatus as keyof typeof t.status] ?? user.subscriptionStatus;

  const subscribed = plan.id !== "free" && user.subscriptionStatus !== "canceled";
  // While subscribed, the payment method is fixed to the current provider.
  const lockedProvider = subscribed && isBillingProviderId(user.billingProvider) ? user.billingProvider : null;
  const pay: BillingProviderId = lockedProvider ?? (isBillingProviderId(sp.pay) ? sp.pay : "stripe");
  const provider = providers.find((p) => p.id === pay)!;
  const demo = !provider.configured && !env.isProduction;
  const planName = (id: keyof typeof messages.plans) => (messages.plans[id] as { name: string }).name;

  return (
    <>
      {sp.success && <Notice tone="success">{t.success}</Notice>}
      {sp.pending && <Notice tone="success">{fmt(t.pending, { provider: providerName(String(sp.provider)) })}</Notice>}
      {sp.canceled && <Notice>{t.canceled}</Notice>}
      {sp.cancelled && <Notice>{t.cancelled}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="text-xs font-medium text-muted">{t.currentPlan}</div>
          <div className="text-xl font-semibold">{planName(plan.id)}</div>
          <div className="mt-1 text-sm text-muted">
            {plan.id === "free" ? t.free : `${statusName} · ${fmt(t.paidWith, { provider: providerName(user.billingProvider) })}`}
            {user.currentPeriodEnd &&
              plan.id !== "free" &&
              ` · ${fmt(user.subscriptionStatus === "canceled" ? t.ends : t.renews, { date: user.currentPeriodEnd.toISOString().slice(0, 10) })}`}
          </div>
        </div>
        {subscribed && user.billingProvider === "stripe" && (
          <form action={openBillingPortal}>
            <SubmitButton className="btn-secondary" pendingText={t.opening}>
              {t.manage}
            </SubmitButton>
          </form>
        )}
        {subscribed && (user.billingProvider === "liqpay" || user.billingProvider === "monobank") && (
          <form action={cancelUahSubscription}>
            <SubmitButton className="btn-secondary" pendingText={t.cancelling}>
              {t.cancel}
            </SubmitButton>
          </form>
        )}
        {subscribed && user.billingProvider === "demo" && (
          <form action={cancelDemoSubscription}>
            <SubmitButton className="btn-secondary">{t.cancelDemo}</SubmitButton>
          </form>
        )}
      </div>

      <div className="mb-4">
        <div className="label">{t.payWith}</div>
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
                <span className="font-medium">{providerCopy[p.id].label}</span>
                <span className="block text-xs text-muted">{providerCopy[p.id].description}</span>
              </Link>
            );
          })}
        </div>
        {lockedProvider && <p className="mt-2 text-xs text-muted">{t.lockedHint}</p>}
      </div>

      {demo && <Notice tone="warning">{fmt(t.demo, { provider: providerCopy[provider.id].label })}</Notice>}

      <PlanCards
        currency={provider.currency}
        action={(p) => {
          if (p.id === plan.id) {
            return (
              <button disabled className="btn-secondary w-full">
                {t.currentPlanBtn}
              </button>
            );
          }
          if (p.id === "free") {
            return <p className="text-center text-xs text-muted">{subscribed ? t.cancelAnytime : t.included}</p>;
          }
          const switchingStripe = subscribed && pay === "stripe" && user.billingProvider === "stripe";
          return (
            <form action={switchingStripe ? openBillingPortal : startCheckout}>
              <input type="hidden" name="plan" value={p.id} />
              <input type="hidden" name="provider" value={pay} />
              <SubmitButton className="btn-primary w-full" pendingText={t.redirecting}>
                {fmt(plan.id === "free" ? t.upgradeTo : t.switchTo, { plan: planName(p.id) })}
              </SubmitButton>
            </form>
          );
        }}
      />
    </>
  );
}
