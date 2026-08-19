# Acme × Prismatic — FakeCRM Config Wizard

A reference implementation of a **fully custom** [Prismatic](https://prismatic.io) config
wizard — your own multi-step UI built on the same operations Prismatic's built-in wizard
uses, no hosted iframes. It's shown end-to-end through the **FakeCRM** integration for the
fictional **Acme** app, with a custom marketplace around it.

**The point of this repo is adaptation.** Everything under an `example` folder is yours to
replace with your integration's UX; everything else is the reusable kit you keep. Built with
Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS.

## Quick start

1. **Install and run**

   ```bash
   npm install
   npm run dev            # http://localhost:3000
   ```

   Point `.env.local` (gitignored) at your Prismatic org — see
   [Setup from scratch](#setup-from-scratch).

2. **Open the marketplace** — http://localhost:3000/integrations shows the FakeCRM card with
   the customer's instances (cards appear for integrations published and marked available in
   the marketplace). **Link Account** names a new instance and drops into the wizard; an
   existing instance row re-enters it.

3. **The wizard** walks four pages defined by the integration: **Connect FakeCRM** (API-key
   connection), **Mapping Owner** (a table gating Next until every FakeCRM contact is
   mapped), **Link Deals** (checklist scoped to mapped owners), and a read-only
   confirmation where **Create** deploys.

The backing integration lives in [`integrations/`](./integrations) — one code-native
integration (`owner-to-fakecrm-sync`). **Both sides are mocked** (`mockData.ts` for FakeCRM,
`acmeClient.ts` for Acme), so it needs no external services, credentials, or org-level
connection provisioning:

```bash
cd integrations
npm install
npm run build     # webpack-builds owner-to-fakecrm-sync
npm run import    # prism integrations:import (requires `prism login`)
```

## Adapting this to your app

The rule of thumb: **everything you replace lives under an `example` folder; everything you
keep does not.**

| Ring | Where | What it is |
|------|-------|------------|
| **Generic plumbing** | `lib/prismatic/*` | The Prismatic API: GraphQL queries, types, fetchers, write ops, connection polling, and a JSONFORM parser. No React, no integration specifics. Copy it verbatim into any embedded app. |
| **Engine** | `hooks/useConfigWizard.ts`, `hooks/useJsonDraft.ts` | Owns *all* wizard state — instance load, per-page content, the draft map, connection polling, validation, and submit/deploy/disconnect. Integration-agnostic. |
| **Presentational** | `components/wizard/{chrome,fields}/*` | The modal frame (`chrome`) and the generic field renderers (`fields`) that take a pre-wired `WizardField`. |
| **This integration** | `lib/example/*`, `components/example/*` | The FakeCRM wizard's custom UX. **Delete it and the engine still works.** `components/example/ConfigWizard.tsx` is the assembly you adapt: it holds the plugin registry and wires the nav buttons / `ready` / `busy` / `submit`. |

### The engine hook

```tsx
const wizard = useConfigWizard(instanceId, { plugins });
```

`useConfigWizard` returns a declarative surface — `stepIndex`, `page`, `field(key)`, `ready`,
`busy`, `submit()`, `goBack()`, `deployed`, … — so a UI just renders and calls `submit`.

**The wizard is one step per config page.** By default every config var renders through the
generic per-data-type field (`ConfigVarInput`): a `CONNECTION` as the connection panel, a
`PICKLIST` as a select, a `JSONFORM` via `JsonFormRenderer`, everything else as a text input —
and "Next" enables once every var on the page is satisfied. For a standard wizard you need no
plugins at all. To give **one specific config var** a richer experience, register a
`ConfigVarPlugin` under that var's **key**:

```ts
interface ConfigVarPlugin {
  // Replace ConfigVarInput in the var's element slot (return null to hide it).
  renderField?: (ctx: { field: WizardField; wizard: ConfigWizardEngine }) => ReactNode;
  // Replace the engine's default readiness gate for this var.
  // Return `undefined` to defer to the default.
  validate?: (ctx: { field: WizardField }) => boolean | undefined;
}

useConfigWizard(instanceId, { plugins: { "Owner Mapping": ownerMappingPlugin } });
```

Both hooks run only while the var's host page is the current page — `field.value` is the live
draft (seeded from the saved instance value on re-entry) and `field.content` is the var's
computed page content. Unregistered vars stay fully standard, so custom and standard vars mix
freely on the same page. This example registers one plugin to model yours on:

- **`ownerMappingPlugin`** (on `Owner Mapping`) parses the var's JSONFORM schema into a
  mapping table and `validate`s that every FakeCRM contact is mapped — stricter than the
  default non-empty gate.

For richer per-var UX the engine also exposes `wizard.saveVars` (persist values mid-page),
`wizard.invokeDataSource` (re-run a datasource with extra inputs), and
`wizard.resetDownstream` (clear later pages when an upstream selection changes).

### Already have a marketplace?

The wizard slice is self-contained — it imports nothing from the marketplace components. The
contract is one prop plus an authenticated embedded session:

```tsx
<ConfigWizard instanceId={instanceId} />
```

Take `lib/prismatic/*`, the hooks, `components/wizard/*`, and `components/example/*` as your
template; leave the marketplace components behind. Three touchpoints to wire:

1. **Route in** — mount the wizard wherever your "configure" action lands, passing the
   instance ID. If your marketplace doesn't create instances yet, reuse
   `createInstanceForIntegration` from `lib/prismatic/instance.ts`.
2. **Route out** — the success screen and Discard link point at this repo's `/integrations`;
   swap for your routes.
3. **Post-deploy refresh** — a custom wizard fires no `INSTANCE_DEPLOYED` window message, so
   a marketplace listening for SDK events won't auto-refresh. Replace the two
   `invalidateQueries` calls in `useConfigWizard`'s submit success (commented for exactly
   this) with whatever refreshes your marketplace state.

## How it works

### Authentication

A server route (`app/api/integration-token/route.ts`) signs an RS256 JWT with your org's
signing key — the key never leaves the server — and the browser authenticates the embedded
SDK with it (`hooks/usePrismaticAuth.ts`), re-authenticating shortly before expiry. Full
details: [Authenticate Embedded Users](https://prismatic.io/docs/embed/authenticate-users).

### Wizard operations

The wizard runs the **same operations Prismatic's built-in wizard uses**:

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

OAuth connection variables are polled (`useConnectionStatus`) until they flip to `ACTIVE`
after the user authorizes in a separate tab.

### Marketplace, instances, and server state

Each card lists the customer's instances; **Link Account** opens a name dialog when the
integration allows multiple instances (`allowMultipleMarketplaceInstances`), or one-click
creates the single instance. The **View all** page configures, pauses/resumes, updates, or
deletes each instance. One gotcha worth knowing: instances are matched to their marketplace
card by `versionSequenceId` — the identity stable across versions — not `integration.id`.

Server state runs through [React Query](https://tanstack.com/query): reads are `useQuery`
keyed in `lib/prismatic/queryKeys.ts`, writes are `useMutation` driving the `busy` /
`actionError` flags, and retry/backoff for the rate-limited API lives once in the
`QueryClient` defaults (`app/providers.tsx`).

## Setup from scratch

To point the app at your own Prismatic org:

1. **Get a signing key.** From the [Prism CLI](https://prismatic.io/docs/cli/):

   ```bash
   prism organization:signing-keys:generate
   ```

   The private key is shown only once — copy it.

2. **Find your org ID.** Prismatic web app → **Org Settings → Embedded** tab.

3. **Configure `.env.local`** (gitignored):

   ```bash
   PRISMATIC_ORG_ID=<your org id>
   PRISMATIC_SIGNING_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

   The demo customer/user vars have working defaults (see `.env.example`).

4. **Publish the integration** (see [Quick start](#quick-start)) and mark it available in
   the marketplace.

5. **Run it** — `npm run dev`, open http://localhost:3000. The home page shows live SDK auth
   status.

## Project layout

### App shell & SDK wiring

| Path | Purpose |
|------|---------|
| `app/api/integration-token/route.ts` | Server-only RS256 JWT signing |
| `app/providers.tsx` | React Query `QueryClientProvider` (caching/retry defaults), mounted in `app/layout.tsx` |
| `app/page.tsx` | Landing page + live auth status |
| `app/integrations/page.tsx` | Marketplace route |
| `app/integrations/[integrationId]/page.tsx` | Per-integration instance list ("View all") route |
| `app/integrations/configure/[instanceId]/page.tsx` | Config wizard route |
| `hooks/usePrismaticAuth.ts` | SDK init + token `useQuery`, re-auth-before-expiry |
| `components/AuthStatus.tsx` | Live auth-state indicator |

### Marketplace

| Path | Purpose |
|------|---------|
| `lib/marketplace.ts` | Marketplace GraphQL query, types, avatar helper, and the instance grouping / status / naming helpers |
| `lib/format.ts` | Short-date formatter for instance rows |
| `components/CustomMarketplace.tsx` | Fetches integrations + the customer's instances, groups them per card, renders the grid |
| `components/IntegrationCard.tsx` | A single card: instance rows with status, Link Account, View all |
| `components/NewInstanceDialog.tsx` | Name prompt for a new instance; creates it and routes to the wizard |
| `components/IntegrationDetail.tsx` | The "View all" page: every instance with configure / pause / update / delete |
| `components/InstanceStatusIcon.tsx` | Per-instance status glyph (active / paused / unconfigured) |

### Config wizard — generic kit (reusable)

| Path | Purpose |
|------|---------|
| `lib/prismatic/*` | Generic Prismatic API: `client`, `queries`, `queryKeys`, `types`, `instance`, `pages`, `connections`, `jsonform` (+ `index` barrel) |
| `hooks/useConfigWizard.ts` | The wizard engine — owns all Prismatic state |
| `hooks/useConnectionStatus.ts` | Polls OAuth connection status until `ACTIVE` |
| `hooks/useJsonDraft.ts` | JSON-string draft editing primitive |
| `components/wizard/chrome/*` | Presentational frame: `Shell`, `Loading`, `ErrorBox` |
| `components/wizard/fields/*` | Generic field renderers: `ConfigVarInput`, `FieldControl`, `JsonFormRenderer`, `MultiSelect`, `ComboBox`, `UiTable` |

### Config wizard — the FakeCRM example (replaceable)

| Path | Purpose |
|------|---------|
| `lib/example/ownerMapping.ts` | Parses the `Owner Mapping` JSONFORM schema into a mapping model + completeness check |
| `components/example/ConfigWizard.tsx` | Plugin registry + the assembled wizard UI |
| `components/example/ownerMappingPlugin.tsx` | Owner-mapping plugin: table render + all-mapped gate |
| `components/example/OwnerMappingStep.tsx` | The mapping table UI |
