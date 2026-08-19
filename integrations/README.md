# Acme × Prismatic — FakeCRM Integration

The Prismatic side of the Acme demo: a single **code-native integration**,
`owner-to-fakecrm-sync`, that keeps record owners in sync between Acme and **FakeCRM**.
The embedded marketplace + config wizard that deploys it lives one directory up (see the
root [`README.md`](../README.md)).

## Repository layout

```
.
└── integrations/
    └── owner-to-fakecrm-sync/   # The FakeCRM CNI — flows, config pages, mock data
```

npm workspaces; install once from this directory.

## The integration

`owner-to-fakecrm-sync` (integration name **FakeCRM**) has:

- **Flows** (`src/flows.ts`) — on instance deploy it registers an Acme webhook and
  full-syncs the mapped owners; the webhook-triggered flow syncs
  owner changes to FakeCRM (writing `crm_id` / `sync_status` back); on instance delete it
  removes the webhook.
- **Config pages** (`src/configPages.ts`) — the wizard pages the embedded app renders:
  **Connect FakeCRM** (customer's FakeCRM API key), **Mapping Owner** (a JSONFORM mapping
  every FakeCRM contact to an Acme owner), and the deal linking/confirmation pages.
- **Mock data on both sides** — `src/mockData.ts` (FakeCRM contacts, deals)
  and `src/acmeClient.ts` (a mock Acme client: static owners, log-only writes, fake
  webhook registration). No external services, no credentials, no org-level connection to
  provision — the integration runs anywhere as-is.

## Commands

```bash
npm install       # once, from this directory
npm run build     # webpack-build owner-to-fakecrm-sync
npm run import    # build + `prism integrations:import` (requires `prism login`)
```

After importing, publish the integration and mark it **available in the marketplace** so the
embedded app's `/integrations` page shows its card.
