import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ImageSearchForm } from "@/components/image-search-form";
import { PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/env";
import { isCountryCode, MARKETS } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";
import { getUsageToday } from "@/lib/usage";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).image.title };
}

export default async function ImageSearchPage() {
  const t = (await getMessages()).image;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="space-y-6">
        <ImageSearchForm />
        <Suspense fallback={<Skeleton className="h-40" />}>
          <History />
        </Suspense>
      </div>
    </>
  );
}

async function History() {
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.image;
  const plan = effectivePlan(user);
  const [usage, searches] = await Promise.all([
    getUsageToday(user.id),
    db.imageSearch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { id: true, publicToken: true, country: true, hint: true, createdAt: true, result: true },
    }),
  ]);

  return (
    <section>
      <p className="mb-3 text-sm text-muted">
        {fmt(t.left, { left: Math.max(0, plan.imageSearchesPerDay - usage.image), total: plan.imageSearchesPerDay })}
        {!dataSources.googleShoppingLive && t.lensDemo}
      </p>
      {searches.length > 0 && (
        <>
          <h2 className="mb-3 font-semibold">{t.recent}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {searches.map((s) => {
              const query = s.result ? (JSON.parse(s.result) as { query?: string }).query : undefined;
              return (
                <li key={s.id}>
                  <Link href={`/dashboard/image/${s.id}`} className="card block overflow-hidden hover:border-accent">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/img/${s.publicToken}`} alt={query ?? t.selected} className="aspect-square w-full object-cover" />
                    <div className="p-2 text-xs">
                      <div className="truncate font-medium">{query ?? t.processing}</div>
                      <div className="text-muted">
                        {isCountryCode(s.country) ? MARKETS[s.country].flag : ""} {s.createdAt.toISOString().slice(0, 10)}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
