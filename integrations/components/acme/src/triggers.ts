import { trigger } from "@prismatic-io/spectral";

// Placeholder passthrough webhook trigger — Acme POSTs every event here (each tagged with a
// `category`: deployments / security / billing), and the payload is handed to the flow as-is.
// Replace `perform` with real signature verification + payload parsing once the Acme webhook
// contract is wired up.

const eventWebhook = trigger({
  display: {
    label: "Event Webhook",
    description:
      "Receives webhook events from Acme. Each event carries a `category` (deployments, security, or billing) that the integration flow routes on.",
  },
  perform: (_context, payload) => Promise.resolve({ payload }),
  inputs: {},
  scheduleSupport: "invalid",
  synchronousResponseSupport: "invalid",
});

export default {
  eventWebhook,
};
