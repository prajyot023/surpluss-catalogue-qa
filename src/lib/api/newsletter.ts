import { apiClient } from "@/lib/api/client";
import type {
  NewsletterResponse,
  NewsletterSource,
  NewsletterStatus,
} from "@/lib/schemas/newsletter";

export async function subscribeToNewsletter(input: {
  email: string;
  source: NewsletterSource;
  /** Honeypot value; always empty for a real person. */
  company?: string;
}): Promise<NewsletterStatus> {
  const response = await apiClient.post<NewsletterResponse>(
    "/api/newsletter",
    input,
  );
  return response.data.status === "already-subscribed"
    ? "already-subscribed"
    : "subscribed";
}
