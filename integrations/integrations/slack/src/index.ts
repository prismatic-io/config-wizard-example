import { integration } from "@prismatic-io/spectral";
import documentation from "../documentation.md";
import { componentRegistry } from "./componentRegistry";
import { configPages, scopedConfigVars } from "./configPages";
import flows from "./flows";

export { componentRegistry, configPages, scopedConfigVars };

export default integration({
  name: "slack",
  description:
    "Route Acme Deployments, Security, and Billing notification events into Slack channels.",
  iconPath: "slack.png",
  documentation,
  flows,
  configPages,
  componentRegistry,
  scopedConfigVars,
});
