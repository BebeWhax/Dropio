import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.signupTitle };
}

export default async function SignupPage() {
  const t = await getMessages();
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t.auth.signupTitle}</h1>
      <p className="mb-6 text-sm text-muted">{t.auth.signupSubtitle}</p>
      <AuthForm mode="signup" />
    </>
  );
}
