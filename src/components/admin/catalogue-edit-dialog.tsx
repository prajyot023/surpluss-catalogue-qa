"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { fetchCatalogue, updateCatalogue } from "@/lib/api/catalogues";
import { ApiError, getApiErrorMessage } from "@/lib/api/client";
import {
  catalogueEditSchema,
  CATALOGUE_EDIT_STATUSES,
  type CatalogueEditInput,
} from "@/lib/schemas/catalogue";
import type { IncompleteProduct } from "@/lib/schemas/product";
import { CategorySelect } from "@/components/admin/category-select";
import { FixPricesDialog } from "@/components/admin/fix-prices-dialog";
import { SlugStatusHint, SlugStatusIcon } from "@/components/admin/slug-status";
import { useSlugCheck } from "@/hooks/use-slug-check";
import { slugify, slugifyInput } from "@/lib/slug";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<(typeof CATALOGUE_EDIT_STATUSES)[number], string> = {
  draft: "Draft",
  published: "Live",
};

function toLocalDateString(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function incompleteFrom(error: unknown): IncompleteProduct[] | null {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    error.data &&
    typeof error.data === "object" &&
    "incompleteProducts" in error.data &&
    Array.isArray((error.data as { incompleteProducts?: unknown }).incompleteProducts)
  ) {
    return (error.data as { incompleteProducts: IncompleteProduct[] }).incompleteProducts;
  }
  return null;
}

// Render only while open, keyed by catalogueId, so form state resets between uses:
// {editingId && <CatalogueEditDialog key={editingId} catalogueId={editingId} onOpenChange={...} />}
export function CatalogueEditDialog({
  catalogueId,
  onOpenChange,
}: {
  catalogueId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [fixingPrices, setFixingPrices] = useState<IncompleteProduct[] | null>(null);
  const loading = loadedId !== catalogueId;

  const form = useForm<CatalogueEditInput>({
    resolver: zodResolver(catalogueEditSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      category: "",
      notifyNumber: "",
      status: "draft",
      validUntil: null,
      banners: [],
    },
  });
  const { register, handleSubmit, control, reset, setError, setValue, getValues, formState } = form;

  const slugValue = useWatch({ control, name: "slug" });
  const slugStatus = useSlugCheck(slugValue, catalogueId);

  useEffect(() => {
    let cancelled = false;
    fetchCatalogue(catalogueId)
      .then((catalogue) => {
        if (cancelled) return;
        reset({
          name: catalogue.name,
          slug: catalogue.slug,
          description: catalogue.description,
          category: catalogue.category,
          notifyNumber: catalogue.notifyNumber,
          // Only draft and live exist in the UI; expired and legacy inactive load as draft.
          status: catalogue.status === "published" ? "published" : "draft",
          validUntil: catalogue.validUntil,
          banners: catalogue.banners,
        });
        setLoadedId(catalogueId);
      })
      .catch((error) => {
        if (cancelled) return;
        appToast.error("Could not load the catalogue", getApiErrorMessage(error));
        onOpenChange(false);
      });
    return () => {
      cancelled = true;
    };
  }, [catalogueId, reset, onOpenChange]);

  async function save(values: CatalogueEditInput) {
    const catalogue = await updateCatalogue(catalogueId, {
      ...values,
      // Slots without an uploaded image are just empty drafts.
      banners: values.banners.filter((banner) => banner.imageUrl),
    });
    appToast.success("Catalogue updated", catalogue.name);
    onOpenChange(false);
    router.refresh();
  }

  const onSubmit = handleSubmit(async (values) => {
    if (slugStatus === "taken") {
      setError("slug", { type: "server", message: "This link is already in use." });
      return;
    }
    try {
      await save(values);
    } catch (error) {
      const incomplete = incompleteFrom(error);
      if (incomplete) {
        setFixingPrices(incomplete);
        return;
      }
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (messages?.length && field in values) {
            setError(field as keyof CatalogueEditInput, { type: "server", message: messages[0] });
          }
        }
      }
      appToast.error("Could not save the catalogue", getApiErrorMessage(error));
    }
  });

  const errors = formState.errors;
  const saving = formState.isSubmitting;

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit catalogue</DialogTitle>
            <DialogDescription>Changes go live immediately for published catalogues.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="grid h-64 place-items-center">
              <Loader2 className="size-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <div>
                <Label htmlFor="catalogue-name">Name *</Label>
                <Input
                  id="catalogue-name"
                  {...register("name", {
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                      // Follow the name until the admin edits the link by hand.
                      if (formState.dirtyFields.slug) return;
                      setValue("slug", slugify(event.target.value));
                    },
                  })}
                  aria-invalid={Boolean(errors.name)}
                  className="mt-1.5"
                />
                <FieldError message={errors.name?.message} />
              </div>
              <div>
                <Label htmlFor="catalogue-slug">Link *</Label>
                <div className="mt-1.5 flex items-center gap-0">
                  <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-[#dfe3e8] bg-slate-50 px-3 text-xs text-slate-500">/catalogue/</span>
                  <div className="relative flex-1">
                    <Input
                      id="catalogue-slug"
                      {...register("slug", {
                        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                          setValue("slug", slugifyInput(event.target.value), { shouldDirty: true });
                        },
                        onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
                          setValue("slug", slugify(event.target.value));
                        },
                      })}
                      aria-invalid={Boolean(errors.slug) || slugStatus === "taken"}
                      className="rounded-l-none pr-9"
                    />
                    <SlugStatusIcon status={slugStatus} />
                  </div>
                </div>
                <SlugStatusHint status={slugStatus} />
                <p className="mt-1 text-[11px] text-slate-400">Changing the link breaks previously shared links.</p>
                <FieldError message={errors.slug?.message} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="catalogue-category">Category</Label>
                  <div className="mt-1.5">
                    <Controller
                      control={control}
                      name="category"
                      render={({ field }) => (
                        <CategorySelect kind="catalogue" id="catalogue-category" value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                  <FieldError message={errors.category?.message} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select
                        items={STATUS_LABELS}
                        value={field.value}
                        onValueChange={(value) => value && field.onChange(value)}
                      >
                        <SelectTrigger aria-label="Status" className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATALOGUE_EDIT_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="catalogue-notify-number">Lead alerts on WhatsApp</Label>
                <Input
                  id="catalogue-notify-number"
                  inputMode="numeric"
                  {...register("notifyNumber")}
                  aria-invalid={Boolean(errors.notifyNumber)}
                  className="mt-1.5"
                  placeholder="919876543210"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Enquiries for this catalogue are sent to this number. Leave empty to use the team default.
                </p>
                <FieldError message={errors.notifyNumber?.message} />
              </div>
              <div>
                <Label>Valid until</Label>
                <Controller
                  control={control}
                  name="validUntil"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value ? new Date(`${field.value}T00:00:00`) : undefined}
                      onChange={(date) => field.onChange(date ? toLocalDateString(date) : null)}
                      placeholder="No expiry"
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      className="mt-1.5"
                    />
                  )}
                />
                <FieldError message={errors.validUntil?.message} />
              </div>
              <div>
                <Label htmlFor="catalogue-description">Description</Label>
                <Textarea
                  id="catalogue-description"
                  {...register("description")}
                  aria-invalid={Boolean(errors.description)}
                  className="mt-1.5 min-h-20"
                  placeholder="Short buyer-facing introduction"
                />
                <FieldError message={errors.description?.message} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-brand text-white">
                  {saving ? <><Loader2 className="animate-spin" /> Saving…</> : "Save catalogue"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {fixingPrices && (
        <FixPricesDialog
          products={fixingPrices}
          onClose={() => setFixingPrices(null)}
          onSaveDraft={async () => {
            setFixingPrices(null);
            try {
              await save({ ...getValues(), status: "draft" });
            } catch (error) {
              appToast.error("Could not save the catalogue", getApiErrorMessage(error));
            }
          }}
          onPublish={async () => {
            setFixingPrices(null);
            try {
              await save(getValues());
            } catch (error) {
              const incomplete = incompleteFrom(error);
              if (incomplete) {
                setFixingPrices(incomplete);
                return;
              }
              appToast.error("Could not publish the catalogue", getApiErrorMessage(error));
            }
          }}
        />
      )}
    </>
  );
}
