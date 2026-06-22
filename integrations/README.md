# Acme × Prismatic — Starter Repository

[![Deploy Custom Components](https://github.com/prismatic-io/example-project-structure/actions/workflows/components.yml/badge.svg)](https://github.com/prismatic-io/example-project-structure/actions/workflows/components.yml)
[![Deploy Code-Native Integrations](https://github.com/prismatic-io/example-project-structure/actions/workflows/integrations.yml/badge.svg)](https://github.com/prismatic-io/example-project-structure/actions/workflows/integrations.yml)

This repo is a reference implementation showing one good way to organize a [Prismatic](https://prismatic.io/docs/) tenant for a B2B SaaS product like Acme's. Acme is a generic SaaS that emits event webhooks across a few **notification categories** (Deployments, Security, Billing). Like most Prismatic orgs, Acme is **one product surface, so it ships a single component**; the categories are plain data in a shared catalog, not separate packages. It demonstrates:

- How to package a product surface as **one custom component** (a connection + an action + a webhook trigger) that doubles as a building block for both customer-built workflows and developer-built integrations.
- How to keep the HTTP client, auth, the config-wizard form builder, and the notification-category catalog in **one shared TypeScript library**, so you write them once.
- How to provision an **org-managed customer connection** programmatically so customers never see or touch an Acme API key — the org wires authentication on the customer's behalf.
- How a **code-native integration** consumes that component to produce a productized "Acme alerts → Slack/Teams" experience, routing every event by its category through a single flow.

Everything here is meant to be copied, renamed, and extended. The patterns are deliberate; the placeholder code is replaceable.

---

## Repository layout

```
.
├── components/
│   └── acme/              # The Acme component — API key connection + listEvents action + eventWebhook trigger
├── integrations/
│   ├── slack/             # Code-native integration — routes Acme webhooks to Slack
│   └── ms-teams/          # Code-native integration — routes Acme webhooks to Microsoft Teams
├── shared-libs/
│   └── shared/            # @acme/shared — AcmeClient, AcmeAPIKeyConnection, buildConfigForm,
│                          #   evaluateDeliveryRules, and the ACME_CATEGORIES catalog (src/categories.ts)
├── scripts/
│   └── setup-connections.ts   # Provisions the org-managed customer connection
└── .github/workflows/     # CI for publishing the component and importing integrations
```

---

## The connection model

The `acme` component owns a single `AcmeAPIKeyConnection` (defined in `shared-libs/shared/src/connection.ts`, key `acmeApiKey`). That one connection serves both ways the component gets used:

| Used for | How |
|---|---|
| The connection slot in productized **code-native integrations** | A code-native integration declares one `customerActivatedConnection({ stableKey: "acme-api-key" })` and references the Acme component's connection. One authentication slot, used by the integration's flow. |
| A building block in the **low-code workflow builder** (embedded marketplace) | When customers build their own workflows in the embedded builder, they drop in the Acme component's actions/triggers; the org-managed connection is the implicit default, so no credential prompt. |

Both uses share the same Acme API key — there is one connection schema on the platform and one credential per customer.

### Using the Acme Connection in the Workflow Builder

With `defaultForComponent: true` set on the scoped config variable, the workflow builder uses the org-managed customer connection as the implicit default for the Acme component. Customers never see an Acme API key field in the builder, never type a credential, and never know one exists — the org provisions, the customer just builds workflows. `setup-connections.ts` sets the flag automatically (via a follow-up `updateScopedConfigVariable` call, since the create mutation doesn't accept it) and self-heals any SCVs that don't yet have it on re-runs.

---

## The component

There's one component, `acme`. It bundles a connection (`AcmeAPIKeyConnection`), a list action, and a single webhook trigger that receives every Acme event (each tagged with a `category`). Bodies of the action and trigger are placeholders right now — they wire to a stub `AcmeClient` in `shared-libs/shared`. Replace those calls with real Acme API endpoints when the API contract is ready.

| Component | Key | Actions | Triggers |
|---|---|---|---|
| Acme | `acme` | `listEvents` | `eventWebhook` |

The component declares `category: "Acme"`, which groups it (and any future Acme components) in the marketplace component list and is a filterable property in the embedded SDK.

Component file layout:
```
components/acme/
├── package.json
├── tsconfig.json
├── webpack.config.js
├── jest.config.js
├── assets/acme.png
└── src/
    ├── index.ts        # component({ key, display, actions, triggers, connections })
    ├── inputs.ts       # connectionInput helper
    ├── actions.ts      # listEvents
    └── triggers.ts     # eventWebhook
```

---

## A note on component filtering

Acme ships **one** component, so there's nothing to filter by component key — every customer sees the same single Acme component in the embedded workflow builder, and which notification categories they receive is configured in the wizard (per-category delivery rules), not by hiding components.

Component filtering becomes relevant only if an org splits its surface into **multiple product-line components** (one per separately-licensed product) and wants the embedded builder's action/trigger picker to hide the ones a given customer hasn't bought. In that case the mechanism is `filters.components.filterQuery` on the embedded SDK — passed at `prismatic.init()` for a default, or per `show*` call (`showWorkflow` / `showWorkflows` / `showMarketplace`) to react to UI state — block-listing the disabled components by `key`. See the [embedded component-filtering docs](https://prismatic.io/docs/) for the `ConditionalExpression` shape. The single-component Acme example here doesn't need it.


---

## `@acme/shared` — one place for auth and HTTP

`shared-libs/shared` (`@acme/shared`) is the single core library. It exports:

- **`AcmeAPIKeyConnection`** — the connection definition (key `acmeApiKey`). Single input `apiKey` (password). The Acme component registers this one connection object, so there's one connection schema on the platform and one API key per customer.
- **`AcmeClient`** — a thin HTTP client that takes a connection and exposes `get(path, config?)` and `post(path, body?, config?)`. Today the client points at a placeholder base URL (`getGatewayUrl()`) — swap that for the real Acme endpoint when ready.
- **`buildConfigForm`** / **`parseSelection`** / **`evaluateDeliveryRules`** — the config-wizard form builder and the runtime helpers the integrations use (the wizard app under the repo root consumes the form `buildConfigForm` produces).
- **`ACME_CATEGORIES`** — the notification-category catalog (`src/categories.ts`): the Deployments / Security / Billing entries as plain data (each a `CategoryModule` = a `NotificationCategory` + its delivery-field spec). `buildConfigForm(adapter, ACME_CATEGORIES)` turns it into the wizard's config form. **Adding a category is a one-line append here** — no new package, component, or flow.

The shared library is a workspace package referenced via `file:../../shared-libs/shared` in the component's and both integrations' `package.json`. When you change `shared-libs/shared`, every consumer sees the update without republishing manifests.

> **Shared library vs. component manifest:** when both a custom component and a code-native integration need to call the same API, prefer a shared library over including the component's manifest in the integration. Shared libraries keep the source local, iterate without republishing manifests, and avoid the indirection of "the manifest lives in code but the runtime lives on the platform."

---

## `integrations/slack` and `integrations/ms-teams` — the code-native integrations

The Slack and Teams integrations are productized "Acme alerts → Slack/Teams" workflows. They demonstrate:

1. **Declaring a single customer-activated Acme connection.** `configPages.ts` declares `customerActivatedConnection({ stableKey: "acme-api-key" })`. The `acme-api-key` stableKey matches the org-managed SCV that `scripts/setup-connections.ts` provisions against the Acme component — so when a customer activates the integration, their pre-provisioned Acme connection is automatically available. `configPages.ts` also builds the config wizard's form with `buildConfigForm(adapter, ACME_CATEGORIES)`.
2. **One webhook, one flow, routed by category.** A single flow binds to the Acme component's `eventWebhook` trigger (imported as `acmeEventWebhook`). Acme posts every event there tagged with a `category`; the flow reads `event.category`, looks up that category's saved delivery rules (`selection[category].delivery.channels`), gates on `evaluateDeliveryRules` (minimum level + quiet hours), and posts to the chosen channels. The Acme component is referenced via its **manifest** in `src/manifests/acme/` — regenerable with `npm run install:manifests`.
3. **Shared posting logic.** `src/lib/postToSlack.ts` exports a single `formatAcmeSlackMessage` helper (the Teams integration has the equivalent in `postToTeams.ts`); the message format lives in exactly one place.
4. **Slack/Teams as built-in components.** The Slack OAuth2 connection, channel data source, and `postMessage` action come from the built-in Slack component manifest in `src/manifests/slack/` — no Slack code in this repo. Teams uses a hard-coded channel list in this demo and skips the OAuth page.

Run locally:

```bash
cd integrations/slack       # or integrations/ms-teams
npm run import         # builds + imports to your Prismatic tenant
```

The Slack integration needs `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_SIGNING_SECRET` in your shell or a `.env` file before importing.

To regenerate the Acme component manifest after editing the component:

```bash
cd integrations/slack
npm run install:manifests
```

---

## `scripts/setup-connections.ts` — provisioning customer connections

This script is an **example** of how to do connection provisioning programmatically against the Prismatic GraphQL API. It's not a required piece of infrastructure or the only way to do this — it exists to show the shape of the work so Acme can fold equivalent logic into whatever provisioning pipeline already exists internally (a CRM webhook handler, a customer-onboarding job, a Temporal workflow, etc.).

The pattern it demonstrates: take the two mutations Acme ops prototyped by hand in the GraphQL Explorer (`createScopedConfigVariable` + `createCustomerConfigVariable`) and wrap them in a re-runnable script that handles authentication, pagination, idempotency, and per-customer key resolution. Reuse the structure, or lift the GraphQL operations into your own tooling.

Run it whenever:
- A new customer is added to the Prismatic org.
- An existing customer's Acme API key changes.

For the Acme component, it:

1. Looks up the component's `acmeApiKey` Connection ID on the platform.
2. Creates (or reuses) an **org-managed, customer-scoped `ScopedConfigVariable`** tied to that connection, with the deterministic `stableKey` `acme-api-key`.
3. Sets `defaultForComponent: true` on the scoped config var so the workflow builder picks it up as the default connection for the component. Existing SCVs whose flag is `false` are upgraded on re-run.
4. Paginates through every customer in the org and, for each one, creates a `CustomerConfigVariable` under the SCV with the customer's actual Acme API key.

(The `COMPONENTS` array in the script is the single `acme` entry today; if you ever split into multiple components, add a row per component and the rest of the flow is unchanged.)

The whole thing is **idempotent** — re-runs only do new work (new customers, new components). Existing SCVs/CCVs are detected by lookup and skipped.

### Why org-managed?

Customers should never paste an Acme API key into a marketplace UI. The Acme → customer relationship is managed by Acme's ops team. The script's role is to take that relationship and materialize it in Prismatic without humans clicking through UIs.

### Usage

```bash
# Dry run — see what would happen, no mutations
npm run setup:connections -- --dry-run

# Real run — provision with one shared API key for every customer (demo/sandbox)
npm run setup:connections -- --api-key acme_demo_xxx

# Real run — provision with per-customer API keys from a JSON file
npm run setup:connections -- --keys-file ./customer-keys.json

# Scope to one component or one customer
npm run setup:connections -- --component acme
npm run setup:connections -- --customer Q3VzdG9tZXI6...
```

`customer-keys.json` format (keys can be Prismatic customer IDs or `externalId`):
```json
{
  "acme-corp": "acme_live_xxx",
  "techstart-inc": "acme_live_yyy",
  "global-systems": "acme_live_zzz"
}
```

Auth is handled by shelling out to `prism me:token` — make sure you're logged in via the [Prism CLI](https://prismatic.io/docs/cli/) before running.

---

## Local commands

From the repo root:

| Command | What it does |
|---|---|
| `npm install` | Install all workspace dependencies. |
| `npm run build:components` | Build every component (loop over `components/*/`). |
| `npm run publish:components` | Build + publish every component. Uses `--no-confirm --skip-on-signature-match` so unchanged components are skipped. |
| `npm run generate:manifests` | Regenerate every component's manifest output (for inspection — installation into integrations happens via the integration's own `install:manifests` script). |
| `npm run build:slack` / `npm run build:teams` | Build the Slack / Teams integration. |
| `npm run import:slack` / `npm run import:teams` | Build + import the Slack / Teams integration. |
| `npm run build:all` | All components + the Slack and Teams integrations. |
| `npm run deploy:all` | Publish all components + import the Slack and Teams integrations. |
| `npm run setup:connections` | Provision per-customer connections (see above). Supports `--dry-run`, `--api-key`, `--keys-file`, `--component`, `--customer`. |

---

## CI/CD

Two GitHub Actions workflows run on pushes to `main`:

- **`.github/workflows/components.yml`** — for each subdir under `components/`, detects whether its files (or files under the matching `shared-libs/<name>/` path) changed, then builds, tests, and publishes the component to each Prismatic region (Australia, Canada).
- **`.github/workflows/integrations.yml`** — for each subdir under `integrations/`, detects changes and runs the equivalent build + import flow.

Each environment needs:
- `PRISMATIC_URL` (variable) and `PRISM_REFRESH_TOKEN` (secret) — auth.
- `INTEGRATION_ID_<NAME>` (variable) per integration — set after the first manual import so the workflow can re-import in-place.
- For the Slack integration: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` as repository-level secrets.

The `setup-connections` script is **not** wired into CI — it's an ops-side tool the team runs when customers or component connections change. If you want it on a schedule, wrap it in a cron'd action and pass `--keys-file` from a secret.

---

## Next steps for Acme

1. **Replace the placeholder `AcmeClient`** in `shared-libs/shared/src/client.ts` with real Acme API endpoints. The component and both integrations pick up the new behavior automatically.
2. **Replace the placeholder webhook trigger body** in the Acme component with real signature verification + payload parsing once the Acme webhook contract is finalized.
3. **Drop a real Acme logo** at `components/acme/assets/acme.png` — it's a placeholder icon today.
4. **Configure your CI/CD environment.** The workflows in `.github/workflows/` are wired but need org-specific values plugged in: create a GitHub Environment per Prismatic region you deploy to (the examples use `australia` and `canada` — rename or replace), populate each with the `PRISMATIC_URL` variable and `PRISM_REFRESH_TOKEN` secret, and add the Slack OAuth credentials (`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`) as repository-level secrets. After importing each integration manually for the first time in a region, copy its ID into an `INTEGRATION_ID_<NAME>` variable in that environment so subsequent CI runs re-import in place. See the "CI/CD" section above for the full list of expected variables.
5. **Wire `setup-connections.ts` into your provisioning pipeline** — whenever you add a new Acme customer to the Prismatic org (via the Customers API or UI), follow up with `npm run setup:connections -- --customer <id> --keys-file ./keys.json` so the customer's connections are immediately ready.
6. **Add more code-native integrations** as Acme's product partners come online (PagerDuty, Splunk, ServiceNow, ...). The pattern in `integrations/slack` and `integrations/ms-teams` carries over verbatim — point each integration's connection slot at the Acme component via `customerActivatedConnection({ stableKey: "acme-api-key" })`, register `{ acme }` (plus the destination's own component), and route its single `eventWebhook` flow by `event.category`.

---
