// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. A minimal model + parser for JSONFORM config vars: pull the schema
// and baked default data out of a page-content entry, and flatten a schema into a
// simple field list the fallback renderer can drive. This is the generic path for
// plain integrations; integration-specific JSONFORM schemas (e.g. the brand
// "Configuration" var) build their own parser on top of these helpers.
// ─────────────────────────────────────────────────────────────────────────────

import type { PicklistOption } from "./types";

/** A JSON-Schema-ish node we walk (only the bits we read). */
export interface SchemaNode {
  type?: string;
  title?: string;
  description?: string;
  enum?: string[];
  items?: SchemaNode;
  required?: string[];
  options?: PicklistOption[];
  "x-icon"?: string;
  properties?: Record<string, SchemaNode>;
}

/** Pull the `{ schema }` out of a JSONForm page-content entry (tolerate a JSON string). */
export function jsonFormSchema(content: unknown): SchemaNode | undefined {
  let form = content;
  if (typeof form === "string") {
    try {
      form = JSON.parse(form);
    } catch {
      return undefined;
    }
  }
  return (form as { schema?: SchemaNode } | null)?.schema;
}

/** Pull the baked default `data` out of a JSONForm page-content entry, as a JSON string. */
export function jsonFormData(content: unknown): string | undefined {
  let form = content;
  if (typeof form === "string") {
    try {
      form = JSON.parse(form);
    } catch {
      return undefined;
    }
  }
  const data = (form as { data?: unknown } | null)?.data;
  return data === undefined ? undefined : JSON.stringify(data, null, 2);
}

/** Normalize a node's enum into {key,label} options (key === label for these static lists). */
export function nodeOptions(node: SchemaNode | undefined): PicklistOption[] {
  const values = node?.enum ?? node?.items?.enum ?? [];
  return values.map((v) => ({ key: v, label: v }));
}

/** A leaf control kind the generic JSONFORM renderer supports. */
export type JsonFormFieldKind = "string" | "enum" | "boolean" | "array";

/** One field in a generic JSONFORM. `object` carries one level of nested `fields`. */
export interface JsonFormField {
  key: string;
  label: string;
  kind: JsonFormFieldKind | "object";
  /** Options for `enum` and `array` (empty array → free-text multi-select). */
  options: PicklistOption[];
  required: boolean;
  /** Present for `object` — one level of nested leaf fields. */
  fields?: JsonFormField[];
}

/** Classify a single schema node into a leaf field kind (no object handling). */
function leafField(
  key: string,
  node: SchemaNode | undefined,
  required: string[],
): JsonFormField {
  const base = {
    key,
    label: node?.title ?? key,
    options: nodeOptions(node),
    required: required.includes(key),
  };
  if (node?.type === "boolean") return { ...base, kind: "boolean" };
  if (node?.type === "array") return { ...base, kind: "array" };
  if (node?.type === "string" && (node.enum?.length ?? 0) > 0) {
    return { ...base, kind: "enum" };
  }
  return { ...base, kind: "string" };
}

/**
 * Parses a generic JSONFORM schema into a flat field list for the fallback renderer. Supports
 * string / string+enum / boolean / array, plus one level of `object` nesting; anything deeper is
 * ignored (callers fall back to a raw textarea when this returns []).
 */
export function parseJsonForm(content: unknown): JsonFormField[] {
  const schema = jsonFormSchema(content);
  const properties = schema?.properties;
  if (!properties || typeof properties !== "object") return [];

  const required = schema?.required ?? [];
  const fields: JsonFormField[] = [];
  for (const [key, node] of Object.entries(properties)) {
    if (node?.type === "object" && node.properties) {
      const childRequired = node.required ?? [];
      fields.push({
        key,
        label: node.title ?? key,
        kind: "object",
        options: [],
        required: required.includes(key),
        fields: Object.entries(node.properties).map(([ck, cn]) =>
          leafField(ck, cn, childRequired),
        ),
      });
    } else {
      fields.push(leafField(key, node, required));
    }
  }
  return fields;
}
