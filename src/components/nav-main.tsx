"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type AdminNavItem = {
  title: string;
  href: string;
  icon?: React.ReactNode;
  badge?: number;
};

export function isNavItemActive(href: string, pathname: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function NavMain({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={isNavItemActive(item.href, pathname)}
                render={<Link href={item.href} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
              {item.badge ? (
                <SidebarMenuBadge className="rounded-full bg-gold font-bold text-brand">
                  {item.badge}
                </SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
