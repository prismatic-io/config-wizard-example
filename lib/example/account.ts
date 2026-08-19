// ─────────────────────────────────────────────────────────────────────────────
// THIS EXAMPLE's account-search vocabulary — the part you replace for your own
// integration. Tiny by design: the search itself runs server-side in the FakeCRM
// integration's "Account" datasource; the frontend only needs the config-var
// keys it saves to and invokes.
// ─────────────────────────────────────────────────────────────────────────────

/** The picklist datasource var holding the selected FakeCRM account. */
export const ACCOUNT_KEY = "Account";

/** The plain string var the account datasource reads its search text from. */
export const ACCOUNT_SEARCH_KEY = "Account Search";
