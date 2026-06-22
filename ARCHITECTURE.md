# Architecture Overview

> A guided tour of this repo. The [`README.md`](./README.md) is a deep dive into the Next.js
> config-wizard app; **this** doc zooms out to the whole repo and explains how the two messaging
> integrations (Slack and Microsoft Teams) and the wizard fit together.

## What this repo is

It's a single demonstration of an **embedded Prismatic** experience with a **fully custom UI**
(no Prismatic-hosted iframes), made of two halves that live in one tree:

| Half | Where | What it is |
|------|-------|------------|
| **Integration side** (backend) | `integrations/` | A Prismatic monorepo (npm workspaces): two **code-native integrations** (Slack, MS Teams), a single custom **Acme component** (one webhook + one action), and one **shared library** (`@acme/shared`). This is what actually runs in Prismatic and reacts to **Acme** webhooks. |
| **Wizard side** (frontend) | repo root (`app/`, `hooks/`, `lib/`, `components/`) | A **Next.js 16 / React 19** app that embeds Prismatic and renders a custom, multi-step **config wizard** so customers can set up an integration in your own branded UI. |

The example product is **Acme** — a generic SaaS that emits event webhooks across a few
**notification categories** (Deployments, Security, Billing). A customer uses the wizard to choose
which categories to receive and, per category, the **delivery rules** for routing those alerts to a
Slack or Teams channel. The interesting part is the **seam between the two halves**, which is the
subject of this document.

---

## The big picture

The two halves **never import each other.** They are coupled by exactly one thing: the shape of
a single Prismatic config variable — a JSONFORM named **`Configuration`**. The integration side
*produces* that JSONFORM; the wizard side *consumes* it.

```
  INTEGRATION SIDE  (integrations/)                 WIZARD SIDE  (repo root, Next.js)
  ─────────────────────────────────                ──────────────────────────────────
  @acme/shared  (one shared lib)
    ACME_CATEGORIES  ── CategoryModule[]
    [deployments, security, billing]
                                │
                                ▼
    @acme/shared  buildConfigForm(adapter, ACME_CATEGORIES)
                                │
                    emits ONE holistic JSONFORM:
                    per category → enabled + a delivery
                    group (channels / mode / minLevel /
                    quiet hours)
                                │
                 ┌──────────────┴───────────────┐
         Slack: live channels        Teams: faked channel list
         via Slack API               (the ONLY platform-specific bit)
                                │
                                ▼
                    "Configuration" config var  ───────►  hooks/useConfigWizard.ts
                         (a JSONFORM)                       generic engine — no Acme knowledge
                                                                    │  registers a ConfigVarPlugin
                                                                    │  keyed to "Configuration"
                                                                    ▼
                                                    lib/example/configuration.ts
                                                      parseConfiguration() reads that SAME
                                                      JSONFORM back into CategoryConfig[]
                                                                    │
                                                                    ▼
                                                    lib/example/steps.ts  (the plugin)
                                                      expandSteps → "General" step +
                                                      one Delivery step per ENABLED category
                                                                    │
                                                                    ▼
                                                    components/example/* renderers draw the steps
```

**Why this matters:** adding a third messaging integration (say, Discord) requires *zero* wizard
changes. You write one new code-native integration that calls the same `buildConfigForm()` with a
Discord channel adapter — and the existing wizard renders it identically. The integration's only
job is to discover its channels and ship the standard form.

> **One naming heads-up:** both halves call the same entities **categories**
> (`NotificationCategory`/`CategoryModule` on the integration side, `CategoryConfig` on the wizard
> side). They are the same objects viewed from each side of the seam.

---

## The Acme notification categories

Acme is one system, so its categories are not separate packages — they're entries in a single
catalog, **`ACME_CATEGORIES`**, defined in `@acme/shared` (`src/categories.ts`). Each is a
`CategoryModule` — a catalog entry plus a *delivery-field spec*:

```ts
interface CategoryModule {
  category: NotificationCategory;  // key, label, description
  delivery: DeliveryFieldSpec[];   // the per-category delivery-rule fields
}

export const ACME_CATEGORIES: CategoryModule[] = [ deployments, security, billing ];
```

| Category | Key | What it covers |
|----------|-----|----------------|
| **Deployments** | `deployments` | Build, release, and rollback events from CI/CD pipelines |
| **Security** | `security` | Vulnerability alerts, suspicious sign-ins, policy violations |
| **Billing** | `billing` | Invoices, payment failures, plan changes, usage limits |

Adding a category is a one-line append to `ACME_CATEGORIES` — no new package, component, or flow.
Every category ships the same standard set of delivery fields (from `@acme/shared`'s
`DELIVERY_FIELDS`), so the wizard renders each category's Delivery step identically. A delivery
field is the single source of truth shared by the category's component (which builds its typed
inputs from it) and the wizard (which renders the matching control):

```ts
interface DeliveryFieldSpec {
  key: string;            // property key in the emitted schema
  label: string;          // UI label
  multi: boolean;         // array (multi-select) vs string (single value)
  required?: boolean;
  default?: string;       // for single fields, e.g. mode → "Real-time"
  options: DeliveryOption[];// { label, value } pairs; empty + single ⇒ free-text input
}
```

The standard fields are `mode` (Real-time / Digest), `minLevel` (Info → Critical threshold), and
`quietHoursStart` / `quietHoursEnd` (free-text `HH:MM` window). The `channels` multi-select is
injected separately by `buildConfigForm` from the platform channel adapter.

---

## The shared library: `@acme/shared`

`integrations/shared-libs/shared/` is the generic Acme core. The piece that powers the wizard seam
is **`buildConfigForm()`** (`src/forms.ts`):

```ts
buildConfigForm(
  adapter: ChannelAdapter,     // platform-specific: channel title, icon, channel options
  modules: CategoryModule[],   // normally ACME_CATEGORIES, the shared catalog
): JSONForm
```

It emits **one** JSONFORM where each category is an object carrying its full shape up front —
`enabled` plus a `delivery` group (a `channels` multi-select pre-loaded with the adapter's live
options, and one node per `DeliveryFieldSpec`). Because everything is enumerated in this single
value, the wizard needs no per-step server round-trips.

Its public surface (`src/index.ts`):

- **Form:** `buildConfigForm`, `parseSelection` (tolerant read of the saved value), `CategorySelection`, `DeliverySelection`.
- **Catalog:** `ACME_CATEGORIES` (the notification categories, in `src/categories.ts`).
- **Type contracts:** `NotificationCategory`, `CategoryModule`, `DeliveryFieldSpec`, `DeliveryOption`,
  `ChannelAdapter`, `ChannelOption`, plus the shared `DELIVERY_FIELDS` / `DELIVERY_MODES` / `SEVERITY_LEVELS`.
- **Runtime:** `evaluateDeliveryRules` (applies a saved category's `minLevel` threshold + quiet-hours
  window to an incoming event), `AcmeClient`, `AcmeAPIKeyConnection`, `getGatewayUrl`.

`@acme/shared` is wired as a local workspace dep (`"@acme/shared": "file:../../shared-libs/shared"`),
so editing it immediately benefits every consumer without republishing.

---

## The two integrations: Slack & Teams

Both integrations import the **same `ACME_CATEGORIES` catalog** and call the **same** `buildConfigForm`.
The *only* substantive difference is the **channel adapter** — how each platform supplies the list of
destinations.

**Slack** (`integrations/integrations/slack/src/configPages.ts`) — fetches channels live from the
Slack API using the customer's OAuth connection, and therefore has an extra **Connections** page for
that OAuth step:

```ts
const channels = await fetchSlackChannels(context.configVars["Slack Connection"]);
return {
  result: buildConfigForm(
    { channelTitle: "Send to Slack channel", channelIcon: "hash", channelOptions: channels },
    ACME_CATEGORIES,
  ),
};
```

**Teams** (`integrations/integrations/ms-teams/src/configPages.ts`) — has no real Teams connection in
this demo, so it hands the same helper a **hard-coded** channel list and skips the OAuth page entirely:

```ts
return {
  result: buildConfigForm(
    { channelTitle: "Send to Teams channel", channelIcon: "hash", channelOptions: FAKE_TEAMS_CHANNELS },
    ACME_CATEGORIES,
  ),
};
```

That's the proof point: **one renderer, one shared config library, two integrations.**

At runtime, Acme posts every event to the integration's single webhook, each tagged with a `category`.
**One flow** per integration subscribes to that webhook and routes by `event.category`: it reads the
matching channels from the `Configuration` var via `parseSelection` (at
`selection[categoryKey].delivery.channels`), and uses `evaluateDeliveryRules` to honor that category's
minimum level and quiet-hours window before posting.

---

## The custom config wizard

The Next.js app renders the form. Its architecture is detailed in the [`README.md`](./README.md); the
short version is three concentric rings:

| Ring | Where | Role |
|------|-------|------|
| **Generic kit** | `lib/prismatic/*`, `components/wizard/*`, `hooks/useConnectionStatus.ts`, `hooks/useJsonDraft.ts` | The Prismatic API, the modal frame, the generic per-data-type field renderers, OAuth polling. No Acme specifics — copy verbatim into any embedded app. |
| **Engine** | `hooks/useConfigWizard.ts` | Owns *all* wizard state (instance load, page content, draft edits, connection polling, validation, submit/deploy) via React Query. Integration-agnostic. |
| **This example** | `lib/example/*`, `components/example/*` | The Acme-specific schema parser, step model, and step UI. **Delete it and the engine still works.** |

The engine renders whatever Prismatic returns as standard fields by default. To give one config var a
richer, multi-step experience you register a **`ConfigVarPlugin`** under that var's key. This example
registers one for `Configuration`:

```ts
useConfigWizard(instanceId, { plugins: { Configuration: configurationPlugin } });
```

- **`parseConfiguration()`** (`lib/example/configuration.ts`) walks the holistic JSONFORM schema back
  into a `CategoryConfig[]`.
- **`configurationPlugin.expandSteps`** (`lib/example/steps.ts`) turns the page holding that var into a
  **"General"** step (enable categories) plus **one Delivery step per enabled category** (channel + mode
  + minimum level + quiet hours). `validateStep` gates each.
- The **same key** (`Configuration`) links the step *model* (the plugin) to the step *rendering* (the
  `customRenderers` map in `components/example/ConfigWizard.tsx`, which draws `CategorySelector` and
  `DeliveryStep`).

Every step reads and writes slices of that **one** config-var value, so there is no per-step fetch.

---

## End-to-end flow

1. Customer opens a card in the custom marketplace → an instance is resolved/created → the app routes
   to the wizard at `/integrations/configure/[instanceId]`.
2. `useConfigWizard` loads the instance and the `Configuration` JSONFORM (the one `buildConfigForm`
   produced on the integration side).
3. The `Configuration` plugin runs `parseConfiguration` → `CategoryConfig[]`, then `expandSteps` produces
   the **General** step + a **Delivery** step per enabled category.
4. The customer enables Acme categories, then per category picks destination channels, a delivery mode, a
   minimum level, and (optionally) quiet hours. Every edit is patched into the single `Configuration` value.
5. On submit, the wizard saves the config and **deploys** the instance (the same operations Prismatic's
   built-in wizard uses).
6. Thereafter, Acme posts events to the integration's single webhook; one flow routes each by
   `event.category`, reads the saved channels + delivery rules, and posts alerts to Slack / Teams.

---

## Where things live

| Path | Purpose |
|------|---------|
| `integrations/shared-libs/shared/` | `@acme/shared` — `buildConfigForm`, the `ACME_CATEGORIES` catalog, type contracts, client/connection, `evaluateDeliveryRules` |
| `integrations/components/acme/` | The single custom Acme component (`eventWebhook` trigger + `listEvents` action + connection) |
| `integrations/integrations/slack/` | Slack code-native integration (config page + flow) |
| `integrations/integrations/ms-teams/` | MS Teams code-native integration (config page + flows) |
| `lib/prismatic/*` | Generic Prismatic API kit (GraphQL, types, JSONFORM parser) — reusable |
| `hooks/useConfigWizard.ts` | The wizard engine |
| `components/wizard/*` | Generic chrome + field renderers — reusable |
| `lib/example/*`, `components/example/*` | This example's Acme-specific schema parser, plugin, and step UI |
| `app/*` | Next.js routes, providers (React Query), server-side JWT signing |

For the wizard internals — React Query usage, the engine's full surface, and how to build your own —
see [`README.md`](./README.md).
