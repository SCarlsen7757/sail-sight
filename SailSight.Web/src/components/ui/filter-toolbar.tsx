import { Search } from "lucide-react";

export function FilterToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-bg-surface px-3 py-2">
      {children}
    </div>
  );
}

export function SearchInput({
  value, onChange, placeholder = "Search…",
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-text-secondary" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-56 rounded-md border border-border-default bg-bg-base py-1.5 pl-8 pr-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-active focus:outline-none"
      />
    </div>
  );
}
