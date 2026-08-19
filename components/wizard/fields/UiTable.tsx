"use client";

// Generic field renderer — no brand knowledge. Renders a uiSchema-declared table
// (see `parseUiTable`): label cells as text, boolean control cells as checkboxes
// bound to the config var's JSON value. Handles both editable tables (checkbox +
// label columns) and read-only, label-only summary tables.

import { useJsonDraft } from "@/hooks/useJsonDraft";
import {
  validateFormValue,
  type UiTable,
  type UiTableCell,
  type WizardSchema,
} from "@/lib/prismatic";

interface UiTableRendererProps {
  table: UiTable;
  schema: WizardSchema;
  /** The current value as a JSON string (the config var's draft). */
  value: string;
  onChange: (next: string) => void;
}

type Data = Record<string, unknown>;

/** Seed the draft with every schema property's default so a first toggle writes a complete object. */
function defaultsFromSchema(schema: WizardSchema): Data {
  return Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, node]) => [
      key,
      (node as WizardSchema).default ?? false,
    ]),
  );
}

export function UiTableRenderer({ table, schema, value, onChange }: UiTableRendererProps) {
  const draft = useJsonDraft<Data>(value, onChange, () => defaultsFromSchema(schema));
  const errors = validateFormValue(schema, value);

  const columns = Math.max(
    table.header?.length ?? 0,
    ...table.rows.map((row) => row.length),
  );
  const lastCol = columns - 1;

  const isChecked = (key: string): boolean => {
    const v = draft.value[key];
    if (typeof v === "boolean") return v;
    return (schema.properties?.[key] as WizardSchema | undefined)?.default === true;
  };

  const cellBody = (cell: UiTableCell) => {
    if (cell.kind === "control") {
      return (
        <input
          type="checkbox"
          checked={isChecked(cell.key)}
          onChange={(e) => draft.patch({ [cell.key]: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
      );
    }
    return cell.text;
  };

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full text-sm">
        {table.header && (
          <thead>
            <tr className="border-b border-neutral-200">
              {table.header.map((heading, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 text-xs font-medium text-neutral-500 ${
                    i === lastCol ? "text-right" : "text-left"
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-neutral-200">
          {table.rows.map((row, r) => {
            // A trailing label-only "Total …" row reads as the table's footer line.
            const isTotal = row[0]?.kind === "label" && row[0].text.startsWith("Total");
            return (
              <tr key={r} className={isTotal ? "font-medium text-neutral-900" : ""}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`px-3 py-2.5 ${
                      cell.kind === "control"
                        ? "w-10"
                        : c === lastCol
                          ? "text-right tabular-nums text-neutral-900"
                          : c === row.findIndex((x) => x.kind === "label")
                            ? "text-neutral-900"
                            : "text-neutral-500"
                    }`}
                  >
                    {cellBody(cell)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

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
