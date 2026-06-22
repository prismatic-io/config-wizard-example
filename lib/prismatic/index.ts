// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration.
//
// Barrel for the generic Prismatic wizard layer. Import from "@/lib/prismatic" and
// you get the transport, queries, types, fetchers, write ops, page helpers,
// connection polling, and the generic JSONFORM model — everything a config wizard
// needs that is NOT specific to one integration's schema. Integration-specific
// parsing (e.g. the brand "Configuration" var) lives in "@/lib/example/*" instead.
// ─────────────────────────────────────────────────────────────────────────────

export * from "./types";
export * from "./client";
export * from "./queryKeys";
export * from "./queries";
export * from "./instance";
export * from "./pages";
export * from "./connections";
export * from "./jsonform";
