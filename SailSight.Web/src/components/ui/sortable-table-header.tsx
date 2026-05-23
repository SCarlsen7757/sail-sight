"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc" | null;

export function SortableTableHeader<K extends string>({
  label,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  label: string;
  field: K;
  sortField: K | null;
  sortDir: SortDir;
  onSort: (field: K) => void;
}) {
  const active = sortField === field && sortDir;
  return (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
      onClick={() => onSort(field)}
    >
      <div className="inline-flex items-center gap-1">
        {label}
        {active === "asc" ? <ChevronUp className="h-3 w-3" /> :
          active === "desc" ? <ChevronDown className="h-3 w-3" /> :
            <ChevronsUpDown className="h-3 w-3 opacity-40" />}
      </div>
    </th>
  );
}
