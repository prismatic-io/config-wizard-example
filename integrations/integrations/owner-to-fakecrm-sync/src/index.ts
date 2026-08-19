/**
 * FakeCRM Integration (mock)
 *
 * Syncs Acme owners to their matching FakeCRM contacts. The config wizard
 * mirrors a real CRM experience — connect, map owners, link deals — while
 * both APIs are mocked with static demo data (mockData.ts for FakeCRM,
 * acmeClient.ts for Acme), so no external services or credentials are
 * needed to run it.
 */

import { integration } from "@prismatic-io/spectral";
import documentation from "../documentation.md";
import { configPages } from "./configPages";
import flows from "./flows";

export { configPages };

export default integration({
  name: "FakeCRM",
  description: "Sync Acme owners to their matching FakeCRM contacts",
  category: "CRM",
  iconPath: "icon.png",
  documentation,
  flows,
  configPages,
  // componentRegistry / scopedConfigVars intentionally omitted — no external
  // manifests, and the mock Acme client needs no org-managed connection.
});
