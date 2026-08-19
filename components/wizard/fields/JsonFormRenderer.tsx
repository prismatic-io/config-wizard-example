"use client";

// Generic field renderer — no brand knowledge. Drives a plain JSONFORM config var from its
// parsed schema, reading/writing the var's value as a single JSON-string draft via useJsonDraft.
// The schema is parsed ONCE here. A schema we can't render faithfully (or unparseable content)
// drops to the single deliberate escape hatch — a raw-JSON textarea — rather than guessing.

import {
  jsonFormSchema,
  parseSchemaFields,
  parseUiTable,
  validateFormValue,
  type FieldDescriptor,
  type WizardSchema,
} from "@/lib/prismatic";
import { useJsonDraft } from "@/hooks/useJsonDraft";
import { FieldControl } from "@/components/wizard/fields/FieldControl";
import { UiTableRenderer } from "@/components/wizard/fields/UiTable";

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
 * array, plus one level of `object` nesting. Anything outside this subset (or unparseable content)
 * yields the raw-JSON textarea escape hatch so structured config never hard-blocks an integration.
 */
export function JsonFormRenderer({ content, value, onChange }: JsonFormRendererProps) {
  const schema = jsonFormSchema(content);

  // A uiSchema that declares a row-wise table renders as one (checkbox + label columns).
  const table = schema ? parseUiTable(content) : null;
  if (schema && table) {
    return <UiTableRenderer table={table} schema={schema} value={value} onChange={onChange} />;
  }

  const fields = parseSchemaFields(schema);

  if (fields === null || !schema) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        spellCheck={false}
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs text-neutral-900 focus:border-primary focus:outline-none"
      />
    );
  }

  return <JsonFormFields schema={schema} fields={fields} value={value} onChange={onChange} />;
}

/** The structured form once we know the schema is renderable (keeps the draft hook unconditional). */
function JsonFormFields({
  schema,
  fields,
  value,
  onChange,
}: {
  schema: WizardSchema;
  fields: FieldDescriptor[];
  value: string;
  onChange: (next: string) => void;
}) {
  const draft = useJsonDraft<Data>(value, onChange, {});
  const data = draft.value;
  const errors = validateFormValue(schema, value);

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
              className="flex flex-col gap-3 rounded-lg border border-neutral-200 px-4 py-3"
            >
              <span className="text-sm font-medium text-neutral-900">{field.label}</span>
              {(field.fields ?? []).map((child) => (
                <FieldControl
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
          <FieldControl
            key={field.key}
            field={field}
            value={data[field.key]}
            onChange={(v) => setTop(field.key, v)}
          />
        );
      })}

      {errors.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-red-600">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
