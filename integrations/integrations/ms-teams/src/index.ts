import { integration } from "@prismatic-io/spectral";
import documentation from "../documentation.md";
import { componentRegistry } from "./componentRegistry";
import { configPages, scopedConfigVars } from "./configPages";
import flows from "./flows";

export { componentRegistry, configPages, scopedConfigVars };

export default integration({
  name: "ms-teams",
  description:
    "Route Acme Deployments, Security, and Billing notification events into Microsoft Teams channels.",
  iconPath: "ms-teams.png",
  documentation,
  flows,
  configPages,
  componentRegistry,
  scopedConfigVars,
});
