"use client";

import { use, useEffect, useState } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { SessionDetail, Race } from "@/lib/schemas";
import { formatDuration } from "@/lib/units";
import { Card } from "@/components/ui/controls";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { RaceTable } from "@/components/session/race-table";
import { Globe } from "lucide-react";

export default function PublicSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.GET(`/api/v1/sessions/{id}` as any, { params: { path: { id } } } as any).then(({ data, error }: any) => {
      if (error) setError("This session is not available or is private.");
      else setSession(data as SessionDetail);
    });
  }, [id]);

  if (error) return <ErrorBanner message={error} />;
  if (!session) return <PageSkeleton />;
  if (!session.isPublic && !session.isOwned) {
    return <ErrorBanner message="This session is not public." />;
  }

  const title = session.displayName ?? session.fileName;
  const duration = (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000;
  const races = (session.races ?? []) as Race[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/sessions" className="text-sm text-text-secondary hover:text-text-primary">← Sessions</Link>
        <h1 className="text-2xl font-bold">{title}</h1>
        <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
          <Globe className="h-3 w-3" /> Public
        </span>
      </div>
      {session.displayName && (
        <div className="text-sm text-text-secondary">File: {session.fileName}</div>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Overview</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
          <Field label="Boat" value={
            session.boatId
              ? <Link href={`/b/${session.boatId}`} className="text-action-primary hover:underline">{session.boatName ?? "—"}</Link>
              : (session.boatName ?? "—")
          } />
          <Field label="Started" value={new Date(session.startedAt).toLocaleString()} />
          <Field label="Ended" value={new Date(session.endedAt).toLocaleString()} />
          <Field label="Duration" value={formatDuration(duration)} />
          <Field label="Format" value={`v${session.formatVersion}`} />
          <Field label="Telemetry rate" value={`${session.telemetryRateHz} Hz`} />
          <Field label="Races" value={String(races.length)} />
        </dl>
      </Card>

      {races.length > 0 && (
        <RaceTable
          races={races}
          onRowClick={(r) => router.push(`/r/${r.id}`)}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-text-secondary">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

