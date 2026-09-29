"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { deleteCatalogue, setCatalogueStatus } from "@/app/admin/actions";
import { CatalogueBannersDialog } from "@/components/admin/catalogue-banners-dialog";
import { CatalogueEditDialog } from "@/components/admin/catalogue-edit-dialog";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { FixPricesDialog } from "@/components/admin/fix-prices-dialog";
import type { EffectiveCatalogueStatus } from "@/lib/catalogue-status";
import type { IncompleteProduct } from "@/lib/schemas/product";
import type { CatalogueBanner } from "@/lib/schemas/catalogue";
import { appToast } from "@/components/ui/app-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function CatalogueDetailActions({
  catalogueId,
  name,
  slug,
  status,
  banners = [],
  categories = [],
  canManage = false,
}: {
  catalogueId: string;
  name: string;
  slug: string;
  status: EffectiveCatalogueStatus;
  banners?: CatalogueBanner[];
  categories?: string[];
  /** Publishing and deleting are admin-only. */
  canManage?: boolean;
}) {
  const router = useRouter();
  const published = status === "published";
  const [editing, setEditing] = useState(false);
  const [editingBanners, setEditingBanners] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fixing, setFixing] = useState<IncompleteProduct[] | null>(null);
  const [pending, startTransition] = useTransition();

  function changeStatus(next: "draft" | "published") {
    startTransition(async () => {
      const result = await setCatalogueStatus(catalogueId, next);
      if (result.error) {
        if ("incompleteProducts" in result && result.incompleteProducts?.length) {
          setFixing(result.incompleteProducts);
          return;
        }
        appToast.error("Could not update the catalogue", result.error);
        return;
      }
      appToast.success(next === "published" ? "Catalogue is live" : "Moved to draft", name);
      router.refresh();
    });
  }

  function toggleLive(checked: boolean) {
    if (checked && status === "expired") {
      appToast.error(
        "The validity date has passed",
        "Edit the catalogue and set a new date, then put it live again.",
      );
      return;
    }
    changeStatus(checked ? "published" : "draft");
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteCatalogue(catalogueId);
      if (result.error) {
        appToast.error("Could not delete the catalogue", result.error);
        return;
      }
      appToast.success("Catalogue deleted", name);
      router.push("/admin/catalogues");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status first: the one place that says draft or live. */}
      <div className="flex h-9 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3">
        {pending ? (
          <Loader2 className="size-4 animate-spin text-slate-400" />
        ) : (
          canManage && (
            <Switch
              id="catalogue-live-toggle"
              checked={published}
              onCheckedChange={toggleLive}
              aria-label={published ? "Move to draft" : "Go live"}
            />
          )
        )}
        <Label
          htmlFor="catalogue-live-toggle"
          className={cn(
            "text-sm font-semibold",
            published ? "text-emerald-700" : status === "expired" ? "text-red-600" : "text-slate-500",
          )}
        >
          {published ? "Live" : status === "expired" ? "Expired" : "Draft"}
        </Label>
      </div>

      <Separator orientation="vertical" className="mx-1 hidden h-5 data-vertical:self-auto sm:block" />

      {/* Everyday actions, most used last so it sits at the end of the eye line. */}
      <CopyLinkButton slug={slug} variant="outline" size="icon" />
      {published && (
        <Link href={`/catalogue/${slug}`} target="_blank" className={buttonVariants({ variant: "outline" })}>
          <ExternalLink /> Open
        </Link>
      )}
      <Button variant="outline" onClick={() => setEditingBanners(true)}>
        <ImagePlus /> {banners.length ? `Banners (${banners.length})` : "Add banners"}
      </Button>
      <Button onClick={() => setEditing(true)} className="bg-brand text-white">
        <Pencil /> Edit
      </Button>

      {canManage && (
        <Button
          variant="outline"
          size="icon"
          aria-label="Delete catalogue"
          onClick={() => setDeleting(true)}
          className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 />
        </Button>
      )}

      {editing && (
        <CatalogueEditDialog
          catalogueId={catalogueId}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
        />
      )}
      {editingBanners && (
        <CatalogueBannersDialog
          catalogueId={catalogueId}
          catalogueName={name}
          initialBanners={banners}
          categories={categories}
          onOpenChange={(open) => {
            if (!open) setEditingBanners(false);
          }}
        />
      )}
      {fixing && (
        <FixPricesDialog
          products={fixing}
          onClose={() => setFixing(null)}
          onSaveDraft={() => {
            appToast.info("Kept as draft", "Put it live whenever the products are ready.");
            setFixing(null);
          }}
          onPublish={async () => {
            setFixing(null);
            const result = await setCatalogueStatus(catalogueId, "published");
            if (result.error) {
              if ("incompleteProducts" in result && result.incompleteProducts?.length) {
                setFixing(result.incompleteProducts);
                return;
              }
              appToast.error("Could not put the catalogue live", result.error);
              return;
            }
            appToast.success("Catalogue is live", name);
            router.refresh();
          }}
        />
      )}
      <Dialog open={deleting} onOpenChange={(open) => { if (!open) setDeleting(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the catalogue, its shareable link and all its product listings. Catalogues with enquiries cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>Cancel</Button>
            <Button onClick={confirmDelete} disabled={pending} className="bg-red-600 text-white hover:bg-red-700">
              {pending ? <><Loader2 className="animate-spin" /> Deleting…</> : "Delete catalogue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
