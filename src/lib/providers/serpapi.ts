import "server-only";
import { cached } from "@/lib/cache";
import type { Market } from "@/lib/markets";
import { ProviderError, type MarketListing, type MarketProvider, type MarketSearch } from "./types";

interface ShoppingResult {
  product_id?: string;
  title?: string;
  price?: string;
  extracted_price?: number;
  source?: string;
  product_link?: string;
  link?: string;
  thumbnail?: string;
}

/** Google Shopping returns a formatted price string; detect its currency so we never mix currencies. */
export function detectCurrency(price: string | undefined): string | null {
  if (!price) return null;
  if (/₴|грн|uah/i.test(price)) return "UAH";
  if (/€|eur/i.test(price)) return "EUR";
  if (/£|gbp/i.test(price)) return "GBP";
  if (/\$|usd/i.test(price)) return "USD";
  return null;
}

/**
 * Retail prices from Google Shopping via SerpApi, for markets without an eBay
 * site (Ukraine). One request returns ~40 offers from many shops.
 */
export class SerpApiShoppingProvider implements MarketProvider {
  readonly name = "Google Shopping";
  readonly isDemo = false;

  constructor(private readonly apiKey: string) {}

  async search(market: Market, search: MarketSearch): Promise<MarketListing[]> {
    if (market.priceSource.kind !== "google_shopping") {
      throw new ProviderError("Google Shopping", `not configured for ${market.name}`);
    }
    const { gl, hl } = market.priceSource;
    // Google Shopping has no barcode filter; a GTIN as the query still matches well-listed products.
    const q = search.gtin ?? search.query;

    // 12h cache: the free SerpApi tier is only ~250 searches a month.
    return cached(`serpapi:shopping:${gl}:${q.toLowerCase()}`, 12 * 3600, async () => {
      const params = new URLSearchParams({ engine: "google_shopping", q, gl, hl, api_key: this.apiKey });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      if (!res.ok) throw new ProviderError("Google Shopping", `HTTP ${res.status}`);
      const body = (await res.json()) as { error?: string; shopping_results?: ShoppingResult[] };
      if (body.error && !/hasn't returned any results/i.test(body.error)) {
        throw new ProviderError("Google Shopping", body.error);
      }

      return (body.shopping_results ?? []).flatMap((r, i): MarketListing[] => {
        const currency = detectCurrency(r.price);
        const price = Number(r.extracted_price);
        if (!r.title || !currency || !Number.isFinite(price) || price <= 0) return [];
        return [
          {
            id: r.product_id ?? `${gl}-${i}`,
            title: r.source ? `${r.title} (${r.source})` : r.title,
            price,
            // Shopping results show the item price; delivery is usually extra but not structured.
            shipping: null,
            currency,
            url: r.product_link ?? r.link ?? "",
            imageUrl: r.thumbnail,
          },
        ];
      });
    });
  }
}
