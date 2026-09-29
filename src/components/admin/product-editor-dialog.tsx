"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  createProduct,
  duplicateProduct,
  updateProduct,
  updateProductStocks,
  type ProductInput,
} from "@/app/admin/products/actions";
import { CategorySelect } from "@/components/admin/category-select";
import type { CityOption } from "@/components/admin/city-search";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  StockCityEditor,
  stockRowsTotal,
  type StockRowEdit,
} from "@/components/admin/stock-city-editor";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { OFFER_PRICE_REQUIRED_MESSAGE, PRICE_ON_REQUEST_LABEL } from "@/lib/pricing";
import { countRichText, descriptionLimitError } from "@/lib/rich-text";
import { PRODUCT_NAME_MAX_LENGTH } from "@/lib/schemas/product";

export type ProductEditorRow = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string;
  mrp: number | null;
  offerPrice: number | null;
  priceOnRequest: boolean;
  quantity: number;
  moq: number;
  images: string[];
  /** Per-city stock. Omit when unknown to the caller; the stock-by-city
   * editor is then hidden and the server keeps derived totals safe. */
  stocks?: (CityOption & { quantity: number })[];
};

export type ProductEditorState =
  | { mode: "create" }
  | { mode: "edit"; row: ProductEditorRow }
  | { mode: "duplicate"; row: ProductEditorRow };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      {children}
    </p>
  );
}

// Render with a key derived from the mode and row id so images and
// defaultValues reset correctly between create, edit and duplicate modes.
export function ProductEditorDialog({
  editor,
  onClose,
  onSaved,
  knownCities = [],
}: {
  editor: ProductEditorState;
  onClose: () => void;
  onSaved?: () => void;
  /** Cities already in use, suggested by the stock-by-city picker. */
  knownCities?: CityOption[];
}) {
  const router = useRouter();

  // Create has no source. Edit and duplicate both use the selected row to
  // populate the form.
  const sourceRow = editor.mode === "create" ? null : editor.row;

  // Only edit mode may update the existing product and its city stock rows.
  const editingRow = editor.mode === "edit" ? editor.row : null;
  const isDuplicate = editor.mode === "duplicate";

  const [images, setImages] = useState<string[]>(sourceRow?.images ?? []);
  const [category, setCategory] = useState(sourceRow?.category ?? "");
  const [brand, setBrand] = useState(sourceRow?.brand ?? "");
  const [description, setDescription] = useState(sourceRow?.description ?? "");
  const [nameLength, setNameLength] = useState((sourceRow?.name ?? "").length);
  const [priceOnRequest, setPriceOnRequest] = useState(
    sourceRow?.priceOnRequest ?? false,
  );

  const offerPriceRequired = !priceOnRequest;

  const descriptionError = descriptionLimitError(countRichText(description));

  // Stock-by-city rows are only editable when updating an existing product.
  // Duplication copies the total quantity, not the related city records.
  const stocksKnown = editingRow?.stocks !== undefined;
  const [stockRows, setStockRows] = useState<StockRowEdit[]>(
    editingRow?.stocks?.map((stock) => ({
      placeId: stock.placeId,
      name: stock.name,
      region: stock.region,
      quantity: String(stock.quantity),
    })) ?? [],
  );

  const located = stockRows.length > 0;
  const [pending, startTransition] = useTransition();

  function stocksChanged() {
    const original = editingRow?.stocks ?? [];

    if (stockRows.length !== original.length) return true;

    const saved = new Map(
      original.map((stock) => [stock.placeId, stock.quantity]),
    );

    return stockRows.some((row) => {
      const parsed = Number.parseInt(row.quantity, 10);
      const quantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

      return saved.get(row.placeId) !== quantity;
    });
  }

  function submitEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (descriptionError) {
      appToast.error("Could not save the product", descriptionError);
      return;
    }

    const form = new FormData(event.currentTarget);

    const priceOf = (field: string) => {
      const raw = String(form.get(field) ?? "").trim();

      if (!raw) return null;

      const value = Number(raw);

      return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
    };

    const intOf = (field: string, fallback: number) => {
      const raw = String(form.get(field) ?? "").trim();
      const value = Number.parseInt(raw, 10);

      return Number.isFinite(value) ? value : fallback;
    };

    const input: ProductInput = {
      sku: String(form.get("sku") ?? ""),
      name: String(form.get("name") ?? ""),
      brand: brand.trim(),
      category: category.trim(),
      description,
      mrp: priceOf("mrp"),
      offerPrice: priceOnRequest ? null : priceOf("offerPrice"),
      priceOnRequest,
      quantity: located
        ? stockRowsTotal(stockRows)
        : intOf("quantity", sourceRow?.quantity ?? 0),
      moq: intOf("moq", 1),
      imageUrls: images,
    };

    if (offerPriceRequired && input.offerPrice === null) {
      appToast.error("Could not save the product", OFFER_PRICE_REQUIRED_MESSAGE);
      return;
    }

    startTransition(async () => {
      // City rows are updated only when editing an existing product.
      if (editor.mode === "edit" && stocksKnown && stocksChanged()) {
        const stockResult = await updateProductStocks([
          {
            id: editor.row.id,
            stocks: stockRows.map((row) => {
              const parsed = Number.parseInt(row.quantity, 10);

              return {
                city: {
                  placeId: row.placeId,
                  name: row.name,
                  region: row.region,
                },
                quantity: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
              };
            }),
          },
        ]);

        if ("error" in stockResult) {
          appToast.error("Could not save the stock", stockResult.error ?? "");
          return;
        }
      }

      // Duplicate and create modes create a new database product.
      // Only edit mode updates the original product.
      const result =
        editor.mode === "edit"
          ? await updateProduct(editor.row.id, input)
          : editor.mode === "duplicate"
            ? await duplicateProduct(editor.row.id, input)
            : await createProduct(input);

      if (result.error) {
        appToast.error("Could not save the product", result.error);
        return;
      }

      appToast.success(
        editor.mode === "edit"
          ? "Product updated"
          : isDuplicate
            ? "Product duplicated"
            : "Product created",
        input.name,
      );

      onClose();
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle>
            {editor.mode === "edit"
              ? "Edit product"
              : isDuplicate
                ? "Duplicate product"
                : "Add product"}
          </DialogTitle>

          <DialogDescription>
            {editor.mode === "edit"
              ? "Changes appear everywhere this product is shown."
              : isDuplicate
                ? "Review the copied details and enter a new SKU."
                : "Add it once, then use it in as many catalogues as you like."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={submitEditor}
          className="flex min-h-0 flex-1 flex-col"
          id="product-editor-form"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-3">
              <SectionLabel>Basics</SectionLabel>

              <div>
                <Label htmlFor="product-name">Name *</Label>
                <Input
                  id="product-name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={PRODUCT_NAME_MAX_LENGTH}
                  defaultValue={sourceRow?.name ?? ""}
                  onChange={(event) => setNameLength(event.target.value.length)}
                  className="mt-1.5"
                  placeholder="Atlas cabin trolley"
                />
                {nameLength >= PRODUCT_NAME_MAX_LENGTH && (
                  <p className="mt-1 text-xs text-red-600">
                    Maximum {PRODUCT_NAME_MAX_LENGTH} characters allowed.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="product-sku">SKU *</Label>
                  <Input
                    id="product-sku"
                    name="sku"
                    required
                    maxLength={60}
                    defaultValue={isDuplicate ? "" : (sourceRow?.sku ?? "")}
                    className="mt-1.5"
                    placeholder="Enter a unique SKU"
                  />
                </div>

                <div>
                  <Label htmlFor="product-brand">Brand</Label>
                  <div className="mt-1.5">
                    <CategorySelect
                      kind="brand"
                      id="product-brand"
                      value={brand}
                      onChange={setBrand}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="product-category">Category</Label>
                  <div className="mt-1.5">
                    <CategorySelect
                      kind="product"
                      id="product-category"
                      value={category}
                      onChange={setCategory}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <SectionLabel>Pricing and stock</SectionLabel>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <Label htmlFor="product-mrp">MRP (₹)</Label>
                  <Input
                    id="product-mrp"
                    name="mrp"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={sourceRow?.mrp ?? ""}
                    className="mt-1.5"
                    placeholder="Add later"
                  />
                </div>

                <div>
                  <Label htmlFor="product-offer">
                    Offer price (₹){offerPriceRequired ? " *" : ""}
                  </Label>
                  {priceOnRequest ? (
                    <Input
                      key="offer-on-request"
                      id="product-offer"
                      disabled
                      value={PRICE_ON_REQUEST_LABEL}
                      className="mt-1.5"
                      aria-label="Offer price hidden from buyers"
                    />
                  ) : (
                    <Input
                      key="offer-price"
                      id="product-offer"
                      name="offerPrice"
                      type="number"
                      required={offerPriceRequired}
                      min={0}
                      step="0.01"
                      defaultValue={sourceRow?.offerPrice ?? ""}
                      className="mt-1.5"
                      placeholder="Enter offer price"
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="product-quantity">Quantity</Label>

                  {located ? (
                    <Input
                      id="product-quantity"
                      disabled
                      value={stockRowsTotal(stockRows)}
                      className="mt-1.5"
                      aria-label="Total quantity across cities"
                    />
                  ) : (
                    <Input
                      id="product-quantity"
                      name="quantity"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={sourceRow?.quantity ?? 0}
                      className="mt-1.5"
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="product-moq">MOQ</Label>
                  <Input
                    id="product-moq"
                    name="moq"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={sourceRow?.moq ?? 1}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <Label
                  htmlFor="product-price-on-request"
                  className="flex items-start gap-2.5 font-normal"
                >
                  <Checkbox
                    id="product-price-on-request"
                    checked={priceOnRequest}
                    onCheckedChange={(checked) => setPriceOnRequest(checked === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-700">
                      {PRICE_ON_REQUEST_LABEL}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                      {priceOnRequest
                        ? `Buyers see “${PRICE_ON_REQUEST_LABEL}” instead of an offer price, and no discount is shown. Saving clears any offer price on this product.`
                        : "Hide the offer price from buyers and ask them to enquire for bulk pricing."}
                    </span>
                  </span>
                </Label>
              </div>

              {editor.mode === "edit" && stocksKnown && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Stock by city
                  </p>

                  <StockCityEditor
                    rows={stockRows}
                    onChange={setStockRows}
                    knownCities={knownCities}
                    firstRowQuantity={editingRow?.quantity ?? 0}
                  />

                  <p className="mt-2 text-[11px] leading-4 text-slate-400">
                    {located
                      ? "The quantity above is the sum of these cities."
                      : "Add a city to split this stock by location."}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionLabel>Photos</SectionLabel>
              <PhotoUploader images={images} onChange={setImages} />
            </div>

            <div className="space-y-3">
              <SectionLabel>Description</SectionLabel>
              <RichTextEditor
                id="product-description"
                value={sourceRow?.description ?? ""}
                onChange={setDescription}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={pending || descriptionError !== null}
              className="bg-brand text-white"
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : isDuplicate ? (
                "Create duplicate"
              ) : (
                "Save product"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
