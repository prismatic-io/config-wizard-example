import { connection, input } from '@prismatic-io/spectral';

export const AcmeAPIKeyConnection = connection({
  key: 'acmeApiKey',
  display: {
    label: 'Acme API Key',
    description: 'Connect to the Acme API using an API key',
  },
  inputs: {
    apiKey: input({
      label: 'API Key',
      type: 'password',
      required: true,
      comments: 'The API key provided by Acme. Find this in your Acme account settings.',
    }),
  },
});

export const connectionInput = input({
  label: 'Connection',
  type: 'connection',
  required: false,
  comments: 'Acme API connection credentials',
});
