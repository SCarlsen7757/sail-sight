"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { components } from "@/lib/api-types";
import type { SessionSummary } from "@/lib/schemas";

type Member = components["schemas"]["TeamMemberDto"];
type PendingInvite = components["schemas"]["TeamPendingInviteDto"];

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  async function load() {
    const [{ data: m }, { data: pi }] = await Promise.all([
      api.GET("/api/v1/teams/{teamId}/members", { params: { path: { teamId: id } } }),
      api.GET("/api/v1/teams/{teamId}/invites", { params: { path: { teamId: id } } }),
    ]);
    setMembers(m ?? []);
    setPendingInvites(pi ?? []);
    setIsAdmin(pi !== undefined);
  }

  async function loadSessions() {
    const res = await fetch(`/api/v1/teams/${id}/sessions`);
    if (res.ok) setSessions(await res.json());
    else setSessions([]);
  }

  useEffect(() => {
    void load();
    void loadSessions();
  }, [id]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMessage(null);
    const { error } = await api.POST("/api/v1/teams/{teamId}/invites", {
      params: { path: { teamId: id } },
      body: { email: inviteEmail, role: "Member" },
    });
    if (error) {
      const errCode = (error as { error?: string }).error;
      if (errCode === "user_not_found") {
        setInviteMessage({ ok: false, text: "No account found with that email address." });
      } else if (errCode === "already_member") {
        setInviteMessage({ ok: false, text: "This user is already a member of the team." });
      } else if (errCode === "invite_already_pending") {
        setInviteMessage({ ok: false, text: "This user already has a pending invitation." });
      } else {
        setInviteMessage({ ok: false, text: "Could not send invitation." });
      }
      return;
    }
    setInviteEmail("");
    setInviteMessage({ ok: true, text: "Invitation sent. The user will see it when they next visit Teams." });
    await load();
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove member?")) return;
    await api.DELETE("/api/v1/teams/{teamId}/members/{memberId}", { params: { path: { teamId: id, memberId } } });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-action-primary">Team</h1>

      {isAdmin && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Invite member</h2>
          <form onSubmit={invite} className="flex gap-2">
            <input
              className="flex-1 rounded border border-border-default bg-bg-surface p-2"
              type="email"
              placeholder="Account email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <button type="submit" className="rounded bg-action-primary px-3 py-1.5 text-white">Invite</button>
          </form>
          {inviteMessage && (
            <p className={`mt-2 text-sm ${inviteMessage.ok ? "text-green-500" : "text-red-500"}`}>{inviteMessage.text}</p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Members</h2>
        <ul className="space-y-1">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between rounded border border-border-default p-2 text-sm">
              <span>{m.displayName ?? m.email} <span className="text-text-secondary">({m.role})</span></span>
              <button onClick={() => removeMember(m.userId)} className="text-red-500 hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && pendingInvites.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Pending invitations</h2>
          <ul className="space-y-1">
            {pendingInvites.map((inv) => (
              <li key={inv.id} className="rounded border border-border-default p-2 text-sm">
                <div className="font-medium">{inv.displayName ?? inv.email}</div>
                <div className="text-xs text-text-secondary">
                  {inv.email} · Role: {inv.role} · Invited {new Date(inv.createdAt).toLocaleDateString()} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Sessions</h2>
        {sessions === null ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-text-secondary">No sessions have been shared with this team yet.</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded border border-border-default p-2 text-sm">
                <div>
                  <Link href={`/sessions/${s.id}`} className="font-medium text-action-primary hover:underline">{s.fileName}</Link>
                  <span className="ml-2 text-text-secondary">{new Date(s.startedAt).toLocaleDateString()}</span>
                  {s.isPublic && <span className="ml-2 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-400">Public</span>}
                </div>
                <span className="text-text-secondary">{s.raceCount} race{s.raceCount === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
