import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { Notice, PageHeader, ProductImage, Skeleton, usd } from "@/components/ui";
import { fmt } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { analyzeHref } from "@/lib/analyze-request";
import { requireUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import { getSupplierProvider } from "@/lib/providers";
import { consumeQuota, QuotaExceededError } from "@/lib/usage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).research.title };
}

type Props = Pick<PageProps<"/dashboard/research">, "searchParams">;

export default async function ResearchPage({ searchParams }: PageProps<"/dashboard/research">) {
  const t = await getMessages();
  return (
    <>
      <PageHeader title={t.research.title} description={t.research.description} />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <SearchForm searchParams={searchParams} t={t} />
          <Suspense fallback={<ResultsSkeleton />}>
            <Results searchParams={searchParams} />
          </Suspense>
        </div>
        <CustomProductForm t={t} />
      </div>
    </>
  );
}

async function readQuery(searchParams: Props["searchParams"]) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.min(50, Math.max(1, Number(sp.page) || 1));
  return { q, page };
}

async function SearchForm({ searchParams, t }: Props & { t: Messages }) {
  const { q } = await readQuery(searchParams);
  return (
    <form className="flex gap-2" action="/dashboard/research">
      <input name="q" defaultValue={q} placeholder={t.research.placeholder} className="input" required />
      <button type="submit" className="btn-primary">
        {t.research.search}
      </button>
    </form>
  );
}

async function Results({ searchParams }: Props) {
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.research;
  const { q, page } = await readQuery(searchParams);
  const supplier = getSupplierProvider();

  if (!q) {
    return (
      <div className="mt-6">
        <DemoBanner suppliers={supplier.isDemo} markets={false} />
        <div className="card p-10 text-center text-sm text-muted">{fmt(t.empty, { supplier: supplier.name })}</div>
      </div>
    );
  }

  try {
    await consumeQuota(user.id, effectivePlan(user), "search", `${q.toLowerCase()}:${page}`);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return (
        <div className="mt-6">
          <Notice tone="warning">
            {fmt(messages.common.quotaReached, { kind: messages.common.quotaKinds[err.kind], limit: err.limit })}{" "}
            <Link href="/dashboard/billing" className="font-medium underline">
              {messages.common.seePlans}
            </Link>
          </Notice>
        </div>
      );
    }
    throw err;
  }

  let results;
  try {
    results = await supplier.search(q, page);
  } catch (err) {
    return (
      <div className="mt-6">
        <Notice tone="error">{fmt(t.failed, { error: err instanceof Error ? err.message : "?" })}</Notice>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <DemoBanner suppliers={supplier.isDemo} markets={false} />
      <p className="mb-3 text-sm text-muted">{fmt(t.results, { count: results.total.toLocaleString("en-US"), q })}</p>
      {results.items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">{t.noResults}</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          {results.items.map((p) => (
            <li key={p.id} className="card flex gap-3 p-3">
              <ProductImage src={p.imageUrl} alt={p.title} size={72} />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="line-clamp-2 text-sm font-medium" title={p.title}>
                  {p.title}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {fmt(t.cost, { price: usd(p.priceUsd) })}
                  {p.priceMaxUsd ? ` – ${usd(p.priceMaxUsd)}` : ""}
                  {p.category ? ` · ${p.category}` : ""}
                </p>
                <div className="mt-auto pt-2">
                  <Link href={analyzeHref({ source: "cj", id: p.id })} className="text-sm font-medium text-accent">
                    {t.analyze}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? (
          <Link href={`/dashboard/research?q=${encodeURIComponent(q)}&page=${page - 1}`} className="btn-secondary">
            {t.prev}
          </Link>
        ) : (
          <span />
        )}
        {results.items.length > 0 && page * results.items.length < results.total && (
          <Link href={`/dashboard/research?q=${encodeURIComponent(q)}&page=${page + 1}`} className="btn-secondary">
            {t.next}
          </Link>
        )}
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

function CustomProductForm({ t: messages }: { t: Messages }) {
  const t = messages.research;
  return (
    <aside className="card h-fit p-4">
      <h2 className="font-semibold">{t.customTitle}</h2>
      <p className="mt-1 mb-4 text-xs text-muted">
        {t.customHint} {t.manyProducts}{" "}
        <Link href="/dashboard/bulk" className="text-accent">
          {t.uploadCsv}
        </Link>
        .
      </p>
      <form action="/dashboard/analyze" className="space-y-3">
        <input type="hidden" name="source" value="custom" />
        <input type="hidden" name="run" value="1" />
        <div>
          <label className="label" htmlFor="custom-title">
            {t.productTitle}
          </label>
          <input id="custom-title" name="title" required maxLength={200} className="input" placeholder={t.productTitlePh} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="custom-cost">
              {t.unitCost}
            </label>
            <input id="custom-cost" name="cost" type="number" step="0.01" min="0" className="input" placeholder={t.optional} />
          </div>
          <div>
            <label className="label" htmlFor="custom-shipping">
              {t.shipping}
            </label>
            <input id="custom-shipping" name="shipping" type="number" step="0.01" min="0" className="input" placeholder={t.auto} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="custom-weight">
              {t.weight}
            </label>
            <input id="custom-weight" name="weight" type="number" min="0" className="input" placeholder="250" />
          </div>
          <div>
            <label className="label" htmlFor="custom-gtin">
              {t.gtin}
            </label>
            <input id="custom-gtin" name="gtin" inputMode="numeric" className="input" placeholder={t.optional} />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          {t.analyzeBtn}
        </button>
      </form>
    </aside>
  );
}
