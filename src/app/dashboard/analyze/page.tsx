import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { saveAnalysis } from "@/app/actions/products";
import { AnalysisView } from "@/components/analysis-view";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader, ProductImage, Skeleton, usd } from "@/components/ui";
import { runAnalysis, type AnalysisInput } from "@/lib/analysis";
import { analyzeSearchParams, buildAnalysisInput, readAnalyzeParams, type AnalyzeParams } from "@/lib/analyze-request";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { COUNTRY_CODES, MARKETS } from "@/lib/markets";
import { CATEGORIES } from "@/lib/pricing/duty";
import { SHIPPING_PREFERENCES } from "@/lib/pricing/shipping";
import { effectivePlan, type Plan } from "@/lib/plans";
import { getSupplierProvider } from "@/lib/providers";
import type { SupplierProductDetail } from "@/lib/providers/types";
import { consumeQuota, QuotaExceededError } from "@/lib/usage";

export const metadata: Metadata = { title: "Analyze product" };

export default function AnalyzePage({ searchParams }: PageProps<"/dashboard/analyze">) {
  return (
    <>
      <PageHeader
        title="Margin analysis"
        actions={
          <Link href="/dashboard/research" className="btn-secondary">
            ← Back to research
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-48" />}>
        <AnalyzeContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AnalyzeContent({ searchParams }: Pick<PageProps<"/dashboard/analyze">, "searchParams">) {
  const user = await requireUser();
  const plan = effectivePlan(user);
  const params = readAnalyzeParams(await searchParams);
  const built = await buildAnalysisInput(params, user, plan);

  if (!built.ok) return <Notice tone="error">{built.error}</Notice>;

  return (
    <div className="space-y-6">
      {built.notices.map((n) => (
        <Notice key={n} tone="warning">
          {n}
        </Notice>
      ))}
      <ProductSummary input={built.input} product={built.product} />
      <AnalyzeForm params={params} input={built.input} product={built.product} plan={plan} />
      {params.run && (
        <Suspense fallback={<AnalysisSkeleton countries={built.input.countries.length} />}>
          <AnalysisRunner user={user} plan={plan} input={built.input} params={params} quotaRef={built.ref} />
        </Suspense>
      )}
    </div>
  );
}

function ProductSummary({ input, product }: { input: AnalysisInput; product: SupplierProductDetail | null }) {
  return (
    <div className="card flex gap-4 p-4">
      <ProductImage src={input.imageUrl} alt={input.title} size={88} />
      <div className="min-w-0">
        <h2 className="font-semibold">{input.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {input.source === "custom" ? "Your product" : getSupplierProvider().name} · Unit cost {usd(input.supplierCostUsd)}
          {input.weightGrams ? ` · ${Math.round(input.weightGrams)} g` : ""}
          {product?.category ? ` · ${product.category}` : ""}
        </p>
      </div>
    </div>
  );
}

function AnalyzeForm({
  params,
  input,
  product,
  plan,
}: {
  params: AnalyzeParams;
  input: AnalysisInput;
  product: SupplierProductDetail | null;
  plan: Plan;
}) {
  return (
    <form action="/dashboard/analyze" className="card space-y-4 p-4">
      <input type="hidden" name="source" value={params.source} />
      <input type="hidden" name="run" value="1" />
      {params.id && <input type="hidden" name="id" value={params.id} />}
      {params.source === "custom" && (
        <>
          <input type="hidden" name="title" value={input.title} />
          <input type="hidden" name="cost" value={input.supplierCostUsd} />
          {params.shipping !== undefined && <input type="hidden" name="shipping" value={params.shipping} />}
          {params.weight !== undefined && <input type="hidden" name="weight" value={params.weight} />}
        </>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label" htmlFor="q">
            Marketplace search query
          </label>
          <input id="q" name="q" defaultValue={input.query} className="input" maxLength={100} />
          <p className="mt-1 text-xs text-muted">Short, specific keywords match best. Edit if results look off.</p>
        </div>
        <div>
          <label className="label" htmlFor="gtin">
            EAN/UPC (optional)
          </label>
          <input id="gtin" name="gtin" defaultValue={input.gtin} inputMode="numeric" className="input" placeholder="Exact barcode match" />
        </div>
      </div>

      {product && product.variants.length > 1 && (
        <div>
          <label className="label" htmlFor="variant">
            Variant
          </label>
          <select id="variant" name="variant" defaultValue={input.variantId} className="input">
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {usd(v.priceUsd)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="cat">
            Product category (for duty rates)
          </label>
          <select id="cat" name="cat" defaultValue={input.category} className="input">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.hs !== "—" ? ` (HS ${c.hs})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ship">
            Shipping method
          </label>
          <select id="ship" name="ship" defaultValue={input.shippingPreference} className="input">
            {SHIPPING_PREFERENCES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="payer">
            Import duty &amp; VAT paid by
          </label>
          <select id="payer" name="payer" defaultValue={input.importPayer} className="input">
            <option value="seller">Me — delivered duty paid (DDP)</option>
            <option value="buyer">The buyer on delivery (DDU)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="qua">
          🇺🇦 Ukrainian search query (optional)
        </label>
        <input
          id="qua"
          name="qua"
          defaultValue={input.queryByCountry?.UA}
          className="input"
          maxLength={100}
          placeholder="напр. машинка для видалення шерсті"
        />
        <p className="mt-1 text-xs text-muted">Ukrainian shops list in Ukrainian; a local query finds far more matches.</p>
      </div>

      <fieldset>
        <legend className="label">
          Countries (up to {plan.maxCountries} on {plan.name})
        </legend>
        <div className="flex flex-wrap gap-2">
          {COUNTRY_CODES.map((code) => (
            <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="checkbox" name="c" value={code} defaultChecked={input.countries.includes(code)} className="accent-[var(--accent)]" />
              {MARKETS[code].flag} {code}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn-primary">
        {params.run ? "Re-run analysis" : "Run analysis"}
      </button>
    </form>
  );
}

async function AnalysisRunner({
  user,
  plan,
  input,
  params,
  quotaRef,
}: {
  user: CurrentUser;
  plan: Plan;
  input: AnalysisInput;
  params: AnalyzeParams;
  quotaRef: string;
}) {
  try {
    await consumeQuota(user.id, plan, "analysis", quotaRef);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return (
        <Notice tone="warning">
          {err.message}{" "}
          <Link href="/dashboard/billing" className="font-medium underline">
            Upgrade
          </Link>
        </Notice>
      );
    }
    throw err;
  }

  const result = await runAnalysis(input);
  // Saving re-submits the same parameters; the server recomputes from cache.
  const saveParams = analyzeSearchParams({ ...params, query: input.query, variant: input.variantId, countries: input.countries });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Results</h2>
        <form action={saveAnalysis}>
          {[...saveParams.entries()].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <SubmitButton className="btn-secondary" pendingText="Saving…">
            Save to watchlist
          </SubmitButton>
        </form>
      </div>
      <AnalysisView result={result} />
    </section>
  );
}

function AnalysisSkeleton({ countries }: { countries: number }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Checking {countries} marketplaces and shipping quotes… this can take a few seconds.</p>
      <Skeleton className="h-20" />
      <Skeleton className="h-64" />
    </div>
  );
}
