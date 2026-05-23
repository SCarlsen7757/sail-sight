"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ITEMS, isActive, type NavItem } from "./nav-items";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/lib/auth-context";
import type { components } from "@/lib/api-types";

type NotificationCounts = components["schemas"]["NotificationCountsDto"];

function useNotificationCounts() {
  const { me, providers } = useAuth();
  const isAdmin = providers?.mode === "SingleUser" || !!me?.roles?.includes("Admin");
  const [counts, setCounts] = useState<NotificationCounts | null>(null);

  useEffect(() => {
    if (!me && providers?.mode !== "SingleUser") return;

    let source: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source?.close();
      source = new EventSource("/api/v1/me/notifications/stream");
      source.onmessage = (e) => {
        try { setCounts(JSON.parse(e.data as string) as NotificationCounts); } catch { /* ignore */ }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        retryTimeout = setTimeout(connect, 30_000);
      };
    };

    connect();

    const onFocus = () => {
      if (!source || source.readyState === EventSource.CLOSED) {
        if (retryTimeout) clearTimeout(retryTimeout);
        connect();
      }
    };

    window.addEventListener("focus", onFocus);
    return () => {
      source?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      window.removeEventListener("focus", onFocus);
    };
  }, [me, providers?.mode]);

  return { pendingInvites: Number(counts?.pendingTeamInvites ?? 0), pendingBoatClassRequests: isAdmin ? Number(counts?.pendingBoatClassRequests ?? 0) : 0 };
}

function BadgeDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function badgeForItem(item: NavItem, badges: { pendingInvites: number; pendingBoatClassRequests: number }) {
  if (item.href === "/teams") return badges.pendingInvites;
  if (item.href === "/admin/boat-classes") return badges.pendingBoatClassRequests;
  return 0;
}

function useVisibleNavItems(): NavItem[] {
  const { me, providers } = useAuth();
  const isLoggedIn = !!me || providers?.mode === "SingleUser";
  const isAdmin = providers?.mode === "SingleUser" || !!me?.roles?.includes("Admin");
  return NAV_ITEMS.filter((i) => {
    if (i.adminOnly && !isAdmin) return false;
    if (i.authRequired && !isLoggedIn) return false;
    if (i.anonOnly && isLoggedIn) return false;
    return true;
  });
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const items = useVisibleNavItems();
  const badges = useNotificationCounts();

  return (
    <aside
      className={cn(
        "hidden xl:flex flex-col border-r border-border-default bg-bg-surface transition-all",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className={cn("flex items-center px-3 py-4", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <span className="text-lg font-bold text-action-primary">SailSight</span>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="rounded p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const badge = badgeForItem(item, badges);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-action-primary/10 text-action-primary"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
                collapsed && "justify-center"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && <BadgeDot count={badge} />}
            </Link>
          );
        })}
      </nav>
      <div className={cn("px-2 py-3", collapsed && "flex justify-center")}>
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function IconRail() {
  const pathname = usePathname();
  const items = useVisibleNavItems();
  const badges = useNotificationCounts();
  return (
    <aside className="hidden lg:flex xl:hidden w-16 flex-col items-center border-r border-border-default bg-bg-surface py-4">
      <span className="mb-4 text-xs font-bold text-action-primary">VKX</span>
      <nav className="flex-1 space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const badge = badgeForItem(item, badges);
          return (
            <div key={item.href} className="relative">
              <Link
                href={item.href}
                title={item.label}
                className={cn(
                  "flex items-center justify-center rounded-md p-2",
                  active ? "bg-action-primary/10 text-action-primary" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
              {badge > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </div>
          );
        })}
      </nav>
      <ThemeToggle />
    </aside>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();
  const items = useVisibleNavItems();
  const badges = useNotificationCounts();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border-default bg-bg-surface">
      <ul className={cn("grid", items.length <= 8 ? "grid-cols-8" : "grid-cols-9")}>
        {items.map((item) => {
          const active = isActive(pathname, item);
          const badge = badgeForItem(item, badges);
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]",
                  active ? "text-action-primary" : "text-text-secondary"
                )}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {badge > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
