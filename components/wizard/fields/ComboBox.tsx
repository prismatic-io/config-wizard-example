"use client";

// Generic field renderer — no brand knowledge. A reusable single-select searchable
// combobox; the wizard's other field renderers and custom steps compose it.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import type { PicklistOption } from "@/lib/prismatic";

/** An option, optionally accent-colored (e.g. a "+ Create …" action). */
export interface ComboOption extends PicklistOption {
  accent?: boolean;
}

/** A titled section of the dropdown (e.g. "Person" / "Joint Owner" / "Trust"). */
export interface ComboGroup {
  label?: string;
  options: ComboOption[];
}

interface ComboBoxProps {
  /** Flat option list (ignored when `groups` is provided). */
  options?: ComboOption[];
  /** Selected option key ("" = nothing selected). */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /**
   * Options rendered as a visually separated group under the main list (e.g. "+ Create …"
   * actions). Ignored when `groups` is provided.
   */
  secondaryOptions?: ComboOption[];
  /** Titled option sections; takes precedence over `options`/`secondaryOptions`. */
  groups?: ComboGroup[];
  /** Borderless trigger — just the label and a chevron (for table rows). */
  ghost?: boolean;
  /** Amber-border the trigger (bordered variant only). */
  invalid?: boolean;
}

/**
 * Light single-select combobox: a trigger button showing the selected option's label, opening a
 * panel with a search box and a click-to-select list (optionally in titled groups). Like
 * MultiSelect, the panel is rendered in a portal anchored to the trigger so it floats above the
 * modal/accordion (which clip overflow) rather than being buried inside them.
 */
export function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "Select",
  secondaryOptions = [],
  groups,
  ghost = false,
  invalid = false,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const groupList = useMemo<ComboGroup[]>(
    () =>
      groups ??
      [
        { options },
        ...(secondaryOptions.length > 0 ? [{ options: secondaryOptions }] : []),
      ],
    [groups, options, secondaryOptions],
  );

  const selected = useMemo(
    () => groupList.flatMap((g) => g.options).find((o) => o.key === value),
    [groupList, value],
  );

  const q = query.trim().toLowerCase();
  const visibleGroups = groupList
    .map((g) => ({
      ...g,
      options: g.options.filter((o) => !q || o.label.toLowerCase().includes(q)),
    }))
    .filter((g) => g.options.length > 0);

  // Anchor the portal panel under the trigger; keep it aligned on scroll/resize while open.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
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

  function select(key: string) {
    onChange(key);
    setOpen(false);
    setQuery("");
  }

  const optionRow = (opt: ComboOption) => (
    <li key={opt.key}>
      <button
        type="button"
        onClick={() => select(opt.key)}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-100 ${
          opt.key === value || opt.accent ? "text-primary" : "text-neutral-700"
        }`}
      >
        <span className="flex-1 truncate">{opt.label}</span>
        {opt.key === value && <Check size={14} className="shrink-0" />}
      </button>
    </li>
  );

  const triggerClass = ghost
    ? "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-50 focus:outline-none"
    : `flex w-full items-center gap-2 rounded-md border bg-white px-3 py-2 text-left text-sm focus:border-primary focus:outline-none ${
        invalid ? "border-amber-500/60" : "border-neutral-300"
      }`;

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen((o) => !o)} className={triggerClass}>
        <span className={`flex-1 truncate ${selected ? "text-neutral-900" : "text-neutral-500"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} className="shrink-0 text-neutral-400" />
      </button>

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
            className="z-50 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg shadow-neutral-900/10"
          >
            <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
              <Search size={14} className="shrink-0 text-neutral-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {visibleGroups.length === 0 && (
                <li className="px-3 py-2 text-sm text-neutral-400">No options</li>
              )}
              {visibleGroups.map((group, gi) => (
                <li key={gi}>
                  {gi > 0 && <div aria-hidden className="my-1 border-t border-neutral-200" />}
                  {group.label && (
                    <div className="px-3 pb-1 pt-2 text-xs font-medium text-neutral-400">
                      {group.label}
                    </div>
                  )}
                  <ul>{group.options.map(optionRow)}</ul>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
