import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { saveAnalysis } from "@/app/actions/products";
import { AnalysisView } from "@/components/analysis-view";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader, ProductImage, Skeleton, usd } from "@/components/ui";
import { fmt } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { runAnalysis, type AnalysisInput } from "@/lib/analysis";
import { analyzeSearchParams, buildAnalysisInput, readAnalyzeParams, type AnalyzeParams } from "@/lib/analyze-request";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { CHANNELS, getChannel } from "@/lib/channels";
import { COUNTRY_CODES, MARKETS } from "@/lib/markets";
import { CATEGORIES } from "@/lib/pricing/duty";
import { SHIPPING_PREFERENCES } from "@/lib/pricing/shipping";
import { effectivePlan, type Plan } from "@/lib/plans";
import { getSupplierProvider } from "@/lib/providers";
import type { SupplierProductDetail } from "@/lib/providers/types";
import { consumeQuota, QuotaExceededError } from "@/lib/usage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).analyze.title };
}

export default async function AnalyzePage({ searchParams }: PageProps<"/dashboard/analyze">) {
  const t = (await getMessages()).analyze;
  return (
    <>
      <PageHeader
        title={t.title}
        actions={
          <Link href="/dashboard/research" className="btn-secondary">
            {t.back}
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
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.analyze;
  const plan = effectivePlan(user);
  const params = readAnalyzeParams(await searchParams);
  const built = await buildAnalysisInput(params, user, plan);

  if (!built.ok) {
    const text = {
      noTitle: t.errNoTitle,
      noProduct: t.errNoProduct,
      notFound: t.errNotFound,
      supplier: fmt(t.errSupplier, { error: built.detail ?? "" }),
    }[built.error];
    return <Notice tone="error">{text}</Notice>;
  }

  return (
    <div className="space-y-6">
      {built.notices.map((n) => (
        <Notice key={n.code} tone="warning">
          {fmt(t.noticeCountries, { ...n.vars, plan: messages.plans[plan.id].name })}
        </Notice>
      ))}
      <ProductSummary input={built.input} product={built.product} t={messages} />
      <AnalyzeForm params={params} input={built.input} product={built.product} plan={plan} t={messages} />
      {params.run && (
        <Suspense fallback={<AnalysisSkeleton countries={built.input.countries.length} t={messages} />}>
          <AnalysisRunner user={user} plan={plan} input={built.input} params={params} quotaRef={built.ref} />
        </Suspense>
      )}
    </div>
  );
}

function ProductSummary({ input, product, t }: { input: AnalysisInput; product: SupplierProductDetail | null; t: Messages }) {
  return (
    <div className="card flex gap-4 p-4">
      <ProductImage src={input.imageUrl} alt={input.title} size={88} />
      <div className="min-w-0">
        <h2 className="font-semibold">{input.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {input.source === "custom" ? t.analyze.yourProduct : getSupplierProvider().name} ·{" "}
          {input.supplierCostUsd === undefined ? t.analyze.noCost : fmt(t.analyze.unitCost, { price: usd(input.supplierCostUsd) })}
          {input.weightGrams ? ` · ${Math.round(input.weightGrams)} g` : ""}
          {product?.category ? ` · ${product.category}` : ""}
        </p>
      </div>
    </div>
  );
}

const pctLabel = (n: number) => `${Math.round(n * 1000) / 10}%`;

function AnalyzeForm({
  params,
  input,
  product,
  plan,
  t: messages,
}: {
  params: AnalyzeParams;
  input: AnalysisInput;
  product: SupplierProductDetail | null;
  plan: Plan;
  t: Messages;
}) {
  const t = messages.analyze;
  // Typical commission range for the selected channel, shown as a hint.
  const ranges =
    input.channel === "auto"
      ? []
      : Object.values(getChannel(input.channel).fees).map((f) => f!.commissionRange ?? [f!.commissionPct, f!.commissionPct]);
  const range = ranges.length
    ? `${pctLabel(Math.min(...ranges.map((r) => r[0])))}–${pctLabel(Math.max(...ranges.map((r) => r[1])))}`
    : "—";

  return (
    <form action="/dashboard/analyze" className="card space-y-4 p-4">
      <input type="hidden" name="source" value={params.source} />
      <input type="hidden" name="run" value="1" />
      {params.id && <input type="hidden" name="id" value={params.id} />}
      {params.source === "custom" && (
        <>
          <input type="hidden" name="title" value={input.title} />
          {input.supplierCostUsd !== undefined && <input type="hidden" name="cost" value={input.supplierCostUsd} />}
          {params.shipping !== undefined && <input type="hidden" name="shipping" value={params.shipping} />}
          {params.weight !== undefined && <input type="hidden" name="weight" value={params.weight} />}
        </>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label" htmlFor="q">
            {t.query}
          </label>
          <input id="q" name="q" defaultValue={input.query} className="input" maxLength={100} />
          <p className="mt-1 text-xs text-muted">{t.queryHint}</p>
        </div>
        <div>
          <label className="label" htmlFor="gtin">
            {t.gtin}
          </label>
          <input id="gtin" name="gtin" defaultValue={input.gtin} inputMode="numeric" className="input" placeholder={t.gtinPh} />
        </div>
      </div>

      {product && product.variants.length > 1 && (
        <div>
          <label className="label" htmlFor="variant">
            {t.variant}
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
            {t.category}
          </label>
          <select id="cat" name="cat" defaultValue={input.category} className="input">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {messages.categories[c.id]}
                {c.hs !== "—" ? ` (HS ${c.hs})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ship">
            {t.shipping}
          </label>
          <select id="ship" name="ship" defaultValue={input.shippingPreference} className="input">
            {SHIPPING_PREFERENCES.map((p) => (
              <option key={p.id} value={p.id}>
                {messages.shippingPrefs[p.id]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="payer">
            {t.payer}
          </label>
          <select id="payer" name="payer" defaultValue={input.importPayer} className="input">
            <option value="seller">{t.payerSeller}</option>
            <option value="buyer">{t.payerBuyer}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label" htmlFor="ch">
            {t.channel}
          </label>
          <select id="ch" name="ch" defaultValue={input.channel} className="input">
            <option value="auto">{t.channelAuto}</option>
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({COUNTRY_CODES.filter((code) => c.fees[code]).map((code) => MARKETS[code].flag).join("")})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="comm">
            {t.commission}
          </label>
          <input
            id="comm"
            name="comm"
            type="number"
            step="any"
            min="0"
            max="60"
            defaultValue={input.commissionPct === undefined ? undefined : Math.round(input.commissionPct * 10000) / 100}
            className="input"
          />
          <p className="mt-1 text-xs text-muted">{fmt(t.commissionHint, { range })}</p>
        </div>
        <div>
          <label className="label" htmlFor="opm">
            {t.ordersPerMonth}
          </label>
          <input id="opm" name="opm" type="number" min="1" defaultValue={input.ordersPerMonth} className="input" />
          <p className="mt-1 text-xs text-muted">{t.ordersHint}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="label" htmlFor="ads">
            {t.adCost}
          </label>
          <input id="ads" name="ads" type="number" step="0.01" min="0" defaultValue={input.adCostUsd || undefined} className="input" placeholder="0" />
        </div>
        <p className="self-end text-xs text-muted md:col-span-3">{t.adHint}</p>
      </div>

      <div>
        <label className="label" htmlFor="qua">
          {t.queryUa}
        </label>
        <input id="qua" name="qua" defaultValue={input.queryByCountry?.UA} className="input" maxLength={100} placeholder="напр. машинка для видалення шерсті" />
        <p className="mt-1 text-xs text-muted">{t.queryUaHint}</p>
      </div>

      <fieldset>
        <legend className="label">{fmt(t.countries, { n: plan.maxCountries, plan: messages.plans[plan.id].name })}</legend>
        <div className="flex flex-wrap gap-2">
          {COUNTRY_CODES.map((code) => (
            <label
              key={code}
              title={messages.countries[code]}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input type="checkbox" name="c" value={code} defaultChecked={input.countries.includes(code)} className="accent-[var(--accent)]" />
              {MARKETS[code].flag} {code}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn-primary">
        {params.run ? t.rerun : t.run}
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
  const messages = await getMessages();
  try {
    await consumeQuota(user.id, plan, "analysis", quotaRef);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return (
        <Notice tone="warning">
          {fmt(messages.common.quotaReached, { kind: messages.common.quotaKinds[err.kind], limit: err.limit })}{" "}
          <Link href="/dashboard/billing" className="font-medium underline">
            {messages.common.upgrade}
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
        <h2 className="text-lg font-semibold">{messages.analyze.results}</h2>
        <form action={saveAnalysis}>
          {[...saveParams.entries()].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <SubmitButton className="btn-secondary" pendingText={messages.common.saving}>
            {messages.analyze.save}
          </SubmitButton>
        </form>
      </div>
      <AnalysisView result={result} />
    </section>
  );
}

function AnalysisSkeleton({ countries, t }: { countries: number; t: Messages }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{fmt(t.analyze.checking, { n: countries })}</p>
      <Skeleton className="h-20" />
      <Skeleton className="h-64" />
    </div>
  );
}
