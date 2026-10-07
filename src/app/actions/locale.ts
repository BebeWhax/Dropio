"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

/** Switches the interface language and remembers it on the account. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user && user.locale !== locale) await db.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/", "layout");
}
