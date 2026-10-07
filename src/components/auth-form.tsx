"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthFormState } from "@/app/actions/auth";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? login : signup,
    {},
  );
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
            Name (optional)
          </label>
          <input id="name" name="name" autoComplete="name" className="input" />
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state.email} className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
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
        {isSignup && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Please wait…" : isSignup ? "Create account" : "Log in"}
      </button>
      <p className="text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "New to Dropio? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-accent">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
