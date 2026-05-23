"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function ModeBanner() {
  const { providers } = useAuth();
  if (!providers || providers.mode !== "SingleUser") return null;
  return (
    <div className="bg-yellow-500/20 px-4 py-1 text-center text-xs text-yellow-300">
      Single-user mode — authentication is disabled. See docs to enable multi-user.
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { me, providers, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const singleUser = providers?.mode === "SingleUser";
  const isAdminPath = (pathname ?? "").startsWith("/admin");
  const isAdmin = !!me?.roles?.includes("Admin") || singleUser;

  useEffect(() => {
    if (loading) return;
    if (singleUser) return;
    if (!me) {
      // Send anonymous visitors to the public sessions explore page instead of the login screen
      // so they can browse public content. They can sign in from there if they want.
      router.replace("/sessions");
      return;
    }
    if (isAdminPath && !isAdmin) {
      router.replace("/");
    }
  }, [loading, me, singleUser, router, pathname, isAdminPath, isAdmin]);

  if (loading) return <div className="p-6 text-sm text-text-secondary">Loading…</div>;
  if (!singleUser && !me) return null;
  if (isAdminPath && !isAdmin) return null;
  return <>{children}</>;
}
