"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui/controls";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { useToast } from "@/hooks/useToast";
import type { BoatClassRequest } from "@/lib/schemas";

export default function AdminBoatClassesPage() {
  const toast = useToast();
  const [requests, setRequests] = useState<BoatClassRequest[] | null>(null);

  const load = () => {
    fetch("/api/v1/admin/boat-class-requests").then(async (res) => {
      if (res.ok) setRequests(await res.json());
      else setRequests([]);
    });
  };

  useEffect(load, []);

  const approve = async (id: string) => {
    const res = await fetch(`/api/v1/admin/boat-class-requests/${id}/approve`, { method: "POST" });
    if (res.ok) {
      toast.push({ kind: "success", message: "Request approved — boat class created." });
      load();
    } else toast.push({ kind: "error", message: "Failed to approve." });
  };

  const reject = async (id: string) => {
    const res = await fetch(`/api/v1/admin/boat-class-requests/${id}/reject`, { method: "POST" });
    if (res.ok) {
      toast.push({ kind: "success", message: "Request rejected." });
      load();
    } else toast.push({ kind: "error", message: "Failed to reject." });
  };

  const pending = requests?.filter((r) => r.status === "Pending") ?? [];
  const reviewed = requests?.filter((r) => r.status !== "Pending") ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-action-primary">Boat class requests</h1>

      {requests === null ? (
        <SkeletonLoader className="h-40" />
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-lg font-semibold">Pending ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-text-secondary">No pending requests.</p>
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-text-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Requested by</th>
                      <th className="px-3 py-2 text-left">Length (m)</th>
                      <th className="px-3 py-2 text-left">Width (m)</th>
                      <th className="px-3 py-2 text-left">Weight (kg)</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                      <th className="px-3 py-2 text-left">Submitted</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((r) => (
                      <tr key={r.id} className="border-t border-border-default text-sm">
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-text-secondary">{r.requestedByEmail}</td>
                        <td className="px-3 py-2 text-text-secondary">{r.length ?? "—"}</td>
                        <td className="px-3 py-2 text-text-secondary">{r.width ?? "—"}</td>
                        <td className="px-3 py-2 text-text-secondary">{r.weight ?? "—"}</td>
                        <td className="px-3 py-2 text-text-secondary max-w-xs truncate">{r.notes ?? "—"}</td>
                        <td className="px-3 py-2 text-text-secondary">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <Button onClick={() => approve(r.id)}>Approve</Button>
                            <Button variant="danger" onClick={() => reject(r.id)}>Reject</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>

          {reviewed.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">Reviewed</h2>
              <Card className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-text-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Submitted</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewed.map((r) => (
                      <tr key={r.id} className="border-t border-border-default text-sm">
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 text-text-secondary">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className={`px-3 py-2 font-medium ${r.status === "Approved" ? "text-green-400" : "text-red-400"}`}>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
