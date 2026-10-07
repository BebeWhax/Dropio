import "server-only";
import { estimateShippingUsd } from "@/lib/pricing/landed-cost";
import type { CountryCode, Market } from "@/lib/markets";
import type {
  MarketListing,
  MarketProvider,
  MarketSearch,
  ShippingQuote,
  SupplierProduct,
  SupplierProductDetail,
  SupplierProvider,
} from "./types";

/**
 * Deterministic fake data so the platform is usable before API keys are
 * configured. The UI labels everything from here as demo data.
 */

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded pseudo-random number in [0, 1). */
function rand(seed: string): number {
  return (hash(seed) % 100000) / 100000;
}

const between = (seed: string, min: number, max: number) => min + rand(seed) * (max - min);
const round2 = (n: number) => Math.round(n * 100) / 100;

const ADJECTIVES = ["Portable", "Mini", "Rechargeable", "Foldable", "LED", "Wireless", "Magnetic", "Smart"];
const SUFFIXES = ["for Home", "for Travel", "with USB-C", "Kit", "for Office", "2-Pack", "Pro", "for Car"];
const DEMO_FX: Record<string, number> = { USD: 1, EUR: 0.89, GBP: 0.76, CAD: 1.38, AUD: 1.52, UAH: 44.9 };
const COUNTRY_DEMAND: Record<CountryCode, number> = {
  US: 1.0, GB: 0.95, DE: 1.05, FR: 1.1, IT: 1.0, ES: 0.9, CA: 1.15, AU: 1.25, UA: 0.85,
};

function demoProduct(keyword: string, index: number): SupplierProduct {
  const seed = `${keyword}:${index}`;
  const adj = ADJECTIVES[hash(seed + "a") % ADJECTIVES.length];
  const suffix = SUFFIXES[hash(seed + "s") % SUFFIXES.length];
  const title = `${adj} ${keyword.replace(/\b\w/g, (c) => c.toUpperCase())} ${suffix}`;
  const priceUsd = round2(between(seed + "p", 1.5, 14));
  return {
    // The id encodes keyword + index so the product can be rebuilt without storage.
    id: `demo_${index}_${Buffer.from(keyword).toString("base64url")}`,
    title,
    priceUsd,
    priceMaxUsd: rand(seed + "v") > 0.5 ? round2(priceUsd * 1.4) : undefined,
    weightGrams: Math.round(between(seed + "w", 80, 900)),
    category: "Demo category",
  };
}

function productFromId(id: string): SupplierProduct | null {
  const match = /^demo_(\d+)_([\w-]+)$/.exec(id);
  if (!match) return null;
  return demoProduct(Buffer.from(match[2], "base64url").toString(), Number(match[1]));
}

export class DemoSupplierProvider implements SupplierProvider {
  readonly name = "Demo supplier";
  readonly isDemo = true;

  async search(keyword: string, page: number) {
    const items = Array.from({ length: 12 }, (_, i) => demoProduct(keyword.trim().toLowerCase(), (page - 1) * 12 + i));
    return { items, total: 48 };
  }

  async getProduct(id: string): Promise<SupplierProductDetail | null> {
    const product = productFromId(id);
    if (!product) return null;
    return {
      ...product,
      variants: [
        { id: `${id}-v1`, name: "Standard", priceUsd: product.priceUsd, weightGrams: product.weightGrams },
        ...(product.priceMaxUsd
          ? [{ id: `${id}-v2`, name: "Deluxe", priceUsd: product.priceMaxUsd, weightGrams: product.weightGrams }]
          : []),
      ],
    };
  }

  async quoteShipping(variantId: string, country: CountryCode): Promise<ShippingQuote[]> {
    const product = productFromId(variantId.replace(/-v\d$/, ""));
    const base = estimateShippingUsd(product?.weightGrams, country);
    return [
      { costUsd: round2(base * 0.8), method: "Demo economy", days: "12-20", estimated: true },
      { costUsd: base, method: "Demo standard", days: "8-15", estimated: true },
      { costUsd: round2(base * 2.4), method: "Demo express", days: "4-7", estimated: true },
    ];
  }
}

export class DemoMarketProvider implements MarketProvider {
  readonly name = "Demo marketplace";
  readonly isDemo = true;

  async search(market: Market, search: MarketSearch): Promise<MarketListing[]> {
    const q = search.gtin ?? search.query.toLowerCase();
    const baseUsd = between(`${q}:base`, 14, 48);
    const demand = COUNTRY_DEMAND[market.code] * between(`${q}:${market.code}:demand`, 0.75, 1.35);
    const fx = DEMO_FX[market.currency] ?? 1;
    const count = Math.round(between(`${q}:${market.code}:count`, 6, 32));

    return Array.from({ length: count }, (_, i): MarketListing => {
      const seed = `${q}:${market.code}:${i}`;
      // A couple of cheap accessories/misprices so outlier trimming has something to do.
      const outlier = i % 13 === 7 ? 0.25 : 1;
      const priceUsd = baseUsd * demand * between(seed + "p", 0.75, 1.35) * outlier;
      const freeShipping = rand(seed + "f") > 0.4;
      return {
        id: `demo-${hash(seed).toString(36)}`,
        title: `${search.query} ${SUFFIXES[hash(seed) % SUFFIXES.length]}`,
        price: round2(priceUsd * fx),
        shipping: freeShipping ? 0 : round2(between(seed + "s", 1.5, 6) * fx),
        currency: market.currency,
        url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(search.query)}`,
      };
    });
  }
}
