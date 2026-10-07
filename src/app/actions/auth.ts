"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";

export interface AuthFormState {
  error?: string;
  email?: string;
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("invalidEmail"),
  password: z.string().min(8, "passwordShort").max(200, "passwordShort"),
});

/** Only allow redirects to local dashboard paths after login. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/dashboard") ? next : "/dashboard";
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const t = (await getMessages()).auth;
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message === "invalidEmail" ? t.errInvalidEmail : t.errPasswordShort, email };
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: t.errExists, email };

  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || null;
  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      name,
      passwordHash: await hashPassword(parsed.data.password),
      // Keep the language the visitor signed up in.
      locale: await getLocale(),
    },
  });
  await createSession(user.id);
  redirect("/dashboard");
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  const invalid = { error: (await getMessages()).auth.errCredentials, email };
  if (!parsed.success) return invalid;

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;

  await createSession(user.id);
  // Restore the language saved on the account (e.g. chosen on another device).
  if (isLocale(user.locale)) {
    (await cookies()).set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
  }
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
