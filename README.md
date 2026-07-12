# Prismatic Config Wizard Example

A Next.js app that embeds [Prismatic](https://prismatic.io) with a **fully custom** UI —
no Prismatic-hosted iframes. It demonstrates:

1. **SDK wiring** — server-side JWT signing + browser-side authentication
2. **Custom marketplace** — your own integration cards, rendered from Prismatic's GraphQL API
3. **Custom config wizard** — a multi-step, in-app wizard built on Prismatic's own config
   operations (no `configureInstance()` modal), so you fully control the look and flow

> **Note:** cards only appear for integrations that are **published** and marked
> **available in the marketplace**. With none configured, `/integrations` shows an
> empty state — the auth + GraphQL path still works.

Built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS.

> **New to the repo?** Start with [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the whole-repo
> picture — how the Slack and Teams integrations under `integrations/` use a shared library to
> generate the config this wizard renders. This README is the deep dive on the wizard app itself.
>
> The example integration is **Acme**, a generic SaaS that emits event webhooks. Its config wizard
> lets a customer pick which **notification categories** (Deployments, Security, Billing) to receive
> and, per category, the **delivery rules** (channel, real-time vs digest, quiet hours, minimum
> level) for routing those alerts to Slack or Teams.

## How it works

### Authentication

```
Browser (Client Component)            Server (API route)            Prismatic
─────────────────────────             ──────────────────            ─────────
usePrismaticAuth()
  prismatic.init()
  fetch /api/integration-token  ───▶  sign RS256 JWT with
                                       PRISMATIC_SIGNING_KEY
                              ◀───      { token, expiresAt }
  prismatic.authenticate({token}) ──────────────────────────────▶  embedded session
  (re-auth ~60s before expiry)
```

The private signing key **never** leaves the server. The browser only ever receives
the signed token. The embedded SDK is only imported in Client Components
(`hooks/usePrismaticAuth.ts`, `components/*`) — never in the API route or a Server
Component, since it relies on `window`/`document`.

### Multiple instances per integration

Each card lists the customer's **instances** of that integration (name · date · status), not
just a connect button. When the integration's marketplace configuration allows multiple
instances (`allowMultipleMarketplaceInstances`), the card shows an **Add Integration** button
that prompts for an instance name (pre-filled, e.g. "Acme Notifications 2") before creating;
otherwise a one-click **Connect** creates the single instance with a default name. The card
previews up to three instances; **View All →** opens `/integrations/[integrationId]`, where
every instance can be configured, paused/resumed, moved to a newer version, or deleted.

Instances are matched to their marketplace card by `versionSequenceId` — the identity that is
stable across an integration's versions — because an instance deployed at v1 carries a
different `integration.id` than the marketplace's latest version node.

### Config wizard

Clicking an instance row (or creating a new instance) routes to
`/integrations/configure/[instanceId]`, which renders our own `ConfigWizard`. The wizard runs
the **same operations Prismatic's built-in wizard uses**:

```
getConfigurationWizardInstance      load the instance + its config pages
        │
        ▼  (per page)
fetchConfigWizardPageContent        computed content: picklist options, JSONFORM schemas,
        │                            current values, OAuth authorize URLs
        ▼
updateInstanceConfigVariables       save each page's edited config vars
        │
        ▼  (last page)
deployInstance                      activate the instance
```

OAuth connection variables are polled (`useConnectionStatus`) until they flip to
`ACTIVE` after the user authorizes in a separate tab.

## Config wizard architecture

The wizard is the reference centerpiece. It's organized as three concentric rings so the
"plumbing every wizard needs" is cleanly separated from "this example's UX" — you keep the
former and replace the latter.

| Ring | Where | What it is |
|------|-------|------------|
| **Generic plumbing** | `lib/prismatic/*` | The Prismatic API: GraphQL queries, types, fetchers, write ops, connection polling, and a JSONFORM parser. No React, no integration specifics. Copy it verbatim into any embedded app. |
| **Engine** | `hooks/useConfigWizard.ts`, `hooks/useJsonDraft.ts` | Owns *all* wizard state — instance load, per-page content, the draft map, connection polling, validation, and submit/deploy/disconnect. Server interactions go through React Query (see below); only the draft edits and the step index are plain React state. Integration-agnostic. |
| **Presentational** | `components/wizard/{chrome,fields}/*` | The modal frame (`chrome`) and the generic field renderers (`fields`) that take a pre-wired `WizardField`. |
| **This example** | `lib/example/*`, `components/example/*` | This integration's notification-category schema and the custom step UX. **Delete it and the engine still works.** Everything named `example` is yours to replace; everything else is the reusable kit. |

### The engine hook

```tsx
const wizard = useConfigWizard(instanceId, { plugins });
```

`useConfigWizard` returns a declarative surface — `steps`, `step`, `stepIndex`, `field(key)`,
`ready`, `busy`, `submit()`, `goBack()`, `deployed`, … — so a UI just renders and calls
`submit`. It never touches the draft map, the query cache, the poller, or the submit shape.

**By default it renders everything `fetchConfigWizardPageContent` returns, as standard.** With
no `plugins`, each config page becomes one step and every config var renders through the
generic per-data-type field (`ConfigVarInput`): a `CONNECTION` as the OAuth panel, a `PICKLIST`
as a select, a `JSONFORM` via `JsonFormRenderer`, everything else as a text input. The engine
knows nothing about "categories," and the order config vars come back in is irrelevant.

To give **one specific config var** a richer experience — e.g. expand it into product-specific
sub-pages — register a `ConfigVarPlugin` under that var's **key**:

```ts
interface ConfigVarPlugin {
  // Replace ConfigVarInput wherever this var appears inline on a normal page.
  renderField?: (ctx: { field: WizardField; wizard: ConfigWizardEngine }) => ReactNode;
  // Expand this var's host page into >=1 steps (the "sub-pages"), each carrying
  // its OWN `render` (the custom UI) and `validate` (its readiness; return
  // `undefined` to defer to the engine default: every field filled, every
  // CONNECTION ACTIVE).
  expandSteps?: (ctx: ConfigVarPluginContext) => WizardStep[];
}

useConfigWizard(instanceId, { plugins: { Configuration: configurationPlugin } });
```

The engine tags every step a plugin produces with `ownerKey` (the config-var key) and marks
the page's base step `primary` — that step also renders the page's other, non-plugin vars with
the standard field, so they're never lost. Because each step carries its own `render` and
`validate`, the plugin is the single home for a var's step model *and* how its steps draw.
Anything you don't register stays fully standard.

### Server state: React Query

Every server interaction — the instance, each page's content, the marketplace list, the
embedded auth token, and the submit/deploy/disconnect mutations — runs through
[TanStack Query (React Query)](https://tanstack.com/query). 

- **Reads are `useQuery`** keyed by `lib/prismatic/queryKeys.ts`. Navigating back to an
  already-visited page is a cache hit.
- **Connection polling is a `useQuery` with `refetchInterval`** (`hooks/useConnectionStatus.ts`)
  that self-stops once every connection is `ACTIVE`, pauses on hidden tabs, and refetches
  when the user returns from the OAuth tab.
- **Auth is a token `useQuery`** (`hooks/usePrismaticAuth.ts`) whose `refetchInterval`
  re-authenticates just before the JWT expires.
- **Writes are `useMutation`**; `isPending`/`error` drive the `busy`/`actionError` flags, and
  `onSuccess` calls `queryClient.invalidateQueries` to refresh affected pages.
- **Retry/backoff** lives once in the `QueryClient` defaults (`app/providers.tsx`), so the
  GraphQL transport (`lib/prismatic/client.ts`) is a one-line wrapper with no retry loop.

The takeaway when reimplementing this yourself: reach for a server-state library before you
write a cache, a poller, or a dedup ref by hand.

### `useJsonDraft`

Several config vars store their value as a JSON **string**. `useJsonDraft` centralizes the
parse → read-slice → patch → `JSON.stringify(_, null, 2)` cycle so a step component thinks in
terms of its parsed shape, not string wrangling. Used by all three step/field renderers.

### Build your own config wizard

The rule of thumb: **everything you replace lives under an `example` folder; everything you
keep does not.**

- **Keep verbatim — the reusable kit:** `lib/prismatic/*` (the Prismatic API), `hooks/*` (the
  engine, connection polling, JSON-draft, auth), `components/wizard/*` (chrome + generic field
  renderers), `app/providers.tsx`, and `app/api/integration-token/route.ts`.
- **Replace — yours:** `lib/example/*` and `components/example/*`.
  `components/example/ConfigWizard.tsx` is the **assembly** you adapt: it calls
  `useConfigWizard`, maps `wizard.steps` to a body, and wires the nav buttons /
  `ready` / `busy` / `submit`.

Then pick the path that fits your integration:

**Path A — a standard wizard (most integrations).** You don't need anything under
`lib/example/*`. Call `useConfigWizard(instanceId)` with no plugins and render each page's
elements through the standard `ConfigVarInput` — copy the `PageElements` helper in
`components/example/ConfigWizard.tsx` as your starting point and delete the category-specific
parts. Every config var type renders out of the box.

**Path B — a custom multi-step experience for a specific config var.** Two steps, keyed by
that config var's name:

1. **Write a `ConfigVarPlugin`** (model it on `configurationPlugin` in
   `components/example/configurationPlugin.tsx`): `expandSteps` turns the var's page into your
   sub-pages, each with its own `render` (the custom UI) and `validate` (its gate). Parse your
   var's schema however you like (this example's `lib/example/configuration.ts` shows one
   approach).
2. **Register it** — `useConfigWizard(instanceId, { plugins: { <YourVarKey>: yourPlugin } })`.

Vars you don't register keep rendering standardly, so Path A and Path B mix freely on the same
page.


## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Get a signing key.** From the [Prism CLI](https://prismatic.io/docs/cli/):

   ```bash
   prism organization:signing-keys:generate
   ```

   The private key is shown only once — copy it.

3. **Find your org ID.** Prismatic web app → **Org Settings → Embedded** tab.

4. **Configure `.env.local`** (already created, gitignored):

   ```bash
   PRISMATIC_ORG_ID=<your org id>
   PRISMATIC_SIGNING_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

   The demo customer/user vars have working defaults.

5. **Run it**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. The home page shows live SDK auth status:
   - **Needs credentials** — `PRISMATIC_SIGNING_KEY` / `PRISMATIC_ORG_ID` not set yet
   - **Authenticated** — the embedded session is live

## Project layout

### App shell & SDK wiring

| Path | Purpose |
|------|---------|
| `app/api/integration-token/route.ts` | Server-only RS256 JWT signing |
| `app/providers.tsx` | React Query `QueryClientProvider` (caching/retry defaults), mounted in `app/layout.tsx` |
| `app/page.tsx` | Landing page + live auth status |
| `app/integrations/page.tsx` | Marketplace route |
| `app/integrations/[integrationId]/page.tsx` | Per-integration instance list ("View All") route |
| `app/integrations/configure/[instanceId]/page.tsx` | Config wizard route |
| `hooks/usePrismaticAuth.ts` | SDK init + token `useQuery`, re-auth-before-expiry |
| `components/AuthStatus.tsx` | Live auth-state indicator |

### Marketplace

| Path | Purpose |
|------|---------|
| `lib/marketplace.ts` | Marketplace GraphQL query, types, avatar helper, and the instance grouping / status / naming helpers |
| `lib/format.ts` | Short-date formatter for instance rows |
| `components/CustomMarketplace.tsx` | Fetches integrations + the customer's instances, groups them per card, renders the grid |
| `components/IntegrationCard.tsx` | A single card: instance rows with status, Add Integration / Connect, View All |
| `components/NewInstanceDialog.tsx` | Name prompt for a new instance; creates it and routes to the wizard |
| `components/IntegrationDetail.tsx` | The "View All" page: every instance with configure / pause / update / delete |
| `components/InstanceStatusIcon.tsx` | Per-instance status glyph (active / paused / unconfigured) |

### Config wizard — generic kit (reusable)

| Path | Purpose |
|------|---------|
| `lib/prismatic/*` | Generic Prismatic API: `client`, `queries`, `queryKeys`, `types`, `instance`, `pages`, `connections`, `jsonform` (+ `index` barrel) |
| `hooks/useConfigWizard.ts` | The wizard engine — owns all Prismatic state |
| `hooks/useConnectionStatus.ts` | Polls OAuth connection status until `ACTIVE` |
| `hooks/useJsonDraft.ts` | JSON-string draft editing primitive |
| `components/wizard/chrome/*` | Presentational frame: `Shell`, `Stepper`, `Loading`, `ErrorBox` |
| `components/wizard/fields/*` | Generic field renderers: `ConfigVarInput`, `JsonFormRenderer`, `MultiSelect` |

### Config wizard — this example (replaceable)

| Path | Purpose |
|------|---------|
| `lib/example/configuration.ts` | Parses this integration's `Configuration` JSONFORM var into a notification-category schema |
| `components/example/configurationPlugin.tsx` | `configurationPlugin` (`expandSteps`, per-step `render`/`validate`) — the category step model |
| `components/example/ConfigWizard.tsx` | Registers the `Configuration` plugin and assembles the rendered wizard |
| `components/example/*` | Custom step renderers: `CategorySelector` (category selection), `DeliveryStep` (per-category delivery rules) |
