import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { syncMonobankSubscription } from "@/lib/billing/monobank";

/** Where Monobank sends the buyer after paying; syncs immediately so the plan shows up without waiting for the webhook. */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref");
  const sub = ref ? await db.billingSubscription.findUnique({ where: { id: ref } }) : null;
  if (sub?.provider === "monobank") {
    try {
      await syncMonobankSubscription(sub);
    } catch (err) {
      console.error("Monobank sync on return failed:", err);
    }
  }
  return NextResponse.redirect(new URL("/dashboard/billing?provider=monobank&pending=1", env.appUrl));
}
