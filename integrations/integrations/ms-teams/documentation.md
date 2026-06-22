# ms-teams

Routes Acme Deployments, Security, and Billing notification events into Microsoft Teams
channels.

This integration is a sibling of the Slack integration: it reuses the exact same shared config
library (`@acme/shared` + the per-category modules) to build its configuration wizard. The only
difference is the channel adapter — it targets Teams channels instead of Slack channels. The
Teams channel list is faked for demonstration purposes; there is no live Teams connection.
