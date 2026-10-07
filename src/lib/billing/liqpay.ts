import "server-only";
import type { BillingSubscription } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Plan } from "@/lib/plans";
import { decodeLiqpayCallback, encodeLiqpayData, liqpaySignature } from "./liqpay-sign";
import { activateSubscription, addMonth, updateSubscriptionStatus } from "./subscriptions";

export const LIQPAY_CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout";
const LIQPAY_REQUEST_URL = "https://www.liqpay.ua/api/request";
const API_VERSION = 7;

function keys() {
  if (!env.liqpayPublicKey || !env.liqpayPrivateKey) throw new Error("LiqPay is not configured");
  return { publicKey: env.liqpayPublicKey, privateKey: env.liqpayPrivateKey };
}

/** Signed form fields for LiqPay Checkout with a monthly subscription. */
export function buildSubscribeCheckout(sub: BillingSubscription, plan: Plan, email: string) {
  const { publicKey, privateKey } = keys();
  const data = encodeLiqpayData({
    version: API_VERSION,
    public_key: publicKey,
    action: "subscribe",
    subscribe: "1",
    // A past start date means "start now"; LiqPay then charges monthly on its own.
    subscribe_date_start: new Date().toISOString().slice(0, 19).replace("T", " "),
    subscribe_periodicity: "month",
    amount: sub.amountMinor / 100,
    currency: sub.currency,
    description: `Dropio ${plan.name} — monthly subscription`,
    order_id: sub.id,
    customer: email.slice(0, 100),
    language: "uk",
    server_url: `${env.appUrl}/api/billing/liqpay/callback`,
    result_url: `${env.appUrl}/dashboard/billing?provider=liqpay&pending=1`,
  });
  return { action: LIQPAY_CHECKOUT_URL, data, signature: liqpaySignature(privateKey, data) };
}

async function liqpayRequest(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { publicKey, privateKey } = keys();
  const data = encodeLiqpayData({ version: API_VERSION, public_key: publicKey, ...params });
  const res = await fetch(LIQPAY_REQUEST_URL, {
    method: "POST",
    body: new URLSearchParams({ data, signature: liqpaySignature(privateKey, data) }),
  });
  if (!res.ok) throw new Error(`LiqPay HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function cancelLiqpaySubscription(sub: BillingSubscription): Promise<void> {
  const result = await liqpayRequest({ action: "unsubscribe", order_id: sub.id });
  if (result.status !== "unsubscribed") {
    throw new Error(`LiqPay unsubscribe failed: ${String(result.err_description ?? result.status)}`);
  }
}

/**
 * Applies a verified callback. "subscribe" is the first payment, "regular" each
 * monthly charge; both extend access by a month on success.
 */
export async function handleLiqpayCallback(data: string, signature: string): Promise<boolean> {
  const payload = decodeLiqpayCallback(keys().privateKey, data, signature);
  if (!payload) return false;

  const orderId = String(payload.order_id ?? "");
  const sub = await db.billingSubscription.findUnique({ where: { id: orderId } });
  if (!sub || sub.provider !== "liqpay") {
    console.warn(`LiqPay callback for unknown order ${orderId}`);
    return true;
  }

  const status = String(payload.status ?? "");
  const action = String(payload.action ?? "");
  if (status === "subscribed" || status === "success" || status === "sandbox") {
    // Callbacks can arrive late or repeat; extend from whichever is later, now or the current period end.
    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() && action === "regular" ? sub.currentPeriodEnd : new Date();
    await activateSubscription(sub, addMonth(base), cancelProviderSubscription);
  } else if (status === "unsubscribed") {
    await updateSubscriptionStatus(sub, "canceled");
  } else if (status === "reversed") {
    await updateSubscriptionStatus(sub, "canceled", new Date());
  } else if ((status === "failure" || status === "error") && sub.status === "active") {
    await updateSubscriptionStatus(sub, "past_due");
  }
  return true;
}

// Imported lazily to avoid a cycle with the Monobank module.
async function cancelProviderSubscription(previous: BillingSubscription) {
  const { cancelBillingSubscription } = await import("./index");
  await cancelBillingSubscription(previous);
}
