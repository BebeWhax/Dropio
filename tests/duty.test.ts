import { describe, expect, it } from "vitest";
import { calculateImportCharges, type ImportInput } from "@/lib/pricing/duty";

// USD value of one unit of each currency.
const FX: Record<string, number> = { USD: 1, EUR: 1.1, GBP: 1.3, CAD: 0.73, AUD: 0.66, UAH: 1 / 45 };
const usdPer = (c: string) => FX[c];
const base = { usdPer, category: "other" as const, shippingUsd: 5, currency: "USD", date: new Date("2026-10-07") };
const input = (over: Partial<ImportInput> & Pick<ImportInput, "country" | "goodsUsd">): ImportInput => ({ ...base, ...over });

describe("Ukraine", () => {
  it("is duty-free up to €150 of goods value, shipping excluded", () => {
    const r = calculateImportCharges(input({ country: "UA", goodsUsd: 160, shippingUsd: 50, currency: "UAH" }));
    expect(r.totalUsd).toBe(0); // €145 of goods; shipping doesn't count
  });

  it("charges 10% duty and 20% VAT on the excess over €150", () => {
    // €200 of goods → excess €50 → duty €5, VAT 20% × €55 = €11
    const r = calculateImportCharges(input({ country: "UA", goodsUsd: 220, currency: "UAH" }));
    expect(r.dutyUsd).toBeCloseTo(5 * 1.1, 2);
    expect(r.importVatUsd).toBeCloseTo(11 * 1.1, 2);
  });
});

describe("EU", () => {
  it("charges €3 per tariff line under €150, and the €2 handling fee from 1 Nov 2026", () => {
    const before = calculateImportCharges(input({ country: "DE", goodsUsd: 20, tariffLines: 2 }));
    expect(before.dutyUsd).toBeCloseTo(6 * 1.1, 2);
    expect(before.feesUsd).toBe(0);

    const after = calculateImportCharges(input({ country: "FR", goodsUsd: 20, date: new Date("2026-11-02") }));
    expect(after.feesUsd).toBeCloseTo(2 * 1.1, 2);
  });

  it("uses the category rate on goods + shipping above €150", () => {
    const r = calculateImportCharges(input({ country: "IT", goodsUsd: 200, category: "clothing" }));
    expect(r.dutyUsd).toBeCloseTo((200 + 5) * 0.12, 2);
  });
});

describe("other markets", () => {
  it("US has no de minimis and stacks MFN + 301 + forced-labor tariffs on goods value", () => {
    const r = calculateImportCharges(input({ country: "US", goodsUsd: 10, category: "phone_accessories" }));
    expect(r.dutyUsd).toBeCloseTo(10 * (0.053 + 0.25 + 0.125), 2);
  });

  it("UK and Australia have no duty under their thresholds", () => {
    expect(calculateImportCharges(input({ country: "GB", goodsUsd: 100 })).totalUsd).toBe(0);
    expect(calculateImportCharges(input({ country: "AU", goodsUsd: 500 })).totalUsd).toBe(0);
  });

  it("Canada charges duty + GST + Canada Post fee above CAD 20", () => {
    expect(calculateImportCharges(input({ country: "CA", goodsUsd: 10 })).totalUsd).toBe(0);
    const r = calculateImportCharges(input({ country: "CA", goodsUsd: 30, category: "toys" }));
    expect(r.dutyUsd).toBe(0);
    expect(r.importVatUsd).toBeCloseTo(1.5, 2);
    expect(r.feesUsd).toBeCloseTo(9.95 * 0.73, 2);
  });

  it("applies a user duty override and extra handling fee", () => {
    const r = calculateImportCharges(input({ country: "US", goodsUsd: 10, dutyRateOverride: 0.1, handlingFee: 3, currency: "USD" }));
    expect(r.dutyUsd).toBe(1);
    expect(r.feesUsd).toBe(5);
  });
});
