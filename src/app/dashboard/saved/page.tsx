import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { deleteSaved } from "@/app/actions/products";
import { Notice, PageHeader, ProductImage, Skeleton, pct } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MARKETS, isCountryCode } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).saved.title };
}

export default async function SavedPage({ searchParams }: PageProps<"/dashboard/saved">) {
  const t = (await getMessages()).saved;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SavedList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SavedList({ searchParams }: Pick<PageProps<"/dashboard/saved">, "searchParams">) {
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.saved;
  const plan = effectivePlan(user);
  const sp = await searchParams;
  const items = await db.savedProduct.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });

  return (
    <>
      {sp.saved && <Notice tone="success">{t.saved}</Notice>}
      {sp.error === "limit" && (
        <Notice tone="warning">
          {fmt(t.limit, { plan: messages.plans[plan.id].name, n: plan.maxSaved })}{" "}
          <Link href="/dashboard/billing" className="underline">
            {messages.common.seePlans}
          </Link>
        </Notice>
      )}
      {sp.error === "invalid" && <Notice tone="error">{t.invalid}</Notice>}
      <p className="mb-3 text-sm text-muted">{fmt(t.slots, { used: items.length, max: plan.maxSaved })}</p>
      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          {t.empty}{" "}
          <Link href="/dashboard/research" className="text-accent">
            {t.start}
          </Link>
        </div>
      ) : (
        <ul className="card divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3">
              <ProductImage src={item.imageUrl} alt={item.title} size={48} />
              <Link href={`/dashboard/saved/${item.id}`} className="min-w-0 flex-1 hover:underline">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="text-xs text-muted">
                  {item.source === "custom" ? t.yourProduct : "CJ"} · {fmt(t.savedOn, { date: item.updatedAt.toISOString().slice(0, 10) })}
                </div>
              </Link>
              {item.bestCountry && isCountryCode(item.bestCountry) && item.bestMarginPct !== null ? (
                <span className={`text-sm tabular-nums ${item.bestMarginPct >= 0 ? "text-positive" : "text-negative"}`}>
                  {MARKETS[item.bestCountry].flag} {pct(item.bestMarginPct)}
                </span>
              ) : (
                <span className="text-sm text-muted">—</span>
              )}
              <form action={deleteSaved}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="text-xs text-muted hover:text-negative">
                  {messages.common.remove}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
