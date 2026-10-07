/** Linear-interpolated percentile of an already sorted array (p in 0..1). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Drops outliers outside 1.5×IQR. Marketplace searches are full of accessories,
 * bundles and misprices, so the raw median is easily skewed.
 */
export function trimOutliers(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length < 4) return sorted;
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  return sorted.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
}

export interface PriceSummary {
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  count: number;
}

export function summarizePrices(values: number[]): PriceSummary | null {
  const sorted = trimOutliers(values.filter((v) => Number.isFinite(v) && v > 0));
  if (sorted.length === 0) return null;
  return {
    median: percentile(sorted, 0.5),
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: sorted.length,
  };
}
