"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconLoader2, IconSearch } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { searchProducts } from "@/lib/api/listings";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn, money } from "@/lib/utils";
import { needsPricesForSale, PRICE_ON_REQUEST_LABEL } from "@/lib/pricing";
import { PRODUCT_SEARCH_PAGE_SIZE, type ProductSearchResult } from "@/lib/schemas/listing";
import { appToast } from "@/components/ui/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Status = "searching" | "idle" | "loading-more";

// Selection lives in a Map keyed by product id so it survives re-searches.
// Selected products are pinned at the top; the pages below only show the
// rest, loading more as the user scrolls.
export function ProductMultiSelect({
  catalogueId,
  selected,
  onChange,
}: {
  catalogueId?: string;
  selected: Map<string, ProductSearchResult>;
  onChange: (next: Map<string, ProductSearchResult>) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("searching");
  // Every search or page request gets a fresh id; a response whose id is no
  // longer current belongs to an older search and is dropped. The cursor,
  // query and in-flight flag are mirrored in refs so the scroll observer can
  // start the next page without waiting for a re-render.
  const requestRef = useRef(0);
  const inFlightRef = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const queryRef = useRef("");
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const reducedMotion = useReducedMotion();

  // A page can be short (or entirely made of already-selected products),
  // leaving the sentinel still in view. IntersectionObserver only reports
  // changes, so re-observing makes the browser report the current position,
  // which loads the next page if needed.
  const recheckSentinel = useCallback(() => {
    const sentinel = sentinelRef.current;
    const observer = observerRef.current;
    if (!sentinel || !observer) return;
    observer.unobserve(sentinel);
    observer.observe(sentinel);
  }, []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    queryRef.current = query;
    cursorRef.current = null;
    inFlightRef.current = false;
    const timer = setTimeout(() => {
      searchProducts(query, { catalogueId })
        .then((page) => {
          if (requestId !== requestRef.current) return;
          cursorRef.current = page.nextCursor;
          setResults(page.products);
          setNextCursor(page.nextCursor);
          setStatus("idle");
          recheckSentinel();
        })
        .catch((error) => {
          if (requestId !== requestRef.current) return;
          setStatus("idle");
          appToast.error("Search failed", getApiErrorMessage(error));
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, catalogueId, recheckSentinel]);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (inFlightRef.current || !cursor) return;
    const requestId = ++requestRef.current;
    inFlightRef.current = true;
    setStatus("loading-more");
    try {
      const page = await searchProducts(queryRef.current, { catalogueId, cursor });
      if (requestId !== requestRef.current) return;
      cursorRef.current = page.nextCursor;
      inFlightRef.current = false;
      setResults((current) => {
        const seen = new Set(current.map(({ id }) => id));
        return [...current, ...page.products.filter(({ id }) => !seen.has(id))];
      });
      setNextCursor(page.nextCursor);
      setStatus("idle");
      recheckSentinel();
    } catch (error) {
      if (requestId !== requestRef.current) return;
      inFlightRef.current = false;
      setStatus("idle");
      appToast.error("Could not load more products", getApiErrorMessage(error));
    }
  }, [catalogueId, recheckSentinel]);

  // The sentinel sits at the bottom of the scroll box; when it comes into view
  // the next page is requested.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { root, rootMargin: "0px 0px 200px 0px" },
    );
    observer.observe(sentinel);
    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [loadMore]);

  function toggle(product: ProductSearchResult) {
    const next = new Map(selected);
    if (next.has(product.id)) next.delete(product.id);
    else next.set(product.id, product);
    onChange(next);
  }

  const needle = query.trim().toLowerCase();
  const matchesQuery = (product: ProductSearchResult) =>
    !needle ||
    [product.name, product.sku, product.brand].some((value) => value?.toLowerCase().includes(needle));
  const pinned = [...selected.values()]
    .filter(matchesQuery)
    .sort((a, b) => a.name.localeCompare(b.name));
  const available = results.filter((product) => !selected.has(product.id));
  const hasMore = nextCursor !== null;
  const nothingMatches = status === "idle" && !pinned.length && !available.length && !hasMore;
  const allLoaded = status === "idle" && !hasMore && results.length > PRODUCT_SEARCH_PAGE_SIZE;

  return (
    <div className="grid gap-3">
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setStatus("searching");
          }}
          className="pl-9"
          placeholder="Search by name, SKU or brand"
        />
      </div>
      <div ref={listRef} className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
        {pinned.length > 0 && (
          <section>
            <SectionLabel>Selected · {pinned.length}</SectionLabel>
            <div className="divide-y divide-slate-100">
              {pinned.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  checked
                  onToggle={() => toggle(product)}
                  reducedMotion={reducedMotion}
                />
              ))}
            </div>
          </section>
        )}
        {status === "searching" ? (
          <div className="grid h-24 place-items-center">
            <IconLoader2 className="size-4 animate-spin text-slate-400" />
          </div>
        ) : (
          <section>
            {pinned.length > 0 && available.length > 0 && (
              <SectionLabel className="border-t">Available</SectionLabel>
            )}
            <div className="divide-y divide-slate-100">
              {available.map((product, index) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  checked={false}
                  onToggle={() => toggle(product)}
                  reducedMotion={reducedMotion}
                  delay={Math.min(index * 0.02, 0.2)}
                />
              ))}
            </div>
            {nothingMatches && (
              <p className="p-4 text-center text-sm text-slate-500">
                No products match. Import or add products first, then come back here.
              </p>
            )}
          </section>
        )}
        <div ref={sentinelRef} aria-hidden className="h-px" />
        {status === "loading-more" && (
          <div className="grid h-12 place-items-center border-t border-slate-100">
            <IconLoader2 className="size-4 animate-spin text-slate-400" />
          </div>
        )}
        {status === "idle" && hasMore && (
          <div className="grid place-items-center border-t border-slate-100 p-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => void loadMore()}>
              Load more
            </Button>
          </div>
        )}
        {allLoaded && (
          <p className="border-t border-slate-100 p-3 text-center text-xs text-slate-400">
            All products loaded.
          </p>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {selected.size === 0
          ? "Tick the products you want in this catalogue."
          : `${selected.size} ${selected.size === 1 ? "product" : "products"} selected.`}
      </p>
    </div>
  );
}

function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

function ProductRow({
  product,
  checked,
  onToggle,
  reducedMotion,
  delay = 0,
}: {
  product: ProductSearchResult;
  checked: boolean;
  onToggle: () => void;
  reducedMotion: boolean | null;
  delay?: number;
}) {
  return (
    <motion.button
      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay }}
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
    >
      <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none shrink-0" />
      <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {product.image && <Image src={product.image} alt="" fill sizes="36px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="truncate text-xs text-slate-500">
          {[product.brand, product.sku].filter(Boolean).join(" · ")}
        </p>
      </div>
      {product.priceOnRequest ? (
        <span className="shrink-0 text-sm font-medium text-slate-500">{PRICE_ON_REQUEST_LABEL}</span>
      ) : product.offerPrice !== null ? (
        <span className="shrink-0 text-sm font-semibold text-slate-700">{money(product.offerPrice)}</span>
      ) : null}
      {needsPricesForSale(product) ? (
        <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-700">
          No price yet
        </Badge>
      ) : product.quantity <= 0 ? (
        <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-700">
          No stock
        </Badge>
      ) : null}
    </motion.button>
  );
}
