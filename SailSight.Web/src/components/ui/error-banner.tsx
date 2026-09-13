import { AlertTriangle } from "lucide-react";

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 px-4 py-3 text-sm text-text-primary">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded border border-error/40 px-2 py-1 text-xs text-error hover:bg-error/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}
