export const LOCALES = ["en", "uk"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "dropio_locale";

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", uk: "Українська" };
/** BCP 47 tags for Intl formatting and <html lang>. */
export const LOCALE_TAGS: Record<Locale, string> = { en: "en-US", uk: "uk-UA" };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "uk";
}

/** Fills {placeholders} in a message: fmt("Hi {name}", { name: "Ann" }). */
export function fmt(message: string, vars: Record<string, string | number> = {}): string {
  return message.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`));
}
