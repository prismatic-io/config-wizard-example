// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. A JSONFORM config var IS a JSONForms document (https://jsonforms.io):
// `{ schema, uiSchema, data }`, where `schema` is a JSON Schema (draft-07). We don't
// re-model it — we use the real `JsonSchema7` type and validate with `ajv`. This file
// adds only what the de-branded wizard needs: pull the schema/data out of a page-content
// entry, validate a value against the schema, and flatten the schema into a simple field
// list our custom controls drive. Integration-specific schemas (e.g. the brand
// "Configuration" var) build their own parser on top of these helpers.
//
// No soft fallbacks: a node we can't render faithfully yields `null`, and the caller
// shows the raw-JSON escape hatch rather than guessing. Display options live in ONE place
// (the `options` extension); `enum` carries the values for validation only.
// ─────────────────────────────────────────────────────────────────────────────

import type { JsonSchema7 } from "@jsonforms/core";
import Ajv from "ajv";
import type { PicklistOption } from "./types";

/**
 * A JSONForms JSON-Schema node plus our two documented, display-only extensions. `options` carries
 * the {key,label} pairs a picklist renders (the standard `enum` holds the matching values, used for
 * validation). `x-icon` is an icon hint the wizard maps to a lucide glyph.
 */
export type WizardSchema = JsonSchema7 & {
  options?: PicklistOption[];
  "x-icon"?: string;
};

/** A parsed JSONForm page-content entry. */
interface FormContent {
  schema?: WizardSchema;
  uiSchema?: unknown;
  data?: unknown;
}

/** Parse a JSONForm page-content entry exactly once. Returns null on malformed/non-object input. */
function parseFormContent(content: unknown): FormContent | null {
  let form = content;
  if (typeof form === "string") {
    try {
      form = JSON.parse(form);
    } catch {
      return null;
    }
  }
  return form && typeof form === "object" ? (form as FormContent) : null;
}

/** Pull the `{ schema }` out of a JSONForm page-content entry. */
export function jsonFormSchema(content: unknown): WizardSchema | undefined {
  return parseFormContent(content)?.schema;
}

/** Pull the baked default `data` out of a JSONForm page-content entry, as a JSON string. */
export function jsonFormData(content: unknown): string | undefined {
  const data = parseFormContent(content)?.data;
  return data === undefined ? undefined : JSON.stringify(data, null, 2);
}

/** A picklist's display options come from the `options` extension — and only there. */
export function nodeOptions(node: WizardSchema | undefined): PicklistOption[] {
  return node?.options ?? [];
}

/** A leaf control kind the wizard's controls support. */
export type FieldKind = "string" | "enum" | "boolean" | "array";

/** One field in a parsed schema. `object` carries one level of nested leaf fields. */
export interface FieldDescriptor {
  key: string;
  label: string;
  kind: FieldKind | "object";
  /** Options for `enum` and `array` (empty array on `array` → free-text multi-select). */
  options: PicklistOption[];
  required: boolean;
  /** Present for `object` — one level of nested leaf fields. */
  fields?: FieldDescriptor[];
}

/** Classify a single leaf node, or null when it falls outside what we render faithfully. */
function leafKind(node: WizardSchema): FieldKind | null {
  switch (node.type) {
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "string":
      if (node.options?.length) return "enum";
      // A constrained string with no display labels can't be rendered as a faithful picklist.
      if (node.enum?.length) return null;
      return "string";
    default:
      return null;
  }
}

/**
 * Classify ONE schema node into a field descriptor, or `null` when it falls outside the subset the
 * wizard renders faithfully — no `title`, an unknown/constrained-but-unlabeled type, or nesting deeper
 * than one level. The caller shows the raw-JSON escape hatch rather than guessing. No `title ?? key`.
 */
export function describeField(
  key: string,
  node: WizardSchema | undefined,
  required: string[],
): FieldDescriptor | null {
  if (!node || typeof node.title !== "string") return null;

  const base = {
    key,
    label: node.title,
    options: nodeOptions(node),
    required: required.includes(key),
  };

  if (node.type === "object") {
    if (!node.properties) return null;
    const childRequired = node.required ?? [];
    const fields: FieldDescriptor[] = [];
    for (const [childKey, childNode] of Object.entries(node.properties)) {
      const child = describeField(childKey, childNode as WizardSchema, childRequired);
      // Only one level of nesting: a nested object (or any unrenderable child) bails to the escape hatch.
      if (!child || child.kind === "object") return null;
      fields.push(child);
    }
    return { ...base, kind: "object", options: [], fields };
  }

  const kind = leafKind(node);
  return kind ? { ...base, kind } : null;
}

/**
 * Flatten an already-parsed JSONFORM schema into a field list. Returns `null` when any property falls
 * outside the renderable subset, so the caller shows the raw-JSON escape hatch instead of a partial
 * form. Supports string / string+enum / boolean / array, plus one level of `object` nesting.
 */
export function parseSchemaFields(
  schema: WizardSchema | undefined,
): FieldDescriptor[] | null {
  if (!schema?.properties) return null;

  const required = schema.required ?? [];
  const fields: FieldDescriptor[] = [];
  for (const [key, node] of Object.entries(schema.properties)) {
    const field = describeField(key, node as WizardSchema, required);
    if (!field) return null;
    fields.push(field);
  }
  return fields;
}

/** Convenience wrapper: parse a page-content entry's schema and flatten it in one call. */
export function parseJsonForm(content: unknown): FieldDescriptor[] | null {
  return parseSchemaFields(jsonFormSchema(content));
}

// `strict: false` so our non-standard `options`/`x-icon` keywords are ignored rather than rejected.
const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Validate a JSON-string `value` against its JSONForm `schema` with ajv. Returns human-readable error
 * strings ([] === valid). Surfaced by the renderer instead of silently tolerating mismatched data.
 */
export function validateFormValue(schema: WizardSchema, value: string): string[] {
  let data: unknown;
  try {
    data = value ? JSON.parse(value) : {};
  } catch {
    return ["Value is not valid JSON."];
  }
  const validate = ajv.compile(schema);
  if (validate(data)) return [];
  return (validate.errors ?? []).map(
    (e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`.trim(),
  );
}
