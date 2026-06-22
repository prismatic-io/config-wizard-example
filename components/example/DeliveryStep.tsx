"use client";

// THIS EXAMPLE's custom step — one enabled category's delivery rules (destination
// channels + delivery mode + minimum level + quiet hours). Edits a slice of the single
// holistic Configuration var via useJsonDraft; the wizard feeds it that var's
// value/onChange through engine.field(configVar.key). Replace with your own for a
// different integration.

import {
  ChevronDown,
  Hash,
  Mail,
  MessageCircle,
  Phone,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CategoryConfig, DeliveryFieldSchema } from "@/lib/example/configuration";
import { useJsonDraft } from "@/hooks/useJsonDraft";
import { MultiSelect } from "@/components/wizard/fields/MultiSelect";

/** Map an integration-supplied icon hint to a lucide icon (default: channel hash). */
const CHANNEL_ICONS: Record<string, LucideIcon> = {
  hash: Hash,
  mail: Mail,
  phone: Phone,
  "message-circle": MessageCircle,
  users: Users,
};
/** Renders the lucide icon for an integration's channel-icon hint (default: hash). */
function ChannelGlyph({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && CHANNEL_ICONS[name]) || Hash;
  return <Icon size={16} className={className} />;
}

interface DeliveryStepProps {
  /** This category's definition (channel picker + delivery fields). */
  definition: CategoryConfig;
  /** The full Configuration draft (JSON string of `{ [categoryKey]: {...} }`). */
  value: string;
  onChange: (next: string) => void;
}

type FieldValue = string | string[];
interface DeliveryValues {
  channels?: string[];
  [fieldKey: string]: FieldValue | undefined;
}
interface CategoryValues {
  enabled?: boolean;
  delivery?: DeliveryValues;
}

/**
 * Renders one enabled category's Delivery step: a mandatory destination channels multi-select followed
 * by a grid of the remaining delivery fields (mode + minimum level as single-selects, quiet-hours times
 * as text inputs). All edits write back into the shared Configuration draft under this category's
 * `delivery` object, preserving its `enabled` flag.
 */
export function DeliveryStep({ definition, value, onChange }: DeliveryStepProps) {
  const draft = useJsonDraft<Record<string, CategoryValues>>(value, onChange, {});
  const category = draft.slice<CategoryValues>(definition.key);
  const delivery: DeliveryValues =
    category.delivery && typeof category.delivery === "object" && !Array.isArray(category.delivery)
      ? category.delivery
      : {};

  function setDelivery(patch: Partial<DeliveryValues>) {
    draft.patchSlice<CategoryValues>(definition.key, {
      delivery: { ...delivery, ...patch },
    });
  }

  const channels = Array.isArray(delivery.channels) ? delivery.channels : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-white/60">
          {definition.channelLabel ?? "Send to channel"}{" "}
          <span className="text-red-400">*</span>
        </label>
        <MultiSelect
          options={definition.channelOptions}
          value={channels}
          onChange={(next) => setDelivery({ channels: next })}
          placeholder="Channel"
          icon={<ChannelGlyph name={definition.channelIcon} className="shrink-0 text-white/40" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {definition.deliveryFields.map((field) => (
          <DeliveryField
            key={field.key}
            field={field}
            value={delivery[field.key]}
            onChange={(v) => setDelivery({ [field.key]: v })}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One labeled delivery control — multi-select (with free-text when no options), single-select dropdown
 * when the field has options (mode, minimum level), or a free-text input when it has none (quiet hours).
 */
function DeliveryField({
  field,
  value,
  onChange,
}: {
  field: DeliveryFieldSchema;
  value: FieldValue | undefined;
  onChange: (next: FieldValue) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-white/60">
        {field.label}
        {field.required && <span className="text-red-400"> *</span>}
      </label>
      {field.multi ? (
        <MultiSelect
          options={field.options}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          placeholder="Select"
          allowCustom={field.options.length === 0}
        />
      ) : field.options.length > 0 ? (
        <div className="relative">
          <select
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none rounded-md border border-white/15 bg-white/[0.04] py-2 pl-3 pr-9 text-sm text-white/90 focus:border-primary focus:outline-none"
          >
            <option value="">Select</option>
            {field.options.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
          />
        </div>
      ) : (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="HH:MM"
          className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-primary focus:outline-none"
        />
      )}
    </div>
  );
}
