import type { CountryCode } from "@/lib/markets";
import { CARRIERS } from "./carriers";
import { quoteService, type Leg, type ServiceQuote } from "./tariff";
import type { Dimensions } from "./weight";

export interface CarrierQuote extends ServiceQuote {
  priceUsd: number;
  estimate: boolean;
  serviceUk?: string;
}

export interface QuoteRequest {
  leg: Leg;
  destination: CountryCode;
  weightKg: number;
  dims?: Dimensions;
  /** Declared value and cash-on-delivery amount, in USD (converted to each carrier's currency). */
  declaredValueUsd?: number;
  codAmountUsd?: number;
  /** USD value of one unit of a currency. */
  usdPer: (currency: string) => number;
}

/** Quotes every carrier service for a parcel, cheapest first. */
export function quoteCarriers(req: QuoteRequest): CarrierQuote[] {
  return CARRIERS.filter((c) => c.leg === req.leg && (req.leg === "international" || c.from === req.destination))
    .flatMap((service): CarrierQuote[] => {
      const toLocal = (usd: number | undefined) => (usd === undefined ? undefined : usd / req.usdPer(service.currency));
      const quote = quoteService(service, {
        destination: req.destination,
        weightKg: req.weightKg,
        dims: req.dims,
        declaredValue: toLocal(req.declaredValueUsd),
        codAmount: toLocal(req.codAmountUsd),
      });
      if (!quote) return [];
      return [
        {
          ...quote,
          priceUsd: Math.round(quote.price * req.usdPer(service.currency) * 100) / 100,
          estimate: service.estimate,
          serviceUk: service.serviceUk,
        },
      ];
    })
    .sort((a, b) => a.priceUsd - b.priceUsd);
}
