"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default px-3 py-2 text-sm text-text-secondary">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-border-default bg-bg-surface px-2 py-1 text-text-primary"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded p-1 disabled:opacity-30 hover:bg-bg-elevated"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span>{page} / {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded p-1 disabled:opacity-30 hover:bg-bg-elevated"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
