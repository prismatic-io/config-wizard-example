// ─────────────────────────────────────────────────────────────────────────────
// Generic Prismatic plumbing — no brand, no React. Safe to copy verbatim into any
// integration. The named GraphQL documents the wizard issues. These are kept
// VERBATIM from Prismatic's own embedded config wizard so our custom wizard renders
// from (and writes back) the exact same shapes as the built-in UI. Do not edit the
// query bodies — only add new ones.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The exact query Prismatic's own embedded config wizard issues to hydrate itself.
 * Kept verbatim so our custom wizard renders from the same shape as the built-in UI.
 */
export const GET_CONFIGURATION_WIZARD_INSTANCE = /* GraphQL */ `
  query getConfigurationWizardInstance($instanceId: ID!, $shouldGetAllAvailableVersions: Boolean!, $shouldGetEmbeddedVersions: Boolean!, $isUserLevelConfiguration: Boolean!, $hasInitialPage: Boolean!) {
    instance(id: $instanceId) {
      id
      name
      description
      labels
      customer {
        id
        name
      }
      isCustomerUpgradeable
      logsDisabled
      stepResultsDisabled
      flowConfigs {
        nodes {
          id
          ...ConfigurationWizardInstanceFlowConfigFragment
        }
      }
      userLevelConfigs {
        nodes {
          id
          user {
            id
          }
        }
      }
      integration {
        id
        ...ConfigurationWizardIntegrationFragment
        versionSequence(
          versionIsAvailable: true
          orderBy: {direction: DESC, field: VERSION_NUMBER}
        ) @include(if: $shouldGetAllAvailableVersions) {
          nodes {
            id
            versionNumber
          }
        }
        embeddedVersionSequence: versionSequence(
          versionIsAvailable: true
          marketplaceConfiguration_Istartswith: "AVAILABLE"
          orderBy: {direction: DESC, field: VERSION_NUMBER}
        ) @include(if: $shouldGetEmbeddedVersions) {
          nodes {
            id
            ...ConfigurationWizardIntegrationFragment
          }
        }
      }
      configVariables @skip(if: $isUserLevelConfiguration) {
        nodes {
          id
          ...ConfigurationWizardInstanceConfigVariableFragment
        }
      }
      userLevelConfigVariables @include(if: $isUserLevelConfiguration) {
        nodes {
          id
          ...ConfigurationWizardUserLevelConfigVariableFragment
        }
      }
    }
    authenticatedUser {
      appName
      id
      name
      email
      org {
        id
        allowDisablingInstanceOutputs
        allowOnPremAgent
      }
      customer {
        id
        org {
          allowOnPremAgent
        }
      }
      role {
        id
        name
      }
    }
    instanceLabels @include(if: $hasInitialPage) {
      id
      name
    }
  }

  fragment ConfigurationWizardInstanceFlowConfigFragment on InstanceFlowConfig {
    id
    apiKeys
    testPayload
    testContentType
    testHeaders
    webhookUrl
    usesLre
    flow {
      id
      name
      stableId
      description
      endpointSecurityType
      trigger {
        id
        name
        description
        inputs {
          nodes {
            id
            name
            type
            value
            meta
          }
        }
      }
    }
  }

  fragment ConfigurationWizardUserLevelConfigVariableFragment on UserLevelConfigVariable {
    id
    requiredConfigVariable {
      id
      scopedConfigVariable {
        id
        ...ScopedConfigVariableFragment
      }
      ...ConfigurationWizardRequiredConfigVariableFragment
    }
    value
    scheduleType
    timeZone
    status
    authorizeUrl
    onPremiseResource {
      id
    }
    inputs {
      nodes {
        id
        name
        value
        hasValue
        type
        meta
        hasValue
      }
    }
  }

  fragment ScopedConfigVariableFragment on ScopedConfigVariable {
    id
    key
    stableKey
    description
    variableScope
    managedBy
    inputs {
      nodes {
        name
        id
        type
        value
        hasValue
        meta
      }
    }
    connection {
      id
      key
      label
      default
      order
      oauth2Type
      iconUrl(withCache: true)
      avatarIconUrl
      comments
      component {
        id
        key
        public
        versionNumber
        label
        category
        documentationUrl
        description
        iconUrl(withCache: true)
      }
      inputs {
        nodes {
          id
          ...ConfigurationWizardInputFieldFragment
        }
      }
    }
  }

  fragment ConfigurationWizardInputFieldFragment on InputField {
    id
    key
    keyPath
    label
    keyLabel
    type
    collection
    placeholder
    default
    comments
    example
    required
    shown
    model
    language
    onPremiseControlled
  }

  fragment ConfigurationWizardRequiredConfigVariableFragment on RequiredConfigVariable {
    id
    meta
    key
    stableId
    defaultValue
    description
    dataType
    pickList
    scheduleType
    timeZone
    collectionType
    onPremiseConnectionConfig
    codeLanguage
    header
    hasDivider
    orgOnly
    inputs {
      nodes {
        id
        name
        type
        value
        hasValue
        meta
      }
    }
    connection {
      id
      ...ConfigurationWizardConnectionFragment
    }
    dataSource {
      id
      ...ConfigurationWizardActionFragment
      detailDataSource {
        id
        ...ConfigurationWizardActionFragment
      }
    }
    userLevelConfigured
    scopedConfigVariable {
      id
      key
      stableKey
    }
  }

  fragment ConfigurationWizardActionFragment on Action {
    id
    label
    description
    key
    allowsBranching
    synchronousResponseSupport
    scheduleSupport
    isTrigger
    isDataSource
    dataSourceType
    isCommonTrigger
    isPollingTrigger
    hasOnInstanceDelete
    hasOnInstanceDeploy
    hasWebhookCreateFunction
    hasWebhookDeleteFunction
    component {
      id
      key
      versionNumber
      public
      iconUrl(withCache: true)
    }
    inputs {
      nodes {
        id
        ...ConfigurationWizardInputFieldFragment
      }
    }
    dynamicBranchInput
    staticBranchNames
    examplePayload
  }

  fragment ConfigurationWizardConnectionFragment on Connection {
    id
    key
    order
    label
    comments
    default
    oauth2Type
    onPremiseAvailable
    iconUrl(withCache: true)
    avatarIconUrl
    component {
      id
      key
      label
      versionNumber
      public
      iconUrl(withCache: true)
    }
    inputs(shown: true) {
      nodes {
        id
        key
        keyPath
        label
        keyLabel
        type
        collection
        placeholder
        default
        comments
        example
        required
        shown
        model
        language
        onPremiseControlled
      }
    }
  }

  fragment ConfigurationWizardInstanceConfigVariableFragment on InstanceConfigVariable {
    id
    requiredConfigVariable {
      id
      scopedConfigVariable {
        id
        ...ScopedConfigVariableFragment
      }
      ...ConfigurationWizardRequiredConfigVariableFragment
    }
    value
    scheduleType
    timeZone
    status
    authorizeUrl
    onPremiseResource {
      id
    }
    customerConfigVariable {
      id
      key
    }
    inputs {
      nodes {
        id
        name
        value
        hasValue
        type
        meta
        hasValue
      }
    }
  }

  fragment ConfigurationWizardIntegrationFragment on Integration {
    id
    name
    category
    description
    overview
    configPages
    labels
    avatarUrl
    versionNumber
    endpointType
    allowMultipleMarketplaceInstances
    isCustomerDeployable
    flows {
      nodes {
        id
        name
        description
        stableId
        endpointSecurityType
        testPayload
        testContentType
        testHeaders
        testUrl
        trigger {
          id
          name
          description
          inputs {
            nodes {
              id
              name
              type
              value
            }
          }
        }
      }
    }
    requiredConfigVariables {
      nodes {
        id
        scopedConfigVariable {
          id
          ...ScopedConfigVariableFragment
        }
        ...ConfigurationWizardRequiredConfigVariableFragment
      }
    }
  }
`;

export const CREATE_INSTANCE = /* GraphQL */ `
  mutation createInstance($integration: ID!, $customer: ID!, $name: String!) {
    createInstance(
      input: { integration: $integration, customer: $customer, name: $name }
    ) {
      instance {
        id
      }
      errors {
        field
        messages
      }
    }
  }
`;

// NOTE: despite reading data, fetchConfigWizardPageContent is a RootMutation field
// in Prismatic's schema — it must be issued as a mutation, not a query.
export const FETCH_PAGE_CONTENT = /* GraphQL */ `
  mutation fetchConfigWizardPageContent($instanceId: ID!, $pageName: String) {
    fetchConfigWizardPageContent(input: { id: $instanceId, pageName: $pageName }) {
      fetchConfigWizardPageContentResult {
        content
        instance {
          configVariables {
            nodes {
              id
              value
              status
              authorizeUrl
              requiredConfigVariable {
                id
                key
                dataType
              }
              inputs {
                nodes {
                  id
                  name
                  value
                  type
                }
              }
            }
          }
        }
      }
      errors {
        field
        messages
      }
    }
  }
`;

export const SUBMIT_CONFIG_PAGE = /* GraphQL */ `
  mutation submitConfigPage($instanceId: ID!, $configVariables: [InputInstanceConfigVariable], $configMode: String, $configComplete: Boolean) {
    updateInstanceConfigVariables(
      input: { id: $instanceId, configVariables: $configVariables, configMode: $configMode, configComplete: $configComplete }
    ) {
      instance {
        id
      }
      errors {
        field
        messages
      }
    }
  }
`;

export const DEPLOY_INSTANCE = /* GraphQL */ `
  mutation deployInstanceWithUpdatedConfiguration($instanceId: ID!) {
    deployInstance(input: { id: $instanceId }) {
      errors {
        field
        messages
      }
      instance {
        id
      }
    }
  }
`;

export const DISCONNECT_CONNECTION = /* GraphQL */ `
  mutation disconnectConfigurationWizardConnection($id: ID!) {
    disconnectConnection(input: { id: $id }) {
      instanceConfigVariable {
        id
        status
      }
      errors {
        field
        messages
      }
    }
  }
`;

export const UPDATE_INSTANCE_VERSION = /* GraphQL */ `
  mutation updateInstanceVersion($instanceId: ID!, $integrationId: ID!) {
    updateInstance(
      input: {
        id: $instanceId
        integration: $integrationId
        configMode: "INSTANCE"
        preserveDeployState: true
      }
    ) {
      instance {
        id
      }
      errors {
        field
        messages
      }
    }
  }
`;

export const SET_INSTANCE_ENABLED = /* GraphQL */ `
  mutation setConfigurationWizardInstanceEnabled($instanceId: ID!, $enabled: Boolean!) {
    updateInstance(input: { id: $instanceId, enabled: $enabled }) {
      instance {
        id
        enabled
      }
      errors {
        field
        messages
      }
    }
  }
`;

/**
 * All of the active customer's instances (the JWT scopes the query — no customer
 * filter needed), with the fields the marketplace UI needs: name/date/status for
 * the card rows, `versionSequenceId` for matching each instance to its marketplace
 * integration (an instance deployed at v1 has a different integration id than the
 * marketplace's latest version node, but the same versionSequenceId), and the
 * deployed version + latest AVAILABLE version for per-instance update checks.
 * No pagination — the default page size is ample for one customer's instances in
 * this example.
 */
export const GET_CUSTOMER_INSTANCES = /* GraphQL */ `
  query getCustomerInstances {
    instances(isSystem: false) {
      nodes {
        id
        name
        enabled
        createdAt
        lastDeployedAt
        configState
        isCustomerUpgradeable
        integration {
          id
          versionNumber
          versionSequenceId
          versionSequence(
            first: 1
            marketplaceConfiguration_Istartswith: "AVAILABLE"
            orderBy: { direction: DESC, field: VERSION_NUMBER }
          ) {
            nodes {
              id
              versionNumber
            }
          }
        }
      }
    }
  }
`;

export const DELETE_INSTANCE = /* GraphQL */ `
  mutation deleteInstance($instanceId: ID!) {
    deleteInstance(input: { id: $instanceId }) {
      instance {
        id
      }
      errors {
        field
        messages
      }
    }
  }
`;

/**
 * Lightweight poll of every config variable's `status` (and recent logs) for an
 * instance. Used to watch an OAuth connection flip to "ACTIVE" after the user
 * authorizes in a separate tab. Kept verbatim from Prismatic's own query so the
 * status values match the built-in wizard. We only consume `status`; `logs` is
 * fetched but not surfaced.
 */
export const GET_OAUTH2_CONNECTION_STATUSES = /* GraphQL */ `
  query getLogsFromOauth2ConnectionConfigVars($resourceId: ID!, $startedAt: DateTime) {
    instance(id: $resourceId) {
      id
      configVariables {
        nodes {
          id
          ...ConfigVariable
        }
      }
      userLevelConfigVariables {
        nodes {
          id
          ...UserLevelConfigVariable
        }
      }
    }
  }

  fragment ConfigVariable on InstanceConfigVariable {
    id
    requiredConfigVariable {
      id
      key
      stableId
    }
    status
    logs(timestamp_Gte: $startedAt, orderBy: {field: TIMESTAMP, direction: DESC}) {
      nodes {
        id
        message
        timestamp
        severity
      }
    }
  }

  fragment UserLevelConfigVariable on UserLevelConfigVariable {
    id
    requiredConfigVariable {
      id
      key
      stableId
    }
    status
    logs(timestamp_Gte: $startedAt, orderBy: {field: TIMESTAMP, direction: DESC}) {
      nodes {
        id
        message
        timestamp
        severity
      }
    }
  }
`;
