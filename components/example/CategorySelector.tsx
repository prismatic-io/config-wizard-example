"use client";

// THIS EXAMPLE's custom step — the "General" category-selection UI. Edits a slice of the
// single holistic Configuration var via useJsonDraft; the wizard feeds it that var's
// value/onChange through engine.field(configVar.key). Replace with your own for a
// different integration.

import type { CategoryConfig } from "@/lib/example/configuration";
import { useJsonDraft } from "@/hooks/useJsonDraft";

interface CategorySelectorProps {
  /** The integration-defined notification categories (parsed from the JSON Form). */
  categories: CategoryConfig[];
  /** The current selections JSON string (the config var's draft value). */
  value: string;
  /** Called with the next selections JSON string whenever the user changes something. */
  onChange: (next: string) => void;
}

/** One category's slice — only the enable toggle is set here; the Delivery step writes `delivery`. */
interface CategorySelection {
  enabled?: boolean;
  delivery?: Record<string, unknown>;
}
type Selections = Record<string, CategorySelection>;

/**
 * Category selection (General step): one row per notification category with an enable checkbox, label,
 * and description. Enabling a category reveals a Delivery step for it later in the wizard. Selections
 * persist as a JSON string of `{ <categoryKey>: { enabled, delivery } }`; this step only touches
 * `enabled`, merging via `patchSlice` so a category's `delivery` rules survive a toggle.
 */
export function CategorySelector({
  categories,
  value,
  onChange,
}: CategorySelectorProps) {
  const draft = useJsonDraft<Selections>(value, onChange, {});
  const selections = draft.value;

  if (categories.length === 0) {
    return (
      <p className="text-sm text-white/50">
        No notification categories available.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {categories.map((category) => {
        const enabled = selections[category.key]?.enabled === true;
        return (
          <label
            key={category.key}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 px-4 py-3 hover:bg-white/[0.03]"
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) =>
                draft.patchSlice<CategorySelection>(category.key, {
                  enabled: e.target.checked,
                })
              }
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-medium text-white/90">{category.label}</span>
              {category.description && (
                <span className="block text-xs text-white/50">
                  {category.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
