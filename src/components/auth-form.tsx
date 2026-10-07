"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthFormState } from "@/app/actions/auth";
import { useI18n } from "@/i18n/provider";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const { t } = useI18n();
  const a = t.auth;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(mode === "login" ? login : signup, {});
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      )}
      {next && <input type="hidden" name="next" value={next} />}
      {isSignup && (
        <div>
          <label htmlFor="name" className="label">
            {a.name}
          </label>
          <input id="name" name="name" autoComplete="name" className="input" />
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">
          {a.email}
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state.email} className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          {a.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignup ? "new-password" : "current-password"}
          className="input"
        />
        {isSignup && <p className="mt-1 text-xs text-muted">{a.passwordHint}</p>}
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? a.wait : isSignup ? a.createAccount : a.login}
      </button>
      <p className="text-center text-sm text-muted">
        {isSignup ? a.haveAccount : a.newHere}
        <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-accent">
          {isSignup ? a.goLogin : a.goSignup}
        </Link>
      </p>
    </form>
  );
}
