import "server-only";
import { cached } from "@/lib/cache";
import { MARKET_CURRENCIES } from "@/lib/markets";

export interface FxRates {
  /** Units of each currency per 1 USD. */
  rates: Record<string, number>;
  date: string;
  /** True when the live feed failed and fallback rates are in use. */
  fallback: boolean;
}

// Only used if the live feeds are unreachable.
const FALLBACK_RATES: Record<string, number> = { USD: 1, EUR: 0.89, GBP: 0.76, CAD: 1.38, AUD: 1.52, UAH: 44.9 };

// The ECB feed (Frankfurter) has no hryvnia, so UAH comes from the National Bank of Ukraine.
const NBU_CURRENCIES = new Set(["UAH"]);

async function fetchNbuUahPerUsd(): Promise<number> {
  const res = await fetch("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json");
  if (!res.ok) throw new Error(`NBU HTTP ${res.status}`);
  const body = (await res.json()) as { rate: number }[];
  const rate = Number(body[0]?.rate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("NBU returned no USD rate");
  return rate;
}

export async function getFxRates(): Promise<FxRates> {
  const symbols = MARKET_CURRENCIES.filter((c) => c !== "USD" && !NBU_CURRENCIES.has(c)).join(",");
  try {
    return await cached("fx:usd:v2", 12 * 3600, async () => {
      const [res, uah] = await Promise.all([
        fetch(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols}`),
        fetchNbuUahPerUsd(),
      ]);
      if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
      const body = (await res.json()) as { date: string; rates: Record<string, number> };
      return { rates: { ...body.rates, UAH: uah, USD: 1 }, date: body.date, fallback: false };
    });
  } catch (err) {
    console.warn("FX rates unavailable, using fallback:", err);
    return { rates: FALLBACK_RATES, date: "fallback", fallback: true };
  }
}

export function toUsd(amount: number, currency: string, fx: FxRates): number {
  const rate = fx.rates[currency];
  if (!rate) throw new Error(`No FX rate for ${currency}`);
  return amount / rate;
}
