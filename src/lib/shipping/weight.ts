/**
 * Carrier-independent parcel maths: carriers charge for the greater of the
 * actual weight and the volumetric ("dimensional") weight, rounded up to
 * their billing increment.
 */

export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/** Volumetric weight in kg: L × W × H (cm) / divisor (typically 5000 or 6000). */
export function volumetricKg(dims: Dimensions | undefined, divisor: number): number {
  if (!dims || divisor <= 0) return 0;
  const { lengthCm, widthCm, heightCm } = dims;
  if (lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) return 0;
  return (lengthCm * widthCm * heightCm) / divisor;
}

/** Rounds up to the billing increment, tolerating floating-point noise (0.5 kg → 0.5, not 1.0). */
export function roundUpTo(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Math.ceil(value / increment - 1e-9) * increment;
}

export interface ChargeableWeight {
  actualKg: number;
  volumetricKg: number;
  chargeableKg: number;
  /** True when the box size, not its weight, sets the price. */
  volumetricApplies: boolean;
}

export function chargeableWeight(
  actualKg: number,
  dims: Dimensions | undefined,
  opts: { divisor: number; incrementKg: number; minKg?: number },
): ChargeableWeight {
  const vol = volumetricKg(dims, opts.divisor);
  const billed = Math.max(actualKg, vol, opts.minKg ?? 0);
  return {
    actualKg,
    volumetricKg: Math.round(vol * 1000) / 1000,
    chargeableKg: Math.round(roundUpTo(billed, opts.incrementKg) * 1000) / 1000,
    volumetricApplies: vol > actualKg,
  };
}

/** Kilograms ↔ pounds and cm ↔ inches, for US-style tariffs (e.g. Amazon FBA). */
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
