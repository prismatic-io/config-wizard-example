"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THIS EXAMPLE's account-search plugin — the part you replace for your own
// integration. Two plugins cover the "Select Account" page's pair of vars:
//
// - `accountSearchPlugin` (on "Account", the picklist datasource var)
//   draws the type-ahead search UI in the var's slot. The engine's default
//   non-empty gate on both vars is exactly the right readiness: Next enables
//   once an account is actually selected.
// - `accountSearchFieldPlugin` (on "Account Search", the string var)
//   renders nothing — the search UI IS that var's input; without this the
//   page would also show a bare duplicate text box for it.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConfigVarPlugin } from "@/hooks/useConfigWizard";
import { AccountSearchStep } from "@/components/example/AccountSearchStep";
import { ACCOUNT_SEARCH_KEY } from "@/lib/example/account";

export { ACCOUNT_KEY, ACCOUNT_SEARCH_KEY } from "@/lib/example/account";

/** The search/selection UI, targeted at the "Account" datasource var. */
export const accountSearchPlugin: ConfigVarPlugin = {
  renderField: ({ field, wizard }) => {
    const search = wizard.field(ACCOUNT_SEARCH_KEY);
    if (!search) return null;
    return (
      <AccountSearchStep wizard={wizard} search={search} account={field} />
    );
  },
};

/** Hides the standard text input for the search-text var (see header). */
export const accountSearchFieldPlugin: ConfigVarPlugin = {
  renderField: () => null,
};
