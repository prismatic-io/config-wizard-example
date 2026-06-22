import { componentManifests } from "@prismatic-io/spectral";
import slack from "./manifests/slack";
import acme from "./manifests/acme";

export const componentRegistry = componentManifests({
  slack,
  acme,
});
