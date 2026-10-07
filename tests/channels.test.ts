import { describe, expect, it } from "vitest";
import { channelFeeModel, channelFeesForSale, channelsFor, CHANNELS, getChannel } from "@/lib/channels";
import { calculateLandedCost } from "@/lib/pricing/landed-cost";
import { MARKETS } from "@/lib/markets";

describe("channel fees", () => {
  it("adds commission, payment, fixed fees, monthly share and ads", () => {
    const etsyUs = getChannel("etsy").fees.US!;
    const r = channelFeesForSale(etsyUs, 30, { ordersPerMonth: 30, adCostPerOrder: 2 });
    // 6.5% × 30 + (3% × 30 + 0.25) + 0.20 listing + 0 monthly + 2 ads
    expect(r.total).toBeCloseTo(1.95 + 1.15 + 0.2 + 2, 6);
  });

  it("spreads a subscription over monthly orders and honours a commission override", () => {
    const prom = getChannel("prom").fees.UA!;
    const model = channelFeeModel(prom, { ordersPerMonth: 45, adCostPerOrder: 0, commissionPct: 0.05 });
    expect(model.pct).toBeCloseTo(0.05 + 0.017, 6);
    expect(model.fixed).toBeCloseTo(10 + 450 / 45, 6);
  });

  it("charges Shopify's third-party gateway fee in Ukraine", () => {
    const ua = getChannel("shopify").fees.UA!;
    expect(channelFeeModel(ua, { ordersPerMonth: 100, adCostPerOrder: 0 }).pct).toBeCloseTo(0.033, 6);
  });

  it("lists Ukrainian marketplaces only for Ukraine", () => {
    const ua = channelsFor("UA").map((c) => c.id);
    expect(ua).toEqual(expect.arrayContaining(["prom", "rozetka", "olx", "epicentr"]));
    expect(channelsFor("US").map((c) => c.id)).not.toContain("prom");
  });

  it("feeds channel fees into the landed cost and break-even", () => {
    const base = {
      sellPriceUsd: 30,
      supplierCostUsd: 5,
      shippingUsd: 4,
      importCharges: { dutyUsd: 0, importVatUsd: 0, feesUsd: 0, totalUsd: 0, notes: [] },
      importPayer: "seller" as const,
      assumptions: MARKETS.US.defaults,
      marketToUsd: 1,
    };
    const r = calculateLandedCost({ ...base, channelFees: { pct: 0.1, fixedUsd: 1 } });
    expect(r.marketplaceFeeUsd).toBe(4);
    const atBreakEven = calculateLandedCost({ ...base, sellPriceUsd: r.breakEvenPriceUsd, channelFees: { pct: 0.1, fixedUsd: 1 } });
    expect(Math.abs(atBreakEven.profitUsd)).toBeLessThanOrEqual(0.01);
  });

  it("has fee data for every channel in at least one market", () => {
    for (const c of CHANNELS) expect(Object.keys(c.fees).length).toBeGreaterThan(0);
  });
});
