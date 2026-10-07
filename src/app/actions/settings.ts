"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { COUNTRY_CODES, MARKETS, type CostAssumptions, type CostSettings } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";

// Form fields are entered as percentages for rates and as currency amounts for fixed fees.
const FIELDS: { key: keyof CostAssumptions; percent: boolean; max: number }[] = [
  { key: "vatRate", percent: true, max: 30 },
  { key: "feeRate", percent: true, max: 100 },
  { key: "fixedFee", percent: false, max: 100000 },
  { key: "turnoverTaxRate", percent: true, max: 50 },
  { key: "dutyRateOverride", percent: true, max: 200 },
  { key: "handlingFee", percent: false, max: 100000 },
];

export async function saveCostSettings(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (effectivePlan(user).id === "free") redirect("/dashboard/billing");

  const settings: CostSettings = {};
  for (const country of COUNTRY_CODES) {
    for (const { key, percent, max } of FIELDS) {
      const raw = String(formData.get(`${country}.${key}`) ?? "").replace(",", ".").trim();
      if (raw === "") continue;
      const input = Number(raw);
      if (!Number.isFinite(input) || input < 0 || input > max) continue;
      const value = percent ? input / 100 : input;
      // Only store overrides, so future default updates still reach this user.
      const fallback = MARKETS[country].defaults[key];
      if (fallback !== undefined && Math.abs(value - fallback) < 1e-9) continue;
      settings[country] = { ...settings[country], [key]: value };
    }
  }

  await db.user.update({ where: { id: user.id }, data: { costSettings: JSON.stringify(settings) } });
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=1");
}

export async function resetCostSettings(): Promise<void> {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { costSettings: null } });
  redirect("/dashboard/settings?saved=1");
}
