"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";

import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Overflow ("⋯") menu: keyboard and outside-click dismissible, right-aligned. */
export function Menu({ items, label = "More actions", disabled }: { items: MenuItem[]; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40",
          open && "bg-panel-2 text-fg",
        )}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className="rise absolute top-full right-0 z-40 mt-1.5 min-w-48 rounded-xl bg-panel p-1 shadow-2xl ring-1 ring-line">
          {items.map(({ label: l, icon: Icon, onSelect, danger, disabled: d }) => (
            <button
              key={l}
              type="button"
              role="menuitem"
              disabled={d}
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors disabled:opacity-40",
                danger ? "text-err hover:bg-err/10" : "text-fg hover:bg-panel-2",
              )}
            >
              <Icon size={14} className={danger ? "text-err" : "text-muted"} />
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
