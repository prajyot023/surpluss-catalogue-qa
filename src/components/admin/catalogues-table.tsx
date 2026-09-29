"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleDashed, ExternalLink, Eye, Loader2, MessageSquareText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { deleteCatalogue, setCatalogueStatus } from "@/app/admin/actions";
import { CatalogueEditDialog } from "@/components/admin/catalogue-edit-dialog";
import { FixPricesDialog } from "@/components/admin/fix-prices-dialog";
import type { IncompleteProduct } from "@/lib/schemas/product";
import { appToast } from "@/components/ui/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

export type CatalogueRow = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  products: number;
  leads: number;
  updatedAt: string;
  status: "draft" | "published" | "expired";
};

const statusLabels: Record<CatalogueRow["status"], string> = {
  published: "Live",
  draft: "Draft",
  expired: "Expired",
};

const statusStyles: Record<CatalogueRow["status"], { badge: string; dot: string }> = {
  published: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  draft: { badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  expired: { badge: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
};

export function CataloguesTable({
  rows,
  canManage = false,
}: {
  rows: CatalogueRow[];
  /** Publishing and deleting are admin-only. */
  canManage?: boolean;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"all" | CatalogueRow["status"]>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CatalogueRow | null>(null);
  const [fixingPrices, setFixingPrices] = useState<{ row: CatalogueRow; products: IncompleteProduct[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () => rows.filter((row) => statusFilter === "all" || row.status === statusFilter),
    [rows, statusFilter],
  );

  function changeStatus(row: CatalogueRow, status: "draft" | "published") {
    startTransition(async () => {
      const result = await setCatalogueStatus(row.id, status);
      if (result.error) {
        if ("incompleteProducts" in result && result.incompleteProducts?.length) {
          setFixingPrices({ row, products: result.incompleteProducts });
          return;
        }
        appToast.error("Could not update catalogue", result.error);
      } else {
        appToast.success(status === "published" ? "Catalogue is live" : "Catalogue updated", row.name);
        router.refresh();
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteCatalogue(deleting.id);
      if (result.error) {
        appToast.error("Could not delete the catalogue", result.error);
        return;
      }
      appToast.success("Catalogue deleted", deleting.name);
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">All catalogues</h2>
          <p className="mt-0.5 text-xs text-slate-500">{rows.length} catalogue {rows.length === 1 ? "record" : "records"}</p>
        </div>
        <Select
          items={{ all: "Status: All", ...statusLabels }}
          value={statusFilter}
          onValueChange={(value) => value && setStatusFilter(value as typeof statusFilter)}
        >
          <SelectTrigger aria-label="Filter by status" className="h-9 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">Status: All</SelectItem>
            <SelectItem value="published">Live</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Catalogue</TableHead><TableHead className="hidden md:table-cell">Products</TableHead><TableHead className="hidden sm:table-cell">Enquiries</TableHead><TableHead className="hidden lg:table-cell">Last updated</TableHead><TableHead>Status</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/admin/catalogues/${row.id}`} className="font-medium hover:underline">{row.name}</Link>
                <div className="mt-0.5 text-xs text-slate-500">{row.category ?? "No category"}</div>
              </TableCell>
              <TableCell className="hidden md:table-cell">{row.products}</TableCell>
              <TableCell className="hidden sm:table-cell">{row.leads}</TableCell>
              <TableCell className="hidden text-slate-500 lg:table-cell">{new Date(row.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
              <TableCell>
                <Badge variant="outline" className={statusStyles[row.status].badge}>
                  <span className={`size-1.5 rounded-full ${statusStyles[row.status].dot}`} />
                  {statusLabels[row.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <CopyLinkButton slug={row.slug} />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" disabled={pending} aria-label="More options"><MoreHorizontal /></Button>}
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/admin/catalogues/${row.id}`} />}>
                        <Eye /> View details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingId(row.id)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      {row.status === "published" && (
                        <DropdownMenuItem render={<Link href={`/catalogue/${row.slug}`} target="_blank" />}>
                          <ExternalLink /> Open catalogue
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem render={<Link href="/admin/leads" />}>
                        <MessageSquareText /> View leads
                      </DropdownMenuItem>
                      {canManage &&
                        (row.status === "published" ? (
                          <DropdownMenuItem onClick={() => changeStatus(row, "draft")}>
                            <CircleDashed /> Move to draft
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => changeStatus(row, "published")}>
                            <CircleCheck /> Go live
                          </DropdownMenuItem>
                        ))}
                      {canManage && (
                        <DropdownMenuItem onClick={() => setDeleting(row)} className="text-red-600">
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!filtered.length && (
            <TableRow><TableCell colSpan={6} className="h-32 text-center text-sm text-slate-500">{rows.length ? "No catalogues match this filter." : "No catalogues yet. Click New catalogue to create one from your products."}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      {fixingPrices && (
        <FixPricesDialog
          products={fixingPrices.products}
          onClose={() => setFixingPrices(null)}
          onSaveDraft={() => {
            appToast.info("Kept as draft", "Publish it whenever the prices are ready.");
            setFixingPrices(null);
          }}
          onPublish={async () => {
            const target = fixingPrices.row;
            setFixingPrices(null);
            const result = await setCatalogueStatus(target.id, "published");
            if (result.error) {
              if ("incompleteProducts" in result && result.incompleteProducts?.length) {
                setFixingPrices({ row: target, products: result.incompleteProducts });
                return;
              }
              appToast.error("Could not publish the catalogue", result.error);
              return;
            }
            appToast.success("Catalogue is live", target.name);
            router.refresh();
          }}
        />
      )}
      {editingId && (
        <CatalogueEditDialog
          key={editingId}
          catalogueId={editingId}
          onOpenChange={(open) => {
            if (!open) setEditingId(null);
          }}
        />
      )}
      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the catalogue, its shareable link and all its product listings. Catalogues with enquiries cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button onClick={confirmDelete} disabled={pending} className="bg-red-600 text-white hover:bg-red-700">
              {pending ? <><Loader2 className="animate-spin" /> Deleting…</> : "Delete catalogue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
