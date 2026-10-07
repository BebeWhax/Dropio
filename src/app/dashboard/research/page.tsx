import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { Notice, PageHeader, ProductImage, Skeleton, usd } from "@/components/ui";
import { analyzeHref } from "@/lib/analyze-request";
import { requireUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import { getSupplierProvider } from "@/lib/providers";
import { consumeQuota, QuotaExceededError } from "@/lib/usage";

export const metadata: Metadata = { title: "Product research" };

export default function ResearchPage({ searchParams }: PageProps<"/dashboard/research">) {
  return (
    <>
      <PageHeader title="Product research" description="Search supplier products, then analyze margins across countries." />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <Suspense fallback={<Skeleton className="h-11" />}>
            <SearchForm searchParams={searchParams} />
          </Suspense>
          <Suspense fallback={<ResultsSkeleton />}>
            <Results searchParams={searchParams} />
          </Suspense>
        </div>
        <CustomProductForm />
      </div>
    </>
  );
}

type Props = Pick<PageProps<"/dashboard/research">, "searchParams">;

async function readQuery(searchParams: Props["searchParams"]) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.min(50, Math.max(1, Number(sp.page) || 1));
  return { q, page };
}

async function SearchForm({ searchParams }: Props) {
  const { q } = await readQuery(searchParams);
  return (
    <form className="flex gap-2" action="/dashboard/research">
      <input name="q" defaultValue={q} placeholder="e.g. pet hair remover, led strip, phone holder" className="input" required />
      <button type="submit" className="btn-primary">
        Search
      </button>
    </form>
  );
}

async function Results({ searchParams }: Props) {
  const user = await requireUser();
  const { q, page } = await readQuery(searchParams);
  const supplier = getSupplierProvider();

  if (!q) {
    return (
      <div className="mt-6">
        <DemoBanner suppliers={supplier.isDemo} markets={false} />
        <div className="card p-10 text-center text-sm text-muted">
          Search {supplier.name}&apos;s catalog by keyword. Each result can be analyzed against marketplace prices.
        </div>
      </div>
    );
  }

  try {
    await consumeQuota(user.id, effectivePlan(user), "search", `${q.toLowerCase()}:${page}`);
  } catch (err) {
    if (err instanceof QuotaExceededError) return <QuotaNotice message={err.message} />;
    throw err;
  }

  let results;
  try {
    results = await supplier.search(q, page);
  } catch (err) {
    return (
      <div className="mt-6">
        <Notice tone="error">Supplier search failed: {err instanceof Error ? err.message : "unknown error"}</Notice>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <DemoBanner suppliers={supplier.isDemo} markets={false} />
      <p className="mb-3 text-sm text-muted">
        {results.total.toLocaleString("en-US")} results for “{q}”
      </p>
      {results.items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No products found. Try a broader keyword.</div>
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
                  Cost {usd(p.priceUsd)}
                  {p.priceMaxUsd ? ` – ${usd(p.priceMaxUsd)}` : ""}
                  {p.category ? ` · ${p.category}` : ""}
                </p>
                <div className="mt-auto pt-2">
                  <Link href={analyzeHref({ source: "cj", id: p.id })} className="text-sm font-medium text-accent">
                    Analyze margins →
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
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {results.items.length > 0 && page * results.items.length < results.total && (
          <Link href={`/dashboard/research?q=${encodeURIComponent(q)}&page=${page + 1}`} className="btn-secondary">
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}

function QuotaNotice({ message }: { message: string }) {
  return (
    <div className="mt-6">
      <Notice tone="warning">
        {message}{" "}
        <Link href="/dashboard/billing" className="font-medium underline">
          See plans
        </Link>
      </Notice>
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

function CustomProductForm() {
  return (
    <aside className="card h-fit p-4">
      <h2 className="font-semibold">Analyze your own product</h2>
      <p className="mt-1 mb-4 text-xs text-muted">
        Found something on AliExpress or another supplier? Enter its cost and we&apos;ll compare it against the market.
      </p>
      <form action="/dashboard/analyze" className="space-y-3">
        <input type="hidden" name="source" value="custom" />
        <input type="hidden" name="run" value="1" />
        <div>
          <label className="label" htmlFor="custom-title">
            Product title
          </label>
          <input id="custom-title" name="title" required maxLength={200} className="input" placeholder="Magnetic phone car mount" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="custom-cost">
              Unit cost (USD)
            </label>
            <input id="custom-cost" name="cost" type="number" step="0.01" min="0" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="custom-shipping">
              Shipping (USD)
            </label>
            <input id="custom-shipping" name="shipping" type="number" step="0.01" min="0" className="input" placeholder="auto" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="custom-weight">
              Weight (g)
            </label>
            <input id="custom-weight" name="weight" type="number" min="0" className="input" placeholder="250" />
          </div>
          <div>
            <label className="label" htmlFor="custom-gtin">
              EAN/UPC
            </label>
            <input id="custom-gtin" name="gtin" inputMode="numeric" className="input" placeholder="optional" />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          Analyze
        </button>
      </form>
    </aside>
  );
}
