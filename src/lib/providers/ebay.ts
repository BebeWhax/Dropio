import "server-only";
import { createHash } from "node:crypto";
import { cached, getCache, setCache } from "@/lib/cache";
import type { Market } from "@/lib/markets";
import { ProviderError, type MarketListing, type MarketProvider, type MarketSearch } from "./types";

interface EbayItemSummary {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  shippingOptions?: { shippingCost?: { value: string; currency: string } }[];
  image?: { imageUrl: string };
  itemWebUrl: string;
}

export class EbayProvider implements MarketProvider {
  readonly name = "eBay";
  readonly isDemo = false;
  private readonly host: string;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    environment: "production" | "sandbox",
  ) {
    this.host = environment === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  }

  private async getToken(): Promise<string> {
    const cacheKey = `ebay:token:${this.host}`;
    const hit = await getCache<string>(cacheKey);
    if (hit) return hit;

    const res = await fetch(`${this.host}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }),
    });
    if (!res.ok) throw new ProviderError("eBay", `token request failed (HTTP ${res.status})`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    await setCache(cacheKey, body.access_token, Math.max(60, body.expires_in - 300));
    return body.access_token;
  }

  async search(market: Market, search: MarketSearch): Promise<MarketListing[]> {
    if (market.priceSource.kind !== "ebay") throw new ProviderError("eBay", `no eBay site for ${market.name}`);
    const marketplaceId = market.priceSource.marketplaceId;
    const key = search.gtin ? `gtin:${search.gtin}` : `q:${search.query.toLowerCase()}`;
    return cached(`ebay:search:${market.code}:${key}`, 6 * 3600, async () => {
      const params = new URLSearchParams({
        limit: "50",
        filter: "buyingOptions:{FIXED_PRICE},conditions:{NEW}",
      });
      // eBay doesn't allow combining gtin with q.
      if (search.gtin) params.set("gtin", search.gtin);
      else params.set("q", search.query);

      const res = await fetch(`${this.host}/buy/browse/v1/item_summary/search?${params}`, {
        headers: {
          Authorization: `Bearer ${await this.getToken()}`,
          "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
          // Ships-to location, so shipping costs are calculated for buyers in that country.
          "X-EBAY-C-ENDUSERCTX": `contextualLocation=country%3D${market.code}`,
        },
      });
      if (!res.ok) throw new ProviderError("eBay", `search failed on ${marketplaceId} (HTTP ${res.status})`);
      const body = (await res.json()) as { itemSummaries?: EbayItemSummary[] };
      return mapItemSummaries(body.itemSummaries);
    });
  }

  /**
   * Visually similar listings for a photo. eBay supports this only on the
   * US, UK, German and Australian sites.
   */
  async searchByImage(market: Market, imageBase64: string): Promise<MarketListing[]> {
    if (market.priceSource.kind !== "ebay" || !EBAY_IMAGE_SEARCH_MARKETS.has(market.code)) return [];
    const marketplaceId = market.priceSource.marketplaceId;
    const imageHash = createHash("sha256").update(imageBase64).digest("hex").slice(0, 32);

    return cached(`ebay:image:${market.code}:${imageHash}`, 24 * 3600, async () => {
      const params = new URLSearchParams({ limit: "50", filter: "buyingOptions:{FIXED_PRICE},conditions:{NEW}" });
      const res = await fetch(`${this.host}/buy/browse/v1/item_summary/search_by_image?${params}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await this.getToken()}`,
          "Content-Type": "application/json",
          "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
          "X-EBAY-C-ENDUSERCTX": `contextualLocation=country%3D${market.code}`,
        },
        body: JSON.stringify({ image: imageBase64 }),
      });
      if (!res.ok) throw new ProviderError("eBay", `image search failed on ${marketplaceId} (HTTP ${res.status})`);
      const body = (await res.json()) as { itemSummaries?: EbayItemSummary[] };
      return mapItemSummaries(body.itemSummaries);
    });
  }
}

/** eBay sites that support search_by_image. */
export const EBAY_IMAGE_SEARCH_MARKETS = new Set(["US", "GB", "DE", "AU"]);

function mapItemSummaries(items: EbayItemSummary[] | undefined): MarketListing[] {
  return (items ?? []).flatMap((item): MarketListing[] => {
    const price = Number(item.price?.value);
    if (!item.price || !Number.isFinite(price)) return [];
    const ship = item.shippingOptions?.[0]?.shippingCost;
    return [
      {
        id: item.itemId,
        title: item.title,
        price,
        shipping: ship && ship.currency === item.price.currency ? Number(ship.value) : null,
        currency: item.price.currency,
        url: item.itemWebUrl,
        imageUrl: item.image?.imageUrl,
      },
    ];
  });
}
