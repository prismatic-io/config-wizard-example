import type { JSONForm } from "@prismatic-io/spectral";
import type { CategoryModule, ChannelAdapter, DeliveryFieldSpec } from "./types";

/** One category's delivery rules persisted by the holistic Configuration jsonForm. */
export interface DeliverySelection {
  channels?: string[];
  mode?: string;
  minLevel?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  [key: string]: unknown;
}

/** Per-category selection persisted by the holistic Configuration jsonForm (the var's value/data). */
export interface CategorySelection {
  enabled?: boolean;
  delivery?: DeliverySelection;
}

/** Tolerant parse of the Configuration value (CNI may hand back an object or a JSON string). */
export const parseSelection = (
  raw: unknown,
): Record<string, CategorySelection> => {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object"
    ? (value as Record<string, CategorySelection>)
    : {};
};

/**
 * Build a picklist JSON-schema node under ONE convention shared by channels and delivery fields: the
 * standard `enum` carries the option VALUES (so ajv can validate the stored data) and the non-standard
 * `options` extension carries the {key,label} pairs the wizard renders. Empty options ⇒ a free-text
 * input (single) or free-text multi-select (multi).
 */
const optionsNode = (
  options: { key: string; label: string }[],
  { multi, title, icon }: { multi: boolean; title: string; icon?: string },
): Record<string, unknown> => {
  const keys = options.map((o) => o.key);
  const node: Record<string, unknown> = multi
    ? {
        type: "array",
        title,
        items: keys.length > 0 ? { type: "string", enum: keys } : { type: "string" },
      }
    : keys.length > 0
      ? { type: "string", title, enum: keys }
      : { type: "string", title };
  if (options.length > 0) node.options = options;
  if (icon) node["x-icon"] = icon;
  return node;
};

/** Build one delivery field's node. `DeliveryOption.value` is the stored value; `label` is displayed. */
const deliveryFieldNode = (field: DeliveryFieldSpec): Record<string, unknown> =>
  optionsNode(
    field.options.map((o) => ({ key: o.value, label: o.label })),
    { multi: field.multi, title: field.label },
  );

/**
 * Builds the single holistic Configuration jsonForm rendered by the custom config wizard, from the list of
 * notification categories the integration routes. Each category node carries the FULL shape up front —
 * `enabled` plus a `delivery` object (a `channels` multi-select pre-loaded with the adapter's live options,
 * and one node per `DeliveryFieldSpec`: mode, minLevel, quiet-hours times). The wizard renders the General
 * step (enable categories) and, per ENABLED category, a Delivery step over this one value. No per-page
 * server round-trip is needed because everything is enumerated here.
 *
 * The category/delivery data comes from the per-category libs (each exports a `CategoryModule`).
 */
export const buildConfigForm = (
  adapter: ChannelAdapter,
  modules: CategoryModule[],
): JSONForm => {
  const properties: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};

  const channelsNode = optionsNode(adapter.channelOptions, {
    multi: true,
    title: adapter.channelTitle,
    icon: adapter.channelIcon,
  });

  for (const { category, delivery } of modules) {
    const fieldProps: Record<string, unknown> = { channels: { ...channelsNode } };
    const fieldData: Record<string, unknown> = { channels: [] };
    const required: string[] = ["channels"];

    for (const field of delivery) {
      fieldProps[field.key] = deliveryFieldNode(field);
      fieldData[field.key] = field.multi ? [] : field.default ?? "";
      if (field.required) required.push(field.key);
    }

    properties[category.key] = {
      type: "object",
      title: category.label,
      description: category.description,
      properties: {
        enabled: { type: "boolean", title: `Enable ${category.label}` },
        delivery: {
          type: "object",
          title: "Delivery rules",
          properties: fieldProps,
          required,
        },
      },
    };
    data[category.key] = {
      enabled: false,
      delivery: fieldData,
    };
  }

  return {
    schema: { type: "object", properties } as JSONForm["schema"],
    uiSchema: {
      type: "VerticalLayout",
      elements: [{ type: "Control", scope: "#" }],
    } as JSONForm["uiSchema"],
    data,
  };
};
