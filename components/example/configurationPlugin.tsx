"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THIS EXAMPLE's plugin — the part you replace for your own integration.
//
// `configurationPlugin` is a self-contained, per-config-var plugin targeted at the
// "Configuration" key. It teaches the generic `useConfigWizard` engine this integration's
// multi-step shape WITHOUT the engine knowing anything about "categories":
//
//   useConfigWizard(instanceId, { plugins: { Configuration: configurationPlugin } })
//
// `expandSteps` turns the page that holds the "Configuration" var into a "General"
// category-selection step plus one Delivery step per enabled category. Each step carries its
// OWN `render` (the custom UI) and `validate` (its readiness), closing over the parsed
// `CategoryConfig` directly — so there's no opaque step metadata and no central switch.
// Every OTHER config var (and page) uses the engine's standard per-dataType rendering.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConfigVarPlugin, ConfigVarPluginContext, WizardStep } from "@/hooks/useConfigWizard";
import { parseConfiguration } from "@/lib/example/configuration";
import { CategorySelector } from "@/components/example/CategorySelector";
import { DeliveryStep } from "@/components/example/DeliveryStep";

/** The config-var key this example treats as its holistic notification configuration. */
export const CONFIGURATION_KEY = "Configuration";

/** One category's delivery slice of the holistic Configuration value (the bits the wizard gates on). */
interface DeliverySelection {
  channels?: string[];
  mode?: string;
  minLevel?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

/** One category's slice of the holistic Configuration value. */
interface CategorySelection {
  enabled?: boolean;
  delivery?: DeliverySelection;
}

/** Tolerant parse of the single Configuration draft into per-category selections. */
function parseConfigValue(raw: string | undefined): Record<string, CategorySelection> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Expands the Configuration var's host page → a "General" step (category selection) plus one Delivery
 * step per enabled category. Each step closes over its parsed `CategoryConfig` and supplies its own
 * `render`/`validate`; the engine tags every step with `ownerKey`/`primary`. The "General" step is
 * emitted even before the page's content is captured — categories fill in on the next render.
 */
function expandConfigurationSteps({ key, page, captured, draft }: ConfigVarPluginContext): WizardStep[] {
  const categories = captured ? parseConfiguration(captured.content) : [];

  const steps: WizardStep[] = [
    {
      kind: "custom",
      id: `${page.name}:general`,
      label: "General",
      pageName: page.name,
      render: ({ field }) =>
        field ? (
          <CategorySelector categories={categories} value={field.value} onChange={field.onChange} />
        ) : null,
      // At least one category enabled.
      validate: ({ draft: read }) => {
        const selection = parseConfigValue(read(key));
        return categories.some((c) => selection[c.key]?.enabled === true);
      },
    },
  ];

  const selection = parseConfigValue(draft(key));
  for (const category of categories) {
    if (selection[category.key]?.enabled !== true) continue;
    steps.push({
      kind: "custom",
      id: `${page.name}:${category.key}`,
      label: category.label,
      pageName: page.name,
      hideIndex: true,
      render: ({ field }) =>
        field ? (
          <DeliveryStep definition={category} value={field.value} onChange={field.onChange} />
        ) : null,
      // At least one destination channel; mode/minLevel have defaults and quiet hours are optional.
      validate: ({ draft: read }) =>
        (parseConfigValue(read(key))[category.key]?.delivery?.channels ?? []).length > 0,
    });
  }
  return steps;
}

/** The Configuration plugin, targeted at the "Configuration" config var. */
export const configurationPlugin: ConfigVarPlugin = {
  expandSteps: expandConfigurationSteps,
};
