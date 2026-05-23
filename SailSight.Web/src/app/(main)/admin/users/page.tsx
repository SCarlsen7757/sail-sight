"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { components } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import type { AdminStats } from "@/lib/schemas";
import { Users, UsersRound } from "lucide-react";

type AdminUser = components["schemas"]["AdminUserDto"];
type Invitation = components["schemas"]["InvitationDto"];

export default function AdminUsersPage() {
  const { me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"User" | "Admin">("User");
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invRole, setInvRole] = useState<"User" | "Admin">("User");
  const [invMaxUses, setInvMaxUses] = useState<string>("");
  const [invExpiresInDays, setInvExpiresInDays] = useState<string>("7");
  const [invNote, setInvNote] = useState("");
  const [invUrl, setInvUrl] = useState<string | null>(null);
  const [invError, setInvError] = useState<string | null>(null);

  async function load() {
    const [{ data: u }, { data: i }, { data: s }] = await Promise.all([
      api.GET("/api/v1/admin/users"),
      api.GET("/api/v1/admin/invitations"),
      api.GET("/api/v1/admin/users/stats" as any, {} as any),
    ]);
    setUsers(u ?? []);
    setInvitations(i ?? []);
    if (s) setAdminStats(s as AdminStats);
  }

  useEffect(() => { void load(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSetupUrl(null);
    const { data, error: err } = await api.POST("/api/v1/admin/users", {
      body: { email, displayName, role },
    });
    if (err || !data) {
      setError("Could not create user. Email may already be taken.");
      return;
    }
    setSetupUrl(data.setupUrl ?? null);
    setEmail("");
    setDisplayName("");
    await load();
  }

  async function regenerate(id: string) {
    const { data } = await api.POST("/api/v1/admin/users/{id}/setup-link", { params: { path: { id } } });
    if (data) setSetupUrl(data.setupUrl ?? null);
  }

  async function changeRole(id: string, newRole: string) {
    await api.PATCH("/api/v1/admin/users/{id}", { params: { path: { id } }, body: { displayName: null, role: newRole } });
    await load();
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? Their data will be removed.")) return;
    await api.DELETE("/api/v1/admin/users/{id}", { params: { path: { id } } });
    await load();
  }

  async function createInvitation(e: React.FormEvent) {
    e.preventDefault();
    setInvError(null);
    setInvUrl(null);
    const maxUses = invMaxUses.trim() === "" ? null : Number.parseInt(invMaxUses, 10);
    const expiresInDays = invExpiresInDays.trim() === "" ? null : Number.parseInt(invExpiresInDays, 10);
    if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
      setInvError("Max uses must be a positive number, or empty for unlimited.");
      return;
    }
    if (expiresInDays !== null && (!Number.isFinite(expiresInDays) || expiresInDays < 1)) {
      setInvError("Expiry days must be a positive number, or empty for no expiry.");
      return;
    }
    const { data, error: err } = await api.POST("/api/v1/admin/invitations", {
      body: { role: invRole, maxUses, expiresInDays, note: invNote || null },
    });
    if (err || !data) {
      setInvError("Could not create invitation.");
      return;
    }
    setInvUrl(data.url);
    setInvNote("");
    await load();
  }

  async function revokeInvitation(id: string) {
    if (!confirm("Revoke this invitation? Anyone holding the link will no longer be able to use it.")) return;
    await api.DELETE("/api/v1/admin/invitations/{id}", { params: { path: { id } } });
    await load();
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard?.writeText(text);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-action-primary">User management</h1>

      {adminStats && (
        <div className="flex gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-surface px-5 py-4">
            <Users className="h-6 w-6 text-action-primary" />
            <div>
              <div className="text-xs uppercase tracking-wider text-text-secondary">Users</div>
              <div className="font-mono text-2xl font-semibold">{adminStats.userCount}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-surface px-5 py-4">
            <UsersRound className="h-6 w-6 text-action-primary" />
            <div>
              <div className="text-xs uppercase tracking-wider text-text-secondary">Teams</div>
              <div className="font-mono text-2xl font-semibold">{adminStats.teamCount}</div>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Invite a known user (per-user setup link)</h2>
        <form onSubmit={createUser} className="flex max-w-sm flex-col gap-2">
          <input className="rounded border border-border-default bg-bg-surface p-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="rounded border border-border-default bg-bg-surface p-2" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <select className="rounded border border-border-default bg-bg-surface p-2" value={role} onChange={(e) => setRole(e.target.value as "User" | "Admin")}>
            <option value="User">User</option>
            <option value="Admin">Admin</option>
          </select>
          <button type="submit" className="rounded bg-action-primary p-2 text-white">Create user</button>
        </form>
        {error && <div className="text-sm text-red-500">{error}</div>}
        {setupUrl && (
          <div className="rounded border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
            <p className="font-bold">Share this one-time setup URL with the new user:</p>
            <code className="mt-1 block break-all font-mono text-xs">{setupUrl}</code>
            <div className="mt-2 flex gap-3">
              <button className="text-xs underline" onClick={() => copyToClipboard(setupUrl)}>Copy</button>
              <button className="text-xs underline" onClick={() => setSetupUrl(null)}>Dismiss</button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Shareable invitation links</h2>
        <p className="text-xs text-text-secondary">Useful for bulk onboarding — anyone with the link can register an account using their own email.</p>
        <form onSubmit={createInvitation} className="flex max-w-sm flex-col gap-2">
          <select className="rounded border border-border-default bg-bg-surface p-2" value={invRole} onChange={(e) => setInvRole(e.target.value as "User" | "Admin")}>
            <option value="User">User</option>
            <option value="Admin">Admin</option>
          </select>
          <input className="rounded border border-border-default bg-bg-surface p-2" type="number" min={1} placeholder="Max uses (blank = ∞)" value={invMaxUses} onChange={(e) => setInvMaxUses(e.target.value)} />
          <input className="rounded border border-border-default bg-bg-surface p-2" type="number" min={1} placeholder="Expires in days (blank = never)" value={invExpiresInDays} onChange={(e) => setInvExpiresInDays(e.target.value)} />
          <input className="rounded border border-border-default bg-bg-surface p-2" placeholder="Note (optional)" value={invNote} onChange={(e) => setInvNote(e.target.value)} />
          <button type="submit" className="rounded bg-action-primary p-2 text-white">Create link</button>
        </form>
        {invError && <div className="text-sm text-red-500">{invError}</div>}
        {invUrl && (
          <div className="rounded border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
            <p className="font-bold">Share this invitation URL:</p>
            <code className="mt-1 block break-all font-mono text-xs">{invUrl}</code>
            <div className="mt-2 flex gap-3">
              <button className="text-xs underline" onClick={() => copyToClipboard(invUrl)}>Copy</button>
              <button className="text-xs underline" onClick={() => setInvUrl(null)}>Dismiss</button>
            </div>
          </div>
        )}
        <ul className="space-y-1">
          {invitations.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border-default p-2 text-sm">
              <div>
                <div className="font-medium">
                  {inv.role}
                  {inv.note && <span className="ml-2 text-text-secondary">— {inv.note}</span>}
                  {!inv.isActive && <span className="ml-2 text-xs text-red-500">inactive</span>}
                </div>
                <div className="text-xs text-text-secondary">
                  Used {inv.usedCount}{inv.maxUses !== null ? ` / ${inv.maxUses}` : " (unlimited)"}
                  {inv.expiresAt && <> · expires {new Date(inv.expiresAt).toLocaleString()}</>}
                  {inv.revokedAt && <> · revoked</>}
                </div>
              </div>
              {inv.isActive && (
                <button onClick={() => revokeInvitation(inv.id)} className="text-xs text-red-500 hover:underline">Revoke</button>
              )}
            </li>
          ))}
          {invitations.length === 0 && <li className="text-sm text-text-secondary">No invitations.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Users</h2>
        <ul className="space-y-1">
          {users.map((u) => {
            const isSelf = u.id === me?.id;
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border-default p-2 text-sm">
                <div>
                  <div className="font-medium">{u.displayName} {isSelf && <span className="text-xs text-text-secondary">(you)</span>}</div>
                  <div className="text-xs text-text-secondary">{u.email} · {u.roles.join(", ") || "—"} · {u.hasPassword ? "active" : "pending setup"}</div>
                </div>
                <div className="flex gap-2">
                  {!u.hasPassword ? (
                    <button onClick={() => regenerate(u.id)} className="rounded border border-border-default px-2 py-1 text-xs">New setup link</button>
                  ) : (
                    <button onClick={() => regenerate(u.id)} className="rounded border border-border-default px-2 py-1 text-xs">Reset password link</button>
                  )}
                  <select
                    className="rounded border border-border-default bg-bg-surface px-2 py-1 text-xs"
                    value={u.roles.includes("Admin") ? "Admin" : "User"}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    disabled={isSelf}
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                  <button onClick={() => deleteUser(u.id)} disabled={isSelf} className="text-xs text-red-500 hover:underline disabled:opacity-30">
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
