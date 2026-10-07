import type { CountryCode } from "@/lib/markets";

/**
 * Import charges for a single low-value parcel shipped from China to a consumer,
 * following each destination's rules as of October 2026. Rates are estimates per
 * product category — the exact HS code decides the real rate.
 */

export type CategoryId =
  | "phone_accessories"
  | "chargers_cables"
  | "audio"
  | "led_lighting"
  | "kitchen"
  | "pet"
  | "toys"
  | "clothing"
  | "jewelry"
  | "cosmetics"
  | "other";

interface CategoryRates {
  /** EU common customs tariff (also used as an approximation for the UK). */
  eu: number;
  /** US MFN (column 1) rate. */
  usMfn: number;
  /** US Section 301 rate on China-origin goods (list 1–3: 25%, list 4A: 7.5%). */
  us301: number;
  /** Canada MFN rate. */
  ca: number;
}

export const CATEGORIES: { id: CategoryId; label: string; hs: string; rates: CategoryRates }[] = [
  { id: "phone_accessories", label: "Phone cases & accessories", hs: "3926.90", rates: { eu: 0.065, usMfn: 0.053, us301: 0.25, ca: 0.065 } },
  { id: "chargers_cables", label: "Chargers & cables", hs: "8504.40 / 8544.42", rates: { eu: 0.017, usMfn: 0.013, us301: 0.25, ca: 0 } },
  { id: "audio", label: "Headphones & speakers", hs: "8518", rates: { eu: 0.02, usMfn: 0.025, us301: 0.25, ca: 0 } },
  { id: "led_lighting", label: "LED lights & lamps", hs: "9405", rates: { eu: 0.047, usMfn: 0.039, us301: 0.25, ca: 0.07 } },
  { id: "kitchen", label: "Kitchen & home gadgets", hs: "3924.10", rates: { eu: 0.065, usMfn: 0.034, us301: 0.25, ca: 0.065 } },
  { id: "pet", label: "Pet supplies", hs: "4201", rates: { eu: 0.028, usMfn: 0.026, us301: 0.25, ca: 0.07 } },
  { id: "toys", label: "Toys", hs: "9503", rates: { eu: 0.047, usMfn: 0, us301: 0, ca: 0 } },
  { id: "clothing", label: "Clothing (knit)", hs: "6109", rates: { eu: 0.12, usMfn: 0.28, us301: 0.075, ca: 0.18 } },
  { id: "jewelry", label: "Costume jewelry", hs: "7117", rates: { eu: 0.04, usMfn: 0.11, us301: 0.25, ca: 0.085 } },
  { id: "cosmetics", label: "Cosmetics & beauty", hs: "3304", rates: { eu: 0, usMfn: 0, us301: 0.075, ca: 0.065 } },
  { id: "other", label: "Other / not sure", hs: "—", rates: { eu: 0.04, usMfn: 0.04, us301: 0.25, ca: 0.065 } },
];

export function isCategoryId(value: unknown): value is CategoryId {
  return CATEGORIES.some((c) => c.id === value);
}

function categoryRates(id: CategoryId): CategoryRates {
  return (CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]).rates;
}

/** US Section 301 "forced labor" tariff on China-origin goods since 24 Jul 2026. */
const US_FORCED_LABOR_301 = 0.125;
/** EU €2-per-item handling fee on low-value imports. */
const EU_HANDLING_FEE_FROM = new Date("2026-11-01T00:00:00Z");
const EU_COUNTRIES = new Set<CountryCode>(["DE", "FR", "IT", "ES"]);

export interface ImportInput {
  country: CountryCode;
  category: CategoryId;
  /** Goods (intrinsic) value — what you paid the supplier — in USD. */
  goodsUsd: number;
  shippingUsd: number;
  /** Distinct tariff lines in the parcel (EU flat duty is charged per line). */
  tariffLines?: number;
  /** USD value of one unit of `currency`. */
  usdPer: (currency: string) => number;
  /** User override replacing the category duty rate where a percentage duty applies. */
  dutyRateOverride?: number;
  /** Extra per-parcel broker/carrier fee, in the destination currency. */
  handlingFee?: number;
  /** Destination currency, for `handlingFee`. */
  currency: string;
  date?: Date;
}

export interface ImportCharges {
  dutyUsd: number;
  /** VAT/GST paid at the border that is not already in the marketplace price. */
  importVatUsd: number;
  /** Carrier handling, brokerage and processing fees. */
  feesUsd: number;
  totalUsd: number;
  /** Which rules applied, as message codes the UI translates (see DUTY_NOTE_CODES). */
  notes: DutyNote[];
}

export type DutyNoteCode =
  | "uaUnder" | "uaOver" | "uaPending"
  | "usOverride" | "usStack" | "usFee"
  | "gbUnder" | "gbOver"
  | "euFlat" | "euFeeActive" | "euFeeUpcoming" | "euOver"
  | "caUnder" | "caOver"
  | "auUnder" | "auOver"
  | "handling";

export interface DutyNote {
  code: DutyNoteCode;
  vars?: Record<string, string | number>;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function calculateImportCharges(input: ImportInput): ImportCharges {
  const { country, goodsUsd, shippingUsd, usdPer } = input;
  const rates = categoryRates(input.category);
  const lines = Math.max(1, Math.round(input.tariffLines ?? 1));
  const date = input.date ?? new Date();
  const notes: DutyNote[] = [];
  let duty = 0;
  let vat = 0;
  let fees = 0;

  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  const rateOr = (fallback: number) => input.dutyRateOverride ?? fallback;

  if (country === "UA") {
    // Customs Code art. 234: parcels to individuals are free up to €150 of goods value (shipping excluded).
    const allowanceUsd = 150 * usdPer("EUR");
    if (goodsUsd <= allowanceUsd) {
      notes.push({ code: "uaUnder" });
    } else {
      const excess = goodsUsd - allowanceUsd;
      const rate = rateOr(0.1);
      duty = excess * rate;
      vat = (excess + duty) * 0.2;
      notes.push({ code: "uaOver", vars: { rate: pct(rate) } });
    }
    notes.push({ code: "uaPending" });
  } else if (country === "US") {
    // De minimis is suspended; ad valorem duty on the goods value (US customs value excludes international freight).
    const rate = rateOr(rates.usMfn + rates.us301 + US_FORCED_LABOR_301);
    duty = goodsUsd * rate;
    fees = 2;
    notes.push(
      input.dutyRateOverride !== undefined
        ? { code: "usOverride", vars: { rate: pct(rate) } }
        : { code: "usStack", vars: { mfn: pct(rates.usMfn), s301: pct(rates.us301) } },
      { code: "usFee" },
    );
  } else if (country === "GB") {
    const thresholdUsd = 135 * usdPer("GBP");
    if (goodsUsd <= thresholdUsd) {
      notes.push({ code: "gbUnder" });
    } else {
      const rate = rateOr(rates.eu);
      duty = (goodsUsd + shippingUsd) * rate;
      fees = 10 * usdPer("GBP");
      notes.push({ code: "gbOver", vars: { rate: pct(rate) } });
    }
  } else if (EU_COUNTRIES.has(country)) {
    const thresholdUsd = 150 * usdPer("EUR");
    if (goodsUsd <= thresholdUsd) {
      duty = 3 * lines * usdPer("EUR");
      notes.push({ code: "euFlat", vars: { lines } });
      if (date >= EU_HANDLING_FEE_FROM) {
        fees = 2 * lines * usdPer("EUR");
        notes.push({ code: "euFeeActive" });
      } else {
        notes.push({ code: "euFeeUpcoming" });
      }
    } else {
      const rate = rateOr(rates.eu);
      duty = (goodsUsd + shippingUsd) * rate;
      fees = 10 * usdPer("EUR");
      notes.push({ code: "euOver", vars: { rate: pct(rate) } });
    }
  } else if (country === "CA") {
    // China-origin goods: only CAD 20 is waived; above it duty and GST apply to the full value.
    const thresholdUsd = 20 * usdPer("CAD");
    if (goodsUsd <= thresholdUsd) {
      notes.push({ code: "caUnder" });
    } else {
      const rate = rateOr(rates.ca);
      duty = goodsUsd * rate;
      vat = (goodsUsd + duty) * 0.05;
      fees = 9.95 * usdPer("CAD");
      notes.push({ code: "caOver", vars: { rate: pct(rate) } });
    }
  } else if (country === "AU") {
    const thresholdUsd = 1000 * usdPer("AUD");
    if (goodsUsd <= thresholdUsd) {
      notes.push({ code: "auUnder" });
    } else {
      notes.push({ code: "auOver" });
    }
  }

  if (input.handlingFee) {
    fees += input.handlingFee * usdPer(input.currency);
    notes.push({ code: "handling" });
  }

  return {
    dutyUsd: round(duty),
    importVatUsd: round(vat),
    feesUsd: round(fees),
    totalUsd: round(duty + vat + fees),
    notes,
  };
}
