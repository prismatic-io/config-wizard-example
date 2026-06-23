"use client";

// THIS EXAMPLE's custom step — one enabled category's delivery rules (destination
// channels + delivery mode + minimum level + quiet hours). Edits a slice of the single
// holistic Configuration var via useJsonDraft; the wizard feeds it that var's
// value/onChange through engine.field(configVar.key). Replace with your own for a
// different integration.

import {
  Hash,
  Mail,
  MessageCircle,
  Phone,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CategoryConfig } from "@/lib/example/configuration";
import { useJsonDraft } from "@/hooks/useJsonDraft";
import { MultiSelect } from "@/components/wizard/fields/MultiSelect";
import { FieldControl } from "@/components/wizard/fields/FieldControl";

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
          <FieldControl
            key={field.key}
            field={field}
            value={delivery[field.key]}
            onChange={(v) => setDelivery({ [field.key]: v as FieldValue })}
            placeholder="HH:MM"
          />
        ))}
      </div>
    </div>
  );
}
