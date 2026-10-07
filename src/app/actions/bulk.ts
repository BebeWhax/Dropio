"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { DEFAULT_COUNTRY_ORDER } from "@/lib/analyze-request";
import { requireUser } from "@/lib/auth";
import { parseProductCsv } from "@/lib/bulk/csv";
import { createBulkJob, MAX_CSV_BYTES, processBulkJob } from "@/lib/bulk/jobs";
import { db } from "@/lib/db";
import { COUNTRY_CODES, isCountryCode } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";
import { isCategoryId } from "@/lib/pricing/duty";
import { isShippingPreference } from "@/lib/pricing/shipping";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";

export interface BulkUploadState {
  error?: string;
}

export async function uploadBulkCsv(_prev: BulkUploadState, formData: FormData): Promise<BulkUploadState> {
  const user = await requireUser();
  const plan = effectivePlan(user);
  const t = (await getMessages()).bulk;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t.errNoFile };
  if (file.size > MAX_CSV_BYTES) return { error: t.errTooBig };
  if (!/\.(csv|txt)$/i.test(file.name)) return { error: t.errType };

  const parsed = parseProductCsv(await file.text());
  if (parsed.rows.length === 0) return { error: t.errEmpty };

  const chosen = formData.getAll("c").map(String).filter(isCountryCode);
  const countries = COUNTRY_CODES.filter((c) =>
    (chosen.length ? chosen : DEFAULT_COUNTRY_ORDER).slice(0, plan.maxCountries).includes(c),
  );
  const category = formData.get("cat");
  const ship = formData.get("ship");

  const result = await createBulkJob(user, plan, file.name, parsed.rows, {
    countries,
    category: isCategoryId(category) ? category : "other",
    shippingPref: isShippingPreference(ship) ? ship : "balanced",
    importPayer: formData.get("payer") === "buyer" ? "buyer" : "seller",
  });
  if (!result.ok) {
    const message = { empty: t.errEmpty, tooMany: t.errTooMany, quota: t.errQuota }[result.error];
    return { error: fmt(message, result.vars) };
  }

  // Analyse in the background after the redirect; the job page shows progress.
  after(() => processBulkJob(result.jobId));
  redirect(`/dashboard/bulk/${result.jobId}`);
}

export async function deleteBulkJob(formData: FormData): Promise<void> {
  const user = await requireUser();
  await db.bulkJob.deleteMany({ where: { id: String(formData.get("id") ?? ""), userId: user.id } });
  redirect("/dashboard/bulk");
}
