import type { Metadata } from "next";
import { Suspense } from "react";
import { Notice, PageHeader, Skeleton, money, usd } from "@/components/ui";
import { fmt } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { getLocale, getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { COUNTRY_CODES, isCountryCode, MARKETS, type CountryCode } from "@/lib/markets";
import { getFxRates, toUsd } from "@/lib/providers/fx";
import { CARRIERS } from "@/lib/shipping/carriers";
import { novaPoshtaPrice } from "@/lib/shipping/novaposhta";
import { quoteCarriers } from "@/lib/shipping/quote";
import type { Leg } from "@/lib/shipping/tariff";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).shippingCalc.title };
}

type SP = Record<string, string | string[] | undefined>;

function num(sp: SP, key: string, fallback?: number): number | undefined {
  const raw = sp[key];
  const n = Number(String(Array.isArray(raw) ? raw[0] : (raw ?? "")).replace(",", "."));
  return raw !== undefined && raw !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
}

function str(sp: SP, key: string): string {
  const raw = sp[key];
  return String(Array.isArray(raw) ? raw[0] : (raw ?? "")).trim().slice(0, 80);
}

export default async function ShippingPage({ searchParams }: PageProps<"/dashboard/shipping">) {
  const t = (await getMessages()).shippingCalc;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Calculator searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Calculator({ searchParams }: Pick<PageProps<"/dashboard/shipping">, "searchParams">) {
  const [, messages, sp, locale] = await Promise.all([requireUser(), getMessages(), searchParams, getLocale()]);
  const t = messages.shippingCalc;

  const leg: Leg = sp.leg === "domestic" ? "domestic" : "international";
  const destination: CountryCode = isCountryCode(sp.to) ? sp.to : "UA";
  const weightKg = Math.min(1000, num(sp, "w", 0.5)!);
  const l = num(sp, "l");
  const w = num(sp, "wd");
  const h = num(sp, "h");
  const dims = l && w && h ? { lengthCm: l, widthCm: w, heightCm: h } : undefined;
  const declaredValueUsd = num(sp, "dv");
  const codAmountUsd = num(sp, "cod");

  const fx = await getFxRates();
  const usdPer = (c: string) => toUsd(1, c, fx);
  const quotes = quoteCarriers({ leg, destination, weightKg, dims, declaredValueUsd, codAmountUsd, usdPer });
  const sources = [...new Map(CARRIERS.filter((c) => quotes.some((q) => q.serviceId === c.id)).map((c) => [c.source, c.asOf])).entries()];

  return (
    <div className="space-y-6">
      <form action="/dashboard/shipping" className="card grid gap-4 p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label" htmlFor="leg">
            {t.leg}
          </label>
          <select id="leg" name="leg" defaultValue={leg} className="input">
            <option value="international">{t.legInternational}</option>
            <option value="domestic">{t.legDomestic}</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="to">
            {t.destination}
          </label>
          <select id="to" name="to" defaultValue={destination} className="input">
            {COUNTRY_CODES.map((c) => (
              <option key={c} value={c}>
                {MARKETS[c].flag} {messages.countries[c]}
              </option>
            ))}
          </select>
        </div>
        <NumberField id="w" label={t.weight} value={weightKg} step="0.01" />
        <NumberField id="l" label={t.length} value={l} />
        <NumberField id="wd" label={t.width} value={w} />
        <NumberField id="h" label={t.height} value={h} />
        <NumberField id="dv" label={t.declared} value={declaredValueUsd} step="0.01" />
        <NumberField id="cod" label={t.cod} value={codAmountUsd} step="0.01" />
        <div className="flex items-end md:col-span-2">
          <button type="submit" className="btn-primary">
            {t.calculate}
          </button>
        </div>
      </form>

      {quotes.length === 0 ? (
        <Notice tone="warning">{t.none}</Notice>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t.carrier}</th>
                <th className="px-4 py-3 font-medium">{t.days}</th>
                <th className="px-4 py-3 font-medium">{t.billed}</th>
                <th className="px-4 py-3 text-right font-medium">{t.price}</th>
                <th className="px-4 py-3 text-right font-medium">{t.priceUsd}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quotes.map((q, i) => (
                <tr key={q.serviceId} className={i === 0 ? "bg-accent-soft/40" : ""}>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {q.carrier} <span className="font-normal text-muted">· {(locale === "uk" && q.serviceUk) || q.service}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {fmt(t.breakdown, {
                        base: money(q.basePrice, q.currency),
                        fuel: q.fuelSurcharge ? fmt(t.fuel, { v: money(q.fuelSurcharge, q.currency) }) : "",
                        value: q.valueFee ? fmt(t.value, { v: money(q.valueFee, q.currency) }) : "",
                        cod: q.codFee ? fmt(t.codFee, { v: money(q.codFee, q.currency) }) : "",
                      })}
                      {q.estimate && <span className="ml-2 rounded bg-warning-bg px-1.5 py-0.5 text-warning-fg">{t.estimate}</span>}
                      {q.serviceId === "cn-fedex-ip" && <span className="ml-2 rounded bg-border px-1.5 py-0.5">{t.listPrice}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{q.days ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {q.weight.chargeableKg} kg
                    {q.weight.volumetricApplies && <span className="ml-1 text-xs text-warning-fg">({t.volumetric})</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{money(q.price, q.currency)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{usd(q.priceUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {leg === "domestic" && destination === "UA" && (
        <NovaPoshtaLive sp={sp} weightKg={weightKg} declaredValueUah={(declaredValueUsd ?? 0) / usdPer("UAH")} codUah={(codAmountUsd ?? 0) / usdPer("UAH")} t={messages} />
      )}

      <div className="space-y-2 text-xs text-muted">
        <p>{t.formula}</p>
        {sources.length > 0 && (
          <p>
            {t.sources}:{" "}
            {sources.map(([source, asOf]) => (
              <span key={source} className="mr-3 inline-block">
                {source} ({asOf})
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

function NumberField({ id, label, value, step = "1" }: { id: string; label: string; value?: number; step?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} name={id} type="number" min="0" step={step} defaultValue={value} className="input" />
    </div>
  );
}

/** Exact Nova Poshta price via the official API, when a key is configured. */
async function NovaPoshtaLive({
  sp,
  weightKg,
  declaredValueUah,
  codUah,
  t: messages,
}: {
  sp: SP;
  weightKg: number;
  declaredValueUah: number;
  codUah: number;
  t: Messages;
}) {
  const t = messages.shippingCalc;
  const from = str(sp, "npf") || "Київ";
  const to = str(sp, "npt") || "Львів";
  const door = sp.npd === "1";

  let price: Awaited<ReturnType<typeof novaPoshtaPrice>> = null;
  let error: string | null = null;
  if (env.novaPoshtaApiKey) {
    try {
      price = await novaPoshtaPrice({
        fromCity: from,
        toCity: to,
        weightKg,
        declaredValue: declaredValueUah,
        serviceType: door ? "WarehouseDoors" : "WarehouseWarehouse",
        codAmount: codUah || undefined,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : "?";
    }
  }

  const result = !env.novaPoshtaApiKey ? (
    <p className="text-xs text-muted">{t.npNoKey}</p>
  ) : error ? (
    <Notice tone="error">{fmt(t.npFailed, { error })}</Notice>
  ) : price ? (
    <p className="text-sm font-medium">
      {fmt(t.npResult, {
        from: price.senderCity,
        to: price.recipientCity,
        cost: price.cost,
        cod: price.codCost ? fmt(t.npCod, { cost: price.codCost }) : "",
      })}
    </p>
  ) : (
    <Notice tone="warning">{t.npNotFound}</Notice>
  );

  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">{t.npLiveTitle}</h2>
      <form action="/dashboard/shipping" className="grid gap-3 md:grid-cols-4 md:items-end">
        {/* Keep the parcel parameters from the main form. */}
        {["leg", "to", "w", "l", "wd", "h", "dv", "cod"].map((k) =>
          typeof sp[k] === "string" ? <input key={k} type="hidden" name={k} value={sp[k] as string} /> : null,
        )}
        <div>
          <label className="label" htmlFor="npf">
            {t.npFrom}
          </label>
          <input id="npf" name="npf" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="npt">
            {t.npTo}
          </label>
          <input id="npt" name="npt" defaultValue={to} className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="npd" value="1" defaultChecked={door} className="accent-[var(--accent)]" />
          {t.npDoor}
        </label>
        <button type="submit" className="btn-secondary">
          {t.calculate}
        </button>
      </form>
      {result}
    </section>
  );
}
