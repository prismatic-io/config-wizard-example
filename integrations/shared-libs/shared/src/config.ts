export type AcmeEnv = 'test' | 'prod';

const GATEWAY_URL_BY_ENV: Record<AcmeEnv, string> = {
  test: 'https://api-test.acme.example.com/v1',
  prod: 'https://api.acme.example.com/v1',
};

function resolveEnv(): AcmeEnv {
  const raw = (process.env.ACME_ENV || process.env.ENV || 'test').toLowerCase();
  return raw === 'prod' || raw === 'production' ? 'prod' : 'test';
}

export function getGatewayUrl(env: AcmeEnv = resolveEnv()): string {
  return GATEWAY_URL_BY_ENV[env];
}
