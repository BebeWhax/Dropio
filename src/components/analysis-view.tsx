import { DemoBanner } from "@/components/demo-banner";
import { Notice, money, pct, usd } from "@/components/ui";
import type { AnalysisResult, CountryAnalysis } from "@/lib/analysis";
import { MARKETS } from "@/lib/markets";
import type { MatchConfidence } from "@/lib/pricing/matching";

const CONFIDENCE_STYLE: Record<MatchConfidence, string> = {
  high: "bg-accent-soft text-accent",
  medium: "bg-warning-bg text-warning-fg",
  low: "bg-negative/10 text-negative",
  none: "bg-border text-muted",
};

/** Renders a computed or saved analysis. Pure display: no data fetching. */
export function AnalysisView({ result }: { result: AnalysisResult }) {
  const rows = [...result.countries].sort(
    (a, b) => (b.breakdown?.profitUsd ?? -Infinity) - (a.breakdown?.profitUsd ?? -Infinity),
  );

  return (
    <div className="space-y-4">
      <DemoBanner suppliers={result.demo.suppliers} markets={result.demo.markets} />
      {result.fxFallback && <Notice tone="warning">Live exchange rates were unavailable; approximate rates were used.</Notice>}

      {result.best ? (
        <div className="card flex flex-wrap items-center gap-x-8 gap-y-2 p-5">
          <div>
            <div className="text-xs font-medium text-muted">Best market</div>
            <div className="text-xl font-semibold">
              {MARKETS[result.best.country].flag} {MARKETS[result.best.country].name}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted">Profit per sale</div>
            <div className={`text-xl font-semibold tabular-nums ${result.best.profitUsd >= 0 ? "text-positive" : "text-negative"}`}>
              {usd(result.best.profitUsd)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted">Margin</div>
            <div className="text-xl font-semibold tabular-nums">{pct(result.best.marginPct)}</div>
          </div>
          <div className="ml-auto text-xs text-muted">
            Searched “{result.input.query}”{result.input.gtin ? ` · GTIN ${result.input.gtin}` : ""} · FX {result.fxDate}
          </div>
        </div>
      ) : (
        <Notice tone="warning">No comparable listings were found. Try a shorter or different search query.</Notice>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Market price</th>
              <th className="px-4 py-3 font-medium">Shipping</th>
              <th className="px-4 py-3 font-medium">Import charges</th>
              <th className="px-4 py-3 font-medium">VAT in price</th>
              <th className="px-4 py-3 font-medium">Fees &amp; tax</th>
              <th className="px-4 py-3 text-right font-medium">Profit</th>
              <th className="px-4 py-3 text-right font-medium">Margin</th>
              <th className="px-4 py-3 font-medium">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <CountryRow key={row.country} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Matched listings and full cost breakdown</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <CountryDetail key={row.country} row={row} />
          ))}
        </div>
      </details>

      <p className="text-xs text-muted">
        Market price is the median buyer total (item + shipping) of matched new, fixed-price listings (Google Shopping
        offers for Ukraine) after removing outliers. These are asking prices, not sold prices. Import charges follow each
        country&apos;s low-value parcel rules for the chosen category; fees and taxes are estimates you can edit in Cost
        settings.
      </p>
    </div>
  );
}

function CountryRow({ row }: { row: CountryAnalysis }) {
  const market = MARKETS[row.country];
  const b = row.breakdown;
  return (
    <tr>
      <td className="px-4 py-3 whitespace-nowrap">
        {market.flag} {market.name}
      </td>
      {b && row.priceLocal ? (
        <>
          <td className="px-4 py-3 tabular-nums">
            {money(row.priceLocal.median, row.currency)}
            {row.currency !== "USD" && <span className="block text-xs text-muted">{usd(b.sellPriceUsd)}</span>}
          </td>
          <td className="px-4 py-3 tabular-nums">
            {usd(b.shippingUsd)}
            <span className="block text-xs text-muted">{row.shipping.estimated ? "estimate" : row.shipping.method}</span>
          </td>
          <td className="px-4 py-3 tabular-nums">
            {usd(b.importChargesUsd)}
            {b.importPaidByBuyer && b.importChargesUsd > 0 && <span className="block text-xs text-muted">paid by buyer</span>}
          </td>
          <td className="px-4 py-3 tabular-nums">{usd(b.vatUsd)}</td>
          <td className="px-4 py-3 tabular-nums">{usd(b.marketplaceFeeUsd + b.turnoverTaxUsd)}</td>
          <td className={`px-4 py-3 text-right font-medium tabular-nums ${b.profitUsd >= 0 ? "text-positive" : "text-negative"}`}>
            {usd(b.profitUsd)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums">{pct(b.marginPct)}</td>
        </>
      ) : (
        <td colSpan={7} className="px-4 py-3 text-muted">
          {row.error ?? `No comparable listings (${row.listingsFound} found)`}
        </td>
      )}
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLE[row.confidence]}`}>
          {row.confidence}
        </span>
        <span className="ml-2 text-xs text-muted">
          {row.listingsUsed}/{row.listingsFound}
        </span>
      </td>
    </tr>
  );
}

function CountryDetail({ row }: { row: CountryAnalysis }) {
  const market = MARKETS[row.country];
  const b = row.breakdown;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 font-medium">
        <span>
          {market.flag} {market.name}
        </span>
        <span className="text-xs font-normal text-muted">
          sell on {market.sellingChannel} · searched “{row.query}”
        </span>
      </div>
      {b ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted">Buyer pays</dt>
          <dd className="text-right tabular-nums">{usd(b.sellPriceUsd)}</dd>
          <dt className="text-muted">VAT/GST remitted</dt>
          <dd className="text-right tabular-nums">−{usd(b.vatUsd)}</dd>
          <dt className="text-muted">Supplier cost</dt>
          <dd className="text-right tabular-nums">−{usd(b.supplierCostUsd)}</dd>
          <dt className="text-muted">Shipping ({row.shipping.method}{row.shipping.days ? `, ${row.shipping.days} days` : ""})</dt>
          <dd className="text-right tabular-nums">−{usd(b.shippingUsd)}</dd>
          <dt className="text-muted">Import duty{b.importPaidByBuyer ? " (buyer pays)" : ""}</dt>
          <dd className="text-right tabular-nums">{b.importPaidByBuyer ? "" : "−"}{usd(b.dutyUsd)}</dd>
          {b.importVatUsd > 0 && (
            <>
              <dt className="text-muted">Import VAT/GST at the border{b.importPaidByBuyer ? " (buyer pays)" : ""}</dt>
              <dd className="text-right tabular-nums">{b.importPaidByBuyer ? "" : "−"}{usd(b.importVatUsd)}</dd>
            </>
          )}
          {b.importFeesUsd > 0 && (
            <>
              <dt className="text-muted">Customs handling fees{b.importPaidByBuyer ? " (buyer pays)" : ""}</dt>
              <dd className="text-right tabular-nums">{b.importPaidByBuyer ? "" : "−"}{usd(b.importFeesUsd)}</dd>
            </>
          )}
          <dt className="text-muted">Marketplace fees</dt>
          <dd className="text-right tabular-nums">−{usd(b.marketplaceFeeUsd)}</dd>
          {b.turnoverTaxUsd > 0 && (
            <>
              <dt className="text-muted">Turnover tax</dt>
              <dd className="text-right tabular-nums">−{usd(b.turnoverTaxUsd)}</dd>
            </>
          )}
          <dt className="font-medium">Profit</dt>
          <dd className="text-right font-medium tabular-nums">{usd(b.profitUsd)}</dd>
          <dt className="text-muted">ROI on goods</dt>
          <dd className="text-right tabular-nums">{pct(b.roiPct)}</dd>
          <dt className="text-muted">Break-even price</dt>
          <dd className="text-right tabular-nums">{Number.isFinite(b.breakEvenPriceUsd) ? usd(b.breakEvenPriceUsd) : "—"}</dd>
          {row.priceLocal && (
            <>
              <dt className="text-muted">Price range (p25–p75)</dt>
              <dd className="text-right tabular-nums">
                {money(row.priceLocal.p25, row.currency)} – {money(row.priceLocal.p75, row.currency)}
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p className="text-xs text-muted">{row.error ?? "No comparable listings."}</p>
      )}
      {row.importCharges?.notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 border-t border-border pt-2 pl-4 text-xs text-muted">
          {row.importCharges.notes.map((n) => (
            <li key={n}>{n}</li>
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
                  <td className="py-0.5">{chosen ? "✓ " : ""}{o.method}</td>
                  <td className="py-0.5">{o.days ? `${o.days} days` : ""}</td>
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
