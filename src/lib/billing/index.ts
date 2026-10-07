import "server-only";
import type { BillingSubscription } from "@prisma/client";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/env";
import type { Plan } from "@/lib/plans";
import { cancelLiqpaySubscription } from "./liqpay";
import { cancelMonobankSubscription, createMonobankSubscription } from "./monobank";

export type BillingProviderId = "stripe" | "liqpay" | "monobank";

export interface BillingProviderInfo {
  id: BillingProviderId;
  label: string;
  description: string;
  currency: "USD" | "UAH";
  configured: boolean;
}

export function billingProviders(): BillingProviderInfo[] {
  return [
    { id: "stripe", label: "Card (Stripe)", description: "Visa / Mastercard, billed in USD", currency: "USD", configured: dataSources.billingLive },
    { id: "liqpay", label: "LiqPay", description: "PrivatBank, Apple Pay, Google Pay — billed in UAH", currency: "UAH", configured: dataSources.liqpayLive },
    { id: "monobank", label: "monobank", description: "plata by mono — billed in UAH", currency: "UAH", configured: dataSources.monobankLive },
  ];
}

export function isBillingProviderId(value: unknown): value is BillingProviderId {
  return value === "stripe" || value === "liqpay" || value === "monobank";
}

/** Starts a LiqPay/Monobank subscription checkout and returns where to send the user. */
export async function startUahCheckout(provider: "liqpay" | "monobank", userId: string, plan: Plan): Promise<string> {
  const sub = await db.billingSubscription.create({
    data: { userId, provider, plan: plan.id, amountMinor: plan.priceUah * 100, currency: "UAH" },
  });
  if (provider === "monobank") return createMonobankSubscription(sub);
  // LiqPay checkout needs a signed form POST, rendered by this page.
  return `/dashboard/billing/liqpay?ref=${encodeURIComponent(sub.id)}`;
}

export async function cancelBillingSubscription(sub: BillingSubscription): Promise<void> {
  if (sub.provider === "liqpay") await cancelLiqpaySubscription(sub);
  else if (sub.provider === "monobank") await cancelMonobankSubscription(sub);
}
