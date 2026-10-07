import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { messages, type Messages } from "./messages";

/** The visitor's language: their saved choice, else the browser's preference. Deduplicated per request. */
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accept = (await headers()).get("accept-language") ?? "";
  // Ukrainian browsers (and Russian-language ones in Ukraine) get Ukrainian.
  return /^(uk|ru)\b|,\s*(uk|ru)\b/i.test(accept) ? "uk" : DEFAULT_LOCALE;
});

export async function getMessages(): Promise<Messages> {
  return messages[await getLocale()];
}
