import type { CountryCode } from "@/lib/markets";

/**
 * Where a product can be sold, and what each channel takes per order. Amounts
 * are in the market's currency, researched October 2026. Commissions on
 * marketplaces like Prom, Rozetka and Amazon depend on the category — the
 * default is a typical value and users can override it per analysis.
 */

export type ChannelId =
  | "ebay"
  | "amazon"
  | "etsy"
  | "tiktok"
  | "shopify"
  | "woocommerce"
  | "wix"
  | "prom"
  | "rozetka"
  | "olx"
  | "epicentr";

export interface ChannelFees {
  /** Subscription / hosting per month. */
  monthly: number;
  /** Commission on the buyer's total (typical value). */
  commissionPct: number;
  /** Category range, when the commission depends on the category. */
  commissionRange?: [number, number];
  /** Payment processing share of the buyer's total (0 when included in the commission). */
  paymentPct: number;
  /** Fixed payment fee per order. */
  paymentFixed: number;
  /** Other fixed fees per order (eBay per-order fee, Etsy listing, OLX delivery fee…). */
  perOrderFixed: number;
  /** Other percentage fees (Shopify third-party gateway fee, Etsy regulatory fee…). */
  extraPct?: number;
  /** True when some numbers come from secondary sources. */
  estimate?: boolean;
}

export interface Channel {
  id: ChannelId;
  name: string;
  /** Marketplaces bring buyers; own stores need paid traffic. */
  kind: "marketplace" | "own_store";
  url: string;
  fees: Partial<Record<CountryCode, ChannelFees>>;
}

const EU = ["DE", "FR", "IT", "ES"] as const;
const each = <T,>(codes: readonly CountryCode[], make: (c: CountryCode) => T) =>
  Object.fromEntries(codes.map((c) => [c, make(c)])) as Partial<Record<CountryCode, T>>;

export const CHANNELS: Channel[] = [
  {
    id: "ebay",
    name: "eBay",
    kind: "marketplace",
    url: "https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822",
    fees: {
      US: { monthly: 0, commissionPct: 0.136, paymentPct: 0, paymentFixed: 0, perOrderFixed: 0.4 },
      GB: { monthly: 0, commissionPct: 0.129, commissionRange: [0.05, 0.129], paymentPct: 0, paymentFixed: 0, perOrderFixed: 0.4, extraPct: 0.0035 },
      ...each(EU, () => ({ monthly: 0, commissionPct: 0.11, commissionRange: [0.07, 0.12] as [number, number], paymentPct: 0, paymentFixed: 0, perOrderFixed: 0.45, estimate: true })),
      CA: { monthly: 0, commissionPct: 0.1325, paymentPct: 0, paymentFixed: 0, perOrderFixed: 0.4, estimate: true },
      AU: { monthly: 0, commissionPct: 0.134, paymentPct: 0, paymentFixed: 0, perOrderFixed: 0.3, estimate: true },
    },
  },
  {
    id: "amazon",
    name: "Amazon",
    kind: "marketplace",
    url: "https://sell.amazon.com/pricing",
    fees: {
      US: { monthly: 39.99, commissionPct: 0.15, commissionRange: [0.08, 0.15], paymentPct: 0, paymentFixed: 0, perOrderFixed: 0 },
      GB: { monthly: 25, commissionPct: 0.15, commissionRange: [0.08, 0.15], paymentPct: 0, paymentFixed: 0, perOrderFixed: 0 },
      ...each(EU, () => ({ monthly: 39, commissionPct: 0.15, commissionRange: [0.08, 0.15] as [number, number], paymentPct: 0, paymentFixed: 0, perOrderFixed: 0 })),
      CA: { monthly: 29.99, commissionPct: 0.15, commissionRange: [0.08, 0.15], paymentPct: 0, paymentFixed: 0, perOrderFixed: 0, estimate: true },
      AU: { monthly: 49.95, commissionPct: 0.15, commissionRange: [0.08, 0.15], paymentPct: 0, paymentFixed: 0, perOrderFixed: 0, estimate: true },
    },
  },
  {
    id: "etsy",
    name: "Etsy",
    kind: "marketplace",
    url: "https://www.etsy.com/legal/fees/",
    fees: {
      US: { monthly: 0, commissionPct: 0.065, paymentPct: 0.03, paymentFixed: 0.25, perOrderFixed: 0.2 },
      CA: { monthly: 0, commissionPct: 0.065, paymentPct: 0.03, paymentFixed: 0.25, perOrderFixed: 0.27, extraPct: 0.0115, estimate: true },
      AU: { monthly: 0, commissionPct: 0.065, paymentPct: 0.03, paymentFixed: 0.25, perOrderFixed: 0.3 },
      GB: { monthly: 0, commissionPct: 0.065, paymentPct: 0.04, paymentFixed: 0.2, perOrderFixed: 0.16, extraPct: 0.0048 },
      DE: { monthly: 0, commissionPct: 0.065, paymentPct: 0.04, paymentFixed: 0.3, perOrderFixed: 0.18 },
      FR: { monthly: 0, commissionPct: 0.065, paymentPct: 0.04, paymentFixed: 0.3, perOrderFixed: 0.18, extraPct: 0.0114 },
      IT: { monthly: 0, commissionPct: 0.065, paymentPct: 0.04, paymentFixed: 0.3, perOrderFixed: 0.18, extraPct: 0.008 },
      ES: { monthly: 0, commissionPct: 0.065, paymentPct: 0.04, paymentFixed: 0.3, perOrderFixed: 0.18, extraPct: 0.0088 },
      UA: { monthly: 0, commissionPct: 0.065, paymentPct: 0.06, paymentFixed: 13.5, perOrderFixed: 9 },
    },
  },
  {
    id: "tiktok",
    name: "TikTok Shop",
    kind: "marketplace",
    url: "https://seller-us.tiktok.com",
    fees: {
      US: { monthly: 0, commissionPct: 0.08, paymentPct: 0, paymentFixed: 0, perOrderFixed: 0, estimate: true },
      GB: { monthly: 0, commissionPct: 0.09, paymentPct: 0, paymentFixed: 0, perOrderFixed: 0, estimate: true },
      ...each(EU, () => ({ monthly: 0, commissionPct: 0.09, paymentPct: 0, paymentFixed: 0, perOrderFixed: 0, estimate: true })),
    },
  },
  {
    id: "shopify",
    name: "Shopify (Basic)",
    kind: "own_store",
    url: "https://www.shopify.com/pricing",
    fees: {
      US: { monthly: 39, commissionPct: 0, paymentPct: 0.029, paymentFixed: 0.3, perOrderFixed: 0, estimate: true },
      GB: { monthly: 25, commissionPct: 0, paymentPct: 0.02, paymentFixed: 0.25, perOrderFixed: 0 },
      ...each(EU, () => ({ monthly: 27, commissionPct: 0, paymentPct: 0.019, paymentFixed: 0.25, perOrderFixed: 0, estimate: true })),
      CA: { monthly: 49, commissionPct: 0, paymentPct: 0.028, paymentFixed: 0.3, perOrderFixed: 0 },
      AU: { monthly: 56, commissionPct: 0, paymentPct: 0.017, paymentFixed: 0.3, perOrderFixed: 0 },
      // No Shopify Payments in Ukraine: LiqPay/mono ~1.3% plus Shopify's 2% third-party gateway fee; plan billed in USD.
      UA: { monthly: 1750, commissionPct: 0, paymentPct: 0.013, paymentFixed: 0, perOrderFixed: 0, extraPct: 0.02 },
    },
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    kind: "own_store",
    url: "https://woocommerce.com/document/woopayments/fees-and-debits/fees/",
    fees: {
      US: { monthly: 15, commissionPct: 0, paymentPct: 0.029, paymentFixed: 0.3, perOrderFixed: 0, estimate: true },
      GB: { monthly: 12, commissionPct: 0, paymentPct: 0.015, paymentFixed: 0.25, perOrderFixed: 0, estimate: true },
      ...each(EU, () => ({ monthly: 14, commissionPct: 0, paymentPct: 0.015, paymentFixed: 0.25, perOrderFixed: 0, estimate: true })),
      CA: { monthly: 20, commissionPct: 0, paymentPct: 0.029, paymentFixed: 0.3, perOrderFixed: 0, estimate: true },
      AU: { monthly: 22, commissionPct: 0, paymentPct: 0.0175, paymentFixed: 0.3, perOrderFixed: 0, estimate: true },
      // LiqPay or plata by mono: 1.3% for Ukrainian cards; hosting ~400 UAH.
      UA: { monthly: 400, commissionPct: 0, paymentPct: 0.013, paymentFixed: 0, perOrderFixed: 0, estimate: true },
    },
  },
  {
    id: "wix",
    name: "Wix (Core)",
    kind: "own_store",
    url: "https://support.wix.com/en/article/wix-payments-service-fees",
    fees: {
      US: { monthly: 29, commissionPct: 0, paymentPct: 0.029, paymentFixed: 0.3, perOrderFixed: 0 },
      GB: { monthly: 23, commissionPct: 0, paymentPct: 0.021, paymentFixed: 0.2, perOrderFixed: 0, estimate: true },
      ...each(EU, () => ({ monthly: 26, commissionPct: 0, paymentPct: 0.019, paymentFixed: 0.3, perOrderFixed: 0, estimate: true })),
      CA: { monthly: 39, commissionPct: 0, paymentPct: 0.029, paymentFixed: 0.3, perOrderFixed: 0, estimate: true },
    },
  },
  {
    id: "prom",
    name: "Prom.ua",
    kind: "marketplace",
    url: "https://prom.ua/ua/sell-on-prom",
    fees: {
      // 5,400 UAH/year package; Пром-оплата 1.7% to a business account; ~10–30 UAH delivery charge per order.
      UA: { monthly: 450, commissionPct: 0.1, commissionRange: [0.042, 0.24], paymentPct: 0.017, paymentFixed: 0, perOrderFixed: 10 },
    },
  },
  {
    id: "rozetka",
    name: "Rozetka",
    kind: "marketplace",
    url: "https://sellerhelp.rozetka.com.ua/p321-balance.html",
    fees: {
      UA: { monthly: 120, commissionPct: 0.15, commissionRange: [0.03, 0.27], paymentPct: 0.015, paymentFixed: 0, perOrderFixed: 0, estimate: true },
    },
  },
  {
    id: "olx",
    name: "OLX",
    kind: "marketplace",
    url: "https://help.olx.ua",
    fees: {
      // OLX Доставка seller fee for business listings: 3% + 20 UAH (capped at 499 UAH); listing packages extra.
      UA: { monthly: 0, commissionPct: 0.03, paymentPct: 0, paymentFixed: 0, perOrderFixed: 20 },
    },
  },
  {
    id: "epicentr",
    name: "Epicentr",
    kind: "marketplace",
    url: "https://epicentrk.ua/ua/seller/",
    fees: {
      UA: { monthly: 120, commissionPct: 0.12, commissionRange: [0.05, 0.25], paymentPct: 0.015, paymentFixed: 0, perOrderFixed: 0, estimate: true },
    },
  },
];

export function isChannelId(value: unknown): value is ChannelId {
  return CHANNELS.some((c) => c.id === value);
}

export function getChannel(id: ChannelId): Channel {
  return CHANNELS.find((c) => c.id === id)!;
}

export function channelsFor(country: CountryCode): Channel[] {
  return CHANNELS.filter((c) => c.fees[country]);
}

/** The channel used when the user picks "auto": eBay where it has a site, Prom in Ukraine. */
export function defaultChannel(country: CountryCode): ChannelId {
  return country === "UA" ? "prom" : "ebay";
}

export interface ChannelOptions {
  /** Overrides the default commission (e.g. your category's exact rate). */
  commissionPct?: number;
  /** Orders per month the monthly fee is spread over. */
  ordersPerMonth: number;
  /** Paid traffic per order, in the market currency (mostly for own stores). */
  adCostPerOrder: number;
}

export interface ChannelFeeBreakdown {
  commission: number;
  payment: number;
  fixed: number;
  extra: number;
  monthlyShare: number;
  ads: number;
  total: number;
  /** As a share of the buyer's total. */
  pct: number;
}

/** Per-order cost of selling at `price` (buyer total, market currency) through a channel. */
export function channelFeesForSale(fees: ChannelFees, price: number, opts: ChannelOptions): ChannelFeeBreakdown {
  const commission = price * (opts.commissionPct ?? fees.commissionPct);
  const payment = price * fees.paymentPct + fees.paymentFixed;
  const fixed = fees.perOrderFixed;
  const extra = price * (fees.extraPct ?? 0);
  const monthlyShare = fees.monthly / Math.max(1, opts.ordersPerMonth);
  const ads = opts.adCostPerOrder;
  const total = commission + payment + fixed + extra + monthlyShare + ads;
  return { commission, payment, fixed, extra, monthlyShare, ads, total, pct: price > 0 ? total / price : 0 };
}

/**
 * The channel's cost as a linear function of price (pct × price + fixed), so
 * landed-cost maths can solve for break-even.
 */
export function channelFeeModel(fees: ChannelFees, opts: ChannelOptions): { pct: number; fixed: number } {
  return {
    pct: (opts.commissionPct ?? fees.commissionPct) + fees.paymentPct + (fees.extraPct ?? 0),
    fixed: fees.paymentFixed + fees.perOrderFixed + fees.monthly / Math.max(1, opts.ordersPerMonth) + opts.adCostPerOrder,
  };
}
