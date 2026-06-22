/// <reference types="node" />
import {
  configPage,
  customerActivatedConnection,
  dataSourceConfigVar,
} from "@prismatic-io/spectral";
import type { Connection, JSONForm } from "@prismatic-io/spectral/dist/types";
import { ACME_CATEGORIES, buildConfigForm } from "@acme/shared";
import type { ChannelOption } from "@acme/shared";
import { slackOauth2 } from "./manifests/slack/connections/oauth2";

if (
  !process.env.SLACK_CLIENT_ID ||
  !process.env.SLACK_CLIENT_SECRET ||
  !process.env.SLACK_SIGNING_SECRET
) {
  throw new Error(
    "SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_SIGNING_SECRET environment variables are required to run this integration."
  );
}

/**
 * Fetches the customer's Slack channels using the authorized Slack connection, so the Configuration form
 * can offer them as live options. Mirrors the built-in `selectChannels` data source (public channels, up
 * to the API page limit). Returns [] if the connection isn't authorized yet or the call fails — the form
 * then renders with no channel options rather than erroring the whole wizard page.
 */
const fetchSlackChannels = async (
  connection: Connection | undefined
): Promise<ChannelOption[]> => {
  const token = connection?.token?.access_token as string | undefined;
  if (!token) return [];
  try {
    const res = await fetch(
      "https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=1000",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const body = (await res.json()) as {
      ok: boolean;
      channels?: { id: string; name: string }[];
    };
    if (!body.ok || !body.channels) return [];
    return body.channels.map((c) => ({ key: c.id, label: `#${c.name}` }));
  } catch {
    return [];
  }
};

export const configPages = {
  Connections: configPage({
    tagline: "Authenticate with Slack and Acme",
    elements: {
      "Slack Connection": slackOauth2("slack-oauth-connection", {
        clientId: {
          value: process.env.SLACK_CLIENT_ID,
          permissionAndVisibilityType: "organization",
          visibleToOrgDeployer: false,
        },
        clientSecret: {
          value: process.env.SLACK_CLIENT_SECRET,
          permissionAndVisibilityType: "organization",
          visibleToOrgDeployer: false,
        },
        signingSecret: {
          value: process.env.SLACK_SIGNING_SECRET,
          permissionAndVisibilityType: "organization",
          visibleToOrgDeployer: false,
        },
        scopes: {
          value:
            "chat:write chat:write.public chat:write.customize channels:read groups:read im:read mpim:read",
          permissionAndVisibilityType: "organization",
          visibleToOrgDeployer: false,
        },
      }),
    },
  }),
  General: configPage({
    tagline: "Choose which notifications you want to receive.",
    elements: {
      // Single holistic jsonForm: every notification category with its enable toggle and a `delivery`
      // group (a live Slack-channel multi-select plus mode / minimum-level / quiet-hours) — all
      // enumerated up front. The custom wizard renders the General step (enable categories) and one
      // delivery sub-step per ENABLED category, all reading/writing slices of this one var's value.
      Configuration: dataSourceConfigVar({
        stableKey: "configuration",
        dataSourceType: "jsonForm",
        perform: async (context) => {
          const channels = await fetchSlackChannels(
            context.configVars["Slack Connection"] as Connection | undefined
          );
          return {
            result: buildConfigForm(
              {
                channelTitle: "Send to Slack channel",
                channelIcon: "hash",
                channelOptions: channels,
              },
              ACME_CATEGORIES,
            ),
          };
        },
      }),
      "SecondConfig": dataSourceConfigVar({
        stableKey: "second-config",
        dataSourceType: "jsonForm",
        perform: async (context) => {
          return {
            result: {
              schema: {
                type: "object", properties: {
                  exampleField: {
                    type: "string",
                    title: "Example field",
                    description: "This is an example of a second config variable.",
                  },
                }
              } as JSONForm["schema"],
              uiSchema: {
                type: "VerticalLayout",
                elements: [{ type: "Control", scope: "#" }],
              } as JSONForm["uiSchema"],
            },
          }
        },
      }),
    }
  })
}

export const scopedConfigVars = {
  "Acme Connection": customerActivatedConnection({
    stableKey: "acme-api-key",
  }),
};
