import { NextResponse } from "next/server";
import {
  MailchimpError,
  parseMailchimpConfig,
  subscribeContact,
} from "@/lib/mailchimp";
import { newsletterSubscribeSchema } from "@/lib/schemas/newsletter";

export async function POST(request: Request) {
  const parsed = newsletterSubscribeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      },
      { status: 400 },
    );
  }
  const { email, source, company } = parsed.data;
  // Honeypot tripped: answer like a success so the bot learns nothing.
  if (company && company.trim()) {
    return NextResponse.json({ ok: true, status: "subscribed" });
  }

  const config = parseMailchimpConfig(process.env);
  if (!config) {
    console.error("[newsletter] MAILCHIMP_* environment variables are not configured.");
    return NextResponse.json(
      { error: "Subscriptions are unavailable right now. Please try again later." },
      { status: 503 },
    );
  }

  try {
    // `source` stays out of Mailchimp: it is app-side analytics context only.
    const status = await subscribeContact(config, email);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const kind = error instanceof MailchimpError ? error.kind : "unknown";
    if (kind === "invalid-email") {
      return NextResponse.json(
        { error: "That email address was rejected. Please check it and try again." },
        { status: 400 },
      );
    }
    console.error(`[newsletter] subscription from "${source}" failed:`, kind);
    // Never leak credential or audience problems to the browser.
    return NextResponse.json(
      { error: "Could not subscribe you right now. Please try again later." },
      { status: 502 },
    );
  }
}
