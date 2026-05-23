"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { StatsSummary, PlatformStats } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { useUnitPrefs } from "@/store/settings";
import {
  convertSpeed, convertDistance, formatDuration,
  speedUnitLabel, distanceUnitLabel,
} from "@/lib/units";
import { Card } from "@/components/ui/controls";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth-context";
import { Sailboat, BookOpen, Layers, Flag, Clock, Route, Gauge } from "lucide-react";

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-text-secondary">{label}</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-text-primary">{value}</div>
        </div>
        <Icon className="h-6 w-6 text-action-primary" />
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { me } = useAuth();
  const isLoggedIn = !!me;
  const { prefs } = useUnitPrefs();

  const [myStats, setMyStats] = useState<StatsSummary | null>(null);
  const [myStatsLoading, setMyStatsLoading] = useState(true);
  const [myStatsError, setMyStatsError] = useState<string | null>(null);

  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [platformLoading, setPlatformLoading] = useState(true);
  const [platformError, setPlatformError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) { setMyStatsLoading(false); return; }
    let mounted = true;
    api.GET("/api/v1/me/stats" as any, {}).then(({ data, error }: any) => {
      if (!mounted) return;
      if (error) setMyStatsError("Failed to load your stats");
      else setMyStats(data as StatsSummary);
      setMyStatsLoading(false);
    }).catch(() => {
      if (mounted) { setMyStatsError("Failed to load your stats"); setMyStatsLoading(false); }
    });
    return () => { mounted = false; };
  }, [isLoggedIn]);

  useEffect(() => {
    let mounted = true;
    api.GET("/api/v1/stats" as any, {}).then(({ data, error }: any) => {
      if (!mounted) return;
      if (error) setPlatformError("Failed to load platform stats");
      else setPlatformStats(data as PlatformStats);
      setPlatformLoading(false);
    }).catch(() => {
      if (mounted) { setPlatformError("Failed to load platform stats"); setPlatformLoading(false); }
    });
    return () => { mounted = false; };
  }, []);

  const hasMyData = myStats && n(myStats.totalSessions) > 0;

  return (
    <div className="space-y-8">
      {isLoggedIn && (
        <section>
          <h1 className="mb-4 text-2xl font-bold">My stats</h1>
          {myStatsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonLoader key={i} className="h-28" />)}
            </div>
          ) : myStatsError ? (
            <ErrorBanner message={myStatsError} onRetry={() => location.reload()} />
          ) : !hasMyData ? (
            <EmptyState
              title="No sessions yet"
              description="Upload your first .vkx file to get started."
              actionLabel="Upload session"
              actionHref="/upload"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Boats" value={String(n(myStats!.totalBoats))} icon={Sailboat} />
              <StatCard label="Sessions" value={String(n(myStats!.totalSessions))} icon={Layers} />
              <StatCard label="Races" value={String(n(myStats!.totalRaces))} icon={Flag} />
              <StatCard label="Total session time" value={formatDuration(n(myStats!.totalSessionDurationSeconds))} icon={Clock} />
              <StatCard
                label="Distance sailed"
                value={`${convertDistance(n(myStats!.totalSailedDistanceMeters), prefs.course).toFixed(1)} ${distanceUnitLabel(prefs.course)}`}
                icon={Route}
              />
              <StatCard
                label="Top SOG"
                value={`${convertSpeed(n(myStats!.topSpeedOverGround), prefs.boatSpeed).toFixed(1)} ${speedUnitLabel(prefs.boatSpeed)}`}
                icon={Gauge}
              />
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className={`mb-4 font-bold ${isLoggedIn ? "text-xl" : "text-2xl"}`}>Platform stats</h2>
        {platformLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonLoader key={i} className="h-28" />)}
          </div>
        ) : platformError ? (
          <ErrorBanner message={platformError} onRetry={() => location.reload()} />
        ) : platformStats ? (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Fleet</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Boat classes" value={String(n(platformStats.boatClassCount))} icon={BookOpen} />
                <StatCard label="Registered boats" value={String(n(platformStats.boatCount))} icon={Sailboat} />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Sailing</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Sessions" value={String(n(platformStats.sessionCount))} icon={Layers} />
                <StatCard label="Total session time" value={formatDuration(n(platformStats.totalSessionDurationSeconds))} icon={Clock} />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Racing</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Races" value={String(n(platformStats.raceCount))} icon={Flag} />
                <StatCard label="Total race time" value={formatDuration(n(platformStats.totalRaceDurationSeconds))} icon={Clock} />
                <StatCard
                  label="Total race distance"
                  value={`${convertDistance(n(platformStats.totalRaceDistanceMeters), prefs.course).toFixed(1)} ${distanceUnitLabel(prefs.course)}`}
                  icon={Route}
                />
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
