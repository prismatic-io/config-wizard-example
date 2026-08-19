"use client";

import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import {
  useConfigWizard,
  type ConfigVarPlugin,
  type ConfigWizardEngine,
} from "@/hooks/useConfigWizard";
import { OWNER_MAPPING_KEY, ownerMappingPlugin } from "@/components/example/ownerMappingPlugin";
import { ConfigVarInput } from "@/components/wizard/fields/ConfigVarInput";
import { Shell } from "@/components/wizard/chrome/Shell";
import { Loading } from "@/components/wizard/chrome/Loading";
import { ErrorBox } from "@/components/wizard/chrome/ErrorBox";

interface ConfigWizardProps {
  instanceId: string;
}

/**
 * The wizard's plugin registry — per-config-var overrides for rendering (`renderField`)
 * and readiness (`validate`). The engine reads `validate`; the view reads `renderField`.
 * Add an integration's plugins here.
 */
const plugins: Record<string, ConfigVarPlugin> = {
  [OWNER_MAPPING_KEY]: ownerMappingPlugin,
};

/**
 * Interactive, multi-step config wizard — one step per config page. All Prismatic state
 * lives in `useConfigWizard`; this component renders from the engine. A config var with a
 * registered plugin draws with the plugin's `renderField`; every other var renders with
 * the engine's standard per-dataType field.
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
            <p className="mt-1 text-sm text-neutral-500">
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

  const showPage =
    !wizard.pageLoading && !wizard.pageError && wizard.contentLoaded && Boolean(wizard.page);

  return (
    <Shell title={`Create ${instance.name}`}>
      <div className="flex min-h-[28rem] flex-col">
        {wizard.page && (
          <div className="px-6 pb-2 pt-8">
            <h2 className="pr-8 text-2xl font-semibold tracking-tight text-neutral-900">
              {`Step ${wizard.stepIndex + 1}: ${wizard.page.name}`}
            </h2>
          </div>
        )}

        <div className="flex flex-1 flex-col px-6 py-4">
          {wizard.pageLoading && <Loading>Loading page…</Loading>}
          {wizard.pageError && <ErrorBox>{wizard.pageError}</ErrorBox>}

          {showPage && (
            <div className="flex flex-col gap-4">
              <PageElements wizard={wizard} />
            </div>
          )}

          {wizard.actionError && (
            <div className="mt-4">
              <ErrorBox>{wizard.actionError}</ErrorBox>
            </div>
          )}

          {showPage && !wizard.ready && (
            <p className="mt-4 text-xs text-amber-600">
              Complete the required fields on this page to continue.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-4">
          <Link href="/integrations" className="text-sm text-neutral-500 hover:text-neutral-700">
            Discard
          </Link>
          <div className="flex items-center gap-3">
            {wizard.stepIndex > 0 && (
              <button
                onClick={wizard.goBack}
                disabled={wizard.busy}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
              >
                Back
              </button>
            )}
            <button
              onClick={() => void wizard.submit()}
              disabled={wizard.busy || wizard.pageLoading || !wizard.ready}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
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
function PageElements({ wizard }: { wizard: ConfigWizardEngine }) {
  if (!wizard.page) return null;
  return (
    <>
      {wizard.page.elements.map((el, i) => {
        if (el.type === "htmlElement") {
          return (
            <p key={i} className="text-sm text-neutral-600">
              {el.value}
            </p>
          );
        }
        if (el.type === "configVar") {
          const f = wizard.field(el.value);
          if (!f) {
            return (
              <p key={i} className="text-sm text-neutral-400">
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
