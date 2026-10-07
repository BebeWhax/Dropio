import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.loginTitle };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [t, { next }] = await Promise.all([getMessages(), searchParams]);
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">{t.auth.loginTitle}</h1>
      <AuthForm mode="login" next={typeof next === "string" ? next : undefined} />
    </>
  );
}
