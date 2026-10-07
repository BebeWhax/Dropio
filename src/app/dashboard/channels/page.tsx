import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton, money } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { channelFeesForSale, channelsFor } from "@/lib/channels";
import { COUNTRY_CODES, isCountryCode, MARKETS, type CountryCode } from "@/lib/markets";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).channels.title };
}

/** A typical small-item sale price per market currency, as the default for comparison. */
const DEFAULT_PRICE: Record<string, number> = { USD: 30, GBP: 25, EUR: 28, CAD: 40, AUD: 45, UAH: 1200 };

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export default async function ChannelsPage({ searchParams }: PageProps<"/dashboard/channels">) {
  const t = (await getMessages()).channels;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Comparison({ searchParams }: Pick<PageProps<"/dashboard/channels">, "searchParams">) {
  const [, messages, locale, sp] = await Promise.all([requireUser(), getMessages(), getLocale(), searchParams]);
  const t = messages.channels;

  const country: CountryCode = isCountryCode(sp.c) ? sp.c : locale === "uk" ? "UA" : "US";
  const currency = MARKETS[country].currency;
  const read = (key: string, fallback: number) => {
    const n = Number(String(sp[key] ?? "").replace(",", "."));
    return sp[key] !== undefined && sp[key] !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const price = read("p", DEFAULT_PRICE[currency] ?? 30);
  const orders = Math.max(1, Math.round(read("o", 30)));
  const ads = read("a", 0);

  const rows = channelsFor(country)
    .map((channel) => {
      const fees = channel.fees[country]!;
      // Own stores carry the ad cost; marketplaces bring their own traffic.
      const sale = channelFeesForSale(fees, price, { ordersPerMonth: orders, adCostPerOrder: channel.kind === "own_store" ? ads : 0 });
      return { channel, fees, sale };
    })
    .sort((a, b) => a.sale.total - b.sale.total);

  return (
    <div className="space-y-6">
      <form action="/dashboard/channels" className="card grid gap-4 p-4 md:grid-cols-5 md:items-end">
        <div className="md:col-span-2">
          <label className="label" htmlFor="c">
            {t.country}
          </label>
          <select id="c" name="c" defaultValue={country} className="input">
            {COUNTRY_CODES.map((c) => (
              <option key={c} value={c}>
                {MARKETS[c].flag} {messages.countries[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p">
            {fmt(t.price, { currency })}
          </label>
          <input id="p" name="p" type="number" step="any" min="0" defaultValue={price} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="o">
            {t.orders}
          </label>
          <input id="o" name="o" type="number" min="1" defaultValue={orders} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="a">
            {fmt(t.ads, { currency })}
          </label>
          <input id="a" name="a" type="number" step="any" min="0" defaultValue={ads} className="input" />
        </div>
        <div className="md:col-span-5">
          <button type="submit" className="btn-primary">
            {t.compare}
          </button>
          <span className="ml-3 text-xs text-muted">{t.ownStoreNote}</span>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t.channel}</th>
              <th className="px-4 py-3 text-right font-medium">{t.monthly}</th>
              <th className="px-4 py-3 text-right font-medium">{t.commission}</th>
              <th className="px-4 py-3 text-right font-medium">{t.payment}</th>
              <th className="px-4 py-3 text-right font-medium">{t.perOrder}</th>
              <th className="px-4 py-3 text-right font-medium">{t.totalFees}</th>
              <th className="px-4 py-3 text-right font-medium">{t.youKeep}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ channel, fees, sale }, i) => (
              <tr key={channel.id} className={i === 0 ? "bg-accent-soft/40" : ""}>
                <td className="px-4 py-3">
                  <a href={channel.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                    {channel.name}
                  </a>
                  <div className="text-xs text-muted">
                    {channel.kind === "marketplace" ? t.marketplace : t.ownStore}
                    {fees.estimate && <span className="ml-2 rounded bg-warning-bg px-1.5 py-0.5 text-warning-fg">{t.estimate}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fees.monthly ? money(fees.monthly, currency) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fees.commissionPct ? pct(fees.commissionPct) : "—"}
                  {fees.commissionRange && (
                    <span className="block text-xs text-muted">
                      {fmt(t.byCategory, { range: `${pct(fees.commissionRange[0])}–${pct(fees.commissionRange[1])}` })}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fees.paymentPct || fees.paymentFixed
                    ? `${pct(fees.paymentPct)}${fees.paymentFixed ? ` + ${money(fees.paymentFixed, currency)}` : ""}`
                    : "—"}
                  {fees.extraPct ? <span className="block text-xs text-muted">+{pct(fees.extraPct)}</span> : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fees.perOrderFixed ? money(fees.perOrderFixed, currency) : "—"}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {money(sale.total, currency)}
                  <span className="block text-xs font-normal text-muted">{pct(sale.pct)}</span>
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${price - sale.total >= 0 ? "text-positive" : "text-negative"}`}>
                  {money(price - sale.total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{t.footnote}</p>
    </div>
  );
}
