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

/** Build one delivery field's JSON-schema node. The wizard control shows option LABELS. */
const deliveryFieldNode = (field: DeliveryFieldSpec): Record<string, unknown> => {
  const labels = field.options.map((o) => o.label);
  if (field.multi) {
    return {
      type: "array",
      title: field.label,
      items:
        labels.length > 0
          ? { type: "string", enum: labels }
          : { type: "string" }, // free-text multi-select
    };
  }
  // Single value: a dropdown when there are options, otherwise a free-text input (quiet hours).
  return labels.length > 0
    ? { type: "string", title: field.label, enum: labels }
    : { type: "string", title: field.label };
};

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

  const channelsNode: Record<string, unknown> = {
    type: "array",
    title: adapter.channelTitle,
    items: { type: "string", enum: adapter.channelOptions.map((c) => c.key) },
    // Non-standard carriers the wizard reads: option labels + an icon hint.
    options: adapter.channelOptions,
  };
  if (adapter.channelIcon) channelsNode["x-icon"] = adapter.channelIcon;

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
