import { createHash, timingSafeEqual } from "node:crypto";

/** LiqPay API v7 signature: base64(sha3-256(private_key + data + private_key)). */
export function liqpaySignature(privateKey: string, data: string): string {
  return createHash("sha3-256").update(privateKey + data + privateKey).digest("base64");
}

export function encodeLiqpayData(params: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(params)).toString("base64");
}

/** Verifies a callback's signature and returns the decoded payload, or null if forged. */
export function decodeLiqpayCallback(
  privateKey: string,
  data: string,
  signature: string,
): Record<string, unknown> | null {
  const expected = Buffer.from(liqpaySignature(privateKey, data));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
