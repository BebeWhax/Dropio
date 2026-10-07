import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { Meter, PageHeader, ProductImage, Skeleton, Stat, pct } from "@/components/ui";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/env";
import { MARKETS, isCountryCode } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";
import { getUsageToday } from "@/lib/usage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).overview.title };
}

export default async function OverviewPage() {
  const t = (await getMessages()).overview;
  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Link href="/dashboard/research" className="btn-primary">
            {t.research}
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
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.overview;
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
        <Stat
          label={t.plan}
          value={messages.plans[plan.id].name}
          hint={
            <Link href="/dashboard/billing" className="text-accent">
              {t.managePlan}
            </Link>
          }
        />
        <UsageStat label={t.analysesToday} used={usage.analysis} limit={plan.analysesPerDay} />
        <UsageStat label={t.searchesToday} used={usage.search} limit={plan.searchesPerDay} />
        <UsageStat label={t.watchlist} used={savedCount} limit={plan.maxSaved} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{t.recentlySaved}</h2>
          <Link href="/dashboard/saved" className="text-sm text-accent">
            {t.viewAll}
          </Link>
        </div>
        {saved.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">{t.nothingSaved}</div>
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
                    <span className="text-sm text-muted">{t.noMarketData}</span>
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
