import { getCurrentUser } from "@/lib/auth";
import { csvCell } from "@/lib/bulk/csv";
import { parseBulkOptions, parseRowResult } from "@/lib/bulk/jobs";
import { db } from "@/lib/db";

/** Downloads a job's results as CSV (UTF-8 with BOM so Excel shows Cyrillic correctly). */
export async function GET(_request: Request, { params }: RouteContext<"/api/bulk/[id]/export">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const job = await db.bulkJob.findFirst({
    where: { id, userId: user.id },
    include: { rows: { orderBy: { position: "asc" } } },
  });
  if (!job) return new Response("Not found", { status: 404 });

  const { countries } = parseBulkOptions(job.options);
  const header = ["name", "cost_usd", "status", "best_country", "best_profit_usd", "best_margin_pct"];
  for (const c of countries) {
    header.push(`${c}_median_price`, `${c}_currency`, `${c}_median_usd`, `${c}_listings`, `${c}_match`, `${c}_import_charges_usd`, `${c}_profit_usd`, `${c}_margin_pct`);
  }

  const lines = [header.join(",")];
  for (const row of job.rows) {
    const result = parseRowResult(row);
    const cells: unknown[] = [row.title, row.cost, row.error ? `failed: ${row.error}` : row.status, result?.best?.country, result?.best?.profitUsd, result?.best?.marginPct];
    for (const c of countries) {
      const r = result?.countries.find((x) => x.country === c);
      cells.push(
        r?.priceLocal?.median.toFixed(2),
        r?.currency,
        r?.priceUsd?.median.toFixed(2),
        r?.listingsUsed,
        r?.confidence,
        r?.breakdown?.importChargesUsd,
        r?.breakdown?.profitUsd,
        r?.breakdown?.marginPct,
      );
    }
    lines.push(cells.map(csvCell).join(","));
  }

  const name = job.fileName.replace(/\.(csv|txt)$/i, "").replace(/[^\w.-]+/g, "_");
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-market-results.csv"`,
    },
  });
}
