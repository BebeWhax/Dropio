import "server-only";
import { MARKETS, resolveAssumptions, type CostSettings, type CountryCode } from "@/lib/markets";
import { calculateImportCharges, type CategoryId, type ImportCharges } from "@/lib/pricing/duty";
import { calculateLandedCost, estimateShippingUsd, type ImportPayer, type LandedCostBreakdown } from "@/lib/pricing/landed-cost";
import { matchListings, type MatchConfidence } from "@/lib/pricing/matching";
import { pickShipping, type ShippingPreference } from "@/lib/pricing/shipping";
import { summarizePrices, type PriceSummary } from "@/lib/pricing/stats";
import { getFxRates, toUsd } from "@/lib/providers/fx";
import { getMarketProvider, getSupplierProvider } from "@/lib/providers";
import type { ShippingQuote } from "@/lib/providers/types";

export interface AnalysisInput {
  source: "cj" | "custom";
  productId: string;
  title: string;
  imageUrl?: string;
  /** Marketplace search query (defaults to one built from the title). */
  query: string;
  /** Per-country query overrides, e.g. a Ukrainian-language query for Ukraine. */
  queryByCountry?: Partial<Record<CountryCode, string>>;
  gtin?: string;
  supplierCostUsd: number;
  weightGrams?: number;
  /** Supplier variant used for carrier shipping quotes. */
  variantId?: string;
  /** Fixed shipping cost that skips carrier quotes (custom products). */
  shippingUsdOverride?: number;
  shippingPreference: ShippingPreference;
  category: CategoryId;
  importPayer: ImportPayer;
  countries: CountryCode[];
  settings: CostSettings;
}

export interface SampleListing {
  title: string;
  url: string;
  priceLocal: number;
  score: number;
}

export interface CountryAnalysis {
  country: CountryCode;
  currency: string;
  query: string;
  listingsFound: number;
  listingsUsed: number;
  confidence: MatchConfidence;
  /** Buyer total (item + shipping) in the market currency. */
  priceLocal: PriceSummary | null;
  priceUsd: PriceSummary | null;
  /** The carrier option used for the margin. */
  shipping: ShippingQuote;
  /** Every carrier option the supplier offered. */
  shippingOptions: ShippingQuote[];
  importCharges: ImportCharges;
  breakdown: LandedCostBreakdown | null;
  samples: SampleListing[];
  error?: string;
}

export interface AnalysisResult {
  generatedAt: string;
  input: Omit<AnalysisInput, "settings">;
  fxDate: string;
  fxFallback: boolean;
  demo: { suppliers: boolean; markets: boolean };
  countries: CountryAnalysis[];
  best: { country: CountryCode; profitUsd: number; marginPct: number } | null;
}

async function resolveShipping(input: AnalysisInput, country: CountryCode): Promise<{ chosen: ShippingQuote; options: ShippingQuote[] }> {
  if (input.shippingUsdOverride !== undefined) {
    const own = { costUsd: input.shippingUsdOverride, method: "Your estimate", estimated: true };
    return { chosen: own, options: [own] };
  }
  if (input.variantId) {
    try {
      const options = await getSupplierProvider().quoteShipping(input.variantId, country);
      const chosen = pickShipping(options, input.shippingPreference);
      if (chosen) return { chosen, options };
    } catch (err) {
      console.warn(`Shipping quote failed for ${country}:`, err);
    }
  }
  const estimate = { costUsd: estimateShippingUsd(input.weightGrams, country), method: "Weight-based estimate", estimated: true };
  return { chosen: estimate, options: [estimate] };
}

export async function runAnalysis(input: AnalysisInput): Promise<AnalysisResult> {
  const fx = await getFxRates();
  const usdPer = (currency: string) => toUsd(1, currency, fx);
  let anyDemoMarket = false;

  const countries = await Promise.all(
    input.countries.map(async (code): Promise<CountryAnalysis> => {
      const market = MARKETS[code];
      const marketProvider = getMarketProvider(market);
      if (marketProvider.isDemo) anyDemoMarket = true;

      const assumptions = resolveAssumptions(code, input.settings);
      const query = input.queryByCountry?.[code] || input.query;
      const { chosen: shipping, options: shippingOptions } = await resolveShipping(input, code);
      const importCharges = calculateImportCharges({
        country: code,
        category: input.category,
        goodsUsd: input.supplierCostUsd,
        shippingUsd: shipping.costUsd,
        usdPer,
        currency: market.currency,
        dutyRateOverride: assumptions.dutyRateOverride,
        handlingFee: assumptions.handlingFee,
      });

      const empty: CountryAnalysis = {
        country: code,
        currency: market.currency,
        query,
        listingsFound: 0,
        listingsUsed: 0,
        confidence: "none",
        priceLocal: null,
        priceUsd: null,
        shipping,
        shippingOptions,
        importCharges,
        breakdown: null,
        samples: [],
      };

      try {
        const listings = await marketProvider.search(market, { query, gtin: input.gtin });
        // Only compare listings in the market's own currency (skips cross-border oddities).
        const local = listings.filter((l) => l.currency === market.currency);
        const { matched, confidence } = matchListings(query, local, {
          englishTitles: market.englishTitles,
          byGtin: Boolean(input.gtin) && market.priceSource.kind === "ebay",
        });

        // Unknown shipping counts as free: undercounting revenue is the safer error.
        const priceLocal = summarizePrices(matched.map((l) => l.price + (l.shipping ?? 0)));
        if (!priceLocal) return { ...empty, listingsFound: listings.length };

        const usdPerUnit = usdPer(market.currency);
        const priceUsd: PriceSummary = {
          ...priceLocal,
          median: priceLocal.median * usdPerUnit,
          p25: priceLocal.p25 * usdPerUnit,
          p75: priceLocal.p75 * usdPerUnit,
          min: priceLocal.min * usdPerUnit,
          max: priceLocal.max * usdPerUnit,
        };

        const breakdown = calculateLandedCost({
          sellPriceUsd: priceUsd.median,
          supplierCostUsd: input.supplierCostUsd,
          shippingUsd: shipping.costUsd,
          importCharges,
          importPayer: input.importPayer,
          assumptions,
          marketToUsd: usdPerUnit,
        });

        return {
          ...empty,
          listingsFound: listings.length,
          listingsUsed: priceLocal.count,
          confidence,
          priceLocal,
          priceUsd,
          breakdown,
          samples: matched.slice(0, 5).map((l) => ({
            title: l.title,
            url: l.url,
            priceLocal: l.price + (l.shipping ?? 0),
            score: Math.round(l.score * 100) / 100,
          })),
        };
      } catch (err) {
        return { ...empty, error: err instanceof Error ? err.message : "Market search failed" };
      }
    }),
  );

  const ranked = countries
    .filter((c) => c.breakdown && c.confidence !== "none")
    .sort((a, b) => b.breakdown!.profitUsd - a.breakdown!.profitUsd);
  const top = ranked[0];

  const inputSummary: AnalysisResult["input"] = { ...input };
  delete (inputSummary as Partial<AnalysisInput>).settings;
  return {
    generatedAt: new Date().toISOString(),
    input: inputSummary,
    fxDate: fx.date,
    fxFallback: fx.fallback,
    demo: { suppliers: input.source === "cj" && getSupplierProvider().isDemo, markets: anyDemoMarket },
    countries,
    best: top
      ? { country: top.country, profitUsd: top.breakdown!.profitUsd, marginPct: top.breakdown!.marginPct }
      : null,
  };
}
