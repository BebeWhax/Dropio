import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { buildSubscribeCheckout } from "@/lib/billing/liqpay";
import { db } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).billing.liqpayTitle };
}

/** LiqPay Checkout must be opened with a signed form POST, so this page renders and submits it. */
export default async function LiqpayCheckoutPage({ searchParams }: PageProps<"/dashboard/billing/liqpay">) {
  const t = (await getMessages()).billing;
  return (
    <>
      <PageHeader title={t.liqpayTitle} />
      <Suspense fallback={<Skeleton className="h-40" />}>
        <CheckoutForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CheckoutForm({ searchParams }: Pick<PageProps<"/dashboard/billing/liqpay">, "searchParams">) {
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const { ref } = await searchParams;
  const sub =
    typeof ref === "string"
      ? await db.billingSubscription.findFirst({ where: { id: ref, userId: user.id, provider: "liqpay", status: "pending" } })
      : null;
  if (!sub) notFound();

  const plan = PLANS[sub.plan as PlanId];
  const form = buildSubscribeCheckout(sub, plan, user.email);

  return (
    <form id="liqpay-checkout" method="POST" action={form.action} acceptCharset="utf-8" className="card max-w-md space-y-4 p-6">
      <input type="hidden" name="data" value={form.data} />
      <input type="hidden" name="signature" value={form.signature} />
      <p className="text-sm">
        {fmt(messages.billing.liqpayText, { plan: messages.plans[plan.id].name, price: plan.priceUah.toLocaleString("uk-UA") })}
      </p>
      <button type="submit" className="btn-primary w-full">
        {messages.billing.liqpayContinue}
      </button>
    </form>
  );
}
