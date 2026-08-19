"use client";

// THIS EXAMPLE's owner-mapping step — the custom UI for the "Owner Mapping" config var:
// "FakeCRM Contact | Acme Owner" column headers, hairline-divided rows with borderless
// dropdowns, a kind-grouped owner picker, and a per-row trash that clears the mapping.
// Reads/writes the var's JSON value through useJsonDraft; knows nothing about the
// wizard engine.

import { ChevronDown, Trash2, UserPlus } from "lucide-react";
import { useJsonDraft } from "@/hooks/useJsonDraft";
import { ComboBox } from "@/components/wizard/fields/ComboBox";
import {
  CREATE_PREFIX,
  ownerGroups,
  rowsFor,
  type MappingsValue,
  type OwnerMappingModel,
} from "@/lib/example/ownerMapping";

interface OwnerMappingStepProps {
  model: OwnerMappingModel;
  /** The Owner Mapping var's current draft value (a JSON string). */
  value: string;
  onChange: (next: string) => void;
}

/** "create:person" → "Person" (the badge's noun). */
function createKind(key: string): string {
  const kind = key.slice(CREATE_PREFIX.length);
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-x-6";

export function OwnerMappingStep({ model, value, onChange }: OwnerMappingStepProps) {
  const draft = useJsonDraft<MappingsValue>(value, onChange, {});
  const rows = rowsFor(model, draft.value);
  const groups = ownerGroups(model);

  const setRow = (crmContact: string, acmeOwner: string) =>
    draft.patch({
      mappings: rows.map((r) => (r.crmContact === crmContact ? { ...r, acmeOwner } : r)),
    });

  return (
    <div className="flex flex-col">
      <div className={`${ROW_GRID} pb-2`}>
        <span className="px-2 text-xs font-medium text-neutral-500">FakeCRM Contact</span>
        <span className="px-2 text-xs font-medium text-neutral-500">Acme Owner</span>
        <span />
      </div>

      <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
        {rows.map((row) => {
          const contact = model.crmContacts.find((o) => o.key === row.crmContact);
          const isCreate = row.acmeOwner.startsWith(CREATE_PREFIX);
          return (
            <li key={row.crmContact} className={`${ROW_GRID} py-2`}>
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-900">
                <span className="flex-1 truncate">{contact?.label ?? row.crmContact}</span>
                <ChevronDown size={16} className="shrink-0 text-neutral-400" />
              </div>

              <div className="min-w-0">
                <ComboBox
                  groups={groups}
                  value={row.acmeOwner}
                  onChange={(next) => setRow(row.crmContact, next)}
                  placeholder="Select Owner"
                  ghost
                />
                {isCreate && (
                  <span className="flex items-center gap-1 px-2 pb-1 text-xs text-primary">
                    <UserPlus size={12} /> A new {createKind(row.acmeOwner)} will be created in
                    Acme
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setRow(row.crmContact, "")}
                aria-label={`Clear mapping for ${contact?.label ?? row.crmContact}`}
                className="justify-self-end rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <Trash2 size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
