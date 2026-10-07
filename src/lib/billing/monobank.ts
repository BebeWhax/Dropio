import "server-only";
import { createVerify } from "node:crypto";
import type { BillingSubscription } from "@prisma/client";
import { getCache, setCache } from "@/lib/cache";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { activateSubscription, addMonth, updateSubscriptionStatus } from "./subscriptions";

const API = "https://api.monobank.ua";
const UAH = 980;

interface SubscriptionStatus {
  subscriptionId: string;
  status: "active" | "cancelled";
  nextChargeDate?: string;
  endDate?: string;
  summary?: { totalPaid?: number; totalFailed?: number };
}

async function mono<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.monobankToken) throw new Error("Monobank is not configured");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "X-Token": env.monobankToken, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Monobank ${path} failed: HTTP ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** Creates a native monthly Monobank subscription and returns its payment page. */
export async function createMonobankSubscription(sub: BillingSubscription): Promise<string> {
  const ref = encodeURIComponent(sub.id);
  const created = await mono<{ subscriptionId: string; pageUrl: string }>("/api/merchant/subscription/create", {
    method: "POST",
    body: JSON.stringify({
      amount: sub.amountMinor,
      ccy: UAH,
      interval: "1m",
      redirectUrl: `${env.appUrl}/api/billing/monobank/return?ref=${ref}`,
      webHookUrls: {
        chargeUrl: `${env.appUrl}/api/billing/monobank/webhook?ref=${ref}`,
        statusUrl: `${env.appUrl}/api/billing/monobank/webhook?ref=${ref}`,
      },
    }),
  });
  await db.billingSubscription.update({ where: { id: sub.id }, data: { providerRef: created.subscriptionId } });
  return created.pageUrl;
}

export async function cancelMonobankSubscription(sub: BillingSubscription): Promise<void> {
  if (!sub.providerRef) return;
  await mono("/api/merchant/subscription/edit", {
    method: "POST",
    body: JSON.stringify({ subscriptionId: sub.providerRef, action: "cancel" }),
  });
}

/**
 * Pulls the subscription's state from Monobank and applies it. Webhooks and the
 * return redirect both call this, so the API, not the webhook body, is the source of truth.
 */
export async function syncMonobankSubscription(sub: BillingSubscription): Promise<void> {
  if (!sub.providerRef) return;
  const status = await mono<SubscriptionStatus>(
    `/api/merchant/subscription/status?subscriptionId=${encodeURIComponent(sub.providerRef)}`,
  );

  const nextCharge = status.nextChargeDate ? new Date(status.nextChargeDate) : null;
  if (status.status === "cancelled") {
    if (sub.status !== "canceled") await updateSubscriptionStatus(sub, "canceled");
    return;
  }
  if (!status.summary?.totalPaid) return; // Created but not paid yet.

  if (nextCharge && nextCharge < new Date()) {
    // The scheduled charge hasn't gone through; Monobank keeps retrying.
    await updateSubscriptionStatus(sub, "past_due");
  } else {
    const { cancelBillingSubscription } = await import("./index");
    await activateSubscription(sub, nextCharge ?? addMonth(new Date()), cancelBillingSubscription);
  }
}

async function getPublicKey(refresh = false): Promise<string> {
  if (!refresh) {
    const hit = await getCache<string>("monobank:pubkey");
    if (hit) return hit;
  }
  const { key } = await mono<{ key: string }>("/api/merchant/pubkey");
  await setCache("monobank:pubkey", key, 7 * 24 * 3600);
  return key;
}

/** Verifies the X-Sign header: base64 ECDSA-SHA256 signature over the raw body. */
export async function verifyMonobankSignature(rawBody: string, xSign: string): Promise<boolean> {
  const check = (key: string) =>
    createVerify("SHA256").update(rawBody).verify(Buffer.from(key, "base64").toString(), Buffer.from(xSign, "base64"));
  try {
    if (check(await getPublicKey())) return true;
    // Monobank may rotate its key; retry once with a fresh one.
    return check(await getPublicKey(true));
  } catch {
    return false;
  }
}
