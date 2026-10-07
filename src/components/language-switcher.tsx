"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { LOCALE_NAMES, LOCALES } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <label className={`flex items-center gap-2 text-sm ${className}`}>
      <span aria-hidden>🌐</span>
      <span className="sr-only">{t.nav.language}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => setLocale(next));
        }}
        className="w-full cursor-pointer rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
