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

### Config wizard

Clicking a card resolves the customer's instance for that integration (creating one if
needed) and routes to `/integrations/configure/[instanceId]`, which renders our own
`ConfigWizard`. The wizard runs the **same operations Prismatic's built-in wizard uses**:

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
  // Expand this var's host page into one or more steps (the "sub-pages").
  expandSteps: (ctx: ConfigVarPluginContext) => WizardStep[];
  // Per-step readiness; return `undefined` to defer to the engine default
  // (every field filled, every CONNECTION ACTIVE).
  validateStep: (ctx: ConfigVarValidateContext) => boolean | undefined;
}

useConfigWizard(instanceId, { plugins: { Configuration: configurationPlugin } });
```

The engine tags every step a plugin produces with `ownerKey` (the config-var key) and marks
the page's base step `primary`. The matching **renderer** for those steps is registered on the
view side, in your wizard component's `customRenderers` map under the same key — so the key is
the single link between a var's step model (data) and how its steps draw (JSX). The `primary`
step also renders the page's other, non-plugin vars with the standard field, so they're never
lost. Anything you don't register stays fully standard.

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

**Path B — a custom multi-step experience for a specific config var.** Three steps, all keyed
by that config var's name:

1. **Data** — write a `ConfigVarPlugin` (model it on `configurationPlugin` in
   `lib/example/steps.ts`): `expandSteps` turns the var's page into your sub-pages,
   `validateStep` gates each. Parse your var's schema however you like (this example's
   `lib/example/configuration.ts` shows one approach).
2. **Register it** — `useConfigWizard(instanceId, { plugins: { <YourVarKey>: yourPlugin } })`.
3. **View** — add a renderer under the **same key** to the `customRenderers` map in your
   wizard component (this example renders `CategorySelector` / `DeliveryStep`).

The shared key is the only coupling between the two halves. Vars you don't register keep
rendering standardly, so Path A and Path B mix freely on the same page.


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
| `app/integrations/configure/[instanceId]/page.tsx` | Config wizard route |
| `hooks/usePrismaticAuth.ts` | SDK init + token `useQuery`, re-auth-before-expiry |
| `components/AuthStatus.tsx` | Live auth-state indicator |

### Marketplace

| Path | Purpose |
|------|---------|
| `lib/marketplace.ts` | Marketplace GraphQL query, types, avatar/status helpers |
| `components/CustomMarketplace.tsx` | Fetches integrations, renders the card grid, refetches on deploy/delete events |
| `components/IntegrationCard.tsx` | A single card; resolves/creates the instance and routes to the wizard |

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
| `lib/example/steps.ts` | `configurationPlugin` (`expandSteps` + `validateStep`) — the category step model |
| `components/example/ConfigWizard.tsx` | Registers the `Configuration` plugin + its `customRenderers`, and assembles the rendered wizard |
| `components/example/*` | Custom step renderers: `CategorySelector` (category selection), `DeliveryStep` (per-category delivery rules) |
