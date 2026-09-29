import { z } from "zod";

/**
 * Where a subscription came from. Used for analytics and UI only — every
 * subscriber carries the same Mailchimp tag regardless of placement.
 */
export const NEWSLETTER_SOURCES = [
  "header",
  "footer",
  "catalogue-bottom",
] as const;

export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

/** RFC 5321 caps an address at 254 characters; anything longer is junk. */
export const NEWSLETTER_EMAIL_MAX_LENGTH = 254;

export function isNewsletterSource(value: unknown): value is NewsletterSource {
  return (
    typeof value === "string" &&
    (NEWSLETTER_SOURCES as readonly string[]).includes(value)
  );
}

export const newsletterEmailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(NEWSLETTER_EMAIL_MAX_LENGTH, "That email address is too long.")
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const newsletterSourceSchema = z.enum(NEWSLETTER_SOURCES);

export const newsletterSubscribeSchema = z.object({
  email: newsletterEmailSchema,
  source: newsletterSourceSchema,
  // Honeypot: real people never see this field, so a filled value means a bot.
  company: z.string().max(200).optional(),
});

export type NewsletterSubscribeInput = z.input<
  typeof newsletterSubscribeSchema
>;

/** What the API answers with once a request is accepted. */
export type NewsletterStatus = "subscribed" | "already-subscribed";

export type NewsletterResponse = { ok: true; status: NewsletterStatus };
