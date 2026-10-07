import { describe, expect, it } from "vitest";
import { quoteService, tariffPrice, type CarrierService } from "@/lib/shipping/tariff";

const line: CarrierService = {
  id: "test-line",
  carrier: "Test",
  service: "Economy",
  leg: "international",
  from: "CN",
  currency: "USD",
  divisor: 8000,
  incrementKg: 0.01,
  maxKg: 2,
  days: "10-15",
  tariffs: { US: { kind: "perKg", perParcel: 3, perKg: 10 } },
  source: "test",
  asOf: "2026-10",
};

const express: CarrierService = {
  ...line,
  id: "test-express",
  divisor: 5000,
  incrementKg: 0.5,
  maxKg: 30,
  fuelSurchargePct: 0.2,
  tariffs: { GB: { kind: "bands", bands: [{ upToKg: 0.5, price: 30 }, { upToKg: 1, price: 40 }], extraPerKg: 8 } },
};

describe("tariffPrice", () => {
  it("prices per-kg lines as fee + rate × weight", () => {
    expect(tariffPrice({ kind: "perKg", perParcel: 3, perKg: 10 }, 0.25)).toBe(5.5);
  });

  it("picks the weight band, then adds per started kg beyond the last band", () => {
    const t = { kind: "bands" as const, bands: [{ upToKg: 0.5, price: 30 }, { upToKg: 1, price: 40 }], extraPerKg: 8 };
    expect(tariffPrice(t, 0.5)).toBe(30);
    expect(tariffPrice(t, 1)).toBe(40);
    expect(tariffPrice(t, 2.5)).toBe(56);
    expect(tariffPrice({ ...t, extraPerKg: undefined }, 2.5)).toBeNaN();
  });
});

describe("quoteService", () => {
  it("quotes a per-kg line on chargeable weight", () => {
    expect(quoteService(line, { destination: "US", weightKg: 0.25 })?.price).toBe(5.5);
  });

  it("uses volumetric weight and adds the fuel surcharge", () => {
    const q = quoteService(express, { destination: "GB", weightKg: 0.3, dims: { lengthCm: 25, widthCm: 20, heightCm: 10 } });
    // 25×20×10/5000 = 1 kg volumetric → 40 + 20% fuel
    expect(q).toMatchObject({ basePrice: 40, fuelSurcharge: 8, price: 48 });
    expect(q?.weight.volumetricApplies).toBe(true);
  });

  it("returns null for unserved destinations and overweight parcels", () => {
    expect(quoteService(line, { destination: "DE", weightKg: 0.2 })).toBeNull();
    expect(quoteService(line, { destination: "US", weightKg: 3 })).toBeNull();
  });
});

describe("carrier rules", () => {
  const domestic: CarrierService = {
    id: "ua-test",
    carrier: "Test UA",
    service: "Branch",
    leg: "domestic",
    from: "UA",
    currency: "UAH",
    divisor: 4000,
    incrementKg: 0.1,
    maxKg: 30,
    tariffs: { UA: { kind: "bands", bands: [{ upToKg: 2, price: 90 }, { upToKg: 10, price: 135 }] } },
    valueFee: { freeUpTo: 500, pct: 0.005 },
    codFee: { pct: 0.02, fixed: 20 },
    source: "test",
    asOf: "2026-10",
  };

  it("adds declared-value and cash-on-delivery fees", () => {
    const q = quoteService(domestic, { destination: "UA", weightKg: 1, declaredValue: 1500, codAmount: 1500 });
    // 90 + 0.5% × (1500 − 500) + (2% × 1500 + 20)
    expect(q).toMatchObject({ basePrice: 90, valueFee: 5, codFee: 50, price: 145 });
  });

  it("prices by box volume and needs dimensions for it", () => {
    const byVolume: CarrierService = {
      ...domestic,
      tariffs: { UA: { kind: "volume", bands: [{ upToCm3: 1500, price: 50 }, { upToCm3: 4000, price: 55 }], overDivisor: 480 } },
    };
    expect(quoteService(byVolume, { destination: "UA", weightKg: 1, dims: { lengthCm: 20, widthCm: 15, heightCm: 10 } })?.price).toBe(55);
    expect(quoteService(byVolume, { destination: "UA", weightKg: 1, dims: { lengthCm: 50, widthCm: 20, heightCm: 10 } })?.price).toBeCloseTo(10000 / 480, 2);
    expect(quoteService(byVolume, { destination: "UA", weightKg: 1 })).toBeNull();
  });

  it("only applies volumetric weight above the threshold, and rejects oversized boxes", () => {
    const usps: CarrierService = { ...line, divisor: 6000, volumetricThresholdCm3: 28317, maxDimsCm: [60, 40, 30] };
    // 30×20×10 = 6,000 cm³ — under 1 ft³, so actual weight is billed.
    expect(quoteService(usps, { destination: "US", weightKg: 0.2, dims: { lengthCm: 30, widthCm: 20, heightCm: 10 } })?.weight.chargeableKg).toBe(0.2);
    expect(quoteService(usps, { destination: "US", weightKg: 0.2, dims: { lengthCm: 70, widthCm: 20, heightCm: 10 } })).toBeNull();
  });
});
