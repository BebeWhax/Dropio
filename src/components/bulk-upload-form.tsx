"use client";

import { useActionState } from "react";
import { uploadBulkCsv, type BulkUploadState } from "@/app/actions/bulk";
import { COUNTRY_CODES, MARKETS, type CountryCode } from "@/lib/markets";
import { CATEGORIES } from "@/lib/pricing/duty";
import { SHIPPING_PREFERENCES } from "@/lib/pricing/shipping";
import { fmt } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

export function BulkUploadForm({ defaultCountries, maxCountries }: { defaultCountries: CountryCode[]; maxCountries: number }) {
  const [state, action, pending] = useActionState<BulkUploadState, FormData>(uploadBulkCsv, {});
  const { t: messages } = useI18n();
  const t = messages.bulk;

  return (
    <form action={action} className="card space-y-4 p-4">
      {state.error && (
        <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      )}
      <div>
        <label className="label" htmlFor="file">
          {t.file}
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv,.txt"
          required
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-accent"
        />
        <p className="mt-1 text-xs text-muted">
          {t.fileHint}{" "}
          <a href="/api/bulk/template" className="text-accent">
            {t.template}
          </a>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="bulk-cat">
            {t.category}
          </label>
          <select id="bulk-cat" name="cat" defaultValue="other" className="input">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {messages.categories[c.id]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bulk-ship">
            {t.shipping}
          </label>
          <select id="bulk-ship" name="ship" defaultValue="balanced" className="input">
            {SHIPPING_PREFERENCES.map((p) => (
              <option key={p.id} value={p.id}>
                {messages.shippingPrefs[p.id]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bulk-payer">
            {t.payer}
          </label>
          <select id="bulk-payer" name="payer" defaultValue="seller" className="input">
            <option value="seller">{t.payerSeller}</option>
            <option value="buyer">{t.payerBuyer}</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">{fmt(t.countries, { n: maxCountries })}</legend>
        <div className="flex flex-wrap gap-2">
          {COUNTRY_CODES.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input type="checkbox" name="c" value={code} defaultChecked={defaultCountries.includes(code)} className="accent-[var(--accent)]" />
              {MARKETS[code].flag} {code}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t.uploading : t.upload}
      </button>
    </form>
  );
}
