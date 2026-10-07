import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { deleteBulkJob } from "@/app/actions/bulk";
import { AutoRefresh } from "@/components/auto-refresh";
import { DemoBanner } from "@/components/demo-banner";
import { Meter, PageHeader, Skeleton, money, pct } from "@/components/ui";
import type { CountryAnalysis } from "@/lib/analysis";
import { analyzeHref } from "@/lib/analyze-request";
import { requireUser } from "@/lib/auth";
import { isProcessing, parseBulkOptions, parseRowResult, processBulkJob, rowParams } from "@/lib/bulk/jobs";
import { db } from "@/lib/db";
import { MARKETS } from "@/lib/markets";
import { fmt } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).bulk.title };
}

export default function BulkJobPage({ params }: PageProps<"/dashboard/bulk/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <BulkJob params={params} />
    </Suspense>
  );
}

async function BulkJob({ params }: Pick<PageProps<"/dashboard/bulk/[id]">, "params">) {
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.bulk;
  const { id } = await params;
  const job = await db.bulkJob.findFirst({
    where: { id, userId: user.id },
    include: { rows: { orderBy: { position: "asc" } } },
  });
  if (!job) notFound();

  const options = parseBulkOptions(job.options);
  const finished = job.status === "done";
  // Resume jobs interrupted by a server restart.
  if (!finished && !isProcessing(job.id)) after(() => processBulkJob(job.id));

  const rows = job.rows.map((row) => ({ row, result: parseRowResult(row) }));
  const anyDemo = rows.some((r) => r.result?.demo.markets);

  return (
    <>
      <PageHeader
        title={job.fileName}
        description={`${fmt(t.products, { n: job.totalRows })} · ${options.countries.map((c) => MARKETS[c].flag).join(" ")}`}
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/bulk" className="btn-secondary">
              {t.uploads}
            </Link>
            <a href={`/api/bulk/${job.id}/export`} className="btn-primary">
              {t.download}
            </a>
          </div>
        }
      />
      {!finished && <AutoRefresh />}
      <DemoBanner suppliers={false} markets={anyDemo} />

      <div className="card mb-4 p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span>{finished ? t.progressDone : t.progressRunning}</span>
          <span className="tabular-nums text-muted">
            {job.doneRows}/{job.totalRows}
          </span>
        </div>
        <Meter used={job.doneRows} limit={job.totalRows} kind="progress" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 360 + options.countries.length * 130 }}>
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">{t.product}</th>
              <th className="px-3 py-3 font-medium">{t.best}</th>
              {options.countries.map((c) => (
                <th key={c} className="px-3 py-3 text-right font-medium">
                  {MARKETS[c].flag} {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ row, result }) => (
              <tr key={row.id} className="align-top">
                <td className="max-w-64 px-3 py-2">
                  <Link
                    href={analyzeHref(rowParams(row, options))}
                    prefetch={false}
                    className="line-clamp-2 font-medium hover:underline"
                    title={t.openDetails}
                  >
                    {row.title}
                  </Link>
                  <span className="text-xs text-muted">{row.cost !== null ? fmt(t.costLabel, { price: `$${row.cost.toFixed(2)}` }) : t.noCost}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.status === "pending" ? (
                    <span className="text-xs text-muted">{t.queued}</span>
                  ) : row.status === "failed" ? (
                    <span className="text-xs text-negative" title={row.error ?? ""}>
                      {t.failed}
                    </span>
                  ) : result?.best ? (
                    <span className={result.best.marginPct >= 0 ? "text-positive" : "text-negative"}>
                      {MARKETS[result.best.country].flag} {pct(result.best.marginPct)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">{row.cost === null ? t.pricesOnly : t.noMatches}</span>
                  )}
                </td>
                {options.countries.map((c) => (
                  <td key={c} className="px-3 py-2 text-right">
                    <Cell analysis={result?.countries.find((x) => x.country === c)} t={messages} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">{t.footnote}</p>
      <form action={deleteBulkJob} className="mt-4 text-right">
        <input type="hidden" name="id" value={job.id} />
        <button type="submit" className="text-xs text-muted hover:text-negative">
          {t.deleteUpload}
        </button>
      </form>
    </>
  );
}

function Cell({ analysis, t }: { analysis?: CountryAnalysis; t: Messages }) {
  if (!analysis) return <span className="text-muted">·</span>;
  if (!analysis.priceLocal) return <span className="text-xs text-muted">{analysis.error ? "error" : "—"}</span>;
  const b = analysis.breakdown;
  return (
    <div className="tabular-nums">
      <div>{money(analysis.priceLocal.median, analysis.currency)}</div>
      <div className="text-xs text-muted">
        {fmt(t.bulk.listings, { n: analysis.listingsUsed })}
        {analysis.confidence === "low" ? t.bulk.lowMatch : ""}
      </div>
      {b && <div className={`text-xs font-medium ${b.profitUsd >= 0 ? "text-positive" : "text-negative"}`}>{pct(b.marginPct)}</div>}
    </div>
  );
}
