import "server-only";
import { createHash } from "node:crypto";
import type { AnalysisInput } from "@/lib/analysis";
import type { CurrentUser } from "@/lib/auth";
import { COUNTRY_CODES, isCountryCode, parseCostSettings, type CountryCode } from "@/lib/markets";
import type { Plan } from "@/lib/plans";
import { isChannelId, type ChannelId } from "@/lib/channels";
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
  channel: ChannelId | "auto";
  /** Commission override, as a fraction (form field is a percentage). */
  commissionPct?: number;
  ordersPerMonth: number;
  adCostUsd: number;
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
    channel: isChannelId(one("ch")) ? (one("ch") as ChannelId) : "auto",
    commissionPct: (() => {
      const pct = toNumber(one("comm"));
      return pct !== undefined && pct <= 60 ? pct / 100 : undefined;
    })(),
    ordersPerMonth: Math.min(100000, Math.max(1, Math.round(toNumber(one("opm")) ?? 30))),
    adCostUsd: Math.min(1000, toNumber(one("ads")) ?? 0),
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
      notices: { code: "countries"; vars: { plan: string; n: number } }[];
    }
  | { ok: false; error: "noTitle" | "noProduct" | "notFound" | "supplier"; detail?: string };

export async function buildAnalysisInput(
  params: AnalyzeParams,
  user: CurrentUser,
  plan: Plan,
): Promise<BuiltAnalysis> {
  const notices: Extract<BuiltAnalysis, { ok: true }>["notices"] = [];

  let countries = params.countries.length
    ? params.countries
    : DEFAULT_COUNTRY_ORDER.slice(0, plan.maxCountries);
  if (countries.length > plan.maxCountries) {
    notices.push({ code: "countries", vars: { plan: plan.name, n: plan.maxCountries } });
    countries = countries.slice(0, plan.maxCountries);
  }
  countries = COUNTRY_CODES.filter((c) => countries.includes(c));

  const settings = parseCostSettings(user.costSettings);
  let input: AnalysisInput;
  let product: SupplierProductDetail | null = null;

  if (params.source === "custom") {
    // Cost is optional: without it the analysis shows market prices only, no margin.
    if (!params.title) return { ok: false, error: "noTitle" };
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
      channel: params.channel,
      commissionPct: params.commissionPct,
      ordersPerMonth: params.ordersPerMonth,
      adCostUsd: params.adCostUsd,
      supplierCostUsd: params.cost,
      weightGrams: params.weight,
      shippingUsdOverride: params.shipping,
      countries,
      settings,
    };
  } else {
    if (!params.id) return { ok: false, error: "noProduct" };
    try {
      product = await getSupplierProvider().getProduct(params.id);
    } catch (err) {
      return { ok: false, error: "supplier", detail: err instanceof Error ? err.message : undefined };
    }
    if (!product) return { ok: false, error: "notFound" };

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
      channel: params.channel,
      commissionPct: params.commissionPct,
      ordersPerMonth: params.ordersPerMonth,
      adCostUsd: params.adCostUsd,
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
  if (params.channel && params.channel !== "auto") sp.set("ch", params.channel);
  if (params.commissionPct !== undefined) sp.set("comm", String(Math.round(params.commissionPct * 10000) / 100));
  if (params.ordersPerMonth && params.ordersPerMonth !== 30) sp.set("opm", String(params.ordersPerMonth));
  if (params.adCostUsd) sp.set("ads", String(params.adCostUsd));
  if (params.countries?.length) sp.set("c", params.countries.join(","));
  if (params.run) sp.set("run", "1");
  return sp;
}

/** Builds the /dashboard/analyze URL for given params. */
export function analyzeHref(params: Partial<AnalyzeParams>): string {
  return `/dashboard/analyze?${analyzeSearchParams(params)}`;
}
