import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildSubscribeCheckout } from "@/lib/billing/liqpay";
import { db } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Pay with LiqPay" };

/** LiqPay Checkout must be opened with a signed form POST, so this page renders and submits it. */
export default function LiqpayCheckoutPage({ searchParams }: PageProps<"/dashboard/billing/liqpay">) {
  return (
    <>
      <PageHeader title="Pay with LiqPay" />
      <Suspense fallback={<Skeleton className="h-40" />}>
        <CheckoutForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CheckoutForm({ searchParams }: Pick<PageProps<"/dashboard/billing/liqpay">, "searchParams">) {
  const user = await requireUser();
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
        <strong>{plan.name}</strong> plan — ₴{plan.priceUah.toLocaleString("uk-UA")} per month, charged automatically by LiqPay.
        Cancel anytime from Plan &amp; billing.
      </p>
      <button type="submit" className="btn-primary w-full">
        Continue to LiqPay
      </button>
    </form>
  );
}
