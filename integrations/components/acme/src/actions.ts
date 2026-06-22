import { AcmeClient } from "@acme/shared";
import { action } from "@prismatic-io/spectral";
import { connectionInput } from "./inputs";

const listEvents = action({
  display: {
    label: "List Events",
    description: "List recent notification events reported by Acme.",
  },
  inputs: {
    connection: connectionInput,
  },
  perform: async (context, params) => {
    const client = new AcmeClient({
      connection: params.connection,
      debug: context.debug.enabled,
    });
    const data = await client.get("/events");
    return { data };
  },
});

export default { listEvents };
