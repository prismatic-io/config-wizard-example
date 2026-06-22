"use client";

// Generic field renderer — no brand knowledge. Drives a plain JSONFORM config var
// from its parsed schema, reading/writing the var's value as a single JSON-string
// draft via useJsonDraft.

import { ChevronDown } from "lucide-react";
import {
  parseJsonForm,
  type JsonFormField,
} from "@/lib/prismatic";
import { useJsonDraft } from "@/hooks/useJsonDraft";
import { MultiSelect } from "@/components/wizard/fields/MultiSelect";

interface JsonFormRendererProps {
  /** The baked JSONForm page-content entry (`{schema, uiSchema, data}` or a JSON string). */
  content: unknown;
  /** The current value as a JSON string (the config var's draft). */
  value: string;
  onChange: (next: string) => void;
}

type Data = Record<string, unknown>;

/**
 * Minimal schema-driven renderer for plain JSONFORM config vars — string / string+enum / boolean /
 * array, plus one level of `object` nesting. Used so structured config doesn't degrade to a raw
 * textarea. Anything outside this subset is parsed away by `parseJsonForm`, and the caller keeps the
 * textarea fallback when no fields are recognized.
 */
export function JsonFormRenderer({
  content,
  value,
  onChange,
}: JsonFormRendererProps) {
  const fields = parseJsonForm(content);
  const draft = useJsonDraft<Data>(value, onChange, {});
  const data = draft.value;

  const setTop = (key: string, v: unknown) => draft.patch({ [key]: v });

  const setNested = (objKey: string, childKey: string, v: unknown) =>
    draft.patchSlice(objKey, { [childKey]: v });

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        if (field.kind === "object") {
          const sub = draft.slice<Data>(field.key);
          return (
            <div
              key={field.key}
              className="flex flex-col gap-3 rounded-lg border border-white/10 px-4 py-3"
            >
              <span className="text-sm font-medium text-white/90">
                {field.label}
              </span>
              {(field.fields ?? []).map((child) => (
                <LeafControl
                  key={child.key}
                  field={child}
                  value={sub[child.key]}
                  onChange={(v) => setNested(field.key, child.key, v)}
                />
              ))}
            </div>
          );
        }
        return (
          <LeafControl
            key={field.key}
            field={field}
            value={data[field.key]}
            onChange={(v) => setTop(field.key, v)}
          />
        );
      })}
    </div>
  );
}

/** One leaf control: boolean checkbox, enum/string select-or-input, or array multi-select. */
function LeafControl({
  field,
  value,
  onChange,
}: {
  field: JsonFormField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  if (field.kind === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          {field.label}
          {field.required && <span className="text-red-400"> *</span>}
        </span>
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-white/60">
        {field.label}
        {field.required && <span className="text-red-400"> *</span>}
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
            className="w-full appearance-none rounded-md border border-white/15 bg-white/[0.04] py-2 pl-3 pr-9 text-sm text-white/90 focus:border-primary focus:outline-none"
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
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
          />
        </div>
      ) : (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white/90 focus:border-primary focus:outline-none"
        />
      )}
    </div>
  );
}
