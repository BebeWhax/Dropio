import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Log in</h1>
      {/* searchParams is request data, so it renders behind a boundary. */}
      <Suspense fallback={<AuthForm mode="login" />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={typeof next === "string" ? next : undefined} />;
}
