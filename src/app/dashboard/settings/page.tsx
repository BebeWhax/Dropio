import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { resetCostSettings, saveCostSettings } from "@/app/actions/settings";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { COUNTRY_CODES, MARKETS, parseCostSettings, resolveAssumptions } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";

export const metadata: Metadata = { title: "Cost settings" };

export default function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  return (
    <>
      <PageHeader
        title="Cost settings"
        description="Tax and fee assumptions per country. Import duty follows each country's rules and your product category; set a duty override only if you know your exact HS rate."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SettingsForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const round = (n: number) => Math.round(n * 10000) / 10000;

async function SettingsForm({ searchParams }: Pick<PageProps<"/dashboard/settings">, "searchParams">) {
  const user = await requireUser();
  const editable = effectivePlan(user).id !== "free";
  const settings = parseCostSettings(user.costSettings);
  const { saved } = await searchParams;

  return (
    <>
      {saved && <Notice tone="success">Settings saved. New analyses will use them.</Notice>}
      {!editable && (
        <Notice tone="info">
          Custom cost assumptions are available on paid plans.{" "}
          <Link href="/dashboard/billing" className="font-medium text-accent">
            Upgrade
          </Link>
        </Notice>
      )}
      <p className="mb-3 text-xs text-muted">
        🇺🇦 Ukraine defaults assume a FOP group 3 seller (5% single tax, not a VAT payer). Set VAT to 20% if you are a PDV
        payer. Leave “Duty override” empty to use the rules (e.g. Ukraine&apos;s €150 allowance, EU €3 flat duty).
      </p>
      <form action={saveCostSettings} className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">VAT in price %</th>
              <th className="px-4 py-3 font-medium">Marketplace fee %</th>
              <th className="px-4 py-3 font-medium">Fee / order</th>
              <th className="px-4 py-3 font-medium">Turnover tax %</th>
              <th className="px-4 py-3 font-medium">Duty override %</th>
              <th className="px-4 py-3 font-medium">Extra handling / parcel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {COUNTRY_CODES.map((code) => {
              const market = MARKETS[code];
              const a = resolveAssumptions(code, settings);
              const field = (key: string, label: string, value: number | undefined, placeholder?: string) => (
                <input
                  name={`${code}.${key}`}
                  aria-label={`${market.name} ${label}`}
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={value === undefined ? undefined : round(value)}
                  placeholder={placeholder}
                  disabled={!editable}
                  className="input w-24"
                />
              );
              return (
                <tr key={code}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {market.flag} {market.name}
                  </td>
                  <td className="px-4 py-2">{field("vatRate", "VAT in price %", a.vatRate * 100)}</td>
                  <td className="px-4 py-2">{field("feeRate", "marketplace fee %", a.feeRate * 100)}</td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1">
                      {field("fixedFee", "fee per order", a.fixedFee)}
                      <span className="text-xs text-muted">{market.currency}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2">{field("turnoverTaxRate", "turnover tax %", a.turnoverTaxRate * 100)}</td>
                  <td className="px-4 py-2">
                    {field("dutyRateOverride", "duty override %", a.dutyRateOverride === undefined ? undefined : a.dutyRateOverride * 100, "rules")}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1">
                      {field("handlingFee", "extra handling per parcel", a.handlingFee)}
                      <span className="text-xs text-muted">{market.currency}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {editable && (
          <div className="flex justify-end gap-2 border-t border-border p-4">
            <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
          </div>
        )}
      </form>
      {editable && (
        <form action={resetCostSettings} className="mt-3 text-right">
          <button type="submit" className="text-sm text-muted hover:text-foreground">
            Reset to defaults
          </button>
        </form>
      )}
    </>
  );
}
