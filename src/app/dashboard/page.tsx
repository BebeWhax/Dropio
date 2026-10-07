import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { Meter, PageHeader, ProductImage, Skeleton, Stat, pct } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/env";
import { MARKETS, isCountryCode } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";
import { getUsageToday } from "@/lib/usage";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Your plan usage and recently saved products."
        actions={
          <Link href="/dashboard/research" className="btn-primary">
            Research products
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const user = await requireUser();
  const plan = effectivePlan(user);
  const [usage, saved, savedCount] = await Promise.all([
    getUsageToday(user.id),
    db.savedProduct.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.savedProduct.count({ where: { userId: user.id } }),
  ]);

  return (
    <>
      <DemoBanner suppliers={!dataSources.suppliersLive} markets={!dataSources.marketsLive} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Plan" value={plan.name} hint={<Link href="/dashboard/billing" className="text-accent">Manage plan</Link>} />
        <UsageStat label="Analyses today" used={usage.analysis} limit={plan.analysesPerDay} />
        <UsageStat label="Searches today" used={usage.search} limit={plan.searchesPerDay} />
        <UsageStat label="Watchlist" used={savedCount} limit={plan.maxSaved} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recently saved</h2>
          <Link href="/dashboard/saved" className="text-sm text-accent">
            View all
          </Link>
        </div>
        {saved.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            Nothing saved yet. Analyze a product and save it to track its margins here.
          </div>
        ) : (
          <ul className="card divide-y divide-border">
            {saved.map((item) => (
              <li key={item.id}>
                <Link href={`/dashboard/saved/${item.id}`} className="flex items-center gap-3 p-3 hover:bg-background">
                  <ProductImage src={item.imageUrl} alt={item.title} size={40} />
                  <span className="flex-1 truncate text-sm">{item.title}</span>
                  {item.bestCountry && isCountryCode(item.bestCountry) && item.bestMarginPct !== null ? (
                    <span className={`text-sm tabular-nums ${item.bestMarginPct >= 0 ? "text-positive" : "text-negative"}`}>
                      {MARKETS[item.bestCountry].flag} {pct(item.bestMarginPct)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted">No market data</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function UsageStat({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {used}
        <span className="text-base font-normal text-muted"> / {limit}</span>
      </div>
      <div className="mt-2">
        <Meter used={used} limit={limit} />
      </div>
    </div>
  );
}
