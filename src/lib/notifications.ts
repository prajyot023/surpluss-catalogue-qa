import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import axios from "axios";
import { awsClientConfig } from "@/lib/aws/config";

type Notice = {
  reference: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  summary: string;
  /** Catalogue-specific WhatsApp recipient; falls back to WATI_TEAM_NUMBER. */
  notifyNumber?: string | null;
};

export async function notifyTeam(payload: Notice) {
  const tasks: Promise<unknown>[] = [];
  const appUrl = (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
  const leadUrl = appUrl
    ? `${appUrl}/admin/leads/${encodeURIComponent(payload.reference)}`
    : "Surpluss admin URL not configured";
  const watiRecipient = payload.notifyNumber || process.env.WATI_TEAM_NUMBER;
  // Meta rejects template parameters containing newlines, tabs or 4+ consecutive spaces.
  const watiSummary = payload.summary.replace(/\s*[\r\n\t]+\s*/g, " | ").replace(/ {4,}/g, " ");
  if (process.env.WATI_API_URL && process.env.WATI_API_TOKEN && watiRecipient) {
    const watiClient = axios.create({
      baseURL: process.env.WATI_API_URL.replace(/\/+$/, ""),
      timeout: 10_000,
      headers: { Authorization: `Bearer ${process.env.WATI_API_TOKEN}` },
    });
    tasks.push(
      watiClient
        .post(
          `/api/v2/sendTemplateMessage?whatsappNumber=${encodeURIComponent(watiRecipient)}`,
          {
            template_name: process.env.WATI_ENQUIRY_TEMPLATE ?? "surpluss_catalog_template",
            broadcast_name: `catalogue-lead-${payload.reference}`,
            parameters: [
              { name: "reference", value: payload.reference },
              { name: "buyer", value: payload.name },
              { name: "company", value: payload.company || "Not provided" },
              { name: "phone", value: payload.phone },
              { name: "email", value: payload.email || "Not provided" },
              { name: "summary", value: watiSummary },
            ],
          },
        )
        .then((response) => response.data)
        .catch((error: unknown) => {
          const status = axios.isAxiosError(error) ? error.response?.status ?? error.code : "unknown";
          throw new Error(`WATI V3 request failed (${status})`);
        }),
    );
  }
  if (process.env.SES_FROM_EMAIL && process.env.SES_TEAM_EMAIL) {
    const ses = new SESv2Client(awsClientConfig());
    tasks.push(ses.send(new SendEmailCommand({
      FromEmailAddress: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [process.env.SES_TEAM_EMAIL] },
      Content: {
        Simple: {
          Subject: { Data: `New catalogue enquiry · ${payload.reference}` },
          Body: {
            Text: {
              Data: [
                `Reference: ${payload.reference}`,
                `Buyer: ${payload.name}`,
                `WhatsApp: ${payload.phone}`,
                payload.email ? `Email: ${payload.email}` : "",
                `Request: ${payload.summary}`,
                `View lead: ${leadUrl}`,
              ].filter(Boolean).join("\n"),
            },
          },
        },
      },
    })));
  }
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(`[notifyTeam] ${payload.reference}:`, result.reason);
    }
  }
  return results;
}
