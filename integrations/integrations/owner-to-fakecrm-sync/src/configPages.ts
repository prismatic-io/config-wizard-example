import {
  configPage,
  connectionConfigVar,
  dataSourceConfigVar,
} from "@prismatic-io/spectral";
import {
  CRM_CONTACTS,
  dealOwnerLabel,
  formatUsd,
  getDeals,
} from "./mockData";
import { getMappedCrmIds, isDealMapped } from "./ownerMapping";
import { AcmeClient, type AcmeOwnerData } from "./acmeClient";

export const configPages = {
  "Connect FakeCRM": configPage({
    tagline: "Authenticate with FakeCRM",
    elements: {
      _0: "Connect your FakeCRM workspace so Acme can sync ownership data.",
      "FakeCRM Connection": connectionConfigVar({
        stableKey: "fakecrm-connection",
        dataType: "connection",
        inputs: {
          api_key: {
            label: "FakeCRM API Key",
            type: "password",
            required: true,
            comments:
              "Find this under Settings > API Keys in FakeCRM.",
          },
          workspace_id: {
            label: "Workspace ID",
            type: "string",
            required: false,
            example: "WS-38291",
          },
          base_url: {
            label: "FakeCRM API Base URL",
            type: "string",
            required: false,
            default: "https://api.fakecrm.example.com",
            permissionAndVisibilityType: "organization",
          },
        },
      }),
    },
  }),
  "Mapping Owner": configPage({
    tagline: "Map FakeCRM contacts to Acme owners",
    elements: {
      _0: "Select the FakeCRM Contact from the dropdown list to map to the Acme Owner.",
      "Owner Mapping": dataSourceConfigVar({
        stableKey: "owner-mapping",
        dataSourceType: "jsonForm",
        description: "Match each FakeCRM contact to its Acme owner",
        perform: async (context) => {
          const client = new AcmeClient();
          const owners = await client
            .resources<AcmeOwnerData>("owner")
            .list();

          if (owners.length === 0) {
            return {
              result: {
                schema: {
                  type: "object",
                  properties: {
                    notice: {
                      type: "string",
                      title: "No Acme owners found",
                      description:
                        "Create owners in Acme first, then re-open this step.",
                    },
                  },
                },
                uiSchema: {
                  type: "VerticalLayout",
                  elements: [
                    { type: "Control", scope: "#/properties/notice" },
                  ],
                },
                data: {},
              },
            };
          }

          const contactOneOf = CRM_CONTACTS.map((c) => ({
            const: c.id,
            title: c.name,
          }));

          // Acme owners come in different types (person, team, company).
          // Merge them all into one picklist, labeled by type, and append
          // "Create ..." options so the user can choose to create the
          // counterpart in Acme instead of mapping an existing owner.
          const typeLabel = (ownerType?: string): string =>
            ({
              individual: "Person",
              shared: "Shared",
              team: "Team",
              company: "Company",
            })[ownerType ?? ""] ?? "Person";
          const ownerOneOf = [
            ...owners.map((o) => ({
              const: String(o.id),
              title: `${String(o.data.name ?? `Owner #${o.id}`)} (${typeLabel(o.data.owner_type)})`,
            })),
            { const: "create:person", title: "+ Create Person" },
            { const: "create:team", title: "+ Create Team" },
            { const: "create:company", title: "+ Create Company" },
          ];

          const schema = {
            type: "object",
            properties: {
              mappings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    crmContact: {
                      type: "string",
                      title: "FakeCRM Contact",
                      description: "The owner as it exists in FakeCRM.",
                      oneOf: contactOneOf,
                    },
                    acmeOwner: {
                      type: "string",
                      title: "Acme Owner",
                      description:
                        "The Acme owner this FakeCRM contact syncs to — or create a new one.",
                      oneOf: ownerOneOf,
                    },
                  },
                },
              },
            },
          };

          // Accordion is the array layout that honors the `detail` option —
          // each mapping renders as a panel whose detail is a horizontal
          // pair of type-ahead autocomplete fields.
          const uiSchema = {
            type: "VerticalLayout",
            elements: [
              {
                type: "Label",
                text: "Map each FakeCRM Contact to the matching Acme Owner. Expand a row to change its mapping.",
              },
              {
                type: "Control",
                scope: "#/properties/mappings",
                label: "Owner Mapping",
                options: {
                  layout: "Accordion",
                  elementLabelProp: "crmContact",
                  detail: {
                    type: "HorizontalLayout",
                    elements: [
                      {
                        type: "Control",
                        scope: "#/properties/crmContact",
                        options: { autocomplete: true },
                      },
                      {
                        type: "Control",
                        scope: "#/properties/acmeOwner",
                        options: { autocomplete: true },
                      },
                    ],
                  },
                },
              },
            ],
          };

          // Pre-match FakeCRM contacts to Acme owners by normalized name so
          // the mapping arrives mostly filled in (like a real integration).
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
          const data = {
            mappings: CRM_CONTACTS.map((c) => {
              const match = owners.find(
                (o) => norm(String(o.data.name ?? "")) === norm(c.name),
              );
              return {
                crmContact: c.id,
                acmeOwner: match ? String(match.id) : "",
              };
            }),
          };

          return { result: { schema, uiSchema, data } };
        },
      }),
    },
  }),
  "Link Deals": configPage({
    tagline: "Choose the deals to link",
    elements: {
      _0: "Choose all the deals that you want to sync into your Acme workspace.",
      "Linked Deals": dataSourceConfigVar({
        stableKey: "linked-deals",
        dataSourceType: "jsonForm",
        description: "Deals to sync into the Acme workspace",
        perform: async (context) => {
          // Account-scoped, mapping-aware (mirrors prod): the account's
          // deals come from one account-level fetch with ownership as a field
          // on each deal; the Owner Mapping from the previous page scopes
          // which deals are offered — a deal whose FakeCRM owner isn't
          // mapped to an Acme owner is hidden.
          const mappedIds = getMappedCrmIds(
            context.configVars["Owner Mapping"] as unknown,
          );
          const allDeals = getDeals();
          const visible = allDeals.filter((d) => isDealMapped(d, mappedIds));
          const excluded = allDeals.length - visible.length;
          const subtotal = visible.reduce((sum, d) => sum + d.value, 0);

          // Manually-built checklist grid: the array renderers can't match
          // the target UI (plain-text cells, checkbox-first, no add/delete
          // chrome), so each row is a HorizontalLayout of one boolean
          // Control followed by static Label cells.
          return {
            result: {
              schema: {
                type: "object",
                properties: Object.fromEntries(
                  visible.map((d) => [
                    d.key,
                    { type: "boolean", default: true },
                  ]),
                ),
              },
              uiSchema: {
                type: "VerticalLayout",
                elements: [
                  {
                    type: "HorizontalLayout",
                    elements: [
                      { type: "Label", text: "Link" },
                      { type: "Label", text: "Deal" },
                      { type: "Label", text: "Owner" },
                      { type: "Label", text: "Amount" },
                    ],
                  },
                  ...visible.map((d) => ({
                    type: "HorizontalLayout",
                    elements: [
                      {
                        type: "Control",
                        scope: `#/properties/${d.key}`,
                        label: false,
                        options: { trim: true, slider: true },
                      },
                      { type: "Label", text: d.name },
                      { type: "Label", text: dealOwnerLabel(d) },
                      { type: "Label", text: formatUsd(d.value) },
                    ],
                  })),
                  // Column-aligned footer row — the summary reads like a
                  // table footer instead of dense text above the header.
                  {
                    type: "HorizontalLayout",
                    elements: [
                      { type: "Label", text: "" },
                      {
                        type: "Label",
                        text: `Total (${visible.length} deal${visible.length === 1 ? "" : "s"} found)`,
                      },
                      { type: "Label", text: "" },
                      { type: "Label", text: formatUsd(subtotal) },
                    ],
                  },
                  ...(excluded > 0
                    ? [
                        {
                          type: "Label",
                          text: `${excluded} deal${excluded === 1 ? "" : "s"} hidden — their FakeCRM owner is not mapped to an Acme owner.`,
                        },
                      ]
                    : []),
                ],
              },
              data: Object.fromEntries(visible.map((d) => [d.key, true])),
            },
          };
        },
      }),
    },
  }),
  "Deals Confirmation": configPage({
    tagline: "Confirm the deals to link",
    elements: {
      _0: "Please confirm the deals that you want to sync into your Acme workspace.",
      "Linked Deals Summary": dataSourceConfigVar({
        stableKey: "linked-deals-summary",
        dataSourceType: "jsonForm",
        description: "Review of the deals that will be linked",
        perform: async (context) => {
          // Same derivation as the Link Deals page: account-scoped deals
          // filtered to mapped owners, then to the boxes left checked.
          const mappedIds = getMappedCrmIds(
            context.configVars["Owner Mapping"] as unknown,
          );
          const available = getDeals().filter((d) =>
            isDealMapped(d, mappedIds),
          );

          let selected = available;
          try {
            const raw = context.configVars["Linked Deals"] as unknown;
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (parsed && typeof parsed === "object") {
              selected = available.filter(
                (d) => (parsed as Record<string, boolean>)[d.key] !== false,
              );
            }
          } catch {
            // keep the all-available fallback
          }
          const total = selected.reduce((sum, d) => sum + d.value, 0);
          return {
            result: {
              // No schema properties — the page renders only static labels.
              schema: { type: "object", properties: {} },
              uiSchema: {
                type: "VerticalLayout",
                elements: [
                  {
                    type: "HorizontalLayout",
                    elements: [
                      { type: "Label", text: "Deal" },
                      { type: "Label", text: "Owner" },
                      { type: "Label", text: "Amount" },
                    ],
                  },
                  ...selected.map((d) => ({
                    type: "HorizontalLayout",
                    elements: [
                      { type: "Label", text: d.name },
                      { type: "Label", text: dealOwnerLabel(d) },
                      { type: "Label", text: formatUsd(d.value) },
                    ],
                  })),
                  // Column-aligned footer row, matching the linking page.
                  {
                    type: "HorizontalLayout",
                    elements: [
                      {
                        type: "Label",
                        text: `Total (${selected.length}/${available.length} selected)`,
                      },
                      { type: "Label", text: "" },
                      { type: "Label", text: formatUsd(total) },
                    ],
                  },
                ],
              },
              data: {},
            },
          };
        },
      }),
    },
  }),
};
