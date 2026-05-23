"use client";

import {
  Home, Upload, Layers, Sailboat, MapPin, Users, UserCircle, Settings as SettingsIcon, ShieldCheck, Inbox, LogIn, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
  adminOnly?: boolean;
  /** Item is hidden when the user is not authenticated. */
  authRequired?: boolean;
  /** Item is hidden when the user is authenticated. */
  anonOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home, matchPrefix: "/" },
  { href: "/upload", label: "Upload", icon: Upload, matchPrefix: "/upload", authRequired: true },
  { href: "/sessions", label: "Sessions", icon: Layers, matchPrefix: "/sessions" },
  { href: "/boats", label: "Fleet", icon: Sailboat, matchPrefix: "/boats" },
  { href: "/courses", label: "Courses", icon: MapPin, matchPrefix: "/course", authRequired: true },
  { href: "/teams", label: "Teams", icon: Users, matchPrefix: "/teams", authRequired: true },
  { href: "/account", label: "Account", icon: UserCircle, matchPrefix: "/account", authRequired: true },
  { href: "/admin/users", label: "Admin", icon: ShieldCheck, matchPrefix: "/admin/users", adminOnly: true },
  { href: "/admin/boat-classes", label: "Class requests", icon: Inbox, matchPrefix: "/admin/boat-classes", adminOnly: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon, matchPrefix: "/settings", authRequired: true },
  { href: "/login", label: "Sign in", icon: LogIn, anonOnly: true },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(item.matchPrefix ?? item.href);
}
