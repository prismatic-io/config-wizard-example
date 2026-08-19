"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THIS EXAMPLE's owner-mapping plugin — the part you replace for your own integration.
//
// `ownerMappingPlugin` is a self-contained, per-config-var plugin targeted at the
// "Owner Mapping" key (the FakeCRM integration's owner-sync table):
//
//   useConfigWizard(instanceId, { plugins: { "Owner Mapping": ownerMappingPlugin } })
//
// `renderField` draws the flat mapping table (OwnerMappingStep) in the var's slot, and
// `validate` blocks Next until EVERY FakeCRM contact is mapped — stricter than the engine
// default, which only requires a non-empty value. If the var's schema doesn't parse as
// an owner-mapping table, both fall back to the standard per-dataType field and default
// gating, so the page never dead-ends.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConfigVarPlugin } from "@/hooks/useConfigWizard";
import {
  isComplete,
  parseMappingsValue,
  parseOwnerMapping,
} from "@/lib/example/ownerMapping";
import { OwnerMappingStep } from "@/components/example/OwnerMappingStep";
import { ConfigVarInput } from "@/components/wizard/fields/ConfigVarInput";

export { OWNER_MAPPING_KEY } from "@/lib/example/ownerMapping";

/** The Owner Mapping plugin, targeted at the "Owner Mapping" config var. */
export const ownerMappingPlugin: ConfigVarPlugin = {
  renderField: ({ field, wizard }) => {
    const model = parseOwnerMapping(field.content);
    if (!model) return <ConfigVarInput field={field} busy={wizard.busy} />;
    return (
      <OwnerMappingStep
        model={model}
        value={field.value}
        onChange={field.onChange}
      />
    );
  },
  // Every FakeCRM contact mapped (an existing Acme owner or a create:* choice).
  validate: ({ field }) => {
    const model = parseOwnerMapping(field.content);
    return model ? isComplete(model, parseMappingsValue(field.value)) : undefined;
  },
};
