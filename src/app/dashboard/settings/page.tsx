import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { resetCostSettings, saveCostSettings } from "@/app/actions/settings";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader, Skeleton } from "@/components/ui";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { COUNTRY_CODES, MARKETS, parseCostSettings, resolveAssumptions } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).settings.title };
}

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const t = (await getMessages()).settings;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SettingsForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const round = (n: number) => Math.round(n * 10000) / 10000;

async function SettingsForm({ searchParams }: Pick<PageProps<"/dashboard/settings">, "searchParams">) {
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);
  const t = messages.settings;
  const editable = effectivePlan(user).id !== "free";
  const settings = parseCostSettings(user.costSettings);
  const { saved } = await searchParams;

  return (
    <>
      {saved && <Notice tone="success">{t.saved}</Notice>}
      {!editable && (
        <Notice tone="info">
          {t.paidOnly}{" "}
          <Link href="/dashboard/billing" className="font-medium text-accent">
            {messages.common.upgrade}
          </Link>
        </Notice>
      )}
      <p className="mb-3 text-xs text-muted">{t.uaNote}</p>
      <form action={saveCostSettings} className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t.country}</th>
              <th className="px-4 py-3 font-medium">{t.vat}</th>
              <th className="px-4 py-3 font-medium">{t.fee}</th>
              <th className="px-4 py-3 font-medium">{t.feeFixed}</th>
              <th className="px-4 py-3 font-medium">{t.turnover}</th>
              <th className="px-4 py-3 font-medium">{t.dutyOverride}</th>
              <th className="px-4 py-3 font-medium">{t.handling}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {COUNTRY_CODES.map((code) => {
              const market = MARKETS[code];
              const name = messages.countries[code];
              const a = resolveAssumptions(code, settings);
              const field = (key: string, label: string, value: number | undefined, placeholder?: string) => (
                <input
                  name={`${code}.${key}`}
                  aria-label={`${name} — ${label}`}
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
                    {market.flag} {name}
                  </td>
                  <td className="px-4 py-2">{field("vatRate", t.vat, a.vatRate * 100)}</td>
                  <td className="px-4 py-2">{field("feeRate", t.fee, a.feeRate * 100)}</td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1">
                      {field("fixedFee", t.feeFixed, a.fixedFee)}
                      <span className="text-xs text-muted">{market.currency}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2">{field("turnoverTaxRate", t.turnover, a.turnoverTaxRate * 100)}</td>
                  <td className="px-4 py-2">
                    {field("dutyRateOverride", t.dutyOverride, a.dutyRateOverride === undefined ? undefined : a.dutyRateOverride * 100, t.rules)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1">
                      {field("handlingFee", t.handling, a.handlingFee)}
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
            <SubmitButton pendingText={messages.common.saving}>{t.save}</SubmitButton>
          </div>
        )}
      </form>
      {editable && (
        <form action={resetCostSettings} className="mt-3 text-right">
          <button type="submit" className="text-sm text-muted hover:text-foreground">
            {t.reset}
          </button>
        </form>
      )}
    </>
  );
}
