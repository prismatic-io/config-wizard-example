"use client";

import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import {
  useConfigWizard,
  type ConfigVarPlugin,
  type ConfigWizardEngine,
} from "@/hooks/useConfigWizard";
import { CONFIGURATION_KEY, configurationPlugin } from "@/components/example/configurationPlugin";
import { ConfigVarInput } from "@/components/wizard/fields/ConfigVarInput";
import { Shell } from "@/components/wizard/chrome/Shell";
import { Stepper } from "@/components/wizard/chrome/Stepper";
import { Loading } from "@/components/wizard/chrome/Loading";
import { ErrorBox } from "@/components/wizard/chrome/ErrorBox";

interface ConfigWizardProps {
  instanceId: string;
}

/**
 * The wizard's plugin registry — the single source of truth for both halves of the plugin model:
 * the engine reads `expandSteps` (step expansion + per-step validation) and the view reads
 * `renderField` / each step's `render`. Add an integration's plugins here.
 */
const plugins: Record<string, ConfigVarPlugin> = {
  [CONFIGURATION_KEY]: configurationPlugin,
};

/**
 * Interactive, multi-step config wizard. All Prismatic state lives in `useConfigWizard`;
 * this component renders from the engine and registers the "Configuration" plugin (which
 * expands its page into a category-selection step + one delivery step per enabled category).
 * Every other config var renders with the engine's standard per-dataType field.
 */
export function ConfigWizard({ instanceId }: ConfigWizardProps) {
  const wizard = useConfigWizard(instanceId, { plugins });

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
 * Standard rendering of a page's elements in order — HTML blurbs + one input per config var. A var
 * whose plugin supplies a `renderField` is drawn with it; everything else uses `ConfigVarInput`.
 */
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
          const renderField = plugins[el.value]?.renderField;
          return (
            <div key={f.key}>
              {renderField ? renderField({ field: f, wizard }) : (
                <ConfigVarInput field={f} busy={wizard.busy} />
              )}
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

/** Renders the body for the current step (a plugin step's own UI, or a standard page). */
function StepBody({ wizard }: { wizard: ConfigWizardEngine }) {
  const step = wizard.step;
  if (!step) return null;

  // A plugin-owned custom step draws its OWN `render`. The page's base ("primary") step also hosts
  // the page's other (non-plugin) vars via standard rendering.
  if (step.kind === "custom" && step.ownerKey) {
    const field = wizard.field(step.ownerKey);
    return (
      <div className="flex flex-col gap-4">
        {step.primary && wizard.page?.tagline && (
          <p className="text-sm text-white/50">{wizard.page.tagline}</p>
        )}
        {step.render({ wizard, step, field })}
        {step.primary && <PageElements wizard={wizard} excludeKey={step.ownerKey} />}
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
