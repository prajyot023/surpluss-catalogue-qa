"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ errorMessage }: { errorMessage?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const message = state.error ?? errorMessage;

  return (
    <form
      action={formAction}
      className="mt-7 space-y-4 rounded-2xl border border-[#e1e5ea] bg-white p-6 shadow-[0_16px_50px_rgba(11,31,58,.06)]"
    >
      {message && (
        <div
          role="alert"
          aria-live="polite"
          data-testid="login-error"
          className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-[#0b1f3a]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-11 w-full rounded-xl border border-[#e1e5ea] px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/30"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-[#0b1f3a]">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-xl border border-[#e1e5ea] px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/30"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-bold text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand/30 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
