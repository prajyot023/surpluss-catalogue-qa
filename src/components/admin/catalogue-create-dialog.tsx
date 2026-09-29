"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconArrowLeft, IconLoader2, IconRocket } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { z } from "zod";
import { createCatalogueWithProducts } from "@/app/admin/catalogues/actions";
import { completeProductsForSale } from "@/app/admin/products/actions";
import { CategorySelect } from "@/components/admin/category-select";
import { buildSaleUpdates, PriceFixRows } from "@/components/admin/fix-prices-dialog";
import { ProductMultiSelect } from "@/components/admin/product-multi-select";
import { slugify, slugifyInput } from "@/lib/slug";
import { useSlugCheck } from "@/hooks/use-slug-check";
import { SlugStatusHint, SlugStatusIcon } from "@/components/admin/slug-status";
import { catalogueCreateSchema } from "@/lib/schemas/catalogue";
import type { ProductSearchResult } from "@/lib/schemas/listing";
import type { IncompleteProduct } from "@/lib/schemas/product";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";

const detailsSchema = catalogueCreateSchema.omit({ publish: true, productIds: true, banners: true });
type DetailsInput = z.infer<typeof detailsSchema>;

type Step = "details" | "products" | "prices";

const STEP_TITLES: Record<Step, string> = {
  details: "New catalogue",
  products: "Choose products",
  prices: "Almost there",
};
const STEP_HINTS: Record<Step, string> = {
  details: "Step 1 of 2. Give the catalogue a name and a link.",
  products: "Step 2 of 2. Tick the products this catalogue should show.",
  prices: "Some chosen products still need prices and stock before the catalogue can go live.",
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

// Rendered only while open so all state resets between uses:
// {creating && <CatalogueCreateDialog onClose={...} />}
export function CatalogueCreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("details");
  const [publish, setPublish] = useState(false);
  const [selected, setSelected] = useState<Map<string, ProductSearchResult>>(new Map());
  const [incomplete, setIncomplete] = useState<IncompleteProduct[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, { mrp: string; offerPrice: string; quantity: string }>>({});
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  const form = useForm<DetailsInput>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: "", slug: "", description: "", category: "", validUntil: null },
  });
  const { register, handleSubmit, control, setError, setValue, getValues, formState } = form;
  const errors = formState.errors;

  const slugValue = useWatch({ control, name: "slug" });
  const slugStatus = useSlugCheck(slugValue);

  const proceedToProducts = handleSubmit(() => {
    if (slugStatus === "taken") {
      setError("slug", { type: "server", message: "This link is already in use." });
      return;
    }
    setStep("products");
  });

  async function submit(withPublish: boolean) {
    setSaving(withPublish ? "publish" : "draft");
    try {
      const details = getValues();
      const result = await createCatalogueWithProducts({
        ...details,
        banners: [],
        publish: withPublish,
        productIds: [...selected.keys()],
      });
      if ("error" in result) {
        if (result.incompleteProducts?.length) {
          setIncomplete(result.incompleteProducts);
          setStep("prices");
          return;
        }
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.length && field in details) {
              setError(field as keyof DetailsInput, { type: "server", message: messages[0] });
            }
          }
          if (result.fieldErrors.name || result.fieldErrors.slug) setStep("details");
        }
        appToast.error("Could not create the catalogue", result.error);
        return;
      }
      appToast.success(
        result.published ? "Catalogue is live" : "Draft catalogue created",
        result.published ? "The link is ready to share with buyers." : "Publish it whenever you are ready.",
      );
      onClose();
      router.push(`/admin/catalogues/${result.catalogueId}`);
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  // Prices step: fill in the missing details, then create and publish in one go.
  async function savePricesAndPublish() {
    const { updates, incomplete: missing } = buildSaleUpdates(incomplete, priceDrafts);
    if (missing) {
      appToast.error(
        "Some details are missing",
        "Every product needs MRP, offer price and a stock quantity above 0.",
      );
      return;
    }
    setSaving("publish");
    try {
      const saved = await completeProductsForSale(updates);
      if ("error" in saved) {
        appToast.error("Could not save the details", saved.error);
        return;
      }
    } finally {
      setSaving(null);
    }
    await submit(true);
  }

  const slide = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: 14 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -14 },
        transition: { duration: 0.18 },
      };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription>{STEP_HINTS[step]}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait" initial={false}>
            {step === "details" && (
              <motion.div key="details" {...slide}>
                <form onSubmit={proceedToProducts} className="grid gap-4" noValidate>
                  <div>
                    <Label htmlFor="new-catalogue-name">Name *</Label>
                    <Input
                      id="new-catalogue-name"
                      {...register("name", {
                        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                          if (formState.dirtyFields.slug) return;
                          setValue("slug", slugify(event.target.value));
                        },
                      })}
                      aria-invalid={Boolean(errors.name)}
                      className="mt-1.5"
                      placeholder="Premium corporate essentials"
                    />
                    <FieldError message={errors.name?.message} />
                  </div>
                  <div>
                    <Label htmlFor="new-catalogue-slug">Link *</Label>
                    <div className="mt-1.5 flex items-center gap-0">
                      <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-[#dfe3e8] bg-slate-50 px-3 text-xs text-slate-500">/catalogue/</span>
                      <div className="relative flex-1">
                        <Input
                          id="new-catalogue-slug"
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
                          placeholder="premium-corporate-essentials"
                        />
                        <SlugStatusIcon status={slugStatus} />
                      </div>
                    </div>
                    <SlugStatusHint status={slugStatus} />
                    <p className="mt-1 text-[11px] text-slate-400">Made from the name automatically. You can change it.</p>
                    <FieldError message={errors.slug?.message} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="new-catalogue-category">Category</Label>
                      <div className="mt-1.5">
                        <Controller
                          control={control}
                          name="category"
                          render={({ field }) => (
                            <CategorySelect kind="catalogue" id="new-catalogue-category" value={field.value} onChange={field.onChange} />
                          )}
                        />
                      </div>
                      <FieldError message={errors.category?.message} />
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
                  </div>
                  <div>
                    <Label htmlFor="new-catalogue-description">Description</Label>
                    <Textarea
                      id="new-catalogue-description"
                      {...register("description")}
                      aria-invalid={Boolean(errors.description)}
                      className="mt-1.5 min-h-20"
                      placeholder="A short line buyers see under the title"
                    />
                    <FieldError message={errors.description?.message} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={publish} onCheckedChange={(checked) => setPublish(checked === true)} />
                    Put it live right away (otherwise it is saved as a draft)
                  </label>
                </form>
              </motion.div>
            )}

            {step === "products" && (
              <motion.div key="products" {...slide}>
                <ProductMultiSelect selected={selected} onChange={setSelected} />
              </motion.div>
            )}

            {step === "prices" && (
              <motion.div key="prices" {...slide}>
                <PriceFixRows
                  products={incomplete}
                  drafts={priceDrafts}
                  onDraftChange={(id, draft) => setPriceDrafts((current) => ({ ...current, [id]: draft }))}
                />
                <p className="mt-3 text-xs text-slate-500">
                  Fill in the details to go live now, or save the catalogue as a draft and add them later.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="border-t border-slate-200 px-6 py-4">
          {step === "details" && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={proceedToProducts} className="bg-brand text-white">Proceed</Button>
            </>
          )}
          {step === "products" && (
            <>
              <Button variant="outline" disabled={saving !== null} onClick={() => setStep("details")}><IconArrowLeft /> Back</Button>
              <Button
                onClick={() => submit(publish)}
                disabled={selected.size === 0 || saving !== null}
                className="bg-brand text-white"
              >
                {saving ? (
                  <><IconLoader2 className="animate-spin" /> Creating…</>
                ) : publish ? (
                  <><IconRocket /> Create and go live</>
                ) : (
                  "Create catalogue"
                )}
              </Button>
            </>
          )}
          {step === "prices" && (
            <>
              <Button variant="outline" disabled={saving !== null} onClick={() => submit(false)}>
                {saving === "draft" ? <><IconLoader2 className="animate-spin" /> Saving…</> : "Save as draft"}
              </Button>
              <Button onClick={savePricesAndPublish} disabled={saving !== null} className="bg-brand text-white">
                {saving === "publish" ? <><IconLoader2 className="animate-spin" /> Publishing…</> : "Save details and go live"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
