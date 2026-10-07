import "server-only";
import type { BulkRow } from "@prisma/client";
import { runAnalysis, type AnalysisResult } from "@/lib/analysis";
import { buildAnalysisInput, type AnalyzeParams } from "@/lib/analyze-request";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCountryCode, type CountryCode } from "@/lib/markets";
import { effectivePlan, type Plan } from "@/lib/plans";
import { isCategoryId, type CategoryId } from "@/lib/pricing/duty";
import type { ImportPayer } from "@/lib/pricing/landed-cost";
import { isShippingPreference, type ShippingPreference } from "@/lib/pricing/shipping";
import { getUsageToday } from "@/lib/usage";
import type { ProductRow } from "./csv";

export const MAX_BULK_ROWS = 500;
export const MAX_CSV_BYTES = 1_000_000;
/** Rows analysed at the same time; each row already queries all countries in parallel. */
const ROW_CONCURRENCY = 3;

export interface BulkOptions {
  countries: CountryCode[];
  category: CategoryId;
  shippingPref: ShippingPreference;
  importPayer: ImportPayer;
}

export function parseBulkOptions(json: string): BulkOptions {
  const raw = JSON.parse(json) as Partial<BulkOptions>;
  return {
    countries: (raw.countries ?? []).filter(isCountryCode),
    category: isCategoryId(raw.category) ? raw.category : "other",
    shippingPref: isShippingPreference(raw.shippingPref) ? raw.shippingPref : "balanced",
    importPayer: raw.importPayer === "buyer" ? "buyer" : "seller",
  };
}

/** The same parameters the analyze page uses, so "open details" reuses the row's quota and cache. */
type RowFields = { title: string; cost?: number | null; shipping?: number | null; gtin?: string | null; queryUa?: string | null };

export function rowParams(row: RowFields, options: BulkOptions): AnalyzeParams {
  return {
    source: "custom",
    title: row.title,
    cost: row.cost ?? undefined,
    shipping: row.shipping ?? undefined,
    gtin: row.gtin ?? undefined,
    queryUa: row.queryUa ?? undefined,
    category: options.category,
    shippingPref: options.shippingPref,
    importPayer: options.importPayer,
    channel: "auto",
    ordersPerMonth: 30,
    adCostUsd: 0,
    countries: options.countries,
    run: true,
  };
}

export type CreateBulkResult =
  | { ok: true; jobId: string }
  | { ok: false; error: "empty" | "tooMany" | "quota"; vars?: Record<string, string | number> };

/**
 * Stores the job and charges one analysis per row up front, so the daily
 * quota is enforced before any API calls are made.
 */
export async function createBulkJob(
  user: CurrentUser,
  plan: Plan,
  fileName: string,
  rows: ProductRow[],
  options: BulkOptions,
): Promise<CreateBulkResult> {
  if (rows.length === 0) return { ok: false, error: "empty" };
  if (rows.length > MAX_BULK_ROWS) return { ok: false, error: "tooMany", vars: { n: MAX_BULK_ROWS } };

  // Each row's quota ref matches what the analyze page would compute for it.
  const refs: string[] = [];
  for (const row of rows) {
    const built = await buildAnalysisInput(rowParams(row, options), user, plan);
    refs.push(built.ok ? built.ref : `bulk-invalid-${row.line}`);
  }

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const alreadyUsed = new Set(
    (
      await db.usageEvent.findMany({
        where: { userId: user.id, kind: "analysis", createdAt: { gte: since }, ref: { in: refs } },
        select: { ref: true },
      })
    ).map((e) => e.ref),
  );
  const newRefs = [...new Set(refs.filter((r) => !alreadyUsed.has(r)))];
  const { analysis: used } = await getUsageToday(user.id);
  const remaining = Math.max(0, plan.analysesPerDay - used);
  if (newRefs.length > remaining) {
    return { ok: false, error: "quota", vars: { need: newRefs.length, plan: plan.name, left: remaining } };
  }

  const job = await db.$transaction(async (tx) => {
    const created = await tx.bulkJob.create({
      data: { userId: user.id, fileName: fileName.slice(0, 120), options: JSON.stringify(options), totalRows: rows.length },
    });
    await tx.bulkRow.createMany({
      data: rows.map((r, position) => ({
        jobId: created.id,
        position,
        title: r.title,
        cost: r.cost,
        shipping: r.shipping,
        gtin: r.gtin,
        queryUa: r.queryUa,
      })),
    });
    await tx.usageEvent.createMany({ data: newRefs.map((ref) => ({ userId: user.id, kind: "analysis", ref })) });
    return created;
  });
  return { ok: true, jobId: job.id };
}

// Jobs being processed by this server process (kept on globalThis to survive dev hot reloads).
const globalForJobs = globalThis as unknown as { bulkRunning?: Set<string> };
const running = (globalForJobs.bulkRunning ??= new Set<string>());

export function isProcessing(jobId: string): boolean {
  return running.has(jobId);
}

/**
 * Works through a job's pending rows. Safe to call repeatedly: a second call
 * while the job is running is a no-op, and a call after a restart resumes it.
 */
export async function processBulkJob(jobId: string): Promise<void> {
  if (running.has(jobId)) return;
  running.add(jobId);
  try {
    const job = await db.bulkJob.findUnique({ where: { id: jobId }, include: { user: true } });
    if (!job || job.status === "done") return;
    await db.bulkJob.update({ where: { id: jobId }, data: { status: "running" } });

    const options = parseBulkOptions(job.options);
    const plan = effectivePlan(job.user);

    for (;;) {
      const batch = await db.bulkRow.findMany({
        where: { jobId, status: "pending" },
        orderBy: { position: "asc" },
        take: ROW_CONCURRENCY,
      });
      if (batch.length === 0) break;

      await Promise.all(batch.map((row) => processRow(row, options, job.user, plan)));
      const done = await db.bulkRow.count({ where: { jobId, status: { not: "pending" } } });
      await db.bulkJob.update({ where: { id: jobId }, data: { doneRows: done } });
    }
    await db.bulkJob.update({ where: { id: jobId }, data: { status: "done" } });
  } catch (err) {
    console.error(`Bulk job ${jobId} stopped:`, err);
  } finally {
    running.delete(jobId);
  }
}

async function processRow(row: BulkRow, options: BulkOptions, user: CurrentUser, plan: Plan): Promise<void> {
  try {
    const built = await buildAnalysisInput(rowParams(row, options), user, plan);
    if (!built.ok) {
      await db.bulkRow.update({ where: { id: row.id }, data: { status: "failed", error: built.detail ?? built.error } });
      return;
    }
    const result = await runAnalysis(built.input);
    await db.bulkRow.update({ where: { id: row.id }, data: { status: "done", result: JSON.stringify(result) } });
  } catch (err) {
    await db.bulkRow.update({
      where: { id: row.id },
      data: { status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "Analysis failed" },
    });
  }
}

export function parseRowResult(row: Pick<BulkRow, "result">): AnalysisResult | null {
  if (!row.result) return null;
  try {
    return JSON.parse(row.result) as AnalysisResult;
  } catch {
    return null;
  }
}
