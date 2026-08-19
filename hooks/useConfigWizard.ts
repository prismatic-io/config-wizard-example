"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrismaticAuth } from "@/hooks/usePrismaticAuth";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import {
  buildConfigVarSubmit,
  deployInstance,
  disconnectConnection,
  fetchConfigWizardPageContent,
  fetchConfigurationWizardInstance,
  fetchDataSourceContent,
  isKeyBasedConnection,
  joinConnectionInputs,
  jsonFormData,
  parseConfigPages,
  parseConnectionDraft,
  parsePicklistContent,
  prismaticKeys,
  submitConfigPage,
  type ConfigPage,
  type ConfigWizardData,
  type ConnectionInputDescriptor,
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
 * It is integration-agnostic: the wizard is simply the instance's config pages, one step
 * per page. How specific vars render and validate is supplied by the caller via `plugins` —
 * a registry of per-config-var overrides (see components/example/ownerMappingPlugin.tsx).
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
  /** CONNECTION vars only: OAuth-vs-key-based flavor + the customer-editable inputs. */
  connection?: {
    isOAuth2: boolean;
    /** Joined input descriptors for a key-based connection ([] for OAuth2). */
    inputs: ConnectionInputDescriptor[];
  };
}

/** A plugin's inline renderer for its config var (replaces ConfigVarInput where the var appears). */
export type ConfigVarRender = (ctx: {
  field: WizardField;
  wizard: ConfigWizardEngine;
}) => ReactNode;

/** Readiness context for a plugin's `validate` — the var's pre-wired field (live value/content). */
export interface ConfigVarValidateContext {
  field: WizardField;
}
export type ConfigVarValidate = (ctx: ConfigVarValidateContext) => boolean | undefined;

/**
 * A self-contained plugin targeted at ONE config var by key. The engine renders every page with
 * standard per-dataType fields by default and gates "Next" on every var being non-empty (or a
 * connection being satisfied); a plugin overrides either half for its var. Both hooks run only
 * while the var's host page is the CURRENT page with content loaded:
 *
 * - `renderField` replaces `ConfigVarInput` in the var's element slot (return null to hide it).
 * - `validate` replaces the engine's default readiness for the var; return `undefined` to defer
 *   to the default.
 */
export interface ConfigVarPlugin {
  renderField?: ConfigVarRender;
  validate?: ConfigVarValidate;
}

export interface UseConfigWizardOptions {
  /** Custom renderers/validators keyed by config-var key. Unregistered vars use the defaults. */
  plugins?: Record<string, ConfigVarPlugin>;
}

export interface ConfigWizardEngine {
  // lifecycle / load
  authenticated: boolean;
  loading: boolean;
  loadError: string | null;
  data: ConfigWizardData | null;
  /** Index of the current config page (the wizard is one step per page). */
  stepIndex: number;
  isLastStep: boolean;
  goBack: () => void;
  // current page render data
  page: ConfigPage | undefined;
  pageLoading: boolean;
  pageError: string | null;
  /** Whether page content has loaded; gate page rendering on this. */
  contentLoaded: boolean;
  /** Fetch the pre-wired field for one config-var key on the current page. */
  field: (key: string) => WizardField | undefined;
  // gating + submit
  ready: boolean;
  busy: boolean;
  actionError: string | null;
  deployed: boolean;
  submit: () => Promise<void>;
  // mid-page datasource plumbing (for plugins that search/refetch in place)
  /**
   * Persist a subset of config vars NOW (`configComplete: false`); vars not named are
   * untouched. Plain async passthrough — failures throw to the caller (render them
   * inline in the step), they don't drive `busy`/`actionError`.
   */
  saveVars: (vars: Record<string, string>) => Promise<void>;
  /**
   * Run one config var's datasource server-side and resolve its parsed content.
   * Pass ad-hoc values via `inputs` (`type: "value"`); they arrive in a
   * code-native perform's `params` keyed by name — no need to save them first.
   */
  invokeDataSource: (
    varKey: string,
    inputs?: { name: string; type: string; value: string }[],
  ) => Promise<unknown>;
  /**
   * Clear everything downstream of `varKey`'s host page: later pages' drafts plus
   * their cached page content (removed, not merely invalidated, so a revisit fetches
   * fresh content). Call after changing a var that upstream-feeds later datasources.
   */
  resetDownstream: (varKey: string) => void;
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

  // Fixed at mount — bounds the connection-status log query's `$startedAt` window.
  const [startedAt] = useState(() => new Date().toISOString());

  const pages: ConfigPage[] = data
    ? parseConfigPages(data.instance.integration.configPages)
    : [];

  // ── Step / page derivation ──────────────────────────────────────────────────
  // The wizard is exactly the config pages, one step per page. The page count is fixed
  // once the instance loads, and `stepIndex` only moves via `goBack` / submit success.
  const currentConfigPage: ConfigPage | undefined = pages[stepIndex];
  const currentPageName = currentConfigPage?.name;
  const isLastStep = pages.length > 0 && stepIndex === pages.length - 1;

  // The current page's computed content (picklist options, JSONFORM schema, values).
  // Keyed by page name, so navigating to an already-visited page is an instant cache hit.
  const pageQuery = useQuery({
    queryKey: prismaticKeys.page(instanceId, currentPageName ?? ""),
    queryFn: () => fetchConfigWizardPageContent(instanceId, currentPageName as string),
    enabled: authenticated && Boolean(currentPageName),
  });
  const pageContent: PageContent | null = pageQuery.data ?? null;

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

  // Integration-level connection metadata (oauth2Type + input labels/types) for a
  // config var, joined by key from the instance query.
  const connectionMetaOf = (key: string) =>
    data?.instance.integration.requiredConfigVariables.nodes.find(
      (rcv) => rcv.key === key,
    )?.connection ?? null;

  const isKeyBasedVar = (cv: PageConfigVariable): boolean =>
    isKeyBasedConnection(connectionMetaOf(cv.requiredConfigVariable.key), cv);

  // OAuth connection vars on this page — these are what we poll for "ACTIVE".
  // Key-based connections have no authorize flow, so there's nothing to watch.
  const connectionKeys = pageVars
    .filter(
      (cv) =>
        cv.requiredConfigVariable.dataType === "CONNECTION" &&
        !isKeyBasedVar(cv),
    )
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
  // present, otherwise the value seeded from page content (the saved instance value —
  // the manage/edit seed — then a JSONFORM schema's baked default). Used by the field
  // renderer, readiness, and submit — never before the page query is read. No eager
  // seeding of the whole draft map.
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
    return undefined;
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
      // Skip an untouched key-based connection: updateInstanceConfigVariables only
      // touches the vars named in the payload, and resubmitting one whose secret
      // inputs come back unreadable (value: null) would blank the saved secret.
      const submitVars = pageVars
        .filter(
          (cv) =>
            !(
              cv.requiredConfigVariable.dataType === "CONNECTION" &&
              isKeyBasedVar(cv) &&
              drafts[cv.requiredConfigVariable.key] === undefined
            ),
        )
        .map((cv) =>
          buildConfigVarSubmit(
            cv,
            effectiveValue(cv.requiredConfigVariable.key),
          ),
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
      if (isLastStep) {
        // The marketplace's card counts/statuses read these keys; no window
        // message fires for our custom wizard, so mark them stale here. They
        // refetch when /integrations remounts.
        void queryClient.invalidateQueries({
          queryKey: prismaticKeys.marketplace(),
          refetchType: "none",
        });
        void queryClient.invalidateQueries({
          queryKey: prismaticKeys.instances(),
          refetchType: "none",
        });
        setDeployed(true);
      } else {
        setStepIndex(stepIndex + 1);
      }
    },
  });

  // ── Mid-page datasource plumbing ────────────────────────────────────────────
  // Deliberately NOT useMutations: a plugin-driven save/invoke (e.g. a debounced
  // search) owns its own pending/error UI inline; page-level busy/actionError
  // stay reserved for Next/Back-scale actions.
  const saveVars = async (vars: Record<string, string>): Promise<void> => {
    await submitConfigPage({
      instanceId,
      configVariables: Object.entries(vars).map(([key, value]) => ({
        key,
        value,
        customerConfigVariableId: null,
        onPremiseResourceId: null,
      })),
      configComplete: false,
    });
  };

  const invokeDataSource = async (
    varKey: string,
    inputs?: { name: string; type: string; value: string }[],
  ): Promise<unknown> => {
    const dataSourceId =
      data?.instance.integration.requiredConfigVariables.nodes.find(
        (rcv) => rcv.key === varKey,
      )?.dataSource?.id;
    if (!dataSourceId) {
      throw new Error(`No datasource found for config variable "${varKey}"`);
    }
    return fetchDataSourceContent({ instanceId, dataSourceId, inputs });
  };

  const resetDownstream = (varKey: string): void => {
    const hostIdx = pages.findIndex((p) =>
      p.elements.some((el) => el.type === "configVar" && el.value === varKey),
    );
    if (hostIdx < 0) return;
    const downstream = pages.slice(hostIdx + 1);
    const keys = new Set(
      downstream.flatMap((p) =>
        p.elements
          .filter((el) => el.type === "configVar")
          .map((el) => el.value),
      ),
    );
    setDrafts((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !keys.has(k))),
    );
    // removeQueries, not invalidateQueries: with a 30s staleTime an invalidated
    // page still serves its cached content synchronously on remount. Removal makes
    // the revisit render from a fresh fetch.
    for (const p of downstream) {
      queryClient.removeQueries({
        queryKey: prismaticKeys.page(instanceId, p.name),
      });
    }
  };

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
    const isConnection = cv.requiredConfigVariable.dataType === "CONNECTION";
    return {
      key,
      label: key,
      dataType: cv.requiredConfigVariable.dataType,
      value: effectiveValue(key) ?? "",
      onChange: (next) => setDraft(key, next),
      status: statusOfKey(key),
      content,
      options: parsePicklistContent(content),
      authorizeUrl: cv.authorizeUrl,
      onDisconnect: () => disconnectMutation.mutate(cv),
      connection: isConnection
        ? isKeyBasedVar(cv)
          ? {
              isOAuth2: false,
              inputs: joinConnectionInputs(connectionMetaOf(key), cv),
            }
          : { isOAuth2: true, inputs: [] }
        : undefined,
    };
  };

  const field = (key: string): WizardField | undefined => {
    const cv = pageContent?.configVariables.find(
      (c) => c.requiredConfigVariable.key === key,
    );
    return cv ? toField(cv) : undefined;
  };

  // ── Readiness / navigation ─────────────────────────────────────────────────────
  // Whether the current page is satisfied enough to advance: every var passes its
  // plugin's `validate` when one is registered (and returns a verdict), otherwise the
  // engine default below.
  const varReady = (cv: PageConfigVariable): boolean => {
    const key = cv.requiredConfigVariable.key;
    if (cv.requiredConfigVariable.dataType === "CONNECTION") {
      // Key-based: satisfied once every required input has a value — the typed
      // draft if the user edited it, otherwise a saved server value (secrets
      // report hasValue with a null value). OAuth2: the authorize flow must
      // have completed.
      if (isKeyBasedVar(cv)) {
        const draftMap = parseConnectionDraft(drafts[key]);
        return joinConnectionInputs(connectionMetaOf(key), cv)
          .filter((input) => input.required)
          .every((input) =>
            draftMap[input.name] !== undefined
              ? draftMap[input.name].trim().length > 0
              : Boolean(input.serverValue) || input.hasValue,
          );
      }
      return statusOfKey(key) === "ACTIVE";
    }
    return (effectiveValue(key) ?? "").trim().length > 0;
  };
  const varReadyWithPlugin = (cv: PageConfigVariable): boolean => {
    const verdict = plugins[cv.requiredConfigVariable.key]?.validate?.({
      field: toField(cv),
    });
    return verdict ?? varReady(cv);
  };
  const ready =
    pageContent !== null &&
    currentConfigPage !== undefined &&
    pageVars.every(varReadyWithPlugin);

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

  return {
    authenticated,
    loading: !data,
    loadError: instanceQuery.error ? errorMessage(instanceQuery.error) : null,
    data,
    stepIndex,
    isLastStep,
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
    saveVars,
    invokeDataSource,
    resetDownstream,
  };
}
