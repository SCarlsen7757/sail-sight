"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { providers, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = search?.get("next") ?? "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await api.POST("/api/v1/auth/login", {
        body: { email, password },
      });
      if (err) {
        setError("Invalid email or password.");
        return;
      }
      await refresh();
      router.push(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm space-y-6 p-6">
      <h1 className="text-2xl font-bold text-action-primary">Sign in</h1>
      {providers?.local && (
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="w-full rounded border border-border-default bg-bg-surface p-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <input className="w-full rounded border border-border-default bg-bg-surface p-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {error && <div className="text-sm text-red-500">{error}</div>}
          <button type="submit" disabled={loading} className="w-full rounded bg-action-primary p-2 text-white disabled:opacity-50">
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="pt-2 text-center text-xs text-text-secondary">
            Need an account? Ask your administrator to invite you.
          </p>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-16 max-w-sm p-6 text-sm">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
