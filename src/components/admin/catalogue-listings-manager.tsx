"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Loader2, MoreHorizontal, Package, Plus, Trash2 } from "lucide-react";
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { completeProductsForSale } from "@/app/admin/products/actions";
import { addListings, removeListing, reorderListings, updateListing } from "@/lib/api/listings";
import { getApiErrorMessage } from "@/lib/api/client";
import { money } from "@/lib/utils";
import { needsPricesForSale, PRICE_ON_REQUEST_LABEL } from "@/lib/pricing";
import type { BadgePresetDto } from "@/lib/badges";
import type { ListingRowDto, ProductSearchResult } from "@/lib/schemas/listing";
import { ListingBadgesEditor } from "@/components/admin/listing-badges-editor";
import { ProductEditorDialog, type ProductEditorState } from "@/components/admin/product-editor-dialog";
import { ProductMultiSelect } from "@/components/admin/product-multi-select";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function CatalogueListingsManager({
  catalogueId,
  published,
  rows,
  badgePresets,
}: {
  catalogueId: string;
  /** Live catalogues only accept products with prices and stock. */
  published: boolean;
  rows: ListingRowDto[];
  badgePresets: BadgePresetDto[];
}) {
  const router = useRouter();
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [productEditor, setProductEditor] = useState<ProductEditorState | null>(null);
  const [removing, setRemoving] = useState<ListingRowDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const displayed = useMemo(() => {
    if (!orderOverride) return rows;
    const position = new Map(orderOverride.map((id, index) => [id, index]));
    return [...rows].sort((a, b) => {
      const aPos = position.get(a.listingId) ?? orderOverride.length + a.displayOrder;
      const bPos = position.get(b.listingId) ?? orderOverride.length + b.displayOrder;
      return aPos - bPos;
    });
  }, [rows, orderOverride]);

  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor), useSensor(KeyboardSensor));
  const listingIds = useMemo(() => displayed.map((row) => row.listingId), [displayed]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = listingIds.indexOf(String(active.id));
    const newIndex = listingIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = orderOverride;
    const nextOrder = arrayMove(listingIds, oldIndex, newIndex);
    setOrderOverride(nextOrder);
    reorderListings(catalogueId, nextOrder)
      .then(() => {
        appToast.success("Order saved", "Buyers now see products in this order.");
        router.refresh();
      })
      .catch((error) => {
        setOrderOverride(previous);
        appToast.error("Could not save the order", getApiErrorMessage(error));
      });
  }

  async function toggleVisibility(row: ListingRowDto) {
    setMutatingId(row.listingId);
    try {
      await updateListing(catalogueId, row.listingId, { isVisible: !row.isVisible });
      appToast.success(row.isVisible ? "Product hidden" : "Product visible", row.product.name);
      router.refresh();
    } catch (error) {
      appToast.error("Could not update visibility", getApiErrorMessage(error));
    } finally {
      setMutatingId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await removeListing(catalogueId, removing.listingId);
      appToast.success("Product removed", removing.product.name);
      setRemoving(null);
      router.refresh();
    } catch (error) {
      appToast.error("Could not remove the product", getApiErrorMessage(error));
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold">Products</h2>
          <p className="mt-0.5 text-xs text-slate-500">{rows.length} products · drag to reorder</p>
        </div>
        <Button onClick={() => setAdding(true)} className="bg-brand text-white">
          <Plus /> Manage products
        </Button>
      </div>
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Product</TableHead>
              <TableHead>Offer price</TableHead>
              <TableHead className="hidden md:table-cell">MRP</TableHead>
              <TableHead className="hidden sm:table-cell">Qty</TableHead>
              <TableHead className="hidden lg:table-cell">MOQ</TableHead>
              <TableHead className="hidden md:table-cell">Badges</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead className="w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext items={listingIds} strategy={verticalListSortingStrategy}>
              {displayed.map((row) => (
                <SortableListingRow
                  key={row.listingId}
                  row={row}
                  catalogueId={catalogueId}
                  badgePresets={badgePresets}
                  mutating={mutatingId === row.listingId}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" disabled={busy || mutatingId !== null} aria-label={`Actions for ${row.product.name}`}><MoreHorizontal /></Button>}
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setProductEditor({
                            mode: "edit",
                            row: {
                              id: row.product.id,
                              sku: row.product.sku,
                              name: row.product.name,
                              brand: row.product.brand,
                              category: row.product.category,
                              description: row.product.description,
                              mrp: row.product.mrp,
                              offerPrice: row.product.offerPrice,
                              priceOnRequest: row.product.priceOnRequest,
                              quantity: row.product.quantity,
                              moq: row.product.moq,
                              images: row.product.imageUrls,
                            },
                          })
                        }
                      >
                        <Package /> Edit product
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleVisibility(row)}>
                        {row.isVisible ? <><EyeOff /> Hide from buyers</> : <><Eye /> Show to buyers</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setRemoving(row)} className="text-red-600"><Trash2 /> Remove</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SortableListingRow>
              ))}
            </SortableContext>
            {!displayed.length && (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <p className="text-sm text-slate-500">No products in this catalogue yet.</p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => setAdding(true)}
                  >
                    <Plus /> Add your first products
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DndContext>

      {adding && (
        <ManageProductsDialog
          catalogueId={catalogueId}
          published={published}
          listed={rows.map((row) => ({
            listingId: row.listingId,
            product: {
              id: row.product.id,
              sku: row.product.sku,
              name: row.product.name,
              brand: row.product.brand,
              category: row.product.category,
              image: row.product.imageUrls[0] ?? null,
              mrp: row.product.mrp,
              offerPrice: row.product.offerPrice,
              priceOnRequest: row.product.priceOnRequest,
              quantity: row.product.quantity,
              alreadyListed: true,
            },
          }))}
          onClose={() => setAdding(false)}
          onSaved={(added, removed) => {
            const parts = [
              added ? `${added} added` : null,
              removed ? `${removed} removed` : null,
            ].filter(Boolean);
            appToast.success("Products updated", parts.join(" · ") || "No changes.");
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      {productEditor && (
        <ProductEditorDialog
          key={productEditor.mode === "edit" ? productEditor.row.id : "create"}
          editor={productEditor}
          onClose={() => setProductEditor(null)}
        />
      )}

      <Dialog open={removing !== null} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {removing?.product.name}?</DialogTitle>
            <DialogDescription>
              This removes the product from this catalogue only. It stays in your product library,
              and past enquiries keep their own copy of the details.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button onClick={confirmRemove} disabled={busy} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? <><Loader2 className="animate-spin" /> Removing…</> : "Remove product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function isReadyForSale(product: ProductSearchResult) {
  return !needsPricesForSale(product) && product.quantity > 0;
}

type SaleDraft = { mrp: string; offerPrice: string; quantity: string };

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function parseStock(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ManageProductsDialog({
  catalogueId,
  published,
  listed,
  onClose,
  onSaved,
}: {
  catalogueId: string;
  published: boolean;
  listed: { listingId: string; product: ProductSearchResult }[];
  onClose: () => void;
  onSaved: (added: number, removed: number) => void;
}) {
  const [selected, setSelected] = useState<Map<string, ProductSearchResult>>(
    () => new Map(listed.map(({ product }) => [product.id, product])),
  );
  const [phase, setPhase] = useState<"select" | "complete">("select");
  const [drafts, setDrafts] = useState<Record<string, SaleDraft>>({});
  const [saving, setSaving] = useState(false);

  const listedIds = new Set(listed.map(({ product }) => product.id));
  const additions = [...selected.values()].filter((product) => !listedIds.has(product.id));
  const removals = listed.filter(({ product }) => !selected.has(product.id));
  const hasChanges = additions.length > 0 || removals.length > 0;
  const incomplete = additions.filter((product) => !isReadyForSale(product));

  function draftFor(product: ProductSearchResult): SaleDraft {
    return (
      drafts[product.id] ?? {
        mrp: product.mrp !== null ? String(product.mrp) : "",
        offerPrice: product.offerPrice !== null ? String(product.offerPrice) : "",
        quantity: product.quantity > 0 ? String(product.quantity) : "",
      }
    );
  }

  async function applyChanges() {
    setSaving(true);
    try {
      let added = 0;
      if (additions.length) {
        added = await addListings(catalogueId, additions.map(({ id }) => id));
      }
      let removed = 0;
      for (const { listingId } of removals) {
        await removeListing(catalogueId, listingId);
        removed += 1;
      }
      onSaved(added, removed);
    } catch (error) {
      appToast.error("Could not save the changes", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!hasChanges) return;
    // A live catalogue only lists products with prices and stock:
    // collect the missing details first, right here in the flow.
    if (published && incomplete.length > 0) {
      setPhase("complete");
      return;
    }
    await applyChanges();
  }

  async function completeAndApply() {
    const updates: { id: string; mrp: number | null; offerPrice: number | null; quantity: number }[] = [];
    for (const product of incomplete) {
      const draft = draftFor(product);
      const mrp = parseMoney(draft.mrp);
      const offerPrice = product.priceOnRequest ? null : parseMoney(draft.offerPrice);
      const quantity = parseStock(draft.quantity);
      if (quantity === null || (!product.priceOnRequest && (mrp === null || offerPrice === null))) {
        appToast.error(
          "Some details are missing",
          "Every product needs MRP, offer price and a stock quantity above 0.",
        );
        return;
      }
      updates.push({ id: product.id, mrp, offerPrice, quantity });
    }
    setSaving(true);
    try {
      const result = await completeProductsForSale(updates);
      if ("error" in result) {
        appToast.error("Could not save the details", result.error);
        return;
      }
    } finally {
      setSaving(false);
    }
    await applyChanges();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{phase === "select" ? "Manage products" : "Almost there"}</DialogTitle>
          <DialogDescription>
            {phase === "select"
              ? "Ticked products are in this catalogue. Tick to add, untick to remove."
              : `This catalogue is live, so ${incomplete.length === 1 ? "this product needs" : "these products need"} prices and stock before buyers can see ${incomplete.length === 1 ? "it" : "them"}.`}
          </DialogDescription>
        </DialogHeader>
        {phase === "select" ? (
          <ProductMultiSelect catalogueId={catalogueId} selected={selected} onChange={setSelected} />
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1fr)_88px_88px_76px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Product</span>
              <span>MRP (₹)</span>
              <span>Offer (₹)</span>
              <span>Stock</span>
            </div>
            {incomplete.map((product) => {
              const draft = draftFor(product);
              return (
                <div
                  key={product.id}
                  className="grid grid-cols-[minmax(0,1fr)_88px_88px_76px] items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="truncate font-mono text-xs text-slate-500">{product.sku}</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.mrp}
                    onChange={(event) => setDrafts((current) => ({ ...current, [product.id]: { ...draft, mrp: event.target.value } }))}
                    aria-label={`MRP for ${product.name}`}
                    placeholder="Add"
                    className="h-8 px-2 text-sm tabular-nums"
                  />
                  {product.priceOnRequest ? (
                    <span className="truncate text-xs text-slate-500">{PRICE_ON_REQUEST_LABEL}</span>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.offerPrice}
                      onChange={(event) => setDrafts((current) => ({ ...current, [product.id]: { ...draft, offerPrice: event.target.value } }))}
                      aria-label={`Offer price for ${product.name}`}
                      placeholder="Add"
                      className="h-8 px-2 text-sm tabular-nums"
                    />
                  )}
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={draft.quantity}
                    onChange={(event) => setDrafts((current) => ({ ...current, [product.id]: { ...draft, quantity: event.target.value } }))}
                    aria-label={`Stock for ${product.name}`}
                    placeholder="Add"
                    className="h-8 px-2 text-sm tabular-nums"
                  />
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter className="sm:justify-between">
          {phase === "select" ? (
            <>
              <p className="self-center text-xs text-slate-500">
                {hasChanges
                  ? [
                      additions.length ? `Adding ${additions.length}` : null,
                      removals.length ? `Removing ${removals.length}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "No changes yet."}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                  type="button"
                  onClick={submit}
                  disabled={saving || !hasChanges}
                  className="bg-brand text-white"
                >
                  {saving ? <><IconLoader2 className="animate-spin" /> Saving…</> : "Save changes"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setPhase("select")} disabled={saving}>Back</Button>
              <Button type="button" onClick={completeAndApply} disabled={saving} className="bg-brand text-white">
                {saving ? (
                  <><IconLoader2 className="animate-spin" /> Saving…</>
                ) : (
                  "Save details and apply changes"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableListingRow({
  row,
  catalogueId,
  badgePresets,
  mutating = false,
  children,
}: {
  row: ListingRowDto;
  catalogueId: string;
  badgePresets: BadgePresetDto[];
  mutating?: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, transform, transition, setNodeRef, isDragging } = useSortable({ id: row.listingId });

  return (
    <TableRow
      ref={setNodeRef}
      data-dragging={isDragging}
      data-mutating={mutating}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 data-[mutating=true]:opacity-60"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TableCell>
        <Button
          {...attributes}
          {...listeners}
          variant="ghost"
          size="icon-sm"
          className="size-7 cursor-grab text-slate-400 hover:bg-transparent"
        >
          <GripVertical className="size-3.5" />
          <span className="sr-only">Drag to reorder</span>
        </Button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            {row.product.imageUrls[0] && (
              <Image src={row.product.imageUrls[0]} alt="" fill sizes="40px" className="object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.product.name}</p>
            <p className="truncate text-xs text-slate-500">{[row.product.brand, row.product.sku].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="font-medium">
        {row.product.priceOnRequest ? (
          <span className="text-slate-500">{PRICE_ON_REQUEST_LABEL}</span>
        ) : row.product.offerPrice !== null ? (
          money(row.product.offerPrice)
        ) : (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            <IconAlertTriangle className="size-3" /> No price
          </Badge>
        )}
      </TableCell>
      <TableCell className="hidden text-slate-500 md:table-cell">
        {row.product.mrp !== null ? money(row.product.mrp) : <span className="text-slate-400">Not set</span>}
      </TableCell>
      <TableCell className="hidden tabular-nums sm:table-cell">{row.product.quantity.toLocaleString("en-IN")}</TableCell>
      <TableCell className="hidden tabular-nums lg:table-cell">{row.product.moq.toLocaleString("en-IN")}</TableCell>
      <TableCell className="hidden md:table-cell">
        <ListingBadgesEditor
          catalogueId={catalogueId}
          row={row}
          presets={badgePresets}
          disabled={mutating}
        />
      </TableCell>
      <TableCell>
        {mutating ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="size-3.5 animate-spin" /> Updating…
          </span>
        ) : (
          <Badge variant="outline" className={row.isVisible ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}>
            {row.isVisible ? "Visible" : "Hidden"}
          </Badge>
        )}
      </TableCell>
      <TableCell>{children}</TableCell>
    </TableRow>
  );
}
