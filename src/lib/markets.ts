export const COUNTRY_CODES = ["US", "GB", "DE", "FR", "IT", "ES", "CA", "AU", "UA"] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

/**
 * Per-country selling-cost assumptions. Import duty itself follows each
 * country's rules in pricing/duty.ts; these cover tax and fees on the sale.
 * All are estimates users can override on the Settings page.
 */
export interface CostAssumptions {
  /** VAT/GST included in the listing price and remitted by the seller/marketplace (0 where tax is added at checkout). */
  vatRate: number;
  /** Marketplace commission as a share of the buyer's total. */
  feeRate: number;
  /** Per-order marketplace fee, in the market's currency. */
  fixedFee: number;
  /** Tax on turnover paid by the seller (e.g. Ukrainian FOP group 3 single tax: 5%). */
  turnoverTaxRate: number;
  /** Replaces the category duty rate where a percentage duty applies (undefined = use the rules). */
  dutyRateOverride?: number;
  /** Extra broker/carrier fee per parcel, in the market's currency. */
  handlingFee: number;
}

/** Where selling prices come from: eBay's own site, or Google Shopping where eBay has none. */
export type PriceSource = { kind: "ebay"; marketplaceId: string } | { kind: "google_shopping"; gl: string; hl: string };

export interface Market {
  code: CountryCode;
  name: string;
  flag: string;
  currency: string;
  priceSource: PriceSource;
  /** Where the user would list the product; used in fee labels. */
  sellingChannel: string;
  /** Whether listing titles are usually English (affects title-matching strictness). */
  englishTitles: boolean;
  defaults: CostAssumptions;
}

export const MARKETS: Record<CountryCode, Market> = {
  US: {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    currency: "USD",
    priceSource: { kind: "ebay", marketplaceId: "EBAY_US" },
    sellingChannel: "eBay",
    englishTitles: true,
    defaults: { vatRate: 0, feeRate: 0.136, fixedFee: 0.4, turnoverTaxRate: 0, handlingFee: 0 },
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    currency: "GBP",
    priceSource: { kind: "ebay", marketplaceId: "EBAY_GB" },
    sellingChannel: "eBay",
    englishTitles: true,
    defaults: { vatRate: 0.2, feeRate: 0.128, fixedFee: 0.3, turnoverTaxRate: 0, handlingFee: 0 },
  },
  DE: {
    code: "DE",
    name: "Germany",
    flag: "🇩🇪",
    currency: "EUR",
    priceSource: { kind: "ebay", marketplaceId: "EBAY_DE" },
    sellingChannel: "eBay",
    englishTitles: false,
    defaults: { vatRate: 0.19, feeRate: 0.12, fixedFee: 0.35, turnoverTaxRate: 0, handlingFee: 0 },
  },
  FR: {
    code: "FR",
    name: "France",
    flag: "🇫🇷",
    currency: "EUR",
    priceSource: { kind: "ebay", marketplaceId: "EBAY_FR" },
    sellingChannel: "eBay",
    englishTitles: false,
    defaults: { vatRate: 0.2, feeRate: 0.12, fixedFee: 0.35, turnoverTaxRate: 0, handlingFee: 0 },
  },
  IT: {
    code: "IT",
    name: "Italy",
    flag: "🇮🇹",
    currency: "EUR",
    priceSource: { kind: "ebay", marketplaceId: "EBAY_IT" },
    sellingChannel: "eBay",
    englishTitles: false,
    defaults: { vatRate: 0.22, feeRate: 0.12, fixedFee: 0.35, turnoverTaxRate: 0, handlingFee: 0 },
  },
  ES: {
    code: "ES",
    name: "Spain",
    flag: "🇪🇸",
    currency: "EUR",
    priceSource: { kind: "ebay", marketplaceId: "EBAY_ES" },
    sellingChannel: "eBay",
    englishTitles: false,
    defaults: { vatRate: 0.21, feeRate: 0.12, fixedFee: 0.35, turnoverTaxRate: 0, handlingFee: 0 },
  },
  CA: {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    currency: "CAD",
    priceSource: { kind: "ebay", marketplaceId: "EBAY_CA" },
    sellingChannel: "eBay",
    englishTitles: true,
    // eBay.ca prices exclude GST/HST; for China-origin parcels it is charged at the border (see duty rules).
    defaults: { vatRate: 0, feeRate: 0.1325, fixedFee: 0.4, turnoverTaxRate: 0, handlingFee: 0 },
  },
  AU: {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    currency: "AUD",
    priceSource: { kind: "ebay", marketplaceId: "EBAY_AU" },
    sellingChannel: "eBay",
    englishTitles: true,
    defaults: { vatRate: 0.1, feeRate: 0.134, fixedFee: 0.3, turnoverTaxRate: 0, handlingFee: 0 },
  },
  UA: {
    code: "UA",
    name: "Ukraine",
    flag: "🇺🇦",
    currency: "UAH",
    // No eBay site and no public marketplace search API; Google Shopping covers Rozetka, Prom, Allo, etc.
    priceSource: { kind: "google_shopping", gl: "ua", hl: "uk" },
    sellingChannel: "Prom / Rozetka",
    englishTitles: false,
    // Most dropshippers sell as a FOP group 3 (5% single tax, not VAT-registered); set VAT 20% if you are a PDV payer.
    // Fees: Prom/Rozetka commissions are 4–27% by category plus ~1.5–1.7% for payments.
    defaults: { vatRate: 0, feeRate: 0.12, fixedFee: 0, turnoverTaxRate: 0.05, handlingFee: 0 },
  },
};

export const MARKET_CURRENCIES = [...new Set(COUNTRY_CODES.map((c) => MARKETS[c].currency))];

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && (COUNTRY_CODES as readonly string[]).includes(value);
}

export type CostSettings = Partial<Record<CountryCode, Partial<CostAssumptions>>>;

export function resolveAssumptions(country: CountryCode, settings: CostSettings): CostAssumptions {
  return { ...MARKETS[country].defaults, ...settings[country] };
}

export function parseCostSettings(json: string | null | undefined): CostSettings {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as CostSettings) : {};
  } catch {
    return {};
  }
}
