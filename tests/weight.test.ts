import { describe, expect, it } from "vitest";
import { chargeableWeight, roundUpTo, volumetricKg } from "@/lib/shipping/weight";

describe("parcel weight", () => {
  it("computes volumetric weight with the carrier divisor", () => {
    expect(volumetricKg({ lengthCm: 30, widthCm: 20, heightCm: 10 }, 5000)).toBe(1.2);
    expect(volumetricKg(undefined, 5000)).toBe(0);
  });

  it("rounds up to the billing increment without float noise", () => {
    expect(roundUpTo(0.5, 0.5)).toBe(0.5);
    expect(roundUpTo(0.51, 0.5)).toBe(1);
    expect(roundUpTo(0.1 + 0.2, 0.1)).toBeCloseTo(0.3, 10);
  });

  it("bills the greater of actual and volumetric weight", () => {
    const light = chargeableWeight(0.3, { lengthCm: 30, widthCm: 20, heightCm: 10 }, { divisor: 5000, incrementKg: 0.5 });
    expect(light).toMatchObject({ chargeableKg: 1.5, volumetricApplies: true });

    const heavy = chargeableWeight(2.2, { lengthCm: 10, widthCm: 10, heightCm: 10 }, { divisor: 5000, incrementKg: 0.5 });
    expect(heavy).toMatchObject({ chargeableKg: 2.5, volumetricApplies: false });
  });

  it("applies a minimum billable weight", () => {
    expect(chargeableWeight(0.05, undefined, { divisor: 6000, incrementKg: 0.01, minKg: 0.1 }).chargeableKg).toBe(0.1);
  });
});
