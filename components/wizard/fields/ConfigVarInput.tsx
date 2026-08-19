"use client";

// Generic field renderer — no brand knowledge. Renders ONE config variable from its
// pre-wired WizardField (value/onChange/status/options/authorizeUrl/onDisconnect),
// branching on data type: an OAuth2 CONNECTION as the connect/disconnect panel, a
// key-based CONNECTION as a form over its inputs (api key etc.), a PICKLIST as a
// select, a JSONFORM via JsonFormRenderer (which owns its own raw-JSON escape
// hatch), and everything else as a text input. Purely presentational — it owns
// no wizard state.

import {
  CheckCircle2,
  ChevronDown,
  MonitorDot,
  Sparkles,
} from "lucide-react";
import type { WizardField } from "@/hooks/useConfigWizard";
import { parseConnectionDraft } from "@/lib/prismatic";
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
    const connection = field.connection;

    // Key-based connection: no authorize flow — the user types the input values.
    if (connection && !connection.isOAuth2 && connection.inputs.length > 0) {
      const draftMap = parseConnectionDraft(value);
      // ACTIVE alone isn't proof of a usable saved connection (an instance can be
      // activated with empty inputs); only claim "connected" when the saved
      // values satisfy every required input.
      const connected =
        isActive &&
        connection.inputs.every(
          (input) => !input.required || input.serverValue || input.hasValue,
        );
      return (
        <div className="flex flex-col gap-4 py-4">
          {connected && (
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckCircle2 size={18} strokeWidth={2} />
              Connected to {product} — edit below to update.
            </div>
          )}
          {connection.inputs.map((input) => {
            // A saved secret comes back unreadable (hasValue with a null value);
            // show it blank with a "saved" hint instead of pretending it's empty.
            const savedSecret =
              draftMap[input.name] === undefined &&
              input.serverValue == null &&
              input.hasValue;
            return (
              <div key={input.name} className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">
                  {input.label}
                  {input.required && <span className="text-red-600"> *</span>}
                </label>
                <input
                  type={input.type === "password" ? "password" : "text"}
                  value={draftMap[input.name] ?? input.serverValue ?? ""}
                  onChange={(e) =>
                    onChange(
                      JSON.stringify({
                        ...draftMap,
                        [input.name]: e.target.value,
                      }),
                    )
                  }
                  disabled={busy}
                  placeholder={
                    savedSecret
                      ? "•••••••• (saved — leave blank to keep)"
                      : (input.placeholder ??
                        (input.example ? `e.g. ${input.example}` : undefined))
                  }
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                />
                {input.comments && (
                  <p className="text-xs text-neutral-500">{input.comments}</p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        {isActive ? (
          <div className="relative">
            <CheckCircle2 size={64} strokeWidth={1.5} className="text-primary" />
            <Sparkles size={20} className="absolute -right-1 -top-1 text-primary" />
          </div>
        ) : (
          <MonitorDot size={56} strokeWidth={1.5} className="text-neutral-700" />
        )}
        <div>
          <h3 className="text-lg font-semibold">
            {isActive ? "Connection completed" : "Make the connection"}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            To start, please establish a connection to your {product}.
          </p>
        </div>
        {/* Disconnect is an OAuth2-only operation — the API rejects it for key-based connections. */}
        {isActive && connection?.isOAuth2 !== false ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Working…" : `Disconnect From ${product}`}
          </button>
        ) : !isActive && authorizeUrl ? (
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
      {/* A JSONFORM's page blurb/tagline is its context; the raw var key adds nothing (V1 shows none). */}
      {dataType !== "JSONFORM" && (
        <label className="text-sm font-medium text-neutral-900">{key}</label>
      )}

      {dataType === "PICKLIST" && (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-9 text-sm text-neutral-900 focus:border-primary focus:outline-none"
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
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
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
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary focus:outline-none"
          />
        )}
    </div>
  );
}
