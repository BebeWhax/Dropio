import { db } from "@/lib/db";
import { dataSources } from "@/lib/env";
import { syncMonobankSubscription, verifyMonobankSignature } from "@/lib/billing/monobank";

/**
 * Monobank subscription charge/status webhook. We verify X-Sign when present and
 * then re-read the subscription from Monobank's API, so a forged body can't grant access.
 */
export async function POST(request: Request) {
  if (!dataSources.monobankLive) return new Response("Monobank is not configured", { status: 501 });

  const raw = await request.text();
  const xSign = request.headers.get("x-sign");
  if (xSign && !(await verifyMonobankSignature(raw, xSign))) {
    return new Response("Invalid signature", { status: 400 });
  }

  const ref = new URL(request.url).searchParams.get("ref");
  const sub = ref ? await db.billingSubscription.findUnique({ where: { id: ref } }) : null;
  if (!sub || sub.provider !== "monobank") return new Response("OK"); // Unknown ref: ack so Monobank stops retrying.

  await syncMonobankSubscription(sub);
  return new Response("OK");
}
