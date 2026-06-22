"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrismaticAuth } from "@/hooks/usePrismaticAuth";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import {
  buildConfigVarSubmit,
  deployInstance,
  disconnectConnection,
  fetchConfigWizardPageContent,
  fetchConfigurationWizardInstance,
  jsonFormData,
  parseConfigPages,
  prismaticKeys,
  submitConfigPage,
  type ConfigPage,
  type ConfigWizardData,
  type DataType,
  type PageConfigVariable,
  type PageContent,
  type PicklistOption,
} from "@/lib/prismatic";

/**
 * The engine behind a Prismatic config wizard. This hook owns ALL the Prismatic-specific
 * state and side effects — instance load, per-page content fetch, the draft map, OAuth
 * connection-status polling, page validation, and the submit → deploy / disconnect
 * mutations — and hands the UI a small, declarative surface. A consumer renders from
 * `steps`/`fields`/flags and calls `submit`/`goBack`; it never touches the draft map,
 * `buildConfigVarSubmit`, the query cache, or the poller.
 *
 * Server state is React Query's job: the instance, each page's content, and the auth
 * token are `useQuery`; submit/deploy/disconnect are `useMutation`; cache-busting is
 * `queryClient.invalidateQueries`. So caching, request de-duplication, polling, and
 * retry/backoff are the library's, not ours — what's left here is just wizard logic.
 * Local UI state (the draft edits and the step index) stays in plain React state.
 *
 * It is integration-agnostic: it knows nothing about "brands". How config pages expand
 * into steps and how specific vars render are supplied by the caller via `plugins` — a
 * registry of per-config-var renderers/expanders (see lib/example/steps.ts for the brand one).
 */

/** One renderable config variable, pre-wired so a renderer stays plumbing-free. */
export interface WizardField {
  key: string;
  /** Display label (this example uses the config-var key). */
  label: string;
  dataType: DataType;
  /** Current draft value (a string). Render this; never read the draft map directly. */
  value: string;
  /** Patch this field's draft — the engine owns persistence + re-render. */
  onChange: (next: string) => void;
  /** Live status (poll result ?? baked status); meaningful for CONNECTION vars. */
  status: string | null;
  /** Baked page content for this var (PICKLIST options / JSONFORM schema). */
  content: unknown;
  /** Resolved PICKLIST options ([] for other types). */
  options: PicklistOption[];
  /** OAuth authorize URL when this CONNECTION is pending. */
  authorizeUrl: string | null;
  /** Disconnect this connection (engine handles cache-bust + reload). */
  onDisconnect: () => void;
}

/** Opaque-to-engine payload a custom step carries (e.g. the brand definition). */
export interface CustomStepMeta {
  /** The example's own discriminator, e.g. "general" | "brand". */
  type: string;
  [k: string]: unknown;
}

/**
 * A step the wizard renders. A "page" step renders its config page's elements with the
 * standard per-dataType renderer. A "custom" step is contributed by a config-var plugin
 * (see `ConfigVarPlugin`): `ownerKey` is the config var that owns/renders it, and `primary`
 * marks the page's base step (which also hosts the page's non-plugin vars).
 */
export type WizardStep =
  | { kind: "page"; id: string; label: string; pageName: string; hideIndex?: boolean }
  | {
      kind: "custom";
      id: string;
      label: string;
      pageName: string;
      hideIndex?: boolean;
      /** The config-var key whose plugin owns this step (injected by the engine). */
      ownerKey?: string;
      /** The page's base step — also renders the page's standard (non-plugin) vars. */
      primary?: boolean;
      custom: CustomStepMeta;
    };

/**
 * A config var's baked page content, captured (once) the first time its host page loads.
 * Holds the static JSONFORM schema snapshot; the var's VALUE is always read live via `draft`.
 */
export interface CapturedConfigVar {
  key: string;
  pageName: string;
  /** The var's baked page content (its JSONFORM `{schema,data}`). */
  content: unknown;
  /** The var's saved instance value at capture time, if any (the manage/edit seed). */
  value?: string | null;
}

/** Inputs a plugin gets to expand its host page into steps. Pure — no engine internals. */
export interface ConfigVarPluginContext {
  /** The plugin's own config-var key. */
  key: string;
  /** The host config page (the page whose elements reference `key`). */
  page: ConfigPage;
  /** This var's captured content, or null until its page has loaded. */
  captured: CapturedConfigVar | null;
  /** Read any config var's current draft (e.g. this var's selections). */
  draft: (key: string) => string | undefined;
}

/** Per-step readiness inputs (extends the expansion context with the current step + status). */
export interface ConfigVarValidateContext extends ConfigVarPluginContext {
  step: WizardStep;
  /** Live status for any config-var key on the current page. */
  statusOf: (key: string) => string | null;
}

/**
 * A custom renderer/expander targeted at ONE config var by key. The engine renders every
 * page with standard per-dataType fields by default; a plugin lets a specific var (e.g. the
 * holistic "Configuration" var) expand its page into multiple steps (sub-pages) and own their
 * validation. Rendering of those steps is supplied separately by the view (see ConfigWizard).
 */
export interface ConfigVarPlugin {
  /**
   * Expand this var's host page into >=1 steps. MUST emit a stable "primary" step even when
   * `captured` is null (its page hasn't loaded yet). The engine tags every returned step with
   * `ownerKey = key`; the first/base step is also marked `primary`.
   */
  expandSteps: (ctx: ConfigVarPluginContext) => WizardStep[];
  /** Readiness for a step this plugin owns. Return `undefined` to defer to the engine default. */
  validateStep: (ctx: ConfigVarValidateContext) => boolean | undefined;
}

export interface UseConfigWizardOptions {
  /**
   * Custom renderers/expanders keyed by config-var key. Unregistered vars use standard
   * rendering and a one-step-per-page layout. At most one plugin var per page (v1).
   */
  plugins?: Record<string, ConfigVarPlugin>;
}

export interface ConfigWizardEngine {
  // lifecycle / load
  authenticated: boolean;
  loading: boolean;
  loadError: string | null;
  data: ConfigWizardData | null;
  steps: WizardStep[];
  stepIndex: number;
  step: WizardStep | undefined;
  isLastStep: boolean;
  goNext: () => void;
  goBack: () => void;
  // current page render data
  page: ConfigPage | undefined;
  pageLoading: boolean;
  pageError: string | null;
  /** Whether page content has loaded; gate step rendering on this. */
  contentLoaded: boolean;
  /** Fetch the pre-wired field for one config-var key on the current page. */
  field: (key: string) => WizardField | undefined;
  // gating + submit
  ready: boolean;
  busy: boolean;
  actionError: string | null;
  deployed: boolean;
  submit: () => Promise<void>;
}

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export function useConfigWizard(
  instanceId: string,
  options: UseConfigWizardOptions = {},
): ConfigWizardEngine {
  const plugins = options.plugins ?? {};

  const { authenticated } = usePrismaticAuth();
  const queryClient = useQueryClient();

  // ── Server state (React Query) ──────────────────────────────────────────────
  // The instance + its config pages. One query, keyed by instanceId; React Query
  // de-dupes and caches it.
  const instanceQuery = useQuery({
    queryKey: prismaticKeys.instance(instanceId),
    queryFn: () => fetchConfigurationWizardInstance(instanceId),
    enabled: authenticated,
  });
  const data = instanceQuery.data ?? null;

  // ── Local UI state (plain React) ────────────────────────────────────────────
  const [stepIndex, setStepIndex] = useState(0);
  // Only user EDITS live here; an unedited var resolves to its seeded default lazily
  // via `valueOf` below. That keeps drafts a pure edit log — no effect seeds it, so
  // there's no setState-in-effect to reason about.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [deployed, setDeployed] = useState(false);

  // Captured content for plugin config vars, keyed by config-var key. Filled once, the
  // first time each plugin var's page loads (the schema is static). Persisted in state
  // because plugin `expandSteps` reads it on EVERY render — even while we're on another
  // page whose content doesn't include it.
  const [captured, setCaptured] = useState<Record<string, CapturedConfigVar>>({});

  // Fixed at mount — bounds the connection-status log query's `$startedAt` window.
  const [startedAt] = useState(() => new Date().toISOString());

  const pages: ConfigPage[] = data
    ? parseConfigPages(data.instance.integration.configPages)
    : [];

  // ── Step / page derivation ──────────────────────────────────────────────────
  // Accessor handed to plugin expandSteps / validateStep. It runs BEFORE the page query
  // is read (the page name comes out of the steps it produces), so it resolves from edits
  // or a plugin var's captured content — deliberately NOT from the live current page's
  // content (see `effectiveValue` for that). The captured snapshot seeds the value lazily:
  // the saved instance value (the manage/edit seed) first, then the schema's baked default.
  // This precedence mirrors `effectiveValue` so validation/expansion and rendering agree.
  const draftOf = (key: string): string | undefined => {
    if (drafts[key] !== undefined) return drafts[key];
    if (captured[key]) {
      return captured[key].value ?? jsonFormData(captured[key].content) ?? "{}";
    }
    return undefined;
  };

  // The first config var on a page that has a registered plugin (one plugin var per page).
  const pluginKeyForPage = (page: ConfigPage): string | undefined =>
    page.elements.find((el) => el.type === "configVar" && plugins[el.value])?.value;

  // Build steps: each page is one "page" step, unless it hosts a plugin var — then the
  // plugin expands that page into >=1 steps, each tagged with `ownerKey` (the base one
  // also `primary`). Pure + deterministic; recomputed every render.
  const steps: WizardStep[] = pages.flatMap((page) => {
    const key = pluginKeyForPage(page);
    if (key) {
      const expanded = plugins[key].expandSteps({
        key,
        page,
        captured: captured[key] ?? null,
        draft: draftOf,
      });
      return expanded.map((step, i) =>
        step.kind === "custom"
          ? { ...step, ownerKey: key, primary: i === 0 }
          : step,
      );
    }
    return [{ kind: "page" as const, id: page.name, label: page.name, pageName: page.name }];
  });

  // Clamp every render so steps appearing/disappearing (e.g. enabling a brand) can
  // never leave the index pointing past the end of the array.
  const safeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const currentStep: WizardStep | undefined = steps[safeIndex];
  const currentPageName = currentStep?.pageName;
  const currentConfigPage = pages.find((p) => p.name === currentPageName);
  const isLastStep = safeIndex === steps.length - 1;

  // The current page's computed content (picklist options, JSONFORM schema, values).
  // Keyed by page name, so navigating to an already-visited page is an instant cache hit.
  const pageQuery = useQuery({
    queryKey: prismaticKeys.page(instanceId, currentPageName ?? ""),
    queryFn: () => fetchConfigWizardPageContent(instanceId, currentPageName as string),
    enabled: authenticated && Boolean(currentPageName),
  });
  const pageContent: PageContent | null = pageQuery.data ?? null;

  // Capture content for any plugin var on the current page the first time it loads. We set
  // it during render — React's "adjust state when the inputs change" pattern — instead of
  // in an effect: guarded against the COMMITTED `captured` map, so each key is captured at
  // most once (a single extra render), then `draftOf`/plugin `expandSteps` pick it up next
  // render.
  if (pageContent && currentConfigPage) {
    const pending: Record<string, CapturedConfigVar> = {};
    for (const el of currentConfigPage.elements) {
      if (el.type !== "configVar" || !plugins[el.value] || captured[el.value]) continue;
      pending[el.value] = {
        key: el.value,
        pageName: currentConfigPage.name,
        content: pageContent.content[el.value],
        value: pageContent.configVariables.find(
          (cv) => cv.requiredConfigVariable.key === el.value,
        )?.value,
      };
    }
    if (Object.keys(pending).length > 0) {
      setCaptured((prev) => ({ ...prev, ...pending }));
    }
  }

  // The config vars referenced by the current page, in element order.
  const pageVars: PageConfigVariable[] =
    currentConfigPage && pageContent
      ? currentConfigPage.elements
          .filter((el) => el.type === "configVar")
          .map((el) =>
            pageContent.configVariables.find(
              (cv) => cv.requiredConfigVariable.key === el.value,
            ),
          )
          .filter((cv): cv is PageConfigVariable => Boolean(cv))
      : [];

  // OAuth connection vars on this page — these are what we poll for "ACTIVE".
  const connectionKeys = pageVars
    .filter((cv) => cv.requiredConfigVariable.dataType === "CONNECTION")
    .map((cv) => cv.requiredConfigVariable.key);

  const { statuses: liveStatus } = useConnectionStatus(instanceId, {
    connectionKeys,
    startedAt,
  });

  const statusOfKey = (key: string): string | null => {
    if (liveStatus[key] !== undefined) return liveStatus[key];
    const cv = pageContent?.configVariables.find(
      (c) => c.requiredConfigVariable.key === key,
    );
    return cv?.status ?? null;
  };

  // ── Draft values ─────────────────────────────────────────────────────────────
  // Effective value for a config-var key on the current page: the user's edit if
  // present, otherwise the value seeded from page content. Falls back to `draftOf` for
  // plugin vars (resolved from captured content). Used by the field renderer and submit —
  // never before the page query is read. No eager seeding of the whole draft map.
  const effectiveValue = (key: string): string | undefined => {
    if (drafts[key] !== undefined) return drafts[key];
    const cv = pageContent?.configVariables.find(
      (c) => c.requiredConfigVariable.key === key,
    );
    if (cv) {
      return (
        cv.value ??
        (cv.requiredConfigVariable.dataType === "JSONFORM"
          ? jsonFormData(pageContent!.content[key]) ?? "{}"
          : "")
      );
    }
    return draftOf(key);
  };

  const setDraft = (key: string, value: string) =>
    setDrafts((prev) => ({ ...prev, [key]: value }));

  // ── Mutations (React Query) ───────────────────────────────────────────────────
  // Disconnect flips a connection back to PENDING and mints a new authorize URL, so we
  // invalidate this page's content to surface the fresh status + URL on the next render.
  const disconnectMutation = useMutation({
    mutationFn: (cv: PageConfigVariable) => disconnectConnection(cv.id),
    onSuccess: () => {
      if (currentPageName) {
        void queryClient.invalidateQueries({
          queryKey: prismaticKeys.page(instanceId, currentPageName),
        });
      }
    },
  });

  // Submit the current page (and deploy on the last step). `isPending`/`error`
  // drive the busy / actionError flags.
  const submitMutation = useMutation({
    mutationFn: async () => {
      const submitVars = pageVars.map((cv) =>
        buildConfigVarSubmit(cv, effectiveValue(cv.requiredConfigVariable.key)),
      );
      await submitConfigPage({
        instanceId,
        configVariables: submitVars,
        configComplete: isLastStep,
      });
      if (isLastStep) await deployInstance(instanceId);
    },
    onSuccess: () => {
      if (currentPageName) {
        // Mark stale but don't refetch now — a revisit refetches the saved values
        // without a redundant fetch here.
        void queryClient.invalidateQueries({
          queryKey: prismaticKeys.page(instanceId, currentPageName),
          refetchType: "none",
        });
      }
      if (isLastStep) setDeployed(true);
      else setStepIndex(safeIndex + 1);
    },
  });

  const busy = submitMutation.isPending || disconnectMutation.isPending;
  const actionError = submitMutation.error
    ? errorMessage(submitMutation.error)
    : disconnectMutation.error
      ? errorMessage(disconnectMutation.error)
      : null;

  // Build the pre-wired field for one config var. Plain function (not memoized):
  // nothing depends on its identity, so recomputing it each render is harmless.
  const toField = (cv: PageConfigVariable): WizardField => {
    const key = cv.requiredConfigVariable.key;
    const content = pageContent?.content[key];
    return {
      key,
      label: key,
      dataType: cv.requiredConfigVariable.dataType,
      value: effectiveValue(key) ?? "",
      onChange: (next) => setDraft(key, next),
      status: statusOfKey(key),
      content,
      options: asPicklistOptions(content),
      authorizeUrl: cv.authorizeUrl,
      onDisconnect: () => disconnectMutation.mutate(cv),
    };
  };

  const field = (key: string): WizardField | undefined => {
    const cv = pageContent?.configVariables.find(
      (c) => c.requiredConfigVariable.key === key,
    );
    return cv ? toField(cv) : undefined;
  };

  // ── Readiness / navigation ─────────────────────────────────────────────────────
  // Whether the current step is satisfied enough to advance. A plugin-owned step defers
  // to its plugin's `validateStep`; the page's standard (non-plugin) vars are gated by the
  // engine default. A plain "page" step uses the default for all of its vars.
  const varReady = (cv: PageConfigVariable): boolean => {
    const key = cv.requiredConfigVariable.key;
    if (cv.requiredConfigVariable.dataType === "CONNECTION") {
      return statusOfKey(key) === "ACTIVE";
    }
    return (effectiveValue(key) ?? "").trim().length > 0;
  };
  // Default readiness over the page's vars, optionally skipping plugin-owned keys.
  const defaultReady = (skipPluginVars = false): boolean => {
    if (!pageContent || !currentStep) return false;
    return pageVars.every(
      (cv) =>
        (skipPluginVars && plugins[cv.requiredConfigVariable.key]) || varReady(cv),
    );
  };
  const ready = (() => {
    if (!pageContent || !currentStep) return false;
    const ownerKey =
      currentStep.kind === "custom" ? currentStep.ownerKey : undefined;
    if (ownerKey && plugins[ownerKey]) {
      const pluginReady =
        plugins[ownerKey].validateStep({
          key: ownerKey,
          page: currentConfigPage as ConfigPage,
          captured: captured[ownerKey] ?? null,
          draft: draftOf,
          step: currentStep,
          statusOf: statusOfKey,
        }) ?? defaultReady(true);
      // The primary step also hosts the page's standard vars — gate on those too.
      const isPrimary = currentStep.kind === "custom" && currentStep.primary === true;
      return isPrimary ? pluginReady && defaultReady(true) : pluginReady;
    }
    return defaultReady();
  })();

  // Once every watched connection on this page is ACTIVE, refresh the page's content so
  // its baked status + authorize URL match reality; the effect only fires on the transition.
  const connectionsActive =
    connectionKeys.length > 0 &&
    connectionKeys.every((k) => statusOfKey(k) === "ACTIVE");
  useEffect(() => {
    if (currentPageName && connectionsActive) {
      // The live poll already drives the field's status; just mark the baked content
      // stale so a revisit refetches the now-ACTIVE status + cleared authorize URL.
      void queryClient.invalidateQueries({
        queryKey: prismaticKeys.page(instanceId, currentPageName),
        refetchType: "none",
      });
    }
  }, [currentPageName, connectionsActive, instanceId, queryClient]);

  const submit = async () => {
    await submitMutation.mutateAsync().catch(() => {
      // Error is surfaced via `actionError`; swallow so callers needn't try/catch.
    });
  };

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => i + 1);

  return {
    authenticated,
    loading: !data,
    loadError: instanceQuery.error ? errorMessage(instanceQuery.error) : null,
    data,
    steps,
    stepIndex: safeIndex,
    step: currentStep,
    isLastStep,
    goNext,
    goBack,
    page: currentConfigPage,
    pageLoading: pageQuery.isLoading,
    pageError: pageQuery.error ? errorMessage(pageQuery.error) : null,
    contentLoaded: pageContent !== null,
    field,
    ready,
    busy,
    actionError,
    deployed,
    submit,
  };
}

/** Read PICKLIST options out of a config var's baked content ([] for other types). */
function asPicklistOptions(content: unknown): PicklistOption[] {
  if (Array.isArray(content)) {
    return content.filter(
      (o): o is PicklistOption =>
        typeof o === "object" && o !== null && "key" in o && "label" in o,
    );
  }
  return [];
}
