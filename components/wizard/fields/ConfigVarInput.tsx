"use client";

// Generic field renderer — no brand knowledge. Renders ONE config variable from its
// pre-wired WizardField (value/onChange/status/options/authorizeUrl/onDisconnect),
// branching on data type: a CONNECTION as the OAuth connect/disconnect panel, a
// PICKLIST as a select, a JSONFORM via JsonFormRenderer (which owns its own raw-JSON
// escape hatch), and everything else as a text input. Purely presentational — it owns
// no wizard state.

import {
  CheckCircle2,
  ChevronDown,
  MonitorDot,
  Sparkles,
} from "lucide-react";
import type { WizardField } from "@/hooks/useConfigWizard";
import { JsonFormRenderer } from "@/components/wizard/fields/JsonFormRenderer";

/** Strip "Connection" off a connection var key to name the product (e.g. "Slack"). */
function productName(key: string): string {
  return key.replace(/\s*connections?\s*/i, "").trim() || key;
}

export function ConfigVarInput({
  field,
  busy,
}: {
  field: WizardField;
  busy: boolean;
}) {
  const { key, dataType, value, onChange, status, content, options, authorizeUrl, onDisconnect } =
    field;
  const isActive = status === "ACTIVE";
  const product = productName(key);

  if (dataType === "CONNECTION") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        {isActive ? (
          <div className="relative">
            <CheckCircle2 size={64} strokeWidth={1.5} className="text-primary" />
            <Sparkles size={20} className="absolute -right-1 -top-1 text-primary" />
          </div>
        ) : (
          <MonitorDot size={56} strokeWidth={1.5} className="text-white/80" />
        )}
        <div>
          <h3 className="text-lg font-semibold">
            {isActive ? "Connection completed" : "Make the connection"}
          </h3>
          <p className="mt-1 text-sm text-white/50">
            To start, please establish a connection to your {product}.
          </p>
        </div>
        {isActive ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Working…" : `Disconnect From ${product}`}
          </button>
        ) : authorizeUrl ? (
          <a
            href={authorizeUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Connect To {product}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-white/90">{key}</label>

      {dataType === "PICKLIST" && (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none rounded-md border border-white/15 bg-white/[0.04] py-2 pl-3 pr-9 text-sm text-white/90 focus:border-primary focus:outline-none"
          >
            <option value="">Select</option>
            {options.map((opt) => (
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
      )}

      {dataType === "JSONFORM" && (
        <JsonFormRenderer content={content} value={value} onChange={onChange} />
      )}

      {dataType !== "CONNECTION" &&
        dataType !== "PICKLIST" &&
        dataType !== "JSONFORM" && (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white/90 focus:border-primary focus:outline-none"
          />
        )}
    </div>
  );
}
