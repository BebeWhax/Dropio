import { dataSources } from "@/lib/env";
import { handleLiqpayCallback } from "@/lib/billing/liqpay";

/** LiqPay server_url: form POST with `data` (base64 JSON) and `signature`. */
export async function POST(request: Request) {
  if (!dataSources.liqpayLive) return new Response("LiqPay is not configured", { status: 501 });

  const form = await request.formData();
  const data = form.get("data");
  const signature = form.get("signature");
  if (typeof data !== "string" || typeof signature !== "string") {
    return new Response("Missing data or signature", { status: 400 });
  }
  if (!(await handleLiqpayCallback(data, signature))) {
    return new Response("Invalid signature", { status: 400 });
  }
  return new Response("OK");
}
