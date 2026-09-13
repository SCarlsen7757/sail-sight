"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import type { components } from "./api-types";

type Me = components["schemas"]["UserProfileDto"];
type Providers = components["schemas"]["AuthProvidersDto"];

interface AuthState {
  me: Me | null;
  providers: Providers | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const [meRes, provRes] = await Promise.all([
        api.GET("/api/v1/me"),
        api.GET("/api/v1/auth/providers"),
      ]);
      setMe(meRes.data ?? null);
      setProviders(provRes.data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const { response } = await api.POST("/api/v1/auth/logout");
    if (response.ok) {
      setMe(null);
      router.push("/login");
    }
  }, [router]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <AuthContext.Provider value={{ me, providers, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
