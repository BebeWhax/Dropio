import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AnalysisView } from "@/components/analysis-view";
import { PageHeader, ProductImage, Skeleton, usd } from "@/components/ui";
import type { AnalysisResult } from "@/lib/analysis";
import { analyzeHref } from "@/lib/analyze-request";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Saved analysis" };

export default function SavedItemPage({ params }: PageProps<"/dashboard/saved/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SavedItem params={params} />
    </Suspense>
  );
}

async function SavedItem({ params }: Pick<PageProps<"/dashboard/saved/[id]">, "params">) {
  const user = await requireUser();
  const { id } = await params;
  const item = await db.savedProduct.findFirst({ where: { id, userId: user.id } });
  if (!item) notFound();

  const result = JSON.parse(item.analysis) as AnalysisResult;
  const input = result.input;
  const rerun = analyzeHref({
    source: input.source,
    id: input.source === "cj" ? input.productId : undefined,
    title: input.source === "custom" ? input.title : undefined,
    cost: input.source === "custom" ? input.supplierCostUsd : undefined,
    shipping: input.shippingUsdOverride,
    weight: input.source === "custom" ? input.weightGrams : undefined,
    variant: input.variantId,
    query: input.query,
    gtin: input.gtin,
    countries: input.countries,
    run: true,
  });

  return (
    <>
      <PageHeader
        title="Saved analysis"
        description={`Snapshot from ${new Date(result.generatedAt).toUTCString()}`}
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/saved" className="btn-secondary">
              ← Watchlist
            </Link>
            <Link href={rerun} prefetch={false} className="btn-primary">
              Refresh with live data
            </Link>
          </div>
        }
      />
      <div className="card mb-6 flex gap-4 p-4">
        <ProductImage src={item.imageUrl} alt={item.title} size={72} />
        <div>
          <h2 className="font-semibold">{item.title}</h2>
          <p className="mt-1 text-sm text-muted">Unit cost {usd(input.supplierCostUsd)}</p>
        </div>
      </div>
      <AnalysisView result={result} />
    </>
  );
}
