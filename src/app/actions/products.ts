"use server";

import { redirect } from "next/navigation";
import { runAnalysis } from "@/lib/analysis";
import { buildAnalysisInput, readAnalyzeParams } from "@/lib/analyze-request";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectivePlan } from "@/lib/plans";

/**
 * Re-runs the analysis (served from the API cache, so no extra quota) and
 * stores a snapshot. Recomputing on the server means we never trust a
 * client-submitted result.
 */
export async function saveAnalysis(formData: FormData): Promise<void> {
  const user = await requireUser();
  const plan = effectivePlan(user);
  const built = await buildAnalysisInput(readAnalyzeParams(formData), user, plan);
  if (!built.ok) redirect("/dashboard/saved?error=invalid");

  const { input } = built;
  const key = { userId: user.id, source: input.source, externalId: input.productId };
  const existing = await db.savedProduct.findUnique({ where: { userId_source_externalId: key } });
  if (!existing && (await db.savedProduct.count({ where: { userId: user.id } })) >= plan.maxSaved) {
    redirect("/dashboard/saved?error=limit");
  }

  const result = await runAnalysis(input);
  const data = {
    title: input.title,
    imageUrl: input.imageUrl ?? null,
    analysis: JSON.stringify(result),
    bestCountry: result.best?.country ?? null,
    bestMarginPct: result.best?.marginPct ?? null,
  };
  await db.savedProduct.upsert({
    where: { userId_source_externalId: key },
    create: { ...key, ...data },
    update: data,
  });
  redirect("/dashboard/saved?saved=1");
}

export async function deleteSaved(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  // Scoped by userId so users can only delete their own items.
  await db.savedProduct.deleteMany({ where: { id, userId: user.id } });
  redirect("/dashboard/saved");
}
