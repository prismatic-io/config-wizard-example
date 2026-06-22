import { componentManifests } from "@prismatic-io/spectral";
import acme from "./manifests/acme";

// Only the Acme component manifest is registered here — it supplies the webhook trigger the flow
// listens on. Unlike the Slack integration, there is no messaging-component manifest: the Teams
// "post" is a logged fake (see flows.ts), so no Teams component or connection is needed.
export const componentRegistry = componentManifests({
  acme,
});
