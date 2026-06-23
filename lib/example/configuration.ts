// ─────────────────────────────────────────────────────────────────────────────
// THIS EXAMPLE's notification domain — the part you replace for your own integration.
//
// This integration models its entire product configuration as ONE holistic
// "Configuration" JSONFORM config var: a schema enumerating every notification
// category, each with an enable toggle plus a `delivery` group (destination channels +
// delivery mode + minimum level + quiet hours). `parseConfiguration` normalizes that
// schema into a `CategoryConfig[]` the wizard's custom steps render. None of this is
// known to the generic engine — swap this file (and components/example/configurationPlugin.tsx) for your own
// schema and the engine is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import {
  jsonFormSchema,
  nodeOptions,
  describeField,
  type FieldDescriptor,
  type WizardSchema,
  type PicklistOption,
} from "@/lib/prismatic";

/**
 * One notification category parsed from the single holistic "Configuration" jsonForm. Carries the
 * enable toggle's identity (key/label/description) plus the per-category delivery bits: the live channel
 * picker the integration baked in, and the remaining delivery fields (mode, minimum level, quiet hours).
 * The General step renders the category list; each enabled category's Delivery step renders the channel
 * picker + delivery fields — all reading/writing slices of one config var value.
 */
export interface CategoryConfig {
  key: string;
  label: string;
  description?: string;
  /** Live channel options the integration baked in for the per-category channel picker. */
  channelOptions: PicklistOption[];
  /** Channel-picker label supplied by the integration (e.g. "Send to Slack channel"). */
  channelLabel?: string;
  /** Icon hint the wizard maps to a lucide icon (e.g. "hash"). */
  channelIcon?: string;
  /** The delivery-rule fields other than channels (mode, minimum level, quiet hours, …). */
  deliveryFields: FieldDescriptor[];
}

/**
 * Normalizes the single holistic Configuration jsonForm into a category list. Each top-level schema
 * property is a category object with an `enabled` boolean plus a `delivery` object that holds the
 * `channels` picker and the remaining delivery fields. Returns [] on anything unexpected — which is also
 * the natural "this isn't the rich Configuration var" signal.
 */
export function parseConfiguration(content: unknown): CategoryConfig[] {
  const properties = jsonFormSchema(content)?.properties;
  if (!properties) return [];

  const categories: CategoryConfig[] = [];
  for (const [key, node] of Object.entries(properties) as [string, WizardSchema][]) {
    const delivery = node.properties?.delivery as WizardSchema | undefined;
    // A category is an object with an `enabled` toggle and a `delivery` group; anything else isn't one.
    if (
      node.type !== "object" ||
      typeof node.title !== "string" ||
      !node.properties?.enabled ||
      !delivery?.properties
    ) {
      continue;
    }
    const channelsNode = delivery.properties.channels as WizardSchema | undefined;
    const deliveryRequired = delivery.required ?? [];

    // Every delivery property except `channels` (rendered specially, with live options) is a field.
    const deliveryFields = Object.entries(delivery.properties)
      .filter(([fieldKey]) => fieldKey !== "channels")
      .map(([fieldKey, fieldNode]) =>
        describeField(fieldKey, fieldNode as WizardSchema, deliveryRequired),
      )
      .filter((field): field is FieldDescriptor => field !== null);

    categories.push({
      key,
      label: node.title,
      description: node.description,
      channelOptions: nodeOptions(channelsNode),
      channelLabel: channelsNode?.title,
      channelIcon: channelsNode?.["x-icon"],
      deliveryFields,
    });
  }
  return categories;
}
