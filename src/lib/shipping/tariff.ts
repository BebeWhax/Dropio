import type { CountryCode } from "@/lib/markets";
import { chargeableWeight, type ChargeableWeight, type Dimensions } from "./weight";

export interface VolumeBand {
  /** Inclusive upper box volume of the band, in cm³. */
  upToCm3: number;
  price: number;
}

/**
 * Open, table-driven parcel pricing. Each carrier service is described by its
 * published tariff structure; quotes are reproducible from these tables.
 */

export type Leg = "international" | "domestic";

export interface RateBand {
  /** Inclusive upper weight limit of the band, in kg. */
  upToKg: number;
  price: number;
}

export type Tariff =
  /** E-commerce lines (China Post, YunExpress…): fixed per-parcel fee plus a price per kg of chargeable weight. */
  | { kind: "perKg"; perParcel: number; perKg: number }
  /** Weight-band price lists (express and domestic carriers); beyond the last band, `extraPerKg` per started kg. */
  | { kind: "bands"; bands: RateBand[]; extraPerKg?: number }
  /** Priced by box volume (Ukrposhta since April 2026); beyond the last band, cm³ / `overDivisor`. */
  | { kind: "volume"; bands: VolumeBand[]; overDivisor?: number };

export interface CarrierService {
  id: string;
  carrier: string;
  service: string;
  leg: Leg;
  /** "CN" for international lines from China; for domestic services, the country it operates in. */
  from: "CN" | CountryCode;
  currency: string;
  /** Volumetric divisor (cm³ per kg); 0 when the service ignores box size. */
  divisor: number;
  /** Volumetric weight only applies to boxes larger than this (USPS: 1 ft³). */
  volumetricThresholdCm3?: number;
  /** Largest accepted box, any orientation (sorted longest → shortest side). */
  maxDimsCm?: [number, number, number];
  incrementKg: number;
  minKg?: number;
  maxKg: number;
  /** Fuel surcharge applied on top of the tariff, as a share (e.g. 0.2 = 20%). */
  fuelSurchargePct?: number;
  /** Declared-value insurance: `pct` of the value above `freeUpTo` (service currency). */
  valueFee?: { freeUpTo: number; pct: number };
  /** Cash-on-delivery transfer fee: `pct` of the collected amount + `fixed`. */
  codFee?: { pct: number; fixed: number };
  days?: string;
  tariffs: Partial<Record<CountryCode, Tariff>>;
  /** Where the numbers come from, and when they were checked. */
  source: string;
  asOf: string;
}

export interface ServiceQuote {
  serviceId: string;
  carrier: string;
  service: string;
  leg: Leg;
  destination: CountryCode;
  currency: string;
  weight: ChargeableWeight;
  basePrice: number;
  fuelSurcharge: number;
  valueFee: number;
  codFee: number;
  price: number;
  days?: string;
  source: string;
  asOf: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function tariffPrice(tariff: Tariff, chargeableKg: number, volumeCm3 = 0): number {
  if (tariff.kind === "perKg") return tariff.perParcel + tariff.perKg * chargeableKg;
  if (tariff.kind === "volume") {
    const band = tariff.bands.find((b) => volumeCm3 <= b.upToCm3);
    if (band) return band.price;
    return tariff.overDivisor ? volumeCm3 / tariff.overDivisor : NaN;
  }

  const band = tariff.bands.find((b) => chargeableKg <= b.upToKg + 1e-9);
  if (band) return band.price;
  const last = tariff.bands[tariff.bands.length - 1];
  if (!last || tariff.extraPerKg === undefined) return NaN;
  return last.price + Math.ceil(chargeableKg - last.upToKg - 1e-9) * tariff.extraPerKg;
}

export interface Parcel {
  destination: CountryCode;
  weightKg: number;
  dims?: Dimensions;
  /** Declared value, in the service's currency. */
  declaredValue?: number;
  /** Amount collected from the buyer on delivery, in the service's currency. */
  codAmount?: number;
}

function fitsBox(dims: Dimensions | undefined, max: [number, number, number] | undefined): boolean {
  if (!max || !dims) return true;
  const sides = [dims.lengthCm, dims.widthCm, dims.heightCm].sort((a, b) => b - a);
  return sides.every((side, i) => side <= max[i]);
}

/** Quotes one service, or returns null when it doesn't serve the destination or the parcel doesn't fit. */
export function quoteService(service: CarrierService, parcel: Parcel): ServiceQuote | null {
  const tariff = service.tariffs[parcel.destination];
  if (!tariff || !fitsBox(parcel.dims, service.maxDimsCm)) return null;

  const volumeCm3 = parcel.dims ? parcel.dims.lengthCm * parcel.dims.widthCm * parcel.dims.heightCm : 0;
  // Volume-priced services can't quote without the box size.
  if (tariff.kind === "volume" && volumeCm3 <= 0) return null;
  const volumetricCounts = !service.volumetricThresholdCm3 || volumeCm3 > service.volumetricThresholdCm3;

  const weight = chargeableWeight(parcel.weightKg, volumetricCounts ? parcel.dims : undefined, {
    divisor: service.divisor,
    incrementKg: service.incrementKg,
    minKg: service.minKg,
  });
  if (weight.chargeableKg > service.maxKg) return null;

  const basePrice = tariffPrice(tariff, weight.chargeableKg, volumeCm3);
  if (!Number.isFinite(basePrice)) return null;
  const fuelSurcharge = basePrice * (service.fuelSurchargePct ?? 0);
  const valueFee = service.valueFee
    ? Math.max(0, (parcel.declaredValue ?? 0) - service.valueFee.freeUpTo) * service.valueFee.pct
    : 0;
  const codFee = service.codFee && parcel.codAmount ? parcel.codAmount * service.codFee.pct + service.codFee.fixed : 0;

  return {
    serviceId: service.id,
    carrier: service.carrier,
    service: service.service,
    leg: service.leg,
    destination: parcel.destination,
    currency: service.currency,
    weight,
    basePrice: round2(basePrice),
    fuelSurcharge: round2(fuelSurcharge),
    valueFee: round2(valueFee),
    codFee: round2(codFee),
    price: round2(basePrice + fuelSurcharge + valueFee + codFee),
    days: service.days,
    source: service.source,
    asOf: service.asOf,
  };
}
