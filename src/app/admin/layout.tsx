import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SignedInToast } from "@/components/admin/signed-in-toast";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getNewLeadsCount } from "@/lib/catalogue-queries";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const newLeads = await getNewLeadsCount();
  const user = {
    name: session.user.name ?? "Surpluss Admin",
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={user} newLeads={newLeads} />
      <SidebarInset>
        <SiteHeader />
        <div className="@container/main mx-auto w-full max-w-360 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
        <SignedInToast />
      </SidebarInset>
    </SidebarProvider>
  );
}
