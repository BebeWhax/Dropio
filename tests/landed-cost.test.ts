import { describe, expect, it } from "vitest";
import { MARKETS } from "@/lib/markets";
import type { ImportCharges } from "@/lib/pricing/duty";
import { calculateLandedCost, estimateShippingUsd } from "@/lib/pricing/landed-cost";

const charges = (dutyUsd: number, importVatUsd = 0, feesUsd = 0): ImportCharges => ({
  dutyUsd,
  importVatUsd,
  feesUsd,
  totalUsd: dutyUsd + importVatUsd + feesUsd,
  notes: [],
});

const noTax = { vatRate: 0, feeRate: 0.13, fixedFee: 0.4, turnoverTaxRate: 0, handlingFee: 0 };

describe("calculateLandedCost", () => {
  it("handles a market without VAT in the price (US)", () => {
    const r = calculateLandedCost({
      sellPriceUsd: 30,
      supplierCostUsd: 5,
      shippingUsd: 4,
      importCharges: charges(2.25),
      importPayer: "seller",
      assumptions: noTax,
      marketToUsd: 1,
    });
    expect(r.vatUsd).toBe(0);
    expect(r.marketplaceFeeUsd).toBe(4.3); // 30 × 13% + 0.40
    expect(r.profitUsd).toBe(14.45); // 30 − 5 − 4 − 2.25 − 4.30
    expect(r.marginPct).toBeCloseTo(48.17, 2);
  });

  it("removes VAT included in the listing price and converts fixed fees (DE)", () => {
    const r = calculateLandedCost({
      sellPriceUsd: 23.8,
      supplierCostUsd: 5,
      shippingUsd: 3,
      importCharges: charges(3.3),
      importPayer: "seller",
      assumptions: { ...MARKETS.DE.defaults },
      marketToUsd: 1.1,
    });
    expect(r.netRevenueUsd).toBe(20);
    expect(r.vatUsd).toBe(3.8);
    expect(r.marketplaceFeeUsd).toBeCloseTo(23.8 * 0.12 + 0.385, 2);
  });

  it("excludes import charges from costs when the buyer pays them (DDU)", () => {
    const base = { sellPriceUsd: 30, supplierCostUsd: 5, shippingUsd: 4, importCharges: charges(5, 2, 1), assumptions: noTax, marketToUsd: 1 };
    const ddp = calculateLandedCost({ ...base, importPayer: "seller" });
    const ddu = calculateLandedCost({ ...base, importPayer: "buyer" });
    expect(ddu.profitUsd - ddp.profitUsd).toBeCloseTo(8, 2);
    expect(ddu.importPaidByBuyer).toBe(true);
    expect(ddu.importChargesUsd).toBe(8);
  });

  it("deducts turnover tax (Ukrainian FOP single tax)", () => {
    const r = calculateLandedCost({
      sellPriceUsd: 20,
      supplierCostUsd: 4,
      shippingUsd: 3,
      importCharges: charges(0),
      importPayer: "seller",
      assumptions: MARKETS.UA.defaults,
      marketToUsd: 1 / 44.9,
    });
    expect(r.turnoverTaxUsd).toBe(1); // 5% of 20
    expect(r.vatUsd).toBe(0);
    expect(r.profitUsd).toBe(9.6); // 20 − 4 − 3 − 2.40 fee − 1 tax
  });

  it("break-even price yields zero profit", () => {
    const base = {
      supplierCostUsd: 6,
      shippingUsd: 3.5,
      importCharges: charges(1.2),
      importPayer: "seller" as const,
      assumptions: MARKETS.GB.defaults,
      marketToUsd: 1.3,
    };
    const { breakEvenPriceUsd } = calculateLandedCost({ ...base, sellPriceUsd: 20 });
    const atBreakEven = calculateLandedCost({ ...base, sellPriceUsd: breakEvenPriceUsd });
    expect(Math.abs(atBreakEven.profitUsd)).toBeLessThanOrEqual(0.01);
  });
});

describe("estimateShippingUsd", () => {
  it("grows with weight and falls back to a default weight", () => {
    expect(estimateShippingUsd(500, "US")).toBeGreaterThan(estimateShippingUsd(100, "US"));
    expect(estimateShippingUsd(undefined, "DE")).toBe(estimateShippingUsd(250, "DE"));
  });
});
