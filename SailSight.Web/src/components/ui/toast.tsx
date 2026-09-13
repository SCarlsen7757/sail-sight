"use client";

import { useToastList, dismissToast, type Toast } from "@/hooks/useToast";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

const KIND_STYLES: Record<Toast["kind"], { icon: React.ReactNode; ring: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5 text-success" />, ring: "ring-success/40" },
  info: { icon: <Info className="h-5 w-5 text-info" />, ring: "ring-info/40" },
  warning: { icon: <AlertTriangle className="h-5 w-5 text-warning" />, ring: "ring-warning/40" },
  error: { icon: <XCircle className="h-5 w-5 text-error" />, ring: "ring-error/40" },
};

export function ToastContainer() {
  const toasts = useToastList();
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const s = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-md bg-bg-elevated px-4 py-3 shadow-lg ring-1",
              s.ring
            )}
          >
            {s.icon}
            <p className="flex-1 text-sm text-text-primary">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-text-secondary hover:text-text-primary"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
