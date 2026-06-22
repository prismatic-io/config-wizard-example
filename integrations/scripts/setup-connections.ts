/**
 * setup-connections.ts
 *
 * Provisions org-managed customer-scoped config variables for each Acme
 * component, then creates one customer config var per customer in the org.
 * Idempotent — re-runs only do new work.
 *
 * Usage:
 *   npm run setup:connections
 *   npm run setup:connections -- --dry-run
 *   npm run setup:connections -- --api-key sk_test_123              # one shared key for every customer
 *   npm run setup:connections -- --keys-file customer-keys.json     # per-customer keys (see below)
 *   npm run setup:connections -- --component deployments
 *   npm run setup:connections -- --customer Q3VzdG9tZXI6...
 *
 * --keys-file expects JSON like:
 *   { "acme-corp": "acme_live_xxx", "techstart-inc": "acme_live_yyy" }
 * Keys can be customer externalId or Prismatic customer node ID. Customers not
 * in the map fall back to --api-key (or the placeholder default).
 *
 * Auth: shells out to `prism me:token` for the bearer token.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PLACEHOLDER_API_KEY = "PLACEHOLDER_REPLACE_ME";

interface ComponentEntry {
  key: string;
  configVarLabel: string;
  stableKey: string;
}

// Acme ships a single component, so there's one connection to provision (one org-managed,
// customer-scoped connection shared by every flow in the integration).
const COMPONENTS: ComponentEntry[] = [
  { key: "acme", configVarLabel: "Acme Connection", stableKey: "acme-api-key" },
];

const CONNECTION_KEY = "acmeApiKey";

interface CliArgs {
  dryRun: boolean;
  apiKey: string;
  customer: string | null;
  component: string | null;
  keysFile: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, apiKey: PLACEHOLDER_API_KEY, customer: null, component: null, keysFile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--api-key") args.apiKey = argv[++i] ?? "";
    else if (a === "--customer") args.customer = argv[++i] ?? null;
    else if (a === "--component") args.component = argv[++i] ?? null;
    else if (a === "--keys-file") args.keysFile = argv[++i] ?? null;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: setup-connections.ts [--dry-run] [--api-key <value>] [--keys-file <path>] [--customer <id>] [--component <key>]");
      process.exit(0);
    }
  }
  return args;
}

function loadKeysFile(path: string): Record<string, string> {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`--keys-file must contain a JSON object mapping customer key/id to api_key string`);
  }
  return parsed as Record<string, string>;
}

function resolveApiKey(customer: Customer, args: CliArgs, perCustomerKeys: Record<string, string> | null): string {
  if (perCustomerKeys) {
    if (customer.externalId && perCustomerKeys[customer.externalId]) return perCustomerKeys[customer.externalId];
    if (perCustomerKeys[customer.id]) return perCustomerKeys[customer.id];
  }
  return args.apiKey;
}

function getPrismToken(): string {
  const out = execFileSync("prism", ["me:token"], { encoding: "utf8" });
  const token = out.trim();
  if (!token) throw new Error("prism me:token returned empty");
  return token;
}

function getPrismEndpoint(): string {
  const out = execFileSync("prism", ["me"], { encoding: "utf8" });
  const match = out.match(/Endpoint URL:\s*(\S+)/);
  if (!match) throw new Error("Could not parse endpoint from `prism me`");
  return `${match[1].replace(/\/$/, "")}/api`;
}

interface GqlResult<T> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
}

async function gql<T>(endpoint: string, token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as GqlResult<T>;
  if (body.errors && body.errors.length) {
    throw new Error(`GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  if (!body.data) throw new Error("GraphQL returned no data");
  return body.data;
}

// ---------- Queries / mutations ----------

const Q_COMPONENT_CONNECTIONS = /* GraphQL */ `
  query ComponentConnections($key: String!) {
    components(key: $key) {
      nodes {
        id
        key
        connections { nodes { id key } }
      }
    }
  }
`;

const Q_CUSTOMERS = /* GraphQL */ `
  query Customers($first: Int!, $after: String) {
    customers(first: $first, after: $after) {
      nodes { id name externalId }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const Q_EXISTING_SCV = /* GraphQL */ `
  query ExistingScopedConfigVar($stableKey: String!) {
    scopedConfigVariables(stableKey: $stableKey) {
      nodes { id stableKey defaultForComponent }
    }
  }
`;

const Q_EXISTING_CCV = /* GraphQL */ `
  query ExistingCustomerConfigVar($scopedConfigVariable: ID!, $customer: ID!) {
    customerConfigVariables(scopedConfigVariable: $scopedConfigVariable, customer: $customer) {
      nodes { id }
    }
  }
`;

const M_UPDATE_SCV = /* GraphQL */ `
  mutation UpdateScopedConfigVariable(
    $id: ID!
    $key: String
    $description: String
    $defaultForComponent: Boolean
    $inputs: [InputExpression]
  ) {
    updateScopedConfigVariable(
      input: {
        id: $id
        key: $key
        description: $description
        defaultForComponent: $defaultForComponent
        inputs: $inputs
      }
    ) {
      scopedConfigVariable { id defaultForComponent }
      errors { field messages }
    }
  }
`;

const M_CREATE_SCV = /* GraphQL */ `
  mutation CreateScopedConfigVariable(
    $key: String!
    $description: String!
    $stableKey: String!
    $variableScope: String!
    $managedBy: String!
    $connection: ID
    $inputs: [InputExpression]
  ) {
    createScopedConfigVariable(
      input: {
        key: $key
        description: $description
        stableKey: $stableKey
        variableScope: $variableScope
        managedBy: $managedBy
        connection: $connection
        inputs: $inputs
      }
    ) {
      scopedConfigVariable { id stableKey }
      errors { field messages }
    }
  }
`;

const M_CREATE_CCV = /* GraphQL */ `
  mutation CreateCustomerConfigVariable(
    $scopedConfigVariable: ID!
    $customer: ID
    $isTest: Boolean
    $inputs: [InputExpression]
  ) {
    createCustomerConfigVariable(
      input: {
        scopedConfigVariable: $scopedConfigVariable
        customer: $customer
        isTest: $isTest
        inputs: $inputs
      }
    ) {
      customerConfigVariable { id }
      errors { field messages }
    }
  }
`;

interface Customer {
  id: string;
  name: string;
  externalId: string | null;
}

async function fetchCustomers(endpoint: string, token: string): Promise<Customer[]> {
  const customers: Customer[] = [];
  let after: string | null = null;
  while (true) {
    const data: { customers: { nodes: Customer[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } =
      await gql(endpoint, token, Q_CUSTOMERS, { first: 100, after });
    customers.push(...data.customers.nodes);
    if (!data.customers.pageInfo.hasNextPage) break;
    after = data.customers.pageInfo.endCursor;
  }
  return customers;
}

async function findConnectionId(endpoint: string, token: string, componentKey: string): Promise<string> {
  const data: { components: { nodes: Array<{ id: string; key: string; connections: { nodes: Array<{ id: string; key: string }> } }> } } =
    await gql(endpoint, token, Q_COMPONENT_CONNECTIONS, { key: componentKey });
  const candidates = data.components.nodes.filter((c) => c.key === componentKey);
  if (!candidates.length) throw new Error(`Component not found on platform: ${componentKey}`);
  // Prefer a private (non-public) component when multiple match
  const component = candidates[candidates.length - 1];
  const connection = component.connections.nodes.find((c) => c.key === CONNECTION_KEY);
  if (!connection) {
    throw new Error(`Connection "${CONNECTION_KEY}" not found on component ${componentKey}. Available: ${component.connections.nodes.map((c) => c.key).join(", ")}`);
  }
  return connection.id;
}

interface ExistingScv {
  id: string;
  defaultForComponent: boolean;
}

async function findExistingScv(endpoint: string, token: string, stableKey: string): Promise<ExistingScv | null> {
  const data: { scopedConfigVariables: { nodes: Array<{ id: string; stableKey: string; defaultForComponent: boolean }> } } =
    await gql(endpoint, token, Q_EXISTING_SCV, { stableKey });
  const match = data.scopedConfigVariables.nodes.find((n) => n.stableKey === stableKey);
  return match ? { id: match.id, defaultForComponent: match.defaultForComponent } : null;
}

async function findExistingCcv(endpoint: string, token: string, scv: string, customer: string): Promise<string | null> {
  const data: { customerConfigVariables: { nodes: Array<{ id: string }> } } =
    await gql(endpoint, token, Q_EXISTING_CCV, { scopedConfigVariable: scv, customer });
  return data.customerConfigVariables.nodes[0]?.id ?? null;
}

async function setDefaultForComponent(endpoint: string, token: string, scvId: string, entry: ComponentEntry): Promise<void> {
  const variables = {
    id: scvId,
    key: entry.configVarLabel,
    description: "",
    defaultForComponent: true,
    inputs: [
      {
        name: "api_key",
        type: "value",
        value: "",
        meta: JSON.stringify({ managedBy: "ORG", inputScope: "CUSTOMER" }),
      },
    ],
  };
  const data: { updateScopedConfigVariable: { scopedConfigVariable: { id: string; defaultForComponent: boolean } | null; errors: Array<{ field: string; messages: string[] }> } } =
    await gql(endpoint, token, M_UPDATE_SCV, variables);
  const { scopedConfigVariable, errors } = data.updateScopedConfigVariable;
  if (errors && errors.length) {
    throw new Error(`updateScopedConfigVariable errors for ${entry.key}: ${JSON.stringify(errors)}`);
  }
  if (!scopedConfigVariable) throw new Error(`updateScopedConfigVariable returned null for ${entry.key}`);
}

async function createScv(endpoint: string, token: string, entry: ComponentEntry, connectionId: string): Promise<string> {
  const variables = {
    key: entry.configVarLabel,
    description: "",
    stableKey: entry.stableKey,
    variableScope: "customer",
    managedBy: "org",
    connection: connectionId,
    inputs: [
      {
        name: "api_key",
        type: "value",
        value: "",
        meta: JSON.stringify({ managedBy: "org", inputScope: "customer" }),
      },
    ],
  };
  const data: { createScopedConfigVariable: { scopedConfigVariable: { id: string } | null; errors: Array<{ field: string; messages: string[] }> } } =
    await gql(endpoint, token, M_CREATE_SCV, variables);
  const { scopedConfigVariable, errors } = data.createScopedConfigVariable;
  if (errors && errors.length) {
    throw new Error(`createScopedConfigVariable errors for ${entry.key}: ${JSON.stringify(errors)}`);
  }
  if (!scopedConfigVariable) throw new Error(`createScopedConfigVariable returned null for ${entry.key}`);
  return scopedConfigVariable.id;
}

async function createCcv(endpoint: string, token: string, scv: string, customer: string, apiKey: string): Promise<string> {
  const variables = {
    scopedConfigVariable: scv,
    customer,
    isTest: false,
    inputs: [{ name: "api_key", type: "value", value: apiKey }],
  };
  const data: { createCustomerConfigVariable: { customerConfigVariable: { id: string } | null; errors: Array<{ field: string; messages: string[] }> } } =
    await gql(endpoint, token, M_CREATE_CCV, variables);
  const { customerConfigVariable, errors } = data.createCustomerConfigVariable;
  if (errors && errors.length) {
    throw new Error(`createCustomerConfigVariable errors: ${JSON.stringify(errors)}`);
  }
  if (!customerConfigVariable) throw new Error("createCustomerConfigVariable returned null");
  return customerConfigVariable.id;
}

// ---------- Main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = getPrismToken();
  const endpoint = getPrismEndpoint();

  const components = args.component
    ? COMPONENTS.filter((c) => c.key === args.component)
    : COMPONENTS;
  if (!components.length) {
    console.error(`Unknown --component "${args.component}". Valid keys: ${COMPONENTS.map((c) => c.key).join(", ")}`);
    process.exit(1);
  }

  const perCustomerKeys = args.keysFile ? loadKeysFile(args.keysFile) : null;

  console.log(`Endpoint: ${endpoint}`);
  console.log(`Components: ${components.map((c) => c.key).join(", ")}`);
  console.log(`Dry run: ${args.dryRun ? "yes" : "no"}`);
  console.log(`api_key default: ${args.apiKey === PLACEHOLDER_API_KEY ? `"${PLACEHOLDER_API_KEY}" (placeholder)` : "(custom)"}`);
  if (perCustomerKeys) console.log(`Per-customer keys: ${Object.keys(perCustomerKeys).length} entries from ${args.keysFile}`);

  const allCustomers = await fetchCustomers(endpoint, token);
  const customers = args.customer ? allCustomers.filter((c) => c.id === args.customer) : allCustomers;
  console.log(`Customers in scope: ${customers.length}\n`);

  let scvCreated = 0;
  let ccvCreated = 0;
  let skipped = 0;

  for (const entry of components) {
    console.log(`=== ${entry.key} ===`);
    const connectionId = await findConnectionId(endpoint, token, entry.key);

    const existing = await findExistingScv(endpoint, token, entry.stableKey);
    let scvId: string;
    if (existing) {
      scvId = existing.id;
      console.log(`  SCV exists (${entry.stableKey}) — reusing ${scvId} (defaultForComponent=${existing.defaultForComponent})`);
      if (!existing.defaultForComponent) {
        if (args.dryRun) {
          console.log(`  [dry-run] would set defaultForComponent=true on ${scvId}`);
        } else {
          await setDefaultForComponent(endpoint, token, scvId, entry);
          console.log(`  SCV updated → defaultForComponent=true`);
        }
      }
    } else if (args.dryRun) {
      console.log(`  [dry-run] would create SCV ${entry.stableKey} → connection ${connectionId} (defaultForComponent=true)`);
      scvId = "<dry-run-scv-id>";
    } else {
      scvId = await createScv(endpoint, token, entry, connectionId);
      console.log(`  SCV created ${scvId}`);
      scvCreated++;
      await setDefaultForComponent(endpoint, token, scvId, entry);
      console.log(`  SCV updated → defaultForComponent=true`);
    }

    for (const customer of customers) {
      const label = `${customer.name}${customer.externalId ? ` (${customer.externalId})` : ""}`;
      if (args.dryRun && scvId === "<dry-run-scv-id>") {
        console.log(`  [${entry.key}] ${label} → would create CCV (SCV not yet created)`);
        continue;
      }
      const existing = await findExistingCcv(endpoint, token, scvId, customer.id);
      if (existing) {
        console.log(`  [${entry.key}] ${label} → already exists, skipping`);
        skipped++;
        continue;
      }
      const apiKeyValue = resolveApiKey(customer, args, perCustomerKeys);
      if (args.dryRun) {
        console.log(`  [${entry.key}] ${label} → would create CCV (api_key=${apiKeyValue === PLACEHOLDER_API_KEY ? "placeholder" : "<set>"})`);
        continue;
      }
      const ccvId = await createCcv(endpoint, token, scvId, customer.id, apiKeyValue);
      console.log(`  [${entry.key}] ${label} → created (CCV ${ccvId})`);
      ccvCreated++;
    }
    console.log();
  }

  console.log(`Summary: created ${scvCreated} scoped config var(s), ${ccvCreated} customer connection(s), skipped ${skipped} existing.`);
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
