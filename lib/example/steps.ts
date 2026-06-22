// ─────────────────────────────────────────────────────────────────────────────
// THIS EXAMPLE's step model — the part you replace for your own integration.
//
// `configurationPlugin` is how the generic `useConfigWizard` engine learns this
// integration's multi-step shape WITHOUT the engine knowing anything about "categories".
// It's a per-config-var plugin targeted at the "Configuration" key:
//
//   useConfigWizard(instanceId, { plugins: { Configuration: configurationPlugin } })
//
// Its `expandSteps` turns the page that holds the "Configuration" var into a "General"
// category-selection step plus one Delivery step per enabled category; `validateStep` says
// when each is satisfied. Both are pure and deterministic (the engine calls them every render).
// Category definitions ride in `step.custom`, so the engine only ever sees opaque metadata —
// never a `CategoryConfig`. Every OTHER config var (and page) uses the engine's standard
// per-dataType rendering and a one-step-per-page layout.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ConfigVarPlugin,
  ConfigVarPluginContext,
  ConfigVarValidateContext,
  WizardStep,
} from "@/hooks/useConfigWizard";
import { parseConfiguration, type CategoryConfig } from "@/lib/example/configuration";

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
 * Expands the Configuration var's host page → a "general" step (category selection) plus one
 * "category" Delivery step per enabled category; the category schema rides in `custom` so the engine
 * never sees a `CategoryConfig`. Emits the (placeholder) general step even before the page's content
 * is captured — categories fill in on the next render. The engine tags every returned step with
 * `ownerKey`/`primary`.
 */
function expandConfigurationSteps({
  key,
  page,
  captured,
  draft,
}: ConfigVarPluginContext): WizardStep[] {
  const categories = captured ? parseConfiguration(captured.content) : [];
  const selection = parseConfigValue(draft(key));
  const steps: WizardStep[] = [
    {
      kind: "custom",
      id: `${page.name}:general`,
      label: "General",
      pageName: page.name,
      custom: { type: "general", categories },
    },
  ];
  for (const c of categories) {
    if (selection[c.key]?.enabled === true) {
      steps.push({
        kind: "custom",
        id: `${page.name}:${c.key}`,
        label: c.label,
        pageName: page.name,
        hideIndex: true,
        custom: { type: "category", category: c },
      });
    }
  }
  return steps;
}

/** Per-step readiness for the Configuration steps; `undefined` defers to the engine default. */
function validateConfigurationStep({
  key,
  step,
  draft,
}: ConfigVarValidateContext): boolean | undefined {
  if (step.kind !== "custom") return undefined;
  const selection = parseConfigValue(draft(key));
  if (step.custom.type === "general") {
    // At least one category enabled.
    const categories = step.custom.categories as CategoryConfig[];
    return categories.some((c) => selection[c.key]?.enabled === true);
  }
  if (step.custom.type === "category") {
    // At least one destination channel; mode/minLevel have defaults and quiet hours are optional.
    const category = step.custom.category as CategoryConfig;
    return (selection[category.key]?.delivery?.channels ?? []).length > 0;
  }
  return undefined;
}

/** The category plugin, targeted at the "Configuration" config var. */
export const configurationPlugin: ConfigVarPlugin = {
  expandSteps: expandConfigurationSteps,
  validateStep: validateConfigurationStep,
};
