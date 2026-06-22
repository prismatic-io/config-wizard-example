"use client";

// Presentational frame — no Prismatic state. Renders the horizontal step rail from the
// engine's step list. The icon mapping is a cosmetic label-regex fallback (defaults to
// a gear); a step opts out of the "Step N" caption via `hideIndex` (e.g. category sub-steps).

import { Fragment } from "react";
import {
  Check,
  CreditCard,
  Hash,
  Lock,
  Rocket,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { WizardStep } from "@/hooks/useConfigWizard";

/** Map a step label to its stepper icon (cosmetic; unknown labels get a gear). */
function stepIcon(label: string): LucideIcon {
  if (/connection/i.test(label)) return Lock;
  if (/deployment/i.test(label)) return Rocket;
  if (/security/i.test(label)) return ShieldCheck;
  if (/billing/i.test(label)) return CreditCard;
  if (/channel/i.test(label)) return Hash;
  return Settings;
}

/** Horizontal icon stepper: circle per step, label (+ "Step N" unless hidden), blue connectors. */
export function Stepper({
  steps,
  stepIndex,
}: {
  steps: WizardStep[];
  stepIndex: number;
}) {
  return (
    <div className="flex items-center px-6 py-6">
      {steps.map((step, i) => {
        const done = i < stepIndex;
        const active = i === stepIndex;
        const Icon = stepIcon(step.label);
        return (
          <Fragment key={step.id}>
            <div className="flex shrink-0 items-center gap-2">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  done || active
                    ? "bg-primary text-white"
                    : "border border-white/15 text-white/40"
                }`}
              >
                {done ? <Check size={18} /> : <Icon size={18} />}
              </div>
              <div className="leading-tight">
                <div
                  className={`whitespace-nowrap text-sm font-semibold ${
                    active || done ? "text-white" : "text-white/40"
                  }`}
                >
                  {step.label}
                </div>
                {!step.hideIndex && (
                  <div className="text-xs text-white/40">Step {i + 1}</div>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-3 h-px min-w-4 flex-1 ${done ? "bg-primary" : "bg-white/15"}`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
