"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import {
  useConfigWizard,
  type ConfigWizardEngine,
  type WizardField,
  type WizardStep,
} from "@/hooks/useConfigWizard";
import { type CategoryConfig } from "@/lib/example/configuration";
import { CONFIGURATION_KEY, configurationPlugin } from "@/lib/example/steps";
import { CategorySelector } from "@/components/example/CategorySelector";
import { DeliveryStep } from "@/components/example/DeliveryStep";
import { ConfigVarInput } from "@/components/wizard/fields/ConfigVarInput";
import { Shell } from "@/components/wizard/chrome/Shell";
import { Stepper } from "@/components/wizard/chrome/Stepper";
import { Loading } from "@/components/wizard/chrome/Loading";
import { ErrorBox } from "@/components/wizard/chrome/ErrorBox";

interface ConfigWizardProps {
  instanceId: string;
}

/**
 * Interactive, multi-step config wizard. All Prismatic state lives in `useConfigWizard`;
 * this component renders from the engine and registers the "Configuration" plugin (which
 * expands its page into a category-selection step + one delivery step per enabled category).
 * Every other config var renders with the engine's standard per-dataType field.
 */
export function ConfigWizard({ instanceId }: ConfigWizardProps) {
  const wizard = useConfigWizard(instanceId, {
    plugins: { [CONFIGURATION_KEY]: configurationPlugin },
  });

  if (!wizard.authenticated) {
    return (
      <Shell title="Create integration">
        <Loading>Waiting for authentication…</Loading>
      </Shell>
    );
  }
  if (wizard.loadError) {
    return (
      <Shell title="Create integration">
        <div className="p-6">
          <ErrorBox>Failed to load configuration: {wizard.loadError}</ErrorBox>
        </div>
      </Shell>
    );
  }
  if (wizard.loading || !wizard.data) {
    return (
      <Shell title="Create integration">
        <Loading>Loading configuration…</Loading>
      </Shell>
    );
  }

  const { instance } = wizard.data;

  if (wizard.deployed) {
    return (
      <Shell title={`Create ${instance.name}`}>
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="relative">
            <CheckCircle2 size={64} strokeWidth={1.5} className="text-primary" />
            <Sparkles size={20} className="absolute -right-1 -top-1 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{instance.name} deployed</h3>
            <p className="mt-1 text-sm text-white/50">
              The instance was configured and deployed for {instance.customer.name}.
            </p>
          </div>
          <Link
            href="/integrations"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Back to integrations
          </Link>
        </div>
      </Shell>
    );
  }

  const showStep =
    !wizard.pageLoading && !wizard.pageError && wizard.contentLoaded && Boolean(wizard.step);

  return (
    <Shell title={`Create ${instance.name}`}>
      <div className="flex min-h-[28rem] flex-col">
        <Stepper steps={wizard.steps} stepIndex={wizard.stepIndex} />

        <div className="flex flex-1 flex-col px-6 py-6">
          {wizard.pageLoading && <Loading>Loading page…</Loading>}
          {wizard.pageError && <ErrorBox>{wizard.pageError}</ErrorBox>}

          {showStep && <StepBody wizard={wizard} />}

          {wizard.actionError && (
            <div className="mt-4">
              <ErrorBox>{wizard.actionError}</ErrorBox>
            </div>
          )}

          {showStep && !wizard.ready && (
            <p className="mt-4 text-xs text-amber-400">
              Complete the required fields on this page to continue.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <Link href="/integrations" className="text-sm text-white/50 hover:text-white/80">
            Discard
          </Link>
          <div className="flex items-center gap-3">
            {wizard.stepIndex > 0 && (
              <button
                onClick={wizard.goBack}
                disabled={wizard.busy}
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5 disabled:opacity-40"
              >
                Back
              </button>
            )}
            <button
              onClick={() => void wizard.submit()}
              disabled={wizard.busy || wizard.pageLoading || !wizard.ready}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
            >
              {wizard.busy ? "Working…" : wizard.isLastStep ? "Create" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/**
 * Custom renderers keyed by config-var key — the view half of the engine's plugin model
 * (rendering is JSX, so it lives here, not in the hook). A step owned by one of these keys
 * is drawn by its renderer; everything else uses the standard `ConfigVarInput`.
 */
type CustomRenderer = (props: {
  wizard: ConfigWizardEngine;
  step: WizardStep;
  field: WizardField | undefined;
}) => ReactNode;

const customRenderers: Record<string, CustomRenderer> = {
  [CONFIGURATION_KEY]: ({ step, field }) => {
    if (step.kind !== "custom" || !field) return null;
    if (step.custom.type === "general") {
      return (
        <CategorySelector
          categories={step.custom.categories as CategoryConfig[]}
          value={field.value}
          onChange={field.onChange}
        />
      );
    }
    if (step.custom.type === "category") {
      return (
        <DeliveryStep
          definition={step.custom.category as CategoryConfig}
          value={field.value}
          onChange={field.onChange}
        />
      );
    }
    return null;
  },
};

/** Standard rendering of a page's elements in order — HTML blurbs + one input per config var. */
function PageElements({
  wizard,
  excludeKey,
}: {
  wizard: ConfigWizardEngine;
  excludeKey?: string;
}) {
  if (!wizard.page) return null;
  return (
    <>
      {wizard.page.elements.map((el, i) => {
        if (el.type === "htmlElement") {
          return (
            <p key={i} className="text-sm text-white/70">
              {el.value}
            </p>
          );
        }
        if (el.type === "configVar") {
          if (el.value === excludeKey) return null;
          const f = wizard.field(el.value);
          if (!f) {
            return (
              <p key={i} className="text-sm text-white/40">
                {el.value} — not found
              </p>
            );
          }
          return <ConfigVarInput key={f.key} field={f} busy={wizard.busy} />;
        }
        return null;
      })}
    </>
  );
}

/** Renders the body for the current step (a plugin's custom UI, or a standard page). */
function StepBody({ wizard }: { wizard: ConfigWizardEngine }) {
  const step = wizard.step;
  if (!step) return null;

  // A step owned by a registered config-var plugin: draw its custom UI. The page's base
  // ("primary") step also hosts the page's other (non-plugin) vars via standard rendering.
  if (step.kind === "custom" && step.ownerKey && customRenderers[step.ownerKey]) {
    const ownerKey = step.ownerKey;
    const field = wizard.field(ownerKey);
    return (
      <div className="flex flex-col gap-4">
        {step.primary && wizard.page?.tagline && (
          <p className="text-sm text-white/50">{wizard.page.tagline}</p>
        )}
        {customRenderers[ownerKey]({ wizard, step, field })}
        {step.primary && <PageElements wizard={wizard} excludeKey={ownerKey} />}
      </div>
    );
  }

  // Standard page: render its elements in order.
  if (!wizard.page) return null;
  return (
    <div className="flex flex-col gap-4">
      {wizard.page.tagline && (
        <p className="text-sm text-white/50">{wizard.page.tagline}</p>
      )}
      <PageElements wizard={wizard} />
    </div>
  );
}
