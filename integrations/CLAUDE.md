# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

The Prismatic workspace for the Acme demo: one code-native integration
(`integrations/owner-to-fakecrm-sync`, integration name **FakeCRM**). Both sides of the sync are
mocked — `src/mockData.ts` for FakeCRM, `src/acmeClient.ts` for Acme — so it runs with no
external services, credentials, or org-level connections. See `README.md` for the
integration's shape.

## Commands (from this directory)

```bash
npm install
npm run build     # webpack-build owner-to-fakecrm-sync
npm run import    # build + `prism integrations:import` (requires `prism login`)
```

Lint a workspace with `npm run lint --workspace=owner-to-fakecrm-sync`.

## Architecture notes

- The integration exports `integration()` from `src/index.ts` with `flows` and `configPages`.
  There is no `componentRegistry` (no external component manifests) and no `scopedConfigVars`
  (the mock Acme client needs no org-managed connection).
- `src/acmeClient.ts` mirrors the surface a real host-app client would have
  (`resources("owner")` list/update + webhook register/delete) over static data — swap its
  internals for real HTTP calls to de-mock the Acme side.
- The config pages are rendered by the custom embedded wizard one directory up — config-var
  keys (`Account`, `Account Search`, `Owner Mapping`) are referenced by name in
  `../lib/example/` and `../components/example/`. Renaming one means updating both sides.

## Prism MCP Server

When the Prism MCP server is available, use it for scaffolding and code generation instead of
hand-writing boilerplate: `prism_integrations_generate_flow` (new flows),
`prism_integrations_generate_config_page` / `prism_integrations_generate_config_var` /
`prism_integrations_add_connection_config_var` (config wizard changes),
`prism_integrations_flows_test` (test a flow), `prism_integrations_import` (deploy).
See https://github.com/prismatic-io/prism-mcp for setup.
