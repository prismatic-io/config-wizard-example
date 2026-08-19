# FakeCRM

Sync your Acme owners to their matching contacts in FakeCRM so ownership,
teams, and deal data stay aligned between both systems.

## Configuration

1. **Connect FakeCRM** — enter the API key from Settings > API Keys in
   FakeCRM (a Workspace ID is optional).
2. **Mapping Owner** — match each FakeCRM contact to its Acme owner. Rows
   are pre-matched by name where possible; adjust any dropdown or remove a
   row to skip syncing that contact.
3. **Link Deals** — choose the deals to sync into your Acme workspace.

## Sync behavior

- **On activation** every mapped owner is synced immediately.
- **On change** — whenever an owner is created or updated in Acme, the
  mapped owner is re-synced automatically.

## Field mapping

| Acme owner field | FakeCRM |
| --- | --- |
| `crm_id` | Contact ID of the mapped FakeCRM contact |
| `sync_status` | Set to **Synced** after a successful push |
