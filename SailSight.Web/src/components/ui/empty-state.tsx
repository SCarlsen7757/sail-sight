import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      {description && <p className="mt-2 text-sm text-text-secondary">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-white hover:bg-action-hover"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
