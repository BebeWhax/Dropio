import "server-only";
import { env } from "@/lib/env";
import type { Market } from "@/lib/markets";
import { CjProvider } from "./cj";
import { DemoMarketProvider, DemoSupplierProvider } from "./demo";
import { EbayProvider } from "./ebay";
import { SerpApiShoppingProvider } from "./serpapi";
import type { MarketProvider, SupplierProvider } from "./types";

/** Falls back to demo data per integration when its credentials are missing. */
export function getSupplierProvider(): SupplierProvider {
  return env.cjApiKey ? new CjProvider(env.cjApiKey) : new DemoSupplierProvider();
}

/** Picks the price source for a market (eBay site, or Google Shopping where eBay has none). */
export function getMarketProvider(market: Market): MarketProvider {
  if (market.priceSource.kind === "google_shopping") {
    return env.serpApiKey ? new SerpApiShoppingProvider(env.serpApiKey) : new DemoMarketProvider();
  }
  return env.ebayClientId && env.ebayClientSecret
    ? new EbayProvider(env.ebayClientId, env.ebayClientSecret, env.ebayEnvironment)
    : new DemoMarketProvider();
}
