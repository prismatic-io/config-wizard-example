"use client";

// Generic field renderer — no brand knowledge. One labeled control driven by a parsed
// FieldDescriptor: boolean checkbox, array multi-select (free-text when it has no options),
// enum single-select, or free-text input. Shared by the generic JSONFORM renderer and the
// example's per-category Delivery step so the schema → control mapping lives in one place.

import { ChevronDown } from "lucide-react";
import type { FieldDescriptor } from "@/lib/prismatic";
import { MultiSelect } from "@/components/wizard/fields/MultiSelect";

export function FieldControl({
  field,
  value,
  onChange,
  placeholder,
}: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (next: unknown) => void;
  /** Free-text placeholder for the `string` control (e.g. "HH:MM" for quiet hours). */
  placeholder?: string;
}) {
  if (field.kind === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          {field.label}
          {field.required && <span className="text-red-600"> *</span>}
        </span>
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-500">
        {field.label}
        {field.required && <span className="text-red-600"> *</span>}
      </label>
      {field.kind === "array" ? (
        <MultiSelect
          options={field.options}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          placeholder="Select"
          allowCustom={field.options.length === 0}
        />
      ) : field.kind === "enum" ? (
        <div className="relative">
          <select
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-9 text-sm text-neutral-900 focus:border-primary focus:outline-none"
          >
            <option value="">Select</option>
            {field.options.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
        </div>
      ) : (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none"
        />
      )}
    </div>
  );
}
