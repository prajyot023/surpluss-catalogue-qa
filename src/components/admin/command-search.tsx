"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconBoxSeam,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMessage2,
  IconPhotoOff,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";
import { apiClient } from "@/lib/api/client";
import type { GlobalSearchResults } from "@/app/api/admin/search/route";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { money } from "@/lib/utils";

const PAGES = [
  { label: "Dashboard", href: "/admin", icon: IconLayoutDashboard },
  { label: "Catalogues", href: "/admin/catalogues", icon: IconLayoutGrid },
  { label: "Products", href: "/admin/products", icon: IconBoxSeam },
  { label: "Leads", href: "/admin/leads", icon: IconMessage2 },
  { label: "Settings", href: "/admin/settings", icon: IconSettings },
];

const STATUS_LABELS: Record<string, string> = {
  published: "Live",
  draft: "Draft",
  expired: "Expired",
};

const STATUS_STYLES: Record<string, string> = {
  published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  expired: "border-red-200 bg-red-50 text-red-700",
};

const EMPTY: GlobalSearchResults = { products: [], catalogues: [], leads: [] };

/** Command-palette search over pages, products, catalogues and leads.
 * Opens from the header search box or Ctrl+K / Cmd+K. */
export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const needle = query.trim();
    if (!needle) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      apiClient
        .get<GlobalSearchResults>("/api/admin/search", { params: { q: needle } })
        .then((response) => {
          if (cancelled) return;
          setResults(response.data);
          setSearching(false);
        })
        .catch(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    router.push(href);
  }

  const needle = query.trim().toLowerCase();
  const matchingPages = needle ? PAGES.filter((page) => page.label.toLowerCase().includes(needle)) : PAGES;
  const hasRecords = results.products.length > 0 || results.catalogues.length > 0 || results.leads.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring ml-auto hidden h-8 w-full max-w-xs items-center gap-2 rounded-lg border border-transparent bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:flex"
      >
        <IconSearch className="size-4" />
        <span className="flex-1 text-left">Search anything</span>
        <kbd className="rounded border border-border bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
          Ctrl K
        </kbd>
      </button>
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="focus-ring ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted sm:hidden"
      >
        <IconSearch className="size-4" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setResults(EMPTY);
          }
        }}
        title="Search"
        description="Search pages, products, catalogues and leads"
        className="sm:max-w-lg"
        shouldFilter={false}
      >
        <CommandInput
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            const active = Boolean(value.trim());
            setSearching(active);
            if (!active) setResults(EMPTY);
          }}
          placeholder="Search pages, products, catalogues, leads…"
        />
        <CommandList>
          <CommandEmpty>
            {searching ? "Searching…" : needle ? "Nothing matches your search." : "Type to search your workspace."}
          </CommandEmpty>

          {matchingPages.length > 0 && (
            <CommandGroup heading="Pages">
              {matchingPages.map((page) => (
                <CommandItem key={page.href} value={`page-${page.label}`} onSelect={() => go(page.href)}>
                  <page.icon className="text-slate-400" />
                  {page.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.products.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Products">
                {results.products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`product-${product.id}`}
                    onSelect={() => go(`/admin/products?view=${product.id}`)}
                  >
                    <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-slate-100">
                      {product.image ? (
                        <Image src={product.image} alt="" fill sizes="32px" className="object-cover" />
                      ) : (
                        <IconPhotoOff className="size-4 text-slate-300" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="min-w-0 truncate">{product.name}</span>
                        {product.archived && (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Archived
                          </span>
                        )}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">{product.sku}</span>
                    </span>
                    {product.offerPrice !== null && (
                      <span className="text-xs font-semibold text-slate-600">{money(product.offerPrice)}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {results.catalogues.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Catalogues">
                {results.catalogues.map((catalogue) => (
                  <CommandItem
                    key={catalogue.id}
                    value={`catalogue-${catalogue.id}`}
                    onSelect={() => go(`/admin/catalogues/${catalogue.id}`)}
                  >
                    <IconLayoutGrid className="text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{catalogue.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">/catalogue/{catalogue.slug}</span>
                    </span>
                    <Badge variant="outline" className={STATUS_STYLES[catalogue.status] ?? ""}>
                      {STATUS_LABELS[catalogue.status] ?? catalogue.status}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {results.leads.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Leads">
                {results.leads.map((lead) => (
                  <CommandItem
                    key={lead.reference}
                    value={`lead-${lead.reference}`}
                    onSelect={() => go(`/admin/leads/${lead.reference}`)}
                  >
                    <IconMessage2 className="text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{lead.buyerName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[lead.reference, lead.company].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">{lead.status}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {needle && !searching && !hasRecords && matchingPages.length === 0 && null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
