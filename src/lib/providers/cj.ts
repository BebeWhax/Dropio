import "server-only";
import { cached, getCache, setCache } from "@/lib/cache";
import type { CountryCode } from "@/lib/markets";
import {
  ProviderError,
  type ShippingQuote,
  type SupplierProduct,
  type SupplierProductDetail,
  type SupplierProvider,
} from "./types";

const BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";
const TOKEN_CACHE_KEY = "cj:token";

interface CjEnvelope<T> {
  code: number;
  result: boolean;
  message: string;
  data: T;
}

/** Parses CJ price strings, which may be a single value or a range like "1.20 -- 3.40". */
export function parseCjPrice(value: unknown): { min: number; max: number } | null {
  if (typeof value === "number") return Number.isFinite(value) ? { min: value, max: value } : null;
  if (typeof value !== "string") return null;
  const nums = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function parseWeight(value: unknown): number | undefined {
  const parsed = parseCjPrice(value);
  return parsed && parsed.max > 0 ? parsed.max : undefined;
}

/**
 * CJ allows 1 request/second on free accounts. This serializes calls within a
 * single server process; a multi-instance deployment needs a shared limiter.
 */
let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;
const MIN_INTERVAL_MS = 1100;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

export class CjProvider implements SupplierProvider {
  readonly name = "CJ Dropshipping";
  readonly isDemo = false;

  constructor(private readonly apiKey: string) {}

  private async getToken(): Promise<string> {
    const hit = await getCache<string>(TOKEN_CACHE_KEY);
    if (hit) return hit;

    const data = await this.call<{ accessToken: string; accessTokenExpiryDate: string }>(
      "/authentication/getAccessToken",
      { method: "POST", body: JSON.stringify({ apiKey: this.apiKey }) },
      false,
    );
    // Tokens last ~180 days; refresh a day early.
    const expiresMs = Date.parse(data.accessTokenExpiryDate) - Date.now() - 24 * 3600 * 1000;
    const ttlSeconds = Number.isFinite(expiresMs) && expiresMs > 0 ? expiresMs / 1000 : 3600;
    await setCache(TOKEN_CACHE_KEY, data.accessToken, ttlSeconds);
    return data.accessToken;
  }

  private async call<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) headers["CJ-Access-Token"] = await this.getToken();

    const res = await throttled(() => fetch(`${BASE_URL}${path}`, { ...init, headers }));
    if (!res.ok) throw new ProviderError("CJ", `HTTP ${res.status} on ${path}`);
    const body = (await res.json()) as CjEnvelope<T>;
    if (body.code !== 200 || !body.result) {
      throw new ProviderError("CJ", body.message || `error code ${body.code}`);
    }
    return body.data;
  }

  async search(keyword: string, page: number) {
    return cached(`cj:search:${keyword.toLowerCase()}:${page}`, 6 * 3600, async () => {
      const params = new URLSearchParams({ keyWord: keyword, page: String(page), size: "20" });
      const data = await this.call<{
        totalRecords?: number;
        content?: { productList?: Record<string, unknown>[] }[];
      }>(`/product/listV2?${params}`);

      const items: SupplierProduct[] = [];
      for (const group of data.content ?? []) {
        for (const p of group.productList ?? []) {
          const price = parseCjPrice(p.sellPrice ?? p.nowPrice);
          if (!p.id || !price) continue;
          items.push({
            id: String(p.id),
            title: String(p.nameEn ?? ""),
            imageUrl: typeof p.bigImage === "string" ? p.bigImage : undefined,
            priceUsd: price.min,
            priceMaxUsd: price.max > price.min ? price.max : undefined,
            category: typeof p.threeCategoryName === "string" ? p.threeCategoryName : undefined,
          });
        }
      }
      return { items, total: data.totalRecords ?? items.length };
    });
  }

  async getProduct(id: string): Promise<SupplierProductDetail | null> {
    return cached(`cj:product:${id}`, 24 * 3600, async () => {
      const p = await this.call<Record<string, unknown> | null>(`/product/query?pid=${encodeURIComponent(id)}`);
      if (!p) return null;
      const price = parseCjPrice(p.sellPrice);
      const rawVariants = Array.isArray(p.variants) ? (p.variants as Record<string, unknown>[]) : [];
      const variants = rawVariants
        .map((v) => ({
          id: String(v.vid ?? ""),
          name: String(v.variantNameEn ?? v.variantKey ?? v.variantSku ?? "Default"),
          priceUsd: parseCjPrice(v.variantSellPrice)?.min ?? price?.min ?? 0,
          weightGrams: parseWeight(v.variantWeight),
        }))
        .filter((v) => v.id && v.priceUsd > 0);
      const prices = variants.map((v) => v.priceUsd);

      return {
        id: String(p.pid ?? id),
        title: String(p.productNameEn ?? ""),
        imageUrl: typeof p.bigImage === "string" ? p.bigImage : undefined,
        priceUsd: prices.length ? Math.min(...prices) : (price?.min ?? 0),
        priceMaxUsd: prices.length ? Math.max(...prices) : price?.max,
        weightGrams: parseWeight(p.packingWeight) ?? parseWeight(p.productWeight),
        category: typeof p.categoryName === "string" ? p.categoryName : undefined,
        variants,
      };
    });
  }

  async quoteShipping(variantId: string, country: CountryCode): Promise<ShippingQuote[]> {
    return cached(`cj:freight-options:${variantId}:${country}`, 24 * 3600, async () => {
      const options = await this.call<{ logisticName: string; logisticPrice: number; logisticAging?: string }[]>(
        "/logistic/freightCalculate",
        {
          method: "POST",
          body: JSON.stringify({
            startCountryCode: "CN",
            endCountryCode: country,
            products: [{ quantity: 1, vid: variantId }],
          }),
        },
      );
      return (options ?? [])
        .filter((o) => Number.isFinite(Number(o.logisticPrice)))
        .map((o) => ({
          costUsd: Number(o.logisticPrice),
          method: o.logisticName,
          days: o.logisticAging,
          estimated: false,
        }))
        .sort((a, b) => a.costUsd - b.costUsd);
    });
  }
}
