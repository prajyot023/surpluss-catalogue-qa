"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { IconLayoutGrid, IconLayoutList, IconTag } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import BlurText from "@/components/BlurText";
import SpotlightCard from "@/components/SpotlightCard";
import { apiClient } from "@/lib/api/client";
import { productToItem, trackEcommerce, trackEvent } from "@/lib/analytics";
import { BannerStrip } from "@/components/catalogue/banner-strip";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public-header";
import { CardImageSlider } from "@/components/catalogue/card-image-slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ContactSupplierDialog } from "@/components/catalogue/contact-supplier-dialog";
import { ProductBadges } from "@/components/catalogue/product-badges";
import { ProductCtaRow } from "@/components/catalogue/product-cta-row";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { waHref, WhatsAppIcon } from "@/components/catalogue/whatsapp-cta";
import { SiteFooter } from "@/components/catalogue/site-footer";
import type { CatalogueView, ProductView } from "@/lib/catalogue-queries";
import type { BannerFilter } from "@/lib/schemas/catalogue";
import {
  discountPercent,
  priceLabel,
  PRICE_ON_REQUEST_LABEL,
} from "@/lib/pricing";
import { cn, currencySymbol, money } from "@/lib/utils";

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "discount", label: "Highest discount" },
  { value: "price-asc", label: "Price: Low to high" },
  { value: "price-desc", label: "Price: High to low" },
];

const moqOptions = [
  { value: "any", label: "Any" },
  { value: "10", label: "Up to 10" },
  { value: "25", label: "Up to 25" },
  { value: "50", label: "Up to 50" },
  { value: "100", label: "Up to 100" },
];

const discountOptions = [
  { value: "any", label: "Any" },
  { value: "10", label: "10%+" },
  { value: "25", label: "25%+" },
  { value: "50", label: "50%+" },
  { value: "70", label: "70%+" },
];

function discountOf(product: ProductView) {
  return discountPercent({
    priceOnRequest: product.priceOnRequest,
    mrp: product.mrp,
    offerPrice: product.price,
  });
}

const filterMenuClass =
  "w-auto min-w-(--anchor-width) rounded-xl p-2 shadow-lg ring-slate-900/8";
const filterMenuItemClass =
  "rounded-lg py-2 pr-8 pl-3 text-sm font-medium text-brand focus:bg-slate-50 focus:text-brand";
// Quiet text-style trigger for the desktop filter bar: no border at rest, a soft
// fill on hover/open, and the chevron flips while the menu is open.
const ghostTriggerClass =
  "focus-ring flex h-9 shrink-0 items-center gap-1 rounded-lg border-0 bg-transparent px-2.5 text-sm font-medium text-slate-600 shadow-none transition-colors hover:bg-slate-100 hover:text-brand data-popup-open:bg-slate-100 data-popup-open:text-brand data-[size=default]:h-9 [&_svg]:size-3.5 [&_svg]:text-slate-400 [&_svg]:transition-transform [&_svg]:duration-200 data-popup-open:[&_svg]:rotate-180";

const SORT_VALUES = new Set(sortOptions.map((option) => option.value));
const MOQ_VALUES = new Set(moqOptions.map((option) => option.value));
const DISCOUNT_VALUES = new Set(discountOptions.map((option) => option.value));

export function CatalogueClient({
  catalogue,
  products,
}: {
  catalogue: CatalogueView;
  products: ProductView[];
}) {
  // Filters live in the URL so filtered views are shareable and banners can
  // deep-link into them.
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState(
    () => searchParams.get("category") ?? "All",
  );
  const [sort, setSort] = useState(() => {
    const value = searchParams.get("sort") ?? "featured";
    return SORT_VALUES.has(value) ? value : "featured";
  });
  const [moqMax, setMoqMax] = useState(() => {
    const value = searchParams.get("moq") ?? "any";
    return MOQ_VALUES.has(value) ? value : "any";
  });
  const [minDiscount, setMinDiscount] = useState(() => {
    const value = searchParams.get("discount") ?? "any";
    return DISCOUNT_VALUES.has(value) ? value : "any";
  });
  const [priceBands, setPriceBands] = useState<string[]>(
    () => searchParams.get("price")?.split(",").filter(Boolean) ?? [],
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [serverMatches, setServerMatches] = useState<Set<string> | null>(null);
  const [contacting, setContacting] = useState<ProductView | null>(null);
  // Phone-only choice between a roomy single column and a denser two-column grid.
  const [mobileCols, setMobileCols] = useState<1 | 2>(2);
  const router = useRouter();
  const gridRef = useRef<HTMLElement | null>(null);

  // One view_item_list per catalogue visit, SPA navigations included.
  useEffect(() => {
    trackEcommerce("view_item_list", {
      item_list_id: catalogue.slug,
      item_list_name: catalogue.title,
    });
  }, [catalogue.slug, catalogue.title]);

  // Mirror the filters into the URL without re-rendering the page.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "All") params.set("category", category);
    if (sort !== "featured") params.set("sort", sort);
    if (moqMax !== "any") params.set("moq", moqMax);
    if (minDiscount !== "any") params.set("discount", minDiscount);
    if (priceBands.length) params.set("price", priceBands.join(","));
    const qs = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [query, category, sort, moqMax, minDiscount, priceBands]);

  // The filter bar stays flat while it rests below the banners and only gains
  // its border and shadow once it is actually pinned under the 56px header.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  function applyBannerFilter(filter: BannerFilter | null) {
    if (filter) {
      setCategory(filter.category ?? "All");
      setSort(
        filter.sort && SORT_VALUES.has(filter.sort) ? filter.sort : "featured",
      );
      setMinDiscount(
        filter.minDiscount && DISCOUNT_VALUES.has(String(filter.minDiscount))
          ? String(filter.minDiscount)
          : "any",
      );
    }
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );
  const categoryItems = useMemo(
    () =>
      categories.map((item) => ({
        value: item,
        label: item === "All" ? "All categories" : item,
      })),
    [categories],
  );
  const priceBandOptions = useMemo(() => {
    const sym = currencySymbol();
    return [
      { value: "lt-300", label: `Under ${sym}300`, min: 0, max: 300 },
      { value: "300-500", label: `${sym}300 to ${sym}500`, min: 300, max: 500 },
      {
        value: "500-1000",
        label: `${sym}500 to ${sym}1,000`,
        min: 500,
        max: 1000,
      },
      {
        value: "1000-2000",
        label: `${sym}1,000 to ${sym}2,000`,
        min: 1000,
        max: 2000,
      },
      { value: "gt-2000", label: `Over ${sym}2,000`, min: 2000, max: Infinity },
    ];
  }, []);
  const sourcingHref = waHref(
    catalogue.whatsappNumber,
    `Hi Surpluss team! I couldn't find what I need in the "${catalogue.title}" catalogue. I'm looking for: `,
  );

  useEffect(() => {
    const needle = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        if (!needle) {
          setServerMatches(null);
          return;
        }
        if (needle.length >= 2) {
          trackEvent("search", {
            search_term: needle,
            item_list_id: catalogue.slug,
          });
        }
        try {
          const response = await apiClient.get<{ ids: string[] }>(
            `/api/catalogues/${catalogue.slug}/search`,
            { params: { q: needle }, signal: controller.signal },
          );
          setServerMatches(new Set(response.data.ids));
        } catch {
          // Aborted or failed: client-side matching below covers the gap.
        }
      },
      needle ? 300 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [catalogue.slug, query]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const maxMoq = moqMax === "any" ? Infinity : Number(moqMax);
    const minDisc = minDiscount === "any" ? 0 : Number(minDiscount);
    const bands = priceBandOptions.filter((band) =>
      priceBands.includes(band.value),
    );
    const filtered = products.filter((product) => {
      const inCategory = category === "All" || product.category === category;
      const inSearch =
        !needle ||
        (serverMatches
          ? serverMatches.has(product.id)
          : [product.name, product.brand, product.sku, product.category]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(needle));
      const inMoq = product.moq <= maxMoq;
      const inDiscount = minDisc === 0 || discountOf(product) >= minDisc;
      const price = product.price;
      const inPrice =
        bands.length === 0 ||
        (price !== null &&
          bands.some((band) => price >= band.min && price < band.max));
      return inCategory && inSearch && inMoq && inDiscount && inPrice;
    });
    switch (sort) {
      case "discount":
        return filtered.sort((a, b) => discountOf(b) - discountOf(a));
      case "price-asc":
        return filtered.sort(
          (a, b) =>
            (a.price ?? Number.POSITIVE_INFINITY) -
            (b.price ?? Number.POSITIVE_INFINITY),
        );
      case "price-desc":
        return filtered.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
      default:
        return filtered;
    }
  }, [
    category,
    minDiscount,
    moqMax,
    priceBandOptions,
    priceBands,
    products,
    query,
    serverMatches,
    sort,
  ]);

  const activeFilters = [
    moqMax !== "any" ? `MOQ under ${moqMax}` : null,
    minDiscount !== "any" ? `${minDiscount}%+ off` : null,
    category !== "All" ? category : null,
    ...priceBandOptions
      .filter((band) => priceBands.includes(band.value))
      .map((band) => band.label),
  ].filter((label): label is string => label !== null);
  const filterChips = [
    query.trim()
      ? { key: "q", label: `"${query.trim()}"`, remove: () => setQuery("") }
      : null,
    category !== "All"
      ? { key: "category", label: category, remove: () => setCategory("All") }
      : null,
    moqMax !== "any"
      ? {
          key: "moq",
          label: `MOQ up to ${moqMax}`,
          remove: () => setMoqMax("any"),
        }
      : null,
    minDiscount !== "any"
      ? {
          key: "discount",
          label: `${minDiscount}%+ off`,
          remove: () => setMinDiscount("any"),
        }
      : null,
    ...priceBandOptions
      .filter((band) => priceBands.includes(band.value))
      .map((band) => ({
        key: `price-${band.value}`,
        label: band.label,
        remove: () => togglePriceBand(band.value),
      })),
  ].filter(
    (chip): chip is { key: string; label: string; remove: () => void } =>
      chip !== null,
  );

  function clearFilters() {
    setQuery("");
    setCategory("All");
    setSort("featured");
    setMoqMax("any");
    setMinDiscount("any");
    setPriceBands([]);
  }

  function clearNarrowFilters() {
    setCategory("All");
    setMoqMax("any");
    setMinDiscount("any");
    setPriceBands([]);
  }

  function trackCardOpen(product: ProductView) {
    trackEcommerce("select_item", {
      item_list_id: catalogue.slug,
      items: [productToItem(product)],
    });
  }

  function togglePriceBand(value: string) {
    setPriceBands((current) =>
      current.includes(value)
        ? current.filter((band) => band !== value)
        : [...current, value],
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader
        activePage="catalogue"
        catalogueSlug={catalogue.slug}
        whatsappNumber={catalogue.whatsappNumber}
        whatsappMessage={`Hi Surpluss team! I'm browsing the "${catalogue.title}" catalogue and would like to know more.`}
      />

      <main>
        <BannerStrip banners={catalogue.banners} onApply={applyBannerFilter} />

        <div ref={sentinelRef} aria-hidden className="h-0" />
        <section
          className={cn(
            "sticky top-14 z-30 border-b transition-[border-color,box-shadow,background-color] duration-300",
            stuck
              ? "border-slate-200 bg-white/95 shadow-md shadow-slate-900/5 backdrop-blur"
              : "border-transparent bg-white",
          )}
        >
          <div className="mx-auto max-w-7xl px-4 py-1.5 sm:px-6 lg:py-2.5">
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <motion.div
                layout
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                className={cn(
                  "relative",
                  searchOpen ? "min-w-0 flex-1" : "shrink-0",
                )}
              >
                {searchOpen ? (
                  <>
                    <Search className="absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onBlur={() => setSearchOpen(false)}
                      placeholder="Search products"
                      className="h-9 w-full rounded-full border-slate-200 bg-slate-50 pl-10 pr-10 shadow-none focus-visible:bg-white"
                    />
                    <button
                      aria-label="Close search"
                      onClick={() => setSearchOpen(false)}
                      className="focus-ring absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <button
                    aria-label="Search products"
                    onClick={() => setSearchOpen(true)}
                    className="focus-ring relative grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500"
                  >
                    <Search className="size-4" />
                    {query.trim() && (
                      <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-gold ring-2 ring-white" />
                    )}
                  </button>
                )}
              </motion.div>
              <AnimatePresence initial={false} mode="popLayout">
                {!searchOpen && (
                  <motion.div
                    key="controls"
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="flex min-w-0 flex-1 gap-2"
                  >
                    <Select
                      items={sortOptions}
                      value={sort}
                      onValueChange={(value) => setSort(String(value))}
                    >
                      <SelectTrigger
                        aria-label="Sort products"
                        className="h-9 min-w-0 flex-1 rounded-lg border-slate-200 bg-white px-3 shadow-none data-[size=default]:h-9"
                      >
                        <span className="text-slate-500">Sort</span>
                        <SelectValue className="truncate font-semibold text-brand" />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        sideOffset={8}
                        className={filterMenuClass}
                      >
                        {sortOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className={filterMenuItemClass}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => setFiltersOpen(true)}
                      className="h-9 shrink-0 rounded-lg border-slate-200 px-3 font-semibold text-brand shadow-none"
                    >
                      <SlidersHorizontal className="size-4 text-slate-500" />
                      Filters
                      {activeFilters.length > 0 && (
                        <span className="grid size-5 place-items-center rounded-md bg-slate-100 text-[11px] font-bold">
                          {activeFilters.length}
                        </span>
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="hidden lg:flex lg:items-center">
              <span className="mr-4 flex shrink-0 items-center gap-2 text-sm font-semibold uppercase text-brand">
                <SlidersHorizontal className="size-4 text-slate-400" />
                Filters
              </span>
              <span className="mr-2 h-4 w-px shrink-0 bg-slate-200" />
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Filter by price"
                  className={ghostTriggerClass}
                >
                  Price
                  {priceBands.length > 0 && (
                    <span className="grid size-4.5 place-items-center rounded-full bg-gold text-[10px] font-bold text-brand">
                      {priceBands.length}
                    </span>
                  )}
                  <ChevronDown />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="min-w-60 rounded-xl p-2 shadow-lg ring-slate-900/8"
                >
                  {priceBandOptions.map((band) => (
                    <DropdownMenuCheckboxItem
                      key={band.value}
                      checked={priceBands.includes(band.value)}
                      onCheckedChange={() => togglePriceBand(band.value)}
                      className="cursor-pointer gap-2.5 rounded-lg px-2 py-2 pr-2 text-sm font-medium text-brand focus:bg-slate-50 focus:text-brand focus:**:text-inherit **:data-[slot=dropdown-menu-checkbox-item-indicator]:hidden"
                    >
                      <Checkbox
                        checked={priceBands.includes(band.value)}
                        tabIndex={-1}
                        className="pointer-events-none data-checked:border-brand! data-checked:bg-brand! [&_svg]:text-white!"
                      />
                      {band.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {priceBands.length > 0 && (
                    <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                      <button
                        type="button"
                        onClick={() => setPriceBands([])}
                        className="focus-ring flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand"
                      >
                        <X className="size-3.5" /> Clear selection
                      </button>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Select
                items={moqOptions}
                value={moqMax}
                onValueChange={(value) => setMoqMax(String(value))}
              >
                <SelectTrigger
                  aria-label="Filter by MOQ"
                  className={ghostTriggerClass}
                >
                  MOQ
                  {moqMax !== "any" && (
                    <SelectValue className="font-semibold text-brand" />
                  )}
                </SelectTrigger>
                <SelectContent
                  align="start"
                  sideOffset={8}
                  className={filterMenuClass}
                >
                  {moqOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className={filterMenuItemClass}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                items={discountOptions}
                value={minDiscount}
                onValueChange={(value) => setMinDiscount(String(value))}
              >
                <SelectTrigger
                  aria-label="Filter by discount"
                  className={ghostTriggerClass}
                >
                  Discount
                  {minDiscount !== "any" && (
                    <SelectValue className="font-semibold text-brand" />
                  )}
                </SelectTrigger>
                <SelectContent
                  align="start"
                  sideOffset={8}
                  className={filterMenuClass}
                >
                  {discountOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className={filterMenuItemClass}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                items={categoryItems}
                value={category}
                onValueChange={(value) => setCategory(String(value))}
              >
                <SelectTrigger
                  aria-label="Filter by category"
                  className={ghostTriggerClass}
                >
                  {category === "All" ? (
                    "Category"
                  ) : (
                    <SelectValue className="font-semibold text-brand" />
                  )}
                </SelectTrigger>
                <SelectContent
                  align="start"
                  sideOffset={8}
                  className={filterMenuClass}
                >
                  {categoryItems.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className={filterMenuItemClass}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-1">
                <motion.div
                  layout
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  className="relative"
                >
                  {desktopSearchOpen ? (
                    <>
                      <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        autoFocus
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onBlur={() => setDesktopSearchOpen(false)}
                        placeholder="Search products"
                        className="h-9 w-64 rounded-full border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-white"
                      />
                    </>
                  ) : (
                    <button
                      aria-label="Search products"
                      onClick={() => setDesktopSearchOpen(true)}
                      className="focus-ring relative grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand"
                    >
                      <Search className="size-4" />
                      {query.trim() && (
                        <span className="absolute right-1 top-1 size-2 rounded-full bg-gold ring-2 ring-white" />
                      )}
                    </button>
                  )}
                </motion.div>
                <span className="mx-1.5 h-4 w-px shrink-0 bg-slate-200" />
                <Select
                  items={sortOptions}
                  value={sort}
                  onValueChange={(value) => setSort(String(value))}
                >
                  <SelectTrigger
                    aria-label="Sort products"
                    className={ghostTriggerClass}
                  >
                    <span className="text-slate-500">Sort by :</span>
                    <SelectValue className="font-semibold text-brand" />
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    sideOffset={8}
                    className={filterMenuClass}
                  >
                    {sortOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className={filterMenuItemClass}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {filterChips.length > 0 && (
                <motion.div
                  key="filter-chips"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
                    <AnimatePresence initial={false} mode="popLayout">
                      {filterChips.map((chip) => (
                        <motion.button
                          key={chip.key}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.15 }}
                          type="button"
                          onClick={chip.remove}
                          className="focus-ring group flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-2 text-xs font-medium text-brand transition-colors hover:border-slate-300 hover:bg-white"
                        >
                          {chip.label}
                          <X className="size-3 text-slate-400 transition-colors group-hover:text-brand" />
                        </motion.button>
                      ))}
                    </AnimatePresence>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="focus-ring px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:text-brand"
                    >
                      Clear all
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section
          ref={gridRef}
          className="scroll-mt-28 border-t border-slate-100 bg-slate-50/60"
        >
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2.5">
                  <h1 className="min-w-0 truncate text-xl font-semibold tracking-[-0.025em] text-brand sm:text-2xl">
                    <BlurText
                      text={catalogue.title}
                      animateBy="words"
                      delay={80}
                      stepDuration={0.25}
                    />
                  </h1>
                </div>
                {filterChips.length > 0 && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    Showing filtered results from {products.length} products
                  </p>
                )}
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 sm:hidden">
                <button
                  type="button"
                  aria-label="One product per row"
                  aria-pressed={mobileCols === 1}
                  onClick={() => setMobileCols(1)}
                  className={cn(
                    "grid size-8 place-items-center rounded-md transition-colors",
                    mobileCols === 1 ? "bg-brand text-white" : "text-slate-400",
                  )}
                >
                  <IconLayoutList className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Two products per row"
                  aria-pressed={mobileCols === 2}
                  onClick={() => setMobileCols(2)}
                  className={cn(
                    "grid size-8 place-items-center rounded-md transition-colors",
                    mobileCols === 2 ? "bg-brand text-white" : "text-slate-400",
                  )}
                >
                  <IconLayoutGrid className="size-4" />
                </button>
              </div>
            </div>
            <motion.div
              layout
              className={cn(
                "grid sm:grid-cols-2 sm:gap-5 md:grid-cols-3 xl:grid-cols-4",
                mobileCols === 1 ? "grid-cols-1 gap-4" : "grid-cols-2 gap-3",
              )}
            >
              <AnimatePresence mode="popLayout">
                {visible.map((product) => {
                  const discount = discountOf(product);
                  return (
                    <motion.article
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25 }}
                      key={product.id}
                      className="min-w-0"
                    >
                      <SpotlightCard
                        spotlightColor="rgba(11, 31, 58, 0.06)"
                        className="group flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
                      >
                        <div className="relative">
                          <ProductBadges badges={product.badges} />
                          <CardImageSlider
                            images={product.images}
                            name={product.name}
                            onOpen={() => {
                              trackCardOpen(product);
                              router.push(
                                `/catalogue/${catalogue.slug}/product/${product.id}`,
                              );
                            }}
                            sizes={
                              mobileCols === 1
                                ? "(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 25vw"
                                : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            }
                            className={cn(
                              "w-full bg-[#f2f3f5] sm:aspect-5/4",
                              mobileCols === 1 ? "aspect-4/3" : "aspect-square",
                            )}
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
                          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                            {product.brand ?? " "}
                          </p>
                          <Link
                            href={`/catalogue/${catalogue.slug}/product/${product.id}`}
                            className="focus-ring"
                            onClick={() => trackCardOpen(product)}
                          >
                            <h3 className="mt-1 min-h-10 text-sm font-semibold text-brand sm:text-[15px]">
                              {product.name}
                            </h3>
                          </Link>
                          <div className="mt-auto pt-2">
                            <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1">
                              {product.priceOnRequest ? (
                                <>
                                  <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                                    <IconTag className="size-3.5 shrink-0" />
                                    <span className="truncate">
                                      {PRICE_ON_REQUEST_LABEL}
                                    </span>
                                  </span>
                                  {product.mrp !== null && (
                                    <span className="text-xs  text-slate-700">
                                      MRP{" "}
                                      <span className="line-through">
                                        {money(product.mrp)}
                                      </span>
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="text-base font-bold tracking-tight text-brand sm:text-lg">
                                    {priceLabel(
                                      {
                                        priceOnRequest: product.priceOnRequest,
                                        offerPrice: product.price,
                                      },
                                      money,
                                    )}
                                  </span>
                                  {product.mrp !== null && (
                                    <span className="text-xs text-slate-400 line-through">
                                      {money(product.mrp)}
                                    </span>
                                  )}
                                  {discount > 0 && (
                                    <span className="rounded bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                      {discount}% off
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="pt-2 sm:pt-3">
                              <p className="mb-2 text-xs text-slate-500">
                                Minimum Order Quantity:{" "}
                                <strong className="inline-block whitespace-nowrap">
                                  {product.moq.toLocaleString("en-IN")}&nbsp;units
                                </strong>
                              </p>
                              <ProductCtaRow
                                product={product}
                                productPath={`/catalogue/${catalogue.slug}/product/${product.id}`}
                                whatsappNumber={catalogue.whatsappNumber}
                                linkLocation="product_card"
                                buttonClassName="h-11 py-2.5"
                                onContact={() => {
                                  trackEvent("contact_supplier_click", {
                                    link_location: "product_card",
                                    item_id: product.id,
                                    item_name: product.name,
                                  });
                                  setContacting(product);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </SpotlightCard>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
            {visible.length === 0 && (
              <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <div>
                  <p className="text-sm text-slate-500">
                    No products match your search or filters.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                    {sourcingHref && (
                      <a
                        href={sourcingHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          trackEvent("whatsapp_click", {
                            link_location: "catalogue_empty_state",
                          })
                        }
                        className="focus-ring flex h-9 items-center gap-2 rounded-full bg-whatsapp px-4 text-sm font-semibold text-white transition-colors hover:bg-whatsapp-hover"
                      >
                        <WhatsAppIcon className="size-4" />
                        Tell us what you need
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter
        whatsappNumber={catalogue.whatsappNumber}
        catalogueTitle={catalogue.title}
      />

      {contacting && (
        <ContactSupplierDialog
          key={contacting.id}
          catalogueId={catalogue.id}
          product={contacting}
          whatsappNumber={catalogue.whatsappNumber}
          onClose={() => setContacting(null)}
        />
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0">
          <SheetHeader className="border-b border-slate-200 p-5 text-left">
            <SheetTitle className="text-lg">Filters</SheetTitle>
            <SheetDescription>Narrow down the live deals.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 p-5">
            <div>
              <Label>Price</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {priceBandOptions.map((band) => {
                  const active = priceBands.includes(band.value);
                  return (
                    <button
                      key={band.value}
                      type="button"
                      onClick={() => togglePriceBand(band.value)}
                      aria-pressed={active}
                      className={cn(
                        "focus-ring h-9 rounded-full border px-3.5 text-xs font-semibold transition-all",
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {band.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>MOQ</Label>
              <Select
                items={moqOptions}
                value={moqMax}
                onValueChange={(value) => setMoqMax(String(value))}
              >
                <SelectTrigger
                  aria-label="Filter by MOQ"
                  className="mt-1.5 h-11 w-full rounded-xl border-slate-200 bg-white px-3.5 shadow-none data-[size=default]:h-11"
                >
                  <SelectValue className="font-semibold text-brand" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  sideOffset={8}
                  className={filterMenuClass}
                >
                  {moqOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className={filterMenuItemClass}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Discount</Label>
              <Select
                items={discountOptions}
                value={minDiscount}
                onValueChange={(value) => setMinDiscount(String(value))}
              >
                <SelectTrigger
                  aria-label="Filter by discount"
                  className="mt-1.5 h-11 w-full rounded-xl border-slate-200 bg-white px-3.5 shadow-none data-[size=default]:h-11"
                >
                  <SelectValue className="font-semibold text-brand" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  sideOffset={8}
                  className={filterMenuClass}
                >
                  {discountOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className={filterMenuItemClass}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select
                items={categoryItems}
                value={category}
                onValueChange={(value) => setCategory(String(value))}
              >
                <SelectTrigger
                  aria-label="Filter by category"
                  className="mt-1.5 h-11 w-full rounded-xl border-slate-200 bg-white px-3.5 shadow-none data-[size=default]:h-11"
                >
                  <SelectValue className="font-semibold text-brand" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  sideOffset={8}
                  className={filterMenuClass}
                >
                  {categoryItems.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className={filterMenuItemClass}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="mt-1 h-12 rounded-xl bg-brand text-white hover:bg-brand-hover"
              onClick={() => setFiltersOpen(false)}
            >
              Show {visible.length}{" "}
              {visible.length === 1 ? "product" : "products"}
            </Button>
            {activeFilters.length > 0 && (
              <Button
                variant="ghost"
                className="h-10 rounded-xl text-slate-500"
                onClick={clearNarrowFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
