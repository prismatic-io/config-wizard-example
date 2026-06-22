// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. This module is the shared type vocabulary for the wizard: the shapes
// returned by the GraphQL queries and the shapes submitted back. Only the fields the
// wizard actually renders/submits are modeled.
// ─────────────────────────────────────────────────────────────────────────────

/** A Relay-style connection wrapper — every list in the Prismatic schema is `{ nodes: T[] }`. */
export interface Node<T> {
  nodes: T[];
}

/**
 * A config variable's data type. The schema returns an open-ended string; this union
 * documents the values the wizard branches on while still accepting any other string
 * Prismatic may send (`string & {}` keeps it assignable from/to plain `string`).
 */
export type DataType =
  | "CONNECTION"
  | "PICKLIST"
  | "JSONFORM"
  | "STRING"
  | "BOOLEAN"
  | "CODE"
  | "SCHEDULE"
  | (string & {});

export interface InputField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean | null;
  shown: boolean | null;
  comments: string | null;
  default: string | null;
  placeholder: string | null;
}

export interface WizardComponent {
  id: string;
  key: string;
  label?: string | null;
  versionNumber: number;
  public: boolean;
  iconUrl: string | null;
}

export interface WizardConnection {
  id: string;
  key: string;
  label: string;
  comments: string | null;
  oauth2Type: string | null;
  component: WizardComponent | null;
  inputs: Node<InputField>;
}

export interface WizardDataSource {
  id: string;
  label: string;
  description: string | null;
  key: string;
  dataSourceType: string | null;
  examplePayload: string | null;
  component: WizardComponent | null;
}

export interface RequiredConfigVariable {
  id: string;
  key: string;
  stableId: string;
  description: string | null;
  dataType: DataType;
  defaultValue: string | null;
  meta: string | null;
  connection: WizardConnection | null;
  dataSource: WizardDataSource | null;
}

export interface InstanceConfigVariable {
  id: string;
  value: string | null;
  status: string | null;
  authorizeUrl: string | null;
  scheduleType: string | null;
  timeZone: string | null;
  requiredConfigVariable: RequiredConfigVariable;
}

export interface WizardFlowConfig {
  id: string;
  webhookUrl: string | null;
  usesLre: boolean;
  flow: {
    id: string;
    name: string;
    stableId: string;
    description: string | null;
    endpointSecurityType: string | null;
  };
}

export interface WizardIntegration {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  overview: string | null;
  configPages: string | null;
  avatarUrl: string | null;
  versionNumber: number;
}

export interface WizardInstance {
  id: string;
  name: string;
  description: string | null;
  labels: string[];
  customer: { id: string; name: string };
  flowConfigs: Node<WizardFlowConfig>;
  integration: WizardIntegration;
  configVariables: Node<InstanceConfigVariable> | null;
}

export interface WizardAuthenticatedUser {
  appName: string | null;
  id: string;
  name: string | null;
  email: string | null;
  role: { id: string; name: string } | null;
}

export interface ConfigWizardData {
  instance: WizardInstance;
  authenticatedUser: WizardAuthenticatedUser;
}

// --- Config pages -------------------------------------------------------------

export interface ConfigPageElement {
  type: "configVar" | "htmlElement" | string;
  value: string;
}

export interface ConfigPage {
  name: string;
  tagline?: string;
  elements: ConfigPageElement[];
}

// --- Page content (what fetchConfigWizardPageContent returns) ----------------

export interface ExpressionInput {
  id: string;
  name: string;
  value: string | null;
  type: string;
}

/** A config variable as returned by fetchConfigWizardPageContent (lean shape). */
export interface PageConfigVariable {
  id: string;
  value: string | null;
  status: string | null;
  authorizeUrl: string | null;
  requiredConfigVariable: { id: string; key: string; dataType: DataType };
  inputs: Node<ExpressionInput>;
}

export interface PicklistOption {
  key: string;
  label: string;
}

export interface PageContent {
  /** Parsed `content` JSON, keyed by config-var key (picklist options or jsonform schema). */
  content: Record<string, unknown>;
  configVariables: PageConfigVariable[];
}

/** Shape submitted to updateInstanceConfigVariables. */
export interface InputConfigVariable {
  key: string;
  value?: string;
  values?: string;
  customerConfigVariableId: null;
  onPremiseResourceId: null;
}
