// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. The per-page read/write side of the wizard: parse the integration's
// page list, fetch a single page's computed content + current values, submit one
// page's edited config vars, and map a config var + its draft into the submit shape.
// ─────────────────────────────────────────────────────────────────────────────

import { graphql, throwIfApiError } from "./client";
import { FETCH_PAGE_CONTENT, SUBMIT_CONFIG_PAGE } from "./queries";
import type {
  ConfigPage,
  InputConfigVariable,
  Node,
  PageConfigVariable,
  PageContent,
} from "./types";

/** The integration's `configPages` field is a JSON string; parse it into typed pages. */
export function parseConfigPages(json: string | null | undefined): ConfigPage[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as ConfigPage[];
  } catch {
    return [];
  }
}

interface FetchPageContentData {
  fetchConfigWizardPageContent: {
    fetchConfigWizardPageContentResult: {
      content: string | null;
      instance: { configVariables: Node<PageConfigVariable> };
    } | null;
    errors: { field: string; messages: string[] }[];
  };
}

/** Fetches the computed content (picklist options / jsonform schema) + current
 * config var values for a single wizard page. Throws on errors. */
export async function fetchConfigWizardPageContent(
  instanceId: string,
  pageName: string,
): Promise<PageContent> {
  const result = await graphql<FetchPageContentData>({
    query: FETCH_PAGE_CONTENT,
    variables: { instanceId, pageName },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  throwIfApiError(result);
  if (!result.data?.fetchConfigWizardPageContent) {
    throw new Error("No page content returned");
  }
  const payload = result.data.fetchConfigWizardPageContent;
  if (payload.errors?.length) {
    throw new Error(
      payload.errors.map((e) => `${e.field}: ${e.messages.join(", ")}`).join("; "),
    );
  }

  const r = payload.fetchConfigWizardPageContentResult;
  let content: Record<string, unknown> = {};
  if (r?.content) {
    try {
      content = JSON.parse(r.content) as Record<string, unknown>;
    } catch {
      content = {};
    }
  }
  return { content, configVariables: r?.instance.configVariables.nodes ?? [] };
}

interface SubmitConfigPageData {
  updateInstanceConfigVariables: {
    instance: { id: string } | null;
    errors: { field: string; messages: string[] }[];
  };
}

/** Submits one page's config variables. Throws on field errors. */
export async function submitConfigPage(params: {
  instanceId: string;
  configVariables: InputConfigVariable[];
  configComplete?: boolean;
}): Promise<void> {
  const result = await graphql<SubmitConfigPageData>({
    query: SUBMIT_CONFIG_PAGE,
    variables: {
      instanceId: params.instanceId,
      configVariables: params.configVariables,
      configMode: "INSTANCE",
      configComplete: params.configComplete ?? false,
    },
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  throwIfApiError(result);
  const errs = result.data.updateInstanceConfigVariables.errors;
  if (errs?.length) {
    throw new Error(
      errs.map((e) => `${e.field}: ${e.messages.join(", ")}`).join("; "),
    );
  }
}

/**
 * Maps a page config variable + its edited draft into the submit shape, by data type:
 * - CONNECTION → `values` = JSON string of its nested value inputs
 * - everything else (PICKLIST, JSONFORM, …) → scalar `value`
 */
export function buildConfigVarSubmit(
  cv: PageConfigVariable,
  draft: string | undefined,
): InputConfigVariable {
  const base = {
    key: cv.requiredConfigVariable.key,
    customerConfigVariableId: null,
    onPremiseResourceId: null,
  } as const;

  if (cv.requiredConfigVariable.dataType === "CONNECTION") {
    const values = cv.inputs.nodes.map((i) => ({
      name: i.name,
      type: "value",
      value: i.value ?? "",
    }));
    return { ...base, values: JSON.stringify(values) };
  }

  return { ...base, value: draft ?? cv.value ?? "" };
}
