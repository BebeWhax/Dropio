import type { ShippingQuote } from "@/lib/providers/types";

export type ShippingPreference = "cheapest" | "fastest" | "balanced";

export const SHIPPING_PREFERENCES: { id: ShippingPreference; label: string }[] = [
  { id: "cheapest", label: "Cheapest" },
  { id: "balanced", label: "Best value (≤ 15 days)" },
  { id: "fastest", label: "Fastest" },
];

export function isShippingPreference(value: unknown): value is ShippingPreference {
  return value === "cheapest" || value === "fastest" || value === "balanced";
}

/** Upper bound of a delivery estimate like "7-12" (days); Infinity when unknown. */
export function maxDays(days: string | undefined): number {
  const nums = days?.match(/\d+/g)?.map(Number) ?? [];
  return nums.length ? Math.max(...nums) : Infinity;
}

/**
 * Picks the carrier option to use for margin maths. "balanced" takes the
 * cheapest option that arrives within 15 days, since slow parcels drive
 * cancellations and marketplace defects.
 */
export function pickShipping(options: ShippingQuote[], preference: ShippingPreference): ShippingQuote | null {
  if (options.length === 0) return null;
  const byCost = [...options].sort((a, b) => a.costUsd - b.costUsd);
  if (preference === "cheapest") return byCost[0];
  if (preference === "fastest") {
    return [...options].sort((a, b) => maxDays(a.days) - maxDays(b.days) || a.costUsd - b.costUsd)[0];
  }
  return byCost.find((o) => maxDays(o.days) <= 15) ?? byCost[0];
}
