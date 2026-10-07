import "server-only";
import { createHash } from "node:crypto";
import type { AnalysisInput } from "@/lib/analysis";
import type { CurrentUser } from "@/lib/auth";
import { COUNTRY_CODES, isCountryCode, parseCostSettings, type CountryCode } from "@/lib/markets";
import type { Plan } from "@/lib/plans";
import { isCategoryId, type CategoryId } from "@/lib/pricing/duty";
import type { ImportPayer } from "@/lib/pricing/landed-cost";
import { buildSearchQuery } from "@/lib/pricing/matching";
import { isShippingPreference, type ShippingPreference } from "@/lib/pricing/shipping";
import { getSupplierProvider } from "@/lib/providers";
import type { SupplierProductDetail } from "@/lib/providers/types";

/** Countries pre-selected for a new analysis, in priority order. */
export const DEFAULT_COUNTRY_ORDER: CountryCode[] = ["US", "GB", "DE", "UA", "CA", "AU", "FR", "IT", "ES"];

export interface AnalyzeParams {
  source: "cj" | "custom";
  id?: string;
  title?: string;
  cost?: number;
  shipping?: number;
  weight?: number;
  variant?: string;
  query?: string;
  /** Ukrainian-language query for the Ukraine market. */
  queryUa?: string;
  gtin?: string;
  category: CategoryId;
  shippingPref: ShippingPreference;
  importPayer: ImportPayer;
  countries: CountryCode[];
  run: boolean;
}

type ParamSource = Record<string, string | string[] | undefined> | FormData;

function getter(source: ParamSource) {
  const all = (key: string): string[] => {
    const raw = source instanceof FormData ? source.getAll(key).map(String) : source[key];
    return (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).map((v) => v.trim()).filter(Boolean);
  };
  return { one: (key: string) => all(key)[0], all };
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Reads analysis parameters from page searchParams or a submitted form. */
export function readAnalyzeParams(source: ParamSource): AnalyzeParams {
  const { one, all } = getter(source);
  const countries = all("c").flatMap((v) => v.split(",")).filter(isCountryCode);
  const gtin = one("gtin")?.replace(/\D/g, "");
  return {
    source: one("source") === "custom" ? "custom" : "cj",
    id: one("id"),
    title: one("title")?.slice(0, 200),
    cost: toNumber(one("cost")),
    shipping: toNumber(one("shipping")),
    weight: toNumber(one("weight")),
    variant: one("variant"),
    query: one("q")?.slice(0, 100),
    queryUa: one("qua")?.slice(0, 100),
    gtin: gtin && gtin.length >= 8 ? gtin : undefined,
    category: isCategoryId(one("cat")) ? (one("cat") as CategoryId) : "other",
    shippingPref: isShippingPreference(one("ship")) ? (one("ship") as ShippingPreference) : "balanced",
    importPayer: one("payer") === "buyer" ? "buyer" : "seller",
    countries: [...new Set(countries)],
    run: one("run") === "1",
  };
}

export type BuiltAnalysis =
  | {
      ok: true;
      input: AnalysisInput;
      product: SupplierProductDetail | null;
      /** Stable identifier for usage de-duplication and saving. */
      ref: string;
      notices: string[];
    }
  | { ok: false; error: string };

export async function buildAnalysisInput(
  params: AnalyzeParams,
  user: CurrentUser,
  plan: Plan,
): Promise<BuiltAnalysis> {
  const notices: string[] = [];

  let countries = params.countries.length
    ? params.countries
    : DEFAULT_COUNTRY_ORDER.slice(0, plan.maxCountries);
  if (countries.length > plan.maxCountries) {
    notices.push(`Your ${plan.name} plan compares up to ${plan.maxCountries} countries at once. Extra countries were skipped.`);
    countries = countries.slice(0, plan.maxCountries);
  }
  countries = COUNTRY_CODES.filter((c) => countries.includes(c));

  const settings = parseCostSettings(user.costSettings);
  let input: AnalysisInput;
  let product: SupplierProductDetail | null = null;

  if (params.source === "custom") {
    if (!params.title || params.cost === undefined) {
      return { ok: false, error: "Enter a product title and supplier cost." };
    }
    const id = createHash("sha256").update(`${params.title}|${params.cost}`).digest("hex").slice(0, 16);
    input = {
      source: "custom",
      productId: `custom_${id}`,
      title: params.title,
      query: params.query || buildSearchQuery(params.title),
      queryByCountry: params.queryUa ? { UA: params.queryUa } : undefined,
      gtin: params.gtin,
      category: params.category,
      shippingPreference: params.shippingPref,
      importPayer: params.importPayer,
      supplierCostUsd: params.cost,
      weightGrams: params.weight,
      shippingUsdOverride: params.shipping,
      countries,
      settings,
    };
  } else {
    if (!params.id) return { ok: false, error: "No product selected." };
    try {
      product = await getSupplierProvider().getProduct(params.id);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not load the supplier product." };
    }
    if (!product) return { ok: false, error: "Supplier product not found." };

    const variant = product.variants.find((v) => v.id === params.variant) ?? product.variants[0];
    input = {
      source: "cj",
      productId: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      query: params.query || buildSearchQuery(product.title),
      queryByCountry: params.queryUa ? { UA: params.queryUa } : undefined,
      gtin: params.gtin,
      category: params.category,
      shippingPreference: params.shippingPref,
      importPayer: params.importPayer,
      supplierCostUsd: variant?.priceUsd ?? product.priceUsd,
      weightGrams: variant?.weightGrams ?? product.weightGrams,
      variantId: variant?.id,
      countries,
      settings,
    };
  }

  const ref = createHash("sha256")
    .update(
      // Only fields that change which external data is fetched; cost-only options re-run for free.
      JSON.stringify([input.source, input.productId, input.variantId, input.query, input.queryByCountry, input.gtin, input.supplierCostUsd, input.shippingUsdOverride, countries]),
    )
    .digest("hex")
    .slice(0, 24);

  return { ok: true, input, product, ref, notices };
}

export function analyzeSearchParams(params: Partial<AnalyzeParams>): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("source", params.source ?? "cj");
  if (params.id) sp.set("id", params.id);
  if (params.title) sp.set("title", params.title);
  if (params.cost !== undefined) sp.set("cost", String(params.cost));
  if (params.shipping !== undefined) sp.set("shipping", String(params.shipping));
  if (params.weight !== undefined) sp.set("weight", String(params.weight));
  if (params.variant) sp.set("variant", params.variant);
  if (params.query) sp.set("q", params.query);
  if (params.queryUa) sp.set("qua", params.queryUa);
  if (params.gtin) sp.set("gtin", params.gtin);
  if (params.category) sp.set("cat", params.category);
  if (params.shippingPref) sp.set("ship", params.shippingPref);
  if (params.importPayer) sp.set("payer", params.importPayer);
  if (params.countries?.length) sp.set("c", params.countries.join(","));
  if (params.run) sp.set("run", "1");
  return sp;
}

/** Builds the /dashboard/analyze URL for given params. */
export function analyzeHref(params: Partial<AnalyzeParams>): string {
  return `/dashboard/analyze?${analyzeSearchParams(params)}`;
}
