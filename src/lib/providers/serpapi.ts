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

export interface LensMatch {
  title: string;
  url: string;
  source?: string;
  thumbnail?: string;
  price?: number;
  currency?: string;
}

const SYMBOL_CURRENCIES: Record<string, string> = { "€": "EUR", "£": "GBP", "₴": "UAH", "грн": "UAH", "zł": "PLN" };

/**
 * Lens returns currency symbols, not ISO codes. "$" is ambiguous, so it's read
 * as the searched country's dollar (USD/CAD/AUD).
 */
export function lensCurrency(symbol: string | undefined, countryCurrency: string): string | null {
  if (!symbol) return null;
  const s = symbol.trim();
  if (s.includes("$")) return ["USD", "CAD", "AUD"].includes(countryCurrency) ? countryCurrency : "USD";
  return SYMBOL_CURRENCIES[s] ?? (/^[A-Z]{3}$/.test(s) ? s : null);
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

  /**
   * Google Lens "products" matches for a photo. Uploads the image to SerpApi
   * (max 500 KB, id valid 10 minutes), so it works without a public URL.
   */
  async lens(image: Blob, country: string, countryCurrency: string, hint?: string): Promise<LensMatch[]> {
    const form = new FormData();
    form.set("api_key", this.apiKey);
    form.set("image", image, "product.jpg");
    const upload = await fetch("https://serpapi.com/image", { method: "POST", body: form });
    const uploaded = (await upload.json()) as { image_id?: string; error?: string };
    if (!upload.ok || !uploaded.image_id) {
      throw new ProviderError("Google Lens", uploaded.error ?? `image upload failed (HTTP ${upload.status})`);
    }

    const params = new URLSearchParams({
      engine: "google_lens",
      image_id: uploaded.image_id,
      type: "products",
      // SerpApi uses "gb" for the United Kingdom, which matches our country codes.
      country: country.toLowerCase(),
      hl: country === "UA" ? "uk" : "en",
      api_key: this.apiKey,
    });
    if (hint) params.set("q", hint);
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    const body = (await res.json()) as {
      error?: string;
      visual_matches?: {
        title?: string;
        link?: string;
        source?: string;
        thumbnail?: string;
        price?: { extracted_value?: number; currency?: string };
      }[];
    };
    if (!res.ok || (body.error && !/hasn't returned any results/i.test(body.error))) {
      throw new ProviderError("Google Lens", body.error ?? `HTTP ${res.status}`);
    }

    return (body.visual_matches ?? []).flatMap((m): LensMatch[] => {
      if (!m.title || !m.link) return [];
      const price = Number(m.price?.extracted_value);
      return [
        {
          title: m.title,
          url: m.link,
          source: m.source,
          thumbnail: m.thumbnail,
          price: Number.isFinite(price) && price > 0 ? price : undefined,
          currency: lensCurrency(m.price?.currency, countryCurrency) ?? undefined,
        },
      ];
    });
  }
}
