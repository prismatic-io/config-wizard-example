"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THIS EXAMPLE's account search step — the part you replace for your own
// integration. A single-page, type-ahead search: type a partial account or
// contact name, pick a result, or clear and search again.
//
// Each search is ONE call: the debounced text rides along as a `value` input
// on fetchDataSourceContent, and the "Account" datasource's perform reads it
// from `params.search`. React Query keys results by the debounced search text,
// so an old term's late response is never rendered over a newer term's.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Search, X } from "lucide-react";
import type { ConfigWizardEngine, WizardField } from "@/hooks/useConfigWizard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { parsePicklistContent, prismaticKeys } from "@/lib/prismatic";
import { ACCOUNT_KEY } from "@/lib/example/account";

interface AccountSearchStepProps {
  wizard: ConfigWizardEngine;
  /** The "Account Search" string var (the search box's text). */
  search: WizardField;
  /** The "Account" picklist var (the selection). */
  account: WizardField;
}

export function AccountSearchStep({
  wizard,
  search,
  account,
}: AccountSearchStepProps) {
  const instanceId = wizard.data?.instance.id ?? "";
  const debounced = useDebouncedValue(search.value, 400).trim();
  const selected = account.value.trim().length > 0;

  const results = useQuery({
    queryKey: prismaticKeys.dataSource(
      instanceId,
      ACCOUNT_KEY,
      debounced.toLowerCase(),
    ),
    enabled: Boolean(instanceId) && debounced.length > 0 && !selected,
    // A save→invoke pair for the same text can land against different saved
    // state (e.g. after clearing a selection) — never trust a cached entry.
    staleTime: 0,
    // A failed search renders inline and the user just types again.
    retry: 0,
    queryFn: async () =>
      parsePicklistContent(
        await wizard.invokeDataSource(ACCOUNT_KEY, [
          { name: "search", type: "value", value: debounced },
        ]),
      ),
  });

  // Editing the text un-selects; changing (or clearing) a selection resets the
  // downstream pages whose datasources read the "Account" var.
  const type = (text: string) => {
    if (selected) {
      wizard.resetDownstream(ACCOUNT_KEY);
      account.onChange("");
    }
    search.onChange(text);
  };

  const select = (key: string, label: string) => {
    if (account.value !== key) wizard.resetDownstream(ACCOUNT_KEY);
    account.onChange(key);
    // The box takes the account's name — type-ahead convention, and it keeps
    // the engine's non-empty readiness gate on the search var satisfied.
    search.onChange(label);
  };

  const clear = () => {
    if (selected) wizard.resetDownstream(ACCOUNT_KEY);
    account.onChange("");
    search.onChange("");
  };

  // The debounce window and the fetch both read as "searching".
  const searching =
    !selected && debounced.length > 0 && (results.isFetching || search.value.trim() !== debounced);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 focus-within:border-primary">
        <Search size={16} className="shrink-0 text-neutral-400" />
        <input
          value={search.value}
          onChange={(e) => type(e.target.value)}
          placeholder="Search by account or contact name"
          className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        {searching && (
          <Loader2 size={16} className="shrink-0 animate-spin text-neutral-400" />
        )}
        {(search.value.length > 0 || selected) && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {selected ? (
        <ul className="overflow-hidden rounded-md border border-neutral-200">
          <li className="flex items-center gap-2 bg-primary/5 px-3 py-2 text-sm text-primary">
            <Check size={14} className="shrink-0" />
            <span className="flex-1 truncate">{search.value}</span>
            <button
              type="button"
              onClick={clear}
              aria-label="Clear selection"
              className="shrink-0 text-neutral-400 hover:text-neutral-600"
            >
              <X size={14} />
            </button>
          </li>
        </ul>
      ) : debounced.length === 0 ? (
        <p className="px-1 py-2 text-sm text-neutral-400">
          Type to search your FakeCRM accounts.
        </p>
      ) : results.error ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Search failed — try again. ({results.error instanceof Error ? results.error.message : String(results.error)})
        </p>
      ) : results.isFetching || !results.data ? (
        <p className="px-1 py-2 text-sm text-neutral-400">Searching…</p>
      ) : results.data.length === 0 ? (
        <p className="px-1 py-2 text-sm text-neutral-500">
          No accounts matched &ldquo;{debounced}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200">
          {results.data.map((opt) => (
            <li key={opt.key}>
              <button
                type="button"
                onClick={() => select(opt.key, opt.label)}
                className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
