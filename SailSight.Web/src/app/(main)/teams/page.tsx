"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { components } from "@/lib/api-types";

type Team = components["schemas"]["TeamDto"];
type PendingInvite = components["schemas"]["PendingTeamInviteDto"];

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const [{ data: t }, { data: i }] = await Promise.all([
      api.GET("/api/v1/teams"),
      api.GET("/api/v1/me/invites"),
    ]);
    setTeams(t ?? []);
    setInvites(i ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    await api.POST("/api/v1/teams", { body: { name } });
    setName("");
    await load();
  }

  async function acceptInvite(inviteId: string) {
    await api.POST("/api/v1/me/invites/{inviteId}/accept", { params: { path: { inviteId } } });
    await load();
  }

  async function declineInvite(inviteId: string) {
    await api.POST("/api/v1/me/invites/{inviteId}/decline", { params: { path: { inviteId } } });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-action-primary">Teams</h1>

      {invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Pending invitations</h2>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
                <div>
                  <div className="font-medium">{inv.teamName}</div>
                  <div className="text-xs text-text-secondary">
                    Role: {inv.role} · Invited by {inv.invitedByEmail} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acceptInvite(inv.id)} className="rounded bg-action-primary px-3 py-1 text-xs text-white">Accept</button>
                  <button onClick={() => declineInvite(inv.id)} className="rounded border border-border-default px-3 py-1 text-xs">Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={createTeam} className="flex gap-2">
        <input className="flex-1 rounded border border-border-default bg-bg-surface p-2" placeholder="New team name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={!name} className="rounded bg-action-primary px-3 py-1.5 text-white disabled:opacity-50">Create</button>
      </form>
      <ul className="space-y-2">
        {teams.map((t) => (
          <li key={t.id} className="rounded border border-border-default p-3">
            <Link href={`/teams/${t.id}`} className="text-action-primary hover:underline">{t.name}</Link>
          </li>
        ))}
        {teams.length === 0 && <li className="text-sm text-text-secondary">You aren&apos;t a member of any teams yet.</li>}
      </ul>
    </div>
  );
}
