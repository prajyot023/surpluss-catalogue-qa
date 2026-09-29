import { connection } from "next/server";
import { PageHeader } from "@/components/admin/page-header";

export default async function SettingsPage() {
  await connection();
  const integrations = [
    { name: "Prisma · PostgreSQL", configured: Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("[YOUR-PASSWORD]")) },
    { name: "Amazon SES", configured: Boolean(process.env.SES_FROM_EMAIL && process.env.SES_TEAM_EMAIL && process.env.AWS_REGION) },
    { name: "WATI WhatsApp", configured: Boolean(process.env.WATI_API_URL && process.env.WATI_API_TOKEN && process.env.WATI_TEAM_NUMBER) },
    { name: "AWS S3 & CloudFront", configured: Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_CLOUDFRONT_URL) },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Manage the Surpluss catalogue portal." />
      <div className="max-w-2xl rounded-2xl border border-[#e1e5ea] bg-white p-6">
        <h2 className="text-sm font-bold">Integrations</h2>
        <p className="mt-1 text-xs text-slate-500">Configured through environment variables on the server.</p>
        <div className="mt-5 divide-y divide-[#edf0f3]">
          {integrations.map((integration) => (
            <div key={integration.name} className="flex items-center justify-between py-4">
              <span className="text-sm font-semibold">{integration.name}</span>
              {integration.configured
                ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Configured</span>
                : <span className="rounded-full bg-[#fff5cf] px-2.5 py-1 text-[10px] font-bold text-[#7a5a00]">Needs credentials</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
