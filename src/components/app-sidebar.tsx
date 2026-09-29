"use client";

import * as React from "react";
import Link from "next/link";
import { Boxes, LayoutDashboard, LayoutGrid, MessageSquareText, Settings } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { NavMain, type AdminNavItem } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser, type SidebarUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({
  user,
  newLeads = 0,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: SidebarUser;
  newLeads?: number;
}) {
  const navMain: AdminNavItem[] = [
    { title: "Dashboard", href: "/admin", icon: <LayoutDashboard /> },
    { title: "Catalogues", href: "/admin/catalogues", icon: <LayoutGrid /> },
    { title: "Products", href: "/admin/products", icon: <Boxes /> },
    { title: "Leads", href: "/admin/leads", icon: <MessageSquareText />, badge: newLeads },
  ];
  const navSecondary: AdminNavItem[] = [
    { title: "Settings", href: "/admin/settings", icon: <Settings /> },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-12 data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/admin" />}
            >
              <BrandMark />
              <span className="sr-only">Surpluss admin</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
