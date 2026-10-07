import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe, syncSubscription } from "@/lib/billing/stripe";

/**
 * Stripe → app subscription sync. Point a Stripe webhook endpoint at
 * /api/stripe/webhook with the events listed below.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) {
    return new Response("Billing is not configured", { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    // Signature verification needs the raw, unparsed body.
    event = stripe.webhooks.constructEvent(await request.text(), signature, env.stripeWebhookSecret);
  } catch (err) {
    console.warn("Invalid Stripe webhook signature:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await syncSubscription(await stripe.subscriptions.retrieve(id));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
  }

  return Response.json({ received: true });
}
