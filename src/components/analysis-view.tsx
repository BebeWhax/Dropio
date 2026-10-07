import { DemoBanner } from "@/components/demo-banner";
import { Notice, money, pct, usd } from "@/components/ui";
import { fmt } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { dutyNoteText } from "@/i18n/notes";
import { getMessages } from "@/i18n/server";
import type { AnalysisResult, CountryAnalysis } from "@/lib/analysis";
import { getChannel } from "@/lib/channels";
import { MARKETS } from "@/lib/markets";
import type { MatchConfidence } from "@/lib/pricing/matching";

const CONFIDENCE_STYLE: Record<MatchConfidence, string> = {
  high: "bg-accent-soft text-accent",
  medium: "bg-warning-bg text-warning-fg",
  low: "bg-negative/10 text-negative",
  none: "bg-border text-muted",
};

/** Renders a computed or saved analysis. Pure display: no data fetching. */
export async function AnalysisView({ result }: { result: AnalysisResult }) {
  const t = await getMessages();
  const r = t.results;
  const rows = [...result.countries].sort(
    (a, b) => (b.breakdown?.profitUsd ?? -Infinity) - (a.breakdown?.profitUsd ?? -Infinity),
  );

  return (
    <div className="space-y-4">
      <DemoBanner suppliers={result.demo.suppliers} markets={result.demo.markets} />
      {result.fxFallback && <Notice tone="warning">{r.fxFallback}</Notice>}

      {result.best ? (
        <div className="card flex flex-wrap items-center gap-x-8 gap-y-2 p-5">
          <div>
            <div className="text-xs font-medium text-muted">{r.bestMarket}</div>
            <div className="text-xl font-semibold">
              {MARKETS[result.best.country].flag} {t.countries[result.best.country]}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted">{r.profitPerSale}</div>
            <div className={`text-xl font-semibold tabular-nums ${result.best.profitUsd >= 0 ? "text-positive" : "text-negative"}`}>
              {usd(result.best.profitUsd)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted">{r.margin}</div>
            <div className="text-xl font-semibold tabular-nums">{pct(result.best.marginPct)}</div>
          </div>
          <div className="ml-auto text-xs text-muted">
            {fmt(r.searched, { q: result.input.query })}
            {result.input.gtin ? ` · GTIN ${result.input.gtin}` : ""} · FX {result.fxDate}
          </div>
        </div>
      ) : (
        <Notice tone="warning">{r.noListings}</Notice>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{r.country}</th>
              <th className="px-4 py-3 font-medium">{r.marketPrice}</th>
              <th className="px-4 py-3 font-medium">{r.shipping}</th>
              <th className="px-4 py-3 font-medium">{r.importCharges}</th>
              <th className="px-4 py-3 font-medium">{r.vatInPrice}</th>
              <th className="px-4 py-3 font-medium">{r.feesTax}</th>
              <th className="px-4 py-3 text-right font-medium">{r.profit}</th>
              <th className="px-4 py-3 text-right font-medium">{r.margin}</th>
              <th className="px-4 py-3 font-medium">{r.match}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <CountryRow key={row.country} row={row} t={t} />
            ))}
          </tbody>
        </table>
      </div>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-medium">{r.details}</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <CountryDetail key={row.country} row={row} t={t} />
          ))}
        </div>
      </details>

      <p className="text-xs text-muted">{r.footnote}</p>
    </div>
  );
}

function channelName(row: CountryAnalysis): string {
  return row.channel ? getChannel(row.channel).name : MARKETS[row.country].sellingChannel;
}

function CountryRow({ row, t }: { row: CountryAnalysis; t: Messages }) {
  const r = t.results;
  const market = MARKETS[row.country];
  const b = row.breakdown;
  return (
    <tr>
      <td className="px-4 py-3 whitespace-nowrap">
        {market.flag} {t.countries[row.country]}
      </td>
      {b && row.priceLocal ? (
        <>
          <td className="px-4 py-3 tabular-nums">
            {money(row.priceLocal.median, row.currency)}
            {row.currency !== "USD" && <span className="block text-xs text-muted">{usd(b.sellPriceUsd)}</span>}
          </td>
          <td className="px-4 py-3 tabular-nums">
            {usd(b.shippingUsd)}
            <span className="block text-xs text-muted">{row.shipping.estimated ? r.estimate : row.shipping.method}</span>
          </td>
          <td className="px-4 py-3 tabular-nums">
            {usd(b.importChargesUsd)}
            {b.importPaidByBuyer && b.importChargesUsd > 0 && <span className="block text-xs text-muted">{r.paidByBuyer}</span>}
          </td>
          <td className="px-4 py-3 tabular-nums">{usd(b.vatUsd)}</td>
          <td className="px-4 py-3 tabular-nums">
            {usd(b.marketplaceFeeUsd + b.turnoverTaxUsd)}
            <span className="block text-xs text-muted">{channelName(row)}</span>
          </td>
          <td className={`px-4 py-3 text-right font-medium tabular-nums ${b.profitUsd >= 0 ? "text-positive" : "text-negative"}`}>
            {usd(b.profitUsd)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums">{pct(b.marginPct)}</td>
        </>
      ) : row.priceLocal && row.priceUsd ? (
        <>
          <td className="px-4 py-3 tabular-nums">
            {money(row.priceLocal.median, row.currency)}
            {row.currency !== "USD" && <span className="block text-xs text-muted">{usd(row.priceUsd.median)}</span>}
          </td>
          <td colSpan={6} className="px-4 py-3 text-xs text-muted">
            {row.channelUnavailable
              ? fmt(r.channelUnavailable, { channel: channelName(row) })
              : fmt(r.priceOnly, { low: money(row.priceLocal.p25, row.currency), high: money(row.priceLocal.p75, row.currency) })}
          </td>
        </>
      ) : (
        <td colSpan={7} className="px-4 py-3 text-muted">
          {row.error ?? fmt(r.noComparable, { n: row.listingsFound })}
        </td>
      )}
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLE[row.confidence]}`}>
          {t.confidence[row.confidence]}
        </span>
        <span className="ml-2 text-xs text-muted">
          {row.listingsUsed}/{row.listingsFound}
        </span>
      </td>
    </tr>
  );
}

function CountryDetail({ row, t }: { row: CountryAnalysis; t: Messages }) {
  const r = t.results;
  const market = MARKETS[row.country];
  const b = row.breakdown;
  const buyer = b?.importPaidByBuyer ? r.buyerPaysSuffix : "";
  const minus = b?.importPaidByBuyer ? "" : "−";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 font-medium">
        <span>
          {market.flag} {t.countries[row.country]}
        </span>
        <span className="text-xs font-normal text-muted">
          {fmt(r.sellOn, { channel: channelName(row) })} · {fmt(r.searched, { q: row.query })}
        </span>
      </div>
      {b ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted">{r.buyerPays}</dt>
          <dd className="text-right tabular-nums">{usd(b.sellPriceUsd)}</dd>
          <dt className="text-muted">{r.vatRemitted}</dt>
          <dd className="text-right tabular-nums">−{usd(b.vatUsd)}</dd>
          <dt className="text-muted">{r.supplierCost}</dt>
          <dd className="text-right tabular-nums">−{usd(b.supplierCostUsd)}</dd>
          <dt className="text-muted">
            {fmt(r.shippingLine, { method: row.shipping.method, days: row.shipping.days ? fmt(r.days, { days: row.shipping.days }) : "" })}
          </dt>
          <dd className="text-right tabular-nums">−{usd(b.shippingUsd)}</dd>
          <dt className="text-muted">
            {r.duty}
            {buyer}
          </dt>
          <dd className="text-right tabular-nums">
            {minus}
            {usd(b.dutyUsd)}
          </dd>
          {b.importVatUsd > 0 && (
            <>
              <dt className="text-muted">
                {r.importVat}
                {buyer}
              </dt>
              <dd className="text-right tabular-nums">
                {minus}
                {usd(b.importVatUsd)}
              </dd>
            </>
          )}
          {b.importFeesUsd > 0 && (
            <>
              <dt className="text-muted">
                {r.customsFees}
                {buyer}
              </dt>
              <dd className="text-right tabular-nums">
                {minus}
                {usd(b.importFeesUsd)}
              </dd>
            </>
          )}
          <dt className="text-muted">
            {r.channelFees} ({channelName(row)})
          </dt>
          <dd className="text-right tabular-nums">−{usd(b.marketplaceFeeUsd)}</dd>
          {b.turnoverTaxUsd > 0 && (
            <>
              <dt className="text-muted">{r.turnoverTax}</dt>
              <dd className="text-right tabular-nums">−{usd(b.turnoverTaxUsd)}</dd>
            </>
          )}
          <dt className="font-medium">{r.profit}</dt>
          <dd className="text-right font-medium tabular-nums">{usd(b.profitUsd)}</dd>
          <dt className="text-muted">{r.roi}</dt>
          <dd className="text-right tabular-nums">{pct(b.roiPct)}</dd>
          <dt className="text-muted">{r.breakEven}</dt>
          <dd className="text-right tabular-nums">{Number.isFinite(b.breakEvenPriceUsd) ? usd(b.breakEvenPriceUsd) : "—"}</dd>
          {row.priceLocal && (
            <>
              <dt className="text-muted">{r.range}</dt>
              <dd className="text-right tabular-nums">
                {money(row.priceLocal.p25, row.currency)} – {money(row.priceLocal.p75, row.currency)}
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p className="text-xs text-muted">
          {row.channelUnavailable
            ? fmt(r.channelUnavailable, { channel: channelName(row) })
            : (row.error ?? fmt(r.noComparable, { n: row.listingsFound }))}
        </p>
      )}
      {row.importCharges && row.importCharges.notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 border-t border-border pt-2 pl-4 text-xs text-muted">
          {row.importCharges.notes.map((n, i) => (
            <li key={i}>{dutyNoteText(t, n)}</li>
          ))}
        </ul>
      )}
      {(row.shippingOptions?.length ?? 0) > 1 && (
        <table className="mt-3 w-full border-t border-border pt-2 text-xs">
          <tbody>
            {row.shippingOptions.map((o) => {
              const chosen = o.method === row.shipping.method && o.costUsd === row.shipping.costUsd;
              return (
                <tr key={o.method + o.costUsd} className={chosen ? "font-medium text-accent" : "text-muted"}>
                  <td className="py-0.5">
                    {chosen ? "✓ " : ""}
                    {o.method}
                  </td>
                  <td className="py-0.5">{o.days ?? ""}</td>
                  <td className="py-0.5 text-right tabular-nums">{usd(o.costUsd)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {row.samples.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
          {row.samples.map((s) => (
            <li key={s.url + s.title} className="flex gap-2">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-accent hover:underline" title={s.title}>
                {s.title}
              </a>
              <span className="tabular-nums">{money(s.priceLocal, row.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
