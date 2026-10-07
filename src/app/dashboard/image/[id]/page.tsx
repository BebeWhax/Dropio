import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteImageSearch } from "@/app/actions/image";
import { Notice, PageHeader, ProductImage, Skeleton, money, usd } from "@/components/ui";
import { analyzeHref } from "@/lib/analyze-request";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ImageSearchResult } from "@/lib/image-search";
import { MARKETS } from "@/lib/markets";
import type { PriceSummary } from "@/lib/pricing/stats";
import { fmt } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).image.resultsTitle };
}

export default function ImageResultPage({ params }: PageProps<"/dashboard/image/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ImageResult params={params} />
    </Suspense>
  );
}

function PriceLine({ price, currency, t }: { price: PriceSummary | null; currency: string; t: Messages }) {
  if (!price) return <span className="text-sm text-muted">{t.image.noPriced}</span>;
  return (
    <span className="text-sm">
      <strong className="text-lg tabular-nums">{money(price.median, currency)}</strong>{" "}
      <span className="text-muted">
        {t.image.median} · {money(price.p25, currency)}–{money(price.p75, currency)} · {fmt(t.image.offers, { n: price.count })}
      </span>
    </span>
  );
}

async function ImageResult({ params }: Pick<PageProps<"/dashboard/image/[id]">, "params">) {
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.image;
  const { id } = await params;
  const search = await db.imageSearch.findFirst({
    where: { id, userId: user.id },
    select: { id: true, publicToken: true, result: true },
  });
  if (!search?.result) notFound();
  const r = JSON.parse(search.result) as ImageSearchResult;
  const market = MARKETS[r.country];

  return (
    <>
      <PageHeader
        title={t.resultsTitle}
        actions={
          <Link href="/dashboard/image" className="btn-secondary">
            {t.newSearch}
          </Link>
        }
      />
      {r.demo && (
        <Notice tone="warning">{t.demo}</Notice>
      )}

      <div className="card mb-6 p-4">
        <div className="flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/img/${search.publicToken}`} alt={r.query} className="h-28 w-28 shrink-0 rounded-lg border border-border object-cover" />
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted">{t.looksLike}</div>
            <div className="text-xl font-semibold break-words">{r.query}</div>
            <div className="mt-1">
              <PriceLine price={r.lens.price} currency={r.currency} t={messages} />
              <span className="ml-1 text-xs text-muted">{fmt(t.inCountry, { country: `${market.flag} ${messages.countries[r.country]}` })}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Link href={analyzeHref({ source: "custom", title: r.query, run: true })} prefetch={false} className="btn-primary">
            {t.analyzeAll}
          </Link>
          <Link href={`/dashboard/research?q=${encodeURIComponent(r.query)}`} className="btn-secondary">
            {t.searchSuppliers}
          </Link>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-1 font-semibold">{t.lensTitle}</h2>
        <p className="mb-3 text-xs text-muted">{fmt(t.lensHint, { country: messages.countries[r.country] })}</p>
        {r.lens.error && <Notice tone="error">Google Lens: {r.lens.error}</Notice>}
        {r.lens.matches.length === 0 && !r.lens.error ? (
          <div className="card p-6 text-center text-sm text-muted">{t.noVisual}</div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {r.lens.matches.slice(0, 16).map((m, i) => (
              <li key={m.url + i}>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="card flex h-full gap-3 p-3 hover:border-accent">
                  <ProductImage src={m.thumbnail} alt={m.title} size={56} />
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm">{m.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {m.source}
                      {m.price !== undefined && m.currency ? ` · ${money(m.price, m.currency)}` : ""}
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-semibold">{t.ebayTitle}</h2>
        <p className="mb-3 text-xs text-muted">{t.ebayHint}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {r.ebay.map((e) => (
            <div key={e.country} className="card p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  {MARKETS[e.country].flag} {messages.countries[e.country]}
                </span>
                <PriceLine price={e.price} currency={e.currency} t={messages} />
              </div>
              {e.error ? (
                <p className="text-xs text-negative">{e.error}</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {e.listings.slice(0, 4).map((l) => (
                    <li key={l.id} className="flex gap-2">
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-accent hover:underline" title={l.title}>
                        {l.title}
                      </a>
                      <span className="tabular-nums">{money(l.price + (l.shipping ?? 0), l.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-1 font-semibold">{t.suppliers}</h2>
        <p className="mb-3 text-xs text-muted">
          {r.suppliers.mode === "image" ? t.suppliersImage : fmt(t.suppliersKeyword, { q: r.query })}
        </p>
        {r.suppliers.note && (
          <Notice>
            {({ cjLevel: t.cjLevel, cjFailed: t.cjFailed, cjPublic: t.cjPublic } as Record<string, string>)[r.suppliers.note] ??
              r.suppliers.note}
          </Notice>
        )}
        {r.suppliers.products.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">{t.noSuppliers}</div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {r.suppliers.products.map((p) => (
              <li key={p.id} className="card flex gap-3 p-3">
                <ProductImage src={p.imageUrl} alt={p.title} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm">{p.title}</div>
                  <div className="mt-1 text-xs text-muted">{fmt(t.cost, { price: usd(p.priceUsd) })}</div>
                  <Link href={analyzeHref({ source: "cj", id: p.id, query: r.query })} className="text-xs font-medium text-accent">
                    {t.analyze}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={deleteImageSearch} className="text-right">
        <input type="hidden" name="id" value={search.id} />
        <button type="submit" className="text-xs text-muted hover:text-negative">
          {t.deleteSearch}
        </button>
      </form>
    </>
  );
}
