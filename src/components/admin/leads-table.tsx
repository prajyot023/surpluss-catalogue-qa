"use client";

import { Download, ExternalLink, Inbox, Megaphone, PackageCheck, Search, Share2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { appToast } from "@/components/ui/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";

export type LeadRow = {
  reference: string;
  buyerName: string;
  company: string | null;
  phone: string;
  email: string | null;
  catalogueId: string;
  catalogueName: string;
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
  status: "new" | "contacted" | "qualified" | "won" | "lost" | "spam";
};

type CatalogueOption = { id: string; name: string };
type SortOption = "newest" | "oldest" | "buyer" | "quantity";

const statusStyles: Record<LeadRow["status"], string> = {
  new: "border-amber-200 bg-amber-50 text-amber-700",
  contacted: "border-blue-200 bg-blue-50 text-blue-700",
  qualified: "border-violet-200 bg-violet-50 text-violet-700",
  won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  lost: "border-slate-200 bg-slate-50 text-slate-600",
  spam: "border-red-200 bg-red-50 text-red-700",
};

function formatStatus(status: LeadRow["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function LeadsTable({
  leads,
  catalogues,
  initialQuery = "",
  initialCatalogueId,
}: {
  leads: LeadRow[];
  catalogues: CatalogueOption[];
  initialQuery?: string;
  initialCatalogueId?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [catalogueId, setCatalogueId] = useState(initialCatalogueId ?? "all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const newCount = leads.filter((lead) => lead.status === "new").length;
  const totalUnits = leads.reduce((total, lead) => total + lead.totalQuantity, 0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads
      .filter((lead) => {
        const matchesCatalogue = catalogueId === "all" || lead.catalogueId === catalogueId;
        const matchesStatus = status === "all" || lead.status === status;
        const matchesQuery = !needle || [
          lead.reference,
          lead.buyerName,
          lead.company,
          lead.phone,
          lead.email,
          lead.catalogueName,
        ].filter(Boolean).join(" ").toLowerCase().includes(needle);
        return matchesCatalogue && matchesStatus && matchesQuery;
      })
      .sort((a, b) => {
        if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
        if (sort === "buyer") return a.buyerName.localeCompare(b.buyerName);
        if (sort === "quantity") return b.totalQuantity - a.totalQuantity;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [catalogueId, leads, query, sort, status]);
  async function shareLead(lead: LeadRow) {
    const leadUrl = `${window.location.origin}/admin/leads/${lead.reference}`;
  
    const shareText = [
      "Surpluss Lead Details",
      "",
      `Buyer: ${lead.buyerName}`,
      lead.company ? `Company: ${lead.company}` : null,
      `Phone: ${lead.phone}`,
      lead.email ? `Email: ${lead.email}` : null,
      `Campaign: ${lead.catalogueName}`,
      `Request: ${lead.itemCount} ${lead.itemCount === 1 ? "product" : "products"}`,
      `Quantity: ${lead.totalQuantity.toLocaleString("en-IN")} units`,
      `Reference: ${lead.reference}`,
      `Received: ${new Date(lead.createdAt).toLocaleString("en-IN")}`,
      `Status: ${formatStatus(lead.status)}`,
      "",
      `View Lead Details: ${leadUrl}`,
    ]
      .filter(Boolean)
      .join("\n");
  
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Lead ${lead.reference}`,
          text: shareText,
        });
        return;
      }
  
      await navigator.clipboard.writeText(shareText);
  
      appToast.success(
        "Lead details copied",
        "Share options are not available in this browser.",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
  
      appToast.error("Unable to share lead", "Please try again.");
    }
  }
  function exportCsv() {
    downloadCsv("surpluss-leads.csv", [
      ["Reference", "Buyer", "Company", "Phone", "Email", "Catalogue", "Products", "Quantity", "Received", "Status"],
      ...filtered.map((lead) => [
        lead.reference,
        lead.buyerName,
        lead.company ?? "",
        lead.phone,
        lead.email ?? "",
        lead.catalogueName,
        String(lead.itemCount),
        String(lead.totalQuantity),
        new Date(lead.createdAt).toLocaleString("en-IN"),
        formatStatus(lead.status),
      ]),
    ]);
    appToast.success("Leads exported", `${filtered.length} records downloaded as CSV.`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Inbox className="size-5" /></div>
          <div><p className="text-xs font-medium text-slate-500">Total enquiries</p><p className="mt-0.5 text-2xl font-semibold tracking-tight">{leads.length.toLocaleString("en-IN")}</p></div>
          {newCount > 0 && <span className="ml-auto rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">{newCount} new</span>}
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><Megaphone className="size-5" /></div>
          <div><p className="text-xs font-medium text-slate-500">Active campaigns</p><p className="mt-0.5 text-2xl font-semibold tracking-tight">{catalogues.length.toLocaleString("en-IN")}</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><PackageCheck className="size-5" /></div>
          <div><p className="text-xs font-medium text-slate-500">Units requested</p><p className="mt-0.5 text-2xl font-semibold tracking-tight">{totalUnits.toLocaleString("en-IN")}</p></div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(220px,1fr)_220px_170px_170px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="Search buyer, reference or contact" />
        </div>
        <Select items={[{ value: "all", label: "All campaigns" }, ...catalogues.map((catalogue) => ({ value: catalogue.id, label: catalogue.name }))]} value={catalogueId} onValueChange={(value) => value && setCatalogueId(value)}>
          <SelectTrigger aria-label="Filter by campaign" className="h-10 w-full bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {catalogues.map((catalogue) => <SelectItem key={catalogue.id} value={catalogue.id}>{catalogue.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select items={{ all: "All statuses", ...Object.fromEntries(Object.keys(statusStyles).map((value) => [value, formatStatus(value as LeadRow["status"])])) }} value={status} onValueChange={(value) => value && setStatus(value)}>
          <SelectTrigger aria-label="Filter by status" className="h-10 w-full bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.keys(statusStyles).map((value) => <SelectItem key={value} value={value}>{formatStatus(value as LeadRow["status"])}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select items={{ newest: "Newest first", oldest: "Oldest first", buyer: "Buyer A–Z", quantity: "Highest quantity" }} value={sort} onValueChange={(value) => value && setSort(value as SortOption)}>
          <SelectTrigger aria-label="Sort leads" className="h-10 w-full bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="buyer">Buyer A–Z</SelectItem>
            <SelectItem value="quantity">Highest quantity</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-10" onClick={exportCsv}><Download /> Export</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Buyer</TableHead>
              <TableHead className="hidden md:table-cell">Campaign</TableHead>
              <TableHead className="hidden sm:table-cell">Request</TableHead>
              <TableHead className="hidden lg:table-cell">Received</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((lead) => (
              <TableRow key={lead.reference} className={lead.status === "new" ? "bg-amber-50/30" : ""}>
                <TableCell>
                  <Link href={`/admin/leads/${lead.reference}`} className="font-medium hover:underline">{lead.buyerName}</Link>
                  <div className="mt-0.5 text-xs text-slate-500">{lead.company || lead.phone}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-400">{lead.reference}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{lead.catalogueName}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="font-medium">{lead.itemCount} {lead.itemCount === 1 ? "product" : "products"}</span>
                  <div className="text-xs text-slate-500">{lead.totalQuantity.toLocaleString("en-IN")} units</div>
                </TableCell>
                <TableCell className="hidden text-slate-500 lg:table-cell">{new Date(lead.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                <TableCell><Badge variant="outline" className={statusStyles[lead.status]}>{formatStatus(lead.status)}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Share ${lead.reference}`}
                      onClick={() => shareLead(lead)}
                    >
                      <Share2 />
                    </Button>

                    <Link
                      href={`/admin/leads/${lead.reference}`}
                      aria-label={`View ${lead.reference}`}
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    >
                      <ExternalLink />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && <TableRow><TableCell colSpan={6} className="h-36 text-center text-sm text-slate-500">No leads match these filters.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">Showing {filtered.length} of {leads.length} leads</div>
      </div>
    </div>
  );
}
