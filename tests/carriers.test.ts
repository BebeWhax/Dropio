import { describe, expect, it } from "vitest";
import { quoteCarriers } from "@/lib/shipping/quote";

const FX: Record<string, number> = { USD: 1, EUR: 1.1, GBP: 1.3, CAD: 0.73, AUD: 0.66, UAH: 1 / 45, CNY: 1 / 7.1 };
const usdPer = (c: string) => FX[c];

describe("quoteCarriers", () => {
  it("prices Nova Poshta from its published table, with COD", () => {
    const quotes = quoteCarriers({ leg: "domestic", destination: "UA", weightKg: 1.2, usdPer, codAmountUsd: 20 });
    const np = quotes.find((q) => q.serviceId === "ua-novaposhta-branch")!;
    // ≤2 kg = 90 UAH; COD 2% × 900 UAH + 20
    expect(np.basePrice).toBe(90);
    expect(np.codFee).toBe(38);
  });

  it("needs box dimensions for volume-priced Ukrposhta", () => {
    const noDims = quoteCarriers({ leg: "domestic", destination: "UA", weightKg: 1, usdPer });
    expect(noDims.some((q) => q.carrier === "Ukrposhta")).toBe(false);
    const withDims = quoteCarriers({ leg: "domestic", destination: "UA", weightKg: 1, usdPer, dims: { lengthCm: 20, widthCm: 15, heightCm: 10 } });
    expect(withDims.find((q) => q.serviceId === "ua-ukrposhta-basic")?.price).toBe(55);
  });

  it("quotes international lines from China in USD, cheapest first", () => {
    const quotes = quoteCarriers({ leg: "international", destination: "US", weightKg: 0.3, usdPer });
    expect(quotes.length).toBeGreaterThan(1);
    expect(quotes[0].priceUsd).toBeLessThanOrEqual(quotes[1].priceUsd);
    const fedex = quotes.find((q) => q.carrier === "FedEx")!;
    expect(fedex.fuelSurcharge).toBeGreaterThan(0);
  });

  it("only offers domestic carriers of the destination country", () => {
    const quotes = quoteCarriers({ leg: "domestic", destination: "DE", weightKg: 1, usdPer });
    expect(quotes.every((q) => q.carrier === "DHL")).toBe(true);
  });
});
