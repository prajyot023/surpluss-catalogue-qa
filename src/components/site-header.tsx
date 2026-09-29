"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { fetchCatalogue } from "@/lib/api/catalogues";
import { CommandSearch } from "@/components/admin/command-search";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const SEGMENT_LABELS: Record<string, string> = {
  catalogues: "Catalogues",
  products: "Products",
  import: "Imports",
  leads: "Leads",
  settings: "Settings",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildCrumbs(pathname: string, names: Record<string, string>) {
  const crumbs = [{ label: "Dashboard", href: "/admin" }];
  const segments = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  let href = "/admin";
  for (const segment of segments) {
    href += `/${segment}`;
    const label = UUID_PATTERN.test(segment)
      ? (names[segment] ?? "…")
      : (SEGMENT_LABELS[segment] ?? decodeURIComponent(segment));
    crumbs.push({ label, href });
  }
  return crumbs;
}

export function SiteHeader() {
  const pathname = usePathname();
  // Catalogue names for UUID path segments, so the breadcrumb never shows raw ids.
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const match = pathname.match(/^\/admin\/catalogues\/([0-9a-f-]{36})$/i);
    const id = match?.[1];
    if (!id || names[id]) return;
    let cancelled = false;
    fetchCatalogue(id)
      .then((catalogue) => {
        if (!cancelled) setNames((current) => ({ ...current, [id]: catalogue.name }));
      })
      .catch(() => {
        if (!cancelled) setNames((current) => ({ ...current, [id]: "Catalogue" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const crumbs = buildCrumbs(pathname, names);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <Fragment key={crumb.href}>
                  {isLast ? (
                    <BreadcrumbItem>
                      <BreadcrumbPage className="max-w-48 truncate">{crumb.label}</BreadcrumbPage>
                    </BreadcrumbItem>
                  ) : (
                    <BreadcrumbItem className="hidden sm:inline-flex">
                      <BreadcrumbLink render={<Link href={crumb.href} />}>
                        {crumb.label}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  )}
                  {!isLast && <BreadcrumbSeparator className="hidden sm:block" />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <CommandSearch />
      </div>
    </header>
  );
}
