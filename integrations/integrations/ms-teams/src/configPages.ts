/// <reference types="node" />
import { configPage, customerActivatedConnection, dataSourceConfigVar } from "@prismatic-io/spectral";
import { ACME_CATEGORIES, buildConfigForm } from "@acme/shared";
import type { ChannelOption } from "@acme/shared";

/**
 * A statically faked Microsoft Teams channel list. The Slack integration fetches real channels
 * from an authorized Slack connection at config time; this demo has no real Teams connection, so
 * we hand the same `buildConfigForm` helper a hard-coded list instead. Labels use Teams'
 * "Team / Channel" shape so the multi-select reads like a real Teams workspace. Channel keys
 * mimic Teams' `19:...@thread.tacv2` conversation IDs.
 */
const FAKE_TEAMS_CHANNELS: ChannelOption[] = [
  { key: "19:eng-deploys@thread.tacv2", label: "Engineering / Deploys" },
  { key: "19:eng-releases@thread.tacv2", label: "Engineering / Releases" },
  { key: "19:security-alerts@thread.tacv2", label: "Security / Alerts" },
  { key: "19:security-signins@thread.tacv2", label: "Security / Sign-ins" },
  { key: "19:finance-billing@thread.tacv2", label: "Finance / Billing" },
  { key: "19:exec-briefing@thread.tacv2", label: "Leadership / Exec Briefing" },
];

export const configPages = {
  // No Connections page: the Teams channel list is faked, so there is no OAuth/connection step.
  // The wizard opens straight on this General page's holistic Configuration jsonForm.
  General: configPage({
    tagline: "Choose which notifications you want to receive.",
    elements: {
      // Single holistic jsonForm built by the SHARED `buildConfigForm` from the SAME three category
      // modules the Slack integration uses. The only integration-specific input is the channel
      // adapter (Teams title + faked Teams channels). The custom config wizard renders the General
      // step (enable categories) and one delivery sub-step per ENABLED category — all reading/writing
      // slices of this one var's value. This is the proof: one renderer, one shared config-var
      // library, two integrations.
      Configuration: dataSourceConfigVar({
        stableKey: "configuration",
        dataSourceType: "jsonForm",
        perform: async () => {
          return {
            result: buildConfigForm(
              {
                channelTitle: "Send to Teams channel",
                channelIcon: "hash",
                channelOptions: FAKE_TEAMS_CHANNELS,
              },
              ACME_CATEGORIES,
            ),
          };
        },
      }),
    },
  }),
};

export const scopedConfigVars = {
  // Reused verbatim from the Slack integration — the shared, org-scoped Acme API connection that
  // authorizes the category webhooks. Not a customer wizard step.
  "Acme Connection": customerActivatedConnection({
    stableKey: "acme-api-key",
  }),
};
