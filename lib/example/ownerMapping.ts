// ─────────────────────────────────────────────────────────────────────────────
// THIS EXAMPLE's owner-mapping domain — the part you replace for your own integration.
//
// The FakeCRM integration models its owner sync as ONE "Owner Mapping" JSONFORM config
// var: `{ mappings: [{ crmContact, acmeOwner }] }` where both fields are strings
// constrained by `oneOf [{const,title}]` — the FakeCRM contacts on one side and the Acme
// owners (plus `create:*` "make a new owner" choices) on the other. `parseOwnerMapping`
// normalizes that schema into an `OwnerMappingModel` the custom mapping step renders.
// None of this is known to the generic engine — swap this file (and
// components/example/ownerMappingPlugin.tsx) for your own schema and the engine is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import {
  jsonFormSchema,
  nodeOptions,
  type PicklistOption,
  type WizardSchema,
} from "@/lib/prismatic";

/** The config-var key this example treats as its owner-mapping table. */
export const OWNER_MAPPING_KEY = "Owner Mapping";

/** Acme-owner keys with this prefix mean "create a new owner of this kind" (e.g. `create:person`). */
export const CREATE_PREFIX = "create:";

/** One row of the mapping value: a FakeCRM contact key → the Acme owner key it syncs to ("" = unmapped). */
export interface MappingRow {
  crmContact: string;
  acmeOwner: string;
}

/** The Owner Mapping var's parsed JSON value shape. */
export interface MappingsValue {
  mappings?: MappingRow[];
}

/**
 * The Owner Mapping schema normalized for rendering: the FakeCRM contacts (one mapping row each)
 * and the Acme-owner choices, with the `create:*` entries split out so the UI can group them.
 */
export interface OwnerMappingModel {
  crmContacts: PicklistOption[];
  acmeOwners: PicklistOption[];
  createOptions: PicklistOption[];
}

/**
 * Normalizes the Owner Mapping jsonForm into an `OwnerMappingModel`. Expects
 * `properties.mappings` to be an array of objects whose `crmContact`/`acmeOwner` strings carry
 * `oneOf [{const,title}]` options. Returns `null` on anything unexpected — which is also the natural
 * "this isn't the rich Owner Mapping var" signal (the plugin then falls back to standard rendering).
 */
export function parseOwnerMapping(content: unknown): OwnerMappingModel | null {
  const mappings = jsonFormSchema(content)?.properties?.mappings as WizardSchema | undefined;
  const items = (Array.isArray(mappings?.items) ? undefined : mappings?.items) as
    | WizardSchema
    | undefined;
  if (mappings?.type !== "array" || !items?.properties) return null;

  const crmContacts = nodeOptions(items.properties.crmContact as WizardSchema | undefined);
  const acmeChoices = nodeOptions(items.properties.acmeOwner as WizardSchema | undefined);
  if (crmContacts.length === 0 || acmeChoices.length === 0) return null;

  return {
    crmContacts,
    acmeOwners: acmeChoices.filter((o) => !o.key.startsWith(CREATE_PREFIX)),
    createOptions: acmeChoices.filter((o) => o.key.startsWith(CREATE_PREFIX)),
  };
}

/** An owner option, optionally accent-colored (the "+ Create …" actions). */
export interface OwnerOption extends PicklistOption {
  accent?: boolean;
}

/** A titled section of the Acme-owner dropdown ("Person" / "Team" / "Company" / …). */
export interface OwnerGroup {
  label?: string;
  options: OwnerOption[];
}

const KIND_GROUP: Record<string, string> = {
  person: "Person",
  shared: "Shared",
  team: "Team",
  company: "Company",
};

/**
 * Group the Acme-owner choices by kind: owners labeled "Name (Kind)" are sectioned under that
 * kind with the suffix stripped, and each kind's `create:*` action is appended to its section
 * as an accent "+ Create …" row. Unrecognized kinds fall under "Other".
 */
export function ownerGroups(model: OwnerMappingModel): OwnerGroup[] {
  const order: string[] = [];
  const byGroup = new Map<string, OwnerOption[]>();
  const add = (group: string, option: OwnerOption) => {
    if (!byGroup.has(group)) {
      byGroup.set(group, []);
      order.push(group);
    }
    byGroup.get(group)!.push(option);
  };

  for (const owner of model.acmeOwners) {
    const match = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(owner.label);
    const group = match ? KIND_GROUP[match[2].trim().toLowerCase()] : undefined;
    add(group ?? "Other", { key: owner.key, label: group && match ? match[1] : owner.label });
  }
  for (const create of model.createOptions) {
    const kind = create.key.slice(CREATE_PREFIX.length).toLowerCase();
    const group = KIND_GROUP[kind] ?? "Other";
    add(group, {
      key: create.key,
      label: `+ Create ${KIND_GROUP[kind] ?? kind}`,
      accent: true,
    });
  }
  return order.map((label) => ({ label, options: byGroup.get(label)! }));
}

/** Tolerant parse of the Owner Mapping draft string into its value shape. */
export function parseMappingsValue(raw: string | undefined): MappingsValue {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as MappingsValue)
      : {};
  } catch {
    return {};
  }
}

/**
 * One row per schema FakeCRM contact, merged with the saved value. The schema is the source of
 * row identity and order, so stale/missing saved rows (a contact added or removed in FakeCRM)
 * can't desync the table.
 */
export function rowsFor(model: OwnerMappingModel, value: MappingsValue): MappingRow[] {
  const saved = new Map(
    (value.mappings ?? [])
      .filter((r): r is MappingRow => Boolean(r) && typeof r.crmContact === "string")
      .map((r) => [r.crmContact, typeof r.acmeOwner === "string" ? r.acmeOwner : ""]),
  );
  return model.crmContacts.map((o) => ({
    crmContact: o.key,
    acmeOwner: saved.get(o.key) ?? "",
  }));
}

/** Whether every FakeCRM contact is mapped (an existing Acme owner or a `create:*` choice). */
export function isComplete(model: OwnerMappingModel, value: MappingsValue): boolean {
  return rowsFor(model, value).every((r) => r.acmeOwner.trim().length > 0);
}
