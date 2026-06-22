"use client";

// Generic field renderer — no brand knowledge. A reusable multi-select control;
// the wizard's other field renderers and custom steps compose it.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import type { PicklistOption } from "@/lib/prismatic";

interface MultiSelectProps {
  options: PicklistOption[];
  /** Selected option keys. */
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Optional leading icon inside the trigger button. */
  icon?: ReactNode;
  /** Allow typing arbitrary values (for free-text valuelist fields like Assets). */
  allowCustom?: boolean;
}

/**
 * Dark multi-select dropdown: a trigger button with a count badge, opening a panel with a search box, an
 * "All" toggle, and a checkbox list. The panel is rendered in a portal anchored to the trigger so it
 * floats above the modal/accordion (which clip overflow) rather than being buried inside them. With
 * `allowCustom`, the search box can add arbitrary values (for free-text filter fields with no fixed list).
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select",
  icon,
  allowCustom = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = new Set(value);

  // Custom-added values (selected but not in the option list) shown alongside options.
  const merged = useMemo<PicklistOption[]>(() => {
    const known = new Set(options.map((o) => o.key));
    const extras = value.filter((v) => !known.has(v)).map((v) => ({ key: v, label: v }));
    return [...options, ...extras];
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((o) => o.label.toLowerCase().includes(q));
  }, [merged, query]);

  const allSelected = merged.length > 0 && merged.every((o) => selected.has(o.key));
  const canAdd =
    allowCustom &&
    query.trim().length > 0 &&
    !merged.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  // Anchor the portal panel under the trigger; keep it aligned on scroll/resize while open.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next]);
  }

  function addCustom() {
    const v = query.trim();
    if (!v || selected.has(v)) return;
    onChange([...value, v]);
    setQuery("");
  }

  function toggleAll() {
    onChange(allSelected ? [] : merged.map((o) => o.key));
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-left text-sm text-white/90 focus:border-primary focus:outline-none"
      >
        {icon}
        <span className="flex-1 truncate text-white/60">{placeholder}</span>
        {value.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-white">
            {value.length}
          </span>
        )}
        <ChevronDown size={16} className="shrink-0 text-white/40" />
      </button>

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
            className="z-50 overflow-hidden rounded-md border border-white/15 bg-surface-header shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <Search size={14} className="shrink-0 text-white/40" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAdd) {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Search"
                className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={toggleAll}
                className="shrink-0 text-xs font-medium text-white/60 hover:text-white"
              >
                All
              </button>
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {canAdd && (
                <li>
                  <button
                    type="button"
                    onClick={addCustom}
                    className="w-full px-3 py-1.5 text-left text-sm text-primary hover:bg-white/5"
                  >
                    Add &ldquo;{query.trim()}&rdquo;
                  </button>
                </li>
              )}
              {filtered.length === 0 && !canAdd && (
                <li className="px-3 py-2 text-sm text-white/40">No options</li>
              )}
              {filtered.map((opt) => (
                <li key={opt.key}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={selected.has(opt.key)}
                      onChange={() => toggle(opt.key)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
