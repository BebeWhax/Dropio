import { describe, expect, it } from "vitest";
import { percentile, summarizePrices, trimOutliers } from "@/lib/pricing/stats";

describe("stats", () => {
  it("interpolates percentiles", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.9)).toBe(10);
  });

  it("drops accessory-priced outliers", () => {
    const trimmed = trimOutliers([2, 20, 21, 22, 23, 24, 25, 200]);
    expect(trimmed).not.toContain(2);
    expect(trimmed).not.toContain(200);
  });

  it("ignores invalid prices and returns null when nothing is left", () => {
    expect(summarizePrices([0, -1, NaN])).toBeNull();
    expect(summarizePrices([10, 12, 14])?.median).toBe(12);
  });
});
