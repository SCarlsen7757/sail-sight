"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export interface ThreeDotItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export function ThreeDotMenu({ items }: { items: ThreeDotItem[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
    setOpen((v) => !v);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="rounded p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
        aria-label="More actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "absolute", top: coords.top, right: coords.right }}
          className="z-50 min-w-[10rem] overflow-hidden rounded-md bg-bg-elevated shadow-lg ring-1 ring-border-default"
        >
          {items.map((it) => (
            <button
              key={it.label}
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-bg-base ${
                it.destructive ? "text-error" : "text-text-primary"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
