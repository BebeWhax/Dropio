import "server-only";
import { env } from "@/lib/env";
import { MARKETS, type CountryCode } from "@/lib/markets";
import { deriveQueryFromTitles } from "@/lib/pricing/matching";
import { summarizePrices, type PriceSummary } from "@/lib/pricing/stats";
import { getSupplierProvider } from "@/lib/providers";
import { CjProvider } from "@/lib/providers/cj";
import { DemoMarketProvider } from "@/lib/providers/demo";
import { EBAY_IMAGE_SEARCH_MARKETS, EbayProvider } from "@/lib/providers/ebay";
import { SerpApiShoppingProvider, type LensMatch } from "@/lib/providers/serpapi";
import type { MarketListing, SupplierProduct } from "@/lib/providers/types";

/** Google Lens accepts uploads up to 500 KB. */
export const LENS_MAX_BYTES = 500_000;

export interface EbayImageResult {
  country: CountryCode;
  currency: string;
  price: PriceSummary | null;
  listings: MarketListing[];
  error?: string;
}

export interface ImageSearchResult {
  generatedAt: string;
  country: CountryCode;
  currency: string;
  /** Text description of the product, from the hint or the matched titles. */
  query: string;
  demo: boolean;
  lens: { matches: LensMatch[]; price: PriceSummary | null; error?: string };
  ebay: EbayImageResult[];
  /** `note` is a message code (cjLevel | cjFailed | cjPublic) or a raw provider error. */
  suppliers: { mode: "image" | "keyword"; products: SupplierProduct[]; note?: string };
}

export interface ImageSearchInput {
  image: Buffer;
  mime: string;
  /** Public URL of the stored image, for services that fetch it themselves. */
  publicUrl: string;
  fileName: string;
  country: CountryCode;
  hint?: string;
}

/** Services like CJ can only fetch images from a publicly reachable APP_URL. */
function isPublicUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return !/^(localhost|127\.|10\.|192\.168\.|\[?::1\]?)|\.(local|test|localhost)$/.test(host);
  } catch {
    return false;
  }
}

/** A readable label from a file name, used only to make demo results look plausible. */
function labelFromFileName(name: string): string {
  const words = name
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[^a-z]+/i)
    .filter((w) => w.length > 2 && !/^(img|image|photo|dsc|screenshot|pxl)$/i.test(w));
  return words.slice(0, 4).join(" ").toLowerCase() || "gadget";
}

export async function runImageSearch(input: ImageSearchInput): Promise<ImageSearchResult> {
  const market = MARKETS[input.country];
  const lensLive = Boolean(env.serpApiKey);
  const ebayLive = Boolean(env.ebayClientId && env.ebayClientSecret);
  const demoLabel = input.hint || labelFromFileName(input.fileName);
  const demoMarkets = new DemoMarketProvider();

  // 1. Google Lens and eBay image search run in parallel; both see the image, not text.
  const lensTask = (async (): Promise<ImageSearchResult["lens"]> => {
    try {
      let matches: LensMatch[];
      if (lensLive) {
        if (input.image.byteLength > LENS_MAX_BYTES) throw new Error("Image is over Google Lens' 500 KB limit");
        const blob = new Blob([new Uint8Array(input.image)], { type: input.mime });
        matches = await new SerpApiShoppingProvider(env.serpApiKey!).lens(blob, input.country, market.currency, input.hint);
      } else {
        const listings = await demoMarkets.search(market, { query: demoLabel });
        matches = listings.slice(0, 16).map((l, i) => ({
          title: l.title,
          url: l.url,
          source: `Demo shop ${(i % 5) + 1}`,
          price: l.price,
          currency: l.currency,
        }));
      }
      const local = matches.filter((m) => m.price !== undefined && m.currency === market.currency);
      return { matches, price: summarizePrices(local.map((m) => m.price!)) };
    } catch (err) {
      return { matches: [], price: null, error: err instanceof Error ? err.message : "Google Lens failed" };
    }
  })();

  const ebayMarkets = [...EBAY_IMAGE_SEARCH_MARKETS].map((c) => MARKETS[c as CountryCode]);
  const ebayTask = Promise.all(
    ebayMarkets.map(async (m): Promise<EbayImageResult> => {
      try {
        const listings = ebayLive
          ? await new EbayProvider(env.ebayClientId!, env.ebayClientSecret!, env.ebayEnvironment).searchByImage(
              m,
              input.image.toString("base64"),
            )
          : await demoMarkets.search(m, { query: demoLabel });
        const local = listings.filter((l) => l.currency === m.currency);
        return {
          country: m.code,
          currency: m.currency,
          price: summarizePrices(local.map((l) => l.price + (l.shipping ?? 0))),
          listings: local.slice(0, 8),
        };
      } catch (err) {
        return { country: m.code, currency: m.currency, price: null, listings: [], error: err instanceof Error ? err.message : "eBay failed" };
      }
    }),
  );

  const [lens, ebay] = await Promise.all([lensTask, ebayTask]);

  // 2. Describe the product in words, for supplier search and margin analysis.
  const titles = [...lens.matches.slice(0, 10).map((m) => m.title), ...ebay.flatMap((e) => e.listings.slice(0, 3).map((l) => l.title))];
  const query = input.hint || deriveQueryFromTitles(titles) || demoLabel;

  // 3. Suppliers: CJ's own image search when possible, otherwise a keyword search.
  let suppliers: ImageSearchResult["suppliers"] = { mode: "keyword", products: [] };
  if (env.cjApiKey && isPublicUrl(input.publicUrl)) {
    try {
      const products = await new CjProvider(env.cjApiKey).searchByImage(input.publicUrl);
      if (products.length) suppliers = { mode: "image", products: products.slice(0, 12) };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      suppliers.note = /401|unauthor/i.test(message) ? "cjLevel" : "cjFailed";
    }
  } else if (env.cjApiKey) {
    suppliers.note = "cjPublic";
  }
  if (suppliers.products.length === 0) {
    try {
      const { items } = await getSupplierProvider().search(query, 1);
      suppliers = { ...suppliers, mode: "keyword", products: items.slice(0, 12) };
    } catch (err) {
      suppliers.note = err instanceof Error ? err.message : "Supplier search failed";
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    country: input.country,
    currency: market.currency,
    query,
    demo: !lensLive || !ebayLive,
    lens,
    ebay,
    suppliers,
  };
}
