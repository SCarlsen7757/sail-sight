"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { components } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function InviteForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { refresh } = useAuth();
  const [validating, setValidating] = useState(true);
  const [info, setInfo] = useState<components["schemas"]["InvitationValidateResponse"] | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const token = search?.get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setValidationError("Missing invitation token.");
      setValidating(false);
      return;
    }
    api.GET("/api/v1/auth/invitation/validate", { params: { query: { token } } })
      .then(({ data, error }) => {
        if (error || !data) {
          setValidationError("This invitation link is invalid, expired, or fully used.");
        } else {
          setInfo({ role: data.role, remainingUses: data.remainingUses, expiresAt: data.expiresAt });
        }
        setValidating(false);
      });
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await api.POST("/api/v1/auth/invitation/redeem", {
        body: { token, email, displayName, password },
      });
      if (err) {
        setError("Could not create account. The email may already be taken or the invitation expired.");
        return;
      }
      await refresh();
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  }

  if (validating) return <div className="mx-auto mt-16 max-w-sm p-6 text-sm">Validating invitation…</div>;

  if (validationError || !info) {
    return (
      <div className="mx-auto mt-16 max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-xl font-bold text-red-500">Invitation unavailable</h1>
        <p className="text-sm text-text-secondary">{validationError ?? "Ask your admin for a new invitation link."}</p>
        <Link href="/login" className="text-action-primary hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-action-primary">Create your account</h1>
      <p className="text-sm text-text-secondary">
        You&apos;ll join as <strong>{info.role}</strong>.
        {info.remainingUses !== null && <> · {info.remainingUses} use{info.remainingUses === 1 ? "" : "s"} remaining.</>}
        {info.expiresAt && <> · Expires {new Date(info.expiresAt).toLocaleString()}.</>}
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded border border-border-default bg-bg-surface p-2" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded border border-border-default bg-bg-surface p-2" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <input className="w-full rounded border border-border-default bg-bg-surface p-2" type="password" autoComplete="new-password" placeholder="Password (min 12 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />
        <input className="w-full rounded border border-border-default bg-bg-surface p-2" type="password" autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={12} />
        {error && <div className="text-sm text-red-500">{error}</div>}
        <button type="submit" disabled={submitting} className="w-full rounded bg-action-primary p-2 text-white disabled:opacity-50">
          {submitting ? "Creating account…" : "Create account & sign in"}
        </button>
      </form>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-16 max-w-sm p-6 text-sm">Loading…</div>}>
      <InviteForm />
    </Suspense>
  );
}
