import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BulkUploadForm } from "@/components/bulk-upload-form";
import { DemoBanner } from "@/components/demo-banner";
import { Meter, PageHeader, Skeleton } from "@/components/ui";
import { DEFAULT_COUNTRY_ORDER } from "@/lib/analyze-request";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/env";
import { effectivePlan } from "@/lib/plans";
import { getUsageToday } from "@/lib/usage";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).bulk.title };
}

export default async function BulkPage() {
  const t = (await getMessages()).bulk;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Bulk />
      </Suspense>
    </>
  );
}

async function Bulk() {
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.bulk;
  const plan = effectivePlan(user);
  const [usage, jobs] = await Promise.all([
    getUsageToday(user.id),
    db.bulkJob.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const remaining = Math.max(0, plan.analysesPerDay - usage.analysis);

  return (
    <div className="space-y-6">
      <DemoBanner suppliers={false} markets={!dataSources.marketsLive} />
      <p className="text-sm text-muted">
        {fmt(t.remaining, { left: remaining, total: plan.analysesPerDay, plan: messages.plans[plan.id].name })}
      </p>
      <BulkUploadForm defaultCountries={DEFAULT_COUNTRY_ORDER.slice(0, plan.maxCountries)} maxCountries={plan.maxCountries} />

      <section>
        <h2 className="mb-3 font-semibold">{t.yourUploads}</h2>
        {jobs.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">{t.noUploads}</div>
        ) : (
          <ul className="card divide-y divide-border">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link href={`/dashboard/bulk/${job.id}`} className="flex items-center gap-4 p-3 hover:bg-background">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{job.fileName}</div>
                    <div className="text-xs text-muted">
                      {job.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {fmt(t.products, { n: job.totalRows })}
                    </div>
                  </div>
                  <div className="w-32">
                    <Meter used={job.doneRows} limit={job.totalRows} kind="progress" />
                    <div className="mt-1 text-right text-xs text-muted">{job.status === "done" ? t.done : `${job.doneRows}/${job.totalRows}`}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
