import { createHash } from "node:crypto";
import axios from "axios";
export const MAILCHIMP_SUBSCRIBER_TAG = "deals-subscriber";

export type MailchimpConfig = {
  apiKey: string;
  audienceId: string;
  serverPrefix: string;
  baseUrl: string;
};

export type MailchimpErrorKind =
  /** The address is already on the audience, whatever its current status. */
  | "member-exists"
  /** Mailchimp rejected the address itself (malformed, role-based, fake). */
  | "invalid-email"
  /** Permanently deleted contact: only they can re-subscribe, via Mailchimp. */
  | "forgotten-email"
  /** Bad or revoked API key. */
  | "unauthorized"
  /** Unknown audience id, or a wrong server prefix. */
  | "not-found"
  | "rate-limited"
  | "unknown";

/** A Mailchimp call that could not be completed, already classified. */
export class MailchimpError extends Error {
  kind: MailchimpErrorKind;

  constructor(kind: MailchimpErrorKind, message: string) {
    super(message);
    this.name = "MailchimpError";
    this.kind = kind;
  }
}

/** Data centre suffix carried by every key, for example "...-us21". */
const SERVER_PREFIX_PATTERN = /^[a-z]{2}\d{1,3}$/;

/**
 * Builds the config from raw env values. Returns null when the integration is
 * not configured, so local development and previews keep working without keys.
 */
export function parseMailchimpConfig(
  env: Record<string, string | undefined>,
): MailchimpConfig | null {
  const apiKey = env.MAILCHIMP_API_KEY?.trim();
  const audienceId = env.MAILCHIMP_AUDIENCE_ID?.trim();
  if (!apiKey || !audienceId) return null;
  // The prefix is part of the key, so fall back to it when the env var is unset.
  const serverPrefix = (
    env.MAILCHIMP_SERVER_PREFIX?.trim() ||
    apiKey.split("-").pop() ||
    ""
  ).toLowerCase();
  if (!SERVER_PREFIX_PATTERN.test(serverPrefix)) return null;
  return {
    apiKey,
    audienceId,
    serverPrefix,
    baseUrl: `https://${serverPrefix}.api.mailchimp.com/3.0`,
  };
}

/** MD5 of the lowercased address: Mailchimp's member identifier. */
export function subscriberHash(email: string) {
  return createHash("md5").update(email.trim().toLowerCase()).digest("hex");
}

/** Maps an axios failure onto the outcomes this feature has to tell apart. */
export function classifyMailchimpError(error: unknown): MailchimpErrorKind {
  if (!axios.isAxiosError(error)) return "unknown";
  const status = error.response?.status ?? null;
  const body = error.response?.data;
  const title =
    body && typeof body === "object" && typeof (body as { title?: unknown }).title === "string"
      ? ((body as { title: string }).title).toLowerCase()
      : "";
  if (status === 401) return "unauthorized";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status === 400) {
    if (title === "member exists") return "member-exists";
    if (title === "forgotten email not subscribed") return "forgotten-email";
    if (title === "invalid resource") return "invalid-email";
  }
  return "unknown";
}

function mailchimpClient(config: MailchimpConfig) {
  return axios.create({
    baseURL: config.baseUrl,
    timeout: 10_000,
    headers: {
      // Mailchimp accepts any username with the key as the password.
      Authorization: `Basic ${Buffer.from(`surpluss:${config.apiKey}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  });
}

export type SubscribeOutcome = "subscribed" | "already-subscribed";

/**
 * Adds an address to the audience under the single subscriber tag.
 *
 * A brand new contact is created with status "subscribed". An address that is
 * already known is left exactly as it is — an unsubscribed contact must not be
 * resurrected by a form post — but still gets the tag applied.
 */
export async function subscribeContact(
  config: MailchimpConfig,
  email: string,
): Promise<SubscribeOutcome> {
  const client = mailchimpClient(config);
  try {
    await client.post(`/lists/${encodeURIComponent(config.audienceId)}/members`, {
      email_address: email,
      status: "subscribed",
      tags: [MAILCHIMP_SUBSCRIBER_TAG],
    });
    return "subscribed";
  } catch (error) {
    const kind = classifyMailchimpError(error);
    if (kind === "member-exists") {
      await tagContact(client, config, email);
      return "already-subscribed";
    }
    // A forgotten (permanently deleted) contact cannot be re-added by us, but
    // saying "you are already on the list" is the honest, safe answer here.
    if (kind === "forgotten-email") return "already-subscribed";
    throw new MailchimpError(kind, `Mailchimp subscribe failed (${kind}).`);
  }
}

/**
 * Activates the subscriber tag on an existing contact. This only touches tags,
 * never `status`, so an unsubscribed contact stays unsubscribed. Tagging is a
 * nice-to-have, so a failure here never turns a successful subscription into
 * an error.
 */
async function tagContact(
  client: ReturnType<typeof mailchimpClient>,
  config: MailchimpConfig,
  email: string,
) {
  try {
    await client.post(
      `/lists/${encodeURIComponent(config.audienceId)}/members/${subscriberHash(email)}/tags`,
      { tags: [{ name: MAILCHIMP_SUBSCRIBER_TAG, status: "active" }] },
    );
  } catch (error) {
    console.error(
      `[mailchimp] could not tag an existing contact with "${MAILCHIMP_SUBSCRIBER_TAG}":`,
      classifyMailchimpError(error),
    );
  }
}
