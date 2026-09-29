"use client";

import { useId, useState } from "react";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconLoader2,
  IconMailCheck,
} from "@tabler/icons-react";
import { trackEvent } from "@/lib/analytics";
import { getApiErrorMessage } from "@/lib/api/client";
import { subscribeToNewsletter } from "@/lib/api/newsletter";
import {
  NEWSLETTER_EMAIL_MAX_LENGTH,
  newsletterEmailSchema,
  type NewsletterSource,
} from "@/lib/schemas/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FormState =
  | { kind: "idle" }
  | { kind: "invalid"; message: string }
  | { kind: "submitting" }
  | { kind: "subscribed" }
  | { kind: "already-subscribed" }
  | { kind: "failed"; message: string };

export function NewsletterForm({
  source,
  tone = "light",
  layout = "inline",
  buttonLabel = "Subscribe",
  className,
}: {
  source: NewsletterSource;
  tone?: "light" | "dark";
  layout?: "inline" | "stacked";
  buttonLabel?: string;
  className?: string;
}) {
  const fieldId = useId();
  const [email, setEmail] = useState("");
  // Bots fill every field they find; people never see this one.
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const dark = tone === "dark";
  const submitting = state.kind === "submitting";
  const done = state.kind === "subscribed" || state.kind === "already-subscribed";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const parsed = newsletterEmailSchema.safeParse(email);
    if (!parsed.success) {
      setState({
        kind: "invalid",
        message: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const status = await subscribeToNewsletter({
        email: parsed.data,
        source,
        company: honeypot,
      });
      setState({ kind: status });
      trackEvent("newsletter_subscribe", {
        link_location: source,
        subscription_status: status,
      });
    } catch (error) {
      setState({
        kind: "failed",
        message: getApiErrorMessage(
          error,
          "Could not subscribe you right now. Please try again.",
        ),
      });
    }
  }

  if (done) {
    const subscribed = state.kind === "subscribed";
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-xl px-4 py-3.5 text-sm",
          dark
            ? "bg-white/10 text-white ring-1 ring-white/15"
            : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
          className,
        )}
      >
        {subscribed ? (
          <IconCircleCheck
            className={cn(
              "mt-px size-5 shrink-0",
              dark ? "text-whatsapp" : "text-emerald-600",
            )}
          />
        ) : (
          <IconMailCheck
            className={cn(
              "mt-px size-5 shrink-0",
              dark ? "text-gold" : "text-emerald-600",
            )}
          />
        )}
        <div className="min-w-0">
          <p className="font-semibold">
            {subscribed ? "You’re subscribed!" : "You’re already on the list"}
          </p>
          <p className={cn("mt-0.5", dark ? "text-white/70" : "text-emerald-800/80")}>
            {subscribed
              ? "Daily deal updates are on their way to your inbox."
              : "This email already receives our daily deal updates."}
          </p>
        </div>
      </div>
    );
  }

  const invalid = state.kind === "invalid";

  return (
    <form onSubmit={submit} noValidate className={cn("w-full", className)}>
      <div
        className={cn(
          "flex flex-col gap-2",
          layout === "inline" && "sm:flex-row sm:items-start",
        )}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor={fieldId} className="sr-only">
            Email address
          </label>
          <Input
            id={fieldId}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (state.kind !== "idle") setState({ kind: "idle" });
            }}
            maxLength={NEWSLETTER_EMAIL_MAX_LENGTH}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${fieldId}-error` : undefined}
            disabled={submitting}
            placeholder="Enter your email"
            className={cn(
              "h-11 rounded-xl px-4",
              dark
                ? "border-white/15 bg-white/10 text-white placeholder:text-white/45 focus-visible:border-gold/60 focus-visible:ring-gold/20"
                : "border-slate-200 bg-white text-brand placeholder:text-slate-400",
              invalid && !dark && "border-red-300",
            )}
          />
        </div>
        {/* Honeypot: off-screen and skipped by keyboard and assistive tech. */}
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor={`${fieldId}-company`}>Company</label>
          <input
            id={`${fieldId}-company`}
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className={cn(
            "h-11 shrink-0 rounded-xl px-6 text-sm font-semibold",
            dark
              ? "bg-gold text-brand hover:bg-gold-hover"
              : "bg-brand text-white hover:bg-brand-hover",
            layout === "stacked" && "w-full",
          )}
        >
          {submitting ? (
            <>
              <IconLoader2 className="animate-spin" /> Subscribing…
            </>
          ) : (
            buttonLabel
          )}
        </Button>
      </div>
      {invalid && (
        <p
          id={`${fieldId}-error`}
          role="alert"
          className={cn(
            "mt-1.5 text-xs",
            dark ? "text-gold" : "text-red-600",
          )}
        >
          {state.message}
        </p>
      )}
      {state.kind === "failed" && (
        <p
          role="alert"
          className={cn(
            "mt-1.5 flex items-start gap-1.5 text-xs",
            dark ? "text-white/80" : "text-red-600",
          )}
        >
          <IconAlertTriangle className="mt-px size-3.5 shrink-0" />
          {state.message}
        </p>
      )}
    </form>
  );
}
