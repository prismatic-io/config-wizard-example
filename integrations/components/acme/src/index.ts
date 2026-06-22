import { component } from "@prismatic-io/spectral";
import { AcmeAPIKeyConnection } from "@acme/shared";
import actions from "./actions";
import triggers from "./triggers";

export default component({
  key: "acme",
  public: false,
  display: {
    label: "Acme",
    description:
      "The Acme system: an API key connection, a `listEvents` action, and an event webhook trigger that emits deployment, security, and billing events.",
    iconPath: "acme.png",
    category: "Acme",
  },
  actions,
  triggers,
  connections: [AcmeAPIKeyConnection],
});
