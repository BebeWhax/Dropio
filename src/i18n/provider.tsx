"use client";

import { createContext, use, type ReactNode } from "react";
import type { Locale } from "./config";
import type { Messages } from "./messages";

const I18nContext = createContext<{ locale: Locale; t: Messages } | null>(null);

/** Makes the current language's messages available to client components. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  return <I18nContext value={{ locale, t: messages }}>{children}</I18nContext>;
}

export function useI18n() {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
