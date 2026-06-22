import type { CategoryModule, NotificationCategory } from "./types";
import { DELIVERY_FIELDS } from "./constants";

// ─────────────────────────────────────────────────────────────────────────────
// Acme's notification categories — the event TYPES the single Acme system emits.
//
// A typical Prismatic org has ONE component for its product; the categories below are
// notification types within that one product (NOT separate product lines), so they live here
// as plain data rather than in separate packages. `buildConfigForm(adapter, ACME_CATEGORIES)`
// turns this catalog into the holistic Configuration jsonForm the custom wizard renders, and at
// runtime the integration's single webhook flow routes by an event's `category`.
//
// Every category reuses the shared `DELIVERY_FIELDS` (mode / minLevel / quiet hours); add a
// category by appending one entry here — no new package, component, or flow required.
// ─────────────────────────────────────────────────────────────────────────────

export const deploymentsCategory: NotificationCategory = {
  key: "deployments",
  label: "Deployments",
  description:
    "Build, release, and rollback events from your CI/CD pipelines. Enable to forward deployment alerts to a channel.",
};

export const securityCategory: NotificationCategory = {
  key: "security",
  label: "Security",
  description:
    "Vulnerability alerts, suspicious sign-ins, and policy violations. Enable to forward security alerts to a channel.",
};

export const billingCategory: NotificationCategory = {
  key: "billing",
  label: "Billing",
  description:
    "Invoices, payment failures, plan changes, and usage limits. Enable to forward billing alerts to a channel.",
};

/** The full catalog of Acme notification categories, consumed by `buildConfigForm`. */
export const ACME_CATEGORIES: CategoryModule[] = [
  { category: deploymentsCategory, delivery: DELIVERY_FIELDS },
  { category: securityCategory, delivery: DELIVERY_FIELDS },
  { category: billingCategory, delivery: DELIVERY_FIELDS },
];
