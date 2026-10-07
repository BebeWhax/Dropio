import type { CountryCode, Market } from "@/lib/markets";

export interface SupplierProduct {
  id: string;
  title: string;
  imageUrl?: string;
  /** Lowest unit cost in USD. */
  priceUsd: number;
  /** Highest unit cost when the product has variants at different prices. */
  priceMaxUsd?: number;
  weightGrams?: number;
  category?: string;
}

export interface SupplierVariant {
  id: string;
  name: string;
  priceUsd: number;
  weightGrams?: number;
}

export interface SupplierProductDetail extends SupplierProduct {
  variants: SupplierVariant[];
}

export interface ShippingQuote {
  costUsd: number;
  method: string;
  /** Delivery time as reported by the carrier, e.g. "7-12". */
  days?: string;
  /** True when this is a weight-based estimate rather than a carrier quote. */
  estimated: boolean;
}

export interface SupplierProvider {
  readonly name: string;
  readonly isDemo: boolean;
  search(keyword: string, page: number): Promise<{ items: SupplierProduct[]; total: number }>;
  getProduct(id: string): Promise<SupplierProductDetail | null>;
  /** All carrier options to the country (empty when the supplier can't ship there). */
  quoteShipping(variantId: string, country: CountryCode): Promise<ShippingQuote[]>;
}

export interface MarketListing {
  id: string;
  title: string;
  /** Item price in `currency`. */
  price: number;
  /** Buyer-paid shipping in `currency`; null when the marketplace didn't report it. */
  shipping: number | null;
  currency: string;
  url: string;
  imageUrl?: string;
}

export interface MarketSearch {
  query: string;
  gtin?: string;
}

export interface MarketProvider {
  readonly name: string;
  readonly isDemo: boolean;
  search(market: Market, search: MarketSearch): Promise<MarketListing[]>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
  ) {
    super(`${provider}: ${message}`);
  }
}
