import type { ReactNode } from "react";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { PLANS, type Plan } from "@/lib/plans";

/** Pricing grid shared by the landing page and the billing page; `action` renders each card's button. */
export async function PlanCards({ action, currency = "USD" }: { action: (plan: Plan) => ReactNode; currency?: "USD" | "UAH" | "both" }) {
  const t = await getMessages();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Object.values(PLANS).map((plan) => {
        const copy = t.plans[plan.id];
        return (
          <div key={plan.id} className={`card flex flex-col p-6 ${plan.id === "starter" ? "ring-2 ring-accent" : ""}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{copy.name}</h3>
              {plan.id === "starter" && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{t.plans.popular}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">{copy.tagline}</p>
            <div className="mt-4 flex flex-wrap items-baseline gap-1">
              <span className="text-3xl font-semibold">{currency === "UAH" ? `₴${plan.priceUah}` : `$${plan.priceUsd}`}</span>
              <span className="text-sm text-muted">{t.common.perMonth}</span>
              {currency === "both" && plan.priceUah > 0 && (
                <span className="ml-2 text-sm text-muted">
                  {t.common.or} ₴{plan.priceUah}
                </span>
              )}
            </div>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              <li>{fmt(t.plans.analysesPerDay, { n: plan.analysesPerDay })}</li>
              <li>{fmt(t.plans.searchesPerDay, { n: plan.searchesPerDay })}</li>
              <li>{fmt(t.plans.imagesPerDay, { n: plan.imageSearchesPerDay })}</li>
              <li>{fmt(t.plans.countriesPerAnalysis, { n: plan.maxCountries })}</li>
              {copy.features.map((f) => (
                <li key={f} className="text-muted">
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">{action(plan)}</div>
          </div>
        );
      })}
    </div>
  );
}
