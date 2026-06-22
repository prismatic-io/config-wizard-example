// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. The thin GraphQL transport: every fetcher/mutation in this folder
// goes through `graphql`, which runs the request and surfaces the non-GraphQL error
// envelopes the API can return. Caching, de-duplication, polling, and retry/backoff
// are NOT handled here — that is React Query's job (see app/providers.tsx). Keeping
// the transport a one-liner is the whole point.
// ─────────────────────────────────────────────────────────────────────────────

import prismatic from "@prismatic-io/embedded";

/**
 * The Prismatic API can return a non-GraphQL envelope (e.g. a `{ detail }` rate-limit
 * message) that the SDK passes through verbatim. Throw it as a real error so callers —
 * and the React Query retry/backoff that wraps them — treat throttling like any other
 * transient failure instead of silently receiving a malformed result.
 */
export function throwIfApiError(result: unknown): void {
  if (result && typeof result === "object" && "detail" in result) {
    throw new Error(String((result as { detail: unknown }).detail));
  }
}

/**
 * Thin wrapper over `prismatic.graphqlRequest` — just the request, nothing more.
 * Fetchers run `throwIfApiError` on the result, so a throttle envelope surfaces as a
 * thrown error; React Query then retries it with a gentle backoff (configured once in
 * app/providers.tsx). The API is rate-limited (~20 req/s) and the SDK fires several
 * requests on mount, so transient throttling is expected — and now handled for free,
 * with no retry loop to maintain here.
 */
export async function graphql<T>(args: {
  query: string;
  variables?: Record<string, unknown>;
}): Promise<{ data: T; errors?: { message: string }[] }> {
  return prismatic.graphqlRequest<T>(args);
}
