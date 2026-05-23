"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNavigate } from "@/hooks/useNavigate";
import { api } from "@/lib/api";
import type { SessionDetail, Boat, Course, Race, SessionShare } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { formatDuration } from "@/lib/units";
import { Button, Card, Input, Select, Textarea } from "@/components/ui/controls";
import { RaceTable } from "@/components/session/race-table";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useToast } from "@/hooks/useToast";
import { ChevronRight, Globe, Lock, Pencil, X } from "lucide-react";
import type { components } from "@/lib/api-types";

type TeamDto = components["schemas"]["TeamDto"];

interface SessionDraft {
  boatId: string;
  isPublic: boolean;
  displayName: string;
  notes: string;
  raceCourses: Record<string, string>; // raceId → courseId
}

function buildDraft(session: SessionDetail, races: Race[]): SessionDraft {
  const raceCourses: Record<string, string> = {};
  races.forEach((r) => { raceCourses[String(r.id)] = String(r.courseId ?? ""); });
  return {
    boatId: String(session.boatId ?? ""),
    isPublic: session.isPublic ?? false,
    displayName: session.displayName ?? "",
    notes: session.notes ?? "",
    raceCourses,
  };
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { navigate, isPending } = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [shares, setShares] = useState<SessionShare[]>([]);
  const [myTeams, setMyTeams] = useState<TeamDto[]>([]);
  const [shareTeamId, setShareTeamId] = useState<string>("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState<SessionDraft>({ boatId: "", isPublic: false, displayName: "", notes: "", raceCourses: {} });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.GET(`/api/v1/sessions/{id}` as any, { params: { path: { id } } } as any).then(({ data, error }: any) => {
      if (error) setError("Failed to load session");
      else {
        const s = data as SessionDetail;
        setSession(s);
      }
    });
  };

  const loadShares = () => {
    fetch(`/api/v1/sessions/${id}/shares`).then(async (res) => {
      if (res.ok) setShares(await res.json());
    });
  };

  useEffect(() => {
    load();
    api.GET("/api/v1/boats" as any, {} as any).then(({ data }: any) => setBoats((data as Boat[]) ?? []));
    api.GET("/api/v1/courses" as any, {} as any).then(({ data }: any) => setCourses((data as Course[]) ?? []));
  }, [id]);

  useEffect(() => {
    if (!session?.isOwned) return;
    loadShares();
    api.GET("/api/v1/teams" as any, {} as any).then(({ data }: any) => setMyTeams((data as TeamDto[]) ?? []));
  }, [session?.isOwned]);

  const openPanel = () => {
    if (!session) return;
    setDraft(buildDraft(session, session.races as Race[]));
    setPanelOpen(true);
  };

  const savePanel = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const sessionRes = await fetch(`/api/v1/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boatId: draft.boatId || null,
          isPublic: draft.isPublic,
          displayName: draft.displayName.trim() || null,
          notes: draft.notes || null,
        }),
      });
      if (!sessionRes.ok) { toast.push({ kind: "error", message: "Failed to update session." }); return; }

      const racePatches = (session.races as Race[])
        .filter((r) => String(r.courseId ?? "") !== draft.raceCourses[String(r.id)])
        .map((r) =>
          fetch(`/api/v1/races/${r.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseId: draft.raceCourses[String(r.id)] || null }),
          })
        );
      await Promise.all(racePatches);

      toast.push({ kind: "success", message: "Session updated." });
      setPanelOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const addShare = async () => {
    if (!shareTeamId) return;
    const res = await fetch(`/api/v1/sessions/${id}/shares`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: shareTeamId }),
    });
    if (res.ok) {
      toast.push({ kind: "success", message: "Session shared with team." });
      setShareTeamId("");
      loadShares();
    } else {
      const data = await res.json().catch(() => ({}));
      const errCode = (data as { error?: string }).error;
      toast.push({ kind: "error", message: errCode === "not_team_member" ? "You are not a member of that team." : "Failed to share." });
    }
  };

  const removeShare = async (teamId: string) => {
    const res = await fetch(`/api/v1/sessions/${id}/shares/${teamId}`, { method: "DELETE" });
    if (res.ok || res.status === 204) loadShares();
    else toast.push({ kind: "error", message: "Failed to remove share." });
  };

  const doDelete = async () => {
    const res = await fetch(`/api/v1/sessions/${id}`, { method: "DELETE" });
    setConfirm(false);
    if (res.ok || res.status === 204) {
      toast.push({ kind: "success", message: "Session deleted." });
      router.push("/sessions");
    } else toast.push({ kind: "error", message: "Failed to delete." });
  };

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (isPending || !session) return <PageSkeleton />;

  const dur = (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000;
  const sharedTeamIds = new Set(shares.map((s) => s.teamId));
  const availableTeams = myTeams.filter((t) => !sharedTeamIds.has(t.id));

  return (
    <div className={panelOpen ? "grid gap-6 lg:grid-cols-[1fr_28rem]" : undefined}>
      {/* ── Main content ── */}
      <div className="space-y-6">
        <nav className="flex items-center gap-1 text-sm text-text-secondary">
          <Link href="/sessions" className="hover:text-text-primary">Sessions</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-text-primary">{session.displayName ?? session.fileName}</span>
          {session.isPublic && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
              <Globe className="h-3 w-3" /> Public
            </span>
          )}
        </nav>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Session metadata</h2>
            {session.isOwned && (
              <Button variant="secondary" onClick={openPanel}>
                <Pencil className="mr-1 h-4 w-4" /> Edit session
              </Button>
            )}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-text-secondary">File</dt><dd>{session.fileName}</dd></div>
            <div><dt className="text-text-secondary">Format</dt><dd>v{n(session.formatVersion)} @ {n(session.telemetryRateHz)} Hz</dd></div>
            <div><dt className="text-text-secondary">Started</dt><dd>{new Date(session.startedAt).toLocaleString()}</dd></div>
            <div><dt className="text-text-secondary">Duration</dt><dd className="font-mono">{formatDuration(dur)}</dd></div>
            <div><dt className="text-text-secondary">Fixed Body frame</dt><dd>{session.isFixedToBodyFrame ? "Yes" : "No"}</dd></div>
            <div><dt className="text-text-secondary">Uploaded</dt><dd>{new Date(session.uploadedAt).toLocaleString()}</dd></div>
            <div><dt className="text-text-secondary">Boat</dt><dd>{session.boatName ?? <span className="text-text-secondary">Unassigned</span>}</dd></div>
            <div><dt className="text-text-secondary">Visibility</dt><dd>{session.isPublic ? "Public" : "Private"}</dd></div>
          </dl>
          <div className="mt-4">
            <button
              onClick={() => navigate(`/sessions/${id}/viewer`)}
              className="inline-flex items-center rounded-md border border-border-default bg-bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg-elevated"
            >
              View session data
            </button>
          </div>
        </Card>

        <RaceTable
          races={session.races as Race[]}
          onRowClick={(r) => navigate(`/races/${r.id}`)}
          showCourse
        />

        {session.isOwned && (
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold">Sharing</h2>
            {shares.length === 0 ? (
              <p className="mb-3 text-sm text-text-secondary">Not shared with any teams.</p>
            ) : (
              <ul className="mb-4 space-y-1">
                {shares.map((sh) => (
                  <li key={sh.teamId} className="flex items-center justify-between rounded border border-border-default p-2 text-sm">
                    <span>{sh.teamName}</span>
                    <button onClick={() => removeShare(sh.teamId)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </li>
                ))}
              </ul>
            )}
            {availableTeams.length > 0 && (
              <div className="flex gap-2">
                <Select value={shareTeamId} onChange={(e) => setShareTeamId(e.target.value)} className="flex-1">
                  <option value="">— Select a team —</option>
                  {availableTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
                <Button onClick={addShare} disabled={!shareTeamId}>Share</Button>
              </div>
            )}
            {myTeams.length === 0 && (
              <p className="text-sm text-text-secondary">You are not a member of any teams. <Link href="/teams" className="text-action-primary hover:underline">Create or join a team</Link> to share this session.</p>
            )}
          </Card>
        )}

        {session.isOwned && (
          <div className="flex justify-end">
            <Button variant="danger" onClick={() => setConfirm(true)}>Delete session</Button>
          </div>
        )}
      </div>

      {/* ── Edit panel ── */}
      {panelOpen && (
        <Card className="p-5 self-start">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Edit session</h2>
            <button onClick={() => setPanelOpen(false)} className="text-text-secondary hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-text-secondary">Display name</span>
              <Input
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                placeholder={session.fileName}
              />
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">Boat</span>
              <Select value={draft.boatId} onChange={(e) => setDraft({ ...draft, boatId: e.target.value })}>
                <option value="">— Unassigned —</option>
                {boats.map((b) => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}
              </Select>
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">Notes</span>
              <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} />
            </label>

            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">Visibility</span>
              <Button
                variant="secondary"
                onClick={() => setDraft({ ...draft, isPublic: !draft.isPublic })}
              >
                {draft.isPublic ? <><Globe className="mr-1 h-4 w-4" /> Public</> : <><Lock className="mr-1 h-4 w-4" /> Private</>}
              </Button>
            </div>

            {session.races.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-text-secondary">Race courses</p>
                <div className="space-y-2">
                  {(session.races as Race[]).map((r) => (
                    <div key={String(r.id)} className="flex items-center gap-2 text-sm">
                      <span className="w-16 shrink-0 text-text-secondary">Race {n(r.raceNumber)}</span>
                      <Select
                        value={draft.raceCourses[String(r.id)] ?? ""}
                        onChange={(e) => setDraft({ ...draft, raceCourses: { ...draft.raceCourses, [String(r.id)]: e.target.value } })}
                        className="flex-1"
                      >
                        <option value="">— None —</option>
                        {courses.map((c) => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPanelOpen(false)}>Cancel</Button>
              <Button onClick={savePanel} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirm}
        title="Delete session"
        message="This will permanently delete the session and all derived data."
        destructive
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
