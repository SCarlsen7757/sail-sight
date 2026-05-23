"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function SetupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { refresh } = useAuth();
  const [validating, setValidating] = useState(true);
  const [validUser, setValidUser] = useState<{ email: string; displayName: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const userId = search?.get("userId") ?? "";
  const token = search?.get("token") ?? "";

  useEffect(() => {
    if (!userId || !token) {
      setValidating(false);
      return;
    }
    api
      .GET("/api/v1/auth/setup/validate", { params: { query: { userId, token } } })
      .then(({ data, error }) => {
        if (error || !data) {
          setValidUser(null);
        } else {
          setValidUser({ email: data.email, displayName: data.displayName });
        }
        setValidating(false);
      });
  }, [userId, token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await api.POST("/api/v1/auth/setup/complete", {
        body: { userId, token, password },
      });
      if (err) {
        setError("Could not set password. The link may have expired.");
        return;
      }
      await refresh();
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  }

  if (validating) return <div className="mx-auto mt-16 max-w-sm p-6 text-sm">Validating link…</div>;

  if (!validUser) {
    return (
      <div className="mx-auto mt-16 max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-xl font-bold text-red-500">Setup link expired or invalid</h1>
        <p className="text-sm text-text-secondary">Ask your admin for a new setup link.</p>
        <Link href="/login" className="text-action-primary hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-action-primary">Welcome, {validUser.displayName}</h1>
      <p className="text-sm text-text-secondary">Set a password for <strong>{validUser.email}</strong> to finish setting up your account.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded border border-border-default bg-bg-surface p-2"
          type="password"
          placeholder="New password (min 12 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
        />
        <input
          className="w-full rounded border border-border-default bg-bg-surface p-2"
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
        />
        {error && <div className="text-sm text-red-500">{error}</div>}
        <button type="submit" disabled={submitting} className="w-full rounded bg-action-primary p-2 text-white disabled:opacity-50">
          {submitting ? "Setting password…" : "Set password & sign in"}
        </button>
      </form>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-16 max-w-sm p-6 text-sm">Loading…</div>}>
      <SetupForm />
    </Suspense>
  );
}
