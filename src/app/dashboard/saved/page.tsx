import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { deleteSaved } from "@/app/actions/products";
import { Notice, PageHeader, ProductImage, Skeleton, pct } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MARKETS, isCountryCode } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";

export const metadata: Metadata = { title: "Watchlist" };

export default function SavedPage({ searchParams }: PageProps<"/dashboard/saved">) {
  return (
    <>
      <PageHeader title="Watchlist" description="Products you saved, with the margin snapshot from when you saved them." />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SavedList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SavedList({ searchParams }: Pick<PageProps<"/dashboard/saved">, "searchParams">) {
  const user = await requireUser();
  const plan = effectivePlan(user);
  const sp = await searchParams;
  const items = await db.savedProduct.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });

  return (
    <>
      {sp.saved && <Notice tone="success">Saved to your watchlist.</Notice>}
      {sp.error === "limit" && (
        <Notice tone="warning">
          Your {plan.name} plan holds {plan.maxSaved} products. Remove some or{" "}
          <Link href="/dashboard/billing" className="underline">
            upgrade
          </Link>
          .
        </Notice>
      )}
      {sp.error === "invalid" && <Notice tone="error">That analysis could not be saved.</Notice>}
      <p className="mb-3 text-sm text-muted">
        {items.length} of {plan.maxSaved} slots used
      </p>
      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          No saved products yet.{" "}
          <Link href="/dashboard/research" className="text-accent">
            Start researching
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
                  {item.source === "custom" ? "Your product" : "CJ"} · saved {item.updatedAt.toISOString().slice(0, 10)}
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
                <button type="submit" className="text-xs text-muted hover:text-negative" aria-label={`Remove ${item.title}`}>
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
