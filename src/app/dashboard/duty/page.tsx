import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton, money, usd } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { COUNTRY_CODES, MARKETS, parseCostSettings, resolveAssumptions } from "@/lib/markets";
import { CATEGORIES, calculateImportCharges, isCategoryId, type CategoryId } from "@/lib/pricing/duty";
import { getFxRates, toUsd } from "@/lib/providers/fx";

export const metadata: Metadata = { title: "Duty calculator" };

const INPUT_CURRENCIES = ["USD", "EUR", "UAH"] as const;

export default function DutyPage({ searchParams }: PageProps<"/dashboard/duty">) {
  return (
    <>
      <PageHeader
        title="Duty calculator"
        description="Import duty, border VAT and customs fees for one parcel from China, in every market at once."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Calculator searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function num(value: string | string[] | undefined, fallback: number): number {
  const n = Number(String(Array.isArray(value) ? value[0] : (value ?? "")).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function Calculator({ searchParams }: Pick<PageProps<"/dashboard/duty">, "searchParams">) {
  const user = await requireUser();
  const sp = await searchParams;
  const currency = INPUT_CURRENCIES.find((c) => c === sp.cur) ?? "USD";
  const goods = num(sp.goods, currency === "UAH" ? 900 : 20);
  const shipping = num(sp.shipping, currency === "UAH" ? 200 : 5);
  const lines = Math.min(20, Math.max(1, Math.round(num(sp.lines, 1))));
  const category: CategoryId = isCategoryId(sp.cat) ? sp.cat : "other";

  const fx = await getFxRates();
  const usdPer = (c: string) => toUsd(1, c, fx);
  const goodsUsd = goods * usdPer(currency);
  const shippingUsd = shipping * usdPer(currency);
  const settings = parseCostSettings(user.costSettings);

  const rows = COUNTRY_CODES.map((code) => {
    const market = MARKETS[code];
    const a = resolveAssumptions(code, settings);
    const charges = calculateImportCharges({
      country: code,
      category,
      goodsUsd,
      shippingUsd,
      tariffLines: lines,
      usdPer,
      currency: market.currency,
      dutyRateOverride: a.dutyRateOverride,
      handlingFee: a.handlingFee,
    });
    const landedUsd = goodsUsd + shippingUsd + charges.totalUsd;
    return { market, charges, landedUsd, toLocal: (n: number) => n / usdPer(market.currency) };
  }).sort((x, y) => x.charges.totalUsd - y.charges.totalUsd);

  return (
    <div className="space-y-6">
      <form action="/dashboard/duty" className="card grid gap-4 p-4 md:grid-cols-5">
        <div>
          <label className="label" htmlFor="goods">
            Goods value (what you pay the supplier)
          </label>
          <input id="goods" name="goods" type="number" step="any" min="0" defaultValue={goods} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="shipping">
            Shipping cost
          </label>
          <input id="shipping" name="shipping" type="number" step="any" min="0" defaultValue={shipping} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="cur">
            Currency
          </label>
          <select id="cur" name="cur" defaultValue={currency} className="input">
            {INPUT_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cat">
            Product category
          </label>
          <select id="cat" name="cat" defaultValue={category} className="input">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="lines">
            Different item types in parcel
          </label>
          <input id="lines" name="lines" type="number" min="1" max="20" defaultValue={lines} className="input" />
        </div>
        <div className="md:col-span-5">
          <button type="submit" className="btn-primary">
            Calculate
          </button>
          <span className="ml-3 text-xs text-muted">
            Rates as of October 2026 · FX {fx.date} · your duty overrides and handling fees from Cost settings apply.
          </span>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Destination</th>
              <th className="px-4 py-3 text-right font-medium">Duty</th>
              <th className="px-4 py-3 text-right font-medium">Border VAT/GST</th>
              <th className="px-4 py-3 text-right font-medium">Fees</th>
              <th className="px-4 py-3 text-right font-medium">Total charges</th>
              <th className="px-4 py-3 text-right font-medium">Landed cost</th>
              <th className="px-4 py-3 font-medium">Rules applied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ market, charges, landedUsd, toLocal }) => (
              <tr key={market.code} className="align-top">
                <td className="px-4 py-3 whitespace-nowrap">
                  {market.flag} {market.name}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{usd(charges.dutyUsd)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{usd(charges.importVatUsd)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{usd(charges.feesUsd)}</td>
                <td className={`px-4 py-3 text-right font-medium tabular-nums ${charges.totalUsd === 0 ? "text-positive" : ""}`}>
                  {usd(charges.totalUsd)}
                  {market.currency !== "USD" && (
                    <span className="block text-xs font-normal text-muted">{money(toLocal(charges.totalUsd), market.currency)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {usd(landedUsd)}
                  {market.currency !== "USD" && (
                    <span className="block text-xs text-muted">{money(toLocal(landedUsd), market.currency)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {charges.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        VAT that the marketplace charges at sale (UK, EU via IOSS, Australia) is already inside the selling price, so it
        isn&apos;t listed here. Category rates are typical values — the exact HS code of your product decides the real rate.
      </p>
    </div>
  );
}
