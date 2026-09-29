"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  ImageOff,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  IconAlertTriangle,
  IconArchive,
  IconArchiveOff,
  IconCategory,
  IconDeviceFloppy,
  IconFileSpreadsheet,
  IconMapPin,
  IconMapPinOff,
  IconTag,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  archiveProducts,
  assignProductsToCity,
  deleteProduct,
  deleteProducts,
  restoreProducts,
  setProductsCategory,
  updateProductPrices,
  updateProductStocks,
  type ProductStockUpdate,
} from "@/app/admin/products/actions";
import { Badge } from "@/components/ui/badge";
import { ActionDock, type DockAction } from "@/components/admin/action-dock";
import { CategorySelect } from "@/components/admin/category-select";
import { CitySearch, type CityOption } from "@/components/admin/city-search";
import {
  ManageCategoriesDialog,
  type CategorySummary,
} from "@/components/admin/manage-categories-dialog";
import { StockCell, type StockEdit } from "@/components/admin/stock-cell";
import { ImportProductsDialog } from "@/components/admin/import-products-dialog";
import {
  ProductEditorDialog,
  type ProductEditorState,
} from "@/components/admin/product-editor-dialog";
import { ProductViewDialog } from "@/components/admin/product-view-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import { needsPricesForSale, PRICE_ON_REQUEST_LABEL } from "@/lib/pricing";

const PAGE_SIZES = [10, 25, 50, 100] as const;

function pageItems(current: number, count: number): (number | "ellipsis")[] {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index);
  const wanted = [...new Set([0, count - 1, current - 1, current, current + 1])]
    .filter((page) => page >= 0 && page < count)
    .sort((a, b) => a - b);
  const items: (number | "ellipsis")[] = [];
  wanted.forEach((page, index) => {
    if (index > 0 && page - wanted[index - 1] > 1) items.push("ellipsis");
    items.push(page);
  });
  return items;
}

export type ProductStockRow = CityOption & { quantity: number };

export type AdminProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string;
  images: string[];
  mrp: number | null;
  offerPrice: number | null;
  priceOnRequest: boolean;
  quantity: number;
  moq: number;
  attributes: Record<string, string>;
  catalogues: number;
  archived: boolean;
  /** Per-city stock; empty for unlocated products. */
  stocks: ProductStockRow[];
};

type PriceEdit = { mrp: string; offerPrice: string };

function parseQuantity(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function toStockEdit(row: AdminProductRow): StockEdit {
  return {
    rows: row.stocks.length
      ? row.stocks.map((stock) => ({
          placeId: stock.placeId,
          name: stock.name,
          region: stock.region,
          quantity: String(stock.quantity),
        }))
      : null,
    quantity: String(row.quantity),
  };
}

function isStockDirty(row: AdminProductRow, edit: StockEdit) {
  if (edit.rows === null) return parseQuantity(edit.quantity) !== row.quantity;
  if (edit.rows.length !== row.stocks.length) return true;
  const saved = new Map(
    row.stocks.map((stock) => [stock.placeId, stock.quantity]),
  );
  return edit.rows.some(
    (stockRow) =>
      saved.get(stockRow.placeId) !== parseQuantity(stockRow.quantity),
  );
}

function toStockUpdate(id: string, edit: StockEdit): ProductStockUpdate {
  if (edit.rows === null) {
    return { id, stocks: null, quantity: parseQuantity(edit.quantity) };
  }
  return {
    id,
    stocks: edit.rows.map((stockRow) => ({
      city: {
        placeId: stockRow.placeId,
        name: stockRow.name,
        region: stockRow.region,
      },
      quantity: parseQuantity(stockRow.quantity),
    })),
  };
}

/** What the row should look like once the server reflects this update; the
 * stock cell shows a skeleton until it does. */
function awaitedStock(
  update: ProductStockUpdate,
  row: AdminProductRow | undefined,
) {
  const quantity =
    update.stocks === null
      ? (update.quantity ?? row?.quantity ?? 0)
      : update.stocks.length
        ? update.stocks.reduce((sum, stock) => sum + stock.quantity, 0)
        : (row?.quantity ?? 0);
  return { quantity, cities: update.stocks?.length ?? 0 };
}

function toInput(value: number | null) {
  return value !== null ? String(value) : "";
}

function parseInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

export function ProductsTable({
  rows,
  initialViewId,
}: {
  rows: AdminProductRow[];
  /** Product id from a ?view= deep link (e.g. global search); opens its view modal. */
  initialViewId?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [missingOnly, setMissingOnly] = useState(false);
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editor, setEditor] = useState<ProductEditorState | null>(null);
  const [viewing, setViewing] = useState<AdminProductRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<AdminProductRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Price and stock edits are keyed by product id so they survive searching
  // and paging.
  const [edits, setEdits] = useState<Record<string, PriceEdit>>({});
  const [stockEdits, setStockEdits] = useState<Record<string, StockEdit>>({});
  const [saving, setSaving] = useState(false);
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">(
    "active",
  );
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCity, setAssignCity] = useState<CityOption | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryValue, setCategoryValue] = useState("");
  // Rows waiting for the archive confirm dialog (single row or dock selection).
  const [archiving, setArchiving] = useState<AdminProductRow[] | null>(null);
  // Saved values we are waiting to see reflected in fresh server data;
  // the affected cells show skeletons until then.
  const [awaiting, setAwaiting] = useState<
    Record<string, { mrp: number | null; offerPrice: number | null }>
  >({});
  const [awaitingStock, setAwaitingStock] = useState<
    Record<string, { quantity: number; cities: number }>
  >({});
  const [pending, startTransition] = useTransition();

  // The sticky table header sits right below the sticky toolbar, whose height
  // varies as the filter row wraps; measure it instead of hardcoding.
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const observer = new ResizeObserver(() =>
      setToolbarHeight(toolbar.offsetHeight),
    );
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  const rowById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );

  // Deep link: open the view modal once per initialViewId (adjusted during render,
  // so navigating here from the global search always opens the right product).
  const [consumedViewId, setConsumedViewId] = useState<string | null>(null);
  if (initialViewId && initialViewId !== consumedViewId) {
    setConsumedViewId(initialViewId);
    const row = rowById.get(initialViewId);
    if (row) setViewing(row);
  }

  // A row is "refreshing" from the moment prices are saved until the fresh
  // server data reflects them; its price cells show skeletons meanwhile.
  function isRefreshing(row: AdminProductRow) {
    const saved = awaiting[row.id];
    return (
      saved !== undefined &&
      (row.mrp !== saved.mrp || row.offerPrice !== saved.offerPrice)
    );
  }

  const dirtyIds = useMemo(() => {
    const ids: string[] = [];
    for (const [id, edit] of Object.entries(edits)) {
      const row = rowById.get(id);
      if (!row) continue;
      if (
        parseInput(edit.mrp) !== row.mrp ||
        parseInput(edit.offerPrice) !== row.offerPrice
      ) {
        ids.push(id);
      }
    }
    return ids;
  }, [edits, rowById]);

  const dirtyStockIds = useMemo(() => {
    const ids: string[] = [];
    for (const [id, edit] of Object.entries(stockEdits)) {
      const row = rowById.get(id);
      if (!row) continue;
      if (isStockDirty(row, edit)) ids.push(id);
    }
    return ids;
  }, [stockEdits, rowById]);

  const dirtyCount = dirtyIds.length + dirtyStockIds.length;

  // A reload with unsaved edits silently discards them; make the browser ask.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  // Dock counters and filter options reason about the working library only.
  const activeRows = useMemo(() => rows.filter((row) => !row.archived), [rows]);

  const missingCount = useMemo(
    () => activeRows.filter((row) => needsPricesForSale(row)).length,
    [activeRows],
  );

  const unlocatedCount = useMemo(
    () =>
      activeRows.filter((row) => row.quantity > 0 && row.stocks.length === 0)
        .length,
    [activeRows],
  );

  // Cities in use across the library: filter options and picker suggestions.
  const cityOptions = useMemo(() => {
    const cities = new Map<string, CityOption>();
    for (const row of activeRows) {
      for (const stock of row.stocks) {
        if (!cities.has(stock.placeId)) {
          cities.set(stock.placeId, {
            placeId: stock.placeId,
            name: stock.name,
            region: stock.region,
          });
        }
      }
    }
    return [...cities.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeRows]);

  const brandOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.brand)
            .filter((brand): brand is string => Boolean(brand)),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  // Categories in use across the whole library (archived included), with
  // counts for the manage dialog.
  const categorySummaries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.category) continue;
      counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]): CategorySummary => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const categoryOptions = useMemo(
    () => categorySummaries.map((category) => category.name),
    [categorySummaries],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if ((statusFilter === "archived") !== row.archived) return false;
      if (missingOnly && !needsPricesForSale(row)) return false;
      if (brandFilter !== "all" && row.brand !== brandFilter) return false;
      if (categoryFilter !== "all" && row.category !== categoryFilter)
        return false;
      if (locationFilter === "unlocated") {
        if (row.quantity <= 0 || row.stocks.length > 0) return false;
      } else if (locationFilter === "multi") {
        if (row.stocks.length < 2) return false;
      } else if (locationFilter !== "all") {
        if (!row.stocks.some((stock) => stock.placeId === locationFilter))
          return false;
      }
      if (!needle) return true;
      return [row.name, row.sku, row.brand, row.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [
    query,
    rows,
    missingOnly,
    brandFilter,
    categoryFilter,
    locationFilter,
    statusFilter,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.id)),
    [rows, selected],
  );
  const allPagedSelected =
    paged.length > 0 && paged.every((row) => selected.has(row.id));
  const somePagedSelected = paged.some((row) => selected.has(row.id));

  function editFor(row: AdminProductRow): PriceEdit {
    return (
      edits[row.id] ?? {
        mrp: toInput(row.mrp),
        offerPrice: toInput(row.offerPrice),
      }
    );
  }

  function setEdit(row: AdminProductRow, edit: PriceEdit) {
    setEdits((current) => ({ ...current, [row.id]: edit }));
  }

  function stockEditFor(row: AdminProductRow): StockEdit {
    return stockEdits[row.id] ?? toStockEdit(row);
  }

  function setStockEdit(row: AdminProductRow, edit: StockEdit) {
    setStockEdits((current) => ({ ...current, [row.id]: edit }));
  }

  // A row's stock cell is "refreshing" from save until the fresh server data
  // reflects the new total and city count.
  function isStockRefreshing(row: AdminProductRow) {
    const saved = awaitingStock[row.id];
    return (
      saved !== undefined &&
      (row.quantity !== saved.quantity || row.stocks.length !== saved.cities)
    );
  }

  function saveChanges() {
    const priceUpdates = dirtyIds.map((id) => {
      const edit = edits[id];
      return {
        id,
        mrp: parseInput(edit.mrp),
        offerPrice: parseInput(edit.offerPrice),
      };
    });
    const stockUpdates: ProductStockUpdate[] = dirtyStockIds.map((id) =>
      toStockUpdate(id, stockEdits[id]),
    );
    if (!priceUpdates.length && !stockUpdates.length) return;
    setSaving(true);
    startTransition(async () => {
      const savedIds = new Set<string>();
      let hadError = false;
      if (priceUpdates.length) {
        const result = await updateProductPrices(priceUpdates);
        if ("error" in result) {
          appToast.error("Could not save the prices", result.error);
          hadError = true;
        } else {
          priceUpdates.forEach((update) => savedIds.add(update.id));
          setEdits({});
          setAwaiting((current) => ({
            ...current,
            ...Object.fromEntries(
              priceUpdates.map((update) => [
                update.id,
                { mrp: update.mrp, offerPrice: update.offerPrice },
              ]),
            ),
          }));
        }
      }
      if (stockUpdates.length) {
        const result = await updateProductStocks(stockUpdates);
        if ("error" in result) {
          appToast.error("Could not save the stock", result.error);
          hadError = true;
        } else {
          stockUpdates.forEach((update) => savedIds.add(update.id));
          setStockEdits({});
          setAwaitingStock((current) => ({
            ...current,
            ...Object.fromEntries(
              stockUpdates.map((update) => [
                update.id,
                awaitedStock(update, rowById.get(update.id)),
              ]),
            ),
          }));
        }
      }
      setSaving(false);
      if (savedIds.size) {
        if (!hadError) {
          appToast.success(
            "Changes saved",
            `${savedIds.size} ${savedIds.size === 1 ? "product" : "products"} updated.`,
          );
        }
        router.refresh();
      }
    });
  }

  /** Saves one product's stock straight from its popover. */
  function saveRowStock(row: AdminProductRow) {
    const edit = stockEdits[row.id];
    if (!edit || !isStockDirty(row, edit)) return;
    const update = toStockUpdate(row.id, edit);
    setSavingStockId(row.id);
    startTransition(async () => {
      const result = await updateProductStocks([update]);
      setSavingStockId(null);
      if ("error" in result) {
        appToast.error("Could not save the stock", result.error);
        return;
      }
      setStockEdits((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setAwaitingStock((current) => ({
        ...current,
        [row.id]: awaitedStock(update, row),
      }));
      appToast.success("Stock saved", row.name);
      router.refresh();
    });
  }

  function confirmArchive() {
    if (!archiving?.length) return;
    const ids = archiving.map((row) => row.id);
    startTransition(async () => {
      const result = await archiveProducts(ids);
      if ("error" in result) {
        appToast.error("Could not archive", result.error);
        return;
      }
      appToast.success(
        "Archived",
        `${result.archived} product${result.archived === 1 ? "" : "s"} archived${
          result.listingsRemoved
            ? `, removed from ${result.listingsRemoved} catalogue listing${result.listingsRemoved === 1 ? "" : "s"}`
            : ""
        }.`,
      );
      setSelected((previous) => {
        const next = new Set(previous);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setArchiving(null);
      router.refresh();
    });
  }

  function restoreRow(row: AdminProductRow) {
    startTransition(async () => {
      const result = await restoreProducts([row.id]);
      if ("error" in result) {
        appToast.error("Could not restore", result.error);
        return;
      }
      appToast.success(
        "Product restored",
        `${row.name} is back in the library, unlisted.`,
      );
      router.refresh();
    });
  }

  function confirmAssignCity() {
    if (!assignCity) return;
    const ids = selectedRows.map((row) => row.id);
    if (!ids.length) return;
    startTransition(async () => {
      const result = await assignProductsToCity(ids, assignCity);
      if ("error" in result) {
        appToast.error("Could not assign the city", result.error);
        return;
      }
      if (result.skipped) {
        appToast.error(
          `${result.skipped} product${result.skipped === 1 ? "" : "s"} skipped`,
          "Products already split by city keep their breakdown.",
        );
      }
      if (result.assigned) {
        appToast.success(
          "City assigned",
          `${result.assigned} product${result.assigned === 1 ? "" : "s"} now stocked in ${assignCity.name}.`,
        );
      }
      setSelected(new Set());
      setAssignOpen(false);
      setAssignCity(null);
      router.refresh();
    });
  }

  function confirmSetCategory() {
    const ids = selectedRows.map((row) => row.id);
    if (!ids.length) return;
    const category = categoryValue.trim() || null;
    startTransition(async () => {
      const result = await setProductsCategory(ids, category);
      if ("error" in result) {
        appToast.error("Could not set the category", result.error);
        return;
      }
      appToast.success(
        "Category updated",
        `${result.updated} product${result.updated === 1 ? "" : "s"} ${
          category ? `moved to ${category}` : "now without a category"
        }.`,
      );
      setSelected(new Set());
      setCategoryOpen(false);
      setCategoryValue("");
      router.refresh();
    });
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      paged.forEach((row) => {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      });
      return next;
    });
  }

  function exportCsv() {
    downloadCsv("surpluss-products.csv", [
      [
        "SKU",
        "Name",
        "Brand",
        "Category",
        "MRP",
        "Offer price",
        "Quantity",
        "MOQ",
        "Locations",
        "Catalogues",
      ],
      ...filtered.map((row) => [
        row.sku,
        row.name,
        row.brand ?? "",
        row.category ?? "",
        row.mrp !== null ? String(row.mrp) : "",
        row.offerPrice !== null ? String(row.offerPrice) : "",
        String(row.quantity),
        String(row.moq),
        row.stocks.map((stock) => `${stock.name}:${stock.quantity}`).join("; "),
        String(row.catalogues),
      ]),
    ]);
    appToast.success(
      "Products exported",
      `${filtered.length} records downloaded as CSV.`,
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteProduct(deleting.id);
      if (result.error) {
        appToast.error("Could not delete the product", result.error);
        return;
      }
      appToast.success("Product deleted", deleting.name);
      toggleRow(deleting.id, false);
      setDeleting(null);
      router.refresh();
    });
  }

  function confirmBulkDelete() {
    const ids = selectedRows.map((row) => row.id);
    if (!ids.length) return;
    startTransition(async () => {
      const result = await deleteProducts(ids);
      if (result.error) {
        appToast.error("Could not delete the products", result.error);
        return;
      }
      if (result.skipped) {
        appToast.error(
          `${result.skipped} product${result.skipped === 1 ? "" : "s"} skipped`,
          "Products listed in a catalogue cannot be deleted. Remove them from all catalogues first.",
        );
      }
      if (result.deleted) {
        appToast.success(
          "Products deleted",
          `${result.deleted} product${result.deleted === 1 ? "" : "s"} removed.`,
        );
      }
      setSelected(new Set());
      setBulkDeleting(false);
      router.refresh();
    });
  }

  const dockActions: DockAction[] = [
    {
      key: "save",
      label: "Save changes",
      shortLabel: "Save",
      icon: <IconDeviceFloppy />,
      tone: "success",
      badge: dirtyCount,
      disabled: dirtyCount === 0,
      loading: saving,
      onClick: saveChanges,
    },
    {
      key: "missing",
      label: missingOnly ? "Show all products" : "Show products missing prices",
      shortLabel: "Warning",
      icon: <IconAlertTriangle />,
      tone: "warning",
      badge: missingCount,
      disabled: missingCount === 0,
      active: missingOnly,
      onClick: () => {
        setMissingOnly((value) => !value);
        setPage(0);
      },
    },
    {
      key: "unlocated",
      label:
        locationFilter === "unlocated"
          ? "Show all products"
          : "Show products without a city",
      shortLabel: "No city",
      icon: <IconMapPinOff />,
      badge: unlocatedCount,
      disabled: unlocatedCount === 0,
      active: locationFilter === "unlocated",
      onClick: () => {
        setLocationFilter((value) =>
          value === "unlocated" ? "all" : "unlocated",
        );
        setPage(0);
      },
    },
    {
      key: "assign",
      label: "Assign a city to selected",
      shortLabel: "Assign",
      icon: <IconMapPin />,
      badge: selectedRows.length,
      disabled: selectedRows.length === 0,
      onClick: () => {
        setAssignCity(null);
        setAssignOpen(true);
      },
    },
    {
      key: "category",
      label: "Set a category for selected",
      shortLabel: "Category",
      icon: <IconTag />,
      badge: selectedRows.length,
      disabled: selectedRows.length === 0,
      onClick: () => {
        setCategoryValue("");
        setCategoryOpen(true);
      },
    },
    {
      key: "archive",
      label: "Archive selected",
      shortLabel: "Archive",
      icon: <IconArchive />,
      badge: selectedRows.filter((row) => !row.archived).length,
      disabled: selectedRows.every((row) => row.archived),
      onClick: () => setArchiving(selectedRows.filter((row) => !row.archived)),
    },
    {
      key: "delete",
      label: "Delete selected",
      shortLabel: "Delete",
      icon: <Trash2 />,
      tone: "danger",
      badge: selectedRows.length,
      disabled: selectedRows.length === 0,
      onClick: () => setBulkDeleting(true),
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setManagingCategories(true)}>
          <IconCategory /> Manage categories
        </Button>
        <Button variant="outline" onClick={() => setImporting(true)}>
          <IconFileSpreadsheet /> Import products
        </Button>
        <Button
          onClick={() => setEditor({ mode: "create" })}
          className="bg-brand text-white"
        >
          <Plus /> Add product
        </Button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div
          ref={toolbarRef}
          className="flex flex-wrap gap-3 border-b border-slate-200 bg-white p-4 md:sticky md:top-0 md:z-30 md:rounded-t-xl"
        >
          <div className="relative max-w-md flex-1 basis-56">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              className="h-9 pl-9"
              placeholder="Search by name, SKU or brand"
            />
          </div>
          {brandOptions.length > 0 && (
            <Select
              items={{
                all: "All",
                ...Object.fromEntries(
                  brandOptions.map((brand) => [brand, brand]),
                ),
              }}
              value={brandFilter}
              onValueChange={(value) => {
                if (!value) return;
                setBrandFilter(String(value));
                setPage(0);
              }}
            >
              <SelectTrigger
                aria-label="Filter by brand"
                className="h-9 bg-white"
              >
                <span className="text-slate-500">Brand</span>
                <SelectValue className="font-medium" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {brandOptions.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {categoryOptions.length > 0 && (
            <Select
              items={{
                all: "All",
                ...Object.fromEntries(
                  categoryOptions.map((category) => [category, category]),
                ),
              }}
              value={categoryFilter}
              onValueChange={(value) => {
                if (!value) return;
                setCategoryFilter(String(value));
                setPage(0);
              }}
            >
              <SelectTrigger
                aria-label="Filter by category"
                className="h-9 bg-white"
              >
                <span className="text-slate-500">Category</span>
                <SelectValue className="font-medium" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            items={{
              all: "All",
              unlocated: "No city yet",
              multi: "Multiple cities",
              ...Object.fromEntries(
                cityOptions.map((city) => [city.placeId, city.name]),
              ),
            }}
            value={locationFilter}
            onValueChange={(value) => {
              if (!value) return;
              setLocationFilter(String(value));
              setPage(0);
            }}
          >
            <SelectTrigger
              aria-label="Filter by location"
              className="h-9 bg-white"
            >
              <span className="text-slate-500">Location</span>
              <SelectValue className="font-medium" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unlocated">No city yet</SelectItem>
              <SelectItem value="multi">Multiple cities</SelectItem>
              {cityOptions.map((city) => (
                <SelectItem key={city.placeId} value={city.placeId}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={{ active: "Active", archived: "Archived" }}
            value={statusFilter}
            onValueChange={(value) => {
              if (value !== "active" && value !== "archived") return;
              setStatusFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger
              aria-label="Filter by status"
              className="h-9 bg-white"
            >
              <span className="text-slate-500">Status</span>
              <SelectValue className="font-medium" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={selectedRows.length === 0}
            onClick={() => {
              setCategoryValue("");
              setCategoryOpen(true);
            }}
            title={
              selectedRows.length === 0
                ? "Select products with the checkboxes first"
                : undefined
            }
          >
            <IconTag />
            <span className="hidden sm:inline">Change category</span>
            {selectedRows.length > 0 && (
              <span className="grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                {selectedRows.length}
              </span>
            )}
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download /> <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
        {/* overflow-visible on md+ so the header can stick to the viewport;
            small screens keep horizontal scrolling (and hide most columns). */}
        <Table containerClassName="md:overflow-x-visible">
          <TableHeader
            className="md:sticky md:z-20 md:bg-white"
            style={{ top: toolbarHeight }}
          >
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all products on this page"
                  checked={allPagedSelected}
                  indeterminate={!allPagedSelected && somePagedSelected}
                  onCheckedChange={(checked) => togglePage(checked === true)}
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="hidden md:table-cell">SKU</TableHead>
              <TableHead className="w-28">MRP (₹)</TableHead>
              <TableHead className="w-28">Offer (₹)</TableHead>
              <TableHead className="hidden sm:table-cell">Stock</TableHead>
              <TableHead className="w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row) => {
              const edit = editFor(row);
              const missing = needsPricesForSale({
                priceOnRequest: row.priceOnRequest,
                mrp: parseInput(edit.mrp),
                offerPrice: parseInput(edit.offerPrice),
              });
              const refreshing = isRefreshing(row);
              return (
                <TableRow
                  key={row.id}
                  data-state={selected.has(row.id) ? "selected" : undefined}
                  className={row.archived ? "opacity-60" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${row.name}`}
                      checked={selected.has(row.id)}
                      onCheckedChange={(checked) =>
                        toggleRow(row.id, checked === true)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative grid size-11 place-items-center overflow-hidden rounded-lg bg-slate-100">
                        {row.images[0] ? (
                          <Image
                            src={row.images[0]}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : (
                          <ImageOff className="size-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium">
                          <button
                            type="button"
                            onClick={() => setViewing(row)}
                            className="focus-ring truncate underline decoration-slate-300 underline-offset-2 transition-colors hover:text-brand hover:decoration-brand"
                          >
                            {row.name}
                          </button>
                          {row.archived && (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"
                            >
                              Archived
                            </Badge>
                          )}
                          {missing && !refreshing && !row.archived && (
                            <IconAlertTriangle
                              className="size-4 shrink-0 text-amber-500"
                              aria-label="Missing prices"
                            />
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {[row.brand, row.category]
                            .filter(Boolean)
                            .join(" · ") || "No brand"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">
                    {row.sku}
                  </TableCell>
                  <TableCell>
                    {refreshing ? (
                      <Skeleton className="h-8 w-24 rounded-md" />
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={edit.mrp}
                        onChange={(event) =>
                          setEdit(row, { ...edit, mrp: event.target.value })
                        }
                        aria-label={`MRP for ${row.name}`}
                        placeholder="Add"
                        className="h-8 w-24 px-2 text-sm tabular-nums"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {refreshing ? (
                      <Skeleton className="h-8 w-24 rounded-md" />
                    ) : row.priceOnRequest ? (
                      <span className="text-xs font-medium text-slate-500">
                        {PRICE_ON_REQUEST_LABEL}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={edit.offerPrice}
                        onChange={(event) =>
                          setEdit(row, {
                            ...edit,
                            offerPrice: event.target.value,
                          })
                        }
                        aria-label={`Offer price for ${row.name}`}
                        placeholder="Add"
                        className="h-8 w-24 px-2 text-sm tabular-nums"
                      />
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {isStockRefreshing(row) ? (
                      <Skeleton className="h-6 w-16 rounded-full" />
                    ) : (
                      <StockCell
                        productName={row.name}
                        edit={stockEditFor(row)}
                        onChange={(edit) => setStockEdit(row, edit)}
                        knownCities={cityOptions}
                        dirty={dirtyStockIds.includes(row.id)}
                        saving={savingStockId === row.id}
                        onSave={() => saveRowStock(row)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${row.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditor({ mode: "edit", row })}
                        >
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setEditor({ mode: "duplicate", row })}
                        >
                          <Copy /> Duplicate
                        </DropdownMenuItem>
                        {row.archived ? (
                          <DropdownMenuItem onClick={() => restoreRow(row)}>
                            <IconArchiveOff /> Restore
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setArchiving([row])}>
                            <IconArchive /> Archive
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeleting(row)}
                          className="text-red-600"
                        >
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {!filtered.length && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-sm text-slate-500"
                >
                  {rows.length
                    ? statusFilter === "archived"
                      ? "No archived products."
                      : missingOnly
                        ? "Every product has prices. Nice work."
                        : "No products match your search."
                    : "No products yet. Add one or import a spreadsheet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Show per page</span>
                <Select
                  items={Object.fromEntries(
                    PAGE_SIZES.map((size) => [String(size), String(size)]),
                  )}
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    if (!value) return;
                    setPageSize(Number(value));
                    setPage(0);
                  }}
                >
                  <SelectTrigger
                    aria-label="Products per page"
                    className="h-8 w-18 bg-white data-[size=default]:h-8"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-slate-500">
                Showing {safePage * pageSize + 1} to{" "}
                {Math.min((safePage + 1) * pageSize, filtered.length)} of{" "}
                {filtered.length} products
              </p>
            </div>
            {pageCount > 1 && (
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={safePage === 0}
                      className={
                        safePage === 0
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        setPage(Math.max(0, safePage - 1));
                      }}
                    />
                  </PaginationItem>
                  {pageItems(safePage, pageCount).map((item, index) =>
                    item === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          href="#"
                          isActive={item === safePage}
                          onClick={(event) => {
                            event.preventDefault();
                            setPage(item);
                          }}
                        >
                          {item + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={safePage >= pageCount - 1}
                      className={
                        safePage >= pageCount - 1
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        setPage(Math.min(pageCount - 1, safePage + 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
      </div>

      {/* Leaves room so the floating dock never covers the last table rows. */}
      <div aria-hidden className="h-20" />
      <ActionDock actions={dockActions} />

      {editor && (
        <ProductEditorDialog
          key={
            editor.mode === "create"
              ? "create"
              : `${editor.mode}-${editor.row.id}`
          }
          editor={editor}
          onClose={() => setEditor(null)}
          knownCities={cityOptions}
        />
      )}

      {viewing && (
        <ProductViewDialog
          key={viewing.id}
          product={viewing}
          onClose={() => {
            setViewing(null);
            // Clean the deep-link param so refreshes don't reopen the modal.
            if (initialViewId) router.replace("/admin/products");
          }}
          onEdit={() => {
            setEditor({ mode: "edit", row: viewing });
            setViewing(null);
          }}
        />
      )}

      {importing && (
        <ImportProductsDialog onClose={() => setImporting(false)} />
      )}

      {managingCategories && (
        <ManageCategoriesDialog
          categories={categorySummaries}
          onClose={() => setManagingCategories(false)}
        />
      )}

      <Dialog
        open={categoryOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCategoryOpen(false);
            setCategoryValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Set a category for {selectedRows.length} product
              {selectedRows.length === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Every selected product moves to this category. Pick an existing
              one, add a new one, or leave it empty to clear the category.
            </DialogDescription>
          </DialogHeader>
          <CategorySelect
            kind="product"
            value={categoryValue}
            onChange={setCategoryValue}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCategoryOpen(false);
                setCategoryValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSetCategory}
              disabled={pending}
              className="bg-brand text-white"
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Saving…
                </>
              ) : categoryValue.trim() ? (
                "Set category"
              ) : (
                "Clear category"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the master record. Products listed in a
              catalogue cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={pending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Deleting…
                </>
              ) : (
                "Delete product"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={archiving !== null}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Archive{" "}
              {archiving?.length === 1
                ? archiving[0].name
                : `${archiving?.length} products`}
              ?
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const listings =
                  archiving?.reduce((sum, row) => sum + row.catalogues, 0) ?? 0;
                return listings > 0
                  ? `This removes ${listings} catalogue listing${listings === 1 ? "" : "s"}, so buyers stop seeing ${archiving?.length === 1 ? "it" : "them"} right away. `
                  : "";
              })()}
              Data, prices and stock are kept. Restore anytime from the Archived
              view; listings are not restored.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiving(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmArchive}
              disabled={pending}
              className="bg-brand text-white"
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Archiving…
                </>
              ) : (
                "Archive"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssignOpen(false);
            setAssignCity(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign {selectedRows.length} product
              {selectedRows.length === 1 ? "" : "s"} to a city
            </DialogTitle>
            <DialogDescription>
              Each product&apos;s current stock becomes that city&apos;s stock.
              Products already split by city are skipped.
            </DialogDescription>
          </DialogHeader>
          {assignCity ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                  <IconMapPin className="size-4 shrink-0 text-brand" />
                  {assignCity.name}
                </p>
                {assignCity.region && (
                  <p className="truncate pl-5.5 text-xs text-slate-400">
                    {assignCity.region}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAssignCity(null)}
                className="shrink-0 text-slate-500"
              >
                Change
              </Button>
            </div>
          ) : (
            <CitySearch
              onSelect={setAssignCity}
              knownCities={cityOptions}
              placeholder="Search for a city"
              autoFocus
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignOpen(false);
                setAssignCity(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAssignCity}
              disabled={!assignCity || pending}
              className="bg-brand text-white"
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Assigning…
                </>
              ) : (
                "Assign city"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDeleting}
        onOpenChange={(open) => {
          if (!open) setBulkDeleting(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete {selectedRows.length} selected product
              {selectedRows.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This permanently removes the master records. Products listed in a
              catalogue will be skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleting(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmBulkDelete}
              disabled={pending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Deleting…
                </>
              ) : (
                `Delete ${selectedRows.length} product${selectedRows.length === 1 ? "" : "s"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
