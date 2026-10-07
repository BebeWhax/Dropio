import "server-only";
import { cached } from "@/lib/cache";
import { env } from "@/lib/env";

const API = "https://api.novaposhta.ua/v2.0/json/";

interface NpResponse<T> {
  success: boolean;
  data: T[];
  errors: string[];
}

async function call<T>(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>): Promise<T[]> {
  if (!env.novaPoshtaApiKey) throw new Error("Nova Poshta API key is not set");
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: env.novaPoshtaApiKey, modelName, calledMethod, methodProperties }),
  });
  if (!res.ok) throw new Error(`Nova Poshta HTTP ${res.status}`);
  const body = (await res.json()) as NpResponse<T>;
  if (!body.success) throw new Error(body.errors?.join("; ") || "Nova Poshta request failed");
  return body.data;
}

/** Resolves a city name (Ukrainian) to Nova Poshta's city Ref. */
export async function findCityRef(name: string): Promise<{ ref: string; label: string } | null> {
  const query = name.trim();
  if (!query) return null;
  return cached(`np:city:${query.toLowerCase()}`, 30 * 24 * 3600, async () => {
    const data = await call<{ Addresses: { DeliveryCity: string; Present: string }[] }>("Address", "searchSettlements", {
      CityName: query,
      Limit: "1",
      Page: "1",
    });
    const hit = data[0]?.Addresses?.[0];
    return hit ? { ref: hit.DeliveryCity, label: hit.Present } : null;
  });
}

export interface NpPrice {
  cost: number;
  codCost: number;
  senderCity: string;
  recipientCity: string;
}

/**
 * Exact price from Nova Poshta's official calculator (InternetDocument.getDocumentPrice).
 * Free with a key from the Nova Poshta business cabinet.
 */
export async function novaPoshtaPrice(opts: {
  fromCity: string;
  toCity: string;
  weightKg: number;
  declaredValue: number;
  serviceType: "WarehouseWarehouse" | "WarehouseDoors";
  codAmount?: number;
}): Promise<NpPrice | null> {
  const [from, to] = await Promise.all([findCityRef(opts.fromCity), findCityRef(opts.toCity)]);
  if (!from || !to) return null;

  const props: Record<string, unknown> = {
    CitySender: from.ref,
    CityRecipient: to.ref,
    Weight: String(Math.max(0.1, opts.weightKg)),
    ServiceType: opts.serviceType,
    Cost: String(Math.max(1, Math.round(opts.declaredValue))),
    CargoType: "Parcel",
    SeatsAmount: "1",
  };
  if (opts.codAmount) props.RedeliveryCalculate = { CargoType: "Money", Amount: String(Math.round(opts.codAmount)) };

  const key = `np:price:${JSON.stringify(props)}`;
  return cached(key, 24 * 3600, async () => {
    const data = await call<{ Cost: number; CostRedelivery?: number }>("InternetDocument", "getDocumentPrice", props);
    const row = data[0];
    if (!row) return null;
    return { cost: Number(row.Cost), codCost: Number(row.CostRedelivery ?? 0), senderCity: from.label, recipientCity: to.label };
  });
}
